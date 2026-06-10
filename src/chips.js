// Chip fabrication ("tapeout"): turn a board full of parts into a single
// reusable IC, plus a couple of prefab chips awarded during the campaign.
import { Circuit, PART_DEFS } from './circuit.js';

export const MAX_CHIP_PINS = 6;

// Burn the given board into a chip blueprint.
// Keeps every non-peripheral part (BATTERY allowed — a chip may carry its own
// rail). PIN_IN / PIN_OUT parts become the package pins, ordered top-to-bottom.
export function burnChip(circuit, name) {
  const keep = circuit.parts.filter(p => {
    const d = PART_DEFS[p.type];
    return !d.peripheral || d.allowInChip;
  });
  const byPos = (a, b) => (a.y - b.y) || (a.x - b.x);
  const pinsIn = keep.filter(p => p.type === 'PIN_IN').sort(byPos);
  const pinsOut = keep.filter(p => p.type === 'PIN_OUT').sort(byPos);

  if (pinsIn.length + pinsOut.length === 0) {
    return { error: 'Place at least one PIN▸ or ▸PIN pad first — a chip with no pins is just sand.' };
  }
  if (pinsIn.length > MAX_CHIP_PINS || pinsOut.length > MAX_CHIP_PINS) {
    return { error: `Package limit: at most ${MAX_CHIP_PINS} input and ${MAX_CHIP_PINS} output pins.` };
  }
  if (keep.length === pinsIn.length + pinsOut.length && circuit.wires.length === 0) {
    return { error: 'The die is empty — add some logic between the pins before tapeout.' };
  }

  const keepIds = new Set(keep.map(p => p.id));
  const data = {
    parts: keep.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, config: p.config })),
    wires: circuit.wires
      .filter(w => keepIds.has(w.a.p) && keepIds.has(w.b.p))
      .map(w => ({ a: { ...w.a }, b: { ...w.b } })),
  };
  return { blueprint: { name, nin: pinsIn.length, nout: pinsOut.length, data: JSON.parse(JSON.stringify(data)) } };
}

// ── Prefab chips unlocked as campaign rewards ──────────────────────────────

// REFLEX-1: bumpers in (N,E,S,W) → opposite thrusters out. Wire your four
// bumpers to its inputs and your four thrusters to its outputs and the robot
// bounces off everything it touches.
export function makeReflexChip() {
  const c = new Circuit();
  const ins = ['N', 'E', 'S', 'W'].map((d, i) => c.addPart('PIN_IN', 0, i, {}));
  const outs = ['N', 'E', 'S', 'W'].map((d, i) => c.addPart('PIN_OUT', 3, i, {}));
  // bump N → thrust S, bump E → thrust W, etc.
  c.addWire(ins[0].id, 0, outs[2].id, 0);
  c.addWire(ins[1].id, 0, outs[3].id, 0);
  c.addWire(ins[2].id, 0, outs[0].id, 0);
  c.addWire(ins[3].id, 0, outs[1].id, 0);
  return { name: 'REFLEX-1', nin: 4, nout: 4, data: c.serialize() };
}

// OSC-1: a packaged clock — one output that blinks forever.
export function makeOscChip() {
  const c = new Circuit();
  const clk = c.addPart('CLOCK', 0, 0, { period: 24 });
  const out = c.addPart('PIN_OUT', 3, 0, {});
  c.addWire(clk.id, 0, out.id, 0);
  return { name: 'OSC-1', nin: 0, nout: 1, data: c.serialize() };
}
