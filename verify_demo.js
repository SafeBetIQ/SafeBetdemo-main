// SafeBet IQ Demo Site Verification Script
// Tests all 10 workflow areas against https://demo.safebetiq.com

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://demo.safebetiq.com';
const SCREENSHOTS_DIR = path.join(__dirname, 'verify_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CREDENTIALS = {
  superAdmin: { email: 'admin@safebetiq.com', password: 'Admin@SafeBet1' },
  casino: { email: 'demo.casino@safebetiq.com', password: 'Casino@Demo1' },
  regulator: { email: 'demo.regulator@safebetiq.com', password: 'Regulator@Demo1' },
};

const results = [];

function log(area, status, note) {
  const entry = { area, status, note };
  results.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${area}: ${note}`);
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function login(page, creds, label) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Check for demo credential buttons first
  const credButtons = await page.locator('button').filter({ hasText: creds.email }).count();
  if (credButtons > 0) {
    await page.locator('button').filter({ hasText: creds.email }).first().click();
    await page.waitForTimeout(500);
  } else {
    // Fill form manually
    await page.fill('input[type="email"], input[name="email"]', creds.email);
    await page.fill('input[type="password"], input[name="password"]', creds.password);
  }

  // Click login button
  const loginBtn = page.locator('button[type="submit"], button').filter({ hasText: /sign in|log in|login/i }).first();
  await loginBtn.click();

  // Wait for navigation
  await page.waitForTimeout(3000);
  const url = page.url();
  return url;
}

async function checkPageLoaded(page, route, expectedContent, screenshotName) {
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    const title = await page.title();
    const bodyText = await page.locator('body').innerText().catch(() => '');

    // Check for error states
    const has404 = bodyText.includes('404') || bodyText.includes('not found') || title.includes('404');
    const has500 = bodyText.includes('500') || bodyText.includes('Internal Server Error');
    const hasError = bodyText.toLowerCase().includes('application error') || bodyText.toLowerCase().includes('something went wrong');
    const redirectedToLogin = url.includes('/login');

    if (screenshotName) await screenshot(page, screenshotName);

    return { url, title, bodyText, has404, has500, hasError, redirectedToLogin };
  } catch (err) {
    return { url: '', title: '', bodyText: '', has404: false, has500: false, hasError: true, redirectedToLogin: false, error: err.message };
  }
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function run() {
  console.log('\n=== SafeBet IQ Demo Site Verification ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  try {
    // ─── AREA 1: HOMEPAGE ───────────────────────────────────────────────────────
    console.log('\n--- 1. HOMEPAGE ---');
    const homePage = await browser.newPage();
    homePage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`HOME: ${msg.text()}`); });

    try {
      await homePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await homePage.waitForTimeout(2000);
      const homeText = await homePage.locator('body').innerText().catch(() => '');
      const homeTitle = await homePage.title();
      await screenshot(homePage, '01_homepage');

      const hasBranding = homeText.includes('SafeBet') || homeTitle.includes('SafeBet');
      const hasNav = await homePage.locator('nav, header').count() > 0;

      // Check About link
      const aboutLink = await homePage.locator('a[href="/about"]').count();
      const wrongAboutLink = await homePage.locator('a[href="/contact"]').filter({ hasText: /about/i }).count();

      if (hasBranding && hasNav) {
        log('1. HOMEPAGE', 'PASS', `Title: "${homeTitle}" — branding present, nav present`);
      } else {
        log('1. HOMEPAGE', 'WARN', `Title: "${homeTitle}" — branding: ${hasBranding}, nav: ${hasNav}`);
      }

      if (aboutLink > 0 && wrongAboutLink === 0) {
        log('1a. About Link', 'PASS', '/about link found in nav');
      } else if (wrongAboutLink > 0) {
        log('1a. About Link', 'FAIL', 'About link points to /contact instead of /about');
      } else {
        log('1a. About Link', 'WARN', 'No /about link found in nav');
      }
    } catch (err) {
      log('1. HOMEPAGE', 'FAIL', `Error: ${err.message}`);
    }
    await homePage.close();

    // ─── AREA 2: ABOUT PAGE ─────────────────────────────────────────────────────
    console.log('\n--- 2. ABOUT PAGE ---');
    const aboutPage = await browser.newPage();
    try {
      const aboutResult = await checkPageLoaded(aboutPage, '/about', 'SafeBet', '02_about');
      if (aboutResult.redirectedToLogin) {
        log('2. ABOUT PAGE', 'WARN', 'Redirected to /login — page requires auth');
      } else if (aboutResult.has404 || aboutResult.has500 || aboutResult.hasError) {
        log('2. ABOUT PAGE', 'FAIL', `Error state — title: "${aboutResult.title}"`);
      } else {
        const hasContent = aboutResult.bodyText.length > 200;
        log('2. ABOUT PAGE', hasContent ? 'PASS' : 'WARN', `Title: "${aboutResult.title}", content length: ${aboutResult.bodyText.length}`);
      }
    } catch (err) {
      log('2. ABOUT PAGE', 'FAIL', err.message);
    }
    await aboutPage.close();

    // ─── AREA 3: LOGIN — SUPER ADMIN ────────────────────────────────────────────
    console.log('\n--- 3. LOGIN (Super Admin) ---');
    const adminPage = await browser.newPage();
    adminPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`ADMIN: ${msg.text()}`); });

    let adminLoggedIn = false;
    try {
      await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await screenshot(adminPage, '03_login_page');

      // Look for demo credential buttons
      const pageContent = await adminPage.locator('body').innerText();
      console.log('  Login page loaded, checking for demo credential buttons...');

      // Try clicking the admin credential button if visible
      const adminBtn = adminPage.locator('button, div[role="button"]').filter({ hasText: /admin@safebetiq\.com|SafeBet IQ Administrator/i });
      const adminBtnCount = await adminBtn.count();

      if (adminBtnCount > 0) {
        await adminBtn.first().click();
        await adminPage.waitForTimeout(1000);
        console.log('  Clicked admin credential button');
      } else {
        // Manual fill
        await adminPage.fill('input[type="email"]', CREDENTIALS.superAdmin.email).catch(() => {});
        await adminPage.fill('input[type="password"]', CREDENTIALS.superAdmin.password).catch(() => {});
      }

      // Submit
      const submitBtn = adminPage.locator('button[type="submit"]').first();
      await submitBtn.click();
      await adminPage.waitForTimeout(4000);
      await screenshot(adminPage, '03_after_login_admin');

      const afterUrl = adminPage.url();
      const afterText = await adminPage.locator('body').innerText().catch(() => '');

      if (afterUrl.includes('/login')) {
        // Check for error message
        const hasError = afterText.toLowerCase().includes('invalid') || afterText.toLowerCase().includes('incorrect') || afterText.toLowerCase().includes('error');
        log('3. LOGIN (Super Admin)', 'FAIL', `Still on login page after attempt — error: ${hasError}. URL: ${afterUrl}`);
      } else if (afterUrl.includes('/dashboard') || afterUrl.includes('/admin') || afterUrl.includes('/casino')) {
        adminLoggedIn = true;
        log('3. LOGIN (Super Admin)', 'PASS', `Redirected to: ${afterUrl}`);
      } else {
        adminLoggedIn = true;
        log('3. LOGIN (Super Admin)', 'WARN', `Redirected to unexpected URL: ${afterUrl}`);
      }
    } catch (err) {
      log('3. LOGIN (Super Admin)', 'FAIL', err.message);
    }

    // ─── AREA 4: CASINO FLOWS (as Casino user for more targeted test) ───────────
    console.log('\n--- 4. CASINO ROLE FLOWS ---');
    const casinoPage = await browser.newPage();
    casinoPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`CASINO: ${msg.text()}`); });

    let casinoLoggedIn = false;
    try {
      await casinoPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

      // Try demo credential button
      const casinoBtn = casinoPage.locator('button, div[role="button"]').filter({ hasText: /demo\.casino|Prestige Casino/i });
      const casinoBtnCount = await casinoBtn.count();

      if (casinoBtnCount > 0) {
        await casinoBtn.first().click();
        await casinoPage.waitForTimeout(1000);
      } else {
        await casinoPage.fill('input[type="email"]', CREDENTIALS.casino.email).catch(() => {});
        await casinoPage.fill('input[type="password"]', CREDENTIALS.casino.password).catch(() => {});
      }

      await casinoPage.locator('button[type="submit"]').first().click();
      await casinoPage.waitForTimeout(4000);

      const casinoUrl = casinoPage.url();
      if (!casinoUrl.includes('/login')) {
        casinoLoggedIn = true;
        log('4. Casino Login', 'PASS', `Redirected to: ${casinoUrl}`);
      } else {
        log('4. Casino Login', 'FAIL', `Still on login. URL: ${casinoUrl}`);
      }
    } catch (err) {
      log('4. Casino Login', 'FAIL', err.message);
    }

    if (casinoLoggedIn) {
      // 4a. Casino Dashboard
      try {
        const dashResult = await checkPageLoaded(casinoPage, '/casino/dashboard', '', '04a_casino_dashboard');
        if (dashResult.redirectedToLogin) {
          log('4a. Casino Dashboard', 'FAIL', 'Redirected to login');
        } else if (dashResult.has404 || dashResult.has500 || dashResult.hasError) {
          log('4a. Casino Dashboard', 'FAIL', `Error state — title: "${dashResult.title}"`);
        } else {
          const hasData = dashResult.bodyText.length > 300;
          log('4a. Casino Dashboard', hasData ? 'PASS' : 'WARN', `Loaded, content: ${dashResult.bodyText.length} chars`);
        }
      } catch (err) {
        log('4a. Casino Dashboard', 'FAIL', err.message);
      }

      // 4b. Player List
      try {
        const playersResult = await checkPageLoaded(casinoPage, '/casino/players', '', '04b_casino_players');
        if (playersResult.redirectedToLogin) {
          log('4b. Casino Players', 'FAIL', 'Redirected to login');
        } else if (playersResult.has404 || playersResult.has500 || playersResult.hasError) {
          log('4b. Casino Players', 'FAIL', `Error state`);
        } else {
          log('4b. Casino Players', 'PASS', `Loaded — ${playersResult.title}`);

          // Try to click a player to get investigation URL
          try {
            const playerLinks = await casinoPage.locator('a[href*="/casino/players/"]').all();
            if (playerLinks.length > 0) {
              const firstHref = await playerLinks[0].getAttribute('href');
              console.log(`  Found player link: ${firstHref}`);

              // 4c. Investigation page
              const investigateUrl = firstHref.includes('/investigate') ? firstHref : `${firstHref}/investigate`;
              const invResult = await checkPageLoaded(casinoPage, investigateUrl, '', '04c_investigate');

              const invText = invResult.bodyText;
              const hasRiskPanel = invText.toLowerCase().includes('risk') || invText.toLowerCase().includes('ai') || invText.toLowerCase().includes('reasoning');
              const hasTimeline = invText.toLowerCase().includes('timeline') || invText.toLowerCase().includes('session');
              const hasAudit = invText.toLowerCase().includes('audit') || invText.toLowerCase().includes('sha') || invText.toLowerCase().includes('hash');

              if (invResult.has404 || invResult.has500 || invResult.hasError || invResult.redirectedToLogin) {
                log('4c. Investigation Page', 'FAIL', `Error state or auth redirect. URL: ${invResult.url}`);
              } else {
                const score = [hasRiskPanel, hasTimeline, hasAudit].filter(Boolean).length;
                log('4c. Investigation Page', score >= 2 ? 'PASS' : 'WARN',
                  `Loaded — Risk panel: ${hasRiskPanel}, Timeline: ${hasTimeline}, Audit: ${hasAudit}`);
              }
            } else {
              log('4c. Investigation Page', 'WARN', 'No player links found on players page');
            }
          } catch (err) {
            log('4c. Investigation Page', 'FAIL', err.message);
          }
        }
      } catch (err) {
        log('4b. Casino Players', 'FAIL', err.message);
      }

      // 4d. AI Intelligence
      try {
        const aiResult = await checkPageLoaded(casinoPage, '/casino/ai-intelligence', '', '04d_ai_intelligence');
        if (aiResult.redirectedToLogin) log('4d. AI Intelligence', 'FAIL', 'Redirected to login');
        else if (aiResult.has404 || aiResult.has500 || aiResult.hasError) log('4d. AI Intelligence', 'FAIL', 'Error state');
        else log('4d. AI Intelligence', 'PASS', `Loaded — ${aiResult.title}`);
      } catch (err) {
        log('4d. AI Intelligence', 'FAIL', err.message);
      }

      // 4e. Interventions
      try {
        const intResult = await checkPageLoaded(casinoPage, '/casino/interventions', '', '04e_interventions');
        if (intResult.redirectedToLogin) log('4e. Interventions', 'FAIL', 'Redirected to login');
        else if (intResult.has404 || intResult.has500 || intResult.hasError) log('4e. Interventions', 'FAIL', 'Error state');
        else log('4e. Interventions', 'PASS', `Loaded — ${intResult.title}`);
      } catch (err) {
        log('4e. Interventions', 'FAIL', err.message);
      }

      // 4f. Live Feed
      try {
        const liveResult = await checkPageLoaded(casinoPage, '/casino/live-feed', '', '04f_live_feed');
        if (liveResult.redirectedToLogin) log('4f. Live Feed', 'FAIL', 'Redirected to login');
        else if (liveResult.has404 || liveResult.has500 || liveResult.hasError) log('4f. Live Feed', 'FAIL', 'Error state');
        else log('4f. Live Feed', 'PASS', `Loaded — ${liveResult.title}`);
      } catch (err) {
        log('4f. Live Feed', 'FAIL', err.message);
      }
    }
    await casinoPage.close();

    // ─── AREA 5: AUDIT CENTRE ────────────────────────────────────────────────────
    console.log('\n--- 5. AUDIT CENTRE ---');
    // Re-use admin session or open new page
    const auditPage = await browser.newPage();
    try {
      // Login as admin for audit centre
      await auditPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const adminBtn2 = auditPage.locator('button, div[role="button"]').filter({ hasText: /admin@safebetiq\.com|SafeBet IQ Administrator/i });
      if (await adminBtn2.count() > 0) {
        await adminBtn2.first().click();
        await auditPage.waitForTimeout(1000);
      } else {
        await auditPage.fill('input[type="email"]', CREDENTIALS.superAdmin.email).catch(() => {});
        await auditPage.fill('input[type="password"]', CREDENTIALS.superAdmin.password).catch(() => {});
      }
      await auditPage.locator('button[type="submit"]').first().click();
      await auditPage.waitForTimeout(3000);

      const auditResult = await checkPageLoaded(auditPage, '/admin/audit', '', '05_audit_centre');

      if (auditResult.redirectedToLogin) {
        log('5. Audit Centre', 'FAIL', 'Redirected to login — auth issue');
      } else if (auditResult.has404 || auditResult.has500 || auditResult.hasError) {
        log('5. Audit Centre', 'FAIL', `Error state — title: "${auditResult.title}"`);
      } else {
        const auditText = auditResult.bodyText;
        const hasTable = await auditPage.locator('table, [role="table"], [class*="table"]').count() > 0;
        const hasSha = auditText.includes('SHA') || auditText.includes('sha') || auditText.includes('hash') || auditText.includes('Hash');
        const hasExport = await auditPage.locator('button, a').filter({ hasText: /export/i }).count() > 0;
        const hasFilter = await auditPage.locator('input[type="date"], select, [class*="filter"]').count() > 0;

        log('5. Audit Centre', hasTable ? 'PASS' : 'WARN',
          `Table: ${hasTable}, SHA hashes: ${hasSha}, Export btn: ${hasExport}, Filter: ${hasFilter}`);

        if (hasExport) log('5a. Audit Export', 'PASS', 'Export button found');
        else log('5a. Audit Export', 'WARN', 'Export button not found');

        if (hasFilter) log('5b. Audit Filter', 'PASS', 'Filter controls found');
        else log('5b. Audit Filter', 'WARN', 'Filter controls not found');
      }
    } catch (err) {
      log('5. Audit Centre', 'FAIL', err.message);
    }
    await auditPage.close();

    // ─── AREA 6: EVIDENCE PACK ───────────────────────────────────────────────────
    console.log('\n--- 6. EVIDENCE PACK ---');
    const evidencePage = await browser.newPage();
    try {
      await evidencePage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const casinoBtn2 = evidencePage.locator('button, div[role="button"]').filter({ hasText: /demo\.casino|Prestige Casino/i });
      if (await casinoBtn2.count() > 0) {
        await casinoBtn2.first().click();
        await evidencePage.waitForTimeout(1000);
      } else {
        await evidencePage.fill('input[type="email"]', CREDENTIALS.casino.email).catch(() => {});
        await evidencePage.fill('input[type="password"]', CREDENTIALS.casino.password).catch(() => {});
      }
      await evidencePage.locator('button[type="submit"]').first().click();
      await evidencePage.waitForTimeout(3000);

      // Navigate to players and get first player
      await evidencePage.goto(`${BASE_URL}/casino/players`, { waitUntil: 'networkidle', timeout: 30000 });
      await evidencePage.waitForTimeout(2000);

      const playerLinks = await evidencePage.locator('a[href*="/casino/players/"]').all();
      if (playerLinks.length > 0) {
        const firstHref = await playerLinks[0].getAttribute('href');
        const investigateUrl = firstHref.includes('/investigate') ? firstHref : `${firstHref}/investigate`;

        await evidencePage.goto(`${BASE_URL}${investigateUrl}`, { waitUntil: 'networkidle', timeout: 30000 });
        await evidencePage.waitForTimeout(2000);
        await screenshot(evidencePage, '06_evidence_pack');

        const exportBtn = evidencePage.locator('button, a').filter({ hasText: /export|evidence|print/i });
        const exportCount = await exportBtn.count();

        if (exportCount > 0) {
          log('6. Evidence Pack', 'PASS', `Export/Evidence button found (${exportCount} matches)`);
        } else {
          log('6. Evidence Pack', 'WARN', 'No Export Evidence Pack button found on investigation page');
        }
      } else {
        log('6. Evidence Pack', 'WARN', 'Could not navigate to investigation page — no player links');
      }
    } catch (err) {
      log('6. Evidence Pack', 'FAIL', err.message);
    }
    await evidencePage.close();

    // ─── AREA 7: REPORTS ─────────────────────────────────────────────────────────
    console.log('\n--- 7. REPORTS ---');
    const reportsPage = await browser.newPage();
    try {
      // Login as casino
      await reportsPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const casinoBtn3 = reportsPage.locator('button, div[role="button"]').filter({ hasText: /demo\.casino|Prestige Casino/i });
      if (await casinoBtn3.count() > 0) {
        await casinoBtn3.first().click();
        await reportsPage.waitForTimeout(1000);
      } else {
        await reportsPage.fill('input[type="email"]', CREDENTIALS.casino.email).catch(() => {});
        await reportsPage.fill('input[type="password"]', CREDENTIALS.casino.password).catch(() => {});
      }
      await reportsPage.locator('button[type="submit"]').first().click();
      await reportsPage.waitForTimeout(3000);

      // Casino reports
      const casinoReportsResult = await checkPageLoaded(reportsPage, '/casino/reports', '', '07a_casino_reports');
      if (casinoReportsResult.redirectedToLogin) log('7a. Casino Reports', 'FAIL', 'Redirected to login');
      else if (casinoReportsResult.has404 || casinoReportsResult.has500 || casinoReportsResult.hasError) log('7a. Casino Reports', 'FAIL', 'Error state');
      else log('7a. Casino Reports', 'PASS', `Loaded — ${casinoReportsResult.title}`);

      // Regulator reports (may need re-login)
      await reportsPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const regBtn = reportsPage.locator('button, div[role="button"]').filter({ hasText: /demo\.regulator|National Gambling/i });
      if (await regBtn.count() > 0) {
        await regBtn.first().click();
        await reportsPage.waitForTimeout(1000);
      } else {
        await reportsPage.fill('input[type="email"]', CREDENTIALS.regulator.email).catch(() => {});
        await reportsPage.fill('input[type="password"]', CREDENTIALS.regulator.password).catch(() => {});
      }
      await reportsPage.locator('button[type="submit"]').first().click();
      await reportsPage.waitForTimeout(3000);

      const regReportsResult = await checkPageLoaded(reportsPage, '/regulator/reports', '', '07b_regulator_reports');
      if (regReportsResult.redirectedToLogin) log('7b. Regulator Reports', 'FAIL', 'Redirected to login');
      else if (regReportsResult.has404 || regReportsResult.has500 || regReportsResult.hasError) log('7b. Regulator Reports', 'FAIL', 'Error state');
      else log('7b. Regulator Reports', 'PASS', `Loaded — ${regReportsResult.title}`);
    } catch (err) {
      log('7. Reports', 'FAIL', err.message);
    }
    await reportsPage.close();

    // ─── AREA 8: LOGOUT ──────────────────────────────────────────────────────────
    console.log('\n--- 8. LOGOUT ---');
    const logoutPage = await browser.newPage();
    try {
      await logoutPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const casinoBtn4 = logoutPage.locator('button, div[role="button"]').filter({ hasText: /demo\.casino|Prestige Casino/i });
      if (await casinoBtn4.count() > 0) {
        await casinoBtn4.first().click();
        await logoutPage.waitForTimeout(1000);
      } else {
        await logoutPage.fill('input[type="email"]', CREDENTIALS.casino.email).catch(() => {});
        await logoutPage.fill('input[type="password"]', CREDENTIALS.casino.password).catch(() => {});
      }
      await logoutPage.locator('button[type="submit"]').first().click();
      await logoutPage.waitForTimeout(3000);

      // Find logout button
      const logoutBtn = logoutPage.locator('button, a').filter({ hasText: /logout|sign out|log out/i });
      const logoutCount = await logoutBtn.count();

      if (logoutCount > 0) {
        await logoutBtn.first().click();
        await logoutPage.waitForTimeout(3000);
        await screenshot(logoutPage, '08_after_logout');

        const afterLogoutUrl = logoutPage.url();
        if (afterLogoutUrl.includes('/login') || afterLogoutUrl === BASE_URL + '/' || afterLogoutUrl === BASE_URL) {
          log('8. Logout', 'PASS', `Redirected to: ${afterLogoutUrl}`);
        } else {
          log('8. Logout', 'WARN', `Logout clicked but redirected to unexpected URL: ${afterLogoutUrl}`);
        }
      } else {
        log('8. Logout', 'WARN', 'No logout button found on page');
      }
    } catch (err) {
      log('8. Logout', 'FAIL', err.message);
    }
    await logoutPage.close();

    // ─── AREA 9: REGULATOR ROLE ──────────────────────────────────────────────────
    console.log('\n--- 9. REGULATOR ROLE ---');
    const regPage = await browser.newPage();
    try {
      await regPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const regBtn2 = regPage.locator('button, div[role="button"]').filter({ hasText: /demo\.regulator|National Gambling/i });
      if (await regBtn2.count() > 0) {
        await regBtn2.first().click();
        await regPage.waitForTimeout(1000);
      } else {
        await regPage.fill('input[type="email"]', CREDENTIALS.regulator.email).catch(() => {});
        await regPage.fill('input[type="password"]', CREDENTIALS.regulator.password).catch(() => {});
      }
      await regPage.locator('button[type="submit"]').first().click();
      await regPage.waitForTimeout(4000);
      await screenshot(regPage, '09_after_regulator_login');

      const regUrl = regPage.url();
      if (regUrl.includes('/login')) {
        log('9. Regulator Login', 'FAIL', `Still on login page. URL: ${regUrl}`);
      } else {
        log('9. Regulator Login', 'PASS', `Redirected to: ${regUrl}`);

        // Check regulator dashboard
        const regDashResult = await checkPageLoaded(regPage, '/regulator/dashboard', '', '09b_regulator_dashboard');
        if (regDashResult.redirectedToLogin) log('9a. Regulator Dashboard', 'FAIL', 'Redirected to login');
        else if (regDashResult.has404 || regDashResult.has500 || regDashResult.hasError) log('9a. Regulator Dashboard', 'FAIL', 'Error state');
        else log('9a. Regulator Dashboard', 'PASS', `Loaded — ${regDashResult.title}`);
      }
    } catch (err) {
      log('9. Regulator Role', 'FAIL', err.message);
    }
    await regPage.close();

  } finally {
    await browser.close();
  }

  // ─── AREA 10: CONSOLE ERRORS SUMMARY ─────────────────────────────────────────
  console.log('\n--- 10. CONSOLE ERRORS ---');
  if (consoleErrors.length === 0) {
    log('10. Console Errors', 'PASS', 'No console errors captured');
  } else {
    log('10. Console Errors', 'WARN', `${consoleErrors.length} console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  }

  // ─── FINAL REPORT ─────────────────────────────────────────────────────────────
  console.log('\n\n=== VERIFICATION REPORT ===');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}\n`);

  const passes = results.filter(r => r.status === 'PASS').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  const fails = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.status.padEnd(4)} | ${r.area.padEnd(35)} | ${r.note}`);
  });

  console.log(`\nSummary: ${passes} PASS, ${warns} WARN, ${fails} FAIL`);

  // Write results JSON
  fs.writeFileSync(
    path.join(__dirname, 'verify_results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results, consoleErrors }, null, 2)
  );
  console.log('\nResults saved to verify_results.json');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
