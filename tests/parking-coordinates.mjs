import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformSync } from 'esbuild';

/**
 * Drives the real `getPublicParkingSpot` normaliser by swapping the HTTP layer
 * for a stub, so the coordinate resolution rules are verified end to end.
 */
const source = readFileSync('src/features/commuter/api/parkingApi.ts', 'utf8')
  .replace(
    "import { apiRequest, readApiError } from '@/services/apiClient';",
    `const apiRequest = async () => new Response(JSON.stringify(globalThis.__PJ_PAYLOAD), {
       status: 200, headers: { 'Content-Type': 'application/json' },
     });
     const readApiError = async () => 'stub error';`,
  );

const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const dir = mkdtempSync(join(tmpdir(), 'pj-'));
const file = join(dir, 'parkingApi.mjs');
writeFileSync(file, code);
const { getPublicParkingSpot } = await import(`file://${file.replace(/\\/g, '/')}`);

const base = {
  parkingSpotId: 1, propertyId: 2, propertyName: 'PV9', address: 'Setapak',
  ownerId: 3, ownerName: 'Tan', parkingLabel: 'B1', availabilityStatus: 'Available',
  verificationStatus: 'Approved', monthlyRate: 300, dailyRate: 12, isPublished: true,
  createdAt: '', updatedAt: '', images: [],
};

let failures = 0;
function check(name, extra, expected) {
  globalThis.__PJ_PAYLOAD = { code: 200, success: true, message: '', data: { ...base, ...extra } };
  return getPublicParkingSpot(1).then((result) => {
    const { latitude, longitude } = result.data;
    const actual = { latitude, longitude };
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
      console.log(`  PASS  ${name}`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
    }
  });
}

console.log('\n[1] Coordinates are read from the contract when present');
await check('camelCase', { latitude: 3.1073, longitude: 101.7145 }, { latitude: 3.1073, longitude: 101.7145 });
await check('PascalCase', { Latitude: 3.1073, Longitude: 101.7145 }, { latitude: 3.1073, longitude: 101.7145 });
await check('lat/lng aliases', { lat: 3.1073, lng: 101.7145 }, { latitude: 3.1073, longitude: 101.7145 });
await check('lon alias', { lat: 3.1073, lon: 101.7145 }, { latitude: 3.1073, longitude: 101.7145 });
await check('numeric strings', { latitude: '3.1073', longitude: '101.7145' }, { latitude: 3.1073, longitude: 101.7145 });

console.log('\n[2] Absent coordinates stay absent (no 0,0 pin in the Atlantic)');
await check('missing entirely', {}, { latitude: null, longitude: null });
await check('explicit 0,0', { latitude: 0, longitude: 0 }, { latitude: null, longitude: null });
await check('null values', { latitude: null, longitude: null }, { latitude: null, longitude: null });
await check('only latitude', { latitude: 3.1073 }, { latitude: null, longitude: null });
await check('empty strings', { latitude: '', longitude: '' }, { latitude: null, longitude: null });

console.log('\n[3] Out-of-range values are rejected rather than plotted');
await check('lat > 90', { latitude: 91, longitude: 101 }, { latitude: null, longitude: null });
await check('lng > 180', { latitude: 3, longitude: 181 }, { latitude: null, longitude: null });

console.log('\n[4] Station metadata passes through');
globalThis.__PJ_PAYLOAD = {
  code: 200, success: true, message: '',
  data: { ...base, latitude: 3.1, longitude: 101.7, stationName: 'Wangsa Maju', distanceToStationMeters: 420, timeToStationInMinutes: 6 },
};
const full = (await getPublicParkingSpot(1)).data;
for (const [key, expected] of [
  ['stationName', 'Wangsa Maju'],
  ['distanceToStationMeters', 420],
  ['timeToStationInMinutes', 6],
]) {
  if (full[key] === expected) {
    console.log(`  PASS  ${key} = ${JSON.stringify(full[key])}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${key}: expected ${expected}, got ${JSON.stringify(full[key])}`);
  }
}

console.log('\n[5] PascalCase station fields are also accepted');
globalThis.__PJ_PAYLOAD = {
  code: 200, success: true, message: '',
  data: { ...base, Latitude: 3.1, Longitude: 101.7, StationName: 'KLCC', DistanceToStation: 250 },
};
const pascal = (await getPublicParkingSpot(1)).data;
if (pascal.stationName === 'KLCC' && pascal.distanceToStationMeters === 250) {
  console.log('  PASS  PascalCase station metadata');
} else {
  failures += 1;
  console.log(`  FAIL  PascalCase station metadata -> ${JSON.stringify({ s: pascal.stationName, d: pascal.distanceToStationMeters })}`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
