export interface InputHandlers {
  jumpPress(): void;
  jumpRelease(): void;
  dash(): void;
  pause(): void;
  mute(): void;
}

const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W', 'Enter']);
const DASH_KEYS = new Set(['Shift', 'ArrowRight', 'd', 'D', 'x', 'X']);
const PAUSE_KEYS = new Set(['p', 'P', 'Escape']);
const MUTE_KEYS = new Set(['m', 'M']);

/** Translates keyboard / mouse / touch events into game actions. */
export class Input {
  private jumpPointer: number | null = null;

  constructor(private canvas: HTMLCanvasElement, private handlers: InputHandlers) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (JUMP_KEYS.has(e.key) || DASH_KEYS.has(e.key) || e.key.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    if (JUMP_KEYS.has(e.key)) this.handlers.jumpPress();
    else if (DASH_KEYS.has(e.key)) this.handlers.dash();
    else if (PAUSE_KEYS.has(e.key)) this.handlers.pause();
    else if (MUTE_KEYS.has(e.key)) this.handlers.mute();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (JUMP_KEYS.has(e.key)) this.handlers.jumpRelease();
  };

  /** Left half of the screen jumps, right half dashes. */
  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.focus();
    const rect = this.canvas.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 2) {
      this.jumpPointer = e.pointerId;
      this.handlers.jumpPress();
    } else {
      this.handlers.dash();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.jumpPointer) {
      this.jumpPointer = null;
      this.handlers.jumpRelease();
    }
  };
}
