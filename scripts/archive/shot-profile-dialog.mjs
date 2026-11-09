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
    if (parsed.pathname.includes('/api/profile/me')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          success: true,
          data: {
            userId: 1,
            email: 'chunjia@parkjom.my',
            firstName: 'Chun Jia',
            lastName: 'Khoo',
            fullName: 'Chun Jia Khoo',
            phoneNumber: '012-3456789',
            userType: 1,
            roleName: 'Platform Administrator',
            accountStatus: 'Active',
            isProfileComplete: true,
            createdAt: '2026-01-15T08:00:00Z',
            summary: {
              walletBalance: 1250.00,
              walletOnHold: 0,
              vehicleCount: 2,
              ownedParkingSpotsCount: 0,
              activeBookingsCount: 3,
              totalBookingsCount: 42,
              favoritesCount: 5,
              openSupportTicketsCount: 1
            }
          }
        })
      }).catch(() => {});
      return;
    }

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

  console.log('Navigating to https://localhost:3000/admin...');
  await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('Clicking account button...');
  await page.click('.workspace-header__account-button');
  await new Promise(r => setTimeout(r, 500));

  console.log('Clicking My profile...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('My profile'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

  const dialog = await page.$('section[role="dialog"]');
  if (dialog) {
    console.log('Found profile dialog!');
    await page.screenshot({ path: '.tmp-shots/verify-profile-dialog-open.png' });
    console.log('✓ Captured .tmp-shots/verify-profile-dialog-open.png');
  } else {
    console.log('Dialog not found, taking full page shot...');
    await page.screenshot({ path: '.tmp-shots/verify-profile-dialog-open.png' });
  }

  await browser.close();
}

run().catch(err => {
  console.error('Error in profile dialog shot:', err);
  process.exit(1);
});
