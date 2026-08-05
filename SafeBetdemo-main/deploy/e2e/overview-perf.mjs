// Super Admin OVERVIEW consolidation validation (manual login). Confirms the
// initial Overview data fan-out is bounded (no duplicate casinos/users/national-
// overview), measures first-content/full-render over 5 runs, checks metrics +
// six casinos + snapshot + Platform Health + Audit Centre, and the API matrix for
// /api/admin/overview.  node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/overview-perf.mjs
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
const eg = (k) => (envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { min: s[0], median: s[(s.length / 2) | 0], max: s[s.length - 1] }; };

const browser = await chromium.launch();
let allOk = true;
const log = (ok, m) => { if (!ok) allOk = false; console.log(`${ok ? '✓' : '✗'} ${m}`); };

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { state: 'visible' });
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(1000); await page.locator('#email').fill(EMAIL); await page.locator('#password').fill(PW); if (await page.evaluate(() => document.querySelector('#email')?.value?.length)) break; }
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL('**/admin**', { timeout: 30000 });
  log(page.url().includes('/admin'), 'Manual login → /admin');

  // ── Request fan-out on a fresh /admin load ────────────────────────────────
  // Warm up first so the login-redirect mount's DEFERRED calls finish before we
  // count (otherwise they bleed into the measured window and inflate the totals).
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Licensed Operators/.test(document.body.innerText), { timeout: 30000 });
  await page.waitForTimeout(6000);
  const reqs = [];
  const onReq = (r) => { const u = r.url(); if (/\/rest\/v1\/|\/functions\/v1\/|\/api\/admin\//.test(u)) reqs.push(u.replace(/https:\/\/[^/]+/, '').split('?')[0]); };
  page.on('request', onReq);
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Licensed Operators/.test(document.body.innerText), { timeout: 30000 });
  await page.waitForTimeout(5000);   // allow deferred financial + national-overview to fire
  page.off('request', onReq);
  const counts = reqs.reduce((a, u) => (a[u] = (a[u] || 0) + 1, a), {});
  const overviewCalls = reqs.filter((u) => u.includes('/api/admin/overview')).length;   // core + deferred financial
  const nationalCalls = reqs.filter((u) => u.includes('regulator-portal')).length;       // deferred workflow metrics
  const casinosCalls = reqs.filter((u) => u.endsWith('/rest/v1/casinos')).length;
  const usersCalls = reqs.filter((u) => u.endsWith('/rest/v1/users')).length;
  const boundedTotal = overviewCalls + nationalCalls;
  console.log('  request counts:', JSON.stringify(counts));
  log(boundedTotal <= 3, `initial Overview data fan-out ≤ 3 bounded requests (${boundedTotal}: ${overviewCalls} overview + ${nationalCalls} national)`);
  log(overviewCalls <= 2, `overview: 1 core + ≤1 deferred financial (${overviewCalls})`);
  log(casinosCalls === 0, `no direct casinos fan-out on Overview (${casinosCalls})`);
  log(usersCalls === 0, `no users fetch on Overview first paint (${usersCalls}) — deferred to Users tab`);

  // ── First-content / full-render over 5 runs ──────────────────────────────
  const firstContent = [], fullRender = [];
  for (let run = 0; run < 5; run++) {
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    const t0 = Date.now();
    await page.waitForFunction(() => { const t = document.body.innerText; return /Licensed Operators/.test(t) && /Total Players/.test(t); }, { timeout: 30000 });
    const tFirst = Date.now() - t0;
    // full render = province + risk charts present (recharts svg)
    await page.waitForFunction(() => document.querySelectorAll('svg .recharts-surface, .recharts-wrapper').length >= 1, { timeout: 30000 }).catch(() => {});
    const tFull = Date.now() - t0;
    firstContent.push(tFirst); fullRender.push(tFull);
    console.log(`  run ${run + 1}${run === 0 ? ' (cold)' : ' (warm)'}: first=${tFirst}ms full=${tFull}ms`);
    if (run === 4) await page.screenshot({ path: path.join(OUT, 'admin-overview-consolidated.png'), fullPage: true });
  }
  const fc = stats(firstContent);
  console.log(`\nFirst content median=${fc.median}ms min=${fc.min}ms max=${fc.max}ms; warm-median=${stats(firstContent.slice(1)).median}ms`);
  log(stats(firstContent.slice(1)).median < 2500, `First content warm-median < 2.5s (${stats(firstContent.slice(1)).median}ms)`);

  // ── Metrics render + six casinos + snapshot + other tabs ──────────────────
  const body = await page.evaluate(() => document.body.innerText);
  for (const f of ['Licensed Operators', 'Total Players', 'Critical Risk Players', 'Players Monitored', 'Platform Users']) log(body.includes(f), `KPI present: ${f}`);
  // six casinos (Casinos tab)
  await page.getByRole('tab', { name: /Casinos/i }).click({ force: true });
  await page.waitForTimeout(800);
  const casinoText = await page.evaluate(() => document.body.innerText);
  log(['Prestige', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace'].every((c) => casinoText.includes(c)), 'Six casinos render');
  // Platform Health tab still works
  await page.getByRole('tab', { name: /Platform Health/i }).click({ force: true });
  await page.waitForFunction(() => /Demo Simulation Health/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  log(/Demo Simulation Health/.test(await page.evaluate(() => document.body.innerText)), 'Platform Health tab still works');
  // Audit Centre still works
  await page.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Audit/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  log(page.url().includes('/admin/audit'), 'Audit Centre still loads');

  // ── API matrix ────────────────────────────────────────────────────────────
  const sb = createClient(eg('NEXT_PUBLIC_SUPABASE_URL'), eg('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const tok = async (e, p) => (await sb.auth.signInWithPassword({ email: e, password: p }))?.data?.session?.access_token ?? null;
  const opTok = await tok(process.env.DEMO_PRESTIGE_EMAIL, process.env.DEMO_PRESTIGE_PASSWORD);
  const regTok = await tok(process.env.DEMO_REGULATOR_EMAIL, process.env.DEMO_REGULATOR_PASSWORD);
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const superTok = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes('-auth-token')) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch {} } } return null; });
  const st = (t) => page.evaluate(async ([base, tk]) => (await fetch(`${base}/api/admin/overview`, tk ? { headers: { authorization: `Bearer ${tk}` } } : undefined)).status, [BASE, t]);
  log((await st(null)) === 401, 'Anonymous → 401');
  log((await st(opTok)) === 403, 'Operator → 403');
  log((await st(regTok)) === 403, 'Regulator → 403');
  log((await st(superTok)) === 200, 'Super Admin → 200');
  const secretScan = await page.evaluate(async ([base, tk]) => { const r = await fetch(`${base}/api/admin/overview`, { headers: { authorization: `Bearer ${tk}` } }); return JSON.stringify(await r.json()); }, [BASE, superTok]);
  log(!/service_role|SUPABASE_SERVICE_ROLE|"password"|eyJ[A-Za-z0-9_-]{30,}/.test(secretScan), 'No secrets/tokens in Overview response');

  await ctx.close();
  console.log(allOk ? '\nOVERVIEW CONSOLIDATION VALIDATION PASSED ✓' : '\nVALIDATION HAD FAILURES');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
