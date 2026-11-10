import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import pup from 'puppeteer-core';
// Run against a local Vite dev server. All API requests use fixtures; no real account is used.
const base = process.env.PARKJOM_TEST_BASE_URL || 'https://localhost:4187';
const browserPath = process.env.PARKJOM_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = fileURLToPath(new URL('../.tmp-shots/login-updates/', import.meta.url));
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const browser = await pup.launch({ executablePath: browserPath, headless: true, acceptInsecureCerts: true });
    const results = [];
    try {
        async function page({ auth = false, welcome = false, slow = false, fail = false, width = 390, height = 844 } = {}) {
            const c = await browser.createBrowserContext(), p = await c.newPage();
            await p.setViewport({ width, height, isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 1 });
            let moduleRequests = 0, documentLoads = 0;
            await p.setRequestInterception(true);
            p.on('request', async (r) => {
                try {
                    const u = new URL(r.url());
                    if (r.isNavigationRequest() && r.resourceType() === 'document')
                        documentLoads++;
                    if (u.pathname.includes('/CommuterDashboard.tsx')) {
                        moduleRequests++;
                        if (fail && documentLoads === 1)
                            return await r.abort();
                        if (slow)
                            await pause(5000);
                        return await r.continue();
                    }
                    if (u.pathname.startsWith('/api') || u.pathname.includes('/hubs/')) {
                        let data = { code: 200, success: true, data: [], items: [], totalUnread: 0, total: 0, byCategory: {}, hasMore: false, current: null, upcoming: [] };
                        if (u.pathname.endsWith('/negotiate'))
                            data = { connectionId: 'test', connectionToken: 'test', availableTransports: [] };
                        return await r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
                    }
                    if (u.origin === new URL(base).origin)
                        return await r.continue();
                    await r.abort();
                }
                catch {
                }
            });
            await p.evaluateOnNewDocument((auth, welcome) => {
                localStorage.setItem('parkjom-theme', 'light');
                if (auth) {
                    localStorage.setItem('parkjom_user', JSON.stringify({ userId: 900002, email: 'test@example.test', firstName: 'Layout', lastName: 'Tester', picture: '', phoneNumber: '0123456789', role: 'Commuter', userType: 3, token: 'layout-test-token', isProfileComplete: true }));
                    localStorage.setItem('parkjom_icon_tour_done_v1_Commuter_900002', 'true');
                    if (!welcome)
                        sessionStorage.setItem('parkjom_welcome_seen_v1_900002', 'true');
                }
                document.addEventListener('DOMContentLoaded', () => {
                    document.documentElement.style.setProperty('--safe-area-inset-top', '48px');
                    document.documentElement.style.setProperty('--safe-area-inset-bottom', '26px');
                    const state = { welcomeMounts: 0, plainLoaderSeen: false, lastWelcome: false };
                    window.__loginAudit = state;
                    const observe = () => {
                        const visible = !!document.querySelector('[aria-label="Welcome to ParkJom"]');
                        if (visible && !state.lastWelcome)
                            state.welcomeMounts++;
                        state.lastWelcome = visible;
                        state.plainLoaderSeen ||= document.body.innerText.includes('Loading ParkJom');
                    };
                    new MutationObserver(observe).observe(document.body, { subtree: true, childList: true });
                    observe();
                });
            }, auth, welcome);
            await p.goto(base + (auth ? '/commuter?tab=home' : '/login'), { waitUntil: 'domcontentloaded' });
            return { c, p };
        }
        {
            const { c, p } = await page({ width: 1440, height: 900 });
            await p.waitForSelector('.login-cars-layer canvas');
            const formX = await p.$eval('.login-form-pane', e => e.getBoundingClientRect().x);
            await p.mouse.move(500, 440);
            await pause(600);
            assert.equal(await p.$eval('.login-form-pane', e => e.getBoundingClientRect().x), formX);
            await p.screenshot({ path: out + '/magnetic-desktop.png' });
            await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
            await pause(80);
            const still = await p.$eval('.login-cars-layer canvas', e => e.toDataURL());
            await p.mouse.move(650, 350);
            await pause(250);
            assert.equal(await p.$eval('.login-cars-layer canvas', e => e.toDataURL()), still);

            // Exercise the actual canvas engine with idle waves disabled: movement must come from driving.
            await p.evaluate(async moduleUrl => {
                const { InteractiveDotWave } = await import(moduleUrl);
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;width:1000px;height:600px;left:0;top:0;opacity:0;pointer-events:none';
                const canvas = document.createElement('canvas'); host.append(canvas); document.body.append(host);
                const engine = new InteractiveDotWave(canvas, { mode: 'cars', transparent: true, gap: 64, carScale: 1.65, waveAmplitudeY: 0, waveAmplitudeZ: 0, waveSpeed: 0, glowEnabled: false, interactionRadius: 290, magneticPullXY: 66, magneticPullZ: 110 });
                engine.stop();
                const ctx = canvas.getContext('2d');
                const radial = ctx.createRadialGradient.bind(ctx);
                const fixture = { engine, host, canvas, beams: 0, initial: engine.dots.map(d => ({ x: d.baseWorldX, y: d.baseWorldY })) };
                ctx.createRadialGradient = (...args) => { fixture.beams++; return radial(...args); };
                window.__carFixture = fixture;
                engine.start();
            }, new URL('/src/components/canvas/InteractiveDotWave.ts', base).href);
            await pause(650);
            const idle = await p.evaluate(() => {
                const f = window.__carFixture; f.engine.stop();
                const cars = f.engine.dots;
                const moved = cars.some((d, i) => Math.hypot(d.baseWorldX - f.initial[i].x, d.baseWorldY - f.initial[i].y) > 3);
                const car = cars.find(d => d.screenX > 160 && d.screenX < 700 && d.screenY > 120 && d.screenY < 450);
                if (!car) throw new Error('No car available to test steering');
                f.car = car; f.pointer = { x: car.screenX + 90, y: car.screenY + 45 };
                f.distanceBefore = Math.hypot(f.pointer.x - car.screenX, f.pointer.y - car.screenY);
                const alpha = f.canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3];
                f.engine.setPointerPosition(f.pointer.x, f.pointer.y); f.engine.start();
                return { count: cars.length, onlyCars: cars.every(d => d.type === 'car'), moved, beams: f.beams, transparentCorner: alpha === 0 };
            });
            assert.ok(idle.count === 5 && idle.onlyCars && idle.moved && idle.beams > 0 && idle.transparentCorner);
            await pause(900);
            const attraction = await p.evaluate(() => {
                const f = window.__carFixture; f.engine.stop();
                const c = f.car, p = f.pointer;
                const distance = Math.hypot(p.x - c.screenX, p.y - c.screenY);
                let angle = Math.atan2(p.y - c.screenY, p.x - c.screenX) - c.heading;
                while (angle < -Math.PI) angle += Math.PI * 2;
                while (angle > Math.PI) angle -= Math.PI * 2;
                const result = { closer: distance < f.distanceBefore, facingPointer: Math.abs(angle) < 0.5, headlights: f.beams > 0 };
                f.engine.destroy(); f.host.remove(); return result;
            });
            assert.ok(attraction.closer && attraction.facingPointer && attraction.headlights);
            results.push({ topDownCars: idle, attraction, reducedMotion: true, controlsStable: true });
            await c.close();
        }
        {
            const { c, p } = await page({ auth: true });
            await p.waitForSelector('.workspace-header__inner');
            const headerTop = await p.$eval('.workspace-header__inner', e => e.getBoundingClientRect().top);
            assert.ok(headerTop >= 48);
            await p.click('[aria-label="Open menu"]');
            await p.waitForSelector('[data-mobile="true"] .workspace-sidebar-safe-header', { visible: true });
            const bounds = await p.$eval('[data-mobile="true"] .workspace-sidebar-brand', e => e.getBoundingClientRect().top);
            assert.ok(bounds >= 48);
            const footer = await p.$eval('[data-mobile="true"] .workspace-sidebar-safe-footer', e => getComputedStyle(e).paddingBottom);
            assert.ok(parseFloat(footer) >= 26);
            await p.screenshot({ path: out + '/safe-area-menu.png' });
            results.push({ safeAreaHeader: headerTop, safeAreaMenu: bounds, bottomPadding: footer });
            await c.close();
        }
        {
            const { c, p } = await page({ auth: true, welcome: true, slow: true });
            await p.waitForSelector('[aria-label="Welcome to ParkJom"]');
            await pause(3000);
            assert.ok(await p.$('[aria-label="Welcome to ParkJom"]'), 'Keep the illustrated welcome while the dashboard downloads');
            await p.waitForSelector('.workspace-header', { timeout: 15000 });
            const audit = await p.evaluate(() => window.__loginAudit);
            assert.equal(audit.welcomeMounts, 1);
            assert.equal(audit.plainLoaderSeen, false);
            assert.equal(await p.$('[aria-label="Welcome to ParkJom"]'), null);
            results.push({ singleWelcome: audit });
            await c.close();
        }
        {
            const { c, p } = await page({ auth: true, welcome: true, fail: true });
            await p.waitForSelector('[aria-label="Welcome to ParkJom"] [role="alert"]', { timeout: 10000 });
            await p.click('[aria-label="Welcome to ParkJom"] [role="alert"] button');
            await p.waitForSelector('.workspace-header', { timeout: 15000 });
            results.push({ loadingRetry: true });
            await c.close();
        }
    }
    finally {
        await browser.close();
        fs.writeFileSync(out + '/report.json', JSON.stringify(results, null, 2));
    }
    console.log(JSON.stringify(results, null, 2));
})().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
