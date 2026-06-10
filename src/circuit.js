// Core circuit simulation for Robot Odyssey 2K.
// Deliberately DOM-free so it can run under Node for tests.
//
// Model: parts have input pins (left) and output pins (right). Wires connect
// one output pin to one input pin; an input pin with several wires reads the
// OR of its sources. Every simulation step each part computes new outputs from
// the outputs of the *previous* step (unit gate delay), which is what makes
// ring oscillators, latches and clocked logic behave like real silicon.

let _nextId = 1;
export function uid() { return 'p' + (_nextId++); }

export const PART_DEFS = {
  // ── Robot peripherals (auto-mounted on every robot's board) ─────────────
  BATTERY: {
    label: 'BAT', color: '#facc15', ins: 0, outs: 1, peripheral: true, allowInChip: true,
    desc: 'Power rail. Always outputs logic HIGH — the VDD of your robot.',
    evaluate: () => [true],
  },
  BUMPER: {
    label: 'BMP', color: '#7dd3fc', ins: 0, outs: 1, peripheral: true,
    desc: 'Contact sensor: HIGH while the hull is pressed against something on this side.',
    evaluate: (inv, p) => [!!p.state.ext],
  },
  THRUSTER: {
    label: 'THR', color: '#fb923c', ins: 1, outs: 0, peripheral: true,
    desc: 'Drive motor: feed it HIGH and the robot pushes in this direction.',
    evaluate: () => [],
  },
  SCANNER: {
    label: 'SCAN', color: '#c4b5fd', ins: 0, outs: 4, peripheral: true,
    outLabels: ['N', 'E', 'S', 'W'],
    desc: 'Sensor-fusion module (camera + lidar). Each output goes HIGH when the tracked target lies in that direction.',
    evaluate: (inv, p) => { const e = p.state.ext || {}; return [!!e.N, !!e.E, !!e.S, !!e.W]; },
  },
  ANTENNA: {
    label: 'RF', color: '#34d399', ins: 1, outs: 1, peripheral: true,
    inLabels: ['TX'], outLabels: ['RX'], configurable: 'antenna',
    desc: 'Radio link. Drive TX HIGH to broadcast on your channel; RX goes HIGH while any other robot broadcasts on it.',
    evaluate: (inv, p) => [!!p.state.ext],
  },
  GRABBER: {
    label: 'GRAB', color: '#fb7185', ins: 1, outs: 1, peripheral: true,
    inLabels: ['ON'], outLabels: ['HLD'],
    desc: 'Manipulator claw. Hold the input HIGH to pick up and carry an item under the robot; release it by going LOW. HLD reports whether something is held.',
    evaluate: (inv, p) => [!!p.state.ext],
  },

  // ── Combinational logic ──────────────────────────────────────────────────
  AND: {
    label: 'AND', color: '#60a5fa', ins: 2, outs: 1, allowInChip: true,
    desc: 'HIGH only when both inputs are HIGH. About 6 transistors in CMOS.',
    evaluate: inv => [!!(inv[0] && inv[1])],
  },
  OR: {
    label: 'OR', color: '#4ade80', ins: 2, outs: 1, allowInChip: true,
    desc: 'HIGH when either input is HIGH.',
    evaluate: inv => [!!(inv[0] || inv[1])],
  },
  NOT: {
    label: 'NOT', color: '#f87171', ins: 1, outs: 1, allowInChip: true,
    desc: 'Inverter — flips the signal. Two transistors. Loop one onto itself to make a ring oscillator.',
    evaluate: inv => [!inv[0]],
  },
  XOR: {
    label: 'XOR', color: '#fbbf24', ins: 2, outs: 1, allowInChip: true,
    desc: 'HIGH when the inputs differ. The heart of binary adders.',
    evaluate: inv => [!!inv[0] !== !!inv[1]],
  },
  NAND: {
    label: 'NAND', color: '#38bdf8', ins: 2, outs: 1, allowInChip: true,
    desc: 'The universal gate: any digital circuit can be built from NANDs alone. Also the cheapest CMOS gate (4 transistors).',
    evaluate: inv => [!(inv[0] && inv[1])],
  },
  NOR: {
    label: 'NOR', color: '#2dd4bf', ins: 2, outs: 1, allowInChip: true,
    desc: 'HIGH only when both inputs are LOW. Two cross-coupled NORs form an SR latch.',
    evaluate: inv => [!(inv[0] || inv[1])],
  },

  // ── Sequential / modern parts ────────────────────────────────────────────
  FLIPFLOP: {
    label: 'FLIP', color: '#e879f9', ins: 2, outs: 2, allowInChip: true,
    inLabels: ['S', 'R'], outLabels: ['Q', 'Q̄'],
    desc: 'SR latch — one bit of memory, like an SRAM cell. S sets Q HIGH, R resets it. Q̄ is always the opposite of Q.',
    evaluate: (inv, p) => {
      if (inv[0] && !inv[1]) p.state.q = true;
      else if (!inv[0] && inv[1]) p.state.q = false;
      return [!!p.state.q, !p.state.q];
    },
  },
  CLOCK: {
    label: 'CLK', color: '#a3e635', ins: 0, outs: 1, allowInChip: true, configurable: 'clock',
    desc: 'Crystal oscillator: ticks HIGH/LOW forever. Every CPU marches to one of these. Select it to change the period.',
    evaluate: (inv, p) => {
      p.state.t = (p.state.t || 0) + 1;
      const per = p.config.period || 16;
      return [(p.state.t % per) < per / 2];
    },
  },
  DELAY: {
    label: 'DLY', color: '#fda4af', ins: 1, outs: 1, allowInChip: true, configurable: 'delay',
    desc: 'Delay line: the input reappears at the output N steps later. Real chips fight propagation delay; here you get to use it.',
    evaluate: (inv, p) => {
      const n = p.config.n || 4;
      const buf = p.state.buf || (p.state.buf = []);
      buf.push(!!inv[0]);
      return [buf.length > n ? buf.shift() : false];
    },
  },
  COUNTER: {
    label: 'CNT', color: '#fcd34d', ins: 2, outs: 4, allowInChip: true,
    inLabels: ['CLK', 'RST'], outLabels: ['1', '2', '4', '8'],
    desc: '4-bit binary counter: counts rising edges on CLK, outputs the bits. RST clears it. Strings of these schedule everything in a real SoC.',
    evaluate: (inv, p) => {
      if (inv[1]) p.state.v = 0;
      else if (inv[0] && !p.state.pc) p.state.v = ((p.state.v || 0) + 1) & 15;
      p.state.pc = !!inv[0];
      const v = p.state.v || 0;
      return [!!(v & 1), !!(v & 2), !!(v & 4), !!(v & 8)];
    },
  },
  MUX: {
    label: 'MUX', color: '#93c5fd', ins: 3, outs: 1, allowInChip: true,
    inLabels: ['SEL', 'A', 'B'],
    desc: 'Multiplexer: routes A to the output when SEL is LOW, B when SEL is HIGH. The traffic interchange of every datapath.',
    evaluate: inv => [!!(inv[0] ? inv[2] : inv[1])],
  },
  NEURO: {
    label: 'NPU', color: '#f0abfc', ins: 4, outs: 1, allowInChip: true, configurable: 'neuro',
    inLabels: ['A', 'B', 'C', 'D'],
    desc: 'Neural unit — a perceptron, the atom of every modern AI accelerator. Each input has a weight (-1/0/+1); fires HIGH when the weighted sum reaches the threshold. Select it to tune weights.',
    evaluate: (inv, p) => {
      const w = p.config.w || [1, 1, 1, 1];
      const t = p.config.t ?? 2;
      let s = 0;
      for (let i = 0; i < 4; i++) if (inv[i]) s += w[i];
      return [s >= t];
    },
  },

  // ── Chip fabrication ─────────────────────────────────────────────────────
  PIN_IN: {
    label: 'PIN▸', color: '#cbd5e1', ins: 0, outs: 1, allowInChip: true,
    desc: 'Chip input pad. When you BURN this board into a chip, each PIN▸ becomes an input pin of the new IC.',
    evaluate: (inv, p) => [!!p.state.ext],
  },
  PIN_OUT: {
    label: '▸PIN', color: '#cbd5e1', ins: 1, outs: 0, allowInChip: true,
    desc: 'Chip output pad. When you BURN this board into a chip, each ▸PIN becomes an output pin of the new IC.',
    evaluate: (inv, p) => { p.state.val = !!inv[0]; return []; },
  },
  CHIP: {
    label: 'IC', color: '#5eead4', allowInChip: true,
    desc: 'Integrated circuit: a whole sub-circuit sealed in one package. Millions of these ship in every phone — yours just has fewer transistors.',
    evaluate: (inv, p) => {
      ensureChip(p);
      const c = p.chip;
      for (let i = 0; i < c.inPins.length; i++) c.inPins[i].state.ext = !!inv[i];
      c.circuit.step();
      return c.outPins.map(op => !!op.state.val);
    },
  },
};

export function partDef(p) { return PART_DEFS[p.type]; }
export function partIns(p) {
  const d = PART_DEFS[p.type];
  return d.ins !== undefined ? d.ins : (p.config.bp ? p.config.bp.nin : 0);
}
export function partOuts(p) {
  const d = PART_DEFS[p.type];
  return d.outs !== undefined ? d.outs : (p.config.bp ? p.config.bp.nout : 0);
}
// Height of a part on the editor grid, in cells.
export function partHCells(p) {
  return Math.max(1, Math.ceil(Math.max(partIns(p), partOuts(p)) / 2));
}
export function partLabel(p) {
  if (p.type === 'CHIP') return p.config.bp.name;
  const d = PART_DEFS[p.type];
  return p.config.dir ? `${d.label}·${p.config.dir}` : d.label;
}

function ensureChip(p) {
  if (p.chip) return;
  const circuit = Circuit.deserialize(p.config.bp.data);
  const byPos = (a, b) => (a.y - b.y) || (a.x - b.x);
  p.chip = {
    circuit,
    inPins: circuit.parts.filter(q => q.type === 'PIN_IN').sort(byPos),
    outPins: circuit.parts.filter(q => q.type === 'PIN_OUT').sort(byPos),
  };
}

export class Circuit {
  constructor() {
    this.parts = [];
    this.wires = []; // {a:{p,pin}, b:{p,pin}} — a is an output pin, b an input pin
  }

  addPart(type, x, y, config = {}) {
    const part = { id: uid(), type, x, y, config, state: {}, outVals: [], inVals: [] };
    this.parts.push(part);
    return part;
  }

  getPart(id) { return this.parts.find(p => p.id === id); }

  removePart(id) {
    this.parts = this.parts.filter(p => p.id !== id);
    this.wires = this.wires.filter(w => w.a.p !== id && w.b.p !== id);
  }

  addWire(aId, aPin, bId, bPin) {
    const dup = this.wires.some(w => w.a.p === aId && w.a.pin === aPin && w.b.p === bId && w.b.pin === bPin);
    if (dup) return false;
    this.wires.push({ a: { p: aId, pin: aPin }, b: { p: bId, pin: bPin } });
    return true;
  }

  removeWire(w) { this.wires = this.wires.filter(x => x !== w); }

  inputValue(part, pin) {
    let v = false;
    for (const w of this.wires) {
      if (w.b.p === part.id && w.b.pin === pin) {
        const src = this.getPart(w.a.p);
        if (src && src.outVals[w.a.pin]) v = true;
      }
    }
    return v;
  }

  step() {
    const next = new Map();
    for (const p of this.parts) {
      const n = partIns(p);
      const inv = [];
      for (let i = 0; i < n; i++) inv.push(this.inputValue(p, i));
      p.inVals = inv;
      next.set(p.id, PART_DEFS[p.type].evaluate(inv, p));
    }
    for (const p of this.parts) p.outVals = next.get(p.id) || [];
  }

  serialize() {
    return {
      parts: this.parts.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, config: p.config })),
      wires: this.wires.map(w => ({ a: { ...w.a }, b: { ...w.b } })),
    };
  }

  static deserialize(data) {
    const c = new Circuit();
    const idMap = new Map();
    for (const sp of (data.parts || [])) {
      const p = c.addPart(sp.type, sp.x, sp.y, JSON.parse(JSON.stringify(sp.config || {})));
      idMap.set(sp.id, p.id);
    }
    for (const sw of (data.wires || [])) {
      const a = idMap.get(sw.a.p), b = idMap.get(sw.b.p);
      if (a && b) c.addWire(a, sw.a.pin, b, sw.b.pin);
    }
    return c;
  }
}
