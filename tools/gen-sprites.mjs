// Pixel-art sprite generator for Fridge Raider.
// Writes 16x16 PNG sprite strips into assets/sprites/ with no external deps.
// Run: node tools/gen-sprites.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sprites');
const TS = 16;

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// pixels: Uint8Array RGBA, length w*h*4
function encodePNG(w, h, pixels) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    pixels.copy
      ? pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
      : Buffer.from(pixels.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------- canvas --- */

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

class Bitmap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4); // transparent
  }
  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !color) return;
    const [r, g, b] = hex(color);
    const i = (y * this.w + x) * 4;
    this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b; this.px[i + 3] = 255;
  }
  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }
  blitGrid(ox, oy, rows, palette) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]];
        if (c) this.set(ox + x, oy + y, c);
      }
    });
  }
}

function checkGrid(name, rows) {
  if (rows.length !== TS) throw new Error(`${name}: ${rows.length} rows, expected ${TS}`);
  rows.forEach((r, i) => {
    if (r.length !== TS) throw new Error(`${name}: row ${i} has ${r.length} chars, expected ${TS}`);
  });
}

// Writes a horizontal strip of frames, every frame a 16x16 char grid.
function writeStrip(file, frames, palettes) {
  frames.forEach((f, i) => checkGrid(`${file}#${i}`, f));
  const bmp = new Bitmap(TS * frames.length, TS);
  frames.forEach((f, i) => bmp.blitGrid(i * TS, 0, f, Array.isArray(palettes) ? palettes[i] : palettes));
  writeFileSync(join(OUT, file), encodePNG(bmp.w, bmp.h, bmp.px));
  return `${file} (${frames.length} frames)`;
}

/* ------------------------------------------------------------- palette --- */

const P = {
  DARK: '#303050',
  SHOE: '#1A1A2E',
  SKIN: '#F0C090',
  SKIN_SH: '#C89058',
  WHITE: '#F8F8F8',
  GOLD: '#F8D800',
  RED: '#A02020',
  WOOD: '#B08A55',
  METAL: '#9AA6B8',
  METAL_HI: '#D8E0EC',
  WALL: '#5A5A7A',
  WALL_HI: '#8A8AB0',
  FLOOR: '#7A5B3A',
  FLOOR_HI: '#B08A55',
  FLOOR_SH: '#4A3522',
  LADDER: '#C8B040',
  LADDER_SH: '#8A7420',
  BGWALL: '#2C2C44',
  VOID: '#101018',
};

// Character palette: k outline, s skin, S skin shadow, b shirt, l shirt light,
// h hair/hat, w white, y gold, r red, n wood, g metal.
function charPal({ shirt, shirtLight, hair }) {
  return {
    '.': null,
    k: P.DARK,
    K: P.SHOE,
    s: P.SKIN,
    S: P.SKIN_SH,
    b: shirt,
    l: shirtLight,
    h: hair,
    w: P.WHITE,
    y: P.GOLD,
    r: P.RED,
    n: P.WOOD,
    g: P.METAL,
  };
}

const HERO = charPal({ shirt: '#3CBCFC', shirtLight: '#A8E8FC', hair: '#6A4A28' });
const CLEANER = charPal({ shirt: '#308030', shirtLight: '#58B058', hair: '#2A5A2A' });
const GUARD = charPal({ shirt: '#1848A0', shirtLight: '#3868D0', hair: '#101838' });
const BOSS = charPal({ shirt: '#A02020', shirtLight: '#D04040', hair: '#707088' });
const CEO = charPal({ shirt: '#E0E0E8', shirtLight: '#F8F8F8', hair: '#A0A0B8' });

/* ----------------------------------------------------------- humanoids --- */

const HEAD_FRONT = [
  '................',
  '................',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '...hssssssh.....',
  '...hsskssk......',
  '...hsssSSs......',
  '.....ssss.......',
];

const HEAD_BACK = [
  '................',
  '................',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '....hhhhhh......',
  '.....ssss.......',
];

function body(rows) {
  return [...HEAD_FRONT, ...rows];
}

const IDLE_0 = body([
  '...bbbbbbbb.....',
  '..sbbbllbbbs....',
  '...bbbbbbbb.....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk..kkk.....',
  '...kk....kk.....',
  '..KKK....KKK....',
]);

const RUN_0 = body([
  '...bbbbbbbb.....',
  '...bbbllbbbs....',
  '..sbbbbbbbb.....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '..kkk....kkk....',
  '.kkk......kkk...',
  'KKK........KKK..',
]);

const RUN_1 = body([
  '...bbbbbbbb.....',
  '...bbbllbbb.....',
  '..sbbbbbbbbs....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '....kkkkkk......',
  '....kkk.kk......',
  '...KKK..KKK.....',
]);

const RUN_2 = body([
  '...bbbbbbbb.....',
  '..sbbbllbbb.....',
  '...bbbbbbbbs....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk...kkk....',
  '..kkk......kk...',
  '.KKK.......KKK..',
]);

const RUN_3 = body([
  '...bbbbbbbb.....',
  '...bbbllbbb.....',
  '..sbbbbbbbbs....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '....kkkkkk......',
  '....kk.kkk......',
  '...KK..KKK......',
]);

const FALL_0 = [
  '..s..........s..',
  '..s..........s..',
  '..ss.hhhhhh.ss..',
  '...shhhhhhhhs...',
  '...hssssssh.....',
  '...hsskssk......',
  '...hssssss......',
  '.....ssss.......',
  '...bbbbbbbb.....',
  '...bbbllbbb.....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '..kkkk..kkkk....',
  '.kkk......kkk...',
  '.KKK......KKK...',
  '................',
];

const CLIMB_0 = [
  ...HEAD_BACK,
  '..sbbbbbbbbs....',
  '..sbbbbbbbbs....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk..kkk.....',
  '...kk....kk.....',
  '..kkk....kk.....',
  '..KK......KK....',
];

const CLIMB_1 = [
  ...HEAD_BACK,
  '...bbbbbbbbs....',
  '..sbbbbbbbbs....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk..kkk.....',
  '...kk....kk.....',
  '...kk....kkk....',
  '...KK.....KK....',
];

const HANG_0 = [
  '..ss......ss....',
  '..ss......ss....',
  '..s.hhhhhh.s....',
  '..shhhhhhhhs....',
  '..shsssssshs....',
  '..shsskssk.s....',
  '..shsssSSs.s....',
  '..s..ssss..s....',
  '..sbbbbbbbbs....',
  '...bbbllbbb.....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk..kkk.....',
  '...kk....kk.....',
  '..kk......kk....',
  '..KK......KK....',
];

const HANG_1 = [
  '..ss......ss....',
  '..ss......ss....',
  '..s.hhhhhh.s....',
  '..shhhhhhhhs....',
  '..shsssssshs....',
  '..shsskssk.s....',
  '..shsssSSs.s....',
  '..s..ssss..s....',
  '..sbbbbbbbbs....',
  '...bbbllbbb.....',
  '...bbbbbbbb.....',
  '...kkkkkkkk.....',
  '...kkk..kkk.....',
  '....kk..kk......',
  '....kk..kkk.....',
  '...KKK...KKK....',
];

// Blink + 1px breathing dip for the second idle frame.
function idleBreath(rows) {
  const out = rows.map((r) => r);
  const shifted = ['................', ...out.slice(0, TS - 1)];
  return shifted.map((r) => r.replace('hsskssk', 'hssSssS'));
}

const IDLE_1 = idleBreath(IDLE_0);

/* ------------------------------------------------------- enemy props ----- */

// Overlay strings are applied on top of a base frame: '.' keeps the base pixel.
function overlay(frame, patch) {
  return frame.map((row, y) => {
    const p = patch[y];
    if (!p) return row;
    return row
      .split('')
      .map((ch, x) => (p[x] && p[x] !== '.' ? p[x] : ch))
      .join('');
  });
}

const CAP = [
  '................',
  '................',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '...hhhhhhhhh....',
  '................',
];

const MOP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '............n...',
  '............n...',
  '............n...',
  '............n...',
  '............n...',
  '............n...',
  '............n...',
  '...........ggg..',
  '...........ggg..',
  '...........ggg..',
  '................',
];

const TORCH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '............yy..',
  '............kk..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const MUG = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...........www..',
  '...........wkw..',
  '...........www..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const TIE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......yy........',
  '......yy........',
  '......yy........',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// Chief executive (level 3): broad shoulders, 1 px gold tie, phone at the ear.
const SHOULDERS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..b........b....',
  '..b........b....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const GOLD_TIE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......y........',
  '.......y........',
  '.......y........',
  '.......y........',
  '................',
  '................',
  '................',
];

const PHONE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........kk....',
  '..........ks....',
  '...........sb...',
  '...........bb...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/* ---------------------------------------------------------- item icons --- */

function itemPal(a, b, c) {
  return { '.': null, A: a, B: b, C: c, k: P.DARK, w: P.WHITE };
}

const ITEMS = {
  // cup of yogurt
  item_yogurt: {
    pal: itemPal('#F8F8F8', '#F85858', '#C0C0C0'),
    grid: [
      '................',
      '................',
      '................',
      '................',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '....AAAAAAAA....',
      '....AwAAAAAA....',
      '....AwAAAAAA....',
      '.....AAAAAA.....',
      '.....AAAAAA.....',
      '.....ACCCCA.....',
      '......AAAA......',
      '................',
      '................',
      '................',
    ],
  },
  // cola can
  item_cola: {
    pal: itemPal('#A02020', '#F8F8F8', '#C8C8D8'),
    grid: [
      '................',
      '................',
      '................',
      '.....CCCCCC.....',
      '.....CAAAAC.....',
      '.....AAAAAA.....',
      '.....AwAAAA.....',
      '.....AwBBAA.....',
      '.....AwBBAA.....',
      '.....AAAAAA.....',
      '.....AAAAAA.....',
      '.....AAAAAA.....',
      '.....CCCCCC.....',
      '................',
      '................',
      '................',
    ],
  },
  // sandwich
  item_sandwich: {
    pal: itemPal('#B08A55', '#58B058', '#F85858'),
    grid: [
      '................',
      '................',
      '................',
      '................',
      '...AAAAAAAAAA...',
      '..AAwAAAAAAAAA..',
      '..AAAAAAAAAAAA..',
      '..BBBBBBBBBBBB..',
      '..CCCCCCCCCCCC..',
      '..AAAAAAAAAAAA..',
      '...AAAAAAAAAA...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // donut
  item_donut: {
    pal: itemPal('#F8A8C0', '#B08A55', '#F8F8F8'),
    grid: [
      '................',
      '................',
      '................',
      '.....AAAAAA.....',
      '...AAAAAAAAAA...',
      '..AAAwAAAAAAAA..',
      '..AAAAABBAAAAA..',
      '..AABBBBBBAAAA..',
      '..AABBBBBBAAAA..',
      '..AAAAABBAAAAA..',
      '..AAAAAAAAAAAA..',
      '...AAAAAAAAAA...',
      '.....AAAAAA.....',
      '................',
      '................',
      '................',
    ],
  },
  // pizza slice
  item_pizza: {
    pal: itemPal('#F8D800', '#A02020', '#B08A55'),
    grid: [
      '................',
      '................',
      '................',
      '.......AA.......',
      '......AAAA......',
      '......ABAA......',
      '.....AAAAAA.....',
      '.....AABAAA.....',
      '....AAAAAABA....',
      '....AABAAAAA....',
      '...AAAAAAAAA....',
      '...CCCCCCCCCC...',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // cake slice
  item_cake: {
    pal: itemPal('#F0C090', '#F85858', '#F8F8F8'),
    grid: [
      '................',
      '................',
      '................',
      '.......B........',
      '......BBB.......',
      '.....CCCCCC.....',
      '....CCCCCCCC....',
      '....AAAAAAAA....',
      '....ACCCCCCA....',
      '....AAAAAAAA....',
      '....AAwAAAAA....',
      '....AAAAAAAA....',
      '.....CCCCCC.....',
      '................',
      '................',
      '................',
    ],
  },
  // Smoked salmon pack, kept under the item_sushi file name so no code changes:
  // cream card header with a gold crest and red title, clear tray with orange
  // slices, pale grain lines and a torn lower edge. Frame 2 moves the shine.
  item_sushi: {
    pal: {
      '.': null,
      g: '#9AA6B8', // tray and card edge
      c: '#F0E0C0', // cream card
      y: '#C8A040', // gold crest
      r: '#D03030', // red title line
      w: '#F8F8F8', // clear tray
      o: '#F87830', // salmon
      O: '#C04818', // fold between slices
      l: '#F8B070', // grain line
      h: '#FFF0D8', // shine
    },
    frames: [
      [
        '................',
        '..gggggggggggg..',
        '..gccccyyccccg..',
        '..gcrrrrrrrrcg..',
        '..gccccccccccg..',
        '..gggggggggggg..',
        '..gwoooOoooowg..',
        '..gwlhoOlooowg..',
        '..gwolooOloowg..',
        '..gwoolooOlowg..',
        '..gwoooooOoowg..',
        '..gwwoooooOowg..',
        '..gwwwoowoOwwg..',
        '..gwwwwwwwwwwg..',
        '...gggggggggg...',
        '................',
      ],
      [
        '................',
        '..gggggggggggg..',
        '..gccccyyccccg..',
        '..gcrrrrrrrrcg..',
        '..gccccccccccg..',
        '..gggggggggggg..',
        '..gwoooOoooowg..',
        '..gwlooOlooowg..',
        '..gwolooOloowg..',
        '..gwoolooOlhwg..',
        '..gwoooooOoowg..',
        '..gwwoooooOowg..',
        '..gwwwoowoOwwg..',
        '..gwwwwwwwwwwg..',
        '...gggggggggg...',
        '................',
      ],
    ],
  },
  // chicken drumstick
  item_chicken: {
    pal: itemPal('#C8B040', '#F0E0B0', '#8A7420'),
    grid: [
      '................',
      '................',
      '................',
      '......AAAA......',
      '.....AAAAAA.....',
      '....AAwAAAAA....',
      '....AAAAAAAA....',
      '....AAAAAAAA....',
      '.....AAAAAA.....',
      '......AAAA......',
      '.......BB.......',
      '.......BB.......',
      '......BBBB......',
      '......BBBB......',
      '................',
      '................',
    ],
  },
};

// Second item frame: glint moves one pixel, icon keeps its shape.
function glintFrame(grid) {
  let moved = false;
  return grid.map((row) => {
    if (moved || !row.includes('w')) return row.replace(/w/g, 'A');
    moved = true;
    return row.replace(/w/g, 'A');
  }).map((row, y) => {
    if (y !== 6) return row;
    const i = row.indexOf('A');
    if (i < 0) return row;
    return row.slice(0, i + 2) + 'w' + row.slice(i + 3);
  });
}

/* -------------------------------------------------------------- tiles ---- */

function tileWall() {
  const b = new Bitmap(TS, TS);
  b.rect(0, 0, 16, 16, P.WALL);
  b.rect(0, 0, 16, 1, P.WALL_HI);
  for (let y = 2; y < 16; y += 4) b.rect(0, y, 16, 1, '#4A4A66');
  for (let x = 3; x < 16; x += 6) b.rect(x, 2, 1, 14, '#4A4A66');
  return b;
}

function tileFloor() {
  const b = new Bitmap(TS, TS);
  b.rect(0, 0, 16, 16, P.FLOOR);
  b.rect(0, 0, 16, 1, P.FLOOR_HI);
  b.rect(0, 15, 16, 1, P.FLOOR_SH);
  for (let x = 0; x < 16; x += 8) b.rect(x, 4, 1, 8, P.FLOOR_SH);
  b.rect(0, 8, 16, 1, '#6A4E30');
  return b;
}

function tileLadder() {
  const b = new Bitmap(TS, TS);
  b.rect(3, 0, 2, 16, P.LADDER);
  b.rect(11, 0, 2, 16, P.LADDER);
  b.rect(5, 0, 1, 16, P.LADDER_SH);
  b.rect(10, 0, 1, 16, P.LADDER_SH);
  for (const y of [2, 8, 14]) {
    b.rect(3, y, 10, 2, P.LADDER);
    b.rect(3, y + 2, 10, 1, P.LADDER_SH);
  }
  return b;
}

function tilePipe() {
  const b = new Bitmap(TS, TS);
  b.rect(0, 2, 16, 4, P.METAL);
  b.rect(0, 2, 16, 1, P.METAL_HI);
  b.rect(0, 5, 16, 1, '#6A7488');
  b.rect(7, 1, 2, 6, '#6A7488');
  return b;
}

function tileBg() {
  const b = new Bitmap(TS, TS);
  b.rect(0, 0, 16, 16, P.BGWALL);
  for (let x = 0; x < 16; x += 8) b.rect(x, 0, 1, 16, P.VOID);
  b.rect(0, 7, 16, 1, '#26263C');
  return b;
}

function doorFrames() {
  const frames = [];
  for (const active of [false, true]) {
    const b = new Bitmap(TS, TS);
    b.rect(3, 1, 10, 15, active ? P.GOLD : P.FLOOR_HI);
    b.rect(4, 2, 8, 13, P.FLOOR_SH);
    b.rect(5, 3, 6, 5, active ? '#F8D800' : '#5A5A7A'); // window
    b.rect(10, 9, 2, 2, P.GOLD); // handle
    frames.push(b);
  }
  return frames;
}

function writeBitmaps(file, bitmaps) {
  const strip = new Bitmap(TS * bitmaps.length, TS);
  bitmaps.forEach((b, i) => {
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const j = (y * TS + x) * 4;
        if (b.px[j + 3]) {
          const k = (y * strip.w + i * TS + x) * 4;
          strip.px[k] = b.px[j];
          strip.px[k + 1] = b.px[j + 1];
          strip.px[k + 2] = b.px[j + 2];
          strip.px[k + 3] = 255;
        }
      }
  });
  writeFileSync(join(OUT, file), encodePNG(strip.w, strip.h, strip.px));
  return `${file} (${bitmaps.length} frames)`;
}

/* --------------------------------------------------------------- main ---- */

mkdirSync(OUT, { recursive: true });
const written = [];

// Player
written.push(writeStrip('player_idle.png', [IDLE_0, IDLE_1], HERO));
written.push(writeStrip('player_run.png', [RUN_0, RUN_1, RUN_2, RUN_3], HERO));
written.push(writeStrip('player_climb.png', [CLIMB_0, CLIMB_1], HERO));
written.push(writeStrip('player_hang.png', [HANG_0, HANG_1], HERO));
written.push(writeStrip('player_fall.png', [FALL_0], HERO));

// Enemies
const walk = [RUN_0, RUN_1, RUN_2, RUN_3];
const climb = [CLIMB_0, CLIMB_1];

written.push(writeStrip('enemy_cleaner_walk.png', walk.map((f) => overlay(overlay(f, CAP), MOP)), CLEANER));
written.push(writeStrip('enemy_cleaner_climb.png', climb.map((f) => overlay(f, CAP)), CLEANER));
written.push(writeStrip('enemy_guard_walk.png', walk.map((f) => overlay(overlay(f, CAP), TORCH)), GUARD));
written.push(writeStrip('enemy_guard_climb.png', climb.map((f) => overlay(f, CAP)), GUARD));
written.push(writeStrip('enemy_boss_walk.png', walk.map((f) => overlay(overlay(f, TIE), MUG)), BOSS));
written.push(writeStrip('enemy_boss_climb.png', climb, BOSS));
// The chief executive never climbs, so there is no enemy_ceo_climb strip.
written.push(writeStrip('enemy_ceo_walk.png', walk.map((f) => overlay(overlay(overlay(f, SHOULDERS), GOLD_TIE), PHONE)), CEO));

// Items
for (const [name, def] of Object.entries(ITEMS)) {
  written.push(writeStrip(`${name}.png`, def.frames || [def.grid, glintFrame(def.grid)], def.pal));
}

// Tiles and door
written.push(writeBitmaps('tile_wall.png', [tileWall()]));
written.push(writeBitmaps('tile_floor.png', [tileFloor()]));
written.push(writeBitmaps('tile_ladder.png', [tileLadder()]));
written.push(writeBitmaps('tile_pipe.png', [tilePipe()]));
written.push(writeBitmaps('tile_bg.png', [tileBg()]));
written.push(writeBitmaps('door.png', doorFrames()));

console.log(`wrote ${written.length} sprite files to assets/sprites/`);
written.forEach((w) => console.log('  ' + w));
