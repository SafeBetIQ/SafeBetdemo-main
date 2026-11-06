// M1B-P1F — Pilot baseline-apply workflow + Pilot buildspec: fail-closed static and executable checks.
// No network, no database: guard shell blocks are executed locally with synthetic inputs.
// Run: node --test tests/pilotM1bWorkflow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = (p) => new URL(`../../${p}`, import.meta.url);
const read = (p) => readFileSync(root(p), 'utf8').replace(/\r\n/g, '\n');
const WF = read('.github/workflows/pilot-m1b-baseline-apply.yml');
const BS = read('SafeBetdemo-main/deploy/buildspec-pilot.yml');
const DEMO_BS = read('SafeBetdemo-main/deploy/buildspec.yml');

const COMMIT = '379141e45c7f6f9db1888ebaebfa45fbf86a993e';        // schema baseline SOURCE authority
const APP_COMMIT = '3b18faa4343eee30576aa4f3ac132ac2176c9713';   // authorised Pilot application commit
const SHA = '530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182';
const DERIV_SHA = 'c2125accccc133172357a36d96b343f0d42dcc3d07695e56089950dd01512067';
const FP = '5f324b14ea87dec4601b0586bc4a4726be83ebceae3112253ba2db838ca55f49';
const FORBIDDEN = { production: 'ilibvipqbkugqkppzdmh', guardian: 'druuskabkgyotslcgnys', demo: 'uexdjngogzunjxkpxwll' };
const PILOT_REF = 'abcdefghijklmnopqrst'; // synthetic

function runBlock(text, stepName) {
  const i = text.indexOf(`- name: ${stepName}`);
  assert.ok(i >= 0, `step "${stepName}" present`);
  const after = text.slice(i);
  const m = after.match(/\n(\s+)run: \|\n([\s\S]*?)(?=\n\s+- name: |\n {2}[a-z]+:\n|$)/);
  assert.ok(m, `run block for "${stepName}"`);
  const indent = m[2].match(/^(\s*)/)[1].length;
  return m[2].split('\n').map((l) => l.slice(indent)).join('\n');
}
const bash = (script, env) => spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('workflow: manual dispatch only, read-only token, single concurrency group', () => {
  assert.match(WF, /^on:\n {2}workflow_dispatch:\n/m);
  for (const t of ['push:', 'pull_request:', 'schedule:', 'workflow_run:', 'repository_dispatch:']) {
    assert.ok(!new RegExp(`^ {2}${t}`, 'm').test(WF), `no ${t} trigger`);
  }
  assert.match(WF, /^permissions:\n {2}contents: read$/m);
  assert.match(WF, /cancel-in-progress: false/);
});

test('workflow: authorised commit / SHA / derivative SHA / fingerprint and all three forbidden refs are hard-coded', () => {
  assert.match(WF, new RegExp(`AUTHORISED_COMMIT: ${COMMIT}`));
  assert.match(WF, new RegExp(`AUTHORISED_SHA: ${SHA}`));
  assert.match(WF, new RegExp(`AUTHORISED_DERIVATIVE_SHA: ${DERIV_SHA}`));
  assert.match(WF, new RegExp(`AUTHORISED_FINGERPRINT: ${FP}`));
  for (const r of Object.values(FORBIDDEN)) assert.ok(WF.includes(r), `forbidden ref ${r} listed`);
  assert.match(WF, /ref: '\$\{\{ env\.AUTHORISED_COMMIT \}\}', path: authority/);
});

const GUARD = runBlock(WF, 'Validate inputs (fail closed)');
const guardEnv = (o = {}) => ({
  AUTHORISED_ENVIRONMENT: 'pilot', AUTHORISED_COMMIT: COMMIT, AUTHORISED_SHA: SHA, AUTHORISED_FINGERPRINT: FP,
  FORBIDDEN_REFS: Object.values(FORBIDDEN).join(' '),
  IN_ENV: 'pilot', IN_REF: PILOT_REF, IN_SHA: SHA, IN_FP: FP, IN_COMMIT: COMMIT, ...o,
});

test('guard: accepts only the exact authorised inputs', () => {
  assert.equal(bash(GUARD, guardEnv()).status, 0);
});

test('guard: rejects every forbidden project ref (Production, Guardian, Demo)', () => {
  for (const [name, ref] of Object.entries(FORBIDDEN)) {
    const r = bash(GUARD, guardEnv({ IN_REF: ref }));
    assert.notEqual(r.status, 0, `${name} must be rejected`);
    assert.match(r.stdout + r.stderr, /FORBIDDEN/);
  }
});

test('guard: rejects wrong environment, malformed ref, wrong SHA / fingerprint / commit', () => {
  for (const o of [{ IN_ENV: 'Pilot' }, { IN_ENV: 'demo' }, { IN_ENV: 'production' }, { IN_ENV: '' },
    { IN_REF: 'short' }, { IN_REF: 'ABCDEFGHIJKLMNOPQRST' }, { IN_REF: `${PILOT_REF};rm` },
    { IN_SHA: SHA.replace(/.$/, '0') }, { IN_FP: FP.replace(/^./, '0') }, { IN_COMMIT: 'b836e124f45828ac1f30e32b44e2caa4fcc47555' }]) {
    assert.notEqual(bash(GUARD, guardEnv(o)).status, 0, JSON.stringify(o));
  }
});

const REFSTEP = runBlock(WF, '2 · Project ref — pinned, supplied and connection target must all agree');
const refEnv = (url, o = {}) => ({ FORBIDDEN_REFS: Object.values(FORBIDDEN).join(' '), PILOT_DB_URL: url, PINNED_REF: PILOT_REF, IN_REF: PILOT_REF, ...o });

test('apply step 2: connection must target exactly the supplied + pinned Pilot ref, never a forbidden one', () => {
  const ok = [`postgresql://postgres:pw@db.${PILOT_REF}.supabase.co:5432/postgres?sslmode=require`,
    `postgresql://postgres.${PILOT_REF}:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`];
  for (const u of ok) assert.equal(bash(REFSTEP, refEnv(u)).status, 0, u);
  const bad = [
    `postgresql://postgres:pw@db.${FORBIDDEN.production}.supabase.co:5432/postgres`,
    `postgresql://postgres.${FORBIDDEN.demo}:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:pw@db.zzzzzzzzzzzzzzzzzzzz.supabase.co:5432/postgres`,
    `postgresql://postgres:pw@db.${PILOT_REF}.supabase.co:5432/postgres?sslmode=disable`,
    `postgresql://postgres:pw@localhost:5432/postgres`,
  ];
  for (const u of bad) assert.notEqual(bash(REFSTEP, refEnv(u)).status, 0, u);
  assert.notEqual(bash(REFSTEP, refEnv(ok[0], { PINNED_REF: 'qqqqqqqqqqqqqqqqqqqq' })).status, 0, 'supplied != pinned');
  assert.notEqual(bash(REFSTEP, refEnv(ok[0], { PINNED_REF: '' })).status, 0, 'pinned var missing');
  assert.notEqual(bash(REFSTEP, refEnv('', {})).status, 0, 'secret missing');
});

test('apply job: Pilot environment, SSL required, no secret is ever echoed', () => {
  const apply = WF.slice(WF.indexOf('\n  apply:'));
  assert.match(apply, /\n {4}environment: pilot\n/);
  assert.match(apply, /PGSSLMODE: require/);
  assert.match(apply, /PILOT_DB_URL: \$\{\{ secrets\.PILOT_DB_URL \}\}/);
  assert.equal((WF.match(/secrets\./g) || []).length, 1, 'PILOT_DB_URL is the only secret referenced');
  assert.ok(!/echo[^\n]*\$\{?PILOT_DB_URL/.test(WF), 'connection string never echoed');
  assert.ok(!/set -x/.test(WF), 'no shell tracing');
  assert.match(WF, /needs: \[guard, rehearsal\]/);
});

test('apply job: required execution order 1 → 12, fingerprint BEFORE post-apply hardening, derivative applied', () => {
  const apply = WF.slice(WF.indexOf('\n  apply:'));
  const order = ['1 · Environment must be pilot', '2 · Project ref', '3 · Empty-project / default-privilege preflight',
    '4 · Pilot privilege-hardening preamble', '5 · Verify canonical baseline SHA', '6 · Apply Supabase derivative',
    '7 · Structural fingerprint', '8 · Pilot post-apply privilege hardening', '9 · Privilege / security verification',
    '10 · No data in any public table', '11 · No Demo seed / simulation subsystem', '12 · Redacted evidence summary'];
  let last = -1;
  for (const s of order) { const i = apply.indexOf(`- name: ${s}`); assert.ok(i > last, `${s} after previous`); last = i; }
  const s5 = runBlock(apply, '5 · Verify canonical baseline SHA + deterministic Supabase derivative');
  assert.match(s5, /generate-supabase-derivative\.mjs" --check/, 'generator determinism re-checked');
  assert.match(s5, /AUTHORISED_DERIVATIVE_SHA/);
  const s6 = runBlock(apply, '6 · Apply Supabase derivative (single transaction)');
  assert.match(s6, /-1 -v ON_ERROR_STOP=1 -f "\$DERIVATIVE"/, 'the DERIVATIVE is applied in a single transaction');
  assert.match(s6, /sha256sum "\$DERIVATIVE"/, 'derivative SHA re-verified immediately before apply');
  assert.ok(!/pilot_app_schema_baseline\.sql/.test(s6), 'the canonical baseline is NOT applied directly');
});

test('rehearsal job: proves derivative + fingerprint (before hardening) + manifest on disposable Postgres 17', () => {
  const r = WF.slice(WF.indexOf('\n  rehearsal:'), WF.indexOf('\n  apply:'));
  assert.match(r, /image: postgres:17/);
  assert.ok(!/secrets\./.test(r), 'rehearsal uses no secrets');
  assert.match(r, /supabase-defaults-emulation\.sql/);
  assert.match(r, /generate-supabase-derivative\.mjs" --check/);
  assert.match(r, /\[ "\$fp" = "\$AUTHORISED_FINGERPRINT" \]/);
  assert.match(r, /diff -u "\$BASE\/pilot_privilege_manifest\.txt" rehearsal\.priv\.txt/);
  // Fingerprint is captured before the post-apply hardening in the combined step.
  const combined = runBlock(r, 'Preflight → hardening preamble → apply derivative → fingerprint → post-apply → verify');
  const iFp = combined.indexOf('AUTHORISED_FINGERPRINT');
  const iPost = combined.indexOf('pilot_post_apply_grants.sql');
  assert.ok(iFp >= 0 && iPost > iFp, 'fingerprint proven before post-apply hardening');
});

// ── Pilot buildspec ───────────────────────────────────────────────────────────
const PRE = (() => {
  const m = BS.match(/pre_build:\n {4}commands:\n {6}- \|\n([\s\S]*?)\n {6}- rm -rf/);
  assert.ok(m); return m[1].split('\n').map((l) => l.slice(8)).join('\n');
})();
const bsEnv = (o = {}) => ({
  NEXT_PUBLIC_ENV: 'pilot', NEXT_PUBLIC_SAFEBET_ENV: 'pilot', SAFEBET_OPERATING_MODE: 'production',
  NEXT_PUBLIC_SAFEBET_OPERATING_MODE: 'production', ENABLE_DEMO_QUICK_LOGIN: 'false',
  SAFEBET_SCHEMA_SOURCE_COMMIT: COMMIT, SAFEBET_APP_COMMIT: APP_COMMIT,
  SAFEBET_FORBIDDEN_REFS: Object.values(FORBIDDEN).join(' '),
  NEXT_PUBLIC_SUPABASE_URL: `https://${PILOT_REF}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public',
  SAFEBET_GIT_COMMIT: APP_COMMIT, ...o,
});

test('buildspec-pilot: sets the Pilot values, separates schema-source from app authority, no synthetic dataClass', () => {
  for (const kv of ['NEXT_PUBLIC_ENV: "pilot"', 'NEXT_PUBLIC_SAFEBET_ENV: "pilot"', 'SAFEBET_OPERATING_MODE: "production"',
    'NEXT_PUBLIC_SAFEBET_OPERATING_MODE: "production"', 'ENABLE_DEMO_QUICK_LOGIN: "false"']) assert.ok(BS.includes(kv), kv);
  assert.ok(BS.includes('SAFEBET_SCHEMA_SOURCE_COMMIT:'), 'schema-source authority documented');
  assert.ok(BS.includes(`SAFEBET_APP_COMMIT: "${APP_COMMIT}"`), 'authorised Pilot app commit pinned');
  assert.ok(!/SAFEBET_AUTHORISED_COMMIT:/.test(BS), 'old single-authority var removed');
  assert.ok(!/"dataClass": "synthetic"/.test(BS), 'Pilot must not declare synthetic data');
  assert.ok(BS.includes('"dataClass": "pilot-no-operator-data"'), 'Pilot data class is explicit and not real-operator-data');
  assert.ok(!/SAFEBET_IDENTITY_PROVIDER: "/.test(BS), 'identity provider not set (IQ default)');
  assert.match(DEMO_BS, /NEXT_PUBLIC_ENV: "demo"/, 'Demo buildspec unchanged');
});

test('buildspec-pilot guard: passes for a reviewed Pilot app commit, fails closed on Demo/unsafe/wrong authority', () => {
  assert.equal(bash(PRE, bsEnv()).status, 0);
  const bad = [{ NEXT_PUBLIC_ENV: 'demo' }, { NEXT_PUBLIC_SAFEBET_ENV: 'demo' }, { SAFEBET_OPERATING_MODE: 'pilot' },
    { SAFEBET_OPERATING_MODE: 'demonstration' }, { NEXT_PUBLIC_SAFEBET_OPERATING_MODE: 'staging' },
    { ENABLE_DEMO_QUICK_LOGIN: 'true' }, { SAFEBET_IDENTITY_PROVIDER: 'cognito' },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN.demo}.supabase.co` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN.production}.supabase.co` },
    { NEXT_PUBLIC_SUPABASE_URL: '' },
    { SAFEBET_GIT_COMMIT: '' },                       // app commit required
    { SAFEBET_GIT_COMMIT: 'deadbeef' },               // must be 40-hex
    { SUPABASE_SERVICE_ROLE_KEY: 'x' }];
  for (const o of bad) assert.notEqual(bash(PRE, bsEnv(o)).status, 0, JSON.stringify(o));
});

test('buildspec-pilot B-2: CODEBUILD_RESOLVED_SOURCE_VERSION is Git identity only when it is a 40-hex SHA', () => {
  const S3_VERSION = '3HL4kqtJlcpXroDTDmJ.rmSpXd3dIbrHYz0';   // S3 object version id — not a Git SHA
  // 1) 40-hex correct Git SHA => PASS
  assert.equal(bash(PRE, bsEnv({ CODEBUILD_RESOLVED_SOURCE_VERSION: APP_COMMIT })).status, 0, '40-hex correct');
  // 2) 40-hex incorrect Git SHA => FAIL
  assert.notEqual(bash(PRE, bsEnv({ CODEBUILD_RESOLVED_SOURCE_VERSION: 'a'.repeat(40) })).status, 0, '40-hex incorrect');
  // 2b) resolved Git SHA == schema-source => FAIL
  assert.notEqual(bash(PRE, bsEnv({ CODEBUILD_RESOLVED_SOURCE_VERSION: COMMIT })).status, 0, 'resolved == schema-source');
  // 3) S3-style source version id => must NOT fail merely because it is not a Git SHA
  assert.equal(bash(PRE, bsEnv({ CODEBUILD_RESOLVED_SOURCE_VERSION: S3_VERSION })).status, 0, 'S3 version id tolerated');
  // 3b) empty CRSV (also not a Git SHA) => PASS
  assert.equal(bash(PRE, bsEnv({ CODEBUILD_RESOLVED_SOURCE_VERSION: '' })).status, 0, 'empty CRSV tolerated');
  // 4) SAFEBET_GIT_COMMIT incorrect (40-hex but not the authorised app commit) => FAIL
  assert.notEqual(bash(PRE, bsEnv({ SAFEBET_GIT_COMMIT: 'b'.repeat(40) })).status, 0, 'git_commit != authorised');
  // 5) SAFEBET_GIT_COMMIT = schema-source commit => FAIL
  assert.notEqual(bash(PRE, bsEnv({ SAFEBET_GIT_COMMIT: COMMIT })).status, 0, 'git_commit == schema-source');
});
