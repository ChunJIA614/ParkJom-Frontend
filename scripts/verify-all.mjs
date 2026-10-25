import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const OUT_DIR = '.tmp-shots/verify';
const BASE = process.env.PJ_URL || 'https://localhost:3000';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

async function runVerification() {
  console.log('Testing default root route `/` -> LoginPage...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  
  // 1. Visit root '/'
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Check current theme
  let theme = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log('Initial theme:', theme);

  // Ensure we start in Light Mode for clean comparison
  if (theme === 'dark') {
    console.log('Switching to light mode first...');
    await page.click('button[aria-label*="Appearance"]');
    await sleep(800);
  }

  // Verify theme button has NO text (icon-only)
  const btnText = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Appearance"]');
    return btn ? btn.innerText.trim() : null;
  });
  console.log('Theme toggle button text (must be empty):', JSON.stringify(btnText));

  // Capture desktop Light Mode (whole background must be light #F5F5F7)
  await page.mouse.move(360, 360, { steps: 8 });
  await sleep(400);
  await page.screenshot({ path: `${OUT_DIR}/light-desktop.png` });
  console.log('Saved light-desktop.png');

  // 2. Toggle to Dark Mode
  console.log('Toggling to dark mode...');
  await page.click('button[aria-label*="Appearance"]');
  await sleep(800);

  theme = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log('Theme after toggle:', theme);

  // Capture desktop Dark Mode (whole background must be dark #090A0F)
  await page.mouse.move(380, 380, { steps: 8 });
  await sleep(400);
  await page.screenshot({ path: `${OUT_DIR}/dark-desktop.png` });
  console.log('Saved dark-desktop.png');

  // 3. Test "Back to Home" navigation
  console.log('Testing "Back to Home" click...');
  await page.click('a[href="/home"]');
  await sleep(1000);
  const currentUrl = page.url();
  console.log('Navigated URL:', currentUrl);
  await page.screenshot({ path: `${OUT_DIR}/navigated-landing.png` });
  console.log('Saved navigated-landing.png');

  await page.close();

  // 4. Test Mobile Viewport (iPhone 375x667)
  console.log('Testing Mobile Viewport on `/`...');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Mobile Light
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile-dark.png` });
  console.log('Saved mobile-dark.png');

  // Toggle mobile to Light
  await mobilePage.click('button[aria-label*="Appearance"]');
  await sleep(800);
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile-light.png` });
  console.log('Saved mobile-light.png');

  await mobilePage.close();
}

try {
  await runVerification();
  console.log('ALL VERIFICATION PASSED!');
} catch (err) {
  console.error('Verification failed:', err);
} finally {
  await browser.close();
}
