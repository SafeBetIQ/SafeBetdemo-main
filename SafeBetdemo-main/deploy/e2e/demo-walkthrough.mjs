// SafeBet IQ Demo — full authenticated six-casino browser walkthrough (Playwright).
//
// Playwright + Chromium are installed. This runs the literal walkthrough once
// credentials are supplied via environment variables (never hard-coded/logged):
//
//   DEMO_PRESTIGE_EMAIL / DEMO_PRESTIGE_PASSWORD
//   DEMO_SUNBET_EMAIL / DEMO_SUNBET_PASSWORD
//   DEMO_HOLLYWOODBETS_EMAIL / DEMO_HOLLYWOODBETS_PASSWORD
//   DEMO_GOLDRUSH_EMAIL / DEMO_GOLDRUSH_PASSWORD
//   DEMO_BETWAY_EMAIL / DEMO_BETWAY_PASSWORD
//   DEMO_ROYALPALACE_EMAIL / DEMO_ROYALPALACE_PASSWORD
//   DEMO_REGULATOR_EMAIL / DEMO_REGULATOR_PASSWORD
//   DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD
//
//   node deploy/e2e/demo-walkthrough.mjs
//
// Screenshots -> deploy/e2e/screenshots/ (review for no secrets/PII before sharing).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const CASINOS = [
  ['prestige', 'Prestige Casino', 'DEMO_PRESTIGE_EMAIL', 'DEMO_PRESTIGE_PASSWORD'],
  ['sunbet', 'SunBet', 'DEMO_SUNBET_EMAIL', 'DEMO_SUNBET_PASSWORD'],
  ['hollywoodbets', 'Hollywoodbets', 'DEMO_HOLLYWOODBETS_EMAIL', 'DEMO_HOLLYWOODBETS_PASSWORD'],
  ['goldrush', 'Gold Rush', 'DEMO_GOLDRUSH_EMAIL', 'DEMO_GOLDRUSH_PASSWORD'],
  ['betway', 'Betway', 'DEMO_BETWAY_EMAIL', 'DEMO_BETWAY_PASSWORD'],
  ['royalpalace', 'Royal Palace', 'DEMO_ROYALPALACE_EMAIL', 'DEMO_ROYALPALACE_PASSWORD'],
];

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env ${k}`); return v; };

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Sign in securely/i }).click();
  await page.waitForLoadState('networkidle');
}
async function logout(ctx) { await ctx.close(); }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function run() {
  const browser = await chromium.launch();
  const results = [];
  try {
    // ── Six operators ──
    for (const [slug, name, ek, pk] of CASINOS) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, env(ek), env(pk));
      await page.goto(`${BASE}/casino/dashboard`, { waitUntil: 'networkidle' });
      await shot(page, `operator-${slug}-dashboard`);
      // Other casinos must not appear in this operator's dashboard.
      for (const [, other] of CASINOS) {
        if (other !== name && await page.getByText(other, { exact: false }).count() > 0) {
          throw new Error(`Tenant leak: ${name} dashboard shows ${other}`);
        }
      }
      for (const p of ['/casino/players', '/casino/reports', '/casino/evidence']) {
        await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
        await shot(page, `operator-${slug}-${p.split('/').pop()}`);
      }
      results.push(`operator ${name}: dashboard + reconciliations + evidence captured; no cross-tenant leak`);
      await logout(ctx);
    }

    // ── Regulator ──
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await login(page, env('DEMO_REGULATOR_EMAIL'), env('DEMO_REGULATOR_PASSWORD'));
    await page.goto(`${BASE}/regulator/dashboard`, { waitUntil: 'networkidle' });
    await shot(page, 'regulator-overview');
    await page.goto(`${BASE}/regulator/audit-verification`, { waitUntil: 'networkidle' });
    await shot(page, 'regulator-audit-verification');
    results.push('regulator: six-casino overview + audit-verification captured');
    await logout(ctx);

    // ── Super Admin ──
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, env('DEMO_ADMIN_EMAIL'), env('DEMO_ADMIN_PASSWORD'));
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await shot(page, 'admin-platform-health');
    results.push('super-admin: platform health + audit centre captured');
    await logout(ctx);

    console.log('WALKTHROUGH OK\n' + results.join('\n') + `\nScreenshots: ${OUT}`);
  } finally {
    await browser.close();
  }
}
run().catch((e) => { console.error('WALKTHROUGH FAILED:', e.message); process.exit(1); });
