import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const OUT_DIR = '.tmp-shots/dot-wave';
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

async function captureDesktop() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Move mouse to trigger 3D magnetic attraction and hover on objects
  await page.mouse.move(400, 360, { steps: 12 });
  await sleep(600);
  await page.screenshot({ path: `${OUT_DIR}/transit-3d-desktop-hover.png` });
  console.log('Saved transit-3d-desktop-hover.png');
  await page.close();
}

async function captureMobile() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(1000);

  await page.screenshot({ path: `${OUT_DIR}/transit-3d-mobile-dark.png` });
  console.log('Saved transit-3d-mobile-dark.png');

  // Also check light mode on mobile
  await page.click('button[aria-label*="theme"]');
  await sleep(600);
  await page.screenshot({ path: `${OUT_DIR}/transit-3d-mobile-light.png` });
  console.log('Saved transit-3d-mobile-light.png');

  await page.close();
}

try {
  await captureDesktop();
  await captureMobile();
} finally {
  await browser.close();
}
