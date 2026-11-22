import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(entry, zone = 'Asia/Kuala_Lumpur') {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'import.meta.env.VITE_TIME_ZONE': JSON.stringify(zone) },
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const dates = await load('src/lib/dateTime.ts', 'Asia/Kuala_Lumpur');
const expected = Date.parse('2026-11-21T20:15:00Z');
for (const value of [expected, expected / 1000, String(expected), String(expected / 1000), '2026-11-21T20:15:00Z', '2026-11-22T04:15:00+08:00', new Date(expected)]) {
  assert.equal(dates.parseTimestamp(value).getTime(), expected);
}
assert.equal(dates.parseTimestamp(0).toISOString(), '1970-01-01T00:00:00.000Z');
assert.equal(dates.parseTimestamp(-1).getTime(), -1000);
for (const value of [null, undefined, '', 'invalid', NaN, Infinity]) assert.ok(Number.isNaN(dates.parseTimestamp(value).getTime()));
const originalZone = process.env.TZ;
try {
  for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = zone;
    const date = dates.parseTimestamp(expected / 1000);
    assert.equal(dates.displayDateKey(date), '2026-11-22');
    assert.equal(date.toLocaleTimeString('en-GB', dates.displayDateOptions({ hour: '2-digit', minute: '2-digit', hour12: false })), '04:15');
    // A calendar date must stay on the user's selected date, even across device zones.
    assert.equal(new Intl.DateTimeFormat('en-CA', dates.displayDateOptions({ year: 'numeric', month: '2-digit', day: '2-digit' }, true)).format(new Date(2026, 10, 22)), '2026-11-22');
  }
} finally { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; }
const utc = await load('src/lib/dateTime.ts', 'UTC');
assert.equal(utc.displayDateKey(utc.parseTimestamp(expected)), '2026-11-21');
console.log('Timestamp parsing, UTC+8 rollover, device-zone independence, environment override, and calendar dates passed.');
