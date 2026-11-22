import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';

// Run with a local Vite server. Commands are in-memory fixtures; no real device is controlled.
const base = process.env.PARKJOM_TEST_BASE_URL || 'http://127.0.0.1:4187';
const browserPath = process.env.PARKJOM_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const statusBase = process.env.PARKJOM_STATUS_BASE_URL || 'http://127.0.0.1:4010/parkjom/api';
const statusControl = statusBase.replace(/\/api$/, '');
const actualStatusApi = fs.readFileSync('src/features/commuter/api/iotApi.ts', 'utf8').split('export type BookingBollardPosition')[1];
const output = process.env.PARKJOM_TEST_OUTPUT_DIR || '.tmp-shots/bollard-control';
fs.mkdirSync(output, { recursive: true });
const fixtureApi = `import { getIoTStatus } from '@/services/iotManagementApi';

const state = window.__bollardTest = { commands: [], failNextLock: true };
export const isUnlockChallengeCurrent = () => true;
export async function prepareBollardUnlock() {
  state.commands.push('prepare');
  return { bookingId: 42, challengeId: 'test', deviceUuid: 'test', nonce: 'test', expiresAt: new Date(Date.now()+60000).toISOString() };
}
export async function findRememberedBollard() { return undefined; }
export async function completeBollardUnlock(_token, _challenge, options) {
  state.commands.push('unlock'); options.onSubmitted();
  await new Promise(resolve => { state.confirmUnlock = resolve; });
  return { message: 'Unlock confirmed by device.' };
}
export async function performLockBollardCommand() {
  state.commands.push('lock');
  await new Promise(resolve => { state.confirmLock = resolve; });
  if (state.failNextLock) { state.failNextLock = false; throw new Error('Device did not confirm lock.'); }
  return { message: 'Lock confirmed by device.' };
}`;
const { outputFiles } = await build({
  stdin: { contents: `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MyParkingPassesWorkspace } from './src/features/commuter/components/MyParkingPassesWorkspace';
const booking = { id: 'fixture-42', bookingId: 42, bookingReference: 'PJ-TEST', status: 'Active', startTime: new Date(), endTime: new Date(Date.now()+7*86400000), vehiclePlate: 'WXY 1234', totalPaid: 25,
spot: { parkingSpotId: 1, propertyName: 'USJ One Avenue Condominium', name: 'USJ One Avenue', parkingLabel: 'A-12', stationName: 'USJ 7', primaryImageUrl: null } };
function Harness() { const [detail, setDetail] = useState(false); return <main className="app-workspace page-shell min-h-screen p-4 sm:p-8"><header>{!detail && <h1>My Parking Pass (1)</h1>}</header><MyParkingPassesWorkspace onDetailViewChange={setDetail} token="fixture-token" bookings={[booking]} onRefreshBookings={async()=>{}} onNavigateToMap={()=>{}} onOpenSupport={()=>{}} onFindMoreParking={()=>{}} /></main>; } createRoot(document.getElementById('root')).render(<Harness />);
`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'esm', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_TIME_ZONE': '"Asia/Kuala_Lumpur"', 'import.meta.env.VITE_API_BASE': JSON.stringify(statusBase) },
  plugins: [{ name: 'fixture-bollard-commands', setup(plugin) {
    plugin.onLoad({ filter: /[\\/]commuter[\\/]api[\\/]iotApi\.ts$/ }, () => ({ contents: fixtureApi + '\nexport type BookingBollardPosition' + actualStatusApi, loader: 'ts' }));
    plugin.onLoad({ filter: /[\\/]commuter[\\/]api[\\/]bookingApi\.ts$/ }, () => ({ contents: 'export const cancelBooking = async () => ({}); export const getBookingIsLastDay = async () => ({ isLastDay: false, isComplete: false }); export const evaluateBookingCancellationEligibility = () => ({ canCancel: false });', loader: 'ts' }));
    plugin.onLoad({ filter: /[\\/]commuter[\\/]pages[\\/]ParkingReview\.tsx$/ }, () => ({ contents: 'export default function ParkingReview() { return null; }', loader: 'tsx' }));
  } }],
});
const script = outputFiles[0].text;
fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/bollard-browser.js', script);
const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
try {
  for (const [theme, width] of [['light', 1440], ['dark', 1440], ['light', 390], ['dark', 390]]) {
    await fetch(statusControl + '/__scenario', { method: 'POST', body: JSON.stringify({ position: 'LOCKED' }) });
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1050, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      if (url.pathname === '/__bollard-fixture') return request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html class="'+theme+'"><head><link rel="stylesheet" href="/src/app/styles/index.css"></head><body><div id="root"></div><script type="module" src="/__bollard-fixture.js"></script></body></html>' });
      if (url.pathname === '/__bollard-fixture.js') return request.respond({ status: 200, contentType: 'text/javascript', body: script });
      if (url.origin !== new URL(base).origin && url.origin !== new URL(statusBase).origin) return request.abort();
      return request.continue();
    });
    fs.writeFileSync('.tmp/bollard-browser.html', '<!doctype html><html class="' + theme + '"><head><link rel="stylesheet" href="/src/app/styles/index.css"></head><body><div id="root"></div><script type="module" src="/.tmp/bollard-browser.js"></script></body></html>');
    await page.goto(base + '/.tmp/bollard-browser.html', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Gate controls')));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Gate controls')).click());
    await page.waitForSelector('[role="switch"]');
    const toggle = await page.$('[role="switch"]');
    assert.equal(await toggle.evaluate(el => el.disabled), true, 'Initial status read disables the switch');
    await page.waitForFunction(() => document.querySelector('[role="switch"]').disabled === false);
    assert.equal(await page.$('h1'), null, 'Hide parent heading inside controls');
    const initialReads = await fetch(statusControl + '/__requests').then(r => r.json());
    assert.deepEqual(initialReads, [{ method: 'GET', path: '/api/iot/status?bookingId=42' }]);
    assert.equal(await toggle.evaluate(el => el.getAttribute('aria-checked')), 'false');
    await toggle.click();
    await page.waitForFunction(() => document.getElementById('commuter-bollard-toggle-help')?.textContent.includes('connect Bluetooth'));
    assert.deepEqual(await page.evaluate(() => window.__bollardTest.commands), ['prepare']);
    await toggle.click();
    await page.waitForFunction(() => typeof window.__bollardTest.confirmUnlock === 'function');
    assert.equal(await toggle.evaluate(el => el.disabled), true);
    assert.equal(await toggle.evaluate(el => el.getAttribute('aria-checked')), 'false', 'Do not report unlocked before acknowledgement');
    await page.evaluate(() => window.__bollardTest.confirmUnlock());
    await page.waitForFunction(() => document.querySelector('[role="switch"]').getAttribute('aria-checked') === 'true');
    await page.waitForFunction(() => document.querySelector('[role="img"] .duration-700').getBoundingClientRect().height <= 24);
    const visual = await page.evaluate(() => {
      const stage = document.querySelector('[role="img"][aria-label^="Bollard animation"]');
      const control = document.querySelector('[role="switch"]');
      const stageRect = stage.getBoundingClientRect(), toggleRect = control.getBoundingClientRect();
      return { stacked: toggleRect.top > stageRect.bottom && Math.abs((toggleRect.left + toggleRect.width / 2) - (stageRect.left + stageRect.width / 2)) < 4,
        samePanel: stage.closest('section[aria-label="Bollard control"]') === control.closest('section[aria-label="Bollard control"]'),
        uniformActions: [...document.querySelectorAll('nav[aria-label="Bollard navigation"] button')].slice(1).every(button => button.classList.contains('workspace-button--secondary')),
        background: getComputedStyle(stage).backgroundColor, gradient: getComputedStyle(stage).backgroundImage, overflow: document.documentElement.scrollWidth > innerWidth, animatedPost: !!stage.querySelector('.duration-700') };
    });
    assert.equal(visual.stacked, true, 'Toggle must sit directly below and centered on the animation');
    assert.equal(visual.samePanel, true, 'Animation and switch share one vertical panel');
    assert.equal(visual.uniformActions, true, 'Toolbar uses shared action styles');
    assert.equal(visual.background, 'rgba(0, 0, 0, 0)');
    assert.equal(visual.gradient, 'none');
    assert.equal(visual.overflow, false);
    assert.equal(visual.animatedPost, true);
    await page.screenshot({ path: path.join(output, 'bollard-' + theme + '-' + width + '.png'), fullPage: true });
    await toggle.click();
    await page.waitForFunction(() => typeof window.__bollardTest.confirmLock === 'function');
    await page.evaluate(() => { const done = window.__bollardTest.confirmLock; delete window.__bollardTest.confirmLock; done(); });
    await page.waitForFunction(() => document.body.textContent.includes('Device did not confirm lock.'));
    await toggle.click();
    await page.waitForFunction(() => typeof window.__bollardTest.confirmLock === 'function');
    assert.deepEqual(await page.evaluate(() => window.__bollardTest.commands), ['prepare', 'unlock', 'lock', 'lock'], 'Retry a failed lock, rather than unlocking');
    await page.evaluate(() => window.__bollardTest.confirmLock());
    await page.waitForFunction(() => document.querySelector('[role="switch"]').disabled === false && document.querySelector('[role="switch"]').getAttribute('aria-checked') === 'false');
    await page.waitForFunction(() => document.querySelector('[role="img"] .duration-700').getBoundingClientRect().height >= 100);
    const toolbar = await page.$eval('nav[aria-label="Bollard navigation"]', el => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; });
    await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Bollard navigation"] button')].find(button => button.textContent.includes('Booking details')).click());
    await page.waitForSelector('nav[aria-label="Receipt navigation"]');
    const receiptToolbar = await page.$eval('nav[aria-label="Receipt navigation"]', el => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; });
    assert.ok(Math.abs(toolbar.width - receiptToolbar.width) < 1 && Math.abs(toolbar.x - receiptToolbar.x) < 1, 'Toolbar width and alignment stay fixed between views');
    assert.equal(await page.$('h1'), null, 'Hide parent heading inside receipt');
    await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Receipt navigation"] button')].find(button => button.textContent.includes('Back to My Passes')).click());
    await page.waitForSelector('h1');
    assert.equal(await page.$eval('h1', el => el.textContent), 'My Parking Pass (1)');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Get directions, manage the booking, or open gate controls.')), false);
    // A failed initial read must not guess a position or send an unlock command.
    await fetch(statusControl + '/__scenario', { method: 'POST', body: JSON.stringify({ status: 503 }) });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Gate controls')).click());
    await page.waitForFunction(() => document.body.textContent.includes('Status service unavailable'));
    assert.equal(await page.$eval('[role="switch"]', el => el.disabled), true);
    const commandsBefore = await page.evaluate(() => window.__bollardTest.commands.length);
    await fetch(statusControl + '/__scenario', { method: 'POST', body: JSON.stringify({ position: 'UNLOCKED' }) });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Check position').click());
    await page.waitForFunction(() => document.querySelector('[role="switch"]').getAttribute('aria-checked') === 'true' && !document.querySelector('[role="switch"]').disabled);
    assert.equal(await page.evaluate(() => window.__bollardTest.commands.length), commandsBefore, 'Status refresh never sends movement commands');

    await fetch(statusControl + '/__scenario', { method: 'POST', body: JSON.stringify({ position: null, receivedAt: null, sensorStatus: 'unknown', distanceCm: null, heartbeatStatus: 'unknown' }) });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Check position').click());
    await page.waitForFunction(() => document.body.textContent.includes('No device reading recorded yet.'));
    assert.equal(await page.$eval('[role="switch"]', el => el.disabled), true, 'No history must not imply locked');
    await fetch(statusControl + '/__scenario', { method: 'POST', body: JSON.stringify({ position: 'LOCKED', sensorStatus: 'unavailable', distanceCm: null, heartbeatStatus: 'offline', receivedAt: '2020-01-01T00:00:00Z' }) });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Check position').click());
    await page.waitForFunction(() => document.body.textContent.includes('Distance sensor unavailable.') && document.body.textContent.includes('Device offline'));
    assert.equal(await page.$eval('[role="switch"]', el => el.getAttribute('aria-checked')), 'false');
    assert.equal(await page.evaluate(() => window.__bollardTest.commands.length), commandsBefore, 'Reading partial/offline status does not send a movement command');
    assert.deepEqual(errors, []);
    console.log(theme + ' ' + width + ': initial HTTP status, failure/retry, heading visibility, fixed toolbar, vertical panel, Bluetooth handoff, lock retry, and both-theme animation passed.');
    await page.close();
  }
} finally { await browser.close(); }
