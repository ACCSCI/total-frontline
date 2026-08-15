import * as THREE from 'three';
import type { CampaignRules } from './campaign';
import { easeInOutCubic, easeOutCubic } from './easing';
import {
  buildModernAK,
  buildP90,
  buildRifle,
  buildShotgun,
  buildSniper,
} from './generated-viewmodels';
import type { FirstPersonPlayer } from './player';
import { poseReloadHand } from './viewmodel-pose';

interface BuiltRig {
  group: THREE.Group;
  weaponPivot?: THREE.Group;
  mag?: THREE.Object3D;
  newMag?: THREE.Object3D;
  reloadSlap?: THREE.Object3D;
  rightGrip?: THREE.Object3D;
  leftHand?: THREE.Object3D;
  rightHand?: THREE.Object3D;
  forend?: THREE.Object3D;
  reloadShell?: THREE.Object3D;
  bolt?: THREE.Object3D;
  knob?: THREE.Object3D;
  chargeHandle?: THREE.Object3D;
  muzzle?: THREE.Object3D;
  basePos?: THREE.Vector3;
  baseRot?: THREE.Vector3;
  adsPos?: THREE.Vector3;
  adsRot?: THREE.Vector3;
  adsRef?: number;
}

const BUILDERS: Record<string, () => BuiltRig> = {
  m4: buildRifle as never,
  ks12: buildShotgun as never,
  ak12: buildModernAK as never,
  sr7: buildSniper as never,
  p90: buildP90 as never,
};

const FALLBACK_POS = new THREE.Vector3(0.24, -0.26, -0.62);
const FALLBACK_ROT = new THREE.Vector3(0, 0, -0.06);
const VM_SCALE = 0.86;
const VM_FOV = 41.9;
const VM_ADS_DOLLY = 0.58;

interface PoseSnap {
  object: THREE.Object3D;
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

export class ViewmodelRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  private rules: CampaignRules;
  private model: THREE.Group | null = null;
  private rig: BuiltRig | null = null;
  private lastId = '';
  private bobT = 0;
  private pos = new THREE.Vector3();
  private rot = new THREE.Vector3();
  private hipPos = new THREE.Vector3();
  private hipRot = new THREE.Vector3();
  private aimPos = new THREE.Vector3();
  private aimRot = new THREE.Vector3();
  private snaps = new Map<THREE.Object3D, PoseSnap>();
  private vmRec = {
    px: 0,
    py: 0,
    pz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    vrx: 0,
    vry: 0,
    vrz: 0,
  };

  constructor(rules: CampaignRules) {
    this.rules = rules;
    this.camera = new THREE.PerspectiveCamera(VM_FOV, innerWidth / innerHeight, 0.008, 12);
    this.scene.add(new THREE.AmbientLight(0x9b9a96, 0.4));
    const key = new THREE.DirectionalLight(0xffeed6, 1.52);
    key.position.set(-0.6, 1.1, 0.9);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x7f8894, 0.38);
    fill.position.set(1.0, -0.3, 0.4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe2e4e6, 0.42);
    rim.position.set(0.2, 0.4, -1.0);
    this.scene.add(rim);
    this.root.scale.setScalar(VM_SCALE);
    this.scene.add(this.root);
  }

  update(dt: number, player: FirstPersonPlayer) {
    const id = this.rules.activeWeapon?.def.id || '';
    if (id !== this.lastId) this.swapModel(id);

    const w = this.rules.activeWeapon;
    const rig = this.rig;
    const basePos = rig?.basePos || FALLBACK_POS;
    const baseRot = rig?.baseRot || FALLBACK_ROT;
    const adsPos = rig?.adsPos || basePos;
    const adsRot = rig?.adsRot || FALLBACK_ROT;
    const speed = player.horizontalSpeed;
    const moving = speed > 0.6 && player.grounded;
    const sprintK = player.input.sprint && speed > 4.5 ? 1 : 0;
    this.bobT += dt * (moving ? speed * 1.35 : 0);
    const bobAmp = THREE.MathUtils.clamp(speed / 4.9, 0, 1.5);
    const bobY = Math.sin(this.bobT * 2) * 0.014 * bobAmp;
    const bobX = Math.sin(this.bobT) * 0.018 * bobAmp;
    const breathe = Math.sin(performance.now() * 0.0011) * 0.002;
    const swayX = Math.sin(performance.now() * 0.0009 + player.yaw) * 0.006;
    const swayY = Math.cos(performance.now() * 0.0007 + player.pitch) * 0.005;
    const stanceDrop = player.prone ? 0.105 : player.crouch ? 0.06 : 0;

    let px = basePos.x + bobX + swayX;
    let py = basePos.y + bobY + swayY - stanceDrop - sprintK * 0.208;
    let pz = basePos.z + breathe + sprintK * 0.275;
    let rx = baseRot.x + bobX * 0.35 + breathe + sprintK * 0.86;
    let ry = baseRot.y + swayX * 0.4 + sprintK * 0.46;
    let rz = baseRot.z + bobY * 0.6 - sprintK * 0.5;
    if (player.crouch) {
      px -= 0.018;
      py += 0.012;
      pz += 0.02;
    }
    if (!player.grounded) {
      py -= THREE.MathUtils.clamp(player.verticalSpeed * 0.006, -0.05, 0.05);
      rx += THREE.MathUtils.clamp(player.verticalSpeed * 0.01, -0.09, 0.09);
    }

    this.resetRigPose(rig);
    if (rig?.forend && w) {
      let slide = 0;
      if (w.pumpT > 0) {
        const t = 1 - w.pumpT / (w.def.pumpTime || 0.62);
        slide = t < 0.45 ? easeOutCubic(t / 0.45) : 1 - easeOutCubic((t - 0.45) / 0.55);
      }
      rig.forend.position.z += slide * 0.105;
      pz += slide * 0.028;
      rx -= slide * 0.05;
    }
    if (rig?.bolt && w) {
      let back = 0;
      let lift = 0;
      if (w.boltT > 0) {
        const t = 1 - w.boltT / (w.def.boltTime || 1.5);
        lift =
          t < 0.14 ? easeOutCubic(t / 0.14) : t > 0.74 ? 1 - easeOutCubic((t - 0.74) / 0.26) : 1;
        back =
          t < 0.14
            ? 0
            : t < 0.4
              ? easeOutCubic((t - 0.14) / 0.26)
              : t < 0.56
                ? 1
                : t < 0.74
                  ? 1 - easeInOutCubic((t - 0.56) / 0.18)
                  : 0;
      }
      rig.bolt.position.z += back * 0.125;
      rig.bolt.rotation.z += lift * 1.2;
      px -= back * 0.012;
      pz += back * 0.022;
      ry -= lift * 0.055;
      rz -= lift * 0.035;
      if (w.boltT > 0 && rig.knob && rig.rightHand) {
        const t = 1 - w.boltT / (w.def.boltTime || 1.5);
        this.poseHand(
          rig,
          rig.knob,
          new THREE.Vector3(0.035, -0.005, 0.015),
          new THREE.Euler(0.08, -0.12, -0.42),
          Math.sin(Math.PI * THREE.MathUtils.clamp(t / 0.9, 0, 1)),
          rig.rightHand,
          false
        );
      }
    }
    if (this.rules.switching) {
      const target = this.rules.switchTarget;
      const draw = target?.def.drawTime || 0.35;
      const total = draw + 0.14;
      const k =
        this.rules.switchT > draw
          ? 1 - (this.rules.switchT - draw) / 0.14
          : this.rules.switchT / draw;
      const e = easeOutCubic(THREE.MathUtils.clamp(k, 0, 1));
      py -= e * 0.4;
      pz += e * 0.1;
      rx += e * 1.05;
      rz += e * 0.45;
    }

    this.hipPos.set(px, py, pz);
    this.hipRot.set(rx, ry, rz);
    if (this.rules.reloading && rig && w) this.applyReloadPose(rig, w.def.id, dt);
    this.aimPos.set(
      adsPos.x + swayX * 0.25,
      adsPos.y + swayY * 0.25 - stanceDrop * 0.75,
      adsPos.z + breathe * 0.5
    );
    this.aimRot.set(adsRot.x + swayX * 0.15, adsRot.y + swayY * 0.12, adsRot.z);
    const ae = this.rules.adsEase;
    this.pos.lerpVectors(this.hipPos, this.aimPos, ae);
    this.rot.lerpVectors(this.hipRot, this.aimRot, ae);

    this.updateRecoil(dt);
    this.pos.x += this.vmRec.px;
    this.pos.y += this.vmRec.py;
    this.pos.z += this.vmRec.pz;
    this.rot.x += this.vmRec.rx;
    this.rot.y += this.vmRec.ry;
    this.rot.z += this.vmRec.rz;

    this.root.position.copy(this.pos);
    this.root.rotation.set(this.rot.x, this.rot.y, this.rot.z);
    this.updateAdsCamera(ae, rig?.adsRef || 0.68);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  punch() {
    const def = this.rules.activeWeapon?.def;
    const scale = def ? (def.recoilKick || 0.04) * 46 : 1.8;
    this.vmRec.vz += scale;
    this.vmRec.vy += scale * 0.28;
    this.vmRec.vrx += (def?.recoilRot || 0.06) * 46;
    this.vmRec.vry += (Math.random() - 0.5) * (def?.recoilRot || 0.06) * 24;
    this.vmRec.vrz += (Math.random() - 0.5) * (def?.recoilRot || 0.06) * 30;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** World-space muzzle transform, updated by the last `update()` call. */
  getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 | null {
    if (!this.rig?.muzzle) return null;
    this.rig.muzzle.getWorldPosition(out);
    return out;
  }

  private swapModel(id: string) {
    this.lastId = id;
    if (this.model) this.root.remove(this.model);
    this.snaps.clear();
    const builder = BUILDERS[id];
    if (!builder) {
      this.model = null;
      this.rig = null;
      return;
    }
    const built = builder();
    this.model = built.group;
    this.rig = built;
    this.root.add(built.group);
    this.vmRec = {
      px: 0,
      py: 0,
      pz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
    };
    for (const key of [
      'weaponPivot',
      'mag',
      'newMag',
      'reloadSlap',
      'rightGrip',
      'leftHand',
      'rightHand',
      'forend',
      'reloadShell',
      'bolt',
      'knob',
      'chargeHandle',
      'muzzle',
    ] as const) {
      const obj = built[key];
      if (obj)
        this.snaps.set(obj, { object: obj, pos: obj.position.clone(), rot: obj.rotation.clone() });
    }
  }

  private resetRigPose(rig: BuiltRig | null) {
    for (const snap of this.snaps.values()) {
      snap.object.position.copy(snap.pos);
      snap.object.rotation.copy(snap.rot);
      snap.object.visible = true;
    }
    if (rig?.newMag) rig.newMag.visible = false;
    if (rig?.reloadShell) rig.reloadShell.visible = false;
  }

  private applyReloadPose(rig: BuiltRig, id: string, dt: number) {
    void dt;
    const total = Math.max(0.001, this.rules.reloadDuration);
    const t = THREE.MathUtils.clamp(1 - this.rules.reloadT / total, 0, 1);
    const dip =
      t < 0.22 ? easeOutCubic(t / 0.22) : t < 0.72 ? 1 : 1 - easeInOutCubic((t - 0.72) / 0.28);

    if (id === 'm4') {
      const present =
        easeOutCubic(THREE.MathUtils.clamp(t / 0.12, 0, 1)) *
        (1 - easeInOutCubic(THREE.MathUtils.clamp((t - 0.86) / 0.14, 0, 1)));
      const flick = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.035) / 0.13, 0, 1));
      this.hipPos.x = THREE.MathUtils.lerp(this.hipPos.x, 0.015, present) - flick * 0.065;
      this.hipPos.y += present * 0.12;
      this.hipPos.z -= present * 0.11;
      this.hipRot.x = THREE.MathUtils.lerp(this.hipRot.x, 0.04, present);
      this.hipRot.y = THREE.MathUtils.lerp(this.hipRot.y, 0.1, present);
      this.hipRot.z = THREE.MathUtils.lerp(this.hipRot.z, 0.02, present);
      if (rig.weaponPivot) {
        rig.weaponPivot.rotation.y += present * 0.55;
        rig.weaponPivot.rotation.z += present * 0.18;
      }
      if (rig.rightGrip && rig.rightHand) {
        this.poseHand(
          rig,
          rig.rightGrip,
          new THREE.Vector3(),
          new THREE.Euler(0.34, 0.1, -0.34),
          present,
          rig.rightHand,
          false
        );
      }
      if (rig.newMag) {
        const insert = 1 - easeInOutCubic(THREE.MathUtils.clamp((t - 0.47) / 0.23, 0, 1));
        rig.newMag.visible = t >= 0.42 && t < 0.9;
        rig.newMag.position.x -= insert * 0.16;
        rig.newMag.position.y -= insert * 0.32;
        rig.newMag.position.z += insert * 0.08;
        rig.newMag.rotation.x += insert * 0.12;
        rig.newMag.rotation.z += insert * 0.38;
        if (rig.leftHand && t >= 0.42) {
          const hold =
            easeInOutCubic(THREE.MathUtils.clamp((t - 0.42) / 0.06, 0, 1)) *
            (1 - easeInOutCubic(THREE.MathUtils.clamp((t - 0.79) / 0.1, 0, 1)));
          this.poseHand(
            rig,
            rig.newMag,
            new THREE.Vector3(-0.056, -0.025, 0.012),
            new THREE.Euler(0.16, 0.12, -0.48),
            hold,
            rig.leftHand
          );
        }
      }
      if (rig.reloadSlap && rig.rightHand) {
        const slap = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.7) / 0.14, 0, 1));
        this.poseHand(
          rig,
          rig.reloadSlap,
          new THREE.Vector3(),
          new THREE.Euler(0.05, 0.18, -0.62),
          slap,
          rig.rightHand,
          false
        );
        this.hipPos.y += slap * 0.024;
        this.hipPos.z += slap * 0.028;
        this.hipRot.x -= slap * 0.09;
        this.hipRot.z += slap * 0.06;
      }
      if (rig.mag)
        rig.mag.visible =
          !this.rules.activeWeapon?.reloadState?.magOut ||
          !!this.rules.activeWeapon?.reloadState?.inserted;
    } else if (id === 'ak12') {
      const side =
        easeOutCubic(THREE.MathUtils.clamp(t / 0.13, 0, 1)) *
        (1 - easeInOutCubic(THREE.MathUtils.clamp((t - 0.9) / 0.1, 0, 1)));
      this.hipPos.x = THREE.MathUtils.lerp(this.hipPos.x, 0.035, side);
      this.hipPos.y += side * 0.105;
      this.hipPos.z -= side * 0.095;
      this.hipRot.x = THREE.MathUtils.lerp(this.hipRot.x, 0.04, side);
      this.hipRot.y = THREE.MathUtils.lerp(this.hipRot.y, 0.1, side);
      this.hipRot.z = THREE.MathUtils.lerp(this.hipRot.z, -0.02, side);
      if (rig.weaponPivot) {
        rig.weaponPivot.rotation.x += side * 0.08;
        rig.weaponPivot.rotation.y += side * 0.18;
        rig.weaponPivot.rotation.z -= side * 0.82;
      }
      if (rig.rightGrip && rig.rightHand) {
        this.poseHand(
          rig,
          rig.rightGrip,
          new THREE.Vector3(),
          new THREE.Euler(0.3, 0.08, -0.25),
          side * 0.86,
          rig.rightHand,
          false
        );
      }
      if (this.rules.reloadEmpty && rig.chargeHandle) {
        const rack = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.76) / 0.17, 0, 1));
        rig.chargeHandle.position.z += rack * 0.105;
        this.hipPos.y += rack * 0.015;
        this.hipPos.z += rack * 0.025;
        if (rig.leftHand) {
          this.poseHand(
            rig,
            rig.chargeHandle,
            new THREE.Vector3(-0.042, 0, 0.012),
            new THREE.Euler(0.16, -0.1, -0.52),
            rack,
            rig.leftHand,
            false
          );
        }
      }
      if (rig.mag)
        rig.mag.visible =
          !this.rules.activeWeapon?.reloadState?.magOut ||
          !!this.rules.activeWeapon?.reloadState?.inserted;
    } else if (id === 'ks12') {
      this.hipPos.x = THREE.MathUtils.lerp(this.hipPos.x, 0.06, dip);
      this.hipPos.y += dip * 0.095;
      this.hipPos.z -= dip * 0.08;
      this.hipRot.x = THREE.MathUtils.lerp(this.hipRot.x, 0.17, dip);
      this.hipRot.y = THREE.MathUtils.lerp(this.hipRot.y, 0.22, dip);
      this.hipRot.z = THREE.MathUtils.lerp(this.hipRot.z, -0.045, dip);
      if (rig.reloadShell) {
        const elapsed = t * total;
        const loadStart = 0.2;
        const shellTime = 0.42;
        const rounds = Math.max(1, this.rules.reloadRounds || 1);
        const shellIndex = Math.floor(Math.max(0, elapsed - loadStart) / shellTime);
        const cycle = THREE.MathUtils.clamp(
          (elapsed - loadStart - shellIndex * shellTime) / shellTime,
          0,
          1
        );
        const feed = easeInOutCubic(THREE.MathUtils.clamp(cycle / 0.78, 0, 1));
        rig.reloadShell.visible = elapsed >= loadStart && shellIndex < rounds;
        rig.reloadShell.position.set(-0.18 * (1 - feed), -0.2 * (1 - feed) - 0.075, -0.015);
        rig.reloadShell.rotation.set(0.25, 0, -0.45 * (1 - feed));
        if (rig.leftHand) {
          const blend =
            easeInOutCubic(THREE.MathUtils.clamp(cycle / 0.14, 0, 1)) *
            (1 - easeInOutCubic(THREE.MathUtils.clamp((cycle - 0.76) / 0.18, 0, 1)));
          this.poseHand(
            rig,
            rig.reloadShell,
            new THREE.Vector3(-0.047, -0.006, 0.012),
            new THREE.Euler(0.16, 0.1, -0.5),
            blend,
            rig.leftHand
          );
        }
        const seat = Math.sin(Math.PI * THREE.MathUtils.clamp((cycle - 0.58) / 0.32, 0, 1));
        this.hipPos.y += seat * 0.012;
        this.hipRot.x -= seat * 0.035;
        const loadEnd = loadStart + rounds * shellTime;
        if (this.rules.reloadEmpty && elapsed > loadEnd && rig.forend) {
          const pump = Math.sin(Math.PI * THREE.MathUtils.clamp((elapsed - loadEnd) / 0.16, 0, 1));
          rig.forend.position.z += pump * 0.105;
          this.hipPos.z += pump * 0.028;
          this.hipRot.x -= pump * 0.05;
        }
      }
    } else if (id === 'sr7') {
      const side =
        easeOutCubic(THREE.MathUtils.clamp(t / 0.18, 0, 1)) *
        (1 - easeInOutCubic(THREE.MathUtils.clamp((t - 0.86) / 0.135, 0, 1)));
      this.hipPos.x = THREE.MathUtils.lerp(this.hipPos.x, 0.045, side);
      this.hipPos.y += side * 0.08;
      this.hipPos.z -= side * 0.07;
      this.hipRot.x = THREE.MathUtils.lerp(this.hipRot.x, 0.04, side);
      this.hipRot.y = THREE.MathUtils.lerp(this.hipRot.y, 0.13, side);
      this.hipRot.z = THREE.MathUtils.lerp(this.hipRot.z, -0.04, side);
      if (rig.weaponPivot) {
        rig.weaponPivot.rotation.x += side * 0.04;
        rig.weaponPivot.rotation.y += side * 0.2;
        rig.weaponPivot.rotation.z -= side * 1.15;
      }
      if (rig.rightGrip && rig.rightHand) {
        this.poseHand(
          rig,
          rig.rightGrip,
          new THREE.Vector3(),
          new THREE.Euler(0.28, 0.08, -0.22),
          side * 0.82,
          rig.rightHand,
          false
        );
      }
      if (rig.bolt) {
        const action = THREE.MathUtils.clamp((t - 0.89) / 0.1, 0, 1);
        rig.bolt.rotation.z += Math.sin(Math.PI * action) * 1.2;
        rig.bolt.position.z +=
          Math.sin(Math.PI * THREE.MathUtils.clamp((action - 0.16) / 0.72, 0, 1)) * 0.125;
        if (rig.knob && rig.rightHand) {
          this.poseHand(
            rig,
            rig.knob,
            new THREE.Vector3(0.035, -0.005, 0.015),
            new THREE.Euler(0.08, -0.12, -0.42),
            Math.sin(Math.PI * action),
            rig.rightHand,
            false
          );
        }
      }
    } else if (id === 'p90') {
      this.hipPos.x = THREE.MathUtils.lerp(this.hipPos.x, 0.05, dip);
      this.hipPos.y += dip * 0.08;
      this.hipPos.z -= dip * 0.07;
      this.hipRot.x = THREE.MathUtils.lerp(this.hipRot.x, 0.1, dip);
      this.hipRot.y = THREE.MathUtils.lerp(this.hipRot.y, 0.2, dip);
      this.hipRot.z = THREE.MathUtils.lerp(this.hipRot.z, -0.05, dip);
      if (rig.weaponPivot) {
        rig.weaponPivot.rotation.y += dip * 0.2;
        rig.weaponPivot.rotation.z -= dip * 0.55;
      }
      if (this.rules.reloadEmpty && rig.chargeHandle) {
        const rack = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.76) / 0.17, 0, 1));
        rig.chargeHandle.position.z += rack * 0.08;
        this.hipPos.z += rack * 0.02;
      }
      if (rig.mag)
        rig.mag.visible =
          !this.rules.activeWeapon?.reloadState?.magOut ||
          !!this.rules.activeWeapon?.reloadState?.inserted;
    }
  }

  private poseHand(
    rig: BuiltRig,
    target: THREE.Object3D,
    offset: THREE.Vector3,
    rotation: THREE.Euler,
    blend: number,
    hand: THREE.Object3D,
    hideForearm = true
  ) {
    poseReloadHand(rig.group, target, offset, rotation, blend, hand, hideForearm);
  }

  private updateRecoil(dt: number) {
    const K = 210;
    const D = 19;
    const r = this.vmRec;
    r.vz += -r.pz * K * dt;
    r.vz -= r.vz * D * dt;
    r.pz += r.vz * dt;
    r.vy += -r.py * K * dt;
    r.vy -= r.vy * D * dt;
    r.py += r.vy * dt;
    r.vrx += -r.rx * K * dt;
    r.vrx -= r.vrx * D * dt;
    r.rx += r.vrx * dt;
    r.vry += -r.ry * K * dt;
    r.vry -= r.vry * D * dt;
    r.ry += r.vry * dt;
    r.vrz += -r.rz * K * dt;
    r.vrz -= r.vrz * D * dt;
    r.rz += r.vrz * dt;
  }

  private updateAdsCamera(ae: number, ref: number) {
    const dolly = VM_ADS_DOLLY * ae;
    const fov =
      (Math.atan((Math.tan((VM_FOV * Math.PI) / 360) * ref) / (ref + dolly)) * 360) / Math.PI;
    if (
      Math.abs(this.camera.position.z - dolly) > 0.0001 ||
      Math.abs(this.camera.fov - fov) > 0.001
    ) {
      this.camera.position.z = dolly;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
