// SafeBet IQ — B5 Governance Evidence & Compliance Export: pure domain logic.
//   node --test tests/governanceEvidence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  GOV_EVIDENCE_SCHEMA_VERSION, GOV_MAX_RANGE_DAYS, GOV_MAX_EXPORT_ROWS, GOV_SYNTHETIC_DISCLAIMER,
  GOV_EVENT_ALLOWLIST, GOV_ALLOWLISTED_CATEGORIES, GOV_EXPORT_AUDIT_ACTION, isAllowlistedEvent,
  mapAuditRow, mapTimeline, mapSnapshot, buildInterventionSummary, buildProtectionAlertSummary,
  emptyProtectionAlertSummary, mapChainVerifier, validateGovPeriod, isPeriodError, canonicalJson,
  buildTimelineCsv, assertNoProhibitedGovernanceClaims, eventCountsByAction,
} from '../lib/responsibleProfitability/governanceEvidence.ts';

// ── allowlist ──
test('exactly 10 allowlisted triples; categories = responsible_gambling/player_protection/compliance', () => {
  assert.equal(GOV_EVENT_ALLOWLIST.length, 10);
  assert.deepEqual([...GOV_ALLOWLISTED_CATEGORIES].sort(), ['compliance', 'player_protection', 'responsible_gambling']);
});
test('isAllowlistedEvent is exact-triple; no category-only / wildcard / near-miss', () => {
  assert.equal(isAllowlistedEvent('responsible_gambling', 'protection_alert.generated', 'protection_alert.generated'), true);
  assert.equal(isAllowlistedEvent('compliance', 'report.generated', 'GENERATE_REPORT'), true);
  // right category, wrong/unknown action → excluded
  assert.equal(isAllowlistedEvent('player_protection', 'player.risk_level_changed', 'UPDATE_RISK_LEVEL'), false);
  assert.equal(isAllowlistedEvent('player_protection', 'player.flagged', 'FLAG_PLAYER'), false);
  // excluded categories entirely
  assert.equal(isAllowlistedEvent('auth', 'login', 'demo_quick_login'), false);
  assert.equal(isAllowlistedEvent('security', 'x', 'y'), false);
  assert.equal(isAllowlistedEvent('evidence', 'export', 'export'), false);
  // future/unknown action under an allowed category → excluded
  assert.equal(isAllowlistedEvent('compliance', 'something.new', 'FUTURE_ACTION'), false);
  // mismatched triple (real category+action but wrong event_type) → excluded
  assert.equal(isAllowlistedEvent('compliance', 'report.generated', 'CREATE_SNAPSHOT'), false);
});
test('export-audit action is NOT allowlisted (prevents self-reference/recursion)', () => {
  assert.equal(GOV_EXPORT_AUDIT_ACTION, 'governance_evidence.exported');
  assert.equal(isAllowlistedEvent('responsible_gambling', 'governance_evidence.exported', 'governance_evidence.exported'), false);
});

// ── timeline minimisation / PII exclusion ──
test('mapAuditRow emits only the 8 safe fields; never PII/internals/resourceRef', () => {
  const raw = {
    created_at: '2026-05-10T08:00:00Z', event_category: 'compliance', event_type: 'report.generated', action: 'GENERATE_REPORT',
    severity: 'info', outcome: 'success', user_role: 'compliance_officer', resource_type: 'report',
    // hostile extras that must never survive:
    id: 'ID', event_id: 'EVT', user_id: 'UID', user_email: 'a@b.com', ip_address: '1.2.3.4', user_agent: 'UA',
    session_id: 'S', correlation_id: 'C', old_value: { x: 1 }, new_value: { y: 2 }, metadata: { secret: 1 },
    hash: 'H', previous_hash: 'PH', chain_scope: 'CS', chain_sequence: 9, resource_id: 'player-uuid', casino_id: 'CAS',
  };
  const item = mapAuditRow(raw);
  assert.deepEqual(Object.keys(item).sort(), ['action', 'actorRole', 'auditOutcome', 'auditSeverity', 'category', 'eventType', 'occurredAt', 'resourceType'].sort());
  const forbidden = ['id', 'event_id', 'user_id', 'user_email', 'ip_address', 'user_agent', 'session_id', 'correlation_id', 'old_value', 'new_value', 'metadata', 'hash', 'previous_hash', 'chain_scope', 'chain_sequence', 'resource_id', 'resourceRef', 'casino_id', 'severity', 'outcome'];
  for (const f of forbidden) assert.ok(!(f in item), `DTO must not contain ${f}`);
  const blob = JSON.stringify(item);
  for (const v of ['a@b.com', '1.2.3.4', 'player-uuid', 'UID', 'EVT', '"H"', 'secret']) assert.ok(!blob.includes(v), `leaked ${v}`);
});
test('mapTimeline drops non-allowlisted rows', () => {
  const rows = [
    { created_at: 't1', event_category: 'compliance', event_type: 'report.generated', action: 'GENERATE_REPORT', severity: 'info', outcome: 'success', user_role: 'x', resource_type: 'report' },
    { created_at: 't2', event_category: 'player_protection', event_type: 'player.risk_level_changed', action: 'UPDATE_RISK_LEVEL', severity: 'info', outcome: 'success', user_role: 'x', resource_type: 'player' },
    { created_at: 't3', event_category: 'auth', event_type: 'login', action: 'demo_quick_login', severity: 'info', outcome: 'success', user_role: 'x', resource_type: 'auth' },
  ];
  const out = mapTimeline(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'GENERATE_REPORT');
});

// ── compliance snapshot DTO ──
test('mapSnapshot relabels compliance_score → selfAssessmentScore (no "certified")', () => {
  const s = mapSnapshot({ framework: 'SANS', total_controls: 10, compliant: 7, non_compliant: 1, partial: 1, not_assessed: 1, compliance_score: 72.5, snapshot_date: '2026-05-01' });
  assert.equal(s.selfAssessmentScore, 72.5);
  assert.ok(!('compliance_score' in s) && !('casino_id' in s) && !('id' in s));
  assert.equal(s.compliantCount, 7); assert.equal(s.snapshotDate, '2026-05-01');
});

// ── intervention + protection-alert summaries ──
test('intervention summary counts occurrence + follow-up-required (never effectiveness)', () => {
  const s = buildInterventionSummary([{ outcome: 'accepted', follow_up_required: true }, { outcome: 'pending', follow_up_required: false }, { outcome: 'accepted', follow_up_required: true }]);
  assert.equal(s.interventionsRecorded, 3);
  assert.equal(s.byOutcomeCategory.accepted, 2);
  assert.equal(s.followUpRequiredCount, 2);
});
test('protection-alert summary shape by B4.1 type; empty is all-zero', () => {
  const e = emptyProtectionAlertSummary();
  assert.deepEqual(Object.keys(e.byType).sort(), ['INTERVENTION_FOLLOW_UP_OVERDUE', 'SELF_EXCLUSION_BREACH_REVIEW']);
  const s = buildProtectionAlertSummary([{ alert_type: 'SELF_EXCLUSION_BREACH_REVIEW', generated: 2, acknowledged: 1, resolved: 1 }]);
  assert.deepEqual(s.byType.SELF_EXCLUSION_BREACH_REVIEW, { generated: 2, acknowledged: 1, resolved: 1 });
});

// ── chain mapping ──
test('chain verifier maps verified/broken/unavailable → VERIFIED/FAILED/UNAVAILABLE; no raw hashes', () => {
  const v = mapChainVerifier({ status: 'verified', events_checked: 120, verified_at: '2026-05-10T00:00:00Z', last_sequence: 120, expected_head: 'abc123hash' });
  assert.deepEqual({ s: v.status, e: v.eventsChecked }, { s: 'VERIFIED', e: 120 });
  assert.equal(v.reason, null);
  assert.ok(!JSON.stringify(v).includes('abc123hash'));
  const b = mapChainVerifier({ status: 'broken', events_checked: 5, first_failing_sequence: 6, reason: 'previous_hash linkage broken' });
  assert.equal(b.status, 'FAILED');
  assert.ok(!JSON.stringify(b).includes('previous_hash') && !JSON.stringify(b).includes('6'));
  assert.match(b.reason, /did not pass/);
  assert.equal(mapChainVerifier({ status: 'unavailable', reason: 'not authorised for this chain scope' }).status, 'UNAVAILABLE');
  assert.equal(mapChainVerifier(null).status, 'UNAVAILABLE');
});

// ── period validation ──
test('period validation: SAST inclusive/exclusive, formats, impossible dates, order, max range', () => {
  const ok = validateGovPeriod('2026-05-01', '2026-05-31');
  assert.ok(!isPeriodError(ok));
  assert.equal(ok.startIso, '2026-05-01T00:00:00+02:00');
  assert.equal(ok.endIsoExclusive, '2026-05-31T00:00:00+02:00');
  assert.equal(isPeriodError(validateGovPeriod(null, '2026-05-31')), true);
  assert.equal(isPeriodError(validateGovPeriod('2026/05/01', '2026-05-31')), true);
  assert.equal(isPeriodError(validateGovPeriod('2026-02-30', '2026-03-10')), true); // impossible date
  assert.equal(isPeriodError(validateGovPeriod('2026-05-31', '2026-05-01')), true); // end<=start
  assert.equal(isPeriodError(validateGovPeriod('2026-05-01', '2026-05-01')), true); // equal (end exclusive)
  assert.equal(isPeriodError(validateGovPeriod('2025-01-01', '2026-06-01')), true); // > 366 days
  const exactly366 = validateGovPeriod('2026-01-01', '2027-01-02'); // 366 days
  assert.ok(!isPeriodError(exactly366));
});

// ── canonical JSON + pack SHA determinism ──
test('canonicalJson is key-order independent and deterministic', () => {
  const a = canonicalJson({ b: 1, a: [3, { y: 2, x: 1 }], c: null });
  const b = canonicalJson({ c: null, a: [3, { x: 1, y: 2 }], b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":[3,{"x":1,"y":2}],"b":1,"c":null}');
});
test('pack SHA-256 over canonical JSON excludes packIntegrity and is reproducible', () => {
  const pack = { schemaVersion: 'b5.v1', packId: 'p1', packMetadata: { casinoId: 'c', generatedAt: 't' }, auditTimeline: [] };
  const sha1 = createHash('sha256').update(Buffer.from(canonicalJson(pack), 'utf8')).digest('hex');
  const sha2 = createHash('sha256').update(Buffer.from(canonicalJson({ ...pack }), 'utf8')).digest('hex');
  assert.equal(sha1, sha2);
  // adding packIntegrity AFTER hashing must not be part of the hashed bytes
  const withInteg = { ...pack, packIntegrity: { packSha256: sha1 } };
  assert.notEqual(canonicalJson(withInteg), canonicalJson(pack));
});

// ── CSV injection safety (timeline only) ──
test('buildTimelineCsv neutralises formula injection + quotes; timeline columns only', () => {
  const items = [{ occurredAt: '2026-05-10T08:00:00Z', category: 'compliance', eventType: 'report.generated', action: '=HYPERLINK("evil")', auditSeverity: 'info', auditOutcome: 'success', actorRole: 'compliance_officer', resourceType: 'report,x' }];
  const csv = buildTimelineCsv(items, [['=cmd_meta']]);
  assert.ok(csv.includes("'=HYPERLINK"), 'formula cell must be prefixed with a quote');
  assert.ok(csv.includes("'=cmd_meta"), 'metadata formula cell neutralised');
  assert.ok(csv.includes('"report,x"'), 'comma cell quoted');
  assert.ok(csv.includes('occurred_at_sast,category,event_type,action,audit_severity,audit_outcome,actor_role,resource_type'));
  // no player/actor-id columns exist
  assert.ok(!/player_id|user_id|user_email/.test(csv));
});

// ── prohibited claims guard ──
test('prohibited-claims guard catches certification/effectiveness/causal; passes governed wording', () => {
  assert.throws(() => assertNoProhibitedGovernanceClaims(['Operator is certified compliant']));
  assert.throws(() => assertNoProhibitedGovernanceClaims(['intervention effectiveness proven']));
  assert.throws(() => assertNoProhibitedGovernanceClaims(['regulator-approved']));
  assert.doesNotThrow(() => assertNoProhibitedGovernanceClaims([
    GOV_SYNTHETIC_DISCLAIMER,
    'Audit-chain integrity verification',
    'Recorded compliance self-assessment',
    'alert generated / acknowledged / resolved',
    null, undefined,
  ]));
});

// ── locked decision: artifact carries display name only, never raw casino_id ──
test('artifact code paths emit casinoName, never casino_id (locked decision)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const server = readFileSync(join(here, '..', 'lib', 'responsibleProfitability', 'governanceEvidenceServer.ts'), 'utf8');
  const exp = readFileSync(join(here, '..', 'app', 'api', 'casino', 'governance-evidence', 'export', 'route.ts'), 'utf8');
  // packMetadata assembled in the server must not include a casinoId field
  const metaBlock = server.slice(server.indexOf('const packMetadata'), server.indexOf('const packMetadata') + 400);
  assert.ok(metaBlock.includes('casinoName'), 'packMetadata must carry casinoName');
  assert.ok(!/casinoId\s*:/.test(metaBlock), 'packMetadata must NOT carry casinoId');
  // CSV metadata rows + filename must not embed casino_id
  assert.ok(!/#\s*casino_id/.test(exp), 'CSV metadata must not contain a casino_id row');
  assert.ok(!/scopeCasino\.slice/.test(exp), 'filename must not embed a casino_id fragment');
});

// ── constants ──
test('locked constants', () => {
  assert.equal(GOV_EVIDENCE_SCHEMA_VERSION, 'b5.v1');
  assert.equal(GOV_MAX_RANGE_DAYS, 366);
  assert.equal(GOV_MAX_EXPORT_ROWS, 50000);
  assert.equal(GOV_SYNTHETIC_DISCLAIMER, 'SYNTHETIC / DEMONSTRATION DATA — Not for regulatory submission or evidentiary reliance.');
  assert.equal(eventCountsByAction([{ action: 'X' }, { action: 'X' }, { action: 'Y' }]).X, 2);
});
