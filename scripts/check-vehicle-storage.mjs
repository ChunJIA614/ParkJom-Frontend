import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformSync } from 'esbuild';

// --- Minimal localStorage stub -------------------------------------------------
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

// --- Load the module under test (type-only imports are erased by esbuild) ------
const source = readFileSync('src/features/commuter/lib/vehicleStorage.ts', 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const dir = mkdtempSync(join(tmpdir(), 'pj-'));
const file = join(dir, 'vehicleStorage.mjs');
writeFileSync(file, code);

const mod = await import(`file://${file.replace(/\\/g, '/')}`);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
  }
}

console.log('\n[1] Empty cache must resolve to an empty list (no fabricated vehicle)');
storage.clear();
check('no cache -> []', mod.loadCachedVehicles(42), []);

console.log('\n[2] Legacy pre-API cache must be ignored AND purged');
storage.clear();
storage.setItem('parkjom.vehicles.42', JSON.stringify([
  { vehicleId: 1, plate: 'WXY 8899', brand: 'Perodua', model: 'Myvi', color: 'White', active: true },
]));
check('legacy fake car -> []', mod.loadCachedVehicles(42), []);
check('legacy key removed', storage.getItem('parkjom.vehicles.42'), null);

console.log('\n[3] Corrupt cache must not throw');
storage.clear();
storage.setItem('parkjom.vehicles.v2.42', '{not json');
check('corrupt -> []', mod.loadCachedVehicles(42), []);

console.log('\n[4] Valid v2 cache round-trips and normalises');
storage.clear();
const real = [{ vehicleId: 77, plate: 'abc 123', brand: 'Honda', model: 'City', color: 'Blue', active: true }];
mod.saveCachedVehicles(42, real);
check('round-trip', mod.loadCachedVehicles(42), [
  { vehicleId: 77, plate: 'ABC 123', brand: 'Honda', model: 'City', color: 'Blue', active: true },
]);

console.log('\n[5] Saving an empty list clears the key');
mod.saveCachedVehicles(42, []);
check('empty save -> key gone', storage.getItem('parkjom.vehicles.v2.42'), null);
check('reload -> []', mod.loadCachedVehicles(42), []);

console.log('\n[6] API mapper uses the backend vehicleId, never a timestamp');
const mapped = mod.mapApiVehicleToVehicle({
  vehicleId: 501, numberPlate: ' vab 9 ', vehicleBrand: 'Toyota', vehicleModel: 'Vios',
  vehicleColor: 'Silver', createdAt: '', updatedAt: '',
}, true);
check('mapped', mapped, {
  vehicleId: 501, plate: 'VAB 9', brand: 'Toyota', model: 'Vios', color: 'Silver', active: true,
});

console.log('\n[7] Active selection survives a refresh, falls back to first');
const list = [
  { vehicleId: 10, plate: 'A', brand: 'x', model: 'y', color: 'z', active: false },
  { vehicleId: 11, plate: 'B', brand: 'x', model: 'y', color: 'z', active: false },
];
check('restores id 11', mod.applyActiveVehicle(list, 11).map((v) => v.active), [false, true]);
check('unknown id -> first', mod.applyActiveVehicle(list, 999).map((v) => v.active), [true, false]);
check('empty list stays empty', mod.applyActiveVehicle([], 5), []);

console.log('\n[8] Entries without a positive numeric vehicleId are rejected');
storage.clear();
storage.setItem('parkjom.vehicles.v2.42', JSON.stringify([
  { vehicleId: null, plate: 'NOPE 1', brand: 'x', model: 'y', color: 'z', active: true },
  { vehicleId: 12, plate: 'OK 1', brand: 'x', model: 'y', color: 'z', active: true },
]));
check('only valid id kept', mod.loadCachedVehicles(42).map((v) => v.vehicleId), [12]);

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
