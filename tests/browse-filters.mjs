import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

const result = buildSync({
  entryPoints: ['src/features/commuter/lib/browseFilters.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
});

const dir = mkdtempSync(join(tmpdir(), 'pj-browse-'));
const file = join(dir, 'browseFilters.mjs');
writeFileSync(file, result.outputFiles[0].text);
const {
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_BROWSE_FILTERS,
  countActiveBrowseFilters,
  filterSpotsWithQuery,
  matchesBrowseSpotFilters,
  matchesPublicLotFilters,
  sortBrowseSpots,
} = await import(`file://${file.replace(/\\/g, '/')}`);

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}`);
  }
}

const sampleSpots = [
  {
    id: '1',
    parkingSpotId: 1,
    parkingLabel: 'A-12',
    propertyId: 10,
    propertyName: 'PV18 Residences',
    address: 'Jalan Langkawi, Setapak',
    latitude: 3.21,
    longitude: 101.72,
    stationName: 'Taman Melati LRT',
    distanceToStation: 0.4,
    timeToStationInMinutes: 5,
    availabilityStatus: 'Available',
    monthlyRate: 240,
    dailyRate: 9,
    primaryImageUrl: null,
    station: 'Taman Melati LRT',
    name: 'PV18 Bay A-12',
    pricePerHour: 1.5,
    distance: 400,
    lat: 3.21,
    lng: 101.72,
    available: true,
    type: 'Condo Bay',
    owner: 'Owner A',
    hasEvCharging: true,
    evChargingSpeed: '22kW',
    isCovered: true,
    isHandicapAccessible: false,
    hasCctv: true,
    averageRating: 4.9,
    totalReviews: 12,
  },
  {
    id: '2',
    parkingSpotId: 2,
    parkingLabel: 'B-05',
    propertyId: 20,
    propertyName: 'PV128 Setapak',
    address: 'Jalan Genting Klang',
    latitude: 3.20,
    longitude: 101.73,
    stationName: 'Wangsa Maju LRT',
    distanceToStation: 1.4,
    timeToStationInMinutes: 16,
    availabilityStatus: 'Available',
    monthlyRate: 0,
    dailyRate: 14,
    primaryImageUrl: null,
    station: 'Wangsa Maju LRT',
    name: 'PV128 Bay B-05',
    pricePerHour: 2.0,
    distance: 1400,
    lat: 3.20,
    lng: 101.73,
    available: true,
    type: 'Condo Bay',
    owner: 'Owner B',
    hasEvCharging: false,
    isCovered: false,
    isHandicapAccessible: true,
    hasCctv: false,
    averageRating: 4.2,
    totalReviews: 3,
  },
];

const samplePublicLot = {
  publicParkingLotId: 99,
  lotName: 'Wangsa Walk Drive-In Lot',
  address: 'Wangsa Maju',
  totalCapacity: 120,
  availableSpaces: 45,
  hourlyRate: 2.0,
  dailyCapRate: 12,
  flatRatePerEntry: null,
  nearestStationName: 'Sri Rampai LRT',
  distanceToStation: 350,
};

console.log('[1] Category options include all 7 search sheet categories');
check(
  'all 7 labels preserved',
  CATEGORY_FILTER_OPTIONS.map((c) => c.label).join('|') ===
    'All Bays|Near Transit|Covered|EV Charging|CCTV Security|Monthly Pass|Accessible',
);

console.log('[2] Spot attribute & range filters match accurately');
check(
  'EV + Covered + CCTV matches spot 1 only',
  filterSpotsWithQuery(sampleSpots, { ...DEFAULT_BROWSE_FILTERS, categories: ['ev', 'covered', 'cctv'] }, '').length === 1,
);
check(
  'Accessible matches spot 2 only',
  matchesBrowseSpotFilters(sampleSpots[1], { ...DEFAULT_BROWSE_FILTERS, categories: ['accessible'] }) &&
    !matchesBrowseSpotFilters(sampleSpots[0], { ...DEFAULT_BROWSE_FILTERS, categories: ['accessible'] }),
);
check(
  'Monthly rate plan filters spot 1',
  filterSpotsWithQuery(sampleSpots, { ...DEFAULT_BROWSE_FILTERS, ratePlan: 'monthly' }, '').map((s) => s.parkingSpotId).join(',') === '1',
);
check(
  'Daily rate ceiling RM 10 excludes spot 2',
  filterSpotsWithQuery(sampleSpots, { ...DEFAULT_BROWSE_FILTERS, maxDailyRate: 10 }, '').map((s) => s.parkingSpotId).join(',') === '1',
);
check(
  'Max walk distance 0.5 km keeps only spot 1',
  filterSpotsWithQuery(sampleSpots, { ...DEFAULT_BROWSE_FILTERS, maxStationDistanceKm: 0.5 }, '').map((s) => s.parkingSpotId).join(',') === '1',
);
check(
  'Public scope hides private spots',
  filterSpotsWithQuery(sampleSpots, { ...DEFAULT_BROWSE_FILTERS, listingScope: 'public' }, '').length === 0,
);

console.log('[3] Public lot filtering respects scope, distance, rate, and text');
check(
  'Private scope hides public lot',
  !matchesPublicLotFilters(samplePublicLot, { ...DEFAULT_BROWSE_FILTERS, listingScope: 'private' }, ''),
);
check(
  'Near Transit + <= 500m keeps public lot',
  matchesPublicLotFilters(samplePublicLot, { ...DEFAULT_BROWSE_FILTERS, categories: ['transit'], maxStationDistanceKm: 0.5 }, 'Sri Rampai'),
);

console.log('[4] Active filter counter & sorting');
check(
  'counts multi-category + ratePlan + distance + query',
  countActiveBrowseFilters(
    { ...DEFAULT_BROWSE_FILTERS, categories: ['ev', 'cctv'], ratePlan: 'daily', maxStationDistanceKm: 0.5 },
    'Sentul',
    false,
  ) === 5,
);
check(
  'nearby sort puts closer spot first',
  sortBrowseSpots(sampleSpots, 'nearby', {
    currentLocation: { lat: 3.20, lng: 101.73 },
    spotRatings: {},
    distanceKmFn: (_o, s) => (s.parkingSpotId === 2 ? 0.1 : 1.5),
  })[0].parkingSpotId === 2,
);
check(
  'popular sort puts highest rated spot first',
  sortBrowseSpots(sampleSpots, 'popular', {
    currentLocation: null,
    spotRatings: {},
    distanceKmFn: () => 1,
  })[0].parkingSpotId === 1,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
