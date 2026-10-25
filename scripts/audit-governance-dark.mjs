import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, acceptInsecureCerts: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

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
await new Promise(r => setTimeout(r, 1000));

// Click "Listings"
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const listingsBtn = buttons.find(b => b.textContent?.trim().includes('Listings'));
  if (listingsBtn) listingsBtn.click();
});
await new Promise(r => setTimeout(r, 1000));

const audit = await page.evaluate(() => {
  const h2 = document.getElementById('governance-title');
  const h2Color = h2 ? getComputedStyle(h2).color : null;

  const card = document.querySelector('.lg\\:col-span-2');
  const cardBg = card ? getComputedStyle(card).backgroundColor : null;
  const cardBorder = card ? getComputedStyle(card).borderColor : null;

  const searchInput = document.querySelector('#listing-governance input');
  const searchBg = searchInput ? getComputedStyle(searchInput).backgroundColor : null;
  const searchColor = searchInput ? getComputedStyle(searchInput).color : null;

  const tabContainer = document.querySelector('#listing-governance .bg-slate-100');
  const tabContainerBg = tabContainer ? getComputedStyle(tabContainer).backgroundColor : null;

  const refreshBtn = document.querySelector('#listing-governance button');
  const refreshBg = refreshBtn ? getComputedStyle(refreshBtn).backgroundColor : null;
  const refreshColor = refreshBtn ? getComputedStyle(refreshBtn).color : null;

  return {
    h2Color,
    cardBg,
    cardBorder,
    searchBg,
    searchColor,
    tabContainerBg,
    refreshBg,
    refreshColor
  };
});

console.log('Governance Dark Audit:', JSON.stringify(audit, null, 2));
await browser.close();
