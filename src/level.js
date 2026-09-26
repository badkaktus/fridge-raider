// Map parsing, validation and tile queries (GDD 2, 3). No DOM access.

export const EMPTY  = 0;
export const FLOOR  = 1;
export const WALL   = 2;
export const LADDER = 3;
export const PIPE   = 4;

export const TILE    = 16;
export const COLS    = 20;
export const ROWS    = 13;
export const HUD_H   = 32;
export const FIELD_Y = 32;
export const VIEW_W  = COLS * TILE;          // 320
export const VIEW_H  = HUD_H + ROWS * TILE;  // 240

const TILE_CHARS = { '.': EMPTY, '=': FLOOR, '#': WALL, 'H': LADDER, '~': PIPE };

export function isPassableTile(t) { return t === EMPTY || t === LADDER || t === PIPE; }
export function isSolidTile(t)    { return t === FLOOR || t === WALL; }

// Checks a FLOORS table (LEVEL3.md 1.5): the ranges top..slab must cover rows
// 1..ROWS-1 exactly once, and each slab must sit right under its walk row.
export function validateFloors(floors) {
  const errors = [];
  if (!Array.isArray(floors) || floors.length === 0) return ['FLOORS table is missing'];
  const owner = new Array(ROWS).fill(0);
  const numbers = new Set();
  for (const f of floors) {
    const label = `floor ${f.floor}`;
    if (!(f.floor > 0) || numbers.has(f.floor)) errors.push(`${label}: bad or duplicate floor number`);
    numbers.add(f.floor);
    if (!(f.top >= 1 && f.top <= f.walk && f.slab === f.walk + 1 && f.slab <= ROWS - 1)) {
      errors.push(`${label}: rows top ${f.top} / walk ${f.walk} / slab ${f.slab} are inconsistent`);
      continue;
    }
    for (let r = f.top; r <= f.slab; r++) {
      if (owner[r]) errors.push(`row ${r} belongs to both floor ${owner[r]} and floor ${f.floor}`);
      owner[r] = f.floor;
    }
  }
  for (let r = 1; r < ROWS; r++) if (!owner[r]) errors.push(`row ${r} belongs to no floor`);
  return errors;
}

export class Level {
  constructor(grid, items, enemies, spawn, floors = []) {
    this.grid = grid;        // grid[row][col] -> tile code
    this.items = items;      // [{ col, row, char, id, score }]
    this.enemies = enemies;  // [{ col, row, char, type, walk, climb, patrolRow, patrolFrom, patrolTo }]
    this.spawn = spawn;      // { col, row } from '@'
    this.cols = COLS;
    this.rows = ROWS;
    this.floors = floors;    // [{ floor, top, walk, slab }], data of the level
    // Row -> floor number; 0 for the building ceiling (row 0) or no table.
    this.rowFloor = new Array(ROWS).fill(0);
    for (const f of floors) for (let r = f.top; r <= f.slab; r++) this.rowFloor[r] = f.floor;
  }

  // Floor a row belongs to; a slab belongs to the floor it is the floor of.
  floorOf(row) { return row >= 0 && row < ROWS ? this.rowFloor[row] : 0; }

  inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }

  // Outside the map behaves like solid wall, so nothing can leave the grid.
  tile(c, r) { return this.inBounds(c, r) ? this.grid[r][c] : WALL; }

  isSolid(c, r)    { return isSolidTile(this.tile(c, r)); }
  isPassable(c, r) { return isPassableTile(this.tile(c, r)); }
  isLadder(c, r)   { return this.tile(c, r) === LADDER; }
  isPipe(c, r)     { return this.tile(c, r) === PIPE; }

  // Support rule (GDD 3.1).
  hasSupport(c, r) {
    const here = this.tile(c, r);
    if (here === LADDER || here === PIPE) return true;
    const below = this.tile(c, r + 1);
    return isSolidTile(below) || below === LADDER;
  }

  // Landing rule for falling entities (GDD 3.2): ladders and pipes are ignored.
  isLanding(c, r) { return this.isSolid(c, r + 1); }
}

// Parses the ASCII map. Returns { level, errors }; level is null when invalid.
// Expected entity counts come from the level's own data, not from constants:
// `expected.items` defaults to the size of itemTable, `expected.enemies` to the
// size of enemyTable, so a level with 5 items and 2 enemies validates as strictly
// as one with 8 and 4. `expected.floors` is the level's FLOORS table; it is
// required, validated and attached to the Level.
export function parseLevel(rows, itemTable, enemyTable, expected = {}) {
  const wantItems = expected.items === undefined ? Object.keys(itemTable).length : expected.items;
  const wantEnemies = expected.enemies === undefined ? Object.keys(enemyTable).length : expected.enemies;
  const errors = [];
  if (!Array.isArray(rows) || rows.length !== ROWS) {
    errors.push(`map must have ${ROWS} rows, got ${Array.isArray(rows) ? rows.length : 'none'}`);
    return { level: null, errors };
  }

  const grid = [];
  const items = [];
  const enemies = [];
  let spawn = null;

  for (let r = 0; r < ROWS; r++) {
    const line = rows[r];
    if (typeof line !== 'string' || line.length !== COLS) {
      errors.push(`row ${r} must be ${COLS} characters, got ${line ? line.length : 'none'}`);
      grid.push(new Array(COLS).fill(WALL));
      continue;
    }
    const gridRow = new Array(COLS);
    for (let c = 0; c < COLS; c++) {
      const ch = line[c];
      if (ch in TILE_CHARS) {
        gridRow[c] = TILE_CHARS[ch];
      } else if (ch === '@') {
        gridRow[c] = EMPTY;
        if (spawn) errors.push(`duplicate '@' at (${c}, ${r})`);
        spawn = { col: c, row: r };
      } else if (ch in itemTable) {
        gridRow[c] = EMPTY;
        items.push({ col: c, row: r, char: ch, id: itemTable[ch].id, score: itemTable[ch].score });
      } else if (ch in enemyTable) {
        gridRow[c] = EMPTY;
        enemies.push({ col: c, row: r, char: ch, ...enemyTable[ch] });
      } else {
        errors.push(`unknown character '${ch}' at (${c}, ${r})`);
        gridRow[c] = WALL;
      }
    }
    grid.push(gridRow);
  }

  if (!spawn) errors.push("map has no '@' spawn tile");
  if (items.length !== wantItems) errors.push(`expected ${wantItems} items, got ${items.length}`);
  if (enemies.length !== wantEnemies) errors.push(`expected ${wantEnemies} enemies, got ${enemies.length}`);
  const seenItems = new Set(items.map((i) => i.char));
  if (seenItems.size !== items.length) errors.push('duplicate item symbol on the map');
  const seenEnemies = new Set(enemies.map((e) => e.char));
  if (seenEnemies.size !== enemies.length) errors.push('duplicate enemy symbol on the map');

  items.sort((a, b) => a.char.localeCompare(b.char));
  enemies.sort((a, b) => a.char.localeCompare(b.char));

  // FLOORS is mandatory: without it floorOf() would silently answer 0 and
  // per-floor enemy bans would have nothing to act on.
  const floors = expected.floors;
  errors.push(...validateFloors(floors));

  if (errors.length) return { level: null, errors };
  return { level: new Level(grid, items, enemies, spawn, floors), errors };
}
