/**
 * Dark-mode dashboard audit helper.
 *
 * Seeds a fake commuter session so the dashboard routes render without a real
 * login, then captures the transit panel in dark mode.
 *
 * Usage: node scripts/shot-dark-dashboard.mjs <outDir> [baseUrl]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT_DIR = process.argv[2] || 'shots-dark';
const BASE = process.argv[3] || process.env.PJ_URL || 'https://localhost:3002';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAKE_USER = {
  userId: 999999,
  email: 'audit@parkjom.test',
  firstName: 'Audit',
  lastName: 'User',
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

await mkdir(OUT_DIR, { recursive: true });

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.evaluateOnNewDocument((user) => {
  try {
    window.localStorage.setItem('parkjom-theme', 'dark');
    window.localStorage.setItem('parkjom_user', JSON.stringify(user));
  } catch {
    /* ignore */
  }
}, FAKE_USER);

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [console]', msg.text().slice(0, 160));
});

// The fake session has no real token, so stub every non-GTFS API call with an
// empty success payload. A 401 would trip AUTH_REJECTED_EVENT and log us out.
await page.setRequestInterception(true);
page.on('request', (req) => {
  const { pathname } = new URL(req.url());
  if (!pathname.startsWith('/api/') || pathname.startsWith('/api/gtfs/')) {
    req.continue().catch(() => {});
    return;
  }
  req
    .respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, message: 'audit stub', data: [] }),
    })
    .catch(() => {});
});

await page.goto(`${BASE}/commuter`, { waitUntil: 'networkidle2', timeout: 90000 });
await sleep(4000);
await page.screenshot({ path: path.join(OUT_DIR, 'commuter-dark.png') });
console.log('✓ commuter-dark.png');

// Switch to the Transit Map view, which hosts the transit explorer panel.
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button, a')).find((el) =>
    /transit map/i.test(el.textContent || ''),
  );
  btn?.click();
});
await sleep(3500);
await page.screenshot({ path: path.join(OUT_DIR, 'transit-map-dark.png') });
console.log('✓ transit-map-dark.png');

// Open the transit panel station view by clicking the first station row.
const clicked = await page.evaluate(() => {
  const panel = document.querySelector('.transit-hub-panel');
  if (!panel) return 'no-panel';
  const rows = Array.from(panel.querySelectorAll('button')).filter((b) =>
    /Sentul|KLCC|Chow Kit|Ampang|Station/i.test(b.textContent || ''),
  );
  const target = rows.find((b) => /Sentul Barat/i.test(b.textContent || '')) || rows[rows.length - 1];
  if (!target) return 'no-row';
  target.click();
  return target.textContent?.slice(0, 60) || 'clicked';
});
console.log('  clicked:', clicked);
await sleep(3500);

const panel = await page.$('.transit-hub-panel');
if (panel) {
  await panel.screenshot({ path: path.join(OUT_DIR, 'transit-panel-dark.png') });
  console.log('✓ transit-panel-dark.png');
}

// Feeders tab carries the emerald status cards.
await page.evaluate(() => {
  const panelEl = document.querySelector('.transit-hub-panel');
  Array.from(panelEl?.querySelectorAll('button') || [])
    .find((b) => /^Feeders/.test(b.textContent || ''))
    ?.click();
});
await sleep(3000);
const feeders = await page.$('.transit-hub-panel');
if (feeders) {
  await feeders.screenshot({ path: path.join(OUT_DIR, 'transit-feeders-dark.png') });
  console.log('✓ transit-feeders-dark.png');
}

// Selected feeder card uses the emerald "active" treatment.
await page.evaluate(() => {
  const card = document.querySelector(".station-feeders-widget [class*=\"cursor-pointer\"]");
  card?.click();
});
await sleep(2500);
const feedersSelected = await page.$('.station-feeders-widget');
if (feedersSelected) {
  await feedersSelected.screenshot({ path: path.join(OUT_DIR, 'transit-feeder-selected-dark.png') });
  console.log('✓ transit-feeder-selected-dark.png');
}

await page.screenshot({ path: path.join(OUT_DIR, 'commuter-dark-station.png') });
console.log('✓ commuter-dark-station.png');

await browser.close();
