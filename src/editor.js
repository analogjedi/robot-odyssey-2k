// The inside-a-robot circuit board editor: place parts, drag wires between
// pins, tune configurable parts, and burn boards into custom chips.
import { PART_DEFS, partIns, partOuts, partHCells, partLabel, partDef } from './circuit.js';
import { burnChip } from './chips.js';
import { roundRect } from './render.js';

const CS = 44;          // board cell size in px
const BCOLS = 20, BROWS = 12;
const BX = 40, BY = 48; // board origin
const PAL_Y = 582;      // palette rows

const PALETTE = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'FLIPFLOP', 'CLOCK',
  'DELAY', 'COUNTER', 'MUX', 'NEURO', 'PIN_IN', 'PIN_OUT'];

export class Editor {
  constructor(game, robot) {
    this.game = game;
    this.robot = robot;
    this.tool = null;          // part type string, {chip: blueprint}, or null
    this.selected = null;      // part id
    this.dragWire = null;      // {from:{partId,kind,pin}, mx, my}
    this.hover = null;
    this.mx = 0; this.my = 0;
    this.inspector = document.getElementById('inspector');
    this.refreshInspector();
  }

  destroy() {
    this.inspector.classList.add('hidden');
    this.inspector.innerHTML = '';
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  partRect(p) {
    const h = partHCells(p);
    return { x: BX + p.x * CS + 3, y: BY + p.y * CS + 3, w: CS - 6, h: h * CS - 6 };
  }

  pinList(p) {
    const r = this.partRect(p);
    const ins = partIns(p), outs = partOuts(p);
    const pins = [];
    for (let i = 0; i < ins; i++)
      pins.push({ part: p, kind: 'in', pin: i, x: r.x, y: r.y + r.h * (i + 1) / (ins + 1) });
    for (let i = 0; i < outs; i++)
      pins.push({ part: p, kind: 'out', pin: i, x: r.x + r.w, y: r.y + r.h * (i + 1) / (outs + 1) });
    return pins;
  }

  pinAt(mx, my) {
    for (const p of this.robot.circuit.parts) {
      for (const pin of this.pinList(p)) {
        if ((pin.x - mx) ** 2 + (pin.y - my) ** 2 < 100) return pin;
      }
    }
    return null;
  }

  partAt(mx, my) {
    for (const p of this.robot.circuit.parts) {
      const r = this.partRect(p);
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return p;
    }
    return null;
  }

  pinPos(partId, kind, pin) {
    const p = this.robot.circuit.getPart(partId);
    if (!p) return null;
    return this.pinList(p).find(q => q.kind === kind && q.pin === pin) || null;
  }

  wireAt(mx, my) {
    for (const w of this.robot.circuit.wires) {
      const a = this.pinPos(w.a.p, 'out', w.a.pin);
      const b = this.pinPos(w.b.p, 'in', w.b.pin);
      if (!a || !b) continue;
      for (let t = 0.05; t < 1; t += 0.05) {
        const pt = bezierPoint(a, b, t);
        if ((pt.x - mx) ** 2 + (pt.y - my) ** 2 < 64) return w;
      }
    }
    return null;
  }

  occupied() {
    const set = new Set();
    for (const p of this.robot.circuit.parts) {
      const h = partHCells(p);
      for (let i = 0; i < h; i++) set.add(p.x + ',' + (p.y + i));
    }
    return set;
  }

  // ── Top bar buttons ──────────────────────────────────────────────────────

  buttons() {
    const on = this.robot.powered;
    return [
      { id: 'power', label: on ? '⏻ PWR ON' : '⏻ PWR OFF', x: 540, w: 86, hot: on },
      { id: 'burn', label: '🔥 BURN CHIP', x: 632, w: 104 },
      { id: 'clear', label: 'CLEAR', x: 742, w: 58 },
      { id: 'help', label: '?', x: 806, w: 28 },
      { id: 'exit', label: 'EXIT [ESC]', x: 840, w: 90 },
    ];
  }

  buttonAt(mx, my) {
    if (my > 38) return null;
    return this.buttons().find(b => mx >= b.x && mx <= b.x + b.w) || null;
  }

  paletteItems() {
    const items = PALETTE.map((t, i) => ({ type: t, x: 8 + i * 59, y: PAL_Y, w: 55, h: 24 }));
    this.game.customChips.forEach((bp, i) => {
      items.push({ chip: bp, x: 8 + i * 80, y: PAL_Y + 28, w: 76, h: 24 });
    });
    return items;
  }

  paletteAt(mx, my) {
    return this.paletteItems().find(b =>
      mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) || null;
  }

  // ── Input ────────────────────────────────────────────────────────────────

  mousedown(mx, my, button) {
    this.mx = mx; this.my = my;
    if (button === 2) { this.deleteAt(mx, my); return; }

    const btn = this.buttonAt(mx, my);
    if (btn) { this.runButton(btn.id); return; }

    const pal = this.paletteAt(mx, my);
    if (pal) {
      const tool = pal.chip ? { chip: pal.chip } : pal.type;
      this.tool = sameTool(this.tool, tool) ? null : tool;
      return;
    }

    const pin = this.pinAt(mx, my);
    if (pin) {
      this.dragWire = { from: { partId: pin.part.id, kind: pin.kind, pin: pin.pin }, mx, my };
      return;
    }

    const part = this.partAt(mx, my);
    if (part) {
      this.selected = part.id;
      this.refreshInspector();
      return;
    }

    // Empty board cell: place the active tool.
    if (this.tool && mx >= BX && my >= BY && mx < BX + BCOLS * CS && my < BY + BROWS * CS) {
      const cx = Math.floor((mx - BX) / CS), cy = Math.floor((my - BY) / CS);
      this.placeAt(cx, cy);
      return;
    }

    this.selected = null;
    this.refreshInspector();
  }

  placeAt(cx, cy) {
    const c = this.robot.circuit;
    const probe = typeof this.tool === 'string'
      ? { type: this.tool, config: {} }
      : { type: 'CHIP', config: { bp: this.tool.chip } };
    const h = partHCells(probe);
    if (cy + h > BROWS) { this.game.toast('No room — the package hangs off the board.'); return; }
    const occ = this.occupied();
    for (let i = 0; i < h; i++) {
      if (occ.has(cx + ',' + (cy + i))) { this.game.toast('That spot is occupied.'); return; }
    }
    const part = c.addPart(probe.type, cx, cy, JSON.parse(JSON.stringify(probe.config)));
    this.selected = part.id;
    this.refreshInspector();
    this.game.sfx('place');
  }

  mousemove(mx, my) {
    this.mx = mx; this.my = my;
    this.hover = this.partAt(mx, my) || this.pinAt(mx, my);
    if (this.dragWire) { this.dragWire.mx = mx; this.dragWire.my = my; }
  }

  mouseup(mx, my) {
    if (!this.dragWire) return;
    const from = this.dragWire.from;
    this.dragWire = null;
    const pin = this.pinAt(mx, my);
    if (!pin || (pin.part.id === from.partId && pin.kind === from.kind && pin.pin === from.pin)) return;
    if (pin.kind === from.kind) { this.game.toast('Connect an output pin to an input pin.'); this.game.sfx('error'); return; }
    const out = pin.kind === 'out' ? { p: pin.part.id, pin: pin.pin } : { p: from.partId, pin: from.pin };
    const inn = pin.kind === 'in' ? { p: pin.part.id, pin: pin.pin } : { p: from.partId, pin: from.pin };
    if (this.robot.circuit.addWire(out.p, out.pin, inn.p, inn.pin)) this.game.sfx('wire');
  }

  deleteAt(mx, my) {
    const part = this.partAt(mx, my);
    if (part) { this.deletePart(part); return; }
    const w = this.wireAt(mx, my);
    if (w) { this.robot.circuit.removeWire(w); this.game.sfx('delete'); }
  }

  deletePart(part) {
    if (partDef(part).peripheral) { this.game.toast('Peripherals are welded to the chassis.'); return; }
    this.robot.circuit.removePart(part.id);
    if (this.selected === part.id) { this.selected = null; this.refreshInspector(); }
    this.game.sfx('delete');
  }

  key(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const part = this.selected && this.robot.circuit.getPart(this.selected);
      if (part) this.deletePart(part);
    }
  }

  runButton(id) {
    const game = this.game;
    if (id === 'exit') { game.exitRobot(); }
    else if (id === 'power') {
      this.robot.powered = !this.robot.powered;
      game.toast(this.robot.powered ? `${this.robot.name} powered up` : `${this.robot.name} powered down`);
    }
    else if (id === 'clear') {
      const c = this.robot.circuit;
      for (const p of [...c.parts]) if (!partDef(p).peripheral) c.removePart(p.id);
      this.selected = null;
      this.refreshInspector();
      game.toast('Board wiped (peripherals stay).');
    }
    else if (id === 'help') { game.showEditorHelp(); }
    else if (id === 'burn') {
      const res = burnChip(this.robot.circuit, '');
      if (res.error) { game.toast(res.error); game.sfx('error'); return; }
      let name = '';
      try { name = window.prompt('Tapeout! Name your chip:', `IC-${game.customChips.length + 1}`) || ''; } catch { }
      if (!name) name = `IC-${game.customChips.length + 1}`;
      res.blueprint.name = name.slice(0, 10).toUpperCase();
      game.customChips.push(res.blueprint);
      game.saveProgress();
      game.sfx('burn');
      game.toast(`${res.blueprint.name} fabricated — find it in the chip palette (bottom row).`);
    }
  }

  // ── Inspector (DOM) for configurable parts ───────────────────────────────

  refreshInspector() {
    const el = this.inspector;
    const part = this.selected && this.robot.circuit.getPart(this.selected);
    if (!part) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const def = partDef(part);
    let html = `<h3>${partLabel(part)}</h3><p>${def.desc || ''}</p>`;
    if (def.configurable === 'clock') {
      html += `<div class="row">period: ${[8, 16, 32, 64].map(n =>
        `<button data-act="period" data-v="${n}" class="${(part.config.period || 16) === n ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    } else if (def.configurable === 'delay') {
      html += `<div class="row">delay: ${[2, 4, 8, 16, 32].map(n =>
        `<button data-act="n" data-v="${n}" class="${(part.config.n || 4) === n ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    } else if (def.configurable === 'antenna') {
      html += `<div class="row">channel: ${[1, 2, 3, 4].map(n =>
        `<button data-act="ch" data-v="${n}" class="${(part.config.ch || 1) === n ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    } else if (def.configurable === 'neuro') {
      const w = part.config.w || (part.config.w = [1, 1, 1, 1]);
      const t = part.config.t ?? (part.config.t = 2);
      'ABCD'.split('').forEach((ch, i) => {
        html += `<div class="row">w·${ch}: ${[-1, 0, 1].map(v =>
          `<button data-act="w${i}" data-v="${v}" class="${w[i] === v ? 'on' : ''}">${v > 0 ? '+1' : v}</button>`).join('')}</div>`;
      });
      html += `<div class="row">threshold: ${[1, 2, 3, 4].map(v =>
        `<button data-act="t" data-v="${v}" class="${t === v ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    }
    if (!def.peripheral) html += `<div class="row"><button data-act="del">✕ remove (or right-click)</button></div>`;
    el.innerHTML = html;
    el.classList.remove('hidden');
    el.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act, v = parseInt(b.dataset.v, 10);
        if (act === 'del') { this.deletePart(part); return; }
        if (act === 'period') part.config.period = v;
        else if (act === 'n') { part.config.n = v; part.state.buf = []; }
        else if (act === 'ch') part.config.ch = v;
        else if (act === 't') part.config.t = v;
        else if (act.startsWith('w')) part.config.w[parseInt(act[1], 10)] = v;
        this.refreshInspector();
      });
    });
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  render(ctx) {
    const robot = this.robot;
    ctx.fillStyle = '#04070d';
    ctx.fillRect(0, 0, 960, 640);

    // board surface
    ctx.fillStyle = '#071018';
    ctx.fillRect(BX, BY, BCOLS * CS, BROWS * CS);
    ctx.strokeStyle = robot.color;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(BX - 2.5, BY - 2.5, BCOLS * CS + 5, BROWS * CS + 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(56,90,140,0.25)';
    for (let y = 0; y <= BROWS; y++)
      for (let x = 0; x <= BCOLS; x++)
        ctx.fillRect(BX + x * CS - 1, BY + y * CS - 1, 2, 2);

    // wires under parts
    for (const w of robot.circuit.wires) {
      const a = this.pinPos(w.a.p, 'out', w.a.pin);
      const b = this.pinPos(w.b.p, 'in', w.b.pin);
      if (!a || !b) continue;
      const src = robot.circuit.getPart(w.a.p);
      drawWire(ctx, a, b, src && src.outVals[w.a.pin]);
    }

    if (this.dragWire) {
      const a = this.pinPos(this.dragWire.from.partId, this.dragWire.from.kind, this.dragWire.from.pin);
      if (a) drawWire(ctx, a, { x: this.dragWire.mx, y: this.dragWire.my }, false, true);
    }

    for (const p of robot.circuit.parts) this.drawPart(ctx, p);

    this.drawTopBar(ctx);
    this.drawPalette(ctx);
  }

  drawPart(ctx, p) {
    const def = partDef(p);
    const r = this.partRect(p);
    const active = p.outVals.some(Boolean) || p.inVals.some(Boolean);

    ctx.fillStyle = def.peripheral ? '#101b2e' : '#0d1626';
    ctx.strokeStyle = this.selected === p.id ? '#f8fafc' : def.color;
    ctx.lineWidth = this.selected === p.id ? 2 : 1.2;
    if (active) { ctx.shadowColor = def.color; ctx.shadowBlur = 8; }
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;

    ctx.fillStyle = def.color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    const label = partLabel(p);
    // parts with named pins get their label at the top, clear of the pin text
    const labelY = (def.inLabels || def.outLabels) ? r.y + 10 : r.y + r.h / 2 + 3;
    if (label.length > 6 && r.h > CS) {
      ctx.fillText(label.slice(0, 6), r.x + r.w / 2, labelY);
      ctx.fillText(label.slice(6), r.x + r.w / 2, labelY + 10);
    } else {
      ctx.fillText(label.slice(0, 6), r.x + r.w / 2, labelY);
    }

    // pins
    for (const pin of this.pinList(p)) {
      const lit = pin.kind === 'out' ? !!p.outVals[pin.pin] : !!p.inVals[pin.pin];
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#4ade80' : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = lit ? '#4ade80' : '#64748b';
      ctx.stroke();
      const labels = pin.kind === 'in' ? def.inLabels : def.outLabels;
      if (labels && labels[pin.pin]) {
        ctx.fillStyle = '#bccadf';
        ctx.font = '8px monospace';
        ctx.textAlign = pin.kind === 'in' ? 'left' : 'right';
        ctx.fillText(labels[pin.pin], pin.x + (pin.kind === 'in' ? 7 : -7), pin.y + 3);
      }
    }
  }

  drawTopBar(ctx) {
    ctx.fillStyle = '#0b1322';
    ctx.fillRect(0, 0, 960, 42);
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = this.robot.color;
    ctx.fillText(`▣ INSIDE ${this.robot.name}`, 12, 17);

    // hovered part tooltip
    const hov = this.hover && (this.hover.part || this.hover);
    if (hov && hov.type) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#bccadf';
      const d = partDef(hov).desc || '';
      ctx.fillText(d.slice(0, 78) + (d.length > 78 ? '…' : ''), 12, 34);
    } else {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#9db1d1';
      ctx.fillText('click a palette part then a board cell · drag pin→pin to wire · right-click deletes', 12, 34);
    }

    for (const b of this.buttons()) {
      ctx.fillStyle = b.hot ? '#14532d' : '#16233c';
      roundRect(ctx, b.x, 8, b.w, 24, 4);
      ctx.fill();
      ctx.strokeStyle = '#33507a';
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, 23);
    }
  }

  drawPalette(ctx) {
    ctx.fillStyle = '#0b1322';
    ctx.fillRect(0, PAL_Y - 6, 960, 640 - PAL_Y + 6);
    for (const it of this.paletteItems()) {
      const isSel = sameTool(this.tool, it.chip ? { chip: it.chip } : it.type);
      const color = it.chip ? '#5eead4' : PART_DEFS[it.type].color;
      ctx.fillStyle = isSel ? '#1d3354' : '#101b2e';
      roundRect(ctx, it.x, it.y, it.w, it.h, 4);
      ctx.fill();
      ctx.strokeStyle = isSel ? '#f8fafc' : color;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      const label = it.chip ? it.chip.name : PART_DEFS[it.type].label;
      ctx.fillText(label, it.x + it.w / 2, it.y + 15);
    }
    if (!this.game.customChips.length) {
      ctx.fillStyle = '#8aa0c4';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('burned chips appear here ▴ place PIN▸/▸PIN pads + logic, then BURN CHIP', 8, PAL_Y + 44);
    }
  }
}

function sameTool(a, b) {
  if (a === b) return true;
  if (a && b && a.chip && b.chip) return a.chip === b.chip;
  return false;
}

function bezierPoint(a, b, t) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  const p1 = { x: a.x + dx, y: a.y }, p2 = { x: b.x - dx, y: b.y };
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
  };
}

function drawWire(ctx, a, b, hot, preview) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y);
  if (preview) {
    ctx.strokeStyle = 'rgba(148,163,184,0.7)';
    ctx.setLineDash([5, 4]);
  } else if (hot) {
    ctx.strokeStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 6;
  } else {
    ctx.strokeStyle = '#475569';
  }
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}
