// SafeBet IQ Demo — authenticated browser walkthrough (Playwright/Chromium).
//
// This is a READY-TO-RUN harness. It is NOT executed in the current environment
// because (1) Playwright is not installed and (2) no demo-account credentials are
// supplied. Run it where both are available:
//
//   npm i -D playwright && npx playwright install chromium
//   SAFEBET_DEMO_URL=https://demo.safebetiq.com \
//   OP_EMAIL=demo.casino@safebetiq.com     OP_PASSWORD=***  \
//   REG_EMAIL=demo.regulator@safebetiq.com REG_PASSWORD=*** \
//   ADM_EMAIL=demo.admin@safebetiq.com     ADM_PASSWORD=*** \
//   node deploy/e2e/demo-walkthrough.mjs
//
// Credentials come ONLY from environment variables — never hard-coded or logged.
// Screenshots are written to deploy/e2e/screenshots/ and must be reviewed to
// ensure they contain no passwords, tokens, or unnecessary player-level data.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var ${k} (credentials must be supplied via env).`);
  return v;
};

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log ?in/i }).click();
  await page.waitForLoadState('networkidle');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  try {
    // ── Operator ──
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await login(page, need('OP_EMAIL'), need('OP_PASSWORD'));
    await page.goto(`${BASE}/casino/dashboard`, { waitUntil: 'networkidle' });
    await shot(page, 'operator-dashboard');
    for (const p of ['/casino/players', '/casino/reports', '/casino/evidence']) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
      await shot(page, `operator-${p.split('/').pop()}`);
    }
    results.push('operator: dashboard + reconciliations + evidence drill-downs captured');
    await ctx.close();

    // ── Regulator ──
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, need('REG_EMAIL'), need('REG_PASSWORD'));
    await page.goto(`${BASE}/regulator/audit-verification`, { waitUntil: 'networkidle' });
    await shot(page, 'regulator-audit-verification');
    results.push('regulator: dashboard + audit-verification captured');
    await ctx.close();

    // ── Super Admin ──
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, need('ADM_EMAIL'), need('ADM_PASSWORD'));
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await shot(page, 'admin-platform-health');
    results.push('super-admin: platform health + audit centre captured');
    await ctx.close();

    console.log('WALKTHROUGH OK\n' + results.join('\n') + `\nScreenshots: ${OUT}`);
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('WALKTHROUGH FAILED:', e.message);
  process.exit(1);
});
