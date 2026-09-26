// Bootstrap: canvas, integer scaling, fixed-step loop (GDD 2.3). Browser-only module.

import { VIEW_W, VIEW_H } from './level.js';
import { createGame } from './game.js';
import { SpriteRegistry, PAL } from './sprites.js';
import { Renderer, drawText } from './render.js';
import { Input } from './input.js';

const STEP = 1 / 60;
const MAX_STEPS = 5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

function fitToWindow() {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
window.addEventListener('resize', fitToWindow);
fitToWindow();

// `?level=N` starts the campaign from level N, e.g. index.html?level=3.
const startLevel = Number.parseInt(new URLSearchParams(window.location.search).get('level'), 10);
const game = createGame(undefined, undefined, { startLevel });

if (!game) {
  ctx.fillStyle = PAL.VOID;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, 'LEVEL DATA INVALID', VIEW_W / 2, 110, PAL.ALERT, 1, 'center');
  drawText(ctx, 'SEE CONSOLE', VIEW_W / 2, 126, PAL.TEXT_DIM, 1, 'center');
} else {
  const sprites = new SpriteRegistry();
  const renderer = new Renderer(ctx, sprites);
  const input = new Input(window);

  // Sprite loading never blocks the game: placeholders run until PNGs arrive.
  sprites.load('assets/sprites/').then(() => renderer.invalidate());

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS) {
      game.update(STEP, input);
      accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) accumulator = 0;

    renderer.draw(game);
  }
  requestAnimationFrame(frame);
}
