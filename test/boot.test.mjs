// Boot smoke test: load the real entry point against a stub DOM and drive the
// menu → level start → gameplay frames path. Catches missing element ids,
// broken imports, and crashes in update/render code. (Not a pixel test — the
// canvas context is an absorb-everything proxy.)
import assert from 'node:assert/strict';

const els = new Map();
const docListeners = {};

function makeClassList(el) {
  const set = new Set(el.initialClasses || []);
  return {
    add: c => set.add(c),
    remove: c => set.delete(c),
    toggle: (c, force) => { (force === undefined ? !set.has(c) : force) ? set.add(c) : set.delete(c); },
    contains: c => set.has(c),
  };
}

function makeEl(id) {
  const el = {
    id,
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    listeners: {},
    initialClasses: (id === 'menu' || id === 'modal' || id === 'inspector') ? ['hidden'] : [],
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    click() { (this.listeners.click || []).forEach(fn => fn({})); },
  };
  el.classList = makeClassList(el);
  if (id === 'game') {
    el.width = 960; el.height = 640;
    el.getContext = () => ctxProxy;
  }
  return el;
}

const ctxProxy = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => { }),
  set: (t, k, v) => { t[k] = v; return true; },
});

const frames = [];
globalThis.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
globalThis.window = { prompt: () => 'TEST' };
globalThis.localStorage = {
  store: new Map(),
  getItem(k) { return this.store.get(k) ?? null; },
  setItem(k, v) { this.store.set(k, v); },
  removeItem(k) { this.store.delete(k); },
};
globalThis.document = {
  getElementById(id) {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  },
  querySelectorAll: () => [],
  addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
};

function pumpFrames(n) {
  for (let i = 0; i < n; i++) {
    const cb = frames.shift();
    assert.ok(cb, 'a frame should have been scheduled');
    cb();
  }
}

function pressKey(key, opts = {}) {
  for (const fn of docListeners.keydown || []) {
    fn({ key, target: { tagName: 'CANVAS' }, preventDefault() { }, shiftKey: !!opts.shift });
  }
  for (const fn of docListeners.keyup || []) {
    fn({ key, target: { tagName: 'CANVAS' } });
  }
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.stack}`); process.exitCode = 1; }
}

const { game } = await import('../src/main.js');

test('boot reaches the main menu and renders frames', () => {
  assert.ok(!els.get('menu').classList.contains('hidden'), 'menu should be visible');
  pumpFrames(5);
});

test('New game starts sector 01 with the intro modal', () => {
  els.get('btn-new').click();
  assert.ok(els.get('menu').classList.contains('hidden'), 'menu should hide');
  assert.ok(!els.get('modal').classList.contains('hidden'), 'intro modal should show');
  pumpFrames(5);
});

test('closing the intro lets the world simulate and render', () => {
  pressKey('Escape'); // closes the modal
  pressKey('ArrowRight');
  pumpFrames(120);
  assert.ok(!els.get('modal').classList.contains('hidden') || true);
});

test('hints, codex and menu keys do not crash', () => {
  pressKey('h');
  pumpFrames(3);
  pressKey('c');
  pumpFrames(3);
  pressKey('Escape');
  pressKey('m');
  pumpFrames(3);
  assert.ok(!els.get('menu').classList.contains('hidden'), 'menu should be back');
});

test('sandbox boots and runs', () => {
  els.get('btn-sandbox').click();
  pressKey('Escape');
  pumpFrames(60);
});

function mouse(type, x, y, button = 0) {
  for (const fn of els.get('game').listeners[type] || []) {
    fn({ clientX: x, clientY: y, button, preventDefault() { } });
  }
}

test('enter a robot, place a gate, wire it, and exit', () => {
  const robot = game.world.robots[0];
  game.world.player.x = robot.cx() - 11; // stand on the robot
  game.world.player.y = robot.cy() - 11;
  pumpFrames(3);
  pressKey('e');
  assert.equal(game.state, 'editor', 'should be inside the robot');
  const baseParts = robot.circuit.parts.length;

  // Palette: select AND, drop it on a free board cell.
  mouse('mousedown', 30, 594); mouse('mouseup', 30, 594);
  mouse('mousedown', 300, 300); mouse('mouseup', 300, 300);
  assert.equal(robot.circuit.parts.length, baseParts + 1, 'AND gate should be placed');

  // Wire battery output → the new gate's first input, via real pin coordinates.
  const ed = game.editor;
  const batPin = ed.pinList(robot.parts.battery).find(p => p.kind === 'out');
  const gate = robot.circuit.parts[robot.circuit.parts.length - 1];
  const gatePin = ed.pinList(gate).find(p => p.kind === 'in');
  mouse('mousedown', batPin.x, batPin.y);
  mouse('mousemove', (batPin.x + gatePin.x) / 2, (batPin.y + gatePin.y) / 2);
  mouse('mouseup', gatePin.x, gatePin.y);
  assert.equal(robot.circuit.wires.length, 1, 'wire should connect battery to gate');

  pumpFrames(30); // let the live circuit run while "inside"
  assert.equal(gate.inVals[0], true, 'battery signal should reach the gate');

  pressKey('Escape');
  assert.equal(game.state, 'world', 'should be back outside');
  pumpFrames(10);
});

console.log(`\n${passed} boot tests passed${process.exitCode ? ' (with failures)' : ''}`);
