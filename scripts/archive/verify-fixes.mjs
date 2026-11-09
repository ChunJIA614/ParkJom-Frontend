import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT_DIR = '.tmp-shots/fixes';
const BASE = process.env.PJ_URL || 'https://localhost:3000';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT_DIR, { recursive: true });

const FAKE_USER = {
  userId: 999999,
  email: 'chunjia050614@gmail.com',
  firstName: 'CHAW CHUN',
  lastName: 'JIA',
  picture: '',
  phoneNumber: '0123456789',
  userType: 3,
  role: 'Commuter',
  token: 'audit-token',
  isProfileComplete: true,
  accountStatus: 'Active',
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

async function verifyAccountMenu() {
  console.log('Testing Dashboard Account Menu Appearance section...');
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    
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

    await page.goto(`${BASE}/commuter`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Open account menu
    await page.click('.workspace-header__account-button');
    await sleep(500);

    const menu = await page.$('#dashboard-account-menu');
    if (menu) {
      await menu.screenshot({ path: path.join(OUT_DIR, `account-menu-${theme}.png`) });
      console.log(`Saved account-menu-${theme}.png`);
    }

    await page.close();
  }
}

async function verifyLogin() {
  console.log('Testing Login page Google button...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, 'login-desktop.png') });
  console.log('Saved login-desktop.png');
  await page.close();

  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, 'login-mobile.png') });
  console.log('Saved login-mobile.png');
  await mobilePage.close();
}

try {
  await verifyAccountMenu();
  await verifyLogin();
  console.log('All verification finished!');
} catch (err) {
  console.error('Error during verification:', err);
} finally {
  await browser.close();
}
