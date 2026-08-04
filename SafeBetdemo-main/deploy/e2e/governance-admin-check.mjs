// Super Admin POSITIVE-PATH walkthrough (manual login only — no quick-login for
// super admin, no automatic login). Verifies /admin, Platform Health, the Demo
// Simulation Health panel (all required fields + value parity with the admin
// API), Audit Centre, and the API authorization matrix (super 200, operator 403,
// regulator 403, anon 401). Credentials come ONLY from the git-ignored
// deploy/e2e/.env.demo-walkthrough via --env-file; they are NEVER logged or
// screenshotted. Run:
//   node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/governance-admin-check.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
// Read demo URL + anon key from the app's .env.local (not committed).
const envLocal = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const envGet = (k) => (envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
const SB_URL = envGet('NEXT_PUBLIC_SUPABASE_URL');
const SB_ANON = envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.DEMO_ADMIN_EMAIL;
const PW = process.env.DEMO_ADMIN_PASSWORD;
if (!EMAIL || !PW) { console.error('Missing DEMO_ADMIN_* (use --env-file=deploy/e2e/.env.demo-walkthrough)'); process.exit(2); }

const REQUIRED_FIELDS = [
  'Demo Simulation Health', 'Simulator', 'Showcase', 'Last successful tick', 'Next expected',
  'Events today', 'Daily warning', 'Daily hard limit', 'Est. monthly', 'Storage', 'Database',
  'Partition readiness', 'Projection lag', 'Active showcase windows', 'Open alerts', 'Per-casino simulation',
];

const browser = await chromium.launch();
let allOk = true;
const log = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? '✓' : '✗'} ${msg}`); };

// Mint a role token via Supabase password sign-in (avoids the quick-login rate
// limit; these accounts are the same synthetic operator/regulator demo users).
async function tokenFor(email, pw) {
  if (!email || !pw) return null;
  const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password: pw });
  // NOTE: do NOT signOut — that revokes the token; we need it valid so the API's
  // getUser succeeds and the role gate returns 403 (authenticated, not super_admin).
  return data?.session?.access_token ?? null;
}

try {
  const operatorToken = await tokenFor(process.env.DEMO_PRESTIGE_EMAIL, process.env.DEMO_PRESTIGE_PASSWORD);
  const regulatorToken = await tokenFor(process.env.DEMO_REGULATOR_EMAIL, process.env.DEMO_REGULATOR_PASSWORD);
  log(!!operatorToken, 'Operator token minted for API matrix');
  log(!!regulatorToken, 'Regulator token minted for API matrix');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── Manual login (email + password) ───────────────────────────────────────
  // Wait for hydration before filling — a controlled input filled pre-hydration
  // gets reset to empty when React mounts, submitting a blank form.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { state: 'visible' });
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(1200);
    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PW);
    const stuck = await page.evaluate(() => document.querySelector('#email')?.value?.length ?? 0);
    if (stuck > 0) break;   // hydration settled, value retained
  }
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL('**/admin**', { timeout: 30000 });
  log(page.url().includes('/admin'), `Manual login → ${new URL(page.url()).pathname}`);

  // ── Platform Health tab ───────────────────────────────────────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /Platform Health/i }).click().catch(async () => {
    await page.getByText('Platform Health', { exact: false }).first().click();
  });
  // The panel fetches after acquiring the Supabase auth lock; first paint can take
  // ~10-20s. Wait until its data heading (not the loading state) is present.
  await page.waitForFunction(
    () => /Demo Simulation Health/i.test(document.body.innerText) && !/Loading Demo simulation health/i.test(document.body.innerText),
    { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(1000);
  const panelText = await page.evaluate(() => document.body.innerText);
  log(/Enterprise flow operational|Certified enterprise flow/i.test(panelText), 'Platform Health overview rendered');
  await page.screenshot({ path: path.join(OUT, 'admin-platform-health.png'), fullPage: true });

  // ── Demo Simulation Health: all required fields render ─────────────────────
  for (const f of REQUIRED_FIELDS) log(panelText.includes(f), `Sim Health renders: ${f}`);
  const overallShown = /Demo Simulation Health\s*(Healthy|Warning|Critical|Disabled|Unknown)/i.test(panelText.replace(/\n/g, ' '));
  log(overallShown, 'Sim Health renders: Overall status badge');
  // six casino rows
  const casinoNames = ['Prestige', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace'];
  log(casinoNames.every((c) => panelText.includes(c)), 'Six-casino table shows all six casinos');
  await page.screenshot({ path: path.join(OUT, 'admin-sim-health-panel.png'), fullPage: true });

  // Focused screenshots of the six-casino table and the alert/partition sections.
  const tableEl = await page.getByText('Per-casino simulation', { exact: false }).first().elementHandle().catch(() => null);
  if (tableEl) { const box = await tableEl.boundingBox(); if (box) await page.screenshot({ path: path.join(OUT, 'admin-sim-six-casino.png'), clip: { x: 0, y: Math.max(0, box.y - 20), width: 1280, height: 420 } }); }
  const partEl = await page.getByText('Partition readiness', { exact: false }).first().elementHandle().catch(() => null);
  if (partEl) { const box = await partEl.boundingBox(); if (box) await page.screenshot({ path: path.join(OUT, 'admin-sim-alerts-partitions.png'), clip: { x: 0, y: Math.max(0, box.y - 40), width: 1280, height: 380 } }); }

  // ── Value parity: DOM vs admin API ────────────────────────────────────────
  const superToken = await page.evaluate(() => {
    for (let k = 0; k < localStorage.length; k++) {
      const key = localStorage.key(k);
      if (key && key.includes('auth-token')) { try { return JSON.parse(localStorage.getItem(key)).access_token; } catch { /* */ } }
    }
    return null;
  });
  const api = await page.evaluate(async ([base, tok]) => {
    const r = await fetch(`${base}/api/admin/simulation-health`, { headers: { authorization: `Bearer ${tok}` } });
    return { status: r.status, body: await r.json() };
  }, [BASE, superToken]);
  log(api.status === 200, `Super Admin GET /api/admin/simulation-health → 200 (got ${api.status})`);
  const eventsToday = Number(api.body?.overall?.events_today ?? -1);
  const overallHealth = String(api.body?.overall?.overall_health ?? '');
  log(panelText.includes(eventsToday.toLocaleString('en-US')) || panelText.includes(String(eventsToday)), `Value parity: events_today (${eventsToday}) shown in panel`);
  log(overallHealth !== '' && panelText.includes(overallHealth), `Value parity: overall_health (${overallHealth}) shown in panel`);
  // No secrets in the API response.
  const raw = JSON.stringify(api.body);
  log(!/service_role|SUPABASE_SERVICE_ROLE|"password"|refresh_token|eyJ[A-Za-z0-9_-]{20,}/.test(raw), 'No credentials/tokens/service key in API response');
  log(!/service_role|SUPABASE_SERVICE_ROLE|eyJ[A-Za-z0-9_-]{30,}/.test(panelText), 'No credentials/tokens/service key in page text');

  // ── Audit Centre ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Audit/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const auditText = await page.evaluate(() => document.body.innerText);
  const auditOk = page.url().includes('/admin/audit') && /Audit/i.test(auditText) && !/not authoris|access denied|forbidden|You do not have/i.test(auditText);
  log(auditOk, `Audit Centre opened (${new URL(page.url()).pathname})`);
  await page.screenshot({ path: path.join(OUT, 'admin-audit-centre.png'), fullPage: true });

  // ── API authorization matrix ──────────────────────────────────────────────
  const statusWith = async (tok) => page.evaluate(async ([base, t]) => {
    const r = await fetch(`${base}/api/admin/simulation-health`, t ? { headers: { authorization: `Bearer ${t}` } } : undefined);
    return r.status;
  }, [BASE, tok]);
  const anonS = await statusWith(null); log(anonS === 401, `Anonymous → 401 (got ${anonS})`);
  const opS = await statusWith(operatorToken); log(opS === 403, `Operator → 403 (got ${opS})`);
  const regS = await statusWith(regulatorToken); log(regS === 403, `Regulator → 403 not explicitly authorised (got ${regS})`);

  await ctx.close();
  console.log(allOk ? '\nSUPER ADMIN POSITIVE-PATH PASSED ✓' : '\nSUPER ADMIN POSITIVE-PATH HAD FAILURES');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
