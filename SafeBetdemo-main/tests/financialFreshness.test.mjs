// ARCH-V3-A1 — Shared certified-financial FRESHNESS contract.
// Proves the five-state vocabulary (LOADING/FRESH/STALE/PARTIAL/UNAVAILABLE) is
// source-as-of based (never render/request time), that missing/stale is never a
// certified R0, that a genuine certified zero is still allowed, and that a manual
// refresh cannot fake freshness.
//   node --test tests/financialFreshness.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  financialFreshnessState, freshnessPresentation, financialCaption,
  isCertifiedPresentable, sourceAgeSeconds, DEFAULT_FINANCIAL_STALE_AFTER_SECONDS,
} from '../lib/financialFreshness.ts';
import { certifiedMoney } from '../lib/certifiedFinancial.ts';

const NOW = Date.parse('2026-09-02T20:00:00Z');
const fresh = new Date(NOW - 30_000).toISOString();        // 30s old
const stale = new Date(NOW - 20 * 60_000).toISOString();   // 20 min old
const healthy = (over = {}) => ({ status: 'healthy', currency: 'ZAR', ggrToday: 4200, ...over });
const partial = (over = {}) => ({ status: 'partial', currency: 'ZAR', ggrToday: 4200, ...over });

// (10) UNAVAILABLE supported + (1) missing value is never certified R0.
test('missing certified source → UNAVAILABLE (never certified R0)', () => {
  const s = financialFreshnessState({ loading: false, posture: null, sourceAsOf: fresh, nowMs: NOW });
  assert.equal(s, 'UNAVAILABLE');
  assert.equal(isCertifiedPresentable(s), false);
  assert.doesNotMatch(financialCaption(s).toLowerCase(), /certified/);
  // The money value for a null field is "—", not "R 0".
  assert.equal(certifiedMoney(null), '—');
});

test('explicit unavailable status → UNAVAILABLE', () => {
  const s = financialFreshnessState({ loading: false, posture: healthy({ status: 'unavailable' }), sourceAsOf: fresh, nowMs: NOW });
  assert.equal(s, 'UNAVAILABLE');
});

// (2) genuine certified zero remains allowed.
test('genuine certified zero is FRESH and presentable as R 0', () => {
  const s = financialFreshnessState({ loading: false, posture: healthy({ ggrToday: 0 }), sourceAsOf: fresh, nowMs: NOW });
  assert.equal(s, 'FRESH');
  assert.equal(isCertifiedPresentable(s), true);
  assert.equal(certifiedMoney(0), 'R 0');           // a real zero renders, not "—"
  assert.match(financialCaption(s).toLowerCase(), /certified/);
});

// (6) freshness uses source/as_of (not now / not render time).
test('state is driven by source as-of age, not wall clock', () => {
  assert.equal(sourceAgeSeconds(fresh, NOW), 30);
  assert.equal(sourceAgeSeconds(stale, NOW), 1200);
  assert.equal(sourceAgeSeconds(null, NOW), null);   // no fabricated 0 age
  // Same posture, only the source as-of changes → state changes.
  const a = financialFreshnessState({ loading: false, posture: healthy(), sourceAsOf: fresh, nowMs: NOW });
  const b = financialFreshnessState({ loading: false, posture: healthy(), sourceAsOf: stale, nowMs: NOW });
  assert.equal(a, 'FRESH');
  assert.equal(b, 'STALE');
});

// (7) LOADING is not zero and not certified.
test('LOADING when fetching with no posture yet (never zero / certified)', () => {
  const s = financialFreshnessState({ loading: true, posture: null, nowMs: NOW });
  assert.equal(s, 'LOADING');
  assert.equal(isCertifiedPresentable(s), false);
  assert.equal(freshnessPresentation(s).label, 'Loading…');
});

// (8) STALE is distinct from FRESH.
test('STALE distinct from FRESH at the threshold boundary', () => {
  const justFresh = new Date(NOW - DEFAULT_FINANCIAL_STALE_AFTER_SECONDS * 1000).toISOString();
  const justStale = new Date(NOW - (DEFAULT_FINANCIAL_STALE_AFTER_SECONDS + 5) * 1000).toISOString();
  assert.equal(financialFreshnessState({ loading: false, posture: healthy(), sourceAsOf: justFresh, nowMs: NOW }), 'FRESH');
  assert.equal(financialFreshnessState({ loading: false, posture: healthy(), sourceAsOf: justStale, nowMs: NOW }), 'STALE');
  assert.notEqual('STALE', 'FRESH');
});

// (9) PARTIAL supported (capability-limited certified data).
test('PARTIAL when certified status is not healthy but source is fresh', () => {
  const s = financialFreshnessState({ loading: false, posture: partial(), sourceAsOf: fresh, nowMs: NOW });
  assert.equal(s, 'PARTIAL');
  assert.equal(isCertifiedPresentable(s), true);            // PARTIAL is a real certified level
  assert.equal(freshnessPresentation(s).label, 'Partial');
});

// Precedence: an absent source outranks any stale value; stale outranks partial.
test('precedence UNAVAILABLE > STALE > PARTIAL', () => {
  assert.equal(financialFreshnessState({ loading: false, posture: null, sourceAsOf: stale, nowMs: NOW }), 'UNAVAILABLE');
  // stale partial data surfaces STALE (the freshness problem), not PARTIAL.
  assert.equal(financialFreshnessState({ loading: false, posture: partial(), sourceAsOf: stale, nowMs: NOW }), 'STALE');
});

// (12) a manual refresh cannot fake freshness.
test('refresh in-flight does not reset a stale source to FRESH', () => {
  // loading toggles true during a manual Refresh, but the source is still old →
  // the contract keeps reporting STALE (it keys off source as-of, not the toggle).
  const s = financialFreshnessState({ loading: true, posture: healthy(), sourceAsOf: stale, nowMs: NOW });
  assert.equal(s, 'STALE');
  // Deterministic: identical inputs → identical state (no time-of-call fakery).
  const twice = () => financialFreshnessState({ loading: false, posture: healthy(), sourceAsOf: fresh, nowMs: NOW });
  assert.equal(twice(), twice());
});

// The word "certified" is reserved for FRESH across the caption helper.
test('only FRESH is captioned "certified"', () => {
  assert.match(financialCaption('FRESH').toLowerCase(), /certified/);
  for (const st of ['LOADING', 'STALE', 'PARTIAL', 'UNAVAILABLE']) {
    assert.doesNotMatch(financialCaption(st).toLowerCase(), /certified/, `${st} must not say certified`);
  }
});

// The contract performs NO financial arithmetic — it never even reads the money
// fields (GGR = stakes − winnings stays entirely in the certified pipeline).
test('freshness module reads only status, never money fields', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../lib/financialFreshness.ts', import.meta.url), 'utf8');
  // strip comment lines so prose ("GGR = stakes − winnings") is not matched.
  const code = src.split('\n')
    .filter((l) => { const t = l.trim(); return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
    .join('\n');
  assert.doesNotMatch(code, /\.ggr|\.stakes|\.playerWinnings/i);
});
