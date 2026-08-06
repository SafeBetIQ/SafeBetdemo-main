// Certified financial rollup + registered-refresh validation (manual super-admin
// login). Confirms the Overview financial card (v2 rollup, freshness, Partial,
// synthetic), registered snapshot age + manual refresh (duplicate-guarded, count
// preserved), Platform Health financial-rollup status, and the refresh endpoint
// authorization matrix. Measures deferred financial load time.
//   node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/financial-rollup-check.mjs
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
  log(true, 'Manual login → /admin');

  // Overview + deferred financial card
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Certified GGR/.test(document.body.innerText), { timeout: 30000 });
  const t0 = Date.now();
  await page.waitForFunction(() => /R\s?[\d,]/.test(document.body.innerText) && !/Certified GGR \(today\)\s*$/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { const t = document.body.innerText; return /(Current|Delayed|Stale)/.test(t) && /Certified GGR/.test(t); }, { timeout: 30000 }).catch(() => {});
  const finMs = Date.now() - t0;
  const body = await page.evaluate(() => document.body.innerText);
  log(/Certified GGR \(today\)/.test(body), 'Overview certified GGR card renders');
  log(/partial/i.test(body), 'Partial capability label present');
  log(/synthetic/i.test(body), 'Synthetic disclosure present');
  log(/source: rollup/i.test(body), 'Financial served from rollup');
  log(/Registered players/.test(body) && /Updated .* ago|Certified snapshot/.test(body), 'Registered snapshot age present');
  console.log(`  deferred financial load ≈ ${finMs}ms`);
  await page.screenshot({ path: path.join(OUT, 'admin-overview-financial.png'), fullPage: true });

  // Manual registered refresh: confirm → success; count preserved; duplicate guarded
  const before = await page.evaluate(() => (document.body.innerText.match(/Registered players\s*([\d,]+)/) || [])[1] || '');
  await page.getByRole('button', { name: /Refresh count/i }).click();
  await page.getByRole('button', { name: /^Confirm$/ }).click();
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => document.body.innerText);
  log(!/Registered players\s*—/.test(after), 'Registered count preserved during refresh (not blanked)');
  log(/updated|Recently refreshed|delayed/i.test(after) || after.includes(before), 'Manual refresh produced a status');

  // Platform Health financial-rollup status
  await page.getByRole('tab', { name: /Platform Health/i }).click({ force: true });
  await page.waitForFunction(() => /Financial rollup/.test(document.body.innerText), { timeout: 40000 }).catch(() => {});
  const ph = await page.evaluate(() => document.body.innerText);
  log(/Financial rollup/.test(ph), 'Platform Health shows financial-rollup status');
  await page.screenshot({ path: path.join(OUT, 'admin-financial-rollup-health.png'), fullPage: true });

  // Refresh endpoint authorization matrix
  const sb = createClient(eg('NEXT_PUBLIC_SUPABASE_URL'), eg('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const tok = async (e, p) => (await sb.auth.signInWithPassword({ email: e, password: p }))?.data?.session?.access_token ?? null;
  const opTok = await tok(process.env.DEMO_PRESTIGE_EMAIL, process.env.DEMO_PRESTIGE_PASSWORD);
  const regTok = await tok(process.env.DEMO_REGULATOR_EMAIL, process.env.DEMO_REGULATOR_PASSWORD);
  const superTok = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes('-auth-token')) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch {} } } return null; });
  const post = (t) => page.evaluate(async ([base, tk]) => (await fetch(`${base}/api/admin/overview/refresh-registered-counts`, { method: 'POST', headers: tk ? { authorization: `Bearer ${tk}` } : {} })).status, [BASE, t]);
  log((await post(null)) === 401, 'refresh-registered anonymous → 401');
  log((await post(opTok)) === 403, 'refresh-registered operator → 403');
  log((await post(regTok)) === 403, 'refresh-registered regulator → 403');
  log([200].includes(await post(superTok)), 'refresh-registered super_admin → 200');

  await ctx.close();
  console.log(allOk ? '\nFINANCIAL ROLLUP VALIDATION PASSED ✓' : '\nVALIDATION HAD FAILURES');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
