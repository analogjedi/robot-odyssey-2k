// Robot Odyssey 2K — entry point and game state machine.
import { LEVELS, SANDBOX } from './levels.js';
import { World } from './world.js';
import { renderWorld } from './render.js';
import { Editor } from './editor.js';
import { Circuit } from './circuit.js';
import { makeReflexChip, makeOscChip } from './chips.js';
import { sfx } from './sfx.js';
import * as UI from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SAVE_KEY = 'ro2k-save-v1';

const game = {
  state: 'menu',        // menu | world | editor
  paused: false,
  levelIndex: 0,
  world: null,
  editor: null,
  customChips: [],
  keys: new Set(),
  sfx,
  toast: UI.toast,
  showEditorHelp: UI.showEditorHelp,

  onLevelComplete() {
    sfx('win');
    const level = this.world.level;
    if (level.unlockChip) this.grantChip(level.unlockChip);
    const isLast = this.levelIndex >= LEVELS.length - 1;
    this.levelIndex = Math.min(this.levelIndex + 1, LEVELS.length - 1);
    this.saveProgress(isLast);
    if (isLast) {
      UI.showModal(
        `<h2>SURFACE REACHED</h2>
         <p>The lift doors open on daylight. Behind you: five sealed sectors, a trail of
         hand-soldered logic, and three robots that learned everything they know from you.</p>
         <p>You escaped the megafab the only way an engineer could — <b>by building</b>.</p>
         <p class="dim">The Innovation Lab sandbox is open from the menu, and your burned
         chips are saved. Thanks for playing Robot Odyssey 2K.</p>`,
        [{ label: 'Main menu', action: () => this.toMenu() }]
      );
    } else {
      UI.showModal(
        `<h2>SECTOR CLEARED</h2><p>${level.name} is behind you.${level.unlockChip
          ? ` Prefab chip <b>${level.unlockChip === 'REFLEX' ? 'REFLEX-1' : 'OSC-1'}</b> added to your palette.` : ''}</p>`,
        [{ label: 'Next sector', action: () => this.startLevel(this.levelIndex) }]
      );
    }
  },

  grantChip(kind) {
    const bp = kind === 'REFLEX' ? makeReflexChip() : makeOscChip();
    if (!this.customChips.some(c => c.name === bp.name)) this.customChips.push(bp);
  },

  startLevel(idx, circuits = null) {
    this.levelIndex = idx;
    this.world = new World(LEVELS[idx], this);
    this.state = 'world';
    this.editor = null;
    if (circuits) this.applyCircuits(circuits);
    UI.hideMenu();
    UI.showIntro(this.world.level);
  },

  startSandbox() {
    this.world = new World(SANDBOX, this);
    this.state = 'world';
    this.editor = null;
    UI.hideMenu();
    UI.showIntro(SANDBOX);
  },

  applyCircuits(circuits) {
    circuits.forEach((data, i) => {
      const robot = this.world.robots[i];
      if (robot && data) robot.setCircuit(Circuit.deserialize(data));
    });
  },

  enterRobot(robot) {
    this.world.player.inside = robot;
    this.editor = new Editor(this, robot);
    this.state = 'editor';
    sfx('enter');
  },

  exitRobot() {
    const robot = this.world.player.inside;
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    this.world.player.inside = null;
    if (robot) this.world.placePlayerNear(robot.tileX(), robot.tileY());
    this.state = 'world';
    sfx('exit');
    this.saveProgress();
  },

  resetLevel() {
    if (!this.world || this.world.level.sandbox) return;
    const circuits = this.world.robots.map(r => r.circuit.serialize());
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    this.world = new World(LEVELS[this.levelIndex], this);
    this.applyCircuits(circuits);
    this.state = 'world';
    UI.toast('Sector reset — wiring preserved.');
  },

  toMenu() {
    if (this.editor) { this.editor.destroy(); this.editor = null; }
    this.state = 'menu';
    this.world = null;
    UI.showMenu(this.hasSave());
  },

  saveProgress(finished = false) {
    try {
      const data = {
        level: this.levelIndex,
        finished,
        chips: this.customChips,
        circuits: (this.world && !this.world.level.sandbox)
          ? this.world.robots.map(r => r.circuit.serialize()) : null,
        circuitsLevel: this.world ? this.levelIndex : null,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* private mode etc. */ }
  },

  loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
  },

  hasSave() { return !!this.loadSave(); },
};

UI.init(game);

// ── Input ───────────────────────────────────────────────────────────────────

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

let hintIndex = -1;

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const move = KEYMAP[e.key];
  if (move) { game.keys.add(move); e.preventDefault(); }

  if (e.key === 'Escape') {
    if (UI.modalOpen()) { UI.closeModal(); return; }
    if (game.state === 'editor') game.exitRobot();
    return;
  }
  if (UI.modalOpen() || game.state === 'menu') return;

  if (game.state === 'editor') {
    game.editor.key(e);
    return;
  }
  // world keys
  const k = e.key.toLowerCase();
  if (k === 'e' && game.world && game.world.promptRobot) {
    game.enterRobot(game.world.promptRobot);
  } else if (k === 'h' && game.world) {
    const hints = game.world.level.hints || [];
    if (hints.length) {
      hintIndex = (hintIndex + 1) % hints.length;
      UI.toast(`hint ${hintIndex + 1}/${hints.length}: ${hints[hintIndex]}`, 7000);
    }
  } else if (k === 'c') {
    UI.showCodex();
  } else if (k === 'm') {
    game.toMenu();
  } else if (k === 'r' && e.shiftKey) {
    game.resetLevel();
  }
});

document.addEventListener('keyup', e => {
  const move = KEYMAP[e.key];
  if (move) game.keys.delete(move);
});

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

canvas.addEventListener('mousedown', e => {
  if (game.state !== 'editor' || UI.modalOpen()) return;
  const { x, y } = canvasPos(e);
  game.editor.mousedown(x, y, e.button);
});
canvas.addEventListener('mousemove', e => {
  if (game.state !== 'editor') return;
  const { x, y } = canvasPos(e);
  game.editor.mousemove(x, y);
});
canvas.addEventListener('mouseup', e => {
  if (game.state !== 'editor') return;
  const { x, y } = canvasPos(e);
  game.editor.mouseup(x, y);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── Menu buttons ────────────────────────────────────────────────────────────

document.getElementById('btn-new').addEventListener('click', () => {
  game.customChips = [];
  try { localStorage.removeItem(SAVE_KEY); } catch { }
  game.startLevel(0);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  const save = game.loadSave();
  if (!save) return;
  game.customChips = save.chips || [];
  const idx = Math.min(save.level || 0, LEVELS.length - 1);
  game.startLevel(idx, save.circuitsLevel === idx ? save.circuits : null);
});
document.getElementById('btn-sandbox').addEventListener('click', () => {
  const save = game.loadSave();
  if (save && save.chips) game.customChips = save.chips;
  game.startSandbox();
});
document.getElementById('btn-howto').addEventListener('click', UI.showHowTo);
document.getElementById('btn-codex').addEventListener('click', UI.showCodex);

// ── Main loop ───────────────────────────────────────────────────────────────

function frame() {
  if (!game.paused && game.world) {
    game.world.update(game.state === 'world' ? game.keys : null);
  }
  if (game.state === 'menu') {
    renderMenuBg();
  } else if (game.state === 'editor' && game.editor) {
    game.editor.render(ctx);
  } else if (game.world) {
    renderWorld(ctx, game);
  }
  requestAnimationFrame(frame);
}

let menuT = 0;
function renderMenuBg() {
  menuT++;
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, 960, 640);
  // drifting circuit traces
  ctx.strokeStyle = 'rgba(34,211,238,0.12)';
  for (let i = 0; i < 14; i++) {
    const y = ((i * 53 + menuT * 0.3) % 700) - 30;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 960; x += 80) {
      ctx.lineTo(x + 40, y + ((i + x / 80) % 2 ? 14 : -14));
      ctx.lineTo(x + 80, y);
    }
    ctx.stroke();
  }
}

UI.showMenu(game.hasSave());
frame();

export { game }; // for headless smoke tests
