import { DASH, SLIDE } from './config';
import { clamp } from '../../src/math';

export type UpgradeId = 'dashCooldown' | 'dashLength' | 'magnet' | 'heart' | 'coinValue';
export type KiwiId = 'classic' | 'parkour' | 'sumo' | 'jetpack' | 'sport' | 'golden' | 'cowboy' | 'cat' | 'spidey' | 'admin';
/** What the second jump input does: a double jump, free flight, or jetpack thrust. */
export type AirMode = 'double' | 'fly' | 'jetpack';

export interface KiwiSkin {
  texture: 'brown' | 'gold' | 'slate' | 'void' | 'ginger';
  accessory: 'none' | 'headband' | 'crown' | 'belt' | 'admin' | 'jetpack' | 'racer' | 'cowboy' | 'cat' | 'spidey';
}

/** Everything the gameplay code needs to know about the current kiwi + upgrades. */
export interface PlayerStats {
  kiwi: KiwiId;
  skin: KiwiSkin;
  scale: number;
  dashCooldown: number;
  dashDuration: number;
  /** Passive coin-magnet radius (0 = off). */
  magnet: number;
  maxHp: number;
  coinMult: number;
  jumpMul: number;
  slideDuration: number;
  airMode: AirMode;
  /** Obstacles never hurt (they get smashed instead). */
  invincible: boolean;
  /** Multiplier for how fast the kiwi changes lanes. */
  reflex: number;
  /** Rides a horse (taller, longer hitbox). */
  mounted: boolean;
  /** The dash fires pistols and destroys every obstacle ahead. */
  shootout: boolean;
  /** The dash webs crabs and gulls and pulls them in. */
  web: boolean;
}

interface Mods {
  dashCooldownMul: number;
  dashLengthMul: number;
  magnet: number;
  extraHp: number;
  coinMul: number;
  jumpMul: number;
  slideMul: number;
  scale: number;
  airMode: AirMode;
  invincible: boolean;
  reflex: number;
  mounted: boolean;
  shootout: boolean;
  /** The dash webs crabs and gulls and pulls them in. */
  web: boolean;
}

const NEUTRAL: Mods = {
  dashCooldownMul: 1,
  dashLengthMul: 1,
  magnet: 0,
  extraHp: 0,
  coinMul: 1,
  jumpMul: 1,
  slideMul: 1,
  scale: 1,
  airMode: 'double',
  invincible: false,
  reflex: 1,
  mounted: false,
  shootout: false,
  web: false,
};

export interface KiwiDef {
  id: KiwiId;
  name: string;
  blurb: string;
  perks: string[];
  price: number;
  skin: KiwiSkin;
  /** CSS colour of the swatch shown in the shop. */
  accent: string;
  mods: Partial<Mods>;
}

export const KIWIS: KiwiDef[] = [
  {
    id: 'classic',
    name: 'Classic Kiwi',
    blurb: 'Honest, brown and fluffy.',
    perks: ['No bonuses — the baseline kiwi'],
    price: 0,
    skin: { texture: 'brown', accessory: 'none' },
    accent: '#8b5e3c',
    mods: {},
  },
  {
    id: 'parkour',
    name: 'Parkour Kiwi',
    blurb: 'Red headband, zero fear.',
    perks: ['Dash cooldown −30%', 'Double jump +8%', 'Slides 25% longer'],
    price: 400,
    skin: { texture: 'brown', accessory: 'headband' },
    accent: '#e63946',
    mods: { dashCooldownMul: 0.7, jumpMul: 1.08, slideMul: 1.25 },
  },
  {
    id: 'sumo',
    name: 'Sumo Kiwi',
    blurb: 'Big, round and hard to stop.',
    perks: ['+1 heart', 'Dash lasts 30% longer', 'Dash cooldown +10%'],
    price: 650,
    skin: { texture: 'slate', accessory: 'belt' },
    accent: '#6c6f7d',
    mods: { extraHp: 1, dashLengthMul: 1.3, dashCooldownMul: 1.1, scale: 1.15 },
  },
  {
    id: 'jetpack',
    name: 'Jetpack Kiwi',
    blurb: 'Goggles on. Tanks full.',
    perks: ['Hold jump in the air to fly on the jetpack', 'Limited fuel, refills on the ground', 'No double jump'],
    price: 1250,
    skin: { texture: 'brown', accessory: 'jetpack' },
    accent: '#ff7b00',
    mods: { airMode: 'jetpack' },
  },
  {
    id: 'sport',
    name: 'Sport Kiwi',
    blurb: 'F1 helmet, racing suit, fresh sneakers.',
    perks: ['Reflexes ×3: switches lanes 3× faster', 'Dash cooldown −50%'],
    price: 1000,
    skin: { texture: 'brown', accessory: 'racer' },
    accent: '#d62828',
    mods: { reflex: 3, dashCooldownMul: 0.5 },
  },
  {
    id: 'golden',
    name: 'Golden Kiwi',
    blurb: 'Coins simply like this bird.',
    perks: ['Coin magnet +3', 'Coins are worth +25%'],
    price: 1500,
    skin: { texture: 'gold', accessory: 'crown' },
    accent: '#ffd23c',
    mods: { magnet: 3, coinMul: 1.25 },
  },
  {
    id: 'cowboy',
    name: 'Cowboy Kiwi',
    blurb: 'Rides a horse. Shoots first.',
    perks: ['Rides a horse (bigger hitbox)', 'Dash = shootout: pistols destroy every obstacle ahead', 'Smashed obstacles still score'],
    price: 1500,
    skin: { texture: 'brown', accessory: 'cowboy' },
    accent: '#a0522d',
    mods: { mounted: true, shootout: true },
  },
  {
    id: 'cat',
    name: 'Cat Kiwi',
    blurb: 'A kiwi in a cat costume. Meow?',
    perks: ['Dash lasts 1000% longer'],
    price: 1410,
    skin: { texture: 'ginger', accessory: 'cat' },
    accent: '#f08a3c',
    mods: { dashLengthMul: 11 },
  },
  {
    id: 'spidey',
    name: 'Spidey Kiwi',
    blurb: 'Friendly neighbourhood kiwi.',
    perks: ['Dash webs crabs and gulls and pulls them in'],
    price: 1700,
    skin: { texture: 'brown', accessory: 'spidey' },
    accent: '#d62828',
    mods: { web: true },
  },
  {
    id: 'admin',
    name: 'Admin Kiwi',
    blurb: 'Has root access to the island.',
    perks: ['Invincible — obstacles get smashed', 'Press jump twice to FLY', 'Hold ↑ to climb, ↓ to dive'],
    price: 9999,
    skin: { texture: 'void', accessory: 'admin' },
    accent: '#9b5de5',
    mods: { invincible: true, airMode: 'fly' },
  },
];

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  /** Price of each level; its length is the maximum level. */
  costs: number[];
  /** Short readout of the effect, used to show "current → next". */
  show: (s: PlayerStats) => string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'dashCooldown',
    name: 'Dash Recharge',
    desc: 'Dash comes back 10% faster per level.',
    costs: [80, 160, 280, 450, 700],
    show: (s) => `${s.dashCooldown.toFixed(1)}s cooldown`,
  },
  {
    id: 'dashLength',
    name: 'Dash Length',
    desc: 'Dash lasts 10% longer per level.',
    costs: [80, 150, 260, 420, 650],
    show: (s) => `${s.dashDuration.toFixed(2)}s dash`,
  },
  {
    id: 'magnet',
    name: 'Coin Magnet',
    desc: 'Coins fly towards you from further away.',
    costs: [60, 120, 220, 360, 560],
    show: (s) => (s.magnet > 0 ? `${s.magnet.toFixed(0)} m pull` : 'off'),
  },
  {
    id: 'heart',
    name: 'Extra Heart',
    desc: 'Survive one more hit.',
    costs: [300, 700],
    show: (s) => `${s.maxHp} hearts`,
  },
  {
    id: 'coinValue',
    name: 'Coin Value',
    desc: 'Coins add more to your bank (+20% per level).',
    costs: [100, 200, 350, 550, 800],
    show: (s) => `×${s.coinMult.toFixed(2)} coins`,
  },
];

export type Levels = Record<UpgradeId, number>;

const MIN_DASH_COOLDOWN = 0.8;

export function computeStats(levels: Levels, kiwiId: KiwiId): PlayerStats {
  const kiwi = KIWIS.find((k) => k.id === kiwiId) ?? KIWIS[0];
  const m: Mods = { ...NEUTRAL, ...kiwi.mods };
  return {
    kiwi: kiwi.id,
    skin: kiwi.skin,
    scale: m.scale,
    dashCooldown: Math.max(MIN_DASH_COOLDOWN, DASH.cooldown * (1 - 0.1 * levels.dashCooldown) * m.dashCooldownMul),
    dashDuration: DASH.duration * (1 + 0.1 * levels.dashLength) * m.dashLengthMul,
    magnet: levels.magnet * 2 + m.magnet,
    maxHp: 3 + levels.heart + m.extraHp,
    coinMult: (1 + 0.2 * levels.coinValue) * m.coinMul,
    jumpMul: m.jumpMul,
    slideDuration: SLIDE.duration * m.slideMul,
    airMode: m.airMode,
    invincible: m.invincible,
    reflex: m.reflex,
    mounted: m.mounted,
    shootout: m.shootout,
    web: m.web,
  };
}

interface Save {
  wallet: number;
  levels: Levels;
  owned: KiwiId[];
  selected: KiwiId;
}

const SAVE_KEY = 'kiwi-rush-3d-save';

const freshSave = (): Save => ({
  wallet: 0,
  levels: { dashCooldown: 0, dashLength: 0, magnet: 0, heart: 0, coinValue: 0 },
  owned: ['classic'],
  selected: 'classic',
});

/** The player's persistent progress: banked coins, upgrade levels and owned kiwis (kept in localStorage). */
export class Progress {
  readonly save: Save;

  constructor() {
    this.save = this.load();
  }

  private load(): Save {
    const base = freshSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return base;
      const d = JSON.parse(raw) as Partial<Save>;
      for (const u of UPGRADES) {
        const lv = Number(d.levels?.[u.id]);
        if (Number.isFinite(lv)) base.levels[u.id] = clamp(Math.floor(lv), 0, u.costs.length);
      }
      const known = new Set(KIWIS.map((k) => k.id));
      const owned = (d.owned ?? []).filter((id): id is KiwiId => known.has(id));
      base.owned = Array.from(new Set<KiwiId>(['classic', ...owned]));
      base.wallet = Math.max(0, Math.floor(Number(d.wallet) || 0));
      base.selected = d.selected && base.owned.includes(d.selected) ? d.selected : 'classic';
    } catch {
      /* corrupt or unavailable storage: start fresh */
    }
    return base;
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* storage unavailable: progress lasts for this session only */
    }
  }

  stats(): PlayerStats {
    return computeStats(this.save.levels, this.save.selected);
  }

  /** Stats as they would be with one more level of `id` (for the "current → next" readout). */
  statsWithNext(id: UpgradeId): PlayerStats {
    return computeStats({ ...this.save.levels, [id]: this.save.levels[id] + 1 }, this.save.selected);
  }

  level(id: UpgradeId): number {
    return this.save.levels[id];
  }

  /** Price of the next level, or null when maxed. */
  upgradeCost(id: UpgradeId): number | null {
    const def = UPGRADES.find((u) => u.id === id)!;
    return this.level(id) >= def.costs.length ? null : def.costs[this.level(id)];
  }

  addCoins(n: number): void {
    this.save.wallet += Math.max(0, Math.floor(n));
    this.persist();
  }

  buyUpgrade(id: UpgradeId): boolean {
    const cost = this.upgradeCost(id);
    if (cost === null || this.save.wallet < cost) return false;
    this.save.wallet -= cost;
    this.save.levels[id]++;
    this.persist();
    return true;
  }

  owns(id: KiwiId): boolean {
    return this.save.owned.includes(id);
  }

  buyKiwi(id: KiwiId): boolean {
    const def = KIWIS.find((k) => k.id === id);
    if (!def || this.owns(id) || this.save.wallet < def.price) return false;
    this.save.wallet -= def.price;
    this.save.owned.push(id);
    this.save.selected = id;
    this.persist();
    return true;
  }

  select(id: KiwiId): boolean {
    if (!this.owns(id)) return false;
    this.save.selected = id;
    this.persist();
    return true;
  }
}
