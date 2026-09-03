// ARCH-V3-A1 — financial/live close-out structural guarantees.
// These assert the SHAPE of the change set (not runtime): truthful source_as_of,
// positive event-derived GGR levers for all six casinos, session GGR stays
// non-certified, certified arithmetic untouched, and the Royal Palace scenario
// migration is Demo-scoped, narrow, and introduces no auth/RLS/privileged-function
// or Production path.
//   node --test tests/archV3A1Closeout.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEMO_SIM_PROFILES, clampActiveTarget } from '../lib/demoSimTargets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const DEMO_REF = 'uexdjngogzunjxkpxwll';
const PROD_REF = 'ilibvipqbkugqkppzdmh';

// (6 / truthful source) shapeKpi publishes source_as_of from the newest EVENT
// time in the served window — not new Date()/now().
test('shapeKpi derives source_as_of from newest event time, not render time', () => {
  const s = read('lib/consumerPlatform/shaping.ts');
  assert.match(s, /source_as_of:\s*sourceAsOf/);
  assert.match(s, /feedWindow\.reduce/);              // scans the served window
  assert.match(s, /e\.created_at/);                   // uses event occurred_at
  // snapshot_at (generation time) is retained separately, so the two are distinct.
  assert.match(s, /snapshot_at:\s*generatedAt/);
});

test('LiveKpiView contract exposes a required source_as_of', () => {
  const c = read('lib/consumerPlatform/contracts.ts');
  assert.match(c, /source_as_of:\s*string;/);
});

// (5) all six Demo casinos have a positive activity target → positive event-derived
// GGR is achievable for each; none is zeroed. (Positive value, not a hard-coded GGR.)
test('all six Demo casinos have positive synthetic activity targets', () => {
  assert.equal(DEMO_SIM_PROFILES.length, 6);
  for (const p of DEMO_SIM_PROFILES) {
    assert.ok(p.baselineActiveTarget > 0, `${p.name} baseline > 0`);
    assert.ok(p.showcaseActiveTarget >= p.baselineActiveTarget, `${p.name} showcase >= baseline`);
  }
});

// (5) Royal Palace reaches the band via a SCENARIO parameter — a higher STAKE
// range — while remaining the smallest operator by ACTIVE-PLAYER count (fewest
// registered). The active-target mirror is therefore unchanged.
test('Royal Palace stays smallest by active players (lever is stake size, not volume)', () => {
  const rp = DEMO_SIM_PROFILES.find((p) => p.name === 'Royal Palace');
  assert.ok(rp);
  assert.equal(rp.baselineActiveTarget, 14);   // unchanged — realistic smallest operator
  const smallest = [...DEMO_SIM_PROFILES].sort((a, b) => a.baselineActiveTarget - b.baselineActiveTarget)[0];
  assert.equal(smallest.name, 'Royal Palace');
  // Target still realisable under the tick clamp (20% of observed).
  assert.equal(clampActiveTarget(14, 8500, false), 14);
});

// (3 / no hard-code) The presentation lever is player VOLUME, not a GGR figure —
// the sim mirror carries no currency/GGR outputs.
test('sim targets carry no hard-coded GGR / currency outputs', () => {
  const s = read('lib/demoSimTargets.ts');
  const code = s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /ggr|\bR\s?\d|ZAR/i);
});

// (4) certified arithmetic unchanged — shapeFinancial stays a passthrough (no GGR
// recomputation), and the freshness work adds no stake/winnings math.
test('shapeFinancial remains a passthrough (no GGR arithmetic added)', () => {
  const s = read('lib/consumerPlatform/shaping.ts');
  const fn = s.slice(s.indexOf('export function shapeFinancial'), s.indexOf('export function riskLevelFor'));
  // ggrToday etc. are read straight off the row; never multiplied/derived here.
  assert.match(fn, /ggrToday:\s*num\(row\.ggr_today\)/);
  assert.doesNotMatch(fn, /ggr_today\s*[*+\-/]\s*\d|\*\s*ggr|ggr\w*\s*\*/i);
});

// (11) session GGR stays clearly non-certified and distinct from certified Today.
test('Live GGR (session) stays a non-certified, session-scoped label', () => {
  const strip = read('components/live/LiveKPIStrip.tsx');
  assert.match(strip, /Live GGR \(session\)/);
  const idx = strip.indexOf('Live GGR (session)');
  const card = strip.slice(idx, idx + 260);
  assert.match(card, /not certified/i);          // explicitly non-certified
  assert.doesNotMatch(card, /·\s*certified\b/i);  // never the certified caption
});

// (13/14/15/16) The Royal Palace migration is Demo-scoped, narrow, and safe.
const migDir = join(root, 'supabase', 'migrations');
const migFile = readdirSync(migDir).find((f) => f.includes('royal_palace_sim_target'));
const mig = migFile ? readFileSync(join(migDir, migFile), 'utf8') : '';
const migLow = mig.toLowerCase();
// Executed SQL only (strip `--` comment lines) — so negative assertions judge the
// statements, not the explanatory prose in the header comment.
const migSql = mig.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase();

test('Royal Palace migration exists and is Demo-guarded', () => {
  assert.ok(migFile, 'migration present');
  assert.match(mig, /cc000005-0000-0000-0000-000000000005/); // Royal Palace Demo id
  assert.match(migLow, /raise exception/);                    // aborts outside Demo
});

test('migration is a single narrow UPDATE — no schema/RLS/grant/function change', () => {
  // exactly one UPDATE, of the sim-config row.
  assert.equal((migSql.match(/update public\.sbiq_demo_sim_config/g) || []).length, 1);
  assert.doesNotMatch(migSql, /create policy|drop policy|alter policy|enable row level|disable row level/);
  assert.doesNotMatch(migSql, /\bgrant\b|\brevoke\b/);
  assert.doesNotMatch(migSql, /security definer|create function|create or replace function|drop function/);
  assert.doesNotMatch(migSql, /alter table|create table|drop table|alter role|create role/);
  // No DELETE / INSERT — purely the target update.
  assert.doesNotMatch(migSql, /delete from|insert into/);
});

test('migration touches no auth surface and no Production ref', () => {
  assert.doesNotMatch(migSql, /auth\.|gotrue|\busers\b|password/);
  assert.doesNotMatch(mig, new RegExp(PROD_REF));
  assert.match(mig, new RegExp(DEMO_REF)); // documents the Demo target only
});

test('migration hard-codes no GGR value (only a bet-range integer)', () => {
  assert.doesNotMatch(migSql, /ggr|winnings|\bstake\b|\bzar\b/);
  assert.match(mig, /bet_max\s*=\s*1080/);
  assert.match(mig, /bet_min\s*=\s*60/);
  // active-player targets are NOT changed by this migration.
  assert.doesNotMatch(migSql, /baseline_active_target|showcase_active_target/);
});

// The freshness/close-out source changes do not touch auth, RLS, or privileged fns.
test('no auth / RLS / privileged-function change in the freshness source', () => {
  for (const p of [
    'lib/financialFreshness.ts',
    'lib/consumerPlatform/shaping.ts',
    'app/casino/dashboard/page.tsx',
  ]) {
    const s = read(p).toLowerCase();
    assert.doesNotMatch(s, /security definer|create policy|grant execute|signinwithpassword|service_role_key/);
  }
});
