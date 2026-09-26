// Ordered campaign registry (docs/LEVEL1.md section 8.1). Pure data, no DOM access.
// Only game.js knows about the order; every other module sees one level at a time.

import * as L1 from './level1.js';
import * as L2 from './level2.js';
import * as L3 from './level3.js';

function defineLevel(number, map, mod) {
  return {
    number,
    map,
    floors: mod.FLOORS,
    itemTable: mod.ITEM_TABLE,
    enemyTable: mod.ENEMY_TABLE,
    enemyFloors: mod.ENEMY_FLOORS || null,   // null: every type may use every floor
    aggroRange: mod.AGGRO_RANGE,
    loseRange: mod.LOSE_RANGE,
    invulnTime: mod.INVULN_TIME,
    spawnTile: mod.SPAWN_TILE,
    exitTile: mod.EXIT_TILE,
    respawnTile: mod.RESPAWN_TILE,
    totalItems: mod.TOTAL_ITEMS,
    returnBonus: mod.RETURN_BONUS,
    timeBonusCap: mod.TIME_BONUS_CAP,
    exitHint: mod.EXIT_HINT,
  };
}

export const LEVELS = [
  defineLevel(1, L1.LEVEL_1, L1),
  defineLevel(2, L2.LEVEL_2, L2),
  defineLevel(3, L3.LEVEL_3, L3),
];

export const TOTAL_LEVELS = LEVELS.length;

// Lives are the one value that is global rather than per level (LEVEL1.md 3.2).
export const LIVES_START = 3;
