// Capture the hero at several scroll positions to verify the frame sequence
// and the four copy stages. Not part of the app build.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.HERO_URL || 'https://127.0.0.1:3000/';
const OUTDIR = process.argv[2] || 'C:\\Users\\Chun Jia\\Downloads';

const STOPS = [
  { p: 0.02, name: 'stage1' },
  { p: 0.33, name: 'stage2' },
  { p: 0.63, name: 'stage3' },
  { p: 0.92, name: 'stage4' },
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });

await page.waitForFunction(
  () => {
    const el = document.querySelector('[aria-label="Loading animation"]');
    return el && el.getAttribute('aria-valuenow') === '100';
  },
  { timeout: 180000 },
).catch(() => console.log('warning: loader did not reach 100%'));

await new Promise((r) => setTimeout(r, 800));

for (const stop of STOPS) {
  const y = Math.round(stop.p * 4 * 900);
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  // scrub: 0.5 easing needs a moment to settle
  await new Promise((r) => setTimeout(r, 1400));
  const path = `${OUTDIR}\\hero-scroll-${stop.name}.png`;
  await page.screenshot({ path });
  console.log('saved', path, 'scrollY=' + y);
}

await browser.close();
