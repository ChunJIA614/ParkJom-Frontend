import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const OUT_DIR = '.tmp-shots/dot-wave';
const BASE = process.env.PJ_URL || 'https://localhost:3002';
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

async function capture(name, theme = 'light', moveMouse = false) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: theme },
  ]);

  await page.evaluateOnNewDocument((t) => {
    try {
      window.localStorage.setItem('parkjom-theme', t);
    } catch {}
  }, theme);

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1000); // allow canvas animation and frosted glass to settle

  if (moveMouse) {
    // Move cursor across canvas to trigger magnetic attraction and glow
    await page.mouse.move(300, 400, { steps: 10 });
    await sleep(400);
    await page.mouse.move(450, 380, { steps: 15 });
    await sleep(500);
  }

  await page.screenshot({ path: `${OUT_DIR}/${name}.png` });
  console.log(`Saved screenshot: ${OUT_DIR}/${name}.png`);
  await page.close();
}

try {
  await capture('login-light-idle', 'light', false);
  await capture('login-light-hover', 'light', true);
  await capture('login-dark-idle', 'dark', false);
  await capture('login-dark-hover', 'dark', true);
} finally {
  await browser.close();
}
