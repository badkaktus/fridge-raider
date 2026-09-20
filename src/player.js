// Player physics: tile stepping with interpolation (GDD 4). No DOM access.

import { TILE, FIELD_Y } from './level.js';

export const MODE_IDLE  = 'idle';
export const MODE_WALK  = 'walk';
export const MODE_CLIMB = 'climb';
export const MODE_HANG  = 'hang';
export const MODE_FALL  = 'fall';

export const WALK_SPEED  = 120;
export const CLIMB_SPEED = 80;
export const PIPE_SPEED  = 100;
export const FALL_SPEED  = 200;

export class Player {
  constructor(col, row) {
    this.reset(col, row);
  }

  reset(col, row) {
    this.col = col;   // tile the step starts from
    this.row = row;
    this.tcol = col;  // tile the step goes to
    this.trow = row;
    this.t = 0;       // step progress 0..1
    this.moving = false;
    this.mode = MODE_IDLE;
    this.speed = WALK_SPEED;
    this.facing = 1;
    this.anim = 0;
  }

  // Interpolated pixel position of the sprite's top-left corner.
  get x() { return (this.col + (this.tcol - this.col) * this.t) * TILE; }
  get y() { return FIELD_Y + (this.row + (this.trow - this.row) * this.t) * TILE; }

  // Tile holding the player's centre (used for items, exit and enemy targeting).
  get centerCol() { return Math.floor((this.x + TILE / 2) / TILE); }
  get centerRow() { return Math.floor((this.y - FIELD_Y + TILE / 2) / TILE); }

  beginStep(dc, dr, speed, mode) {
    this.tcol = this.col + dc;
    this.trow = this.row + dr;
    this.t = 0;
    this.moving = true;
    this.speed = speed;
    this.mode = mode;
    if (dc !== 0) this.facing = dc > 0 ? 1 : -1;
  }

  update(dt, input, level) {
    this.anim += dt;
    let time = dt;
    let guard = 0;
    while (time > 0 && guard++ < 16) {
      if (!this.moving) {
        this.chooseStep(input, level);
        if (!this.moving) return;
      }
      this.tryReverse(input);
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
      }
    }
  }

  // Mid-step turnaround (GDD 4.1): holding the exact opposite direction flips the step.
  tryReverse(input) {
    if (!this.moving || this.mode === MODE_FALL) return;
    const dc = this.tcol - this.col;
    const dr = this.trow - this.row;
    const wantsBack =
      (dc === 1 && input.left && !input.right) ||
      (dc === -1 && input.right && !input.left) ||
      (dr === 1 && input.up && !input.down) ||
      (dr === -1 && input.down && !input.up);
    if (!wantsBack) return;
    const fromCol = this.col, fromRow = this.row;
    this.col = this.tcol;
    this.row = this.trow;
    this.tcol = fromCol;
    this.trow = fromRow;
    this.t = 1 - this.t;
    if (dc !== 0) this.facing = -this.facing;
  }

  // Action choice at a tile boundary (GDD 4.3, 4.4).
  chooseStep(input, level) {
    const c = this.col, r = this.row;

    // A fall keeps going until the tile below is solid (GDD 3.2).
    if (this.mode === MODE_FALL) {
      if (!level.isLanding(c, r)) { this.beginStep(0, 1, FALL_SPEED, MODE_FALL); return; }
      this.mode = MODE_IDLE;
    }
    if (!level.hasSupport(c, r)) { this.beginStep(0, 1, FALL_SPEED, MODE_FALL); return; }

    if (input.up && level.isLadder(c, r) && level.isPassable(c, r - 1)) {
      this.beginStep(0, -1, CLIMB_SPEED, MODE_CLIMB);
      return;
    }
    if (input.down) {
      if (level.isLadder(c, r) && level.isPassable(c, r + 1)) {
        this.beginStep(0, 1, CLIMB_SPEED, MODE_CLIMB);
        return;
      }
      if (level.isLadder(c, r + 1)) {
        this.beginStep(0, 1, CLIMB_SPEED, MODE_CLIMB);
        return;
      }
      if (level.isPipe(c, r) && level.isPassable(c, r + 1)) {
        this.beginStep(0, 1, FALL_SPEED, MODE_FALL);
        return;
      }
    }

    let dir = 0;
    if (input.left && input.right) dir = input.lastHoriz || 0;
    else if (input.left) dir = -1;
    else if (input.right) dir = 1;

    if (dir !== 0 && level.isPassable(c + dir, r)) {
      const onPipe = level.isPipe(c, r);
      this.beginStep(dir, 0, onPipe ? PIPE_SPEED : WALK_SPEED, onPipe ? MODE_HANG : MODE_WALK);
      return;
    }

    this.mode = MODE_IDLE;
  }

  // Animation key (GDD 11.6).
  animKey(level) {
    if (this.mode === MODE_FALL) return 'player_fall';
    if (level.isPipe(this.centerCol, this.centerRow)) return 'player_hang';
    if (this.mode === MODE_CLIMB) return 'player_climb';
    if (this.mode === MODE_WALK) return 'player_run';
    return 'player_idle';
  }
}
