// Game state machine, scoring and rules (GDD 1, 6, 9). No DOM access.

import { parseLevel } from './level.js';
import { buildGraph } from './pathfinding.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import {
  LEVEL_1, ITEM_TABLE, ENEMY_TABLE,
  SPAWN_TILE, EXIT_TILE, RESPAWN_TILE, TOTAL_ITEMS, LIVES_START,
  AGGRO_RANGE, LOSE_RANGE, INVULN_TIME as LEVEL_INVULN_TIME,
} from '../data/level1.js';

export const STATE = {
  TITLE: 'TITLE',
  READY: 'READY',
  PLAYING: 'PLAYING',
  CAUGHT: 'CAUGHT',
  WIN: 'WIN',
  GAME_OVER: 'GAME_OVER',
};

export const READY_TIME   = 1.5;
export const CAUGHT_TIME  = 1.2;
export const RETURN_BONUS = 500;
export const TIME_BONUS_MAX = 2000;   // GDD 6.1: score ceiling is 1400 + 500 + 2000 = 3900

// Hitbox for catch checks (GDD 1.3).
const HIT_X = 3, HIT_Y = 2, HIT_W = 10, HIT_H = 14;

export const NEUTRAL_INPUT = { left: false, right: false, up: false, down: false, lastHoriz: 0 };

export class Game {
  constructor(level, config = {}) {
    this.level = level;
    this.graph = buildGraph(level);
    this.spawnTile = config.spawnTile ?? SPAWN_TILE;
    this.exitTile = config.exitTile ?? EXIT_TILE;
    this.respawnTile = config.respawnTile ?? RESPAWN_TILE;
    this.totalItems = config.totalItems ?? TOTAL_ITEMS;
    this.livesStart = config.livesStart ?? LIVES_START;
    this.invulnTime = config.invulnTime === undefined ? LEVEL_INVULN_TIME : config.invulnTime;
    const tuning = {
      aggroRange: config.aggroRange === undefined ? AGGRO_RANGE : config.aggroRange,
      loseRange: config.loseRange === undefined ? LOSE_RANGE : config.loseRange,
    };

    this.player = new Player(this.spawnTile.col, this.spawnTile.row);
    this.enemies = level.enemies.map((def) => new Enemy(def, tuning));
    this.clock = 0;          // free-running clock, used for blinking
    this.state = STATE.TITLE;
    this.armed = false;
    this.restartAll();
    this.enterState(STATE.TITLE);
  }

  // Full reset (GDD 1.3 "restart"): score, lives, items, timer, positions.
  restartAll() {
    this.score = 0;
    this.lives = this.livesStart;
    this.time = 0;
    this.items = this.level.items.map((it) => ({ ...it, collected: false }));
    this.collected = 0;
    this.breakdown = null;
    this.placeEntities(this.spawnTile);
    // The shield is granted at level start as well as on respawn (GDD 1.3).
    this.invuln = this.invulnTime;
    this.enterState(STATE.READY);
  }

  // After being caught: keep score, items and timer (GDD 1.3).
  respawn() {
    this.placeEntities(this.respawnTile);
    this.invuln = this.invulnTime;
    this.enterState(STATE.READY);
  }

  placeEntities(tile) {
    this.player.reset(tile.col, tile.row);
    for (const enemy of this.enemies) enemy.reset();
  }

  enterState(state) {
    this.state = state;
    this.stateTime = 0;
    this.armed = false;
  }

  get hintActive() { return this.collected >= this.totalItems; }

  update(dt, input) {
    this.clock += dt;
    this.stateTime += dt;

    // UP is the only control key outside gameplay (GDD 9).
    const confirm = !!input.up;
    if (!confirm) this.armed = true;

    switch (this.state) {
      case STATE.TITLE:
        if (this.armed && confirm) this.restartAll();
        break;
      case STATE.READY:
        if (this.stateTime >= READY_TIME) this.enterState(STATE.PLAYING);
        break;
      case STATE.PLAYING:
        this.updatePlaying(dt, input);
        break;
      case STATE.CAUGHT:
        if (this.stateTime >= CAUGHT_TIME) {
          if (this.lives > 0) this.respawn();
          else this.enterState(STATE.GAME_OVER);
        }
        break;
      case STATE.WIN:
      case STATE.GAME_OVER:
        if (this.armed && confirm) this.restartAll();
        break;
      default:
        break;
    }
  }

  updatePlaying(dt, input) {
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;

    this.player.update(dt, input, this.level);

    const pc = this.player.centerCol;
    const pr = this.player.centerRow;
    for (const enemy of this.enemies) enemy.update(dt, this.level, this.graph, pc, pr);

    this.collectItems(pc, pr);

    if (this.invuln <= 0 && this.checkCatch()) { this.catchPlayer(); return; }

    if (this.collected >= this.totalItems && pc === this.exitTile.col && pr === this.exitTile.row) {
      this.win();
    }
  }

  collectItems(col, row) {
    for (const item of this.items) {
      if (item.collected || item.col !== col || item.row !== row) continue;
      item.collected = true;
      this.collected++;
      this.score += item.score;
    }
  }

  checkCatch() {
    const px = this.player.x + HIT_X;
    const py = this.player.y + HIT_Y;
    for (const enemy of this.enemies) {
      const ex = enemy.x + HIT_X;
      const ey = enemy.y + HIT_Y;
      if (px < ex + HIT_W && ex < px + HIT_W && py < ey + HIT_H && ey < py + HIT_H) return true;
    }
    return false;
  }

  catchPlayer() {
    this.lives--;
    this.enterState(STATE.CAUGHT);
  }

  win() {
    const food = this.items.reduce((sum, it) => sum + (it.collected ? it.score : 0), 0);
    const timeBonus = Math.max(0, TIME_BONUS_MAX - Math.floor(this.time) * 10);
    this.score += RETURN_BONUS + timeBonus;
    this.breakdown = { food, returnBonus: RETURN_BONUS, timeBonus, total: this.score };
    this.enterState(STATE.WIN);
  }
}

// Builds the level-1 game. Returns null and reports errors when the map is invalid.
export function createGame(onError = (msg) => console.error(msg)) {
  const { level, errors } = parseLevel(LEVEL_1, ITEM_TABLE, ENEMY_TABLE);
  if (!level) {
    onError('Level validation failed: ' + errors.join('; '));
    return null;
  }
  return new Game(level);
}
