// Headless tests: circuit simulation semantics, chip fabrication, level data.
import assert from 'node:assert/strict';
import { Circuit, PART_DEFS, partIns, partOuts } from '../src/circuit.js';
import { burnChip, makeReflexChip, makeOscChip } from '../src/chips.js';
import { LEVELS, SANDBOX } from '../src/levels.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

// ── Gate logic ───────────────────────────────────────────────────────────────

test('AND/OR/NOT/XOR/NAND/NOR truth tables', () => {
  const tt = (type, a, b) => PART_DEFS[type].evaluate([a, b], { state: {}, config: {} })[0];
  assert.equal(tt('AND', true, true), true);
  assert.equal(tt('AND', true, false), false);
  assert.equal(tt('OR', false, true), true);
  assert.equal(tt('OR', false, false), false);
  assert.equal(PART_DEFS.NOT.evaluate([false], { state: {}, config: {} })[0], true);
  assert.equal(tt('XOR', true, true), false);
  assert.equal(tt('XOR', true, false), true);
  assert.equal(tt('NAND', true, true), false);
  assert.equal(tt('NOR', false, false), true);
});

test('wire propagation: battery → AND gate', () => {
  const c = new Circuit();
  const bat = c.addPart('BATTERY', 0, 0, {});
  const and = c.addPart('AND', 2, 0, {});
  c.addWire(bat.id, 0, and.id, 0);
  c.addWire(bat.id, 0, and.id, 1);
  c.step(); // battery output appears
  c.step(); // gate sees it
  assert.equal(and.outVals[0], true);
});

test('multiple wires into one input act as OR', () => {
  const c = new Circuit();
  const bat = c.addPart('BATTERY', 0, 0, {});
  const pin = c.addPart('PIN_IN', 0, 1, {}); // stays false (no ext)
  const not = c.addPart('NOT', 2, 0, {});
  c.addWire(pin.id, 0, not.id, 0);
  c.addWire(bat.id, 0, not.id, 0);
  c.step(); c.step();
  assert.equal(not.outVals[0], false); // input is true via battery → NOT false
});

test('NOT looped onto itself oscillates (ring oscillator)', () => {
  const c = new Circuit();
  const not = c.addPart('NOT', 0, 0, {});
  c.addWire(not.id, 0, not.id, 0);
  const seen = new Set();
  for (let i = 0; i < 6; i++) { c.step(); seen.add(not.outVals[0]); }
  assert.equal(seen.size, 2, 'oscillator should hit both states');
});

test('SR flip-flop sets, holds, resets', () => {
  const c = new Circuit();
  const s = c.addPart('PIN_IN', 0, 0, {});
  const r = c.addPart('PIN_IN', 0, 1, {});
  const ff = c.addPart('FLIPFLOP', 2, 0, {});
  c.addWire(s.id, 0, ff.id, 0);
  c.addWire(r.id, 0, ff.id, 1);
  c.step();
  assert.equal(ff.outVals[0], false);
  assert.equal(ff.outVals[1], true);
  s.state.ext = true; c.step(); c.step();
  assert.equal(ff.outVals[0], true, 'S should set Q');
  s.state.ext = false; c.step(); c.step();
  assert.equal(ff.outVals[0], true, 'Q should hold');
  r.state.ext = true; c.step(); c.step();
  assert.equal(ff.outVals[0], false, 'R should reset Q');
});

test('clock toggles with configured period', () => {
  const c = new Circuit();
  const clk = c.addPart('CLOCK', 0, 0, { period: 8 });
  const vals = [];
  for (let i = 0; i < 16; i++) { c.step(); vals.push(clk.outVals[0]); }
  assert.ok(vals.slice(0, 8).some(v => v) && vals.slice(0, 8).some(v => !v), 'should toggle within one period');
});

test('counter counts rising edges and resets', () => {
  const c = new Circuit();
  const clk = c.addPart('PIN_IN', 0, 0, {});
  const rst = c.addPart('PIN_IN', 0, 1, {});
  const cnt = c.addPart('COUNTER', 2, 0, {});
  c.addWire(clk.id, 0, cnt.id, 0);
  c.addWire(rst.id, 0, cnt.id, 1);
  const pulse = () => { clk.state.ext = true; c.step(); c.step(); clk.state.ext = false; c.step(); c.step(); };
  pulse(); pulse(); pulse();
  const v = (cnt.outVals[0] ? 1 : 0) + (cnt.outVals[1] ? 2 : 0) + (cnt.outVals[2] ? 4 : 0) + (cnt.outVals[3] ? 8 : 0);
  assert.equal(v, 3);
  rst.state.ext = true; c.step(); c.step();
  assert.deepEqual(cnt.outVals, [false, false, false, false]);
});

test('NPU perceptron fires at threshold', () => {
  const p = { state: {}, config: { w: [1, 1, -1, 0], t: 2 } };
  assert.equal(PART_DEFS.NEURO.evaluate([true, true, false, false], p)[0], true);
  assert.equal(PART_DEFS.NEURO.evaluate([true, true, true, false], p)[0], false, 'inhibitory weight should block');
  assert.equal(PART_DEFS.NEURO.evaluate([true, false, false, true], p)[0], false);
});

test('MUX routes A or B by SEL', () => {
  const ev = inv => PART_DEFS.MUX.evaluate(inv, { state: {}, config: {} })[0];
  assert.equal(ev([false, true, false]), true);
  assert.equal(ev([true, true, false]), false);
  assert.equal(ev([true, false, true]), true);
});

test('DELAY shifts a signal by n steps', () => {
  const c = new Circuit();
  const src = c.addPart('PIN_IN', 0, 0, {});
  const dly = c.addPart('DELAY', 2, 0, { n: 3 });
  c.addWire(src.id, 0, dly.id, 0);
  src.state.ext = true;
  const out = [];
  for (let i = 0; i < 6; i++) { c.step(); out.push(dly.outVals[0]); }
  assert.equal(out[1], false);
  assert.ok(out[4], 'signal should arrive after the delay');
});

// ── Chips ────────────────────────────────────────────────────────────────────

test('burn a NOT chip and run it inside another circuit', () => {
  const board = new Circuit();
  const pi = board.addPart('PIN_IN', 0, 0, {});
  const not = board.addPart('NOT', 1, 0, {});
  const po = board.addPart('PIN_OUT', 2, 0, {});
  board.addWire(pi.id, 0, not.id, 0);
  board.addWire(not.id, 0, po.id, 0);
  const res = burnChip(board, 'INV-1');
  assert.ok(res.blueprint, res.error);
  assert.equal(res.blueprint.nin, 1);
  assert.equal(res.blueprint.nout, 1);

  const host = new Circuit();
  const chip = host.addPart('CHIP', 0, 0, { bp: res.blueprint });
  assert.equal(partIns(chip), 1);
  assert.equal(partOuts(chip), 1);
  for (let i = 0; i < 4; i++) host.step();
  assert.equal(chip.outVals[0], true, 'NOT of a floating-low input should be HIGH');
});

test('burn rejects a pinless board', () => {
  const board = new Circuit();
  board.addPart('AND', 0, 0, {});
  assert.ok(burnChip(board, 'X').error);
});

test('peripherals are excluded from burned chips', () => {
  const board = new Circuit();
  board.addPart('BUMPER', 0, 0, { dir: 'N' });
  board.addPart('THRUSTER', 0, 1, { dir: 'N' });
  const pi = board.addPart('PIN_IN', 0, 2, {});
  const po = board.addPart('PIN_OUT', 2, 2, {});
  board.addWire(pi.id, 0, po.id, 0);
  const res = burnChip(board, 'T');
  assert.ok(res.blueprint);
  assert.ok(!res.blueprint.data.parts.some(p => p.type === 'BUMPER' || p.type === 'THRUSTER'));
});

test('REFLEX-1 prefab crosses bumpers to opposite thrusters', () => {
  const bp = makeReflexChip();
  const host = new Circuit();
  const src = host.addPart('PIN_IN', 0, 0, {});
  const chip = host.addPart('CHIP', 1, 0, { bp });
  host.addWire(src.id, 0, chip.id, 0); // bump N
  src.state.ext = true;
  for (let i = 0; i < 4; i++) host.step();
  assert.equal(chip.outVals[2], true, 'bump N should drive thrust S');
  assert.equal(chip.outVals[0], false);
});

test('OSC-1 prefab oscillates', () => {
  const bp = makeOscChip();
  const host = new Circuit();
  const chip = host.addPart('CHIP', 0, 0, { bp });
  const seen = new Set();
  for (let i = 0; i < 60; i++) { host.step(); seen.add(chip.outVals[0]); }
  assert.equal(seen.size, 2);
});

test('serialize → deserialize round-trips a circuit with a chip', () => {
  const c = new Circuit();
  const bat = c.addPart('BATTERY', 0, 0, {});
  const chip = c.addPart('CHIP', 1, 0, { bp: makeReflexChip() });
  c.addWire(bat.id, 0, chip.id, 1);
  const copy = Circuit.deserialize(c.serialize());
  assert.equal(copy.parts.length, 2);
  assert.equal(copy.wires.length, 1);
  for (let i = 0; i < 4; i++) copy.step();
  const chip2 = copy.parts.find(p => p.type === 'CHIP');
  assert.equal(chip2.outVals[3], true, 'bump E → thrust W through the restored chip');
});

// ── Level data integrity ─────────────────────────────────────────────────────

const ALL = [...LEVELS, SANDBOX];
const VALID = new Set('#.PtX~K123abcdABCD'.split(''));

test('all maps are 30×18 with only known tiles', () => {
  for (const lvl of ALL) {
    assert.equal(lvl.map.length, 18, `${lvl.name}: wrong row count`);
    lvl.map.forEach((row, y) => {
      assert.equal(row.length, 30, `${lvl.name} row ${y}: length ${row.length}: "${row}"`);
      for (const ch of row) assert.ok(VALID.has(ch), `${lvl.name} row ${y}: bad tile "${ch}"`);
    });
  }
});

test('every map has a player spawn and a sealed border', () => {
  for (const lvl of ALL) {
    const flat = lvl.map.join('');
    assert.ok(flat.includes('P'), `${lvl.name}: no player`);
    assert.ok(/^#+$/.test(lvl.map[0]) && /^#+$/.test(lvl.map[17]), `${lvl.name}: open top/bottom`);
    for (const row of lvl.map) assert.ok(row[0] === '#' && row[29] === '#', `${lvl.name}: open side`);
  }
});

test('door rules reference plates that exist on the map', () => {
  for (const lvl of ALL) {
    const flat = lvl.map.join('');
    for (const [door, plates] of Object.entries(lvl.doors || {})) {
      assert.ok(flat.includes(door), `${lvl.name}: door ${door} not on map`);
      for (const p of plates) assert.ok(flat.includes(p), `${lvl.name}: plate ${p} missing for door ${door}`);
    }
  }
});

test('campaign levels have exits, robots and reachable crystal counts', () => {
  for (const lvl of LEVELS) {
    const flat = lvl.map.join('');
    assert.ok(flat.includes('X'), `${lvl.name}: no exit`);
    assert.ok(/[123]/.test(flat), `${lvl.name}: no robots`);
    const crystals = (lvl.items || []).filter(i => i.type === 'crystal').length;
    assert.ok(crystals >= (lvl.crystals || 0), `${lvl.name}: needs ${lvl.crystals} crystals, only ${crystals} placed`);
  }
});

test('items sit on walkable tiles', () => {
  for (const lvl of ALL) {
    for (const it of (lvl.items || [])) {
      const ch = lvl.map[it.y][it.x];
      assert.ok(ch !== '#', `${lvl.name}: ${it.type} at ${it.x},${it.y} is inside a wall`);
    }
  }
});

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
