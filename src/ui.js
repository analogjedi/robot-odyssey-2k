// DOM overlay UI: modals, toasts, main menu, codex browser.
import { CODEX } from './codex.js';

let game = null;
let toastTimer = null;

export function init(g) { game = g; }

export function showModal(html, buttons = [{ label: 'OK' }]) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  game.paused = true;
  content.innerHTML = html + '<div class="btns">' +
    buttons.map((b, i) => `<button data-i="${i}">${b.label}</button>`).join('') + '</div>';
  modal.classList.remove('hidden');
  content.querySelectorAll('.btns > button').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = buttons[parseInt(btn.dataset.i, 10)];
      closeModal();
      if (b.action) b.action();
    });
  });
}

export function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  game.paused = false;
}

export function modalOpen() {
  return !document.getElementById('modal').classList.contains('hidden');
}

export function toast(msg, ms = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function showMenu(hasSave) {
  const menu = document.getElementById('menu');
  menu.classList.remove('hidden');
  document.getElementById('btn-continue').classList.toggle('hidden', !hasSave);
}

export function hideMenu() {
  document.getElementById('menu').classList.add('hidden');
}

export function showIntro(level) {
  showModal(
    `<h2>${level.name}</h2><p>${level.intro}</p>
     <p class="objective">▸ ${level.objective}</p>`,
    [{ label: level.sandbox ? 'Enter the lab' : 'Begin' }]
  );
}

export function showCodex() {
  const list = CODEX.map((e, i) =>
    `<button class="codex-link" data-i="${i}">${String(i + 1).padStart(2, '0')} · ${e.title}</button>`).join('');
  showModal(
    `<h2>ENGINEER'S CODEX</h2>
     <p class="dim">Field notes on the real technology inside this game.</p>
     <div class="codex-list">${list}</div>
     <div id="codex-body"></div>`,
    [{ label: 'Close' }]
  );
  const body = document.getElementById('codex-body');
  const show = i => {
    body.innerHTML = `<h3>${CODEX[i].title}</h3><p>${CODEX[i].body}</p>`;
    document.querySelectorAll('.codex-link').forEach((b, j) => b.classList.toggle('on', i === j));
  };
  document.querySelectorAll('.codex-link').forEach(b =>
    b.addEventListener('click', () => show(parseInt(b.dataset.i, 10))));
  show(0);
}

export function showHowTo() {
  showModal(
    `<h2>HOW TO PLAY</h2>
     <p><b>You are an engineer</b> trapped in the Helios Semiconductor megafab. Robots can go
     where you can't — but they only do what their circuits say. Wire them up, set them
     loose, and escape sector by sector.</p>
     <table class="keys">
       <tr><td>WASD / arrows</td><td>walk</td></tr>
       <tr><td>E</td><td>enter the robot you're standing on</td></tr>
       <tr><td>ESC</td><td>leave the robot / close dialogs</td></tr>
       <tr><td>H</td><td>cycle puzzle hints</td></tr>
       <tr><td>C</td><td>Engineer's Codex (real-world tech notes)</td></tr>
       <tr><td>shift+R</td><td>reset the sector (keeps your wiring)</td></tr>
       <tr><td>M</td><td>main menu</td></tr>
     </table>
     <p><b>Inside a robot:</b> click a palette part, click the board to place it. Drag from an
     output pin to an input pin to wire them. Right-click removes. Select a CLK / NPU / RF
     part to tune it. Hatched vents are robot-only; purple EMP fields are human-only.</p>
     <p><b>Chips:</b> put PIN▸ / ▸PIN pads around logic and hit BURN CHIP — your circuit
     becomes a reusable IC, usable in every robot, forever.</p>`,
    [{ label: 'Got it' }]
  );
}

export function showEditorHelp() {
  showModal(
    `<h2>CIRCUIT BENCH</h2>
     <p>The board runs <b>live</b> — the robot keeps moving while you solder.</p>
     <ul>
      <li><b>Place:</b> click a part in the palette, then an empty board cell.</li>
      <li><b>Wire:</b> drag from a pin to a pin (output → input). One output can fan out to many inputs; many wires into one input act as OR.</li>
      <li><b>Delete:</b> right-click a part or wire, or select + Delete key.</li>
      <li><b>Configure:</b> click a CLK, DLY, RF or NPU part — controls appear at right.</li>
      <li><b>Signals:</b> green pins and wires are HIGH. Gates have one tick of delay — loop a NOT onto itself and watch it oscillate.</li>
      <li><b>Burn:</b> PIN▸ / ▸PIN pads + logic + BURN CHIP = your own IC in the palette.</li>
     </ul>
     <p class="dim">Sensors: BMP bumpers, SCAN target tracker, RF radio, BAT power.
     Actuators: THR thrusters, GRAB claw.</p>`,
    [{ label: 'Back to the bench' }]
  );
}
