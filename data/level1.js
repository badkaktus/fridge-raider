// Level 1 data, GDD 1.3 (sections 10.3, 5.1). Pure data, no DOM access.

export const LEVEL_1 = [
  '####################',
  '#.~~~~~~~H~~~~~~~~.#',
  '#....#...H....#....#',
  '#.7..#...H.C6.#.8HD#',
  '#===.=.==H===.=.=H=#',
  '#.....~~~H~~~~~~~H.#',
  '#........H..#....H.#',
  '#H3..H..BH4.#.5H.H.#',
  '#H===H=====.===H==H#',
  '#H...H~~~~~~~~~H..H#',
  '#H...H....H....H..H#',
  '#H@..H..1.H.A..H.2H#',
  '#==================#',
];

export const ITEM_TABLE = {
  '1': { id: 'yogurt',   score: 100 },
  '2': { id: 'cola',     score: 100 },
  '3': { id: 'sandwich', score: 150 },
  '4': { id: 'donut',    score: 150 },
  '5': { id: 'pizza',    score: 150 },
  '6': { id: 'cake',     score: 250 },
  '7': { id: 'sushi',    score: 250 },
  '8': { id: 'chicken',  score: 250 },
};

// walk / climb in px/s; patrolDir is the normative starting patrol direction.
export const ENEMY_TABLE = {
  'A': { type: 'cleaner', walk: 56, climb: 39, patrolRow: 11, patrolFrom: 10, patrolTo: 18, patrolDir:  1 },
  'B': { type: 'guard',   walk: 72, climb: 45, patrolRow:  7, patrolFrom:  5, patrolTo: 10, patrolDir:  1 },
  'C': { type: 'guard',   walk: 72, climb: 45, patrolRow:  3, patrolFrom:  7, patrolTo: 12, patrolDir:  1 },
  'D': { type: 'boss',    walk: 64, climb: 45, patrolRow:  3, patrolFrom: 16, patrolTo: 18, patrolDir: -1 },
};

export const AGGRO_RANGE = 7;    // GDD 5.4: must stay below half the map width
export const LOSE_RANGE  = 9;    // aggro + 2 tiles of hysteresis
export const INVULN_TIME = 1.5;  // granted at level start AND on respawn (GDD 1.3)

export const SPAWN_TILE   = { col: 2, row: 11 };  // player start (also the door)
export const EXIT_TILE    = { col: 2, row: 11 };  // win tile
export const RESPAWN_TILE = { col: 3, row: 11 };  // placement after being caught
export const TOTAL_ITEMS  = 8;
export const LIVES_START  = 3;
