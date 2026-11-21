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

console.log('[2] Invalid plates (including long numeric spam and bad syntax) are rejected');
for (const plate of [
  'VAS 3243252353235235',
  '123456',
  'ABCDEF',
  'WXY 0000',
  'WXY 12345',
  'WXY 1234 AB',
  'WXY-1234!',
  'W X Y 1234',
  '',
  '   ',
]) {
  const error = validateVehiclePlate(plate);
  assert.ok(typeof error === 'string' && error.length > 0, `Expected "${plate}" to be rejected`);
}
assert.match(validateVehiclePlate(''), /Number plate is required/i);
assert.match(validateVehiclePlate('WXY-1234!'), /letters, numbers, and spaces/i);
assert.match(validateVehiclePlate('VAS 3243252353235235'), /16 characters|valid Malaysian/i);

console.log('[3] normalizeVehiclePlate and sanitizePlateInput format cleanly');
assert.equal(normalizeVehiclePlate('  wxy   1234  a '), 'WXY 1234 A');
assert.equal(sanitizePlateInput('  vas-3243252353235235'), 'VAS3243252353235');
assert.equal(sanitizePlateInput('  wxy   1234!@#').length <= MAX_PLATE_LENGTH, true);
assert.equal(sanitizePlateInput('  wxy   1234!@#'), 'WXY 1234');

console.log('\nALL PLATE VALIDATION CHECKS PASSED\n');
