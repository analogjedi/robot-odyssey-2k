// A programmable humanoid robot: a body in the world plus a circuit board
// inside, with sensors and actuators mounted around the board's edges.
import { Circuit } from './circuit.js';

export const BOARD_COLS = 20;
export const BOARD_ROWS = 12;

export class Robot {
  constructor({ name, color, tx, ty }) {
    this.name = name;
    this.color = color;
    this.w = 26;
    this.h = 26;
    this.x = tx * 32 + (32 - this.w) / 2; // px, top-left
    this.y = ty * 32 + (32 - this.h) / 2;
    this.powered = true;
    this.held = null;            // item ref while the grabber holds one
    this.thrust = { N: false, E: false, S: false, W: false };
    this.bumpFrames = { N: 0, E: 0, S: 0, W: 0 };
    this.tx = false;             // radio broadcast latched from last circuit step
    this.grabWant = false;
    this.circuit = new Circuit();
    this.buildBoard();
  }

  // Mount the standard peripheral set at fixed board positions.
  buildBoard() {
    const c = this.circuit;
    this.parts = {
      battery: c.addPart('BATTERY', 0, 0, {}),
      bumpW: c.addPart('BUMPER', 0, 3, { dir: 'W' }),
      thrustW: c.addPart('THRUSTER', 0, 6, { dir: 'W' }),
      scanner: c.addPart('SCANNER', 0, 9, {}),
      bumpN: c.addPart('BUMPER', 6, 0, { dir: 'N' }),
      thrustN: c.addPart('THRUSTER', 12, 0, { dir: 'N' }),
      antenna: c.addPart('ANTENNA', 19, 0, { ch: 1 }),
      bumpE: c.addPart('BUMPER', 19, 3, { dir: 'E' }),
      thrustE: c.addPart('THRUSTER', 19, 6, { dir: 'E' }),
      grabber: c.addPart('GRABBER', 19, 9, {}),
      bumpS: c.addPart('BUMPER', 6, 11, { dir: 'S' }),
      thrustS: c.addPart('THRUSTER', 12, 11, { dir: 'S' }),
    };
  }

  // Replace the circuit (e.g. restoring a save) and re-link peripheral refs.
  setCircuit(circuit) {
    this.circuit = circuit;
    const find = (type, dir) => circuit.parts.find(p => p.type === type && (!dir || p.config.dir === dir));
    this.parts = {
      battery: find('BATTERY'),
      bumpN: find('BUMPER', 'N'), bumpE: find('BUMPER', 'E'),
      bumpS: find('BUMPER', 'S'), bumpW: find('BUMPER', 'W'),
      thrustN: find('THRUSTER', 'N'), thrustE: find('THRUSTER', 'E'),
      thrustS: find('THRUSTER', 'S'), thrustW: find('THRUSTER', 'W'),
      scanner: find('SCANNER'), antenna: find('ANTENNA'), grabber: find('GRABBER'),
    };
  }

  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  cx() { return this.x + this.w / 2; }
  cy() { return this.y + this.h / 2; }
  tileX() { return Math.floor(this.cx() / 32); }
  tileY() { return Math.floor(this.cy() / 32); }

  bumping(dir) { return this.bumpFrames[dir] > 0; }

  // One circuit tick: load sensor values, step the simulation, latch actuators.
  tickCircuit(world) {
    const P = this.parts;
    P.bumpN.state.ext = this.bumping('N');
    P.bumpE.state.ext = this.bumping('E');
    P.bumpS.state.ext = this.bumping('S');
    P.bumpW.state.ext = this.bumping('W');

    const t = world.scannerTarget(this);
    const dead = 12;
    const dx = t.x - this.cx(), dy = t.y - this.cy();
    P.scanner.state.ext = { N: dy < -dead, S: dy > dead, E: dx > dead, W: dx < -dead };

    P.antenna.state.ext = world.radioHears(this, P.antenna.config.ch || 1);
    P.grabber.state.ext = !!this.held;

    this.circuit.step();

    if (this.powered) {
      this.thrust = {
        N: !!P.thrustN.inVals[0], E: !!P.thrustE.inVals[0],
        S: !!P.thrustS.inVals[0], W: !!P.thrustW.inVals[0],
      };
      this.grabWant = !!P.grabber.inVals[0];
      this.tx = !!P.antenna.inVals[0];
    } else {
      this.thrust = { N: false, E: false, S: false, W: false };
      this.grabWant = false;
      this.tx = false;
    }
  }

  // Per-frame physics: thrust movement, bumper contact, grabber, held item.
  update(world) {
    const SPEED = 2;
    const dx = (this.thrust.E ? SPEED : 0) - (this.thrust.W ? SPEED : 0);
    const dy = (this.thrust.S ? SPEED : 0) - (this.thrust.N ? SPEED : 0);
    if (dx) this.tryMove(world, Math.sign(dx), Math.abs(dx), true);
    if (dy) this.tryMove(world, Math.sign(dy), Math.abs(dy), false);

    // Contact probes: bumpers also fire from touch, not just blocked thrust.
    const r = this.rect();
    if (world.rectBlocked(r.x, r.y - 1.5, r.w, 1, 'robot', this)) this.bumpFrames.N = 6;
    if (world.rectBlocked(r.x, r.y + r.h + 0.5, r.w, 1, 'robot', this)) this.bumpFrames.S = 6;
    if (world.rectBlocked(r.x - 1.5, r.y, 1, r.h, 'robot', this)) this.bumpFrames.W = 6;
    if (world.rectBlocked(r.x + r.w + 0.5, r.y, 1, r.h, 'robot', this)) this.bumpFrames.E = 6;

    for (const d of 'NESW') if (this.bumpFrames[d] > 0) this.bumpFrames[d]--;

    // Grabber engage/release.
    if (this.grabWant && !this.held) {
      const item = world.itemAtRect(this.rect());
      if (item) { this.held = item; item.heldBy = this; }
    } else if (!this.grabWant && this.held) {
      this.held.heldBy = null;
      this.held = null;
    }
    if (this.held) { this.held.x = this.cx(); this.held.y = this.cy(); }
  }

  tryMove(world, sign, amount, horizontal) {
    for (let i = 0; i < amount; i++) {
      const nx = this.x + (horizontal ? sign : 0);
      const ny = this.y + (horizontal ? 0 : sign);
      if (world.rectBlocked(nx, ny, this.w, this.h, 'robot', this)) {
        const dir = horizontal ? (sign > 0 ? 'E' : 'W') : (sign > 0 ? 'S' : 'N');
        this.bumpFrames[dir] = 6;
        return;
      }
      this.x = nx; this.y = ny;
    }
  }
}
