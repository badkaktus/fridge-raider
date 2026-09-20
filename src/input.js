// Keyboard input. Browser-only module; the game receives a plain key-state object.
// Arrows are the only keys the game reads or intercepts (GDD 9, checklist T3).

const KEYS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export class Input {
  constructor(target = window) {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.lastHoriz = 0;

    this.onKeyDown = (e) => this.handle(e, true);
    this.onKeyUp = (e) => this.handle(e, false);
    this.onBlur = () => this.clear();

    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  handle(event, down) {
    const name = KEYS[event.code];
    if (!name) return;          // every other key is left to the browser
    event.preventDefault();     // keeps the page from scrolling
    if (event.repeat) return;
    this[name] = down;
    if (down && name === 'left') this.lastHoriz = -1;
    if (down && name === 'right') this.lastHoriz = 1;
  }

  clear() {
    this.left = this.right = this.up = this.down = false;
    this.lastHoriz = 0;
  }
}
