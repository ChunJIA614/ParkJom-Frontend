import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('parkjom-theme', 'dark');
  localStorage.setItem('parkjom_user', JSON.stringify({
    userId: 1,
    email: 'admin@parkjom.my',
    firstName: 'Chun Jia',
    lastName: 'Admin',
    role: 'Admin',
    userType: 1,
    token: 'fake-admin-token'
  }));
});
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/')) {
    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, data: [] })
    }).catch(() => {});
    return;
  }
  req.continue().catch(() => {});
});

await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));
await fs.promises.mkdir('.tmp-shots', { recursive: true });
await page.screenshot({ path: '.tmp-shots/admin-dark-before.png' });
console.log('Admin dark screenshot saved to .tmp-shots/admin-dark-before.png');
await browser.close();
