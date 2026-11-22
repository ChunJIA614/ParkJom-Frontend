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

const api = await bundle('src/features/admin/api/overstayApi.ts');

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

console.log('\n[1] getOverstaySummary & getOverstayCases normalize worker and case data');
responses.push({
  body: {
    success: true,
    data: {
      GracePeriodMinutes: 15,
      PenaltyMultiplier: 1.5,
      MaxDailyPenalty: 30,
      HardwareExitLockEnabled: true,
      ActiveOverstaysCount: 2,
      HardwareLockedCount: 1,
      WorkerStatus: {
        Enabled: true,
        IsRunning: true,
        IntervalSeconds: 60,
        TotalScansCompleted: 42,
      },
    },
  },
});
const summary = await api.getOverstaySummary(token);
assert.equal(summary.gracePeriodMinutes, 15);
assert.equal(summary.penaltyMultiplier, 1.5);
assert.equal(summary.workerStatus.isRunning, true);
assert.equal(summary.workerStatus.totalScansCompleted, 42);
assert.equal(calls.at(-1).path, '/api/admin/overstays/summary');

responses.push({
  body: {
    success: true,
    totalCount: 1,
    page: 1,
    pageSize: 15,
    totalPages: 1,
    data: [
      {
        overstayCaseId: 7,
        caseReference: 'OVS-20261122-0007',
        bookingId: 214,
        bookingReference: 'BK-214',
        renterName: 'Chun Jia',
        renterEmail: 'driver@parkjom.my',
        vehiclePlate: 'VAB1234',
        spotLabel: 'Bay A-12',
        propertyName: 'PV18 Residences',
        esp32Serial: 'ESP32-001',
        overstayMinutes: 75,
        billableHours: 2,
        baseHourlyRate: 5,
        penaltyMultiplier: 1.5,
        hourlyPenaltyTariff: 7.5,
        calculatedPenaltyAmount: 15,
        debitedAmount: 0,
        waivedAmount: 0,
        remainingDueAmount: 15,
        status: 'Penalized',
        paymentStatus: 'PaymentDue',
        hardwareLockActive: true,
      },
    ],
  },
});
const page = await api.getOverstayCases(token, { hardwareLocked: true, search: 'VAB', page: 1, pageSize: 15 });
assert.equal(page.items.length, 1);
assert.equal(page.items[0].hardwareLockActive, true);
assert.equal(page.items[0].hourlyPenaltyTariff, 7.5);
assert.equal(calls.at(-1).path, '/api/admin/overstays?hardwareLocked=true&search=VAB&page=1&pageSize=15');

console.log('[2] Operator actions: scan, warn, waive, dispute, release, and policy update');
responses.push({
  body: {
    success: true,
    message: 'Scan complete',
    data: { activeBookingsScanned: 3, casesDetectedOrUpdated: 1, warningsDispatched: 1, penaltiesDebited: 0, casesAutoResolved: 0 },
  },
});
const scan = await api.triggerOverstayScan(token);
assert.equal(scan.result.casesDetectedOrUpdated, 1);
assert.equal(calls.at(-1).method, 'POST');

responses.push({
  body: { success: true, message: 'Warned', data: { overstayCaseId: 7, caseReference: 'OVS-20261122-0007', status: 'WarningSent' } },
});
const warned = await api.dispatchOverstayWarning(token, 7, true);
assert.equal(warned.item.status, 'WarningSent');
assert.deepEqual(calls.at(-1), { path: '/api/admin/overstays/7/warn', method: 'POST', body: { forceResend: true } });

responses.push({
  body: { success: true, message: 'Waived', data: { overstayCaseId: 7, caseReference: 'OVS-20261122-0007', status: 'Waived', waivedAmount: 15 } },
});
const waived = await api.waiveOverstayPenalty(token, 7, { reason: 'Sensor calibration delay' });
assert.equal(waived.item.status, 'Waived');
assert.deepEqual(calls.at(-1), {
  path: '/api/admin/overstays/7/waive',
  method: 'POST',
  body: { reason: 'Sensor calibration delay' },
});

responses.push({
  body: { success: true, message: 'Dispute reviewed', data: { overstayCaseId: 7, caseReference: 'OVS-20261122-0007', status: 'Disputed' } },
});
await api.reviewOverstayDispute(token, 7, { action: 'flag', notes: 'Awaiting dashcam evidence' });
assert.deepEqual(calls.at(-1), {
  path: '/api/admin/overstays/7/dispute',
  method: 'POST',
  body: { action: 'flag', notes: 'Awaiting dashcam evidence' },
});

responses.push({
  body: {
    success: true,
    message: 'Security release applied',
    data: {
      case: { overstayCaseId: 7, hardwareLockActive: false, status: 'Resolved' },
      bollardUnlockAttempted: true,
      bollardUnlockSucceeded: true,
      bollardOutcome: 'Unlocked',
    },
  },
});
const released = await api.releaseOverstayHardwareLock(token, 7, {
  reason: 'Verified driver settled balance',
  triggerBollardUnlock: true,
  markResolved: true,
});
assert.equal(released.result.bollardUnlockSucceeded, true);
assert.equal(released.result.case.hardwareLockActive, false);

responses.push({ status: 403, body: { message: 'Security release requires supervisor permission.' } });
await assert.rejects(
  api.releaseOverstayHardwareLock(token, 7, { reason: 'Test' }),
  /supervisor permission/,
);
assert.equal(rejectedSessions, 0, 'Overstay 403 error must not log out the admin');

responses.push({
  body: {
    success: true,
    message: 'Policy saved',
    data: { commissionRate: 10, gracePeriodMinutes: 20, overstayPenaltyMultiplier: 1.8, overstayMaxDailyPenalty: 40, hardwareExitLockEnabled: true, taxRatePercent: 8 },
  },
});
const policy = await api.updateOverstayPolicy(token, { gracePeriodMinutes: 20, overstayPenaltyMultiplier: 1.8 });
assert.equal(policy.config.gracePeriodMinutes, 20);
assert.equal(policy.config.overstayPenaltyMultiplier, 1.8);

assert.equal(responses.length, 0);
console.log('\nALL ADMIN OVERSTAY CHECKS PASSED\n');
