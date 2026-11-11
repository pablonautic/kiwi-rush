export interface InputHandlers {
  left(): void;
  right(): void;
  jumpPress(): void;
  /** @param cut true for keyboard (releasing early shortens the jump); touch releases pass false */
  jumpRelease(cut: boolean): void;
  down(): void;
  dash(): void;
  pause(): void;
  mute(): void;
  shop(): void;
}

const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);
const JUMP = new Set(['ArrowUp', 'w', 'W']);
const DOWN = new Set(['ArrowDown', 's', 'S']);
const DASH = new Set([' ', 'Enter']);
const PAUSE = new Set(['p', 'P', 'Escape']);
const MUTE = new Set(['m', 'M']);
const SHOP = new Set(['b', 'B']);

const SWIPE_PX = 36;

/** Keyboard: ←/→ lanes, ↑ jump, ↓ slide, Space dash, B shop. Touch: swipe left/right/up/down, tap to dash. */
export class Input {
  private touch: { id: number; x: number; y: number; used: boolean; jumped: boolean } | null = null;

  constructor(target: HTMLElement, private h: InputHandlers) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', () => {
      if (this.touch?.jumped) this.h.jumpRelease(false);
      this.touch = null;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key;
    if (LEFT.has(k) || RIGHT.has(k) || JUMP.has(k) || DOWN.has(k) || DASH.has(k)) e.preventDefault();
    if (e.repeat) return;
    if (LEFT.has(k)) this.h.left();
    else if (RIGHT.has(k)) this.h.right();
    else if (JUMP.has(k)) this.h.jumpPress();
    else if (DOWN.has(k)) this.h.down();
    else if (DASH.has(k)) this.h.dash();
    else if (PAUSE.has(k)) this.h.pause();
    else if (MUTE.has(k)) this.h.mute();
    else if (SHOP.has(k)) this.h.shop();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (JUMP.has(e.key)) this.h.jumpRelease(true);
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY, used: false, jumped: false };
  };

  private onPointerMove = (e: PointerEvent): void => {
    const t = this.touch;
    if (!t || t.id !== e.pointerId || t.used) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    t.used = true;
    if (Math.abs(dx) > Math.abs(dy)) (dx < 0 ? this.h.left : this.h.right)();
    else if (dy < 0) {
      t.jumped = true; // keep the finger down to keep flying / thrusting
      this.h.jumpPress();
    }
    else this.h.down();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    this.touch = null;
    if (!t.used) this.h.dash(); // a plain tap dashes
    else if (t.jumped) this.h.jumpRelease(false);
  };
}
