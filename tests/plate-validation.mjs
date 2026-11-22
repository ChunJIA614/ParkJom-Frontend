import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const bundle = (entryPoint) => {
  const { outputFiles } = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
};

const {
  MAX_PLATE_LENGTH,
  normalizeVehiclePlate,
  sanitizePlateInput,
  validateVehiclePlate,
} = await bundle('src/features/commuter/lib/plateValidation.ts');

console.log('\n[1] Valid Malaysian JPJ plates pass validation');
for (const plate of [
  'WXY 1234',
  'WXY1234',
  'W 1234 A',
  'E4444A',
  'VIP 8',
  'PUTRAJAYA 9999',
  'G1M 88',
  'SAA 1234 B',
  'ABC 123',
  '  wxy   1234 ',
]) {
  assert.equal(validateVehiclePlate(plate), null, `Expected "${plate}" to be valid`);
}

console.log('[2] Malaysian JPJ special / commemorative series pass validation');
for (const plate of [
  'MADANI 1',
  'MADANI 8888',
  'madani 88',
  'MADANI88',
  'PUTRAJAYA 1',
  'PUTRAJAYA 9999',
  'putrajaya 88',
  'MALAYSIA 1',
  'GOLD 1',
  'PETRA 2024',
  'ANSARA 5555',
  'VIPS 88',
  'WCEC 8',
  'FFFF 1',
  'FF 1',
  'FFF 888',
  'EV 100',
  'GM 99',
  'FH 80',
  'SIS 1',
  'SMJ 1',
  'M 888 M',
  'A 9 A',
  'P 80 P',
  'H 1 H',
  'V 2026 MY',
  'V2026MY',
  'G1M 88',
  '1M4U 123',
  'IM4U 123',
  '1MCY 88',
  'A1M 7',
  'NBOS 88',
  'PATRIOT 1',
  'SUKOM 98',
  'RIMAU 2017',
  'HARIMAU 1',
  'BAMBEE 8',
  'PERFECT 1',
  'RAPID 10',
  'PROTON 1',
  'PERODUA 1',
  'CHANCELLOR 7',
  'PUTRA 88',
  'WAJA 2000',
  'KRISS 100',
  'UITM 1234',
  'UNISZA 55',
  'UTHM 88',
  'UIAM 100',
  'UNIKL 77',
]) {
  assert.equal(validateVehiclePlate(plate), null, `Expected special plate "${plate}" to be valid`);
}

console.log('[3] Invalid plates (including long numeric spam and bad syntax) are rejected');
for (const plate of [
  'VAS 3243252353235235',
  '123456',
  'ABCDEF',
  'WXY 0000',
  'WXY 12345',
  'WXY 1234 AB',
  'WXY-1234!',
  'W X Y 1234',
  'MADANI',
  'MADANI 0',
  'PUTRAJAYA 0000',
  'MADANI 12345',
  'MADANI 88 A',
  'V 2026 AB',
  '',
  '   ',
]) {
  const error = validateVehiclePlate(plate);
  assert.ok(typeof error === 'string' && error.length > 0, `Expected "${plate}" to be rejected`);
}
assert.match(validateVehiclePlate(''), /Number plate is required/i);
assert.match(validateVehiclePlate('WXY-1234!'), /letters, numbers, and spaces/i);
assert.match(validateVehiclePlate('VAS 3243252353235235'), /16 characters|valid Malaysian/i);
assert.match(validateVehiclePlate('MADANI 0'), /valid Malaysian/i);

console.log('[4] normalizeVehiclePlate and sanitizePlateInput format cleanly');
assert.equal(normalizeVehiclePlate('  wxy   1234  a '), 'WXY 1234 A');
assert.equal(sanitizePlateInput('  vas-3243252353235235'), 'VAS3243252353235');
assert.equal(sanitizePlateInput('  wxy   1234!@#').length <= MAX_PLATE_LENGTH, true);
assert.equal(sanitizePlateInput('  wxy   1234!@#'), 'WXY 1234');

console.log('\nALL PLATE VALIDATION CHECKS PASSED\n');
