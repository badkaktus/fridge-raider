// Enemy AI: PATROL / CHASE / SEARCH driven by BFS over the static graph (GDD 5).
// Fully deterministic, no DOM access and no randomness.

import { TILE, FIELD_Y, COLS } from './level.js';
import { bfs, firstStepTo, nodeIndex, nodeCol, nodeRow } from './pathfinding.js';
import { MODE_IDLE, MODE_WALK, MODE_CLIMB, MODE_HANG } from './player.js';

export const PATROL = 'PATROL';
export const CHASE  = 'CHASE';
export const SEARCH = 'SEARCH';

// Aggro/lose ranges are level tuning (GDD 5.4) and are injected by Game.
// The fallbacks match the normative level-1 values from GDD 10.3.
export const DEFAULT_AGGRO_RANGE = 7;
export const DEFAULT_LOSE_RANGE  = 9;
export const LOSE_TIME   = 1.5;
export const SEARCH_TIME = 3.0;
export const STUCK_TIME  = 1.0;
export const CHASE_BLOCK = 0.5;

export class Enemy {
  constructor(def, tuning = {}) {
    this.def = def;
    this.type = def.type;
    this.walkSpeed = def.walk;
    this.climbSpeed = def.climb;
    this.patrolRow = def.patrolRow;
    this.patrolFrom = def.patrolFrom;
    this.patrolTo = def.patrolTo;
    this.startPatrolDir = def.patrolDir === undefined ? -1 : def.patrolDir;
    this.aggroRange = tuning.aggroRange === undefined ? DEFAULT_AGGRO_RANGE : tuning.aggroRange;
    this.loseRange = tuning.loseRange === undefined ? DEFAULT_LOSE_RANGE : tuning.loseRange;
    this.reset();
  }

  reset() {
    this.col = this.def.col;
    this.row = this.def.row;
    this.tcol = this.col;
    this.trow = this.row;
    this.t = 0;
    this.moving = false;
    this.mode = MODE_IDLE;
    this.speed = this.walkSpeed;
    this.facing = -1;
    this.anim = 0;
    this.state = PATROL;
    this.patrolDir = this.startPatrolDir;
    this.lastSeen = -1;
    this.loseTimer = 0;
    this.searchTimer = 0;
    this.stuckTimer = 0;
    this.chaseBlock = 0;
    this.visible = false;
  }

  get x() { return (this.col + (this.tcol - this.col) * this.t) * TILE; }
  get y() { return FIELD_Y + (this.row + (this.trow - this.row) * this.t) * TILE; }

  beginStep(dc, dr, level) {
    this.tcol = this.col + dc;
    this.trow = this.row + dr;
    this.t = 0;
    this.moving = true;
    if (dr !== 0) {
      this.speed = this.climbSpeed;
      this.mode = MODE_CLIMB;
    } else {
      this.speed = this.walkSpeed;
      this.mode = level.isPipe(this.col, this.row) ? MODE_HANG : MODE_WALK;
      this.facing = dc > 0 ? 1 : -1;
    }
  }

  update(dt, level, graph, playerCol, playerRow) {
    this.anim += dt;
    if (this.chaseBlock > 0) this.chaseBlock -= dt;
    if (this.state === CHASE) {
      this.stuckTimer += dt;
      if (!this.visible) this.loseTimer += dt;
    } else if (this.state === SEARCH) {
      this.searchTimer += dt;
    }

    let time = dt;
    let guard = 0;
    while (time > 0 && guard++ < 16) {
      if (!this.moving) {
        this.think(level, graph, playerCol, playerRow);
        if (!this.moving) return;
      }
      const duration = TILE / this.speed;
      const needed = (1 - this.t) * duration;
      if (time < needed) {
        this.t += time / duration;
        time = 0;
      } else {
        time -= needed;
        this.col = this.tcol;
        this.row = this.trow;
        this.t = 0;
        this.moving = false;
        this.stuckTimer = 0;
      }
    }
  }

  // One decision at a tile boundary (GDD 5.3).
  think(level, graph, playerCol, playerRow) {
    const here = nodeIndex(this.col, this.row);
    if (!graph.isNode[here]) { this.mode = MODE_IDLE; return; }

    const { dist, parent } = bfs(graph, here);
    const target = nodeIndex(playerCol, playerRow);
    const range = this.state === CHASE ? this.loseRange : this.aggroRange;

    const inGraph = playerCol >= 0 && playerCol < COLS && graph.isNode[target] === 1;
    this.visible = this.chaseBlock <= 0 && inGraph && dist[target] >= 0 && dist[target] <= range;

    let goal = -1;
    let forcePatrol = false;

    if (this.visible) {
      this.state = CHASE;
      this.lastSeen = target;
      this.loseTimer = 0;
      goal = target;
    } else if (this.state === CHASE) {
      if (this.loseTimer >= LOSE_TIME) {
        this.state = SEARCH;
        this.searchTimer = 0;
      }
      goal = this.lastSeen;
    } else if (this.state === SEARCH) {
      goal = this.lastSeen;
      const noPath = goal < 0 || dist[goal] < 0;
      if (here === goal || this.searchTimer >= SEARCH_TIME || noPath) {
        this.state = PATROL;
        goal = -1;
      }
    }

    // Anti-stall safety net (GDD 5.3 step 5).
    if (this.state === CHASE && this.stuckTimer >= STUCK_TIME) {
      this.state = PATROL;
      this.chaseBlock = CHASE_BLOCK;
      this.stuckTimer = 0;
      this.visible = false;
      goal = -1;
      forcePatrol = true;
    }

    let next = -1;
    if (!forcePatrol && goal >= 0) next = firstStepTo(dist, parent, here, goal);
    if (next < 0) next = this.patrolStep(graph, dist, parent, here);

    if (next < 0) { this.mode = MODE_IDLE; return; }
    this.beginStep(nodeCol(next) - this.col, nodeRow(next) - this.row, level);
  }

  // PATROL behaviour (GDD 5.3 step 4).
  patrolStep(graph, dist, parent, here) {
    const onPost = this.row === this.patrolRow &&
                   this.col >= this.patrolFrom && this.col <= this.patrolTo;

    if (!onPost) {
      let best = -1, bestDist = Infinity;
      for (let c = this.patrolFrom; c <= this.patrolTo; c++) {
        const n = nodeIndex(c, this.patrolRow);
        if (graph.isNode[n] !== 1) continue;
        const d = dist[n];
        if (d >= 0 && d < bestDist) { bestDist = d; best = n; }
      }
      if (best >= 0 && best !== here) {
        const step = firstStepTo(dist, parent, here, best);
        if (step >= 0) return step;
      }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const nc = this.col + this.patrolDir;
      if (nc >= this.patrolFrom && nc <= this.patrolTo && this.row === this.patrolRow) {
        const n = nodeIndex(nc, this.row);
        if (graph.isNode[n] === 1 && this.hasEdge(graph, here, n)) return n;
      }
      this.patrolDir *= -1;
    }
    return -1;
  }

  hasEdge(graph, from, to) {
    const base = from * 4;
    for (let d = 0; d < 4; d++) if (graph.neighbors[base + d] === to) return true;
    return false;
  }

  // Animation key (GDD 11.6): vertical movement or hanging uses the climb set.
  // A type that never climbs (climb: 0) has no climb set at all (LEVEL3.md 4.2).
  animKey() {
    const climbs = this.climbSpeed > 0;
    const set = climbs && (this.mode === MODE_CLIMB || this.mode === MODE_HANG) ? 'climb' : 'walk';
    return `enemy_${this.type}_${set}`;
  }
}
