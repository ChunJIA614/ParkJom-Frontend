import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Chun Jia\\.gemini\\antigravity\\brain\\d1a7e1ac-8ab6-4201-8da1-453438b458e8';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    acceptInsecureCerts: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const parsed = new URL(req.url());
    if (parsed.pathname.startsWith('/api/')) {
      if (parsed.pathname.includes('/gtfs/')) {
        // Let GTFS fail or pass so it uses the real fallback json
        req.respond({ status: 404, body: 'Not found' }).catch(() => {});
        return;
      }
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, success: true, message: 'ok', data: [] })
      }).catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('parkjom-theme', 'dark');
    localStorage.setItem('parkjom_user', JSON.stringify({
      userId: 2,
      email: 'driver@parkjom.my',
      firstName: 'Commuter',
      lastName: 'Driver',
      role: 'Commuter',
      userType: 3,
      token: 'fake-token-commuter',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));
  });

  console.log('Navigating to Commuter Dashboard...');
  await page.goto('https://localhost:3000/commuter', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  // Click Transit Map
  console.log('Clicking Transit Map in sidebar...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const mapBtn = buttons.find(b => b.textContent?.trim().includes('Transit Map'));
    if (mapBtn) mapBtn.click();
  });
  await sleep(3000);

  // Click on a station marker on the map to trigger activeStationPopup
  console.log('Clicking station marker on map...');
  await page.evaluate(() => {
    const stationPins = Array.from(document.querySelectorAll('.custom-station-pin, .station-marker, .leaflet-marker-icon'));
    if (stationPins.length > 0) {
      // Find a station marker
      const target = stationPins.find(p => p.getAttribute('title') || p.getAttribute('aria-label') || p.className.includes('station')) || stationPins[0];
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  });
  await sleep(2000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit-commuter-map-popup-dark.png') });
  console.log('✓ audit-commuter-map-popup-dark.png');

  await browser.close();
}

run().catch(console.error);
