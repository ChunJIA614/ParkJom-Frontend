/**
 * Dark-mode contrast audit.
 *
 * Walks every rendered text node, resolves its effective (composited)
 * background, and reports pairs below the WCAG AA threshold so the dark
 * palette can be tuned against real failures instead of guesswork.
 *
 * Usage: node scripts/audit-dark-contrast.mjs [baseUrl] [outFile]
 */
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'https://localhost:3002';
const OUT = process.argv[3] || '.tmp-shots/contrast-report.json';
const CHROME =
  process.env.PJ_CHROME ||
  'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAKE_USER = {
  userId: 999999, email: 'audit@parkjom.test', firstName: 'Audit', lastName: 'User', picture: '',
  phoneNumber: '0123456789', userType: 3, role: 'Commuter', token: 'audit-token',
  isProfileComplete: true, accountStatus: 'Active',
};

const PAGES = [
  { name: 'landing', path: '/', w: 1280, h: 900, auth: false },
  { name: 'login', path: '/login', w: 1280, h: 900, auth: false },
  { name: 'commuter', path: '/commuter', w: 1440, h: 1000, auth: true, role: 'Commuter', userType: 3 },
  { name: 'owner', path: '/owner', w: 1440, h: 1000, auth: true, role: 'Owner', userType: 2 },
  { name: 'admin', path: '/admin', w: 1440, h: 1000, auth: true, role: 'Admin', userType: 1 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = [];

for (const spec of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: spec.w, height: spec.h, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const user = { ...FAKE_USER, role: spec.role || 'Commuter', userType: spec.userType || 3 };
  await page.evaluateOnNewDocument((u, auth) => {
    localStorage.setItem('parkjom-theme', 'dark');
    if (auth) localStorage.setItem('parkjom_user', JSON.stringify(u));
  }, user, spec.auth);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (!pathname.startsWith('/api/') || pathname.startsWith('/api/gtfs/')) return req.continue().catch(() => {});
    req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, success: true, data: [] }) }).catch(() => {});
  });

  await page.goto(`${BASE}${spec.path}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3200);

  const findings = await page.evaluate(() => {
    // Resolve any CSS colour string (rgb / rgba / oklab / color()) to [r,g,b,a].
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const cache = new Map();
    const toRgba = (str) => {
      if (cache.has(str)) return cache.get(str);
      let out = null;
      if (str && str !== 'none' && str !== 'transparent') {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = str;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], d[3] / 255];
      }
      cache.set(str, out);
      return out;
    };
    const over = (fg, bg) => {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
      ];
    };
    const lum = ([r, g, b]) => {
      const f = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const bgOf = (el) => {
      const chain = [];
      let node = el;
      while (node && node.nodeType === 1) {
        chain.push(node);
        node = node.parentElement;
      }
      chain.reverse();
      let bg = [11, 11, 13, 1];
      for (const n of chain) {
        const cs = getComputedStyle(n);
        const c = toRgba(cs.backgroundColor);
        if (c && c[3] > 0) bg = c[3] >= 1 ? [c[0], c[1], c[2], 1] : over(c, bg);
        // Images / gradients count as an unknown surface: stop trusting it.
        if (cs.backgroundImage && cs.backgroundImage !== 'none') bg = [0, 0, 0, 1];
      }
      return bg;
    };

    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (!text || text.length < 2) continue;
      const el = node.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (el.closest('[aria-hidden="true"], svg, .leaflet-container')) continue;

      const fgRaw = toRgba(cs.color);
      if (!fgRaw) continue;
      const bg = bgOf(el);
      const fg = fgRaw[3] >= 1 ? [fgRaw[0], fgRaw[1], fgRaw[2], 1] : over(fgRaw, bg);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const r = ratio(fg, bg);
      if (r >= need) continue;

      const key = `${cs.color}|${cs.backgroundColor}|${el.className}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: text.slice(0, 48),
        ratio: Math.round(r * 100) / 100,
        need,
        size,
        weight,
        color: cs.color,
        bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
        cls: (el.className || '').toString().slice(0, 120),
        tag: el.tagName.toLowerCase(),
      });
    }
    return out.sort((a, b) => a.ratio - b.ratio);
  });

  results.push({ page: spec.name, count: findings.length, findings });
  console.log(`${spec.name}: ${findings.length} low-contrast text nodes`);
  await page.close();
}

await writeFile(OUT, JSON.stringify(results, null, 2));
console.log(`\nreport → ${OUT}`);
for (const r of results) {
  console.log(`\n── ${r.page} ──`);
  for (const f of r.findings.slice(0, 12)) {
    console.log(`  ${f.ratio}:1 (need ${f.need}) ${f.size}px  "${f.text}"  ${f.color} on ${f.bg}`);
    console.log(`      ${f.cls}`);
  }
}

await browser.close();
