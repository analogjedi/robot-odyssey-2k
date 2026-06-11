// End-to-end puzzle solvability: build the intended circuit for each campaign
// sector, run the world headlessly, and assert the mechanism actually works.
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { LEVELS } from '../src/levels.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

function stubGame() {
  return { toast() { }, sfx() { }, onLevelComplete() { this.done = true; } };
}

function run(world, frames) {
  for (let i = 0; i < frames; i++) world.update(null);
}

const wire = (r, fromPart, fromPin, toPart, toPin) =>
  r.circuit.addWire(fromPart.id, fromPin, toPart.id, toPin);

test('SECTOR 01: BAT→THR·E drives AXIOM down the vent onto plate a', () => {
  const w = new World(LEVELS[0], stubGame());
  const r = w.robots[0];
  wire(r, r.parts.battery, 0, r.parts.thrustE, 0);
  run(w, 60 * 20);
  assert.ok(w.pressed.has('a'), 'plate a should be pressed');
  assert.ok(w.doors.A.open, 'door A should be open');
});

test('SECTOR 02: corner-hugging wiring parks both robots on their plates', () => {
  const w = new World(LEVELS[1], stubGame());
  const [r1, r2] = w.robots;
  wire(r1, r1.parts.battery, 0, r1.parts.thrustE, 0);
  wire(r1, r1.parts.bumpE, 0, r1.parts.thrustN, 0);
  wire(r2, r2.parts.battery, 0, r2.parts.thrustE, 0);
  wire(r2, r2.parts.bumpE, 0, r2.parts.thrustS, 0);
  run(w, 60 * 30);
  assert.ok(w.pressed.has('a'), 'plate a (north) should be pressed');
  assert.ok(w.pressed.has('b'), 'plate b (south) should be pressed');
  assert.ok(w.doors.A.open, 'AND-interlocked door A should be open');
});

test('SECTOR 03: flip-flop loop fetches the keycard and returns', () => {
  const w = new World(LEVELS[2], stubGame());
  const r = w.robots[0];
  const ff = r.circuit.addPart('FLIPFLOP', 8, 5, {});
  wire(r, { id: ff.id }, 1, r.parts.thrustE, 0);   // Q̄ → east (outbound)
  wire(r, { id: ff.id }, 0, r.parts.thrustW, 0);   // Q → west (return)
  wire(r, r.parts.bumpE, 0, r.parts.thrustS, 0);   // drop through the far gap
  wire(r, r.parts.bumpS, 0, { id: ff.id }, 0);     // landing sets the flip-flop
  wire(r, r.parts.battery, 0, r.parts.grabber, 0); // claw always closed
  run(w, 60 * 40);
  assert.ok(r.held && r.held.type === 'keycard', 'PULSE should hold the keycard');
  assert.ok(r.tileX() <= 10, `PULSE should be back in the west room (at tile ${r.tileX()})`);
});

test('SECTOR 04: scanner-follow robot tracks a scripted player onto the plate', () => {
  const g = stubGame();
  const w = new World(LEVELS[3], g);
  const r = w.robots[0];
  // full follow policy: each scanner direction drives the matching thruster
  wire(r, r.parts.scanner, 0, r.parts.thrustN, 0);
  wire(r, r.parts.scanner, 1, r.parts.thrustE, 0);
  wire(r, r.parts.scanner, 2, r.parts.thrustS, 0);
  wire(r, r.parts.scanner, 3, r.parts.thrustW, 0);
  // scripted player: north up the west strip, then east along the corridor to the lift
  const p = w.player;
  for (let i = 0; i < 60 * 60 && !g.done; i++) {
    const input = new Set();
    const ty = Math.floor((p.y + p.h / 2) / 32), tx = Math.floor((p.x + p.w / 2) / 32);
    if (tx <= 4 && ty > 3) input.add('up');
    else input.add('right'); // corner assist squeezes through the door gap
    w.update(input);
  }
  assert.ok(w.pressed.has('a'), 'VECTOR should be parked on plate a');
  assert.ok(w.doors.A.open, 'door A should be open');
  assert.ok(p.crystals >= 1, 'player should have swept up the corridor crystal');
  assert.ok(g.done, 'the player should reach the lift and clear the sector');
});

test('SECTOR 05: two-stage pipeline opens the final interlock', () => {
  const w = new World(LEVELS[4], stubGame());
  const [r1, r2] = w.robots;
  wire(r1, r1.parts.battery, 0, r1.parts.thrustE, 0);
  wire(r1, r1.parts.bumpE, 0, r1.parts.thrustN, 0);
  wire(r2, r2.parts.battery, 0, r2.parts.thrustE, 0);
  run(w, 60 * 40);
  assert.ok(w.doors.B.open, 'door B should open from plate a');
  assert.ok(w.pressed.has('b'), 'VECTOR should roll through B onto plate b');
  assert.ok(w.doors.A.open, 'final door A should be open');
});

test('corner assist: a misaligned player slides through a 1-tile door gap', () => {
  const w = new World(LEVELS[0], stubGame());
  // hold plate a down with a phantom item so door A stays open
  w.items.push({ id: 'tst', type: 'crystal', x: 28 * 32 + 16, y: 10 * 32 + 16, heldBy: null });
  const p = w.player;
  // park the player just west of door A (13,5), straddling rows 5/6
  p.x = 11 * 32 + 5;
  p.y = 5 * 32 + 14;
  for (let i = 0; i < 60 * 5; i++) w.update(new Set(['right']));
  assert.ok(p.x > 14 * 32, `player should pass the door (x=${Math.round(p.x)})`);
});

test('radio: TX on one robot raises RX on another (same channel)', () => {
  const w = new World(LEVELS[4], stubGame());
  const [r1, r2] = w.robots;
  wire(r1, r1.parts.battery, 0, r1.parts.antenna, 0); // broadcast constantly
  run(w, 30);
  assert.equal(r2.parts.antenna.outVals[0], true, 'VECTOR should hear AXIOM');
  assert.equal(r1.parts.antenna.outVals[0], false, 'a robot should not hear itself');
});

console.log(`\n${passed} solvability tests passed${process.exitCode ? ' (with failures)' : ''}`);
