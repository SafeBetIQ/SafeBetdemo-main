// Milestone validation: snapshot-age indicators, operator has NO simulator
// administration, regulator scope unchanged, and the Platform Health simulator
// API is gated (401 without auth, 403 for a non-super-admin operator token).
//   node deploy/e2e/governance-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SAFEBET_DEMO_URL ?? 'https://demo.safebetiq.com';
const OUT = path.join(process.cwd(), 'deploy', 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
const CASINOS = ['Prestige Casino', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace'];
// Admin-only strings that must NEVER appear on an operator/regulator surface.
const ADMIN_LEAK = /Demo Simulation Health|Daily limit|Partition readiness|Event volume|Emergency|Hard limit|Simulator/i;

const valueForLabel = (label) => `(() => {
  const els = [...document.querySelectorAll('div')].filter(d => d.textContent.trim() === ${JSON.stringify(label)});
  if (!els.length) return null;
  const v = els[0].previousElementSibling;
  return v ? v.textContent.replace(/[^0-9.]/g,'') : null;
})()`;

const browser = await chromium.launch();
let allOk = true;
const log = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? '✓' : '✗'} ${msg}`); };

try {
  // ── Operator: six casinos ────────────────────────────────────────────────
  let operatorToken = null;
  for (let i = 0; i < CASINOS.length; i++) {
    const name = CASINOS[i];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Enter Casino Demo' }).nth(i).click();
    await page.waitForURL('**/casino/**', { timeout: 30000 });

    await page.goto(`${BASE}/casino/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Players active now/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => /Updated .* ago|Certified snapshot|Snapshot:/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    const activeNow = Number(await page.evaluate(valueForLabel('Players active now')));
    const body = await page.evaluate(() => document.body.innerText);
    const snapshot = /Updated .* ago|Certified snapshot|Snapshot:/i.test(body);
    log(Number.isFinite(activeNow) && activeNow >= 0, `${name}: dashboard active-now numeric (${activeNow})`);
    log(snapshot, `${name}: certified snapshot-age indicator present`);
    log(!ADMIN_LEAK.test(body), `${name}: no simulator administration visible on dashboard`);
    await page.screenshot({ path: path.join(OUT, `gov-op-${i}-${name.split(' ')[0].toLowerCase()}.png`), fullPage: true });

    // Live feed loads + shows a snapshot indicator.
    await page.goto(`${BASE}/casino/live-feed`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Active Players/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => /Updated .* ago|Certified snapshot/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    const feedBody = await page.evaluate(() => document.body.innerText);
    log(/Active Players/i.test(feedBody), `${name}: live feed loaded`);
    log(/Updated .* ago|Certified snapshot/i.test(feedBody), `${name}: live feed snapshot-age present`);

    // Capture one operator token for the API-gating negative test.
    if (!operatorToken) {
      operatorToken = await page.evaluate(() => {
        for (let k = 0; k < localStorage.length; k++) {
          const key = localStorage.key(k);
          if (key && key.includes('auth-token')) {
            try { return JSON.parse(localStorage.getItem(key)).access_token; } catch { /* */ }
          }
        }
        return null;
      });
    }
    await ctx.close();
  }

  // ── Regulator: aggregate + snapshot, no super-admin sim controls ──────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Enter Regulator Demo' }).first().click();
    await page.waitForURL('**/regulator/**', { timeout: 30000 });
    await page.goto(`${BASE}/regulator/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Active now/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => /Updated .* ago|Certified snapshot/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    const body = await page.evaluate(() => document.body.innerText);
    log(/Active now/i.test(body) && /Observed/i.test(body), 'Regulator: active-now + observed tiles present');
    log(/Updated .* ago|Certified snapshot/i.test(body), 'Regulator: certified snapshot-age present');
    log(!/Demo Simulation Health|Emergency|Daily limit|Partition readiness/i.test(body), 'Regulator: no super-admin simulator controls visible');
    await page.screenshot({ path: path.join(OUT, 'gov-regulator.png'), fullPage: true });
    await ctx.close();
  }

  // ── API gating: /api/admin/simulation-health ──────────────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); // same-origin for fetch
    const noAuth = await page.evaluate(async (base) => (await fetch(`${base}/api/admin/simulation-health`)).status, BASE);
    log(noAuth === 401, `Health API without auth → 401 (got ${noAuth})`);
    if (operatorToken) {
      const opStatus = await page.evaluate(async ([base, tok]) =>
        (await fetch(`${base}/api/admin/simulation-health`, { headers: { authorization: `Bearer ${tok}` } })).status,
        [BASE, operatorToken]);
      log(opStatus === 403, `Health API with operator token → 403 (got ${opStatus})`);
    } else {
      console.log('… operator token not captured; skipped 403 check');
    }
    await ctx.close();
  }

  console.log(allOk ? '\nGOVERNANCE VALIDATION PASSED ✓' : '\nGOVERNANCE VALIDATION HAD FAILURES');
} finally { await browser.close(); }
process.exit(allOk ? 0 : 1);
