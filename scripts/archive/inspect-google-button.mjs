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

const info = await page.evaluate(() => {
  const shell = document.querySelector('.google-signin-shell');
  if (!shell) return 'no shell';
  const iframe = shell.querySelector('iframe');
  return {
    shell: {
      tag: shell.tagName,
      className: shell.className,
      bg: getComputedStyle(shell).backgroundColor,
      borderRadius: getComputedStyle(shell).borderRadius,
      width: shell.offsetWidth,
      height: shell.offsetHeight
    },
    iframe: iframe ? {
      width: iframe.offsetWidth,
      height: iframe.offsetHeight,
      bg: getComputedStyle(iframe).backgroundColor,
      borderRadius: getComputedStyle(iframe).borderRadius,
      style: iframe.getAttribute('style')
    } : null,
    parent: {
      className: shell.parentElement?.className,
      bg: shell.parentElement ? getComputedStyle(shell.parentElement).backgroundColor : null,
      borderRadius: shell.parentElement ? getComputedStyle(shell.parentElement).borderRadius : null
    }
  };
});

console.log('Google button DOM info:', JSON.stringify(info, null, 2));
await page.screenshot({ path: '.tmp-shots/google-button-debug.png' });
await browser.close();
