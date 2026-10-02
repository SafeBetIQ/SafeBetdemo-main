// ─── SafeBet IQ — Responsible Profitability B5: Governance Evidence & Export ───
//
// PURE, deterministic, client/server/test-safe domain layer for operator-local
// governance-evidence export. No I/O, no node:crypto at module scope (hashing lives
// in governanceEvidenceServer.ts). It defines the EXACT event allowlist, the
// data-minimised DTOs, period validation, canonical JSON, the injection-safe CSV
// (reusing the verified csvCell), the chain-status mapping, and the prohibited-claims
// safeguard. The database is never mutated by this module; it only shapes governed reads.
//
// Hard rules enforced here: no player identifiers, no actor identity (role only), no
// resourceRef, no raw audit internals/metadata/hashes, no certification/effectiveness
// claims. An event is exported ONLY if its exact (category, event_type, action) triple
// is on the allowlist — never by category-only / wildcard / startsWith / contains.

import { csvCell } from './dashboardView.ts';

export const GOV_EVIDENCE_SCHEMA_VERSION = 'b5.v1';
export const GOV_MAX_RANGE_DAYS = 366;
export const GOV_MAX_EXPORT_ROWS = 50000;
export const GOV_PREVIEW_PAGE_SIZE = 200;
export const GOV_TIMEZONE = 'Africa/Johannesburg';
export const GOV_SYNTHETIC_DISCLAIMER =
  'SYNTHETIC / DEMONSTRATION DATA — Not for regulatory submission or evidentiary reliance.';
export const GOV_PACK_SHA_NOTE =
  'Pack SHA-256 is an integrity checksum for this generated export. It is NOT the SafeBet audit-chain hash, '
  + 'NOT a digital signature, NOT regulatory certification, and NOT legal attestation.';
/** The export-audit action — deliberately NOT on the timeline allowlist (prevents self-reference/recursion). */
export const GOV_EXPORT_AUDIT_ACTION = 'governance_evidence.exported';

export type GovAlertType = 'SELF_EXCLUSION_BREACH_REVIEW' | 'INTERVENTION_FOLLOW_UP_OVERDUE';
export const GOV_ALERT_TYPES: readonly GovAlertType[] = ['SELF_EXCLUSION_BREACH_REVIEW', 'INTERVENTION_FOLLOW_UP_OVERDUE'];

// ── Exact (category, event_type, action) allowlist — the ONLY exported events ──
export interface GovEventTriple { category: string; eventType: string; action: string }
export const GOV_EVENT_ALLOWLIST: readonly GovEventTriple[] = [
  { category: 'responsible_gambling', eventType: 'protection_alert.generated',    action: 'protection_alert.generated' },
  { category: 'responsible_gambling', eventType: 'protection_alert.acknowledged', action: 'protection_alert.acknowledged' },
  { category: 'responsible_gambling', eventType: 'protection_alert.resolved',     action: 'protection_alert.resolved' },
  { category: 'player_protection',    eventType: 'intervention.created',          action: 'CREATE_INTERVENTION' },
  { category: 'player_protection',    eventType: 'intervention.delivered',        action: 'DELIVER_INTERVENTION' },
  { category: 'compliance',           eventType: 'exclusion.registered',          action: 'REGISTER_EXCLUSION' },
  { category: 'compliance',           eventType: 'exclusion.lifted',              action: 'LIFT_EXCLUSION' },
  { category: 'compliance',           eventType: 'exclusion.breach_detected',     action: 'BREACH_DETECTED' },
  { category: 'compliance',           eventType: 'compliance.snapshot_created',   action: 'CREATE_SNAPSHOT' },
  { category: 'compliance',           eventType: 'report.generated',              action: 'GENERATE_REPORT' },
];
const SEP = '';
const allowKey = (c: string, e: string, a: string) => `${c}${SEP}${e}${SEP}${a}`;
const ALLOW_SET = new Set(GOV_EVENT_ALLOWLIST.map((t) => allowKey(t.category, t.eventType, t.action)));
/** Exact-triple membership. Never category-only, wildcard, startsWith, or contains. */
export function isAllowlistedEvent(category: string, eventType: string, action: string): boolean {
  return ALLOW_SET.has(allowKey(category, eventType, action));
}
export const GOV_ALLOWLISTED_CATEGORIES: readonly string[] = Array.from(new Set(GOV_EVENT_ALLOWLIST.map((t) => t.category)));

// ── Minimised audit-timeline DTO (no resourceRef; no actor identity; no internals) ──
export interface GovAuditTimelineItem {
  occurredAt: string;        // created_at (ISO)
  category: string;
  eventType: string;
  action: string;
  auditSeverity: string;     // deliberately named auditSeverity (not "severity")
  auditOutcome: string;      // deliberately named auditOutcome (not "outcome" → never intervention effectiveness)
  actorRole: string | null;  // user_role ONLY
  resourceType: string | null;
}
/** The ONLY audit_events columns the server reads for the timeline. */
export interface RawAuditRow {
  created_at: string; event_category: string; event_type: string; action: string;
  severity: string; outcome: string; user_role: string | null; resource_type: string | null;
}
// Explicit field assignment — can never carry id, user_id, user_email, ip_address,
// user_agent, session_id, correlation_id, old_value, new_value, metadata, hash,
// previous_hash, chain columns, resource_id, casino_id, or any player data.
export function mapAuditRow(r: RawAuditRow): GovAuditTimelineItem {
  return {
    occurredAt: r.created_at, category: r.event_category, eventType: r.event_type, action: r.action,
    auditSeverity: r.severity, auditOutcome: r.outcome, actorRole: r.user_role ?? null, resourceType: r.resource_type ?? null,
  };
}
/** Map + defence-in-depth filter: only allowlisted triples survive. */
export function mapTimeline(rows: RawAuditRow[]): GovAuditTimelineItem[] {
  return rows.filter((r) => isAllowlistedEvent(r.event_category, r.event_type, r.action)).map(mapAuditRow);
}

// ── Compliance snapshot DTO (self-assessment; relabelled score) ──
export interface GovComplianceSnapshot {
  framework: string;
  totalControls: number | null;
  compliantCount: number | null;
  nonCompliantCount: number | null;
  partialCount: number | null;
  notAssessedCount: number | null;
  selfAssessmentScore: number | null; // from compliance_score — never "certified/regulatory"
  snapshotDate: string;
}
export interface RawSnapshotRow {
  framework: string; total_controls: number | null; compliant: number | null; non_compliant: number | null;
  partial: number | null; not_assessed: number | null; compliance_score: number | null; snapshot_date: string;
}
export function mapSnapshot(r: RawSnapshotRow): GovComplianceSnapshot {
  return {
    framework: r.framework, totalControls: r.total_controls ?? null, compliantCount: r.compliant ?? null,
    nonCompliantCount: r.non_compliant ?? null, partialCount: r.partial ?? null, notAssessedCount: r.not_assessed ?? null,
    selfAssessmentScore: r.compliance_score ?? null, snapshotDate: r.snapshot_date,
  };
}

// ── Intervention occurrence summary (B2 semantics: occurrence ≠ effectiveness) ──
export interface GovInterventionSummary {
  interventionsRecorded: number;
  byOutcomeCategory: Record<string, number>;
  followUpRequiredCount: number;
}
export function buildInterventionSummary(rows: { outcome: string | null; follow_up_required: boolean | null }[]): GovInterventionSummary {
  const byOutcomeCategory: Record<string, number> = {};
  let followUpRequiredCount = 0;
  for (const r of rows) {
    const key = r.outcome ?? 'unspecified';
    byOutcomeCategory[key] = (byOutcomeCategory[key] ?? 0) + 1;
    if (r.follow_up_required === true) followUpRequiredCount += 1;
  }
  return { interventionsRecorded: rows.length, byOutcomeCategory, followUpRequiredCount };
}

// ── Protection-alert activity summary by B4.1 type (counts only; no player data) ──
export interface GovAlertTypeCounts { generated: number; acknowledged: number; resolved: number }
export interface GovProtectionAlertSummary { byType: Record<GovAlertType, GovAlertTypeCounts> }
export function emptyProtectionAlertSummary(): GovProtectionAlertSummary {
  return {
    byType: {
      SELF_EXCLUSION_BREACH_REVIEW: { generated: 0, acknowledged: 0, resolved: 0 },
      INTERVENTION_FOLLOW_UP_OVERDUE: { generated: 0, acknowledged: 0, resolved: 0 },
    },
  };
}
export function buildProtectionAlertSummary(rows: { alert_type: string; generated: number; acknowledged: number; resolved: number }[]): GovProtectionAlertSummary {
  const s = emptyProtectionAlertSummary();
  for (const r of rows) {
    if (r.alert_type === 'SELF_EXCLUSION_BREACH_REVIEW' || r.alert_type === 'INTERVENTION_FOLLOW_UP_OVERDUE') {
      s.byType[r.alert_type] = { generated: r.generated | 0, acknowledged: r.acknowledged | 0, resolved: r.resolved | 0 };
    }
  }
  return s;
}

// ── Chain-integrity mapping (operator-safe; no raw hashes/sequence) ──
export type GovChainStatus = 'VERIFIED' | 'FAILED' | 'UNAVAILABLE';
export interface GovChainIntegrity { status: GovChainStatus; eventsChecked: number | null; verifiedAt: string | null; reason: string | null }
export function mapChainVerifier(j: unknown): GovChainIntegrity {
  const o = (j ?? {}) as Record<string, unknown>;
  const raw = typeof o.status === 'string' ? o.status : '';
  const status: GovChainStatus = raw === 'verified' ? 'VERIFIED' : raw === 'broken' ? 'FAILED' : 'UNAVAILABLE';
  const reason = status === 'FAILED'
    ? 'Audit-chain integrity verification did not pass.'
    : status === 'UNAVAILABLE'
      ? (typeof o.reason === 'string' && /not authorised/i.test(o.reason) ? 'Audit-chain scope not available to this principal.' : 'Audit-chain integrity verification unavailable.')
      : null;
  return {
    status,
    eventsChecked: typeof o.events_checked === 'number' ? o.events_checked : null,
    verifiedAt: typeof o.verified_at === 'string' ? o.verified_at : null,
    reason,
  };
}

// ── Period validation: YYYY-MM-DD SAST, inclusive start / exclusive end, ≤366 days ──
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export interface GovPeriod { startDate: string; endDate: string; startIso: string; endIsoExclusive: string }
export interface GovPeriodError { error: string; code: string }
function realDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export function validateGovPeriod(start?: string | null, end?: string | null): GovPeriod | GovPeriodError {
  if (!start || !end) return { error: 'start and end (YYYY-MM-DD) are required', code: 'PERIOD_REQUIRED' };
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return { error: 'start/end must be YYYY-MM-DD', code: 'PERIOD_FORMAT' };
  if (!realDate(start) || !realDate(end)) return { error: 'start/end is not a valid calendar date', code: 'PERIOD_INVALID' };
  // SAST (Africa/Johannesburg) is a fixed UTC+2 offset (no DST).
  const startIso = `${start}T00:00:00+02:00`;
  const endIsoExclusive = `${end}T00:00:00+02:00`;
  const sMs = Date.parse(startIso), eMs = Date.parse(endIsoExclusive);
  if (eMs <= sMs) return { error: 'end must be after start (end is exclusive)', code: 'PERIOD_ORDER' };
  if ((eMs - sMs) / 86400000 > GOV_MAX_RANGE_DAYS) return { error: `range exceeds ${GOV_MAX_RANGE_DAYS} days`, code: 'PERIOD_TOO_LONG' };
  return { startDate: start, endDate: end, startIso, endIsoExclusive };
}
export function isPeriodError(p: GovPeriod | GovPeriodError): p is GovPeriodError {
  return (p as GovPeriodError).error !== undefined;
}

// ── Canonical JSON (deterministic, recursively key-sorted) for the pack SHA ──
export function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v as number) ? JSON.stringify(v) : 'null';
  if (t === 'boolean' || t === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (t === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
  }
  return 'null';
}

// ── SAST render for CSV readability ──
export function sastTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: GOV_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(d).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} SAST`;
  } catch { return iso; }
}

// ── Injection-safe CSV (timeline only), reusing the verified csvCell ──
export const GOV_CSV_COLUMNS = ['occurred_at_sast', 'category', 'event_type', 'action', 'audit_severity', 'audit_outcome', 'actor_role', 'resource_type'] as const;
export function buildTimelineCsv(items: GovAuditTimelineItem[], metadataRows: string[][]): string {
  const lines: string[] = [];
  for (const mr of metadataRows) lines.push(mr.map(csvCell).join(','));
  lines.push(GOV_CSV_COLUMNS.map((c) => csvCell(c)).join(','));
  for (const it of items) {
    lines.push([
      sastTimestamp(it.occurredAt), it.category, it.eventType, it.action,
      it.auditSeverity, it.auditOutcome, it.actorRole ?? '', it.resourceType ?? '',
    ].map(csvCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// ── Prohibited-claims safeguard (applied to pack/UI claim strings) ──
export function assertNoProhibitedGovernanceClaims(texts: (string | null | undefined)[]): void {
  const banned = /\b(certified|certification|regulator[\s-]?approved|regulatory compliance rating|is compliant|fully compliant|effectiveness|was effective|caused (a )?(improvement|reduction)|reduced harm|risk (trajectory|improved)|problem gambler|addict|tamper[\s-]?proof)\b/i;
  for (const t of texts) { if (t && banned.test(t)) throw new Error(`B5 prohibited claim: "${t}"`); }
}

// ── Pack types ──
export interface GovPackMetadata {
  schemaVersion: string;
  // Locked decision: the artifact carries the casino DISPLAY NAME only — never the raw casino_id.
  casinoName: string | null;
  periodStart: string;        // inclusive, YYYY-MM-DD (SAST)
  periodEndExclusive: string; // exclusive, YYYY-MM-DD (SAST)
  timezone: string;
  generatedAt: string;
  generatedByRole: string;
  environment: string | null;
  dataClass: string | null;
  sourceGitCommit: string | null;
  deploymentVersion: string | null;
  syntheticDemo: boolean;
  disclaimer: string | null;
}
export interface GovGovernanceSummary {
  includedCategories: string[];
  eventCountsByAction: Record<string, number>;
  complianceSnapshotCount: number;
  chainIntegrityStatus: GovChainStatus;
  auditTimelineRecordCount: number;
}
export interface GovernanceEvidencePack {
  schemaVersion: string;
  packId?: string;            // export only (omitted in preview)
  packMetadata: GovPackMetadata;
  governanceSummary: GovGovernanceSummary;
  protectionAlerts: GovProtectionAlertSummary;
  interventions: GovInterventionSummary;
  complianceSnapshots: GovComplianceSnapshot[];
  auditTimeline: GovAuditTimelineItem[];
  chainIntegrity: GovChainIntegrity;
  packIntegrity?: { packSha256: string; algorithm: 'SHA-256'; note: string }; // export only
}
export function eventCountsByAction(items: GovAuditTimelineItem[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) m[it.action] = (m[it.action] ?? 0) + 1;
  return m;
}
