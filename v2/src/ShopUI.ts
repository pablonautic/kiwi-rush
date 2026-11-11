import { KIWIS, UPGRADES } from './Progress';
import type { KiwiId, Progress, UpgradeId } from './Progress';

export interface ShopCallbacks {
  /** Called after any purchase or equip, so the game can apply the new stats. */
  onChange(): void;
  onClose(): void;
  onBuy(): void;
}

type Tab = 'upgrades' | 'kiwis';

const coin = '<span class="coin"></span>';

/** DOM shop: spend banked coins on upgrades or on new kiwis. */
export class ShopUI {
  private root = document.getElementById('shop')!;
  private list = document.getElementById('shoplist')!;
  private bank = document.getElementById('shopbank')!;
  private tab: Tab = 'upgrades';

  constructor(private progress: Progress, private thumb: (id: KiwiId) => string, private cb: ShopCallbacks) {
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  /** Re-draws the panel (called whenever it opens or something changes). */
  render(): void {
    this.bank.textContent = String(this.progress.save.wallet);
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    this.list.innerHTML = this.tab === 'upgrades' ? this.upgradeCards() : this.kiwiCards();
  }

  private upgradeCards(): string {
    const p = this.progress;
    const cur = p.stats();
    return UPGRADES.map((u) => {
      const level = p.level(u.id);
      const cost = p.upgradeCost(u.id);
      const pips = u.costs.map((_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      const effect = cost === null ? `${u.show(cur)} (max)` : `${u.show(cur)} → <b>${u.show(p.statsWithNext(u.id))}</b>`;
      const button =
        cost === null
          ? '<button disabled>MAX</button>'
          : `<button data-act="upgrade" data-id="${u.id}" ${p.save.wallet < cost ? 'disabled' : ''}>${coin} ${cost}</button>`;
      return `<div class="card"><div class="info"><div class="name">${u.name}<span class="pips">${pips}</span></div><div class="desc">${u.desc}</div><div class="eff">${effect}</div></div>${button}</div>`;
    }).join('');
  }

  private kiwiCards(): string {
    const p = this.progress;
    return KIWIS.map((k) => {
      const owned = p.owns(k.id);
      const equipped = p.save.selected === k.id;
      let button: string;
      if (equipped) button = '<button disabled class="equipped">EQUIPPED</button>';
      else if (owned) button = `<button data-act="equip" data-id="${k.id}">EQUIP</button>`;
      else button = `<button data-act="buykiwi" data-id="${k.id}" ${p.save.wallet < k.price ? 'disabled' : ''}>${coin} ${k.price}</button>`;
      const perks = k.perks.map((t) => `<li>${t}</li>`).join('');
      return `<div class="card${equipped ? ' sel' : ''}"><img class="thumb" alt="${k.name}" src="${this.thumb(k.id)}" style="border-color:${equipped ? '#7dffd2' : k.accent}"><div class="info"><div class="name">${k.name}</div><div class="desc">${k.blurb}</div><ul class="perks">${perks}</ul></div>${button}</div>`;
    }).join('');
  }

  private onClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-tab],#shopclose');
    if (!target) return;
    const p = this.progress;

    if (target.id === 'shopclose') {
      this.cb.onClose();
      return;
    }
    if (target.dataset.tab) {
      this.tab = target.dataset.tab as Tab;
      this.render();
      return;
    }

    const id = target.dataset.id as string;
    let changed = false;
    switch (target.dataset.act) {
      case 'upgrade':
        changed = p.buyUpgrade(id as UpgradeId);
        if (changed) this.cb.onBuy();
        break;
      case 'buykiwi':
        changed = p.buyKiwi(id as KiwiId);
        if (changed) this.cb.onBuy();
        break;
      case 'equip':
        changed = p.select(id as KiwiId);
        break;
    }
    if (changed) {
      this.cb.onChange();
      this.render();
    }
  }
}
