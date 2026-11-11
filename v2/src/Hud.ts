export interface HudStats {
  score: number;
  coins: number;
  hp: number;
  maxHp: number;
  dashCharge: number;
  best: number;
  muted: boolean;
}

export type Screen = 'title' | 'playing' | 'paused' | 'over' | 'shop';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** DOM-based UI layered over the WebGL canvas. */
export class Hud {
  private score = el('score');
  private best = el('best');
  private coins = el('coins');
  private hearts = el('hearts');
  private dashFill = el('dashfill');
  private dashLabel = el('dashlabel');
  private mute = el('mute');
  private muteBtn = el('mutebtn');
  private hud = el('hud');
  private flashEl = el('flash');
  private screens: Record<'title' | 'paused' | 'over' | 'shop', HTMLElement> = {
    title: el('title'),
    paused: el('paused'),
    over: el('over'),
    shop: el('shop'),
  };
  private last = { score: -1, coins: -1, hp: -1, maxHp: -1, best: -1 };

  /** Wires every "open shop" button. */
  onShop(cb: () => void): void {
    document.querySelectorAll<HTMLElement>('.openshop').forEach((b) => b.addEventListener('click', cb));
  }

  /** Wires the on-screen pause/resume buttons (for touch screens). */
  onPause(cb: () => void): void {
    for (const id of ['pausebtn', 'resume']) el(id).addEventListener('click', cb);
  }

  onMute(cb: () => void): void {
    el('mutebtn').addEventListener('click', cb);
  }

  update(s: HudStats): void {
    if (s.score !== this.last.score) {
      this.score.textContent = String(s.score);
      this.last.score = s.score;
    }
    if (s.coins !== this.last.coins) {
      this.coins.textContent = `× ${s.coins}`;
      this.last.coins = s.coins;
    }
    if (s.best !== this.last.best) {
      this.best.textContent = `BEST ${s.best}`;
      this.last.best = s.best;
    }
    if (s.hp !== this.last.hp || s.maxHp !== this.last.maxHp) {
      this.hearts.innerHTML = Array.from({ length: s.maxHp }, (_, i) => `<i class="${i < s.hp ? 'full' : ''}">♥</i>`).join('');
      this.last.hp = s.hp;
      this.last.maxHp = s.maxHp;
    }
    const ready = s.dashCharge >= 1;
    this.dashFill.style.width = `${Math.round(s.dashCharge * 100)}%`;
    this.dashFill.classList.toggle('ready', ready);
    this.dashLabel.textContent = ready ? 'DASH READY' : 'DASH';
    this.dashLabel.classList.toggle('ready', ready);
    this.mute.hidden = !s.muted;
    this.muteBtn.classList.toggle('off', s.muted);
  }

  show(screen: Screen): void {
    this.hud.hidden = screen === 'title' || screen === 'shop';
    for (const [name, node] of Object.entries(this.screens)) node.hidden = name !== screen;
  }

  setFlash(alpha: number): void {
    this.flashEl.style.opacity = String(Math.min(1, alpha));
  }

  /** Shows the banked coin total everywhere it appears. */
  setBank(n: number): void {
    document.querySelectorAll<HTMLElement>('.bankval').forEach((b) => (b.textContent = String(n)));
  }

  setTitleBest(best: number): void {
    el('titlebest').textContent = best > 0 ? `Best score: ${best}` : 'Collect coins, dodge rocks, crabs, gulls & coconuts';
  }

  setGameOver(score: number, coins: number, gain: number, best: number, newBest: boolean, canRestart: boolean): void {
    el('overscore').textContent = `SCORE ${score}`;
    el('overbest').textContent = newBest ? '★ NEW BEST! ★' : `BEST ${best}`;
    el('overbest').classList.toggle('new', newBest);
    el('overcoins').textContent = `× ${coins}`;
    el('overgain').textContent = `+${gain} coins banked`;
    el('overhint').hidden = !canRestart;
  }
}
