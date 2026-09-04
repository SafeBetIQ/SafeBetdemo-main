// ARCH-V4-A4 — Shared Platform Foundation evidence contract + strangler extraction.
// Proves the certified evidence framework now lives at @/lib/platform/evidence
// (Shared Foundation owner), that the deprecated IQ path and the IQ facade
// re-export the SAME behaviour, that scope is never widened, and that CSV export
// stays formula-injection safe.
//   node --test tests/platformEvidenceContract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as platform from '../lib/platform/evidence/index.ts';
import * as deprecatedShim from '../lib/consumerPlatform/evidence.ts';
import * as iqFacade from '../lib/consumerPlatform/index.ts';

test('governed platform module exposes the full evidence contract', () => {
  for (const k of ['EVIDENCE_DOMAINS', 'DEFAULT_PAGE_SIZE', 'MAX_PAGE_SIZE', 'MAX_EXPORT_ROWS',
    'EvidenceError', 'validatePagination', 'narrowCasinoScope', 'buildEnvelope',
    'reconcileSession', 'reconcilePlayer', 'reconcileMachine', 'reconcileFinancial',
    'csvCell', 'toCsv']) {
    assert.ok(platform[k] !== undefined, `platform exports ${k}`);
  }
  assert.deepEqual(platform.EVIDENCE_DOMAINS, ['financial', 'session', 'player', 'machine']);
});

test('scope is narrow-only (never widened)', () => {
  assert.equal(platform.narrowCasinoScope('c1', 'c1'), 'c1');
  assert.equal(platform.narrowCasinoScope('c1', null), 'c1');
  assert.throws(() => platform.narrowCasinoScope('c1', 'c2'), /cross-casino access denied/);
});

test('pagination validation clamps/rejects unbounded requests', () => {
  assert.deepEqual(platform.validatePagination(2, 50), { page: 2, pageSize: 50, offset: 50 });
  assert.throws(() => platform.validatePagination(0, 50), /page must be/);
  assert.throws(() => platform.validatePagination(1, 9999), /exceeds maximum/);
});

test('CSV export is formula-injection safe', () => {
  assert.equal(platform.csvCell('=1+1'), "'=1+1");     // leading = neutralised
  assert.equal(platform.csvCell('@x'), "'@x");
  assert.equal(platform.csvCell('a,b'), '"a,b"');      // comma quoted
  assert.match(platform.toCsv(['a'], [{ a: '=DANGER' }]), /'=DANGER/);
});

test('financial reconciliation preserves the certified identity (ggr = stakes - winnings)', () => {
  const ok = platform.reconcileFinancial({ financial_data_status: 'partial', stakes_today: 100, player_winnings_today: 70, ggr_today: 30, financial_events_total: 2, synthetic_event_count: 2, non_synthetic_event_count: 0, voids_supported: false, voided_bets_today: null, reversals_supported: false, reversed_transactions_today: null });
  assert.equal(ok.status, 'passed');
  const bad = platform.reconcileFinancial({ financial_data_status: 'partial', stakes_today: 100, player_winnings_today: 70, ggr_today: 999, financial_events_total: 2, synthetic_event_count: 2, non_synthetic_event_count: 0, voids_supported: false, voided_bets_today: null, reversals_supported: false, reversed_transactions_today: null });
  assert.equal(bad.status, 'failed');
});

test('deprecated IQ shim + IQ facade re-export identical behaviour', () => {
  assert.equal(deprecatedShim.csvCell('=x'), platform.csvCell('=x'));
  assert.equal(iqFacade.csvCell('=x'), platform.csvCell('=x'));
  assert.equal(deprecatedShim.MAX_PAGE_SIZE, platform.MAX_PAGE_SIZE);
  assert.equal(deprecatedShim.narrowCasinoScope('c1', 'c1'), platform.narrowCasinoScope('c1', 'c1'));
});

test('strangler: consumers migrated to the governed path; old path is a deprecated shim', () => {
  const idx = readFileSync(new URL('../lib/consumerPlatform/index.ts', import.meta.url), 'utf8');
  assert.match(idx, /from '\.\.\/platform\/evidence\/index\.ts'/);
  const reg = readFileSync(new URL('../lib/regulatorFinancialExport.ts', import.meta.url), 'utf8');
  assert.match(reg, /from '\.\/platform\/evidence\/index\.ts'/);
  const shim = readFileSync(new URL('../lib/consumerPlatform/evidence.ts', import.meta.url), 'utf8');
  assert.match(shim, /@deprecated/);
  assert.match(shim, /platform\/evidence/);
  assert.doesNotMatch(shim, /export function (validatePagination|buildEnvelope|toCsv)/); // impl moved, not duplicated
});
