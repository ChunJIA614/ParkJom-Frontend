import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

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
    const parsed = new URL(req.url());
    if (parsed.pathname.startsWith('/api/')) {
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
      userId: 1,
      email: 'chunjia@parkjom.my',
      firstName: 'Chun Jia',
      lastName: 'Khoo',
      role: 'Admin',
      userType: 1,
      token: 'fake',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));
  });

  // ---- 1. HEADER SEARCH DROPDOWN ----
  console.log('1. Capturing Search dropdown...');
  await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  const searchInput = await page.$('.workspace-header__search input');
  if (searchInput) {
    await searchInput.click();
    await page.type('.workspace-header__search input', 'settle', { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: '.tmp-shots/verify-search-dropdown-open.png' });
    console.log('✓ Captured .tmp-shots/verify-search-dropdown-open.png');
  }

  // ---- 2. MY PROFILE DIALOG ----
  console.log('2. Capturing Profile Dialog...');
  await page.click('.workspace-header__account-button');
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.workspace-header__menu-button'));
    const btn = buttons.find(b => b.textContent?.includes('My profile'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '.tmp-shots/verify-profile-dialog-open.png' });
  console.log('✓ Captured .tmp-shots/verify-profile-dialog-open.png');

  // ---- 3. COMMUTER TRANSIT MAP & FAVORITES CARD ----
  console.log('3. Capturing Commuter Transit Map toolbar...');
  await page.evaluate(() => {
    localStorage.setItem('parkjom_user', JSON.stringify({
      userId: 2,
      email: 'driver@parkjom.my',
      firstName: 'Commuter',
      lastName: 'Driver',
      role: 'Commuter',
      userType: 2,
      token: 'fake',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));
    localStorage.setItem('parkjom_commuter_favorites', JSON.stringify([
      {
        parkingSpotId: 901,
        parkingLabel: 'Bay B-08',
        propertyName: 'PV 9 Setapak',
        address: 'Jalan Danau Saujana, Taman Danau Kota, 53300 Kuala Lumpur',
        stationName: 'Wangsa Maju LRT',
        dailyRate: null,
        distanceToStation: 0.75,
        availabilityStatus: 'Available'
      }
    ]));
  });

  await page.goto('https://localhost:3000/commuter', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Click Transit Map
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const mapBtn = buttons.find(b => b.textContent?.trim().includes('Transit Map'));
    if (mapBtn) mapBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-map-toolbar.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-map-toolbar.png');

  // Click Favorites
  console.log('4. Capturing Commuter Favorites card...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const favBtn = buttons.find(b => b.textContent?.trim().includes('Favorites'));
    if (favBtn) favBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-favorite-card.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-favorite-card.png');

  await browser.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
