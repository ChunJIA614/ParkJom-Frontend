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

  // ---- 1. GOOGLE LOGIN BUTTON ----
  console.log('1. Testing Google Login button on dark mode...');
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('parkjom-theme', 'dark');
  });
  await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '.tmp-shots/verify-google-login.png' });
  console.log('✓ Captured .tmp-shots/verify-google-login.png');

  // ---- 2. ADMIN DASHBOARD & LISTING GOVERNANCE ----
  console.log('2. Testing Admin Dashboard, Table Hover & Modal...');
  await page.evaluate(() => {
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

  await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Navigate to Listing Governance
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.trim().includes('Listing Governance'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Hover over the first table row
  const row = await page.$('table tbody tr');
  if (row) {
    await row.hover();
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: '.tmp-shots/verify-table-hover.png' });
    console.log('✓ Captured .tmp-shots/verify-table-hover.png');

    // Click "Review" or details button
    await page.evaluate(() => {
      const reviewBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent?.includes('Review') || b.textContent?.includes('View') || b.textContent?.includes('Details')
      );
      if (reviewBtn) reviewBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: '.tmp-shots/verify-modal.png' });
    console.log('✓ Captured .tmp-shots/verify-modal.png');

    // Close modal if open
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
  }

  // ---- 3. HEADER SEARCH DROPDOWN ----
  console.log('3. Testing Dashboard Header search dropdown...');
  await page.evaluate(() => {
    const searchInput = document.querySelector('.workspace-header__search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.value = 'set';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '.tmp-shots/verify-search-dropdown.png' });
  console.log('✓ Captured .tmp-shots/verify-search-dropdown.png');

  // ---- 4. MY PROFILE DIALOG ----
  console.log('4. Testing My Profile dialog in dark mode...');
  // Open account menu
  await page.evaluate(() => {
    const accountBtn = document.querySelector('.workspace-header__account-button');
    if (accountBtn) accountBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Click "Profile Settings"
  await page.evaluate(() => {
    const profileItem = Array.from(document.querySelectorAll('.workspace-header__menu-item')).find(el => 
      el.textContent?.includes('Profile')
    );
    if (profileItem) profileItem.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '.tmp-shots/verify-profile-dialog.png' });
  console.log('✓ Captured .tmp-shots/verify-profile-dialog.png');

  // ---- 5. COMMUTER MAP TOOLBAR & CARDS ----
  console.log('5. Testing Commuter Map toolbar and cards...');
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
  });

  await page.goto('https://localhost:3000/commuter', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '.tmp-shots/verify-commuter-dashboard.png' });
  console.log('✓ Captured .tmp-shots/verify-commuter-dashboard.png');

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
