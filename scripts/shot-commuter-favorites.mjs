import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const FAKE_COMMUTER = {
  userId: 999999,
  email: 'driver@parkjom.test',
  firstName: 'Commuter',
  lastName: 'User',
  picture: '',
  phoneNumber: '0123456789',
  userType: 3,
  role: 'Commuter',
  token: 'audit-token',
  isProfileComplete: true,
  accountStatus: 'Active',
};

const FAVORITE_SPOTS = [
  {
    favoriteId: 1,
    propertyId: 10,
    parkingSpotId: 901,
    parkingLabel: 'Bay B-08',
    propertyName: 'PV 9 Setapak',
    address: 'Jalan Danau Saujana, Taman Danau Kota, 53300 Kuala Lumpur',
    stationName: 'Wangsa Maju LRT',
    dailyRate: null,
    distanceToStation: 0.75,
    availabilityStatus: 'Available',
    primaryImageUrl: ''
  }
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    acceptInsecureCerts: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 }
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.includes('/favorites')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, success: true, message: 'ok', data: FAVORITE_SPOTS })
      }).catch(() => {});
      return;
    }

    if (!pathname.startsWith('/api/') || pathname.startsWith('/api/gtfs/')) {
      req.continue().catch(() => {});
      return;
    }

    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, message: 'ok', data: [] })
    }).catch(() => {});
  });

  await page.evaluateOnNewDocument((user, favs) => {
    localStorage.setItem('parkjom-theme', 'dark');
    localStorage.setItem('parkjom_user', JSON.stringify(user));
    localStorage.setItem('parkjom_commuter_favorites', JSON.stringify(favs));
  }, FAKE_COMMUTER, FAVORITE_SPOTS);

  console.log('Navigating to commuter dashboard...');
  await page.goto('https://localhost:3000/commuter', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicking Favorites in sidebar...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find(b => /Favorites/i.test(b.textContent || ''));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-favorites-card.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-favorites-card.png');

  await browser.close();
}

run().catch(err => {
  console.error('Error in commuter favorites shot:', err);
  process.exit(1);
});
