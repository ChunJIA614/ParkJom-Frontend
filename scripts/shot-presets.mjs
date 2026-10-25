import puppeteer from 'puppeteer-core';

const OUT_DIR = '.tmp-shots/dot-wave';
const BASE = process.env.PJ_URL || 'https://localhost:3002';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(600);

// Click Purple / Indigo preset (2nd button in preset group)
const buttons = await page.$$('button[aria-label*="accent"]');
if (buttons.length > 1) {
  await buttons[1].click(); // Apple Indigo
  await sleep(400);
  await page.mouse.move(420, 360, { steps: 12 });
  await sleep(500);
  await page.screenshot({ path: `${OUT_DIR}/login-purple-hover.png` });
  console.log('Saved purple hover');
}

if (buttons.length > 2) {
  await buttons[2].click(); // Apple Emerald
  await sleep(400);
  await page.mouse.move(860, 420, { steps: 15 });
  await sleep(500);
  await page.screenshot({ path: `${OUT_DIR}/login-emerald-hover.png` });
  console.log('Saved emerald hover');
}

await browser.close();
