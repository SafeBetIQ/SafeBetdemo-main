// Confirm the Live Casino Feed "Active Players" equals the Operator Dashboard
// "Players active now" (certified active-now) for every casino — and that the
// Live Feed no longer shows the observed total as the active number.
//   node deploy/e2e/.env... use --env-file; runs via secure one-click login.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
const CASINOS = ['Prestige Casino', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace'];

// Read the numeric value rendered immediately above a given label text.
const valueForLabel = (label) => `(() => {
  const els = [...document.querySelectorAll('div')].filter(d => d.textContent.trim() === ${JSON.stringify(label)});
  if (!els.length) return null;
  const v = els[0].previousElementSibling;
  return v ? v.textContent.replace(/[^0-9.]/g,'') : null;
})()`;

const browser = await chromium.launch();
let allOk = true;
try {
  for (let i = 0; i < CASINOS.length; i++) {
    const name = CASINOS[i];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Enter Casino Demo' }).nth(i).click();
    await page.waitForURL('**/casino/**', { timeout: 30000 });
    // Operator dashboard active-now + observed
    await page.goto(`${BASE}/casino/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const dashActive = await page.evaluate(valueForLabel('Players active now'));
    // Live feed active + it must expose observed as sub
    await page.goto(`${BASE}/casino/live-feed`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const feedActive = await page.evaluate(valueForLabel('Active Players'));
    const feedText = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(OUT, `livefeed-${i}-${name.split(' ')[0].toLowerCase()}.png`), fullPage: true });
    const showsObserved = /observed/i.test(feedText);
    const match = dashActive !== null && feedActive !== null && dashActive === feedActive;
    console.log(`${name}: dashActiveNow=${dashActive} feedActivePlayers=${feedActive} match=${match} feedShowsObserved=${showsObserved}`);
    if (!match || !showsObserved) allOk = false;
    await ctx.close();
  }
  console.log(allOk ? '\nLIVE FEED == DASHBOARD ACTIVE-NOW for all six casinos ✓' : '\nMISMATCH DETECTED');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
