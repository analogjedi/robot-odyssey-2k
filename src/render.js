// World renderer: neon-on-dark megafab aesthetic, all primitive shapes.
import { TILE, COLS, ROWS } from './world.js';

const WY = 44; // HUD bar height / world y-offset

export function renderWorld(ctx, game) {
  const world = game.world;
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, 960, 640);

  // Tiles
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(ctx, world, x, y, world.tiles[y][x]);
    }
  }

  // Items
  for (const it of world.items) drawItem(ctx, it, world.frame);

  // Robots
  for (const r of world.robots) drawRobot(ctx, r, world, r === world.player.inside);

  // Player
  if (!world.player.inside) drawPlayer(ctx, world.player, world.frame);

  // Enter prompt
  if (world.promptRobot) {
    const r = world.promptRobot;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`[E] enter ${r.name}`, r.cx(), r.y + WY - 18);
  }

  drawHud(ctx, game);
}

function px(x) { return x; }
function py(y) { return y + WY; }

function drawTile(ctx, world, x, y, ch) {
  const sx = x * TILE, sy = y * TILE + WY;

  // floor base
  ctx.fillStyle = '#0a101e';
  ctx.fillRect(sx, sy, TILE, TILE);
  ctx.strokeStyle = 'rgba(56,90,140,0.12)';
  ctx.strokeRect(sx + 0.5, sy + 0.5, TILE, TILE);

  if (ch === '#') {
    ctx.fillStyle = '#1c2840';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = '#2a3a5c';
    ctx.fillRect(sx, sy, TILE, 4);
    ctx.fillStyle = '#141d31';
    ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
  } else if (ch === 't') {
    ctx.fillStyle = '#060a12';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = 'rgba(34,211,238,0.35)';
    ctx.beginPath();
    for (let i = -1; i < 3; i++) {
      ctx.moveTo(sx + i * 12, sy + TILE);
      ctx.lineTo(sx + i * 12 + TILE, sy);
    }
    ctx.stroke();
  } else if (ch === '~') {
    ctx.fillStyle = '#160a26';
    ctx.fillRect(sx, sy, TILE, TILE);
    const ph = Math.sin(world.frame / 12 + x + y) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(168,85,247,${0.18 + 0.22 * ph})`;
    ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
  } else if ('abcd'.includes(ch)) {
    const lit = world.pressed && world.pressed.has(ch);
    ctx.strokeStyle = lit ? '#4ade80' : '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx + TILE / 2, sy + TILE / 2, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    if (lit) {
      ctx.fillStyle = 'rgba(74,222,128,0.25)';
      ctx.fill();
    }
    ctx.fillStyle = lit ? '#4ade80' : '#94a3b8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch, sx + TILE / 2, sy + TILE / 2 + 4);
  } else if ('ABCD'.includes(ch)) {
    const door = world.doors[ch];
    if (door && door.open) {
      ctx.strokeStyle = 'rgba(74,222,128,0.5)';
      ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = 'rgba(74,222,128,0.5)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ch, sx + TILE / 2, sy + 9);
    } else {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(sx + 2, sy, TILE - 4, TILE);
      ctx.fillStyle = '#ef4444';
      for (let i = 0; i < 3; i++) ctx.fillRect(sx + 4, sy + 5 + i * 10, TILE - 8, 3);
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ch, sx + TILE / 2, sy + TILE / 2 + 4);
    }
  } else if (ch === 'K') {
    if (world.keyDoorOpen) {
      ctx.strokeStyle = 'rgba(250,204,21,0.5)';
      ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
    } else {
      ctx.fillStyle = '#713f12';
      ctx.fillRect(sx + 2, sy, TILE - 4, TILE);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
      ctx.fillStyle = '#713f12';
      ctx.beginPath();
      ctx.arc(sx + TILE / 2, sy + TILE / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ch === 'X') {
    const t = world.frame / 20;
    const ready = world.exitReady;
    ctx.strokeStyle = ready ? '#4ade80' : '#64748b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const rr = 6 + ((t * 4 + i * 5) % 15);
      ctx.globalAlpha = 1 - rr / 16;
      ctx.beginPath();
      ctx.arc(sx + TILE / 2, sy + TILE / 2, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.fillStyle = ready ? '#4ade80' : '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LIFT', sx + TILE / 2, sy + TILE / 2 + 3);
  }
}

function drawItem(ctx, it, frame) {
  const x = px(it.x), y = py(it.y);
  const bob = it.heldBy ? 0 : Math.sin(frame / 15) * 2;
  if (it.type === 'crystal') {
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  } else if (it.type === 'keycard') {
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.fillRect(x - 8, y - 5 + bob, 16, 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#713f12';
    ctx.fillRect(x - 5, y - 2 + bob, 6, 4);
  }
  ctx.shadowBlur = 0;
}

function drawRobot(ctx, r, world, occupied) {
  const x = px(r.x), y = py(r.y);

  // thruster flames
  ctx.fillStyle = 'rgba(251,146,60,0.8)';
  const fl = 4 + Math.random() * 4;
  if (r.thrust.E) ctx.fillRect(x - fl, y + 8, fl, r.h - 16);
  if (r.thrust.W) ctx.fillRect(x + r.w, y + 8, fl, r.h - 16);
  if (r.thrust.S) ctx.fillRect(x + 8, y - fl, r.w - 16, fl);
  if (r.thrust.N) ctx.fillRect(x + 8, y + r.h, r.w - 16, fl);

  // body
  ctx.fillStyle = '#111a2e';
  ctx.strokeStyle = r.color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, r.w, r.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;

  // face / status
  ctx.fillStyle = r.color;
  ctx.fillRect(x + 6, y + 7, 5, 5);
  ctx.fillRect(x + r.w - 11, y + 7, 5, 5);
  ctx.fillStyle = r.powered ? r.color : '#475569';
  ctx.fillRect(x + 8, y + r.h - 9, r.w - 16, 3);

  // antenna, lit while broadcasting
  ctx.strokeStyle = r.tx ? '#4ade80' : '#475569';
  ctx.beginPath();
  ctx.moveTo(x + r.w / 2, y);
  ctx.lineTo(x + r.w / 2, y - 7);
  ctx.stroke();
  if (r.tx) {
    ctx.strokeStyle = 'rgba(74,222,128,0.6)';
    ctx.beginPath();
    ctx.arc(x + r.w / 2, y - 7, 5 + (world.frame % 12), -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
  }

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = occupied ? '#fde68a' : 'rgba(226,232,240,0.75)';
  ctx.fillText(occupied ? `${r.name} ◂you▸` : r.name, x + r.w / 2, y + r.h + 12);
}

function drawPlayer(ctx, p, frame) {
  const x = px(p.x), y = py(p.y);
  const cx = x + p.w / 2;
  // body
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x + 5, y + 9, p.w - 10, p.h - 11);
  // head
  ctx.beginPath();
  ctx.arc(cx, y + 6, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fde68a';
  ctx.fill();
  // visor
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(cx - 4, y + 3, 8, 4);
}

function drawHud(ctx, game) {
  const w = game.world;
  ctx.fillStyle = '#0b1322';
  ctx.fillRect(0, 0, 960, WY);
  ctx.strokeStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(0, WY - 0.5);
  ctx.lineTo(960, WY - 0.5);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText(w.level.name, 12, 18);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText(w.level.objective || '', 12, 33);

  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  ctx.fillStyle = '#67e8f9';
  const need = w.level.crystals || 0;
  ctx.fillText(`✦ ${w.player.crystals}${need ? '/' + need : ''}`, 700, 18);
  if (w.player.keycard) {
    ctx.fillStyle = '#facc15';
    ctx.fillText('⚿ keycard', 700, 33);
  }
  ctx.fillStyle = '#475569';
  ctx.font = '11px monospace';
  ctx.fillText('[E]nter robot  [H]int  [C]odex  [M]enu  [shift+R]eset', 948, 18);
  ctx.fillText('move: WASD / arrows', 948, 33);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
