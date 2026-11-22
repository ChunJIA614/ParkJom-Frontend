import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const { outputFiles } = buildSync({
  entryPoints: ['src/features/commuter/lib/vehicleColorValidation.ts'],
  bundle: true,
  write: false,
  format: 'esm',
});
const { validateVehicleColor } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);

for (const color of ['Black', '  silver  ', 'PEARL WHITE', 'Metallic-Silver', 'Midnight Blue', 'Black / Red', 'Merah Jambu', 'Hitam dan Putih']) {
  assert.equal(validateVehicleColor(color), null, color);
}

for (const color of ['', '    ', 'abc123', 'abcdef', 'Pearl', 'Black Car', 'Black and', 'Blue / 12', 'Black & Pearl', 'abcdefghijklmnopqrstuvwxyz Black']) {
  assert.ok(validateVehicleColor(color), color);
}

console.log('Vehicle color validation accepts names, finishes, and combinations and rejects unrecognized or incomplete colors.');
