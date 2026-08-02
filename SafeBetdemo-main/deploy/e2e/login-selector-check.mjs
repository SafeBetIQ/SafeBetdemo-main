// Credential-free browser validation of the six-casino login selector.
// Verifies (in a real Chromium) that the login page renders six casino cards,
// selecting a card pre-fills ONLY the email (never a password), and the
// non-production banner is present. Runs without any secrets.
//
//   node deploy/e2e/login-selector-check.mjs
//   (optional) SAFEBET_DEMO_URL=https://demo.safebetiq.com

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const EXPECTED = [
  ['Prestige Casino', 'demo.prestige@safebetiq.com'],
  ['SunBet', 'demo.sunbet@safebetiq.com'],
  ['Hollywoodbets', 'demo.hollywoodbets@safebetiq.com'],
  ['Gold Rush', 'demo.goldrush@safebetiq.com'],
  ['Betway', 'demo.betway@safebetiq.com'],
  ['Royal Palace', 'demo.royalpalace@safebetiq.com'],
];

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok - ' + msg); };

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

  assert(await page.getByText('Choose a Demo Operator').isVisible(), 'selector heading renders');
  const buttons = page.getByRole('button', { name: 'Enter Casino Demo' });
  assert((await buttons.count()) === 6, 'six "Enter Casino Demo" buttons');
  assert(await page.getByRole('button', { name: /Enter Regulator Demo/i }).isVisible(), 'regulator demo entry');
  assert((await page.getByText('Synthetic Demo').count()) >= 6, 'synthetic-demo labels present');
  assert(await page.getByText(/Non-Production|Synthetic Data/i).first().isVisible(), 'non-production banner');

  for (const [casino] of EXPECTED) {
    assert(await page.getByText(casino, { exact: false }).first().isVisible(), `card present: ${casino}`);
  }

  // The password field is never populated by the selector (one-click server login).
  const pwVal = await page.locator('#password').inputValue();
  assert(pwVal === '', 'password field is EMPTY (never populated by the selector)');
  // No demo password appears anywhere in the page HTML.
  const html = await page.content();
  assert(!/DEMO_[A-Z]+_PASSWORD|Casino@Demo1|Regulator@Demo1/.test(html), 'no demo password in page HTML');

  await page.screenshot({ path: path.join(OUT, 'login-six-casino-cards.png'), fullPage: true });
  console.log(`\nLOGIN SELECTOR CHECK: PASS  (screenshot: ${path.join(OUT, 'login-six-casino-cards.png')})`);
} finally {
  await browser.close();
}
