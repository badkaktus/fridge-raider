// Level 3 data (finale, four floors), docs/LEVEL3.md section 4.1. Pure data, no DOM access.

export const LEVEL_3 = [
  '####################',
  '#.H~~~~~~~H~~~~~~H.#',
  '#.H....7..HE.8...H.#',
  '#=H=======H======H=#',
  '#.H..#....H..#...H.#',
  '#.H.H#.HC.H5.#H.6HD#',
  '#===H==H====.=H====#',
  '#...H..H~~~~~~H....#',
  '#.HBH4HH#...H.H.3H.#',
  '#=H===H==.==H====H=#',
  '#.H~~~H~~~~~H~~~~H.#',
  '#.H1.AH...2.H..@.H.#',
  '#==================#',
];

// Three-row floors: overhead row, walkable row, slab (LEVEL3.md 1.2).
export const FLOORS = [
  { floor: 4, top: 1,  walk: 2,  slab: 3 },
  { floor: 3, top: 4,  walk: 5,  slab: 6 },
  { floor: 2, top: 7,  walk: 8,  slab: 9 },
  { floor: 1, top: 10, walk: 11, slab: 12 },
];

export const ITEM_TABLE = {
  '1': { id: 'yogurt',   score: 100 },
  '2': { id: 'cola',     score: 100 },
  '3': { id: 'sandwich', score: 150 },
  '4': { id: 'donut',    score: 150 },
  '5': { id: 'pizza',    score: 250 },
  '6': { id: 'sushi',    score: 250 },
  '7': { id: 'cake',     score: 500 },
  '8': { id: 'chicken',  score: 500 },
};

// walk / climb in px/s; climb: 0 means the type never climbs (no vertical graph edges).
// aggro / lose override the level values for this enemy only.
export const ENEMY_TABLE = {
  'A': { type: 'cleaner', walk: 56, climb: 39, patrolRow: 11, patrolFrom:  3, patrolTo:  6, patrolDir:  1 },
  'B': { type: 'guard',   walk: 72, climb: 45, patrolRow:  8, patrolFrom:  3, patrolTo:  7, patrolDir:  1 },
  'C': { type: 'guard',   walk: 72, climb: 45, patrolRow:  5, patrolFrom:  6, patrolTo:  8, patrolDir:  1 },
  'D': { type: 'boss',    walk: 64, climb: 45, patrolRow:  5, patrolFrom: 15, patrolTo: 18, patrolDir: -1 },
  'E': { type: 'ceo',     walk: 52, climb:  0, patrolRow:  2, patrolFrom:  8, patrolTo: 12, patrolDir: -1,
         aggro: 17, lose: 17 },
};

// Floors each enemy type may ever occupy (LEVEL3.md 6). A type missing here may use every floor.
export const ENEMY_FLOORS = {
  cleaner: [1, 2, 3],
  guard:   [1, 2, 3],
  boss:    [1, 2, 3],
  ceo:     [4],
};

export const AGGRO_RANGE = 6;    // 3-row floors: 6 here covers what 7 covers on 4-row floors
export const LOSE_RANGE  = 8;    // aggro + 2 tiles of hysteresis
export const INVULN_TIME = 1.5;  // granted at level start AND on respawn

export const SPAWN_TILE   = { col: 15, row: 11 };  // player start (also the door), floor 1
export const EXIT_TILE    = { col: 15, row: 11 };  // win tile
export const RESPAWN_TILE = { col: 14, row: 11 };  // placement after being caught
export const TOTAL_ITEMS  = 8;

export const RETURN_BONUS   = 500;
export const TIME_BONUS_CAP = 2500;               // ceiling: 2000 + 500 + 2500 = 5000
export const EXIT_HINT      = 'GO BACK TO FLOOR 1';
