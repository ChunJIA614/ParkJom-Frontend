import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync, transformSync } from 'esbuild';

async function loadTs(path) {
  const { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { getGuideCardPosition } = await loadTs('src/components/onboarding/guidePosition.ts');
for (const [width, height] of [[320, 568], [360, 640], [390, 844], [844, 390], [768, 1024], [1440, 900]]) {
  for (const source of ['sidebar', 'bottomnav', 'none']) {
    const target = { source, top: source === 'bottomnav' ? height - 80 : 96, left: 16, width: 200, height: 44 };
    for (const cardHeight of [200, 320, 700]) {
      const box = getGuideCardPosition(width, height, target, cardHeight);
      assert.ok(box.left >= 0 && box.left + box.width <= width, `Guide must fit horizontally at ${width}×${height}`);
      assert.ok(box.top >= 0 && box.top + Math.min(cardHeight, box.maxHeight) <= height, 'Guide must fit vertically');
      if (source === 'bottomnav') assert.ok(box.top + Math.min(cardHeight, box.maxHeight) < target.top, 'Keep the highlighted navigation button accessible');
    }
  }
}

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();
const storage = await loadTs('src/components/onboarding/onboardingStorage.ts');
for (const role of ['Commuter', 'Owner']) {
  assert.equal(storage.isFirstTimeUserForTour(10, role), true);
  storage.markIconTourCompleted(10, role);
  storage.clearWelcomeSession(10);
  storage.markFreshLoginForWelcome(10);
  assert.equal(storage.isFirstTimeUserForTour(10, role), false, 'Signing in again must not replay a completed guide');
  assert.equal(storage.isFirstTimeUserForTour(11, role), true, 'A different account still gets its first guide');
}
assert.equal(storage.isFirstTimeUserForTour(undefined, 'Commuter'), false);
assert.equal(storage.isFirstTimeUserForTour(10, 'Admin'), false);
delete globalThis.localStorage;
delete globalThis.sessionStorage;

const bundle = buildSync({ entryPoints: ['src/features/landing/lib/routeCatalog.ts'], bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' } });
const { buildRouteCatalog } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const map = JSON.parse(readFileSync('public/data/kl_rail_lines.json', 'utf8'));
const routes = buildRouteCatalog(map.features.map(feature => feature.properties));
assert.equal(routes.length, 8, 'Both directions of each line must become a single route card');
assert.deepEqual(routes.map(route => route.id).sort(), ['AG', 'BRT', 'KG', 'KJ', 'MR', 'PY', 'SA', 'SP']);
assert.ok(routes.some(route => route.name === 'Sri Petaling Line' && route.category === 'LRT'));
assert.ok(routes.some(route => route.name === 'Shah Alam Line'));
assert.deepEqual([...new Set(routes.map(route => route.category))].sort(), ['BRT', 'LRT', 'MRT', 'Monorail']);
assert.equal(buildRouteCatalog([{ routeId: 'KJ' }, { routeId: 'KJL' }]).length, 1, 'Aliases must not duplicate a route');
assert.equal(buildRouteCatalog([{ routeId: '' }]).length, 0);
assert.equal(buildRouteCatalog([{ routeId: 'future', color: 'red; invalid' }])[0].color, '#244b6a');
console.log('Mobile navigation: viewport placement, one-time guide persistence, and complete transit catalogue checks passed.');
