// Render real PNG screenshots of the game headlessly via node-canvas.
// Not part of the game (which is zero-dependency): run `npm i --no-save canvas`
// first, then `node scripts/screenshot.mjs`. Output lands in shots/.
import { mkdirSync, writeFileSync } from 'node:fs';

let createCanvas;
try { ({ createCanvas } = await import('canvas')); }
catch { console.error('node-canvas not installed — run: npm i --no-save canvas'); process.exit(1); }

// ── Stub DOM (same approach as test/boot.test.mjs) with a real 2D context ───
const real = createCanvas(960, 640);
const els = new Map();
const docListeners = {};

function makeClassList(el) {
  const set = new Set(el.initialClasses || []);
  return {
    add: c => set.add(c), remove: c => set.delete(c),
    toggle: (c, force) => { (force === undefined ? !set.has(c) : force) ? set.add(c) : set.delete(c); },
    contains: c => set.has(c),
  };
}
function makeEl(id) {
  const el = {
    id, innerHTML: '', textContent: '', style: {}, dataset: {}, listeners: {},
    initialClasses: (id === 'menu' || id === 'modal' || id === 'inspector') ? ['hidden'] : [],
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    click() { (this.listeners.click || []).forEach(f => f({})); },
  };
  el.classList = makeClassList(el);
  if (id === 'game') { el.width = 960; el.height = 640; el.getContext = () => real.getContext('2d'); }
  return el;
}
const frames = [];
globalThis.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
globalThis.window = { prompt: () => 'MY-IC' };
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.document = {
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelectorAll: () => [],
  addEventListener(t, f) { (docListeners[t] ||= []).push(f); },
};

const pump = n => { for (let i = 0; i < n; i++) frames.shift()(); };
const key = k => (docListeners.keydown || []).forEach(f =>
  f({ key: k, target: { tagName: 'CANVAS' }, preventDefault() { } }));
const mouse = (type, x, y, button = 0) =>
  (els.get('game').listeners[type] || []).forEach(f => f({ clientX: x, clientY: y, button, preventDefault() { } }));

mkdirSync('docs/screenshots', { recursive: true });
const shoot = name => {
  writeFileSync(`docs/screenshots/${name}.png`, real.toBuffer('image/png'));
  console.log(`docs/screenshots/${name}.png`);
};

const { game } = await import('../src/main.js');
pump(2);

// 1 · Sector 01, mid-solve: wire AXIOM and let it drive the vent
els.get('btn-new').click();
key('Escape'); // close intro
const w = game.world;
const axiom = w.robots[0];
axiom.circuit.addWire(axiom.parts.battery.id, 0, axiom.parts.thrustE.id, 0);
pump(60 * 5); // robot drives partway down the vent
shoot('1-world-sector01');

// 2 · inside the robot: the circuit bench with live signals + extra parts
w.player.x = axiom.cx() - 11; w.player.y = axiom.cy() - 11;
pump(2);
key('e');
const ed = game.editor;
const c = axiom.circuit;
const not = c.addPart('NOT', 5, 4, {});
c.addWire(not.id, 0, not.id, 0); // ring oscillator, blinking live
const clk = c.addPart('CLOCK', 5, 6, { period: 16 });
const and = c.addPart('AND', 8, 5, {});
c.addWire(clk.id, 0, and.id, 0);
c.addWire(not.id, 0, and.id, 1);
const npu = c.addPart('NEURO', 11, 3, {});
c.addWire(axiom.parts.bumpN.id, 0, npu.id, 0);
c.addWire(and.id, 0, npu.id, 1);
ed.selected = npu.id;
pump(45);
shoot('2-circuit-bench');
key('Escape'); // leave the robot

// 3 · Sector 02: both robots corner-hugging toward the AND-interlocked door
game.startLevel(1);
key('Escape');
const w2 = game.world;
const [r1, r2] = w2.robots;
r1.circuit.addWire(r1.parts.battery.id, 0, r1.parts.thrustE.id, 0);
r1.circuit.addWire(r1.parts.bumpE.id, 0, r1.parts.thrustN.id, 0);
r2.circuit.addWire(r2.parts.battery.id, 0, r2.parts.thrustE.id, 0);
r2.circuit.addWire(r2.parts.bumpE.id, 0, r2.parts.thrustS.id, 0);
pump(60 * 6);
shoot('3-logic-foundry');

// 4 · Sector 04: the follow-bot tracking the player in the AI Wing
game.startLevel(3);
key('Escape');
const w4 = game.world;
const vec = w4.robots[0];
for (let i = 0; i < 4; i++) vec.circuit.addWire(vec.parts.scanner.id, i, vec.parts['thrust' + 'NESW'[i]].id, 0);
const p4 = w4.player;
for (let i = 0; i < 60 * 14; i++) {
  const ty = Math.floor((p4.y + 11) / 32), tx = Math.floor((p4.x + 11) / 32);
  game.keys.clear();
  game.keys.add(tx <= 4 && ty > 3 ? 'up' : 'right');
  if (tx > 16) break;
  pump(1);
}
pump(2);
shoot('4-ai-wing-follow');
console.log('done');
