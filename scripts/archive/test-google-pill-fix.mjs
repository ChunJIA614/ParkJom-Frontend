import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, acceptInsecureCerts: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('parkjom-theme', 'dark');
});

await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// Test applying border-radius and clipping on iframe
await page.evaluate(() => {
  const iframe = document.querySelector('.google-signin-shell iframe');
  if (iframe) {
    iframe.style.borderRadius = '9999px';
    iframe.style.overflow = 'hidden';
  }
});
await new Promise(r => setTimeout(r, 300));

await page.screenshot({ path: '.tmp-shots/google-button-pill-radius.png' });
console.log('Saved .tmp-shots/google-button-pill-radius.png');
await browser.close();
