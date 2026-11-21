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
  findNearestAvailableDate,
  getMonthsBetween,
  isValidIsoDateKey,
  validateBookingDateRange,
  validateQuoteMatchesSelection,
} = await bundle('src/features/commuter/lib/bookingDateValidation.ts');

const makeAvailability = (month, dates, minimumBookingDate = '2026-11-22') => ({
  code: 200,
  success: true,
  message: 'ok',
  parkingSpotId: 10,
  month,
  timeZone: 'Asia/Kuala_Lumpur',
  minimumBookingDate,
  totalAvailableDates: dates.length,
  availableDates: dates.map((date) => ({ date, timeRanges: [{ from: '07:00', to: '22:00' }] })),
});

const novMap = {
  // 24 Nov is unavailable/booked, 22, 23, 25 are open
  '2026-11': makeAvailability('2026-11', ['2026-11-22', '2026-11-23', '2026-11-25']),
};

console.log('\n[1] Consecutive available 1-day and multi-day ranges pass');
const oneDay = validateBookingDateRange({
  startDate: '2026-11-22',
  endDate: '2026-11-22',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(oneDay.isValid, true);
assert.deepEqual(oneDay.openDates, ['2026-11-22']);

const twoDays = validateBookingDateRange({
  startDate: '2026-11-22',
  endDate: '2026-11-23',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(twoDays.isValid, true);
assert.deepEqual(twoDays.openDates, ['2026-11-22', '2026-11-23']);

console.log('[2] Single unavailable date and ranges spanning an unavailable date are rejected');
const singleUnavailable = validateBookingDateRange({
  startDate: '2026-11-24',
  endDate: '2026-11-24',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(singleUnavailable.isValid, false);
assert.match(singleUnavailable.error, /not available/i);

const gapRange = validateBookingDateRange({
  startDate: '2026-11-22',
  endDate: '2026-11-25',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(gapRange.isValid, false);
assert.deepEqual(gapRange.unavailableDates, ['2026-11-24']);
assert.match(gapRange.error, /24 Nov 2026/);

console.log('[3] Range where only 1 date is valid out of 4 days (Screenshot 4 regression) is rejected');
const onlyOneValidOutOfFour = validateBookingDateRange({
  startDate: '2026-11-22',
  endDate: '2026-11-25',
  availabilityByMonth: {
    '2026-11': makeAvailability('2026-11', ['2026-11-23']),
  },
  minimumBookingDate: '2026-11-22',
});
assert.equal(onlyOneValidOutOfFour.isValid, false);
assert.deepEqual(onlyOneValidOutOfFour.openDates, ['2026-11-23']);
assert.deepEqual(onlyOneValidOutOfFour.unavailableDates, ['2026-11-22', '2026-11-24', '2026-11-25']);

console.log('[4] Dates before minimumBookingDate, impossible dates, and missing months are handled');
const beforeMin = validateBookingDateRange({
  startDate: '2026-11-21',
  endDate: '2026-11-22',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(beforeMin.isValid, false);
assert.match(beforeMin.error, /Bookings open from/);

assert.equal(isValidIsoDateKey('2026-02-30'), false);
assert.equal(isValidIsoDateKey('2026-11-24'), true);

assert.deepEqual(getMonthsBetween('2026-11-29', '2027-01-02'), ['2026-11', '2026-12', '2027-01']);
const missingMonth = validateBookingDateRange({
  startDate: '2026-11-25',
  endDate: '2026-12-01',
  availabilityByMonth: novMap,
  minimumBookingDate: '2026-11-22',
});
assert.equal(missingMonth.isValid, false);
assert.equal(missingMonth.isLoadingMonths, true);
assert.deepEqual(missingMonth.missingMonths, ['2026-12']);

console.log('[5] findNearestAvailableDate and validateQuoteMatchesSelection detect mismatches');
assert.equal(findNearestAvailableDate(novMap, '2026-11-24', '2026-11-22'), '2026-11-25');

const futureExpiry = new Date(Date.now() + 30 * 60_000).toISOString();
const staleQuoteError = validateQuoteMatchesSelection(
  {
    quoteId: 'q-1',
    parkingSpotId: 10,
    startDate: '2026-11-22',
    endDate: '2026-11-25',
    bookedDays: 4,
    rateType: 'Daily',
    ratePerDay: 3,
    rentalSubtotal: 12,
    expiresAt: futureExpiry,
    platformFee: 1.2,
    renterTotal: 12,
  },
  '2026-11-22',
  '2026-11-25',
  1,
);
assert.match(staleQuoteError, /does not match your 1 available selected day/i);

const validQuoteError = validateQuoteMatchesSelection(
  {
    quoteId: 'q-2',
    parkingSpotId: 10,
    startDate: '2026-11-22',
    endDate: '2026-11-23',
    bookedDays: 2,
    rateType: 'Daily',
    ratePerDay: 3,
    rentalSubtotal: 6,
    expiresAt: futureExpiry,
    platformFee: 0.6,
    renterTotal: 6,
  },
  '2026-11-22',
  '2026-11-23',
  2,
);
assert.equal(validQuoteError, null);

console.log('\nALL BOOKING DATE VALIDATION CHECKS PASSED\n');
