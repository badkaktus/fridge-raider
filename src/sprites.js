// Sprite registry: manifest + PNG loading with procedural fallbacks (GDD 11).
// Browser-only module: uses fetch and Image.

export const PAL = {
  VOID:     '#101018',
  HUD_BG:   '#0F1020',
  BGWALL:   '#2C2C44',
  WALL:     '#5A5A7A',
  WALL_HI:  '#8A8AB0',
  FLOOR:    '#7A5B3A',
  FLOOR_HI: '#B08A55',
  FLOOR_SH: '#4A3522',
  LADDER:   '#C8B040',
  LADDER_SH:'#8A7420',
  PIPE:     '#9AA6B8',
  PIPE_HI:  '#D8E0EC',
  SKIN:     '#F0C090',
  HERO:     '#3878F8',
  GUARD:    '#1848A0',
  CLEAN:    '#308030',
  BOSS:     '#A02020',
  DARK:     '#303050',
  TEXT:     '#F8F8F8',
  TEXT_DIM: '#A0A0B8',
  ACCENT:   '#F8D800',
  ALERT:    '#F83800',
};

// Fallback animation table, used when the manifest is missing entirely.
export const DEFAULT_SPRITES = {
  player_idle:  { frames: 2, fps: 3 },
  player_run:   { frames: 4, fps: 12 },
  player_climb: { frames: 2, fps: 8 },
  player_hang:  { frames: 2, fps: 8 },
  player_fall:  { frames: 1, fps: 1 },
  enemy_cleaner_walk:  { frames: 4, fps: 8 },
  enemy_cleaner_climb: { frames: 2, fps: 6 },
  enemy_guard_walk:    { frames: 4, fps: 10 },
  enemy_guard_climb:   { frames: 2, fps: 8 },
  enemy_boss_walk:     { frames: 4, fps: 9 },
  enemy_boss_climb:    { frames: 2, fps: 7 },
  item_yogurt:   { frames: 2, fps: 4 },
  item_cola:     { frames: 2, fps: 4 },
  item_sandwich: { frames: 2, fps: 4 },
  item_donut:    { frames: 2, fps: 4 },
  item_pizza:    { frames: 2, fps: 4 },
  item_cake:     { frames: 2, fps: 4 },
  item_sushi:    { frames: 2, fps: 4 },
  item_chicken:  { frames: 2, fps: 4 },
  tile_wall:   { frames: 1, fps: 1 },
  tile_floor:  { frames: 1, fps: 1 },
  tile_ladder: { frames: 1, fps: 1 },
  tile_pipe:   { frames: 1, fps: 1 },
  tile_bg:     { frames: 1, fps: 1 },
  door:        { frames: 2, fps: 2 },
};

export class SpriteRegistry {
  constructor() {
    this.tileSize = 16;
    this.meta = {};
    this.images = {};
    for (const [key, def] of Object.entries(DEFAULT_SPRITES)) {
      this.meta[key] = { frameW: 16, frameH: 16, offsetX: 0, offsetY: 0, loop: true, ...def };
    }
  }

  frames(key) { return (this.meta[key] && this.meta[key].frames) || 1; }
  fps(key)    { return (this.meta[key] && this.meta[key].fps) || 1; }

  // Frame index for an animation clock, honouring the manifest fps.
  frameAt(key, time) {
    const n = this.frames(key);
    if (n <= 1) return 0;
    const idx = Math.floor(time * this.fps(key));
    const meta = this.meta[key];
    if (meta && meta.loop === false) return Math.min(idx, n - 1);
    return ((idx % n) + n) % n;
  }

  // Loads manifest.json, then every PNG it declares. An entry written exactly to
  // GDD 11.3 loads its file; "present": false is an explicit opt-out for sprites
  // that are known to be missing. A missing or broken file falls back to the
  // procedural placeholder via onerror. Never throws, never blocks the loop.
  async load(base = 'assets/sprites/') {
    let manifest = null;
    try {
      const res = await fetch(base + 'manifest.json', { cache: 'no-cache' });
      if (res.ok) manifest = await res.json();
    } catch (err) {
      manifest = null;
    }
    if (!manifest || typeof manifest !== 'object') return;
    if (manifest.tileSize) this.tileSize = manifest.tileSize;
    const sprites = manifest.sprites || {};
    const jobs = [];
    for (const [key, def] of Object.entries(sprites)) {
      this.meta[key] = { frameW: 16, frameH: 16, offsetX: 0, offsetY: 0, loop: true, ...this.meta[key], ...def };
      if (def.file && def.present !== false) jobs.push(this.loadImage(key, base + def.file));
    }
    await Promise.all(jobs);
  }

  loadImage(key, url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0) this.images[key] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  // Draws one frame; falls back to the procedural placeholder when no PNG is loaded.
  draw(ctx, key, x, y, frame = 0, flip = false) {
    const img = this.images[key];
    const meta = this.meta[key] || { frameW: 16, frameH: 16, offsetX: 0, offsetY: 0, frames: 1 };
    const ox = meta.offsetX || 0;
    const oy = meta.offsetY || 0;
    const dx = Math.round(x) + ox;
    const dy = Math.round(y) + oy;

    ctx.save();
    if (flip) {
      ctx.translate(dx + meta.frameW, dy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(dx, dy);
    }
    if (img) {
      const n = meta.frames || 1;
      const f = Math.max(0, Math.min(n - 1, frame | 0));
      ctx.drawImage(img, f * meta.frameW, 0, meta.frameW, meta.frameH, 0, 0, meta.frameW, meta.frameH);
    } else {
      drawPlaceholder(ctx, key, frame | 0);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Procedural placeholders (GDD 11.4). All drawing is in local 16x16 space.
// ---------------------------------------------------------------------------

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const RUN_LEGS = [
  [[3, 13, 3, 2], [10, 13, 3, 2]],
  [[5, 13, 2, 3], [8, 13, 3, 3]],
  [[4, 13, 3, 2], [9, 13, 4, 2]],
  [[6, 13, 3, 3], [9, 13, 2, 3]],
];

// Front-facing figure used by the player and every enemy.
function drawFigure(ctx, o) {
  const f = o.frame | 0;
  const shirt = o.shirt;
  const dark = PAL.DARK;
  const pose = o.pose;
  const wide = o.wide ? 1 : 0;

  if (pose === 'climb') {
    // Back view: shirt colour kept so each character stays recognisable on a ladder.
    const alt = f % 2 === 0;
    px(ctx, 5, 2, 6, 5, dark);
    px(ctx, 6, 5, 4, 2, PAL.SKIN);
    px(ctx, 4, 7, 8, 6, shirt);
    px(ctx, 7, 7, 2, 6, dark);
    px(ctx, alt ? 2 : 3, alt ? 4 : 8, 2, 5, shirt);
    px(ctx, alt ? 12 : 11, alt ? 8 : 4, 2, 5, shirt);
    px(ctx, alt ? 5 : 6, 13, 2, 3, dark);
    px(ctx, alt ? 10 : 9, 12, 2, 4, dark);
    return;
  }

  if (pose === 'hang') {
    px(ctx, 4, 2, 2, 6, PAL.SKIN);
    px(ctx, 10, 2, 2, 6, PAL.SKIN);
    px(ctx, 5, 4, 6, 5, PAL.SKIN);
    px(ctx, 5, 4, 6, 1, dark);
    px(ctx, 9, 6, 1, 1, dark);
    px(ctx, 4, 9, 8, 5, shirt);
    px(ctx, f % 2 === 0 ? 5 : 6, 14, 2, 2, dark);
    px(ctx, f % 2 === 0 ? 9 : 10, 14, 2, 2, dark);
    return;
  }

  if (pose === 'fall') {
    px(ctx, 3, 2, 2, 5, PAL.SKIN);
    px(ctx, 11, 2, 2, 5, PAL.SKIN);
    px(ctx, 5, 3, 6, 5, PAL.SKIN);
    px(ctx, 5, 3, 6, 1, dark);
    px(ctx, 9, 5, 1, 1, dark);
    px(ctx, 4, 8, 8, 5, shirt);
    px(ctx, 5, 13, 3, 2, dark);
    px(ctx, 8, 13, 3, 2, dark);
    return;
  }

  // idle / run share the standing build
  const bob = pose === 'idle' && f === 1 ? 1 : 0;
  const lean = pose === 'run' ? 1 : 0;
  const hy = 2 + bob;

  px(ctx, 5 + lean, hy, 6, 5, PAL.SKIN);
  px(ctx, 5 + lean, hy, 6, 1, o.hat || dark);
  if (o.hat) px(ctx, 9 + lean, hy + 1, 3, 1, o.hat);       // cap peak
  px(ctx, 9 + lean, hy + 2, 1, 1, pose === 'idle' && f === 1 ? PAL.SKIN : dark);

  px(ctx, 4 + lean - wide, 7 + bob, 8 + wide * 2, 5, shirt);
  px(ctx, 3 + lean - wide, 7 + bob, 1, 4, shirt);
  px(ctx, 12 + lean + wide, 7 + bob, 1, 4, shirt);
  px(ctx, 4 - wide, 12 + bob, 8 + wide * 2, 1, dark);

  if (o.tie) { px(ctx, 7 + lean, 7 + bob, 2, 4, PAL.ACCENT); }
  if (o.mop) {
    px(ctx, 13, 3, 1, 10, PAL.PIPE);
    px(ctx, 12, 13, 4, 3, PAL.TEXT_DIM);
  }
  if (o.torch) { px(ctx, 13, 9 + bob, 2, 2, PAL.ACCENT); }
  if (o.mug)   { px(ctx, 13, 9 + bob, 3, 3, PAL.TEXT); px(ctx, 12, 10 + bob, 1, 1, PAL.TEXT); }

  if (pose === 'run') {
    const legs = RUN_LEGS[f % RUN_LEGS.length];
    for (const [lx, ly, lw, lh] of legs) px(ctx, lx, ly, lw, lh, dark);
  } else {
    px(ctx, 5, 13 + bob, 2, 3 - bob, dark);
    px(ctx, 9, 13 + bob, 2, 3 - bob, dark);
  }
}

const ITEM_DRAW = {
  item_yogurt(ctx, f) {
    px(ctx, 5, 6, 6, 7, PAL.TEXT);
    px(ctx, 4, 4, 8, 2, '#F8A8C0');
    px(ctx, 6, 8, 2, 2, '#F8A8C0');
    px(ctx, 5, 6 + f, 2, 2, PAL.TEXT);
  },
  item_cola(ctx, f) {
    px(ctx, 5, 4, 6, 9, '#A02020');
    px(ctx, 5, 7, 6, 2, PAL.TEXT);
    px(ctx, 5, 3, 6, 1, PAL.PIPE);
    px(ctx, 6, 4 + f, 2, 2, PAL.TEXT);
  },
  item_sandwich(ctx, f) {
    px(ctx, 3, 5, 10, 3, '#B08A55');
    px(ctx, 3, 8, 10, 2, PAL.CLEAN);
    px(ctx, 3, 10, 10, 3, '#B08A55');
    px(ctx, 4, 5 + f, 2, 2, PAL.TEXT);
  },
  item_donut(ctx, f) {
    px(ctx, 5, 4, 6, 2, '#F8A8C0');
    px(ctx, 3, 6, 2, 4, '#F8A8C0');
    px(ctx, 11, 6, 2, 4, '#F8A8C0');
    px(ctx, 5, 10, 6, 2, '#F8A8C0');
    px(ctx, 5, 4 + f, 2, 2, PAL.TEXT);
  },
  item_pizza(ctx, f) {
    px(ctx, 3, 4, 10, 2, '#B08A55');
    px(ctx, 4, 6, 8, 2, PAL.ACCENT);
    px(ctx, 5, 8, 6, 2, PAL.ACCENT);
    px(ctx, 6, 10, 4, 2, PAL.ACCENT);
    px(ctx, 6, 6, 2, 2, '#A02020');
    px(ctx, 8, 9, 2, 2, '#A02020');
    px(ctx, 4, 4 + f, 2, 2, PAL.TEXT);
  },
  item_cake(ctx, f) {
    px(ctx, 3, 7, 10, 6, PAL.SKIN);
    px(ctx, 3, 5, 10, 2, '#F85858');
    px(ctx, 7, 2, 2, 3, PAL.TEXT);
    px(ctx, 7, 1, 2, 1, PAL.ACCENT);
    px(ctx, 4, 7 + f, 2, 2, PAL.TEXT);
  },
  item_sushi(ctx, f) {
    px(ctx, 3, 9, 10, 4, PAL.TEXT);
    px(ctx, 3, 6, 10, 3, '#F85858');
    px(ctx, 7, 6, 2, 7, PAL.CLEAN);
    px(ctx, 4, 6 + f, 2, 2, PAL.TEXT);
  },
  item_chicken(ctx, f) {
    px(ctx, 4, 3, 7, 7, '#C8B040');
    px(ctx, 5, 9, 4, 4, '#C8B040');
    px(ctx, 6, 12, 2, 3, PAL.TEXT);
    px(ctx, 5, 14, 4, 2, PAL.TEXT);
    px(ctx, 5, 3 + f, 2, 2, PAL.TEXT);
  },
};

const PLACEHOLDERS = {
  tile_wall(ctx) {
    // Office partition panel.
    px(ctx, 0, 0, 16, 16, PAL.WALL);
    px(ctx, 0, 0, 16, 1, PAL.WALL_HI);
    px(ctx, 0, 15, 16, 1, PAL.BGWALL);
    px(ctx, 15, 0, 1, 16, PAL.BGWALL);
    px(ctx, 2, 3, 12, 11, PAL.BGWALL);
    px(ctx, 3, 4, 10, 9, PAL.WALL);
    px(ctx, 3, 4, 10, 1, PAL.WALL_HI);
  },
  tile_floor(ctx) {
    px(ctx, 0, 0, 16, 16, PAL.FLOOR);
    px(ctx, 0, 0, 16, 1, PAL.FLOOR_HI);
    px(ctx, 0, 15, 16, 1, PAL.FLOOR_SH);
    px(ctx, 5, 4, 6, 1, PAL.FLOOR_SH);
    px(ctx, 0, 10, 4, 1, PAL.FLOOR_SH);
    px(ctx, 12, 10, 4, 1, PAL.FLOOR_SH);
  },
  tile_ladder(ctx) {
    px(ctx, 3, 0, 2, 16, PAL.LADDER);
    px(ctx, 12, 0, 2, 16, PAL.LADDER);
    px(ctx, 5, 0, 1, 16, PAL.LADDER_SH);
    px(ctx, 11, 0, 1, 16, PAL.LADDER_SH);
    px(ctx, 3, 2, 11, 2, PAL.LADDER);
    px(ctx, 3, 8, 11, 2, PAL.LADDER);
    px(ctx, 3, 14, 11, 2, PAL.LADDER);
  },
  tile_pipe(ctx) {
    px(ctx, 0, 2, 16, 4, PAL.PIPE);
    px(ctx, 0, 2, 16, 1, PAL.PIPE_HI);
    px(ctx, 0, 5, 16, 1, PAL.DARK);
    px(ctx, 7, 2, 1, 4, PAL.DARK);
  },
  tile_bg(ctx) {
    px(ctx, 0, 0, 16, 16, PAL.BGWALL);
    px(ctx, 0, 0, 1, 16, PAL.VOID);
    px(ctx, 8, 0, 1, 16, PAL.VOID);
  },
  door(ctx, f) {
    const active = f % 2 === 1;
    px(ctx, 3, 1, 10, 15, active ? PAL.ACCENT : PAL.FLOOR_HI);
    px(ctx, 4, 2, 8, 14, PAL.FLOOR_SH);
    px(ctx, 6, 4, 4, 4, active ? PAL.ACCENT : PAL.BGWALL);
    px(ctx, 10, 8, 2, 2, PAL.ACCENT);
  },
  player_idle(ctx, f)  { drawFigure(ctx, { shirt: PAL.HERO, pose: 'idle', frame: f }); },
  player_run(ctx, f)   { drawFigure(ctx, { shirt: PAL.HERO, pose: 'run', frame: f }); },
  player_climb(ctx, f) { drawFigure(ctx, { shirt: PAL.HERO, pose: 'climb', frame: f }); },
  player_hang(ctx, f)  { drawFigure(ctx, { shirt: PAL.HERO, pose: 'hang', frame: f }); },
  player_fall(ctx, f)  { drawFigure(ctx, { shirt: PAL.HERO, pose: 'fall', frame: f }); },

  enemy_cleaner_walk(ctx, f)  { drawFigure(ctx, { shirt: PAL.CLEAN, pose: 'run', frame: f, mop: true }); },
  enemy_cleaner_climb(ctx, f) { drawFigure(ctx, { shirt: PAL.CLEAN, pose: 'climb', frame: f }); },
  enemy_guard_walk(ctx, f)    { drawFigure(ctx, { shirt: PAL.GUARD, pose: 'run', frame: f, hat: PAL.DARK, torch: true }); },
  enemy_guard_climb(ctx, f)   { drawFigure(ctx, { shirt: PAL.GUARD, pose: 'climb', frame: f }); },
  enemy_boss_walk(ctx, f)     { drawFigure(ctx, { shirt: PAL.BOSS, pose: 'run', frame: f, wide: true, tie: true, mug: true }); },
  enemy_boss_climb(ctx, f)    { drawFigure(ctx, { shirt: PAL.BOSS, pose: 'climb', frame: f }); },
  ...ITEM_DRAW,
};

export function drawPlaceholder(ctx, key, frame) {
  const fn = PLACEHOLDERS[key];
  if (fn) { fn(ctx, frame | 0); return; }
  // Unknown key: a visible magenta-free marker built from the palette.
  px(ctx, 1, 1, 14, 14, PAL.ALERT);
  px(ctx, 3, 3, 10, 10, PAL.VOID);
}
