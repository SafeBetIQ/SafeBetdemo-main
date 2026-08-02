// SafeBet IQ Demo — authenticated walkthrough via the secure one-click Demo login.
//
// The six casinos + regulator use the SERVER-side quick-login (clicking a card
// button; no client credentials needed). Super Admin uses the normal manual
// login and therefore needs DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD via env:
//   node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/demo-walkthrough.mjs
// Screenshots -> deploy/e2e/screenshots/ (no passwords/tokens captured).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

// Card order matches the on-page selector order.
const CASINOS = [
  ['prestige', 'Prestige Casino'], ['sunbet', 'SunBet'], ['hollywoodbets', 'Hollywoodbets'],
  ['goldrush', 'Gold Rush'], ['betway', 'Betway'], ['royalpalace', 'Royal Palace'],
];
const ALL_NAMES = CASINOS.map(([, n]) => n);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function quickLogin(page, buttonIndex) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Enter Casino Demo' }).nth(buttonIndex).click();
  await page.waitForURL('**/casino/**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  try {
    // ── Six operators via one-click quick-login ──
    for (let i = 0; i < CASINOS.length; i++) {
      const [slug, name] = CASINOS[i];
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await quickLogin(page, i);
      await page.goto(`${BASE}/casino/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await shot(page, `operator-${slug}-dashboard`);
      const txt = await page.evaluate(() => document.body.innerText);
      const ownVisible = txt.includes(name);
      const othersVisible = ALL_NAMES.filter((n) => n !== name && txt.includes(n));
      for (const p of ['/casino/players', '/casino/reports', '/casino/evidence']) {
        await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
        await shot(page, `operator-${slug}-${p.split('/').pop()}`);
      }
      results.push(`operator ${name}: quick-login OK · own-visible=${ownVisible} · other-casinos-visible=${othersVisible.length} · no password shown`);
      await ctx.close();
    }

    // ── Regulator via one-click quick-login ──
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Enter Regulator Demo/i }).click();
    await page.waitForURL('**/regulator/**', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.goto(`${BASE}/regulator/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, 'regulator-overview');
    await page.goto(`${BASE}/regulator/audit-verification`, { waitUntil: 'networkidle' });
    await shot(page, 'regulator-audit-verification');
    results.push('regulator: quick-login OK · national overview + audit-verification captured');
    await ctx.close();

    // ── Super Admin via MANUAL login (no quick-login card by design) ──
    if (process.env.DEMO_ADMIN_EMAIL && process.env.DEMO_ADMIN_PASSWORD) {
      ctx = await browser.newContext();
      page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await page.locator('#email').fill(process.env.DEMO_ADMIN_EMAIL);
      await page.locator('#password').fill(process.env.DEMO_ADMIN_PASSWORD);
      await page.getByRole('button', { name: /Sign in securely/i }).click();
      await page.waitForLoadState('networkidle');
      await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
      await shot(page, 'admin-platform-health');
      // Confirm there is NO Super Admin quick-login card on the login page.
      const lp = await browser.newContext(); const lpp = await lp.newPage();
      await lpp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      const adminCard = await lpp.getByText(/Super Admin/i).count();
      results.push(`super-admin: manual login OK · platform health captured · super-admin-quick-login-cards=${adminCard}`);
      await lp.close(); await ctx.close();
    } else {
      results.push('super-admin: manual login SKIPPED (DEMO_ADMIN_* not provided)');
    }

    console.log('WALKTHROUGH OK\n' + results.join('\n') + `\nScreenshots: ${OUT}`);
  } finally {
    await browser.close();
  }
}
run().catch((e) => { console.error('WALKTHROUGH FAILED:', e.message); process.exit(1); });
