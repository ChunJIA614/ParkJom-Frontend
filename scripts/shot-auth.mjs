/**
 * Captures the auth screen in both appearances (the Google button is the part
 * that used to show a white iframe block behind the pill in dark mode).
 *
 * Usage: node scripts/shot-auth.mjs <outDir> [baseUrl]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT_DIR = process.argv[2] || '.tmp-shots';
const BASE = process.argv[3] || 'https://localhost:3002';
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
await mkdir(OUT_DIR, { recursive: true });

for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('parkjom-theme', t);
  }, theme);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT_DIR, `login-${theme}.png`) });
  console.log(`✓ login-${theme}.png`);
  await page.close();
}

await browser.close();
