// Level 1 data (tutorial), docs/LEVEL1.md section 3.1. Pure data, no DOM access.

export const LEVEL_1 = [
  '####################',
  '##.................#',
  '##.................#',
  '##.H....H....5H.BH.#',
  '#=.H====H===.=H==H=#',
  '#..H....H~~~~~H~~H.#',
  '#..H....H.....H..H.#',
  '#H@H.H..H.H3..HA4HH#',
  '#H===H=.==H===H===H#',
  '#H...H~~~~H...H...H#',
  '#H...H....H...H...H#',
  '#H.1.H..2.H...H...H#',
  '#==================#',
];

export const ITEM_TABLE = {
  '1': { id: 'yogurt',   score: 100 },
  '2': { id: 'cola',     score: 100 },
  '3': { id: 'sandwich', score: 150 },
  '4': { id: 'donut',    score: 150 },
  '5': { id: 'cake',     score: 250 },
};

// walk / climb in px/s; patrolDir is the normative starting patrol direction.
export const ENEMY_TABLE = {
  'A': { type: 'cleaner', walk: 56, climb: 39, patrolRow: 7, patrolFrom: 13, patrolTo: 17, patrolDir: -1 },
  'B': { type: 'guard',   walk: 64, climb: 42, patrolRow: 3, patrolFrom: 15, patrolTo: 18, patrolDir:  1 },
};

export const AGGRO_RANGE = 6;    // GDD 5.4: working range 6..8, lower bound here
export const LOSE_RANGE  = 8;    // aggro + 2 tiles of hysteresis
export const INVULN_TIME = 2.0;  // granted at level start AND on respawn

export const SPAWN_TILE   = { col: 2, row: 7 };   // player start (also the door), floor 2
export const EXIT_TILE    = { col: 2, row: 7 };   // win tile
export const RESPAWN_TILE = { col: 4, row: 7 };   // placement after being caught
export const TOTAL_ITEMS  = 5;

export const RETURN_BONUS   = 500;
export const TIME_BONUS_CAP = 1200;               // ceiling: 750 + 500 + 1200 = 2450
export const EXIT_HINT      = 'GO BACK TO FLOOR 2';
