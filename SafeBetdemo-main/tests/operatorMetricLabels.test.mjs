// UAT-OP-5 P1-1/P2-2 — active-player semantics are distinct + Risk Monitor no false zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OPERATOR_METRIC_LABELS, OPERATOR_METRIC_DEFS } from '../lib/operatorMetricLabels.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('canonical labels are all distinct (no concept shares a label)', () => {
  const vals = Object.values(OPERATOR_METRIC_LABELS);
  assert.equal(new Set(vals).size, vals.length);
  for (const k of Object.keys(OPERATOR_METRIC_LABELS)) assert.ok(OPERATOR_METRIC_DEFS[k]?.length > 0);
});

test('Dashboard active-now KPI uses the "Active Now" label', () => {
  const src = read('app/casino/dashboard/page.tsx');
  assert.match(src, /label=\{OPERATOR_METRIC_LABELS\.activeNow\}/);
  assert.match(src, /value=\{available \? int\(k\.players_active_now\)/); // value unchanged
});

test('Live Feed active-now KPI uses the "Active Now" label (same semantic, same label)', () => {
  const src = read('components/live/LiveKPIStrip.tsx');
  assert.match(src, /label=\{OPERATOR_METRIC_LABELS\.activeNow\}/);
  assert.match(src, /value=\{kpi\.players_active_now\}/);
});

test('Reporting Centre observed population uses "Observed Players" (distinct from Active Now)', () => {
  const src = read('app/casino/reports/page.tsx');
  assert.match(src, /OPERATOR_METRIC_LABELS\.observedPlayers/);
  assert.match(src, /n\(kpi\.active_players\)/); // value unchanged
});

test('Player Risk Monitor uses observed-players label and does NOT flash "0" during load', () => {
  const src = read('app/casino/players/page.tsx');
  assert.match(src, /OPERATOR_METRIC_LABELS\.observedPlayers/);
  // loading shows "Loading…", not "0 …"
  assert.match(src, /loading \? 'Loading…'/);
});

test('no operator screen still labels a NON-active-now population as bare "Active Players"', () => {
  // Reporting + Risk Monitor previously used "Active players" for the observed population.
  assert.doesNotMatch(read('app/casino/reports/page.tsx'), />Active players</);
  assert.doesNotMatch(read('app/casino/players/page.tsx'), /\} active players/);
});
