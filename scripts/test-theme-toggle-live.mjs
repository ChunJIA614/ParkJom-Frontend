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
  localStorage.setItem('parkjom-theme', 'light');
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

// Check initial light state
let state = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  workspaceBg: getComputedStyle(document.querySelector('.app-workspace')).backgroundColor
}));
console.log('1. Initial Light State:', state);

// Open Account menu and click "Dark" segmented control option
await page.evaluate(() => {
  document.querySelector('.workspace-header__account-button')?.click();
});
await new Promise(r => setTimeout(r, 500));

await page.evaluate(() => {
  const darkBtn = Array.from(document.querySelectorAll('.theme-switch__option')).find(el => el.textContent?.includes('Dark'));
  darkBtn?.click();
});
await new Promise(r => setTimeout(r, 500));

// Check dark state
state = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  workspaceBg: getComputedStyle(document.querySelector('.app-workspace')).backgroundColor
}));
console.log('2. After Toggling to Dark:', state);

// Now click "Light" segmented control option
await page.evaluate(() => {
  const lightBtn = Array.from(document.querySelectorAll('.theme-switch__option')).find(el => el.textContent?.includes('Light'));
  lightBtn?.click();
});
await new Promise(r => setTimeout(r, 500));

// Check back to light state
state = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  workspaceBg: getComputedStyle(document.querySelector('.app-workspace')).backgroundColor
}));
console.log('3. After Toggling Back to Light:', state);

await browser.close();
