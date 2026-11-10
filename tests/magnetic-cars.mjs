import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Run the real canvas simulation without a browser or animation timing dependencies.
const noop = () => {};
globalThis.window = {
  devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
};
globalThis.document = { documentElement: { dataset: { theme: 'light' }, classList: { contains: () => false } } };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = globalThis.ResizeObserver;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
const source = fs.readFileSync(new URL('../src/components/canvas/InteractiveDotWave.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { InteractiveDotWave } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
let sizes = [], beams = 0;
const ctx = new Proxy({
  roundRect: (_x, _y, width, height) => sizes.push([width, height]),
  createRadialGradient: () => { beams++; return { addColorStop: noop }; },
}, { get: (target, name) => target[name] ?? noop });
const canvas = { width: 0, height: 0, style: {}, parentElement: { clientWidth: 700, clientHeight: 800 }, getContext: () => ctx };
const engine = new InteractiveDotWave(canvas, { mode: 'cars', transparent: true, carScale: 1.65, waveAmplitudeY: 0, waveAmplitudeZ: 0, magneticPullXY: 66, magneticPullZ: 110, interactionRadius: 290 });
engine.stop();
assert.equal(engine.dots.length, 5);
const start = engine.dots.map(d => [d.x, d.y]);
for (let i = 0; i < 60; i++) engine.render(i * 16.67, 1);
assert.ok(engine.dots.every((d, i) => Math.hypot(d.x - start[i][0], d.y - start[i][1]) > 3), 'Cars cruise without pointer input');
const car = engine.dots[2], pointer = [car.screenX + 90, car.screenY + 45];
const distance = Math.hypot(pointer[0] - car.screenX, pointer[1] - car.screenY);
engine.setPointerPosition(...pointer);
sizes = [];
for (let i = 60; i < 120; i++) { engine.updatePointer(1); engine.render(i * 16.67, 1); }
assert.ok(Math.hypot(pointer[0] - car.screenX, pointer[1] - car.screenY) < distance, 'Cars are attracted to the pointer');
let turn = Math.atan2(pointer[1] - car.screenY, pointer[0] - car.screenX) - car.heading;
turn = Math.atan2(Math.sin(turn), Math.cos(turn));
assert.ok(Math.abs(turn) < 0.5, 'Car and headlights face the pointer');
assert.ok(beams > 0);
assert.ok(sizes.every(([w, h]) => (w === 24.75 && h === 14.85) || (w === 24.75 * 0.45 && h === 14.85 * 0.6)), 'All car bodies stay the same size, including during attraction');
canvas.parentElement.clientWidth = 390;
engine.resize();
assert.equal(engine.dots.length, 3);
engine.destroy();
console.log('Magnetic cars: sparse desktop/mobile count, idle cruising, pointer steering, headlights and equal sizes passed');
