import * as THREE from 'three';
import loadoutData from '../../shared/loadout.json';
import { SFX } from './sfx';
import type { SoldierRig } from './soldier';
import type { WeaponDef } from './weapon-defs';
import { PRIMARY_WEAPONS } from './weapon-defs';

export type { WeaponDef } from './weapon-defs';
export { PRIMARY_WEAPONS } from './weapon-defs';

export interface ReloadState {
  progress: number;
  duration: number;
  empty: boolean;
  rounds: number;
  phase: number;
  magOut: boolean;
  inserted: boolean;
  actionDone: boolean;
  active: boolean;
  soundLift: boolean;
  soundOut: boolean;
  soundIn: boolean;
  soundAction: boolean;
}

export interface CarriedWeapon {
  def: WeaponDef;
  mag: number;
  reserve: number;
  semi: boolean;
  spread: number;
  reloadState: ReloadState | null;
  pumpT: number;
  pumpEjected: boolean;
  boltT: number;
  boltPhase: number;
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
  burst: number;
  soldier: SoldierRig;
  strafeDir: number;
  engaged: boolean;
  reactionT: number;
  hitFlash: number;
  deathT: number;
  walkPhase: number;
  speed: number;
  flinch: number;
  aimPitch: number;
  combatBlend: number;
  gunDropped: boolean;
  gunVel: THREE.Vector3 | null;
  gunAV: THREE.Vector3 | null;
}

export interface ThrowableProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  kind: 'lethal' | 'tactical';
  life: number;
}

const RELOAD_STAGE: Record<string, { remove: number; insert: number; action: number }> = {
  m4: { remove: 0.055, insert: 0.7, action: 0.83 },
  ak12: { remove: 0.3, insert: 0.72, action: 0.91 },
  p9: { remove: 0.28, insert: 0.66, action: 0.9 },
  sr7: { remove: 0.34, insert: 0.86, action: 0.98 },
  p90: { remove: 0.31, insert: 0.72, action: 0.91 },
};

export class CampaignRules {
  slots: [CarriedWeapon | null, CarriedWeapon | null];
  activeSlot = 0;
  playerHealth = 100;
  tacticals = loadoutData.campaign.throwables.tactical.start;
  lethals = loadoutData.campaign.throwables.lethal.start;
  readonly maxThrowables = loadoutData.campaign.throwables.lethal.max;
  reloadT = 0;
  reloadDuration = 0;
  reloadEmpty = false;
  reloadRounds = 0;
  reloadPhase = 0;
  switchT = 0;
  switchTo = -1;
  holsterAt = 0.14;
  ads = false;
  adsK = 0;
  adsEase = 0;
  fireT = 0;
  triggerReleased = true;
  burstCount = 0;
  burstIdle = 0;

  constructor() {
    this.slots = [this.makeCarried(PRIMARY_WEAPONS.m4), this.makeCarried(PRIMARY_WEAPONS.ks12)];
  }

  private makeCarried(def: WeaponDef): CarriedWeapon {
    return {
      def,
      mag: def.magSize,
      reserve: def.reserve,
      semi: false,
      spread: def.spreadBase,
      reloadState: null,
      pumpT: 0,
      pumpEjected: false,
      boltT: 0,
      boltPhase: 0,
    };
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

  get switchTarget(): CarriedWeapon | null {
    return this.switchTo >= 0 ? this.slots[this.switchTo] : null;
  }

  update(dt: number, stanceRecovery = 1) {
    this.fireT = Math.max(0, this.fireT - dt);
    this.burstIdle += dt;
    if (this.burstIdle > 0.32) this.burstCount = 0;

    if (this.reloadT > 0) this.updateReload(dt);

    const w = this.activeWeapon;
    if (w) {
      if (w.pumpT > 0) {
        w.pumpT -= dt;
        if (w.pumpT <= 0) {
          w.pumpT = 0;
          SFX.pumpSound(false);
        }
      }
      if (w.boltT > 0) {
        w.boltT -= dt;
        if (w.boltT <= 0) w.boltT = 0;
      }
      w.spread = Math.max(w.def.spreadBase, w.spread - w.def.spreadRecover * dt * stanceRecovery);
    }

    if (this.switchT > 0) {
      this.switchT -= dt;
      if (this.switchT <= 0 && this.switchTo >= 0) {
        this.activeSlot = this.switchTo;
        this.switchTo = -1;
        this.switchT = 0;
        this.updateHud();
      }
    }

    const aimWant = this.ads && !this.reloading && !this.switching;
    const aimSpeed = 1 / (this.activeWeapon?.def.adsTime || 0.2);
    this.adsK = THREE.MathUtils.clamp(this.adsK + (aimWant ? aimSpeed : -aimSpeed) * dt, 0, 1);
    const k = this.adsK;
    this.adsEase = k * k * (3 - 2 * k);
  }

  switchSlot(index: number) {
    const target = this.slots[index];
    if (index === this.activeSlot || !target || this.switching) {
      this.updateHud();
      return;
    }
    if (this.reloading) this.interruptReload();
    const current = this.activeWeapon;
    if (current) current.boltT = 0;
    this.ads = false;
    this.switchTo = index;
    this.holsterAt = 0.14;
    this.switchT = target.def.drawTime + this.holsterAt;
    this.updateHud();
    SFX.weaponSwap();
  }

  pickupWeapon(id: string): WeaponDef | null {
    const def = PRIMARY_WEAPONS[id];
    if (!def) return null;
    const old = this.slots[this.activeSlot]?.def || null;
    this.slots[this.activeSlot] = this.makeCarried(def);
    this.reloadT = 0;
    this.reloadDuration = 0;
    this.reloadEmpty = false;
    this.reloadRounds = 0;
    this.reloadPhase = 0;
    this.fireT = Math.max(this.fireT, 0.35);
    this.updateHud();
    return old;
  }

  tryFire(triggerReleased = true): boolean {
    const w = this.activeWeapon;
    if (!w) return false;
    if (this.fireT > 0 || this.reloading || this.switching || w.pumpT > 0 || w.boltT > 0)
      return false;
    if (!w.def.auto && !triggerReleased) return false;
    this.interruptShotgunReloadForFire(w);
    if (this.reloadBlocksFire(w)) return false;

    if (w.mag <= 0) {
      if (triggerReleased) {
        SFX.dryFire();
        this.triggerReleased = false;
      }
      if (w.reserve > 0 && !this.reloading) this.startReload();
      return true;
    }

    w.mag--;
    this.discardReloadCheckpoint(w);
    this.fireT = 60 / w.def.rpm;
    this.burstCount++;
    this.burstIdle = 0;
    this.triggerReleased = false;
    w.spread = Math.min(w.def.spreadMax, w.spread + w.def.spreadShot);

    if (w.def.id === 'ks12') {
      w.pumpT = w.def.pumpTime || 0.62;
      w.pumpEjected = false;
      SFX.pumpSound(true);
    } else if (w.def.id === 'sr7') {
      w.boltT = w.def.boltTime || 1.5;
      w.boltPhase = 0;
      SFX.boltCycle(0);
    } else if (w.mag === 0) {
      this.startReload();
    }

    this.updateHud();
    return true;
  }

  /** Smoke/script compatibility wrapper for a deliberate trigger press. */
  shoot(): boolean {
    return this.tryFire(true);
  }

  startReload() {
    const w = this.activeWeapon;
    if (
      !w ||
      w.mag >= w.def.magSize ||
      w.reserve <= 0 ||
      this.reloading ||
      this.switching ||
      w.pumpT > 0 ||
      w.boltT > 0
    )
      return;
    this.ads = false;
    if (w.reloadState) {
      this.restoreReload(w.reloadState);
      return;
    }
    const empty = w.mag <= 0;
    const capacity = w.def.id === 'ks12' ? w.def.magSize : w.def.magSize + (empty ? 0 : 1);
    const rounds = Math.min(capacity - w.mag, w.reserve);
    const duration =
      w.def.id === 'ks12'
        ? 0.46 + rounds * 0.42 + (empty ? 0.18 : 0)
        : empty
          ? w.def.reloadTime
          : w.def.tacticalReloadTime;
    w.reloadState = {
      progress: 0,
      duration,
      empty,
      rounds,
      phase: 0,
      magOut: false,
      inserted: false,
      actionDone: false,
      active: true,
      soundLift: true,
      soundOut: false,
      soundIn: false,
      soundAction: false,
    };
    this.reloadDuration = duration;
    this.reloadT = Math.max(0.001, duration);
    this.reloadEmpty = empty;
    this.reloadRounds = rounds;
    this.reloadPhase = 0;
    this.updateHud();
    SFX.reloadStage(w.def.id, 'lift');
  }

  private restoreReload(state: ReloadState) {
    const w = this.activeWeapon;
    if (!w) return;
    w.reloadState = state;
    this.reloadDuration = state.duration;
    this.reloadT = Math.max(0.001, state.duration * (1 - state.progress));
    this.reloadEmpty = state.empty;
    this.reloadRounds = state.rounds;
    this.reloadPhase = state.phase;
    state.active = true;
    this.updateHud();
  }

  private interruptReload() {
    if (this.reloadT <= 0) return;
    const w = this.activeWeapon;
    const state = w?.reloadState;
    if (state) {
      state.progress = Math.max(
        state.progress,
        THREE.MathUtils.clamp(1 - this.reloadT / this.reloadDuration, 0, 0.999)
      );
      state.phase = this.reloadPhase;
      state.active = false;
    }
    this.reloadT = 0;
    this.reloadDuration = 0;
    this.reloadEmpty = false;
    this.reloadRounds = 0;
    this.reloadPhase = 0;
  }

  private seatMagazine(w: CarriedWeapon, state: ReloadState) {
    if (state.inserted) return;
    const capacity = w.def.id === 'ks12' ? w.def.magSize : w.def.magSize + (state.empty ? 0 : 1);
    const take = Math.min(Math.max(0, capacity - w.mag), w.reserve);
    w.mag += take;
    w.reserve -= take;
    state.inserted = true;
    if (!state.soundIn) {
      state.soundIn = true;
      SFX.reloadStage(w.def.id, 'in');
    }
    this.updateHud();
  }

  private loadShotgunRounds(w: CarriedWeapon, state: ReloadState, desiredPhase: number) {
    while (state.phase < desiredPhase && state.phase < state.rounds && w.reserve > 0) {
      if (w.mag >= w.def.magSize) break;
      w.mag++;
      w.reserve--;
      state.phase++;
      this.reloadPhase = state.phase;
      SFX.reloadStage('ks12', 'in');
    }
    this.updateHud();
  }

  private finishReload() {
    const w = this.activeWeapon;
    const state = w?.reloadState;
    if (state) {
      if (w) {
        if (w.def.id === 'ks12') this.loadShotgunRounds(w, state, state.rounds);
        else this.seatMagazine(w, state);
      }
      state.actionDone = true;
      if (w) w.reloadState = null;
    }
    this.reloadT = 0;
    this.reloadDuration = 0;
    this.reloadEmpty = false;
    this.reloadRounds = 0;
    this.reloadPhase = 0;
    if (w) w.spread = w.def.spreadBase;
    this.updateHud();
  }

  private updateReload(dt: number) {
    const w = this.activeWeapon;
    const state = w?.reloadState;
    if (!w || !state) {
      this.reloadT = 0;
      return;
    }
    this.reloadT = Math.max(0, this.reloadT - dt);
    state.progress = THREE.MathUtils.clamp(1 - this.reloadT / state.duration, 0, 1);
    if (w.def.id === 'ks12') {
      const elapsed = state.progress * state.duration;
      const desired = THREE.MathUtils.clamp(
        Math.floor((elapsed - 0.2) / 0.42) + 1,
        0,
        state.rounds
      );
      this.loadShotgunRounds(w, state, desired);
      if (state.empty && elapsed >= 0.2 + state.rounds * 0.42 && !state.soundAction) {
        state.soundAction = true;
        SFX.reloadStage('ks12', 'action');
      }
    } else {
      const marks = RELOAD_STAGE[w.def.id] || { remove: 0.32, insert: 0.68, action: 0.9 };
      if (state.progress >= marks.remove) {
        state.magOut = true;
        if (!state.soundOut) {
          state.soundOut = true;
          SFX.reloadStage(w.def.id, 'out');
        }
      }
      if (state.progress >= marks.insert) this.seatMagazine(w, state);
      if (state.progress >= marks.action && !state.actionDone) {
        state.actionDone = true;
        if (state.empty && !state.soundAction) {
          state.soundAction = true;
          SFX.reloadStage(w.def.id, 'action');
        }
      }
    }
    if (this.reloadT <= 0) this.finishReload();
  }

  private reloadBlocksFire(w: CarriedWeapon): boolean {
    const state = w.reloadState;
    if (!state || state.active || w.def.id === 'ks12') return false;
    const mechanicallyOpen = !state.inserted || (state.empty && !state.actionDone);
    if (mechanicallyOpen) this.startReload();
    return mechanicallyOpen;
  }

  private interruptShotgunReloadForFire(w: CarriedWeapon): boolean {
    if (w.def.id !== 'ks12' || this.reloadT <= 0 || w.mag <= 0) return false;
    this.interruptReload();
    w.reloadState = null;
    return true;
  }

  private discardReloadCheckpoint(w: CarriedWeapon) {
    if (w.reloadState?.active) return;
    w.reloadState = null;
  }

  /** Shift-sprint cancels a reload exactly like the single-player input. */
  cancelReload() {
    this.interruptReload();
  }

  toggleAim() {
    this.ads = !this.ads;
  }

  addAmmo(amount: number, throwables = true) {
    for (const slot of this.slots) {
      if (slot) slot.reserve = Math.min(slot.reserve + amount, slot.def.maxReserve);
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
