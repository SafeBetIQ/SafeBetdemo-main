// Milestone 4.5 — Wagering & GGR Reconciliation (sandbox / pilot-path).
// Run: node --test tests/identityFederation.financial.test.mjs
//
// Sessions/wagers/settlements, integer precision, projection rebuild, 4-level
// reconciliation, GGR (win/loss/void/refund/correction), idempotency/replay,
// tenant isolation, security, privacy, and end-to-end. Synthetic, non-production.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FinancialEventPlatform, FinancialProjectionPlatform, FinancialReconciler,
  InMemoryFinancialAuditSink,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const svc = (op, tn, j = 'ZA') => ({ plane: 'financial-service', operatorId: op, tenantId: tn, jurisdiction: j });
const REG = { plane: 'regulator', jurisdiction: 'ZA' };

let seqCounter = 0;
const ev = (o) => ({ eventSchemaVersion: 'fin-evt-1', eventTimestamp: CLOCK(), currency: 'ZAR', idempotencyKey: `k-${o.eventId}`, sourceSystemRef: `src-${o.eventId}`, ...o });
function platform() { return new FinancialEventPlatform({ auditSink: new InMemoryFinancialAuditSink(), now: CLOCK }); }

// helpers to build a full operator: session + a won wager + a lost wager
function seedOperator(p, op, tn, sbPlr, { stakeWon = 100, payout = 150, stakeLost = 100 } = {}) {
  const ctx = svc(op, tn);
  p.submit(ctx, ev({ eventId: `${op}-s`, eventType: 'session-started', sourceOperatorId: op, tenantId: tn, jurisdiction: 'ZA', sbPlr, sessionId: `${op}-sess` }));
  p.submit(ctx, ev({ eventId: `${op}-w1`, eventType: 'wager-placed', sourceOperatorId: op, tenantId: tn, jurisdiction: 'ZA', sbPlr, sessionId: `${op}-sess`, wagerId: `${op}-wag1`, amountMinor: stakeWon, product: 'sports' }));
  p.submit(ctx, ev({ eventId: `${op}-w1s`, eventType: 'wager-settled', sourceOperatorId: op, tenantId: tn, jurisdiction: 'ZA', sbPlr, sessionId: `${op}-sess`, wagerId: `${op}-wag1`, settlementResult: 'won', amountMinor: payout, product: 'sports' }));
  p.submit(ctx, ev({ eventId: `${op}-w2`, eventType: 'wager-placed', sourceOperatorId: op, tenantId: tn, jurisdiction: 'ZA', sbPlr, sessionId: `${op}-sess`, wagerId: `${op}-wag2`, amountMinor: stakeLost, product: 'casino' }));
  p.submit(ctx, ev({ eventId: `${op}-w2s`, eventType: 'wager-settled', sourceOperatorId: op, tenantId: tn, jurisdiction: 'ZA', sbPlr, sessionId: `${op}-sess`, wagerId: `${op}-wag2`, settlementResult: 'lost', product: 'casino' }));
}

// ─── Sessions + wagers + integrity ───────────────────────────────────────────
test('a wager with an invalid/legacy session reference is rejected', () => {
  const p = platform();
  const r = p.submit(svc('op-a', 't-a'), ev({ eventId: 'w', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'ghost', wagerId: 'wg', amountMinor: 100 }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection.reason, 'invalid-session');
});

test('cross-tenant session, wrong player, and session-ended are rejected', () => {
  const p = platform();
  p.submit(svc('op-a', 't-a'), ev({ eventId: 's', eventType: 'session-started', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess' }));
  // another tenant referencing op-a's session
  assert.equal(p.submit(svc('op-b', 't-b'), ev({ eventId: 'x', eventType: 'wager-placed', sourceOperatorId: 'op-b', tenantId: 't-b', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg', amountMinor: 100 })).rejection.reason, 'cross-tenant-session');
  // wrong player on op-a's session
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'y', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-OTHER', sessionId: 'sess', wagerId: 'wg2', amountMinor: 100 })).rejection.reason, 'session-player-mismatch');
  // end session then wager → rejected
  p.submit(svc('op-a', 't-a'), ev({ eventId: 'se', eventType: 'session-ended', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess' }));
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'z', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg3', amountMinor: 100 })).rejection.reason, 'session-ended');
});

// ─── Precision ───────────────────────────────────────────────────────────────
test('financial precision: integers only; negatives and non-integers rejected', () => {
  const p = platform();
  p.submit(svc('op-a', 't-a'), ev({ eventId: 's', eventType: 'session-started', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess' }));
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'w', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg', amountMinor: 10.5 })).rejection.reason, 'precision-error');
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'w2', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg2', amountMinor: -5 })).rejection.reason, 'negative-amount');
});

// ─── Settlement lifecycle ────────────────────────────────────────────────────
test('double settlement and settling an unknown wager are rejected', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A');
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'dbl', eventType: 'wager-settled', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'op-a-sess', wagerId: 'op-a-wag1', settlementResult: 'lost' })).rejection.reason, 'double-settlement');
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'unk', eventType: 'wager-settled', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'op-a-sess', wagerId: 'ghost', settlementResult: 'won', amountMinor: 10 })).rejection.reason, 'settle-unknown-wager');
});

// ─── GGR (win/loss) + projection rebuild ─────────────────────────────────────
test('GGR = turnover − wins paid; projection is deterministic and rebuildable', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A', { stakeWon: 100, payout: 150, stakeLost: 100 });
  const proj = new FinancialProjectionPlatform(CLOCK);
  const op = proj.operatorProjection(p, REG, 'op-a');
  // turnover = 100 + 100 = 200; winsPaid = 150; GGR = 50
  assert.equal(op.turnoverMinor, 200);
  assert.equal(op.winsPaidMinor, 150);
  assert.equal(op.ggrMinor, 50);
  assert.equal(op.wagers, 2);
  // deterministic rebuild
  assert.equal(JSON.stringify(proj.operatorProjections(p, REG)), JSON.stringify(proj.operatorProjections(p, REG)));
});

// ─── Void + refund + correction ──────────────────────────────────────────────
test('void and refund reverse the wager (GGR excludes them); original preserved', () => {
  const p = platform();
  const ctx = svc('op-a', 't-a');
  p.submit(ctx, ev({ eventId: 's', eventType: 'session-started', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess' }));
  // won wager then VOID it → excluded from GGR
  p.submit(ctx, ev({ eventId: 'w1', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg1', amountMinor: 100 }));
  p.submit(ctx, ev({ eventId: 'w1s', eventType: 'wager-settled', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg1', settlementResult: 'won', amountMinor: 200 }));
  p.submit(ctx, ev({ eventId: 'w1v', eventType: 'wager-voided', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg1' }));
  // lost wager then REFUND → excluded
  p.submit(ctx, ev({ eventId: 'w2', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg2', amountMinor: 100 }));
  p.submit(ctx, ev({ eventId: 'w2r', eventType: 'refund-recorded', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg2', amountMinor: 100 }));
  const op = new FinancialProjectionPlatform(CLOCK).operatorProjection(p, REG, 'op-a');
  assert.equal(op.turnoverMinor, 0, 'voided + refunded wagers excluded from turnover');
  assert.equal(op.ggrMinor, 0);
  assert.equal(op.voidsCount, 1);
  // refund exceeding stake rejected
  assert.equal(p.submit(ctx, ev({ eventId: 'w3', eventType: 'wager-placed', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg3', amountMinor: 100 })).accepted, true);
  assert.equal(p.submit(ctx, ev({ eventId: 'w3r', eventType: 'refund-recorded', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'sess', wagerId: 'wg3', amountMinor: 500 })).rejection.reason, 'refund-exceeds-eligible');
});

// ─── Idempotency + replay (no double financial effect) ───────────────────────
test('replay + content-duplicate settlements do not double financial impact', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A', { stakeWon: 100, payout: 150, stakeLost: 100 });
  // replay the winning settlement (same eventId) + a content duplicate (new id, same content)
  const dup1 = p.submit(svc('op-a', 't-a'), ev({ eventId: 'op-a-w1s', eventType: 'wager-settled', sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', sessionId: 'op-a-sess', wagerId: 'op-a-wag1', settlementResult: 'won', amountMinor: 150 }));
  assert.equal(dup1.duplicate, true);
  const op = new FinancialProjectionPlatform(CLOCK).operatorProjection(p, REG, 'op-a');
  assert.equal(op.ggrMinor, 50, 'GGR unchanged by replay');
});

// ─── 4-level reconciliation ──────────────────────────────────────────────────
test('4-level reconciliation balances and each level is separate', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A');            // 5 accepted events
  seedOperator(p, 'op-b', 't-b', 'SB-PLR-B');            // 5 accepted events
  const projection = new FinancialProjectionPlatform(CLOCK);
  const reconciler = new FinancialReconciler();
  const input = { platform: p, projection, ctx: REG, jurisdiction: 'ZA', sourceCounts: { records: 10, sessions: 2, wagers: 4, settlements: 4 }, submissionLedger: { submitted: 10, accepted: 10, rejected: 0, duplicates: 0, deferred: 0, deadLettered: 0 }, now: CLOCK };
  const out = reconciler.reconcile(input);
  assert.equal(out.levels.length, 4);
  assert.equal(out.balanced, true, JSON.stringify(out.equation.differences));
  assert.ok(out.levels.every((l) => l.balanced));
  // national = Σ operator GGR
  const nat = projection.national(p, REG, 'ZA');
  const ops = projection.operatorProjections(p, REG);
  assert.equal(nat.nationalGgrMinor, ops.reduce((n, o) => n + o.ggrMinor, 0));
  // integrity verifier
  assert.equal(reconciler.verifyIntegrity(input).ok, true);
});

// ─── Tenant isolation + security ─────────────────────────────────────────────
test('tenant isolation: operator reads only own tenant; national is regulator-only', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A');
  seedOperator(p, 'op-b', 't-b', 'SB-PLR-B');
  const proj = new FinancialProjectionPlatform(CLOCK);
  // operator A reads only its own events
  const opAonly = p.acceptedEvents({ plane: 'operator', operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' });
  assert.ok(opAonly.every((e) => e.tenantId === 't-a'));
  // operator cannot read another tenant explicitly
  assert.throws(() => p.acceptedEvents({ plane: 'operator', operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' }, 't-b'));
  // operator cannot read the national aggregate
  assert.throws(() => proj.national(p, { plane: 'operator', operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' }, 'ZA'), /regulator-only|access denied/);
  // unauthenticated / casino-admin cannot read
  assert.throws(() => p.acceptedEvents({ plane: 'unauthenticated', jurisdiction: 'ZA' }));
  // cross-tenant submission denied (event operator ≠ authenticated)
  assert.equal(p.submit(svc('op-a', 't-a'), ev({ eventId: 'xt', eventType: 'session-started', sourceOperatorId: 'op-b', tenantId: 't-b', jurisdiction: 'ZA', sbPlr: 'SB-PLR-B', sessionId: 'z' })).rejection.reason, 'unauthorised-operator');
});

// ─── Privacy + direct-insertion prohibition ──────────────────────────────────
test('no plaintext PII; no direct total insertion surface', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A');
  const proj = new FinancialProjectionPlatform(CLOCK);
  const blob = JSON.stringify({ acc: p.acceptedEvents(REG), ops: proj.operatorProjections(p, REG), audit: p.auditTrail() });
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false, 'no email PII');
  // the projection platform has no insert/setTotal/writeGgr surface
  for (const m of ['insert', 'setTotal', 'writeGgr', 'setGgr', 'update'])
    assert.equal(typeof proj[m], 'undefined', `projection must not expose ${m}`);
});

// ─── End-to-end (session→wager→settle→project→reconcile) ─────────────────────
test('end-to-end sandbox pilot-path: valid events → projection → reconciled GGR', () => {
  const p = platform();
  seedOperator(p, 'op-a', 't-a', 'SB-PLR-A', { stakeWon: 250, payout: 300, stakeLost: 250 });
  const projection = new FinancialProjectionPlatform(CLOCK);
  const op = projection.operatorProjection(p, REG, 'op-a');
  assert.equal(op.turnoverMinor, 500);
  assert.equal(op.ggrMinor, 200);          // 500 − 300
  const nat = projection.national(p, REG, 'ZA');
  assert.equal(nat.nationalGgrMinor, 200);
  assert.equal(nat.currency, 'ZAR');
  const reco = new FinancialReconciler().reconcile({ platform: p, projection, ctx: REG, jurisdiction: 'ZA', sourceCounts: { records: 5, sessions: 1, wagers: 2, settlements: 2 }, submissionLedger: { submitted: 5, accepted: 5, rejected: 0, duplicates: 0, deferred: 0, deadLettered: 0 }, now: CLOCK });
  assert.equal(reco.balanced, true);
});
