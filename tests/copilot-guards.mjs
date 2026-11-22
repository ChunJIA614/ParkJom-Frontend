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
  evaluateProposalAvailability,
  sanitizeCopilotCard,
  sanitizeCopilotInput,
  sanitizeSafeImageUrl,
} = await bundle('src/features/copilot/lib/copilotGuards.ts');

console.log('\n[1] sanitizeSafeImageUrl allows https/http/relative and blocks script/data URIs');
assert.equal(sanitizeSafeImageUrl('https://cdn.parkjom.my/bay.jpg'), 'https://cdn.parkjom.my/bay.jpg');
assert.equal(sanitizeSafeImageUrl('/api/media/view/image/9'), '/api/media/view/image/9');
assert.equal(sanitizeSafeImageUrl('javascript:alert(1)'), null);
assert.equal(sanitizeSafeImageUrl('data:text/html,<script>alert(1)</script>'), null);
assert.equal(sanitizeSafeImageUrl('//evil.example/img.png'), null);

console.log('[2] sanitizeCopilotCard accepts valid cards and rejects malformed or injected cards');
const validParking = sanitizeCopilotCard({
  type: 'parking',
  data: {
    parkingSpotId: 104,
    parkingLabel: '104/3',
    propertyName: 'PV 9 Setapak',
    address: '19, Jalan Kampung Wira Jaya',
    distanceToStationMeters: 250,
    walkingTimeMinutes: 3,
    dailyRate: 3,
    monthlyRate: 90,
    availabilityStatus: 'Available',
    hasSmartBollard: true,
    stationName: 'Taman Melati',
    stopId: 'KJ2',
    lineName: 'Kelana Jaya Line',
    primaryImageUrl: 'javascript:alert(1)',
    isCovered: true,
    hasEvCharging: true,
    hasCctv: true,
    availableOnRequestedDate: false,
    nextAvailableDate: '2026-11-25',
  },
});
assert.equal(validParking?.type, 'parking');
assert.equal(validParking?.data.primaryImageUrl, null);
assert.equal(validParking?.data.isCovered, true);
assert.equal(validParking?.data.hasEvCharging, true);
assert.equal(validParking?.data.hasCctv, true);
assert.equal(validParking?.data.availableOnRequestedDate, false);
assert.equal(validParking?.data.nextAvailableDate, '2026-11-25');

const validPublicLot = sanitizeCopilotCard({
  type: 'publicParking',
  data: {
    publicParkingLotId: 7,
    lotName: 'Subang Walk Public Lot',
    address: 'Jalan SS 15/4, Subang Jaya',
    latitude: 3.0762,
    longitude: 101.5861,
    distanceMeters: 180,
    walkingTimeMinutes: 3,
    availableSpaces: 42,
    totalCapacity: 120,
    isCurrentlyOpen: true,
    openingTime: '06:00',
    closingTime: '23:30',
    hourlyRate: 2.5,
    dailyCapRate: 12,
    flatRatePerEntry: null,
    nearestStationName: 'SS 15',
    facilityPhotoUrl: 'data:text/html,<script>alert(1)</script>',
  },
});
assert.equal(validPublicLot?.type, 'publicParking');
assert.equal(validPublicLot?.data.facilityPhotoUrl, null);
assert.equal(validPublicLot?.data.availableSpaces, 42);

assert.equal(
  sanitizeCopilotCard({
    type: 'publicParking',
    data: {
      publicParkingLotId: 0,
      lotName: 'Invalid Lot',
      availableSpaces: -1,
      totalCapacity: 10,
      hourlyRate: 2,
    },
  }),
  null,
);

assert.equal(
  sanitizeCopilotCard({
    type: 'publicParking',
    data: {
      publicParkingLotId: 9,
      lotName: 'Bad Spaces',
      availableSpaces: -5,
      totalCapacity: 10,
      hourlyRate: 2,
    },
  }),
  null,
);

assert.equal(
  sanitizeCopilotCard({
    type: 'bookingProposal',
    data: {
      parkingSpotId: -5,
      parkingLabel: '104/3',
      propertyName: 'PV 9 Setapak',
      address: 'Setapak',
      startDate: '2026-11-24',
      endDate: '2026-11-24',
      days: 1,
      dailyRate: 3,
      estimatedSubtotal: 3,
    },
  }),
  null,
);

assert.equal(
  sanitizeCopilotCard({
    type: 'bookingProposal',
    data: {
      parkingSpotId: 104,
      parkingLabel: '104/3',
      propertyName: 'PV 9 Setapak',
      address: 'Setapak',
      startDate: '2026-11-24',
      endDate: '2027-02-01',
      days: 70,
      dailyRate: 3,
      estimatedSubtotal: 210,
    },
  }),
  null,
);

console.log('[3] sanitizeCopilotInput strips control chars and clamps length');
assert.equal(sanitizeCopilotInput('  book\x00 pv9\x1F 24th  '), 'book pv9 24th');
assert.equal(sanitizeCopilotInput('a'.repeat(1200), 1000).length, 1000);

console.log('[4] evaluateProposalAvailability detects unavailable proposed dates (Screenshot 1)');
const availability = {
  '2026-11': {
    code: 200,
    success: true,
    message: 'ok',
    parkingSpotId: 104,
    month: '2026-11',
    timeZone: 'Asia/Kuala_Lumpur',
    minimumBookingDate: '2026-11-23',
    totalAvailableDates: 2,
    availableDates: [
      { date: '2026-11-23', timeRanges: [{ from: '07:00', to: '22:00' }] },
      { date: '2026-11-25', timeRanges: [{ from: '07:00', to: '22:00' }] },
    ],
  },
};

const unavailableVerdict = evaluateProposalAvailability(
  { startDate: '2026-11-24', endDate: '2026-11-24' },
  availability,
);
assert.equal(unavailableVerdict.status, 'unavailable');
assert.equal(unavailableVerdict.nextAvailableDate, '2026-11-25');
assert.match(unavailableVerdict.reason, /24 Nov 2026/);

const availableVerdict = evaluateProposalAvailability(
  { startDate: '2026-11-25', endDate: '2026-11-25' },
  availability,
);
assert.equal(availableVerdict.status, 'available');
assert.equal(availableVerdict.reason, null);

console.log('\nALL COPILOT GUARD CHECKS PASSED\n');
