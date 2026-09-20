// World, HUD and overlay drawing (GDD 8, 9, 11.5). Browser-only module.

import { TILE, FIELD_Y, COLS, ROWS, VIEW_W, VIEW_H, FLOOR, WALL, LADDER, PIPE } from './level.js';
import { PAL } from './sprites.js';
import { STATE } from './game.js';

const FIELD_H = ROWS * TILE;

// 5x7 pixel font, upper case only (GDD 8). '^' is the up arrow glyph.
const FONT = {
  A: ['-###-', '#---#', '#---#', '#####', '#---#', '#---#', '#---#'],
  B: ['####-', '#---#', '#---#', '####-', '#---#', '#---#', '####-'],
  C: ['-###-', '#---#', '#----', '#----', '#----', '#---#', '-###-'],
  D: ['####-', '#---#', '#---#', '#---#', '#---#', '#---#', '####-'],
  E: ['#####', '#----', '#----', '####-', '#----', '#----', '#####'],
  F: ['#####', '#----', '#----', '####-', '#----', '#----', '#----'],
  G: ['-###-', '#---#', '#----', '#-###', '#---#', '#---#', '-###-'],
  H: ['#---#', '#---#', '#---#', '#####', '#---#', '#---#', '#---#'],
  I: ['-###-', '--#--', '--#--', '--#--', '--#--', '--#--', '-###-'],
  J: ['--###', '---#-', '---#-', '---#-', '---#-', '#--#-', '-##--'],
  K: ['#---#', '#--#-', '#-#--', '##---', '#-#--', '#--#-', '#---#'],
  L: ['#----', '#----', '#----', '#----', '#----', '#----', '#####'],
  M: ['#---#', '##-##', '#-#-#', '#---#', '#---#', '#---#', '#---#'],
  N: ['#---#', '##--#', '#-#-#', '#--##', '#---#', '#---#', '#---#'],
  O: ['-###-', '#---#', '#---#', '#---#', '#---#', '#---#', '-###-'],
  P: ['####-', '#---#', '#---#', '####-', '#----', '#----', '#----'],
  Q: ['-###-', '#---#', '#---#', '#---#', '#-#-#', '#--#-', '-##-#'],
  R: ['####-', '#---#', '#---#', '####-', '#-#--', '#--#-', '#---#'],
  S: ['-####', '#----', '#----', '-###-', '----#', '----#', '####-'],
  T: ['#####', '--#--', '--#--', '--#--', '--#--', '--#--', '--#--'],
  U: ['#---#', '#---#', '#---#', '#---#', '#---#', '#---#', '-###-'],
  V: ['#---#', '#---#', '#---#', '#---#', '#---#', '-#-#-', '--#--'],
  W: ['#---#', '#---#', '#---#', '#---#', '#-#-#', '##-##', '#---#'],
  X: ['#---#', '#---#', '-#-#-', '--#--', '-#-#-', '#---#', '#---#'],
  Y: ['#---#', '#---#', '-#-#-', '--#--', '--#--', '--#--', '--#--'],
  Z: ['#####', '----#', '---#-', '--#--', '-#---', '#----', '#####'],
  0: ['-###-', '#---#', '#--##', '#-#-#', '##--#', '#---#', '-###-'],
  1: ['--#--', '-##--', '--#--', '--#--', '--#--', '--#--', '-###-'],
  2: ['-###-', '#---#', '----#', '---#-', '--#--', '-#---', '#####'],
  3: ['#####', '---#-', '--#--', '---#-', '----#', '#---#', '-###-'],
  4: ['---#-', '--##-', '-#-#-', '#--#-', '#####', '---#-', '---#-'],
  5: ['#####', '#----', '####-', '----#', '----#', '#---#', '-###-'],
  6: ['--##-', '-#---', '#----', '####-', '#---#', '#---#', '-###-'],
  7: ['#####', '----#', '---#-', '--#--', '-#---', '-#---', '-#---'],
  8: ['-###-', '#---#', '#---#', '-###-', '#---#', '#---#', '-###-'],
  9: ['-###-', '#---#', '#---#', '-####', '----#', '---#-', '-##--'],
  ' ': ['-----', '-----', '-----', '-----', '-----', '-----', '-----'],
  '/': ['----#', '----#', '---#-', '--#--', '-#---', '#----', '#----'],
  ':': ['-----', '--#--', '--#--', '-----', '--#--', '--#--', '-----'],
  '!': ['--#--', '--#--', '--#--', '--#--', '--#--', '-----', '--#--'],
  '-': ['-----', '-----', '-----', '-###-', '-----', '-----', '-----'],
  '.': ['-----', '-----', '-----', '-----', '-----', '-----', '--#--'],
  '^': ['--#--', '-###-', '##-##', '--#--', '--#--', '--#--', '-----'],
};

const HEART = [
  '-##--##-',
  '########',
  '########',
  '########',
  '-######-',
  '--####--',
  '---##---',
  '--------',
];

export function textWidth(str, scale = 1) {
  return Math.max(0, str.length * 6 - 1) * scale;
}

export function drawText(ctx, str, x, y, color, scale = 1, align = 'left') {
  const text = String(str).toUpperCase();
  let cx = Math.round(x);
  if (align === 'center') cx = Math.round(x - textWidth(text, scale) / 2);
  else if (align === 'right') cx = Math.round(x - textWidth(text, scale));
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === '#') ctx.fillRect(cx + c * scale, Math.round(y) + r * scale, scale, scale);
      }
    }
    cx += 6 * scale;
  }
}

function pad6(n) {
  const v = Math.max(0, Math.min(999999, Math.floor(n)));
  return String(v).padStart(6, '0');
}

function clockText(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Dim office furniture drawn behind the playfield (background layer only).
const DECOR = [
  { kind: 'window', col: 6,  row: 1 },
  { kind: 'window', col: 11, row: 1 },
  { kind: 'window', col: 2,  row: 5 },
  { kind: 'window', col: 14, row: 5 },
  { kind: 'window', col: 9,  row: 9 },
  { kind: 'window', col: 16, row: 9 },
  { kind: 'desk',   col: 7,  row: 3 },
  { kind: 'desk',   col: 3,  row: 7 },
  { kind: 'desk',   col: 16, row: 7 },
  { kind: 'desk',   col: 9,  row: 11 },
  { kind: 'desk',   col: 13, row: 11 },
  { kind: 'cooler', col: 6,  row: 7 },
  { kind: 'plant',  col: 13, row: 7 },
  { kind: 'plant',  col: 4,  row: 11 },
  { kind: 'fridge', col: 3,  row: 10 },
];

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawDecor(ctx, kind, x, y) {
  switch (kind) {
    case 'window':
      px(ctx, x, y, 32, 32, PAL.DARK);
      px(ctx, x + 2, y + 2, 28, 28, PAL.VOID);
      for (let i = 4; i < 28; i += 4) px(ctx, x + 2, y + i, 28, 1, PAL.DARK);
      px(ctx, x + 15, y + 2, 2, 28, PAL.DARK);
      break;
    case 'desk':
      px(ctx, x + 8, y + 1, 10, 6, PAL.DARK);
      px(ctx, x + 9, y + 2, 8, 4, PAL.BGWALL);
      px(ctx, x + 1, y + 7, 30, 3, PAL.DARK);
      px(ctx, x + 3, y + 10, 2, 6, PAL.DARK);
      px(ctx, x + 27, y + 10, 2, 6, PAL.DARK);
      break;
    case 'cooler':
      px(ctx, x + 5, y + 1, 6, 6, PAL.BGWALL);
      px(ctx, x + 6, y + 0, 4, 1, PAL.DARK);
      px(ctx, x + 4, y + 7, 8, 9, PAL.DARK);
      px(ctx, x + 6, y + 10, 4, 2, PAL.BGWALL);
      break;
    case 'plant':
      px(ctx, x + 6, y + 11, 4, 5, PAL.DARK);
      px(ctx, x + 7, y + 5, 2, 6, PAL.DARK);
      px(ctx, x + 4, y + 6, 3, 2, PAL.DARK);
      px(ctx, x + 9, y + 8, 3, 2, PAL.DARK);
      break;
    case 'fridge':
      px(ctx, x + 3, y + 1, 11, 31, PAL.DARK);
      px(ctx, x + 4, y + 2, 9, 29, PAL.BGWALL);
      px(ctx, x + 4, y + 12, 9, 1, PAL.DARK);
      px(ctx, x + 11, y + 5, 1, 5, PAL.DARK);
      px(ctx, x + 11, y + 16, 1, 5, PAL.DARK);
      break;
    default:
      break;
  }
}

export class Renderer {
  constructor(ctx, sprites) {
    this.ctx = ctx;
    this.sprites = sprites;
    this.bg = null;
    this.bgDirty = true;
  }

  invalidate() { this.bgDirty = true; }

  buildBackground(level) {
    if (!this.bg) {
      this.bg = document.createElement('canvas');
      this.bg.width = VIEW_W;
      this.bg.height = FIELD_H;
    }
    const g = this.bg.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, VIEW_W, FIELD_H);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) this.sprites.draw(g, 'tile_bg', c * TILE, r * TILE, 0);
    }
    // Push the back wall down so gameplay objects stay the brightest thing on screen.
    g.fillStyle = 'rgba(16, 16, 24, 0.45)';
    g.fillRect(0, 0, VIEW_W, FIELD_H);
    for (const d of DECOR) drawDecor(g, d.kind, d.col * TILE, d.row * TILE);
    // Baseboard under every walkable row.
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS; c++) {
        if (level.isPassable(c, r) && level.isSolid(c, r + 1)) px(g, c * TILE, r * TILE + 15, TILE, 1, PAL.DARK);
      }
    }
    this.bgDirty = false;
  }

  draw(game) {
    const ctx = this.ctx;
    const level = game.level;
    if (this.bgDirty) this.buildBackground(level);

    ctx.imageSmoothingEnabled = false;
    px(ctx, 0, 0, VIEW_W, VIEW_H, PAL.VOID);
    ctx.drawImage(this.bg, 0, FIELD_Y);

    this.drawTiles(level);
    this.drawDoor(game);
    this.drawItems(game);
    for (const enemy of game.enemies) this.drawEnemy(game, enemy);
    this.drawPlayer(game);
    this.drawHud(game);
    this.drawOverlay(game);
  }

  drawTiles(level) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = level.tile(c, r);
        let key = null;
        if (t === FLOOR) key = 'tile_floor';
        else if (t === WALL) key = 'tile_wall';
        else if (t === LADDER) key = 'tile_ladder';
        else if (t === PIPE) key = 'tile_pipe';
        if (key) this.sprites.draw(this.ctx, key, c * TILE, FIELD_Y + r * TILE, 0);
      }
    }
  }

  // Animation clock for world objects. Frozen on TITLE: GDD 9 asks for a static
  // level frame behind the logo.
  worldClock(game) { return game.state === STATE.TITLE ? 0 : game.clock; }

  drawDoor(game) {
    const door = game.exitTile;
    let frame = 0;
    if (game.hintActive) frame = Math.floor(this.worldClock(game) * 4) % 2;
    this.sprites.draw(this.ctx, 'door', door.col * TILE, FIELD_Y + door.row * TILE, frame);
  }

  drawItems(game) {
    const clock = this.worldClock(game);
    const bob = Math.round(Math.sin(clock * Math.PI * 2));
    for (const item of game.items) {
      if (item.collected) continue;
      const key = `item_${item.id}`;
      const frame = this.sprites.frameAt(key, clock);
      this.sprites.draw(this.ctx, key, item.col * TILE, FIELD_Y + item.row * TILE + bob, frame);
    }
  }

  drawPlayer(game) {
    const p = game.player;
    if (game.state === STATE.PLAYING && game.invuln > 0 && Math.floor(game.clock * 16) % 2 === 1) return;
    const key = p.animKey(game.level);
    const frame = this.sprites.frameAt(key, p.anim);
    this.sprites.draw(this.ctx, key, p.x, p.y, frame, p.facing < 0);
    if (game.state === STATE.CAUGHT && Math.floor(game.stateTime * 16) % 2 === 0) {
      px(this.ctx, Math.round(p.x) + 2, Math.round(p.y) + 1, 12, 15, PAL.TEXT);
    }
  }

  drawEnemy(game, enemy) {
    const key = enemy.animKey();
    const frame = enemy.moving ? this.sprites.frameAt(key, enemy.anim) : 0;
    this.sprites.draw(this.ctx, key, enemy.x, enemy.y, frame, enemy.facing < 0);
  }

  drawHud(game) {
    const ctx = this.ctx;
    px(ctx, 0, 0, VIEW_W, 32, PAL.HUD_BG);
    px(ctx, 0, 31, VIEW_W, 1, '#4A4A6A');

    drawText(ctx, `SCORE ${pad6(game.score)}`, 4, 4, PAL.TEXT);
    drawText(ctx, `FOOD ${game.collected}/${game.totalItems}`, 120, 4, PAL.TEXT);

    const livesLabel = 'LIVES';
    const heartsW = game.livesStart * 9 - 1;
    const right = 316;
    drawText(ctx, livesLabel, right - heartsW - 4 - textWidth(livesLabel), 4, PAL.TEXT);
    for (let i = 0; i < game.livesStart; i++) {
      this.drawHeart(right - heartsW + i * 9, 4, i < game.lives);
    }

    drawText(ctx, `TIME ${clockText(game.time)}`, 4, 18, PAL.TEXT);
    if (game.hintActive) {
      if (Math.floor(game.clock * 4) % 2 === 0) {
        drawText(ctx, 'GO BACK TO FLOOR 1', 160, 18, PAL.ACCENT, 1, 'center');
      }
    } else {
      drawText(ctx, 'COLLECT THE FOOD', 160, 18, PAL.TEXT_DIM, 1, 'center');
    }
  }

  drawHeart(x, y, filled) {
    const ctx = this.ctx;
    ctx.fillStyle = filled ? PAL.ALERT : '#4A4A6A';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (HEART[r][c] !== '#') continue;
        if (!filled) {
          const up = r > 0 && HEART[r - 1][c] === '#';
          const down = r < 7 && HEART[r + 1][c] === '#';
          const left = c > 0 && HEART[r][c - 1] === '#';
          const rightN = c < 7 && HEART[r][c + 1] === '#';
          if (up && down && left && rightN) continue;
        }
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  dim(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(16, 16, 24, ${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Translucent backing that keeps overlay text readable over the level frame.
  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15, 16, 32, 0.88)';
    ctx.fillRect(x, y, w, h);
    px(ctx, x, y, w, 1, PAL.WALL);
    px(ctx, x, y + h - 1, w, 1, PAL.WALL);
    px(ctx, x, y, 1, h, PAL.WALL);
    px(ctx, x + w - 1, y, 1, h, PAL.WALL);
  }

  plaque(x, y, w, h) {
    px(this.ctx, x, y, w, h, PAL.HUD_BG);
    px(this.ctx, x, y, w, 1, PAL.WALL);
    px(this.ctx, x, y + h - 1, w, 1, PAL.WALL);
    px(this.ctx, x, y, 1, h, PAL.WALL);
    px(this.ctx, x + w - 1, y, 1, h, PAL.WALL);
  }

  drawOverlay(game) {
    const ctx = this.ctx;
    const cx = VIEW_W / 2;
    const blink1 = Math.floor(game.clock * 2) % 2 === 0;

    switch (game.state) {
      case STATE.TITLE:
        this.dim(0.6);
        this.panel(56, 42, 208, 66);
        drawText(ctx, 'FRIDGE', cx, 50, PAL.ACCENT, 3, 'center');
        drawText(ctx, 'RAIDER', cx, 78, PAL.TEXT, 3, 'center');
        this.panel(24, 116, 272, 86);
        if (blink1) drawText(ctx, 'PRESS ^ TO START', cx, 126, PAL.TEXT, 1, 'center');
        drawText(ctx, 'ARROWS: MOVE / UP-DOWN: LADDERS', cx, 150, PAL.TEXT_DIM, 1, 'center');
        drawText(ctx, 'COLLECT ALL FOOD', cx, 172, PAL.TEXT_DIM, 1, 'center');
        drawText(ctx, 'AND RETURN TO YOUR FLOOR', cx, 186, PAL.TEXT_DIM, 1, 'center');
        break;
      case STATE.READY:
        this.plaque(cx - 44, 108, 88, 22);
        drawText(ctx, 'GET READY', cx, 115, PAL.TEXT, 1, 'center');
        break;
      case STATE.CAUGHT:
        drawText(ctx, 'CAUGHT!', cx, 112, PAL.ALERT, 2, 'center');
        break;
      case STATE.WIN: {
        this.dim(0.5);
        const b = game.breakdown || { food: 0, returnBonus: 0, timeBonus: 0, total: game.score };
        drawText(ctx, 'MISSION COMPLETE', cx, 56, PAL.ACCENT, 2, 'center');
        const lines = [
          [`FOOD ${pad6(b.food)}`, PAL.TEXT],
          [`RETURN BONUS ${pad6(b.returnBonus)}`, PAL.TEXT],
          [`TIME BONUS ${pad6(b.timeBonus)}`, PAL.TEXT],
          ['----------------------', PAL.TEXT_DIM],
          [`TOTAL ${pad6(b.total)}`, PAL.ACCENT],
        ];
        for (let i = 0; i < lines.length; i++) {
          if (game.stateTime < i * 0.3) break;
          drawText(ctx, lines[i][0], cx, 92 + i * 14, lines[i][1], 1, 'center');
        }
        if (game.stateTime > 1.5 && blink1) {
          drawText(ctx, 'PRESS ^ TO PLAY AGAIN', cx, 186, PAL.TEXT, 1, 'center');
        }
        break;
      }
      case STATE.GAME_OVER:
        this.dim(0.7);
        drawText(ctx, 'GAME OVER', cx, 92, PAL.ALERT, 2, 'center');
        drawText(ctx, `SCORE ${pad6(game.score)}`, cx, 124, PAL.TEXT, 1, 'center');
        if (blink1) drawText(ctx, 'PRESS ^ TO RESTART', cx, 160, PAL.TEXT, 1, 'center');
        break;
      default:
        break;
    }
  }
}
