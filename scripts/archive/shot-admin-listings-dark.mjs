import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, acceptInsecureCerts: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

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

await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

// Click "Listings" in sidebar
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const listingsBtn = buttons.find(b => b.textContent?.trim().includes('Listings'));
  if (listingsBtn) listingsBtn.click();
});
await new Promise(r => setTimeout(r, 1000));

// Click Account menu button to open dropdown
await page.evaluate(() => {
  const accountBtn = document.querySelector('.workspace-header__account-button');
  if (accountBtn) accountBtn.click();
});
await new Promise(r => setTimeout(r, 600));

await page.screenshot({ path: '.tmp-shots/admin-listings-dark.png' });
console.log('✓ Captured .tmp-shots/admin-listings-dark.png');
await browser.close();
