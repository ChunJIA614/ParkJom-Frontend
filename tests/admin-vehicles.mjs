import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const bundle = (entryPoint) => {
  const { outputFiles } = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
    define: { 'import.meta.env.VITE_API_BASE': '"/api"' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
};

const api = await bundle('src/features/admin/api/vehicleApi.ts');
const helpers = await bundle('src/features/admin/lib/vehicleHelpers.ts');

const token = 'admin-jwt-token';
const calls = [];
const responses = [];
const ui = new EventTarget();
let rejectedSessions = 0;
ui.addEventListener('parkjom:auth-rejected', () => {
  rejectedSessions += 1;
});
globalThis.window = ui;

globalThis.fetch = async (path, options = {}) => {
  assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${token}`);
  calls.push({
    path,
    method: options.method ?? 'GET',
    body: options.body ? JSON.parse(options.body) : undefined,
  });
  const next = responses.shift();
  assert.ok(next, `Unexpected API request to ${path}`);
  return Response.json(next.body, { status: next.status ?? 200 });
};

console.log('\n[1] getAllVehicles normalizes casing and tolerates nullable brand/model/color');
responses.push({
  body: {
    code: 200,
    success: true,
    message: 'Loaded',
    data: [
      {
        VehicleId: 11,
        NumberPlate: ' e4444a ',
        VehicleBrand: 'Rolls-Royce',
        VehicleModel: 'Phantom',
        VehicleColor: 'Silver',
        CreatedAt: '2026-11-02T05:19:00Z',
        UpdatedAt: '2026-11-02T05:19:00Z',
        OwnerEmail: 'chunjia050614@gmail.com',
        OwnerName: 'CHAW CHUN JIA',
      },
      {
        vehicleId: 6,
        numberPlate: 'ven6993',
        vehicleBrand: null,
        vehicleModel: '',
        vehicleColor: null,
        createdAt: '2026-08-23T15:23:00Z',
        updatedAt: '2026-08-23T15:23:00Z',
        ownerEmail: 'support.parkjom@gmail.com',
        ownerName: 'ParkJom',
      },
    ],
  },
});

const listResult = await api.getAllVehicles(token);
assert.equal(listResult.data.length, 2);
assert.equal(listResult.data[0].numberPlate, 'E4444A');
assert.equal(listResult.data[1].numberPlate, 'VEN6993');
assert.equal(listResult.data[1].vehicleBrand, '');
assert.deepEqual(calls.at(-1), { path: '/api/vehicle/all', method: 'GET', body: undefined });

console.log('[2] createAdminVehicle validates and posts sanitized payload');
await assert.rejects(
  api.createAdminVehicle(token, { numberPlate: ' ', vehicleBrand: 'Perodua', vehicleModel: 'Myvi', vehicleColor: 'White' }),
  /required/i,
);
await assert.rejects(
  api.createAdminVehicle(token, { numberPlate: 'VAS 3243252353235235', vehicleBrand: 'Toyota', vehicleModel: 'Camry', vehicleColor: 'Silver' }),
  /valid Malaysian|characters/i,
);
responses.push({
  body: {
    code: 200,
    success: true,
    message: 'Vehicle added successfully.',
    data: {
      vehicleId: 12,
      numberPlate: 'VAB1234',
      vehicleBrand: 'Perodua',
      vehicleModel: 'Myvi',
      vehicleColor: 'White',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
      ownerEmail: 'admin@parkjom.my',
      ownerName: 'Admin',
    },
  },
});
const created = await api.createAdminVehicle(token, {
  numberPlate: ' vab1234 ',
  vehicleBrand: ' Perodua ',
  vehicleModel: ' Myvi ',
  vehicleColor: ' White ',
});
assert.equal(created.data?.vehicleId, 12);
assert.deepEqual(calls.at(-1), {
  path: '/api/vehicle/add',
  method: 'POST',
  body: {
    numberPlate: 'VAB1234',
    vehicleBrand: 'Perodua',
    vehicleModel: 'Myvi',
    vehicleColor: 'White',
  },
});

console.log('[3] updateAdminVehicle sends PUT /vehicle/modify and preserves session on 403');
responses.push({
  body: {
    code: 200,
    success: true,
    message: 'Vehicle updated successfully.',
    data: {
      vehicleId: 12,
      numberPlate: 'VAB9999',
      vehicleBrand: 'Perodua',
      vehicleModel: 'Ativa',
      vehicleColor: 'Blue',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:05:00Z',
      ownerEmail: 'admin@parkjom.my',
      ownerName: 'Admin',
    },
  },
});
const updated = await api.updateAdminVehicle(token, {
  vehicleId: 12,
  numberPlate: 'vab9999',
  vehicleBrand: 'Perodua',
  vehicleModel: 'Ativa',
  vehicleColor: 'Blue',
});
assert.equal(updated.data?.numberPlate, 'VAB9999');
assert.deepEqual(calls.at(-1), {
  path: '/api/vehicle/modify',
  method: 'PUT',
  body: {
    vehicleId: 12,
    numberPlate: 'VAB9999',
    vehicleBrand: 'Perodua',
    vehicleModel: 'Ativa',
    vehicleColor: 'Blue',
  },
});

responses.push({ status: 403, body: {} });
await assert.rejects(
  api.updateAdminVehicle(token, {
    vehicleId: 11,
    numberPlate: 'E4444A',
    vehicleBrand: 'Rolls-Royce',
    vehicleModel: 'Phantom',
    vehicleColor: 'Silver',
  }),
  /PUT \/api\/vehicle\/modify currently requires vehicle ownership/,
);

responses.push({ status: 403, body: { message: 'Only the vehicle owner can modify this vehicle.' } });
await assert.rejects(
  api.updateAdminVehicle(token, {
    vehicleId: 11,
    numberPlate: 'E4444A',
    vehicleBrand: 'Rolls-Royce',
    vehicleModel: 'Phantom',
    vehicleColor: 'Silver',
  }),
  /Only the vehicle owner can modify this vehicle/,
);

console.log('[4] deleteAdminVehicle calls DELETE /vehicle/delete/{id} and preserves session on error');
responses.push({
  body: { code: 200, success: true, message: 'Vehicle deleted successfully.' },
});
const deleted = await api.deleteAdminVehicle(token, 11);
assert.equal(deleted.success, true);
assert.deepEqual(calls.at(-1), {
  path: '/api/vehicle/delete/11',
  method: 'DELETE',
  body: undefined,
});

responses.push({
  status: 400,
  body: { success: false, message: 'Cannot delete vehicle with active bookings.' },
});
await assert.rejects(api.deleteAdminVehicle(token, 10), /Cannot delete vehicle with active bookings/);
assert.equal(rejectedSessions, 0, 'Vehicle mutation permission/business errors must not log out the admin');

console.log('[5] Vehicle filter, sort, ownership, and form validation helpers');
const sampleVehicles = [
  {
    vehicleId: 5,
    numberPlate: 'VIP 8',
    vehicleBrand: 'Toyota',
    vehicleModel: 'GR 86',
    vehicleColor: 'Gold',
    createdAt: '2026-08-23T14:34:00Z',
    updatedAt: '2026-08-30T03:32:00Z',
    ownerEmail: 'chunjia050614@gmail.com',
    ownerName: 'CHAW CHUN JIA',
  },
  {
    vehicleId: 6,
    numberPlate: 'VEN6993',
    vehicleBrand: 'Perodua',
    vehicleModel: 'Myvi',
    vehicleColor: 'Silver',
    createdAt: '2026-08-23T15:23:00Z',
    updatedAt: '2026-08-23T15:23:00Z',
    ownerEmail: 'support.parkjom@gmail.com',
    ownerName: 'ParkJom',
  },
  {
    vehicleId: 11,
    numberPlate: 'E4444A',
    vehicleBrand: 'Rolls-Royce',
    vehicleModel: 'Phantom',
    vehicleColor: 'Silver',
    createdAt: '2026-11-02T05:19:00Z',
    updatedAt: '2026-11-02T05:19:00Z',
    ownerEmail: 'chunjia050614@gmail.com',
    ownerName: 'CHAW CHUN JIA',
  },
];

const opts = helpers.extractVehicleFilterOptions(sampleVehicles);
assert.deepEqual(opts.brands, ['Perodua', 'Rolls-Royce', 'Toyota']);
assert.equal(opts.owners.length, 2);

assert.deepEqual(
  helpers.filterAndSortVehicles(sampleVehicles, {
    searchQuery: '#6',
    brandFilter: '',
    ownerFilter: '',
    sort: { column: 'id', direction: 'desc' },
    currentUserEmail: 'support.parkjom@gmail.com',
  }).map((v) => v.vehicleId),
  [6],
);

assert.deepEqual(
  helpers.filterAndSortVehicles(sampleVehicles, {
    searchQuery: '',
    brandFilter: '',
    ownerFilter: '__mine__',
    sort: { column: 'id', direction: 'desc' },
    currentUserEmail: 'SUPPORT.PARKJOM@GMAIL.COM',
  }).map((v) => v.vehicleId),
  [6],
);

assert.deepEqual(
  helpers.filterAndSortVehicles(sampleVehicles, {
    searchQuery: '',
    brandFilter: '',
    ownerFilter: '',
    sort: { column: 'plate', direction: 'asc' },
  }).map((v) => v.numberPlate),
  ['E4444A', 'VEN6993', 'VIP 8'],
);

assert.deepEqual(
  helpers.filterAndSortVehicles(sampleVehicles, {
    searchQuery: '',
    brandFilter: '',
    ownerFilter: '',
    sort: { column: 'plate', direction: 'desc' },
  }).map((vehicle) => vehicle.numberPlate),
  ['VIP 8', 'VEN6993', 'E4444A'],
);

assert.equal(helpers.validateVehicleForm({ numberPlate: 'ABC 123', vehicleBrand: 'Honda', vehicleModel: 'City', vehicleColor: 'White' }), null);
assert.match(helpers.validateVehicleForm({ numberPlate: '', vehicleBrand: 'Honda', vehicleModel: 'City', vehicleColor: 'White' }), /Number plate/);
assert.match(helpers.validateVehicleForm({ numberPlate: 'VAS 3243252353235235', vehicleBrand: 'Toyota', vehicleModel: 'Camry', vehicleColor: 'Silver' }), /valid Malaysian|characters/i);

assert.equal(responses.length, 0);
console.log('\nALL ADMIN VEHICLE CHECKS PASSED\n');
