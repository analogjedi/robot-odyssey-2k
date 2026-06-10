// World simulation: tile map, doors & pressure plates, items, the player,
// robots and the shared radio spectrum.
import { Robot } from './robot.js';

export const TILE = 32;
export const COLS = 30;
export const ROWS = 18;

export const ROBOT_DEFS = {
  '1': { name: 'AXIOM', color: '#22d3ee' },
  '2': { name: 'VECTOR', color: '#fb923c' },
  '3': { name: 'PULSE', color: '#e879f9' },
};

const PLATE_CHARS = 'abcd';
const DOOR_CHARS = 'ABCD';

export class World {
  constructor(level, game) {
    this.level = level;
    this.game = game;
    this.frame = 0;
    this.completed = false;
    this.keyDoorOpen = false;
    this.radio = []; // [{ch, robot}] broadcasts latched from the last circuit tick
    this.robots = [];
    this.items = [];
    this.plates = [];
    this.doors = {}; // ch -> {rule:[plates], open, tiles:[{x,y}]}
    this.promptRobot = null;
    this.exitReady = false;

    this.tiles = level.map.map(row => row.split(''));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = this.tiles[y][x];
        if (ch === 'P') {
          this.player = {
            x: x * TILE + 5, y: y * TILE + 5, w: 22, h: 22,
            crystals: 0, keycard: false, inside: null,
          };
          this.tiles[y][x] = '.';
        } else if (ROBOT_DEFS[ch]) {
          this.robots.push(new Robot({ ...ROBOT_DEFS[ch], tx: x, ty: y }));
          this.tiles[y][x] = '.';
        } else if (PLATE_CHARS.includes(ch)) {
          this.plates.push({ ch, x, y });
        } else if (DOOR_CHARS.includes(ch) || ch === 'K') {
          (this.doors[ch] ||= { rule: (level.doors || {})[ch] || [ch.toLowerCase()], open: false, tiles: [] })
            .tiles.push({ x, y });
        }
      }
    }

    let itemId = 1;
    for (const it of (level.items || [])) {
      this.items.push({
        id: 'i' + (itemId++), type: it.type,
        x: it.x * TILE + TILE / 2, y: it.y * TILE + TILE / 2, heldBy: null,
      });
    }
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return this.tiles[ty][tx];
  }

  tileBlocks(ch, who) {
    if (ch === '#') return true;
    if (DOOR_CHARS.includes(ch)) return !this.doors[ch].open;
    if (ch === 'K') return !this.keyDoorOpen;
    if (ch === 't') return who === 'player'; // service vent: robots only
    if (ch === '~') return who === 'robot';  // EMP field: humans only
    return false;
  }

  rectBlocked(x, y, w, h, who, selfRobot = null) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.tileBlocks(this.tileAt(tx, ty), who)) return true;
    if (who === 'robot') {
      for (const r of this.robots) {
        if (r === selfRobot) continue;
        if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
      }
    }
    return false;
  }

  scannerTarget(robot) {
    const p = this.player;
    return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }

  radioHears(robot, ch) {
    return this.radio.some(b => b.ch === ch && b.robot !== robot);
  }

  itemAtRect(r) {
    return this.items.find(it => !it.heldBy &&
      it.x > r.x - 4 && it.x < r.x + r.w + 4 && it.y > r.y - 4 && it.y < r.y + r.h + 4) || null;
  }

  pressedPlates() {
    const set = new Set();
    const occupies = (px, py, plate) =>
      Math.floor(px / TILE) === plate.x && Math.floor(py / TILE) === plate.y;
    for (const plate of this.plates) {
      const p = this.player;
      if (!p.inside && occupies(p.x + p.w / 2, p.y + p.h / 2, plate)) { set.add(plate.ch); continue; }
      if (this.robots.some(r => occupies(r.cx(), r.cy(), plate))) { set.add(plate.ch); continue; }
      if (this.items.some(it => !it.heldBy && occupies(it.x, it.y, plate))) set.add(plate.ch);
    }
    return set;
  }

  update(input) {
    if (this.completed) return;
    this.frame++;
    const game = this.game;

    // Circuit phase at 20 Hz: sample sensors, step every board, latch actuators,
    // then publish this tick's radio broadcasts for the next tick.
    if (this.frame % 3 === 0) {
      for (const r of this.robots) r.tickCircuit(this);
      this.radio = this.robots
        .filter(r => r.tx)
        .map(r => ({ ch: r.parts.antenna.config.ch || 1, robot: r }));
    }

    for (const r of this.robots) r.update(this);

    // Player: ride the robot if inside, otherwise walk.
    const p = this.player;
    if (p.inside) {
      p.x = p.inside.cx() - p.w / 2;
      p.y = p.inside.cy() - p.h / 2;
    } else if (input) {
      const SP = 2.6;
      let dx = (input.has('right') ? SP : 0) - (input.has('left') ? SP : 0);
      let dy = (input.has('down') ? SP : 0) - (input.has('up') ? SP : 0);
      this.movePlayer(dx, 0);
      this.movePlayer(0, dy);
    }

    // Pickups and robot→player handoff.
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const it of [...this.items]) {
      const near = Math.abs(it.x - pcx) < 18 && Math.abs(it.y - pcy) < 18;
      const fromRobot = it.heldBy && !p.inside &&
        pcx > it.heldBy.x - 6 && pcx < it.heldBy.x + it.heldBy.w + 6 &&
        pcy > it.heldBy.y - 6 && pcy < it.heldBy.y + it.heldBy.h + 6;
      if ((near && !it.heldBy && !p.inside) || fromRobot) {
        if (it.heldBy) it.heldBy.held = null;
        this.items = this.items.filter(x => x !== it);
        if (it.type === 'crystal') { p.crystals++; game.toast(`Power crystal acquired (${p.crystals}/${this.level.crystals})`); }
        if (it.type === 'keycard') { p.keycard = true; game.toast('Keycard acquired — find the gold door'); }
        game.sfx('pickup');
      }
    }

    // Keycard doors unlock on approach.
    if (p.keycard && !this.keyDoorOpen && this.doors.K) {
      const ptx = Math.floor(pcx / TILE), pty = Math.floor(pcy / TILE);
      for (const t of this.doors.K.tiles) {
        if (Math.abs(t.x - ptx) + Math.abs(t.y - pty) <= 1) {
          this.keyDoorOpen = true;
          game.toast('Keycard accepted — security door unlocked');
          game.sfx('door');
        }
      }
    }

    // Plates → doors.
    const pressed = this.pressedPlates();
    for (const ch of DOOR_CHARS) {
      const d = this.doors[ch];
      if (!d) continue;
      const open = d.rule.every(c => pressed.has(c));
      if (open && !d.open) { game.toast(`Blast door ${ch} open`); game.sfx('door'); }
      d.open = open;
    }
    this.pressed = pressed;

    // Robot under the player → show the "enter" prompt.
    this.promptRobot = null;
    if (!p.inside) {
      for (const r of this.robots) {
        if (pcx > r.x && pcx < r.x + r.w && pcy > r.y && pcy < r.y + r.h) this.promptRobot = r;
      }
    }

    // Exit pad.
    this.exitReady = this.player.crystals >= (this.level.crystals || 0);
    if (!p.inside && this.tileAt(Math.floor(pcx / TILE), Math.floor(pcy / TILE)) === 'X') {
      if (this.exitReady && !this.level.sandbox) {
        this.completed = true;
        game.onLevelComplete();
      } else if (!this.level.sandbox && this.frame % 90 === 0) {
        game.toast(`The lift needs ${this.level.crystals} power crystal(s) — you have ${p.crystals}.`);
      }
    }
  }

  movePlayer(dx, dy) {
    const p = this.player;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    if (!steps) return;
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (!this.rectBlocked(p.x + sx, p.y, p.w, p.h, 'player')) p.x += sx;
      if (!this.rectBlocked(p.x, p.y + sy, p.w, p.h, 'player')) p.y += sy;
    }
  }

  // Find a spot for the player to stand when exiting a robot.
  placePlayerNear(tx, ty) {
    const p = this.player;
    for (let radius = 0; radius <= 5; radius++) {
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const nx = tx + ox, ny = ty + oy;
          const px = nx * TILE + 5, py = ny * TILE + 5;
          if (!this.rectBlocked(px, py, p.w, p.h, 'player')) {
            p.x = px; p.y = py;
            return;
          }
        }
      }
    }
  }
}
