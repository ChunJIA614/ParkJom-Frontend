// One-off visual check of the landing hero. Not part of the app build.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.HERO_URL || 'https://127.0.0.1:3000/';
const OUT = process.argv[2] || 'C:\\Users\\Chun Jia\\Downloads\\hero-check.png';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });

// Wait for the frame loader to finish (the progress pill goes to 100%).
await page.waitForFunction(
  () => {
    const el = document.querySelector('[aria-label="Loading animation"]');
    return el && el.getAttribute('aria-valuenow') === '100';
  },
  { timeout: 120000 },
).catch(() => console.log('warning: loader did not reach 100%'));

await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: OUT });
console.log('saved', OUT);

await browser.close();
