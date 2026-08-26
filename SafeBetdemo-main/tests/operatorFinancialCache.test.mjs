// Regulator operator-switching cache + stale-guard (PERF-REG-1).
// Proves correctness-over-speed: one operator's posture can never surface under
// another (cache isolation), a stale/late response can never overwrite the
// current operator (generation guard), fresh revisits are instant (cache hit),
// and expired/empty entries are misses (refetch). Certified arithmetic is not
// touched — this only governs WHICH result is applied and WHEN.
//   node --test tests/operatorFinancialCache.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OperatorFinancialCache, RequestGuard, OPERATOR_FINANCIAL_TTL_MS,
} from '../lib/operatorFinancialCache.ts';

const A = 'cc000003-0000-0000-0000-000000000003';
const B = 'cc000004-0000-0000-0000-000000000004';
const postureA = { ggrToday: 4200 };
const postureB = { ggrToday: 9100 };

test('cache hit: a fresh revisit returns the SAME operator posture (instant)', () => {
  const c = new OperatorFinancialCache();
  c.put({ casinoId: A, operator: { name: 'Betway' }, posture: postureA, fetchedAt: 1000 });
  const hit = c.getFresh(A, 1000 + 5000);   // 5s later, within TTL
  assert.ok(hit);
  assert.equal(hit.casinoId, A);
  assert.deepEqual(hit.posture, postureA);
});

test('cache isolation: operator B is never served for operator A (or vice versa)', () => {
  const c = new OperatorFinancialCache();
  c.put({ casinoId: A, operator: null, posture: postureA, fetchedAt: 1000 });
  c.put({ casinoId: B, operator: null, posture: postureB, fetchedAt: 1000 });
  assert.deepEqual(c.getFresh(A, 1000).posture, postureA);
  assert.deepEqual(c.getFresh(B, 1000).posture, postureB);
  assert.notDeepEqual(c.getFresh(A, 1000).posture, c.getFresh(B, 1000).posture);
});

test('cache miss: expired entry (past TTL) is not returned → refetch', () => {
  const c = new OperatorFinancialCache(OPERATOR_FINANCIAL_TTL_MS);
  c.put({ casinoId: A, operator: null, posture: postureA, fetchedAt: 1000 });
  assert.equal(c.getFresh(A, 1000 + OPERATOR_FINANCIAL_TTL_MS + 1), null); // expired
  assert.ok(c.getFresh(A, 1000 + OPERATOR_FINANCIAL_TTL_MS - 1));          // still fresh
});

test('cache miss: unknown operator and empty id are misses (never a wrong value)', () => {
  const c = new OperatorFinancialCache();
  assert.equal(c.getFresh(B, 1000), null);
  assert.equal(c.getFresh('', 1000), null);
  c.put({ casinoId: '', operator: null, posture: postureA, fetchedAt: 1000 }); // ignored
  assert.equal(c.getFresh('', 1000), null);
});

test('a null certified posture is cacheable and distinct from a miss', () => {
  const c = new OperatorFinancialCache();
  c.put({ casinoId: A, operator: null, posture: null, fetchedAt: 1000 }); // certified-unavailable
  const hit = c.getFresh(A, 1000);
  assert.ok(hit);                 // it IS a cached result…
  assert.equal(hit.posture, null); // …whose posture is null ("—"), not a false 0
});

test('generation guard: only the current switch may apply its response', () => {
  const g = new RequestGuard();
  const genA = g.next();          // select A
  assert.equal(g.isCurrent(genA), true);
  const genB = g.next();          // switch to B
  assert.equal(g.isCurrent(genA), false); // A's late response is now stale → dropped
  assert.equal(g.isCurrent(genB), true);
});

test('rapid A→B→C→A: only the final selection applies; earlier responses dropped', () => {
  const g = new RequestGuard();
  const gA1 = g.next();  // A
  const gB = g.next();   // B
  const gC = g.next();   // C
  const gA2 = g.next();  // back to A (new request)
  // Simulate responses arriving out of order.
  assert.equal(g.isCurrent(gA1), false); // first A response — stale
  assert.equal(g.isCurrent(gB), false);  // B — stale
  assert.equal(g.isCurrent(gC), false);  // C — stale
  assert.equal(g.isCurrent(gA2), true);  // only the latest A applies → A values shown, never B/C
});

test('stale-response scenario: A starts, user selects B, A returns after B → A ignored', () => {
  const g = new RequestGuard();
  const genA = g.next();     // A request starts
  const genB = g.next();     // user selects B; B request starts
  // A resolves late:
  assert.equal(g.isCurrent(genA), false); // MUST NOT update UI (B is current)
  // B resolves:
  assert.equal(g.isCurrent(genB), true);  // B applies
});
