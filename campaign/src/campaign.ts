import type * as THREE from 'three';
import {
  addThrowables,
  applyAttachmentMods,
  beginMeleeClock,
  campaignStartAttachments,
  canStartMelee,
  canThrow,
  consumeThrow,
  createThrowInventory,
  discardReloadCheckpoint,
  type EnemyKind,
  type EnemyTactic,
  type FlyingThrow,
  fireInterval,
  interactGroundWeapon,
  interruptReload,
  interruptShotgunReloadForFire,
  type ReloadStageName,
  type ReloadState,
  reloadBlocksFire,
  startReload,
  type ThrowableKind,
  type ThrowInventory,
  tryConsumeShot,
  updateReload,
} from '../../shared/gameplay';
import { SFX } from './sfx';
import type { SoldierRig } from './soldier';
import type { WeaponDef } from './weapon-defs';
import { PRIMARY_WEAPONS } from './weapon-defs';
import { fireView, reloadView } from './weapon-runtime';

export type { WeaponDef } from './weapon-defs';
export { PRIMARY_WEAPONS } from './weapon-defs';
export type { ReloadState };

export interface CarriedWeapon {
  def: WeaponDef;
  attachments: Record<string, string>;
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
  kind: 'weapon' | 'ammo' | 'lootWeapon' | 'ammoDrop';
  weaponId?: string;
  label: string;
  coolUntil: number;
  bobT: number;
  /** 0 = permanent. Enemy drops expire after a few seconds. */
  expiresAt: number;
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
  suspicion: number;
  lookScan: number;
  patrolScale: number;
  reactionT: number;
  lastSeenT: number;
  lastSeenX: number;
  lastSeenZ: number;
  stuckT: number;
  stuckX: number;
  stuckZ: number;
  hitFlash: number;
  tagRevealT: number;
  deathT: number;
  walkPhase: number;
  speed: number;
  flinch: number;
  aimPitch: number;
  combatBlend: number;
  gunDropped: boolean;
  gunVel: THREE.Vector3 | null;
  gunAV: THREE.Vector3 | null;
  tactic: EnemyTactic;
  tacticT: number;
  idleRole?: 'eat' | 'camp' | 'lean' | 'patrol';
  reloadT: number;
  rounds: number;
  kind: EnemyKind;
  engage: number;
  strafeT: number;
  suppress: number;
  hasCover: boolean;
  coverX: number;
  coverZ: number;
}

export interface ThrowableProjectile {
  mesh: THREE.Mesh;
  kind: ThrowableKind;
  body: FlyingThrow;
}

export class CampaignRules {
  slots: [CarriedWeapon | null, CarriedWeapon | null];
  activeSlot = 0;
  playerHealth = 100;
  throws: ThrowInventory = createThrowInventory();
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
  lastHurt = 0;
  meleeT = 0;

  constructor() {
    this.slots = [this.makeCarried(PRIMARY_WEAPONS.m4), this.makeCarried(PRIMARY_WEAPONS.p9)];
  }

  private makeCarried(def: WeaponDef): CarriedWeapon {
    const attachments = campaignStartAttachments(def.id);
    const tuned = applyAttachmentMods({ ...def }, attachments);
    return {
      def: tuned,
      attachments,
      mag: tuned.magSize,
      reserve: tuned.reserve,
      semi: false,
      spread: tuned.spreadBase,
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
    if (this.meleeT > 0) this.meleeT = Math.max(0, this.meleeT - dt);
    this.burstIdle += dt;
    if (this.burstIdle > 0.32) this.burstCount = 0;

    const w = this.activeWeapon;
    if (this.reloadT > 0 && w) this.tickReload(dt, w);
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

    if (
      this.playerHealth < 100 &&
      this.playerHealth > 0 &&
      performance.now() - this.lastHurt > 4500
    ) {
      this.playerHealth = Math.min(100, this.playerHealth + 26 * dt);
    }
  }

  switchSlot(index: number) {
    const target = this.slots[index];
    if (index === this.activeSlot || !target || this.switching || this.meleeT > 0) {
      this.updateHud();
      return;
    }
    if (this.reloading) {
      const cur = this.activeWeapon;
      interruptReload(cur ? reloadView(cur) : null, this);
    }
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
    const current = this.slots[this.activeSlot]?.def || null;
    const swap = interactGroundWeapon(id, current?.id || null);
    const take = PRIMARY_WEAPONS[swap.take];
    if (!take) return null;
    this.slots[this.activeSlot] = this.makeCarried(take);
    this.reloadT = 0;
    this.reloadDuration = 0;
    this.reloadEmpty = false;
    this.reloadRounds = 0;
    this.reloadPhase = 0;
    this.fireT = Math.max(this.fireT, 0.35);
    this.updateHud();
    return swap.leave ? PRIMARY_WEAPONS[swap.leave] || current : null;
  }

  tryFire(triggerReleased = true): boolean {
    const w = this.activeWeapon;
    if (!w) return false;
    const busy = this.fireT > 0 || this.switching || this.meleeT > 0 || w.pumpT > 0 || w.boltT > 0;
    interruptShotgunReloadForFire(reloadView(w), this);
    if (reloadBlocksFire(reloadView(w), this, busy, this.reloadHooks())) return false;
    const result = tryConsumeShot(fireView(w), triggerReleased, busy || this.reloading);
    if (result.kind === 'blocked') return false;
    if (result.kind === 'dry') {
      if (triggerReleased) {
        SFX.dryFire();
        this.triggerReleased = false;
      }
      return true;
    }
    if (result.kind === 'reload') {
      if (triggerReleased) {
        SFX.dryFire();
        this.triggerReleased = false;
      }
      this.beginReload();
      return true;
    }
    discardReloadCheckpoint(reloadView(w));
    this.fireT = fireInterval(w.def.rpm);
    this.burstCount++;
    this.burstIdle = 0;
    this.triggerReleased = false;
    if (result.pump) {
      w.pumpT = w.def.pumpTime || 0.62;
      w.pumpEjected = false;
      SFX.pumpSound(true);
    } else if (result.bolt) {
      w.boltT = w.def.boltTime || 1.5;
      w.boltPhase = 0;
      SFX.boltCycle(0);
    } else if (result.emptyAutoReload) {
      this.beginReload();
    }
    this.updateHud();
    return true;
  }

  shoot(): boolean {
    return this.tryFire(true);
  }

  startReload() {
    this.beginReload();
  }

  startMelee(): boolean {
    if (
      !canStartMelee({
        meleeT: this.meleeT,
        switching: this.switching,
      })
    )
      return false;
    const clock = beginMeleeClock();
    this.meleeT = clock.meleeT;
    this.fireT = Math.max(this.fireT, clock.fireLock);
    this.ads = false;
    this.triggerReleased = false;
    const w = this.activeWeapon;
    interruptReload(w ? reloadView(w) : null, this);
    return true;
  }

  private beginReload() {
    const w = this.activeWeapon;
    if (!w) return;
    const busy = this.switching || w.pumpT > 0 || w.boltT > 0;
    if (startReload(reloadView(w), this, busy, this.reloadHooks())) this.ads = false;
  }

  private tickReload(dt: number, w: CarriedWeapon) {
    const before = this.reloadT;
    updateReload(dt, reloadView(w), this, this.reloadHooks());
    if (before > 0 && this.reloadT <= 0) w.spread = w.def.spreadBase;
  }

  private reloadHooks() {
    return {
      onHud: () => this.updateHud(),
      onSound: (family: string, stage: ReloadStageName) => SFX.reloadStage(family, stage),
    };
  }

  cancelReload() {
    const w = this.activeWeapon;
    interruptReload(w ? reloadView(w) : null, this);
  }

  addAmmo(amount: number, throwables = true) {
    for (const slot of this.slots) {
      if (slot) slot.reserve = Math.min(slot.reserve + amount, slot.def.maxReserve);
    }
    if (throwables) addThrowables(this.throws);
    this.updateHud();
  }

  canThrow(kind: ThrowableKind): boolean {
    return canThrow(this.throws, kind);
  }

  useThrowable(kind: ThrowableKind): boolean {
    if (!consumeThrow(this.throws, kind)) return false;
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
      tac.textContent = `Q 闪光 ×${this.throws.tacticals}`;
      tac.classList.toggle('empty', this.throws.tacticals === 0);
    }
    if (lethal) {
      lethal.textContent = `G 手雷 ×${this.throws.lethals}`;
      lethal.classList.toggle('empty', this.throws.lethals === 0);
    }
  }
}
