// Verify the three hero modes: desktop (hd), phone (sm), reduced motion (static).
// Reports which frame directory each mode actually pulls, plus a screenshot per mode.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.HERO_URL || 'https://127.0.0.1:3000/';
const OUTDIR = process.argv[2] || 'C:\\Users\\Chun Jia\\Downloads';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-dev-shm-usage'],
});

async function run(label, viewport, reduced) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (reduced) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }

  const dirs = new Map();
  page.on('response', (res) => {
    const u = res.url();
    const m = u.match(/\/(frames[^/]*)\/frame_/);
    if (m) dirs.set(m[1], (dirs.get(m[1]) || 0) + 1);
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));

  const pinned = await page.evaluate(() => {
    const el = document.querySelector('#overview');
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().height);
  });

  const canvas = await page.evaluate(() => {
    const c = document.querySelector('#overview canvas');
    return c ? `${c.width}x${c.height}` : 'none';
  });

  await page.screenshot({ path: `${OUTDIR}\\hero-mode-${label}.png` });
  const sets = [...dirs.entries()].map(([d, n]) => `${d}=${n}`).join(', ') || 'none';
  console.log(`${label}: frames[${sets}] heroHeight=${pinned}px canvas=${canvas}`);

  await page.close();
}

await run('desktop', { width: 1440, height: 900, deviceScaleFactor: 1 }, false);
await run('phone', { width: 390, height: 844, deviceScaleFactor: 3 }, false);
await run('reduced', { width: 1440, height: 900, deviceScaleFactor: 1 }, true);

await browser.close();
