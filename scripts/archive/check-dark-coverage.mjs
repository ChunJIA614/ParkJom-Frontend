/**
 * Dark-mode token coverage check.
 *
 * Collects every colour utility actually used in `src/`, mounts one probe node
 * per class inside a dark page, and reports tokens that still resolve to a
 * light surface (or unreadable text) — i.e. classes the dark mapping misses.
 *
 * Usage: node scripts/check-dark-coverage.mjs [baseUrl]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'https://localhost:3002';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const SRC = path.resolve('src');
const CLASS_RE = /\b(bg|border|text)-(?:\[#[0-9a-fA-F]{3,8}\](?:\/[0-9]+)?|(?:white|black)(?:\/[0-9]+)?|(?:slate|gray|zinc|neutral|stone|emerald|green|teal|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime)-(?:50|[1-9]00)(?:\/[0-9]+)?)\b/g;

async function collectFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectFiles(full)));
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await collectFiles(SRC);
const tokens = new Set();
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(CLASS_RE)) tokens.add(match[0]);
}

const bgTokens = [...tokens].filter((t) => t.startsWith('bg-'));
const borderTokens = [...tokens].filter((t) => t.startsWith('border-'));
const textTokens = [...tokens].filter((t) => t.startsWith('text-'));

console.log(`scanned ${files.length} files → ${bgTokens.length} bg, ${borderTokens.length} border, ${textTokens.length} text tokens`);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 600 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.evaluateOnNewDocument(() => localStorage.setItem('parkjom-theme', 'dark'));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });

const result = await page.evaluate((bg, border, text) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const toRgb = (str) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = str;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;background:#0b0b0d;color:#f2f2f7';
  document.body.appendChild(host);

  const probe = (cls, prop) => {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = 'x';
    host.appendChild(el);
    const cs = getComputedStyle(el);
    const raw = prop === 'bg' ? cs.backgroundColor : prop === 'border' ? cs.borderTopColor : cs.color;
    const rgb = toRgb(raw);
    el.remove();
    // Composite over the dark canvas so translucent tints are judged fairly.
    const a = rgb[3];
    const base = [11, 11, 13];
    const flat = [
      rgb[0] * a + base[0] * (1 - a),
      rgb[1] * a + base[1] * (1 - a),
      rgb[2] * a + base[2] * (1 - a),
    ];
    return { raw, rgb, L: lum(flat), a };
  };

  const lightBgs = [];
  for (const cls of bg) {
    const { raw, L, a } = probe(cls, 'bg');
    // Effective fill over the dark canvas.
    if (a > 0 && L > 0.22) lightBgs.push({ cls, raw, L: Math.round(L * 100) / 100, a });
  }

  const lightBorders = [];
  for (const cls of border) {
    const { raw, L, a } = probe(cls, 'border');
    if (a > 0.25 && L > 0.55) lightBorders.push({ cls, raw, L: Math.round(L * 100) / 100, a });
  }

  const darkText = [];
  for (const cls of text) {
    const { raw, L, a } = probe(cls, 'text');
    // Text darker than the canvas on a dark surface is unreadable.
    if (a > 0.5 && L < 0.18) darkText.push({ cls, raw, L: Math.round(L * 100) / 100, a });
  }

  host.remove();
  return { lightBgs, lightBorders, darkText };
}, bgTokens, borderTokens, textTokens);

const show = (label, list) => {
  console.log(`\n${label}: ${list.length}`);
  for (const item of list.sort((a, b) => b.L - a.L).slice(0, 40)) {
    console.log(`  ${item.L}  ${item.cls}  → ${item.raw}`);
  }
};
show('LIGHT BACKGROUNDS on dark', result.lightBgs);
show('LIGHT BORDERS on dark', result.lightBorders);
show('DARK TEXT on dark', result.darkText);

await browser.close();
