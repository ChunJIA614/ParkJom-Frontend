/**
 * Captures the account menu (top-right profile management) with the
 * appearance switcher, in both themes.
 *
 * Usage: node scripts/shot-account-menu.mjs <outDir> [baseUrl]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT_DIR = process.argv[2] || 'shots';
const BASE = process.argv[3] || 'https://localhost:3002';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAKE_USER = {
  userId: 999999, email: 'audit@parkjom.test', firstName: 'Audit', lastName: 'User', picture: '',
  phoneNumber: '0123456789', userType: 3, role: 'Commuter', token: 'audit-token',
  isProfileComplete: true, accountStatus: 'Active',
};

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
await mkdir(OUT_DIR, { recursive: true });

for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.evaluateOnNewDocument((user, t) => {
    localStorage.setItem('parkjom-theme', t);
    localStorage.setItem('parkjom_user', JSON.stringify(user));
  }, FAKE_USER, theme);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (!pathname.startsWith('/api/') || pathname.startsWith('/api/gtfs/')) return req.continue().catch(() => {});
    req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, success: true, data: [] }) }).catch(() => {});
  });

  await page.goto(`${BASE}/commuter`, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3000);
  await page.click('.workspace-header__account-button');
  await sleep(900);

  const menu = await page.$('.workspace-header__account-menu');
  if (menu) {
    await menu.screenshot({ path: path.join(OUT_DIR, `account-menu-${theme}.png`) });
    console.log(`✓ account-menu-${theme}.png`);
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, `account-menu-${theme}.png`) });
    console.log(`✓ (full) account-menu-${theme}.png`);
  }

  // Profile dialog (the other place the appearance control lives).
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((b) => /my profile/i.test(b.textContent || ''))?.click();
  });
  await sleep(1400);
  await page.screenshot({ path: path.join(OUT_DIR, `profile-dialog-${theme}.png`) });
  console.log(`✓ profile-dialog-${theme}.png`);
  await page.close();
}

await browser.close();
