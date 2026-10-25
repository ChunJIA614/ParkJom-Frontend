import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

if (!fs.existsSync('.tmp-shots')) {
  fs.mkdirSync('.tmp-shots', { recursive: true });
}

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
      if (parsed.pathname.includes('/verification-requests')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 200,
            success: true,
            data: [
              {
                verificationRequestId: 101,
                parkingSpotId: 501,
                parkingLabel: 'Bay A-12',
                propertyId: 201,
                propertyName: 'KL Gateway Tower 1',
                submittedByUserId: 12,
                submittedByEmail: 'sarah.tan@example.com',
                submittedByName: 'Sarah Tan',
                verificationStatus: 0,
                submittedAt: new Date().toISOString(),
                documents: [
                  {
                    verificationDocumentId: 1,
                    documentType: 1,
                    mediaFileId: 99,
                    resourceType: 'image',
                    format: 'png',
                    originalFileName: 'strata_title.png',
                    uploadedAt: new Date().toISOString()
                  }
                ]
              }
            ],
            page: 1,
            pageSize: 10,
            totalCount: 1,
            totalPages: 1
          })
        }).catch(() => {});
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

  // ---- 1. ADMIN LISTING MODAL & SEARCH DROPDOWN & PROFILE DIALOG ----
  console.log('Navigating to /admin...');
  await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Navigate to Listing Governance
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.trim().includes('Listing Governance'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click View verification details button
  console.log('Opening verification modal...');
  const eyeBtn = await page.$('button[title="View verification details"]');
  if (eyeBtn) {
    await eyeBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: '.tmp-shots/verify-modal-open.png' });
    console.log('✓ Captured .tmp-shots/verify-modal-open.png');

    // Close modal
    await page.evaluate(() => {
      const close = document.querySelector('button[aria-label="Close dialog"], button[aria-label="Close"]');
      if (close) close.click();
    });
    await new Promise(r => setTimeout(r, 400));
  }

  // Type in search input to open search dropdown
  console.log('Opening search dropdown...');
  await page.click('.workspace-header__search-input');
  await page.type('.workspace-header__search-input', 'Audit', { delay: 50 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '.tmp-shots/verify-search-dropdown-open.png' });
  console.log('✓ Captured .tmp-shots/verify-search-dropdown-open.png');

  // Clear search
  await page.evaluate(() => {
    const searchInput = document.querySelector('.workspace-header__search-input');
    if (searchInput) searchInput.value = '';
  });

  // Open Account menu and click "My profile"
  console.log('Opening profile dialog...');
  await page.click('.workspace-header__account-button');
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.workspace-header__menu-item'));
    const myProfile = items.find(el => el.textContent?.includes('My profile'));
    if (myProfile) myProfile.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '.tmp-shots/verify-profile-dialog-open.png' });
  console.log('✓ Captured .tmp-shots/verify-profile-dialog-open.png');

  // Close profile dialog
  await page.evaluate(() => {
    const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // ---- 2. COMMUTER TRANSIT MAP & FAVORITES CARD ----
  console.log('Navigating to /commuter...');
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
    // Pre-seed a favorite spot to test PV 9 Setapak card
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

  // Click "Transit Map" in sidebar
  console.log('Opening Transit Map view...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const mapBtn = buttons.find(b => b.textContent?.trim().includes('Transit Map'));
    if (mapBtn) mapBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-map-toolbar.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-map-toolbar.png');

  // Click "Favorites" in sidebar to inspect PV 9 Setapak card
  console.log('Opening Favorites view...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const favBtn = buttons.find(b => b.textContent?.trim().includes('Favorites'));
    if (favBtn) favBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-favorite-card.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-favorite-card.png');

  await browser.close();
  console.log('All verification captures completed!');
}

run().catch(err => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
