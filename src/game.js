// Campaign state machine, scoring and rules (GDD 1, 6, 9; LEVEL1.md 8).
// No DOM access.

import { parseLevel } from './level.js';
import { buildGraph, restrictGraph, bfs, nodeIndex } from './pathfinding.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { LEVELS, LIVES_START } from '../data/levels.js';

export const STATE = {
  TITLE: 'TITLE',
  READY: 'READY',
  PLAYING: 'PLAYING',
  CAUGHT: 'CAUGHT',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  WIN: 'WIN',
  GAME_OVER: 'GAME_OVER',
};

export const READY_TIME  = 1.5;
export const CAUGHT_TIME = 1.2;

// Hitbox for catch checks (GDD 1.3).
const HIT_X = 3, HIT_Y = 2, HIT_W = 10, HIT_H = 14;

export const NEUTRAL_INPUT = { left: false, right: false, up: false, down: false, lastHoriz: 0 };

export class Game {
  // `levels` is an ordered array of { def, level, graph, typeGraphs }; only this
  // class knows about the order (LEVEL1.md 8.1).
  constructor(levels, config = {}) {
    this.levels = levels;
    this.totalLevels = levels.length;
    this.livesStart = config.livesStart === undefined ? LIVES_START : config.livesStart;
    // Level the campaign starts and restarts from; 0 unless a start level was requested.
    this.startIndex = config.startIndex === undefined ? 0 : config.startIndex;

    this.player = new Player(0, 0);
    this.enemies = [];
    this.clock = 0;          // free-running clock, used for blinking
    this.levelIndex = 0;
    this.levelSerial = 0;    // bumped on every level load, lets the renderer recache
    this.state = STATE.TITLE;
    this.armed = false;
    this.restartAll();
    this.enterState(STATE.TITLE);
  }

  // ---- current level, read by the renderer and the rules below -------------
  get def()          { return this.levels[this.levelIndex].def; }
  get level()        { return this.levels[this.levelIndex].level; }
  get graph()        { return this.levels[this.levelIndex].graph; }
  get exitTile()     { return this.def.exitTile; }
  get spawnTile()    { return this.def.spawnTile; }
  get respawnTile()  { return this.def.respawnTile; }
  get totalItems()   { return this.def.totalItems; }
  get invulnTime()   { return this.def.invulnTime; }
  get exitHint()     { return this.def.exitHint; }
  get levelNumber()  { return this.def.number; }
  get isLastLevel()  { return this.levelIndex >= this.totalLevels - 1; }
  get nextLevelNumber() { return this.isLastLevel ? this.levelNumber : this.levels[this.levelIndex + 1].def.number; }
  get hintActive()   { return this.collected >= this.totalItems; }

  // Full campaign reset: back to the start level, which is the first level
  // unless the page asked for another one (LEVEL1.md 8.2).
  restartAll() {
    this.score = 0;
    this.lives = this.livesStart;
    this.loadLevel(this.startIndex);
  }

  // Loads a level: fresh items, timer and shield; score and lives are untouched.
  loadLevel(index) {
    this.levelIndex = index;
    this.levelSerial++;
    const { def, level, typeGraphs } = this.levels[index];
    this.enemies = level.enemies.map((d) => {
      // Per-enemy aggro / lose override the level values (LEVEL3.md 4.2).
      const enemy = new Enemy(d, {
        aggroRange: d.aggro === undefined ? def.aggroRange : d.aggro,
        loseRange: d.lose === undefined ? def.loseRange : d.lose,
      });
      // Every AI decision of this enemy goes through its own type's graph.
      enemy.graph = typeGraphs.get(graphKey(d));
      return enemy;
    });
    this.items = level.items.map((it) => ({ ...it, collected: false }));
    this.collected = 0;
    this.time = 0;
    this.breakdown = null;
    this.placeEntities(def.spawnTile);
    // The shield is granted at level start as well as on respawn (GDD 1.3).
    this.invuln = def.invulnTime;
    this.enterState(STATE.READY);
  }

  // After being caught: keep score, items and the level timer (GDD 1.3).
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

  update(dt, input) {
    this.clock += dt;
    this.stateTime += dt;

    // UP is the only control key outside gameplay (GDD 9), and only on a
    // release-then-press edge (the `armed` flag).
    const confirm = !!input.up;
    if (!confirm) this.armed = true;
    const pressed = this.armed && confirm;

    switch (this.state) {
      case STATE.TITLE:
        if (pressed) this.restartAll();
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
      case STATE.LEVEL_CLEAR:
        if (pressed) this.loadLevel(this.levelIndex + 1);
        break;
      case STATE.WIN:
      case STATE.GAME_OVER:
        if (pressed) this.restartAll();
        break;
      default:
        break;
    }
  }

  updatePlaying(dt, input) {
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;

    const level = this.level;
    this.player.update(dt, input, level);

    const pc = this.player.centerCol;
    const pr = this.player.centerRow;
    for (const enemy of this.enemies) enemy.update(dt, level, enemy.graph, pc, pr);

    this.collectItems(pc, pr);

    if (this.invuln <= 0 && this.checkCatch()) { this.catchPlayer(); return; }

    const exit = this.exitTile;
    if (this.collected >= this.totalItems && pc === exit.col && pr === exit.row) {
      this.finishLevel();
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

  // Level cleared: bonuses land in the running campaign score (LEVEL1.md 8.2).
  finishLevel() {
    const def = this.def;
    const food = this.items.reduce((sum, it) => sum + (it.collected ? it.score : 0), 0);
    const timeBonus = Math.max(0, def.timeBonusCap - Math.floor(this.time) * 10);
    this.score += def.returnBonus + timeBonus;
    this.breakdown = {
      level: def.number,
      food,
      returnBonus: def.returnBonus,
      timeBonus,
      levelTotal: food + def.returnBonus + timeBonus,
      total: this.score,
    };
    this.enterState(this.isLastLevel ? STATE.WIN : STATE.LEVEL_CLEAR);
  }
}

// Graphs are shared by every enemy with the same type and climbing ability.
function graphKey(def) { return `${def.type}|${def.climb > 0 ? 'climbs' : 'walks'}`; }

// Builds one restricted graph per enemy type (LEVEL3.md 6.2) and checks the
// load-time rules of LEVEL3.md 6.3. Returns { typeGraphs, errors }.
function buildTypeGraphs(def, level, graph) {
  const errors = [];
  const typeGraphs = new Map();
  for (const d of level.enemies) {
    const key = graphKey(d);
    if (!typeGraphs.has(key)) {
      const floors = def.enemyFloors && def.enemyFloors[d.type] ? def.enemyFloors[d.type] : null;
      typeGraphs.set(key, restrictGraph(graph, level, { floors, climbs: d.climb > 0 }));
    }
    const g = typeGraphs.get(key);
    const post = nodeIndex(d.col, d.row);
    if (!g.isNode[post]) { errors.push(`enemy ${d.char}: post (${d.col}, ${d.row}) is not a node of the ${d.type} graph`); continue; }
    const { dist } = bfs(g, post);
    for (let c = d.patrolFrom; c <= d.patrolTo; c++) {
      if (dist[nodeIndex(c, d.patrolRow)] < 0) {
        errors.push(`enemy ${d.char}: patrol tile (${c}, ${d.patrolRow}) is not reachable in the ${d.type} graph`);
      }
    }
  }
  // Self-check: a type never owns a node on a floor it is not allowed on.
  if (def.enemyFloors) {
    for (const d of level.enemies) {
      const allowed = def.enemyFloors[d.type];
      if (!allowed) continue;
      const g = typeGraphs.get(graphKey(d));
      for (let i = 0; i < g.size; i++) {
        if (g.isNode[i] && !allowed.includes(level.floorOf((i / level.cols) | 0))) {
          errors.push(`${d.type} graph contains a node on a forbidden floor`);
          break;
        }
      }
    }
  }
  return { typeGraphs, errors };
}

// Parses and validates every level, then builds the campaign.
// Returns null and reports the first broken level instead of throwing.
// `options.startLevel` is a level number to start from; an unknown one is
// ignored and the campaign starts from the first level.
export function createGame(onError = (msg) => console.error(msg), levelDefs = LEVELS, options = {}) {
  const parsed = [];
  for (const def of levelDefs) {
    const { level, errors } = parseLevel(def.map, def.itemTable, def.enemyTable, {
      items: def.totalItems,
      enemies: Object.keys(def.enemyTable).length,
      floors: def.floors,
    });
    if (!level) {
      onError(`Level ${def.number} validation failed: ${errors.join('; ')}`);
      return null;
    }
    if (level.spawn.col !== def.spawnTile.col || level.spawn.row !== def.spawnTile.row) {
      onError(`Level ${def.number}: '@' at (${level.spawn.col}, ${level.spawn.row}) does not match SPAWN_TILE`);
      return null;
    }
    const graph = buildGraph(level);
    const typed = buildTypeGraphs(def, level, graph);
    if (typed.errors.length) {
      onError(`Level ${def.number} validation failed: ${typed.errors.join('; ')}`);
      return null;
    }
    parsed.push({ def, level, graph, typeGraphs: typed.typeGraphs });
  }
  if (!parsed.length) {
    onError('No levels defined');
    return null;
  }
  const startIndex = parsed.findIndex((p) => p.def.number === options.startLevel);
  return new Game(parsed, { startIndex: startIndex < 0 ? 0 : startIndex });
}
