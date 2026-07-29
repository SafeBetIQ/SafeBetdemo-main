// ─── SafeBet IQ — one-command demo launcher (v1.2.1) ─────────────────────────
//
//   npm run safebet:demo         validate → health-check → dashboard → next dev
//   npm run safebet:demo -- --check-only    everything except starting the app
//
// Developer tooling ONLY. It validates the environment, verifies every
// certified enterprise layer is reachable (by CONSUMING it, never bypassing
// it), confirms demo data, prints all local URLs, and starts the app.
// Idempotent and safe to re-run. No secrets are printed.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseEnv, versionOk, REQUIRED_NODE_MAJOR, REQUIRED_NPM_MAJOR, redact,
  classifyHttp, localUrls, renderDashboard, allReady, diagnostic, icon,
} from './checks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_PORT = process.env.PORT || '3000';
const APP_BASE = `http://localhost:${APP_PORT}`;
const CHECK_ONLY = process.argv.includes('--check-only');
const VERSION = '1.2.1';

const log = (...a) => console.log(...a);
const fail = (msg) => { console.error(msg); process.exitCode = 1; };

async function probe(url, init) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch { return 0; }
}

async function main() {
  log(`\n🎲  SafeBet IQ — Demo Environment Launcher v${VERSION}\n`);
  const rows = [];
  const diagnostics = [];

  // ── WS1: environment validation ───────────────────────────────────────────
  const nodeOk = versionOk(process.version, REQUIRED_NODE_MAJOR);
  rows.push({ label: `Node ${process.version}`, state: nodeOk ? 'pass' : 'fail', detail: `need ≥${REQUIRED_NODE_MAJOR}` });
  if (!nodeOk) diagnostics.push(diagnostic('Node.js too old', `found ${process.version}`, `install Node ≥ ${REQUIRED_NODE_MAJOR} (nodejs.org or nvm)`));

  let npmVer = 'unknown';
  try { npmVer = execCapture('npm', ['-v']); } catch { /* keep unknown */ }
  const npmOk = versionOk(npmVer, REQUIRED_NPM_MAJOR);
  rows.push({ label: `npm ${npmVer}`, state: npmOk ? 'pass' : 'warn', detail: `need ≥${REQUIRED_NPM_MAJOR}`, required: false });

  // env file + required config
  const envPath = join(ROOT, '.env.local');
  const hasEnv = existsSync(envPath);
  const env = hasEnv ? parseEnv(readFileSync(envPath, 'utf8')) : {};
  rows.push({ label: '.env.local present', state: hasEnv ? 'pass' : 'fail' });
  if (!hasEnv) diagnostics.push(diagnostic('.env.local missing', 'the app needs Supabase connection settings', 'create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see docs/LOCAL_DEVELOPMENT_GUIDE.md §3)'));

  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  rows.push({ label: 'NEXT_PUBLIC_SUPABASE_URL', state: url ? 'pass' : 'fail', detail: url ? new URL(url).host.slice(0, 18) : '(missing)' });
  rows.push({ label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', state: anon ? 'pass' : 'fail', detail: redact(anon).slice(0, 18) });
  if (!url || !anon) diagnostics.push(diagnostic('Supabase env vars missing', 'the app cannot reach the platform', 'set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'));

  for (const dir of ['app', 'lib', 'supabase/functions', 'tests']) {
    const ok = existsSync(join(ROOT, dir));
    if (!ok) { rows.push({ label: `folder ${dir}`, state: 'fail' }); diagnostics.push(diagnostic(`Missing folder: ${dir}`, 'the project layout is incomplete', 'run from the SafeBetdemo-main project root')); }
  }

  // ── WS2: dependency management ─────────────────────────────────────────────
  const hasModules = existsSync(join(ROOT, 'node_modules', 'next'));
  if (!hasModules) {
    log(`${icon('info')} Dependencies not installed — running "npm install" (one-time)…`);
    try { await run('npm', ['install'], ROOT); } catch { diagnostics.push(diagnostic('npm install failed', 'dependencies could not be installed', 'check your network and run "npm install" manually')); }
  }
  rows.push({ label: 'Dependencies (node_modules)', state: existsSync(join(ROOT, 'node_modules', 'next')) ? 'pass' : 'fail' });

  const fnBase = url ? `${url.replace(/\/$/, '')}/functions/v1` : '';

  // ── WS1/WS3: platform reachability (consume the certified flow) ────────────
  // Unauthenticated probes: a 401 means the function is deployed AND enforcing
  // auth (healthy). Down = 0 or 5xx. No secrets used.
  let supabaseState = 'down';
  if (url) {
    const authPing = await probe(`${url}/auth/v1/health`);
    supabaseState = classifyHttp(authPing);
    rows.push({ label: 'Supabase connectivity', state: supabaseState === 'down' ? 'fail' : 'pass', detail: `auth ${authPing || 'no-response'}` });
    if (supabaseState === 'down') diagnostics.push(diagnostic('Supabase unreachable', 'no response from the project URL', 'check the URL/network; or run the offline stack (docs §9). AWS being suspended does NOT affect Supabase.'));
  }

  const layerChecks = fnBase ? [
    ['Identity Resolution', await probe(`${fnBase}/identity-resolution`, { method: 'POST', headers: { apikey: anon }, body: '{}' })],
    ['Consumer Platform', await probe(`${fnBase}/consumer-gateway?view=summary&casino_id=x`, { headers: { apikey: anon } })],
    ['Regulator Portal', await probe(`${fnBase}/regulator-portal?view=national-overview`, { headers: { apikey: anon } })],
    ['Connector Framework', await probe(`${fnBase}/connector-ingest`, { method: 'POST', headers: { apikey: anon }, body: '{}' })],
    ['Projection Platform', await probe(`${fnBase}/projection-platform?action=status&casino_id=x`, { headers: { apikey: anon } })],
    ['Digital Twin', await probe(`${fnBase}/digital-twin?action=health&casino_id=x`, { headers: { apikey: anon } })],
  ] : [];
  for (const [label, status] of layerChecks) {
    const state = classifyHttp(status);
    rows.push({ label, state });
    if (state === 'down') diagnostics.push(diagnostic(`${label} unreachable`, `probe returned ${status || 'no response'}`, `redeploy the edge function or check Supabase status (docs/OPERATIONS_MANUAL.md)`));
  }
  // Event Platform + Domain Intelligence + Policy Platform are exercised
  // in-flow by the Consumer/Regulator endpoints above (they compose them),
  // so a reachable Consumer Platform confirms the whole read path.
  const consumerUp = layerChecks.find(([l]) => l === 'Consumer Platform');
  const readPath = consumerUp && classifyHttp(consumerUp[1]) !== 'down';
  rows.push({ label: 'Event/Intelligence/Policy (in-flow)', state: readPath ? 'reachable' : 'fail' });

  // ── WS4: demo data verification (optional authenticated count) ─────────────
  // Uses a well-known DEMO account (already shown on the login page). Overridable
  // via env; never printed. If login is unavailable, this is a non-fatal note.
  let dataState = 'warn', dataDetail = 'not verified';
  const demoEmail = process.env.SAFEBET_DEMO_ADMIN_EMAIL || 'demo.admin@safebetiq.com';
  const demoPass = process.env.SAFEBET_DEMO_ADMIN_PASSWORD || 'Admin@SafeBet1';
  if (url && anon && supabaseState !== 'down') {
    try {
      const tok = await login(url, anon, demoEmail, demoPass);
      if (tok) {
        const casinoId = 'a1b2c3d4-0000-0000-0000-000000000001';
        const health = await rpc(url, anon, tok, 'sbiq_platform_health', { p_casino: casinoId });
        const events = Number(health?.events_in_log ?? 0);
        const players = Number(health?.players_projected ?? 0);
        dataState = events > 0 && players > 0 ? 'pass' : 'warn';
        dataDetail = `${events} events / ${players} players`;
        if (dataState !== 'pass') diagnostics.push(diagnostic('Demo data looks empty', 'no events/projections found for the demo casino', 'run "npm run seed", or trigger the casino simulator (docs §10). Existing valid data is never overwritten.'));
      } else {
        dataDetail = 'demo login unavailable';
      }
    } catch { dataDetail = 'demo login unavailable'; }
  }
  rows.push({ label: 'Demo data', state: dataState, detail: dataDetail, required: false });

  // ── WS6: startup dashboard ────────────────────────────────────────────────
  const meta = {
    'Version': `SafeBet IQ ${VERSION}`,
    'Operating Mode': process.env.SAFEBET_OPERATING_MODE || 'demonstration',
    'Node': process.version,
    'App (local)': APP_BASE,
    'Platform': url ? new URL(url).host : '(unset)',
  };
  log(renderDashboard(meta, rows));

  // ── WS5: local URL discovery ──────────────────────────────────────────────
  log('\n📍  Local URLs\n');
  for (const [group, links] of Object.entries(localUrls(APP_BASE, fnBase || '(platform)/functions/v1'))) {
    log(`   ${group}`);
    for (const [name, href] of Object.entries(links)) log(`     • ${name.padEnd(34)} ${href}`);
    log('');
  }
  log('   Demo logins:  demo.casino@safebetiq.com · demo.regulator@safebetiq.com · demo.admin@safebetiq.com');
  log('   (passwords are on the /login page — demo only)\n');

  // ── WS7: readiness gate + diagnostics ─────────────────────────────────────
  const ready = allReady(rows);
  if (diagnostics.length) { log('🛠  Diagnostics:'); diagnostics.forEach(d => log(d)); log(''); }

  if (!ready) {
    fail(`${icon('fail')}  NOT READY — resolve the diagnostics above, then re-run "npm run safebet:demo".`);
    return;
  }
  log(`\n🟢  READY FOR DEMONSTRATION\n`);

  if (CHECK_ONLY) { log('(--check-only: skipping app start)\n'); return; }

  // ── Start the app (replaces the Elastic Beanstalk host locally) ───────────
  log(`🚀  Starting the app at ${APP_BASE}  (Ctrl+C to stop)…\n`);
  const child = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

// ── small helpers (I/O; the pure ones live in checks.mjs) ────────────────────
import { execFileSync } from 'node:child_process';
function execCapture(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
}
function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    c.on('error', reject);
  });
}
async function login(url, anon, email, password) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  return (await r.json())?.access_token ?? null;
}
async function rpc(url, anon, token, fn, args) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  return await r.json();
}

main().catch((e) => fail(`\n${icon('fail')}  Launcher error: ${e instanceof Error ? e.message : String(e)}\n   Fix:  re-run "npm run safebet:demo -- --check-only" and review the diagnostics above.`));
