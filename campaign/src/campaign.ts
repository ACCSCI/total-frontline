import * as THREE from 'three';
import loadoutData from '../../shared/loadout.json';
import weaponsData from '../../shared/weapons.json';
import { SFX } from './sfx';
import type { SoldierRig } from './soldier';

export interface WeaponDef {
  id: string;
  name: string;
  magSize: number;
  reserve: number;
  maxReserve: number;
  damage: number;
  baseDamage: number;
  pellets: number;
  rpm: number;
  auto: boolean;
  adsFov: number;
  adsTime: number;
  reloadTime: number;
  spreadBase: number;
}

const rawWeapons = weaponsData.weapons as Record<
  string,
  {
    id: string;
    name: string;
    magSize: number;
    reserve: number;
    maxReserve: number;
    damage: number;
    pellets: number;
    rpm: number;
    auto: boolean;
    campaignReserve?: number;
    adsFov?: number;
    adsTime?: number;
    reloadTime?: number;
    spreadBase?: number;
  }
>;

export const PRIMARY_WEAPONS: Record<string, WeaponDef> = {};
for (const [id, w] of Object.entries(rawWeapons)) {
  PRIMARY_WEAPONS[id] = {
    id,
    name: w.name,
    magSize: w.magSize,
    reserve: w.campaignReserve ?? w.reserve,
    maxReserve: w.maxReserve,
    damage: w.damage * w.pellets,
    baseDamage: w.damage,
    pellets: w.pellets,
    rpm: w.rpm,
    auto: w.auto,
    adsFov: w.adsFov ?? 50,
    adsTime: w.adsTime ?? 0.2,
    reloadTime: w.reloadTime ?? 1.3,
    spreadBase: w.spreadBase ?? 0.0018,
  };
}

interface CarriedWeapon {
  def: WeaponDef;
  mag: number;
  reserve: number;
}

export interface Pickup {
  root: THREE.Group;
  kind: 'weapon' | 'ammo' | 'lootWeapon';
  weaponId?: string;
  label: string;
  coolUntil: number;
  bobT: number;
}

export interface Enemy {
  root: THREE.Group;
  alive: boolean;
  health: number;
  phase: number;
  baseX: number;
  baseZ: number;
  patrolT: number;
  fireT: number;
  soldier: SoldierRig;
  strafeDir: number;
  engaged: boolean;
  reactionT: number;
  hitFlash: number;
  deathT: number;
}

export interface ThrowableProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  kind: 'lethal' | 'tactical';
  life: number;
}

export class CampaignRules {
  slots: [CarriedWeapon | null, CarriedWeapon | null];
  activeSlot = 0;
  playerHealth = 100;
  tacticals = loadoutData.campaign.throwables.tactical.start;
  lethals = loadoutData.campaign.throwables.lethal.start;
  readonly maxThrowables = loadoutData.campaign.throwables.lethal.max;
  reloadT = 0;
  reloadDuration = 0;
  switchT = 0;
  switchTo = -1;
  ads = false;
  adsEase = 0;
  fireT = 0;

  constructor() {
    const m4 = PRIMARY_WEAPONS.m4;
    const ks12 = PRIMARY_WEAPONS.ks12;
    this.slots = [
      { def: m4, mag: m4.magSize, reserve: m4.reserve },
      { def: ks12, mag: ks12.magSize, reserve: ks12.reserve },
    ];
  }

  get primary(): CarriedWeapon | null {
    return this.slots[this.activeSlot];
  }

  get activeWeapon(): CarriedWeapon | null {
    return this.primary;
  }

  get switching(): boolean {
    return this.switchT > 0;
  }

  get reloading(): boolean {
    return this.reloadT > 0;
  }

  get canFire(): boolean {
    const w = this.activeWeapon;
    return !!w && w.mag > 0 && this.fireT <= 0 && this.reloadT <= 0 && this.switchT <= 0;
  }

  update(dt: number) {
    this.fireT = Math.max(0, this.fireT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        this.applyReload();
      }
    }
    if (this.switchT > 0) {
      this.switchT -= dt;
      if (this.switchT <= 0 && this.switchTo >= 0) {
        this.activeSlot = this.switchTo;
        this.switchTo = -1;
        this.updateHud();
        SFX.weaponSwap();
      }
    }
    const aimWant = this.ads && !this.reloading && !this.switching;
    const aimSpeed = 1 / (this.activeWeapon?.def.adsTime || 0.2);
    this.adsEase = THREE.MathUtils.clamp(
      this.adsEase + (aimWant ? aimSpeed : -aimSpeed) * dt,
      0,
      1
    );
  }

  switchSlot(index: number) {
    if (index === this.activeSlot || !this.slots[index] || this.switching || this.reloading) {
      this.updateHud();
      return;
    }
    this.switchTo = index;
    this.switchT = 0.28;
    this.ads = false;
    this.updateHud();
  }

  pickupWeapon(id: string): WeaponDef | null {
    const def = PRIMARY_WEAPONS[id];
    if (!def) return null;
    const old = this.slots[this.activeSlot]?.def || null;
    this.slots[this.activeSlot] = { def, mag: def.magSize, reserve: def.reserve };
    this.reloadT = 0;
    this.reloadDuration = 0;
    this.fireT = Math.max(this.fireT, 0.35);
    this.updateHud();
    return old;
  }

  shoot(): boolean {
    if (!this.canFire) return false;
    const w = this.activeWeapon;
    if (!w) return false;
    w.mag--;
    this.fireT = 60 / w.def.rpm;
    this.updateHud();
    if (w.mag === 0 && w.reserve <= 0) SFX.lineConfirm();
    return true;
  }

  startReload() {
    const w = this.activeWeapon;
    if (!w || w.mag === w.def.magSize || w.reserve <= 0 || this.reloading || this.switching) return;
    this.reloadDuration = w.def.reloadTime;
    this.reloadT = this.reloadDuration;
    this.ads = false;
    this.updateHud();
    SFX.reload();
  }

  private applyReload() {
    const w = this.activeWeapon;
    if (!w) return;
    const need = w.def.magSize - w.mag;
    const take = Math.min(need, w.reserve);
    w.mag += take;
    w.reserve -= take;
    this.updateHud();
  }

  toggleAim() {
    this.ads = !this.ads;
  }

  addAmmo(amount: number, throwables = true) {
    for (const slot of this.slots) {
      if (slot) slot.reserve = Math.min(slot.reserve + amount, slot.def.magSize * 6);
    }
    if (throwables) {
      this.tacticals = Math.min(this.maxThrowables, this.tacticals + 1);
      this.lethals = Math.min(this.maxThrowables, this.lethals + 1);
    }
    this.updateHud();
  }

  canThrow(kind: 'lethal' | 'tactical'): boolean {
    return kind === 'lethal' ? this.lethals > 0 : this.tacticals > 0;
  }

  useThrowable(kind: 'lethal' | 'tactical'): boolean {
    if (!this.canThrow(kind)) return false;
    if (kind === 'lethal') this.lethals--;
    else this.tacticals--;
    this.updateHud();
    return true;
  }

  updateHud() {
    const slotA = document.getElementById('p0SlotA') as HTMLDivElement;
    const slotB = document.getElementById('p0SlotB') as HTMLDivElement;
    if (slotA) {
      const w = this.slots[0];
      slotA.innerHTML = w ? `<b>1</b> ${w.def.name}` : '<b>1</b> 空';
      slotA.classList.toggle('active', this.activeSlot === 0);
    }
    if (slotB) {
      const w = this.slots[1];
      slotB.innerHTML = w ? `<b>2</b> ${w.def.name}` : '<b>2</b> 空';
      slotB.classList.toggle('active', this.activeSlot === 1);
    }
    const w = this.activeWeapon;
    const ammo = document.getElementById('p0Ammo') as HTMLDivElement;
    if (ammo) {
      if (this.reloading) ammo.textContent = '换弹中…';
      else ammo.textContent = w ? `${w.mag} / ${w.reserve}` : '— / —';
    }
    const tac = document.getElementById('p0Tac') as HTMLDivElement;
    const lethal = document.getElementById('p0Lethal') as HTMLDivElement;
    if (tac) {
      tac.textContent = `Q 闪光 ×${this.tacticals}`;
      tac.classList.toggle('empty', this.tacticals === 0);
    }
    if (lethal) {
      lethal.textContent = `G 手雷 ×${this.lethals}`;
      lethal.classList.toggle('empty', this.lethals === 0);
    }
  }
}
