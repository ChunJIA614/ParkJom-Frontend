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

// Test clipping
await page.evaluate(() => {
  const shell = document.querySelector('.google-signin-shell');
  if (shell) {
    shell.style.borderRadius = '9999px';
    shell.style.overflow = 'hidden';
    shell.style.height = '40px';
  }
  const iframe = document.querySelector('.google-signin-shell iframe');
  if (iframe) {
    iframe.style.borderRadius = '9999px';
  }
});
await new Promise(r => setTimeout(r, 300));

await page.screenshot({ path: '.tmp-shots/google-button-clipped.png' });
console.log('Saved .tmp-shots/google-button-clipped.png');

const bounds = await page.evaluate(() => {
  const shell = document.querySelector('.google-signin-shell');
  const iframe = shell?.querySelector('iframe');
  return {
    shell: shell ? { w: shell.offsetWidth, h: shell.offsetHeight, br: getComputedStyle(shell).borderRadius, of: getComputedStyle(shell).overflow } : null,
    iframe: iframe ? { w: iframe.offsetWidth, h: iframe.offsetHeight, br: getComputedStyle(iframe).borderRadius } : null
  };
});
console.log('Bounds:', JSON.stringify(bounds, null, 2));

await browser.close();
