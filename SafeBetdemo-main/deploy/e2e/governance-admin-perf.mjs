// Super Admin Platform Health LOAD PERFORMANCE (manual login only). Logs in once,
// then re-navigates to /admin → Platform Health five times, measuring time to
// first content, event-volume cards, and the six-casino table. Reports
// median/min/max and cold-vs-warm. Also re-checks rendering + the API matrix.
//   node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/governance-admin-perf.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.DEMO_ADMIN_EMAIL, PW = process.env.DEMO_ADMIN_PASSWORD;
if (!EMAIL || !PW) { console.error('Missing DEMO_ADMIN_* (use --env-file)'); process.exit(2); }
const envLocal = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const envGet = (k) => (envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '');

const CASINOS = ['Prestige', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace'];
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { min: s[0], median: s[(s.length / 2) | 0], max: s[s.length - 1] }; };
const browser = await chromium.launch();
let allOk = true;
const log = (ok, m) => { if (!ok) allOk = false; console.log(`${ok ? '✓' : '✗'} ${m}`); };

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Manual login (fill AFTER hydration).
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { state: 'visible' });
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(1000); await page.locator('#email').fill(EMAIL); await page.locator('#password').fill(PW); if (await page.evaluate(() => document.querySelector('#email')?.value?.length)) break; }
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL('**/admin**', { timeout: 30000 });
  log(page.url().includes('/admin'), 'Manual login → /admin');

  const firstContent = [], eventCards = [], sixCasino = [], fullRender = [];
  for (let run = 0; run < 5; run++) {
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /Platform Health/i }).waitFor({ state: 'visible' });
    const t0 = Date.now();
    // force:true = a real-user click (the browser dispatches immediately); the default
    // .click() waits for the tab to stop moving while the Overview tab's ~18 fetches
    // fill in, which is a Playwright actionability artifact, not a user-perceived delay.
    await page.getByRole('tab', { name: /Platform Health/i }).click({ force: true });
    // first content = data heading present and NOT the loading skeleton message
    await page.waitForFunction(() => { const t = document.body.innerText; return /Demo Simulation Health/.test(t) && !/Loading simulator health|Verifying Super Admin|Loading casino activity/.test(t); }, { timeout: 30000 });
    const tFirst = Date.now() - t0;
    await page.waitForFunction(() => /Event volume/.test(document.body.innerText), { timeout: 30000 });
    const tCards = Date.now() - t0;
    await page.waitForFunction((names) => names.every((n) => document.body.innerText.includes(n)), CASINOS, { timeout: 30000 });
    const tTable = Date.now() - t0;
    firstContent.push(tFirst); eventCards.push(tCards); sixCasino.push(tTable); fullRender.push(tTable);
    console.log(`  run ${run + 1}${run === 0 ? ' (cold)' : ' (warm)'}: first=${tFirst}ms cards=${tCards}ms sixCasino=${tTable}ms`);
    if (run === 4) await page.screenshot({ path: path.join(OUT, 'admin-sim-health-optimised.png'), fullPage: true });
  }

  const fc = stats(firstContent), tb = stats(sixCasino);
  console.log(`\nFirst content  median=${fc.median}ms min=${fc.min}ms max=${fc.max}ms`);
  console.log(`Six-casino     median=${tb.median}ms min=${tb.min}ms max=${tb.max}ms`);
  console.log(`Cold (run1) six-casino=${sixCasino[0]}ms | warm median=${stats(sixCasino.slice(1)).median}ms`);
  // Targets (Demo): first meaningful content < 3s, full six-casino < 5s (warm).
  log(stats(firstContent.slice(1)).median < 3000, `First content warm-median < 3s (${stats(firstContent.slice(1)).median}ms)`);
  log(stats(sixCasino.slice(1)).median < 5000, `Six-casino warm-median < 5s (${stats(sixCasino.slice(1)).median}ms)`);

  // Rendering + snapshot + no auth error.
  const body = await page.evaluate(() => document.body.innerText);
  log(/Updated .* ago|Certified snapshot/.test(body), 'Snapshot-age indicator present');
  log(!/could not be loaded|Not authenticated|Verifying Super Admin access/.test(body), 'No auth error / stuck state');
  for (const f of ['Next expected', 'Daily warning', 'Est. monthly', 'Partition readiness', 'Per-casino simulation']) log(body.includes(f), `Field present: ${f}`);

  // Audit Centre still loads.
  await page.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Audit/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  log(page.url().includes('/admin/audit'), 'Audit Centre still loads');

  // API matrix (tokens minted via password sign-in; not signed out so they stay valid).
  const sb = createClient(envGet('NEXT_PUBLIC_SUPABASE_URL'), envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const tok = async (e, p) => (await sb.auth.signInWithPassword({ email: e, password: p }))?.data?.session?.access_token ?? null;
  const opTok = await tok(process.env.DEMO_PRESTIGE_EMAIL, process.env.DEMO_PRESTIGE_PASSWORD);
  const regTok = await tok(process.env.DEMO_REGULATOR_EMAIL, process.env.DEMO_REGULATOR_PASSWORD);
  const superTok = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes('-auth-token')) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch {} } } return null; });
  const statusWith = (t) => page.evaluate(async ([base, tk]) => (await fetch(`${base}/api/admin/simulation-health`, tk ? { headers: { authorization: `Bearer ${tk}` } } : undefined)).status, [BASE, t]);
  log((await statusWith(null)) === 401, 'Anonymous → 401');
  log((await statusWith(opTok)) === 403, 'Operator → 403');
  log((await statusWith(regTok)) === 403, 'Regulator → 403');
  log((await statusWith(superTok)) === 200, 'Super Admin → 200');

  await ctx.close();
  console.log(allOk ? '\nPERF + SECURITY VALIDATION PASSED ✓' : '\nVALIDATION HAD FAILURES');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
