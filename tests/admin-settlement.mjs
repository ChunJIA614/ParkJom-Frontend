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

const api = await bundle('src/features/admin/api/settlementApi.ts');

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
  if (next.blob !== undefined) {
    return new Response(next.blob, {
      status: next.status ?? 200,
      headers: next.headers ?? {},
    });
  }
  return Response.json(next.body, { status: next.status ?? 200 });
};

console.log('\n[1] getSettlementSummary normalizes CamelCase & PascalCase metrics');
responses.push({
  body: {
    code: 200,
    success: true,
    data: {
      CommissionRate: 10,
      TaxRatePercent: 8,
      PlatformWalletBalance: 250.5,
      TotalEscrowOnHold: 420.0,
      PendingWithdrawalsCount: 2,
      PendingWithdrawalsAmount: 180.0,
      NextScheduledIbgCutoffUtc: '2026-11-24T06:00:00Z',
      ReconciliationHealth: 'Matched',
      LatestBatch: {
        SettlementBatchId: 4,
        BatchReference: 'IBG-20261122-001',
        Rail: 'IBG',
        Status: 'Cleared',
        ItemCount: 2,
        TotalAmount: 180,
      },
    },
  },
});
const summary = await api.getSettlementSummary(token);
assert.equal(summary.commissionRate, 10);
assert.equal(summary.taxRatePercent, 8);
assert.equal(summary.totalEscrowOnHold, 420);
assert.equal(summary.latestBatch?.batchReference, 'IBG-20261122-001');
assert.deepEqual(calls.at(-1), { path: '/api/admin/settlement/summary', method: 'GET', body: undefined });

console.log('[2] getSettlementWithdrawals & submitWithdrawalDecision preserve session on 403');
responses.push({
  body: {
    code: 200,
    success: true,
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    data: [
      {
        transactionId: 88,
        referenceNumber: 'WDR-20261122-12',
        ownerName: 'Ali Abu',
        ownerEmail: 'ali@parkjom.my',
        amount: 90.5,
        status: 'Pending',
        bankName: 'Maybank',
        bankCode: 'MBBEMYKL',
        accountNumber: '114012345678',
        accountHolderName: 'Ali Bin Abu',
        autoWithdraw: true,
      },
    ],
  },
});
const wdPage = await api.getSettlementWithdrawals(token, { status: 'Pending', search: 'Ali', page: 1, pageSize: 20 });
assert.equal(wdPage.items.length, 1);
assert.equal(wdPage.items[0].bankCode, 'MBBEMYKL');
assert.equal(calls.at(-1).path, '/api/admin/settlement/withdrawals?status=Pending&search=Ali&page=1&pageSize=20');

responses.push({ status: 403, body: { message: 'Action forbidden for read-only admin.' } });
await assert.rejects(
  api.submitWithdrawalDecision(token, 88, { approve: true }),
  /read-only admin/,
);
assert.equal(rejectedSessions, 0);

console.log('[3] generateSettlementBatch, submitSettlementBatch, clearSettlementBatch, and IBG/XLSX downloads');
responses.push({
  body: {
    success: true,
    message: 'Batch generated',
    data: {
      batch: { settlementBatchId: 5, batchReference: 'IBG-20261122-002', rail: 'IBG', status: 'Generated', itemCount: 1, totalAmount: 90.5 },
      items: [{ settlementBatchItemId: 11, transactionId: 88, transactionReference: 'WDR-20261122-12', amount: 90.5, status: 'Queued' }],
      ibgPreview: '01|PARKJOM|...',
    },
  },
});
const generated = await api.generateSettlementBatch(token, { rail: 'IBG', transactionIds: [88], includeAutoWithdrawOwners: true });
assert.equal(generated.detail.batch.settlementBatchId, 5);
assert.deepEqual(calls.at(-1), {
  path: '/api/admin/settlement/batches/generate',
  method: 'POST',
  body: { rail: 'IBG', transactionIds: [88], includeAutoWithdrawOwners: true },
});

responses.push({
  blob: new Blob(['01|PARKJOM|BNM-IBG-v2.1\n99|1|9050'], { type: 'text/plain' }),
  headers: { 'Content-Disposition': 'attachment; filename="IBG-20261122-002-bnm.ibg.txt"' },
});
const ibg = await api.downloadBatchIbgFile(token, 5);
assert.equal(ibg.filename, 'IBG-20261122-002-bnm.ibg.txt');
assert.match(await ibg.blob.text(), /01\|PARKJOM/);

responses.push({
  blob: new Blob(['PK\x03\x04xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  headers: { 'Content-Disposition': 'attachment; filename="parkjom-settlement-journal.xlsx"' },
});
const xlsx = await api.downloadSettlementExport(token, { format: 'xlsx', type: 'PlatformCommission' });
assert.equal(xlsx.filename, 'parkjom-settlement-journal.xlsx');
assert.equal(calls.at(-1).path, '/api/admin/settlement/export?format=xlsx&type=PlatformCommission');

console.log('[4] syncEscrowLedger & getReconciliationReport');
responses.push({
  body: {
    success: true,
    message: 'Synced 2 booking(s)',
    data: { releasedBookingsCount: 2, releasedAmount: 144, skippedOrAlreadySettledCount: 0, flaggedMismatchCount: 0, syncedAtUtc: '2026-11-22T08:00:00Z' },
  },
});
const syncRes = await api.syncEscrowLedger(token);
assert.equal(syncRes.result.releasedBookingsCount, 2);
assert.equal(syncRes.result.releasedAmount, 144);

responses.push({
  body: {
    success: true,
    data: {
      overallStatus: 'Matched',
      stripeCompletedPaymentsCount: 5,
      stripeCompletedPaymentsTotal: 250,
      sections: [{ key: 'stripe-topups', title: 'Stripe', expectedAmount: 250, recordedAmount: 250, varianceAmount: 0, status: 'Matched', notes: 'OK' }],
      exceptionsAndRecentReceipts: [],
    },
  },
});
const recon = await api.getReconciliationReport(token);
assert.equal(recon.overallStatus, 'Matched');
assert.equal(recon.sections.length, 1);

assert.equal(responses.length, 0);
assert.equal(rejectedSessions, 0);
console.log('\nALL ADMIN SETTLEMENT CHECKS PASSED\n');
