# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
python3 -m http.server 8000        # serve the game; open http://localhost:8000
node tools/gen-sprites.mjs         # redraw all 25 PNG sprite strips into assets/sprites/
node --check src/game.js           # syntax check (no build step, no linter, no package.json)
```

There is no test runner in the repository. Logic modules are DOM-free by design, so
verification is done by importing them into Node and simulating:

```sh
node --input-type=module -e "
const {createGame}=await import('./src/game.js');
const g=createGame();
const k={left:0,right:0,up:0,down:0};
g.update(1/60,k);                 // one neutral frame arms the UP edge
k.up=1; g.update(1/60,k); k.up=0; // UP starts the level from TITLE
k.right=1; for(let i=0;i<600;i++) g.update(1/60,k);
console.log(g.state,g.collected,g.score);"   // -> READY 2 200
```

`Game.update(dt, input)` takes a plain key-state object (`{left,right,up,down}`), which is what
makes headless runs, recorded input lines and replays possible. Menu screens react to a
false→true edge of `up`, so a held key does nothing until it is released first. QA scripts
written this way belong outside the repo (scratchpad or `/tmp`), not in `src/`.

## Architecture

**Fixed-step loop, split render.** `src/main.js` is the only browser entry point: it owns the
canvas, integer scaling, `requestAnimationFrame` and an accumulator that calls
`game.update(1/60, input)` (max 5 steps per frame), then `renderer.draw(game)`. Simulation
never depends on monitor refresh rate.

**DOM boundary is load-bearing.** `src/main.js`, `src/render.js`, `src/sprites.js` and
`src/input.js` may touch the DOM. `src/game.js`, `src/level.js`, `src/player.js`,
`src/enemy.js`, `src/pathfinding.js` and `data/level1.js` must not — not even at import time.
Breaking this breaks every headless check.

**Determinism is a hard invariant.** No `Math.random()` anywhere in logic; enemy decisions come
from BFS with a fixed neighbour order (UP → DOWN → LEFT → RIGHT). Two identical input
sequences must produce bit-identical state, and recorded winning/survival lines are replayed
frame by frame as proof that the level is playable.

**Tile stepping, not pixel collision.** `Player` moves between tile centres with interpolation
(`col/row` → `tcol/trow`, progress `t` in 0..1); input is sampled at tile boundaries, with a
mid-step turnaround rule. Speeds are px/s constants in `player.js`.

**Enemies move on a static graph with no falling edges** (`pathfinding.js: buildGraph`). A node
is a passable tile *with support*; vertical edges exist only inside ladders. This is why enemies
never drop through the floor hatches or off pipe ends, and it is the structural guarantee that
the player always has escapes the enemies cannot take. Enemy state machine
(`PATROL`/`CHASE`/`SEARCH`) lives in `enemy.js`; aggro/lose ranges are injected from level data,
not hardcoded.

**The level is an ASCII map** in `data/level1.js` (`#` wall, `=` floor, `H` ladder, `~` pipe,
`.` empty, `@` spawn/door, `1`-`8` items, `A`-`D` enemies), parsed and validated by
`parseLevel` in `level.js`. The same 13 rows are duplicated in `docs/GDD.md` §10.2 (ASCII block)
and §10.3 (JS block) — after any map edit, verify all three copies match character for character.
Balance constants (`AGGRO_RANGE`, `LOSE_RANGE`, `INVULN_TIME`, enemy speeds and patrols) live in
`data/level1.js` as the single source of truth.

**Sprites are replaceable data.** `sprites.js` reads `assets/sprites/manifest.json`
(`frameW/frameH/frames/fps/loop/offsetX/offsetY`, frames laid out as a horizontal strip, all
characters drawn facing right and mirrored in code) and falls back to procedural placeholders
when a PNG is missing or fails to load — the level stays fully playable with no art at all.
Keep it that way: any new drawable needs both a manifest entry and a placeholder.

## Conventions

- `docs/GDD.md` is the normative spec, not documentation-after-the-fact: map, physics, AI,
  scoring, palette and the acceptance checklist (§13, blocking "playability" block И1–И8) are
  all defined there. Change the design in the GDD and the code together.
- `docs/TEST_REPORT.md` holds the QA history per version (1.0 → 1.3), including how defects
  were reproduced.
- Code, comments and on-screen text are English; the design and QA documents are Russian.
- Colours come from the fixed NES-style palette in GDD §11.1, exported as `PAL` from
  `sprites.js`.
- Plain static hosting (GitHub Pages): `index.html` at the repo root, every path relative,
  no dependencies, no build, `.nojekyll` present. Do not introduce bundlers or CDN imports.
