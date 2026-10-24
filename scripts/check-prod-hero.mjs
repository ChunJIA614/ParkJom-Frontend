// Production-build smoke test for the hero: load dist via `vite preview`,
// report any failed frame request, and capture a screenshot.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.HERO_URL || 'http://127.0.0.1:4173/';
const OUT = process.argv[2] || 'C:\\Users\\Chun Jia\\Downloads\\hero-prod.png';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const failures = [];
let frameOk = 0;
page.on('response', (res) => {
  if (!/\/frames[^/]*\/frame_/.test(res.url())) return;
  if (res.status() >= 400) failures.push(`${res.status()} ${res.url()}`);
  else frameOk += 1;
});
page.on('requestfailed', (req) => {
  if (/\/frames[^/]*\/frame_/.test(req.url())) failures.push(`FAILED ${req.url()}`);
});

const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(
  () => {
    const el = document.querySelector('[aria-label="Loading animation"]');
    return el && el.getAttribute('aria-valuenow') === '100';
  },
  { timeout: 180000 },
).catch(() => console.log('warning: loader did not reach 100%'));

await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: OUT });

const canvas = await page.evaluate(() => {
  const c = document.querySelector('#overview canvas');
  return c ? { w: c.width, h: c.height } : null;
});

console.log(`frames ok=${frameOk} failed=${failures.length}`);
if (failures.length) console.log('first failures:', failures.slice(0, 5));
console.log('canvas bitmap:', canvas);
console.log('page errors:', consoleErrors.length ? consoleErrors.slice(0, 5) : 'none');
console.log('saved', OUT);

await browser.close();
