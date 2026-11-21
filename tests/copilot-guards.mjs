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
  },
});
assert.equal(validParking?.type, 'parking');
assert.equal(validParking?.data.primaryImageUrl, null);

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
