import * as THREE from 'three';
import type { CampaignRules } from './campaign';
import type { FirstPersonPlayer } from './player';
import {
  buildRifle,
  buildShotgun,
  buildSniper,
  buildModernAK,
  buildP90,
} from './generated-viewmodels';

interface BuiltRig {
  group: THREE.Group;
  basePos?: THREE.Vector3;
  baseRot?: THREE.Vector3;
  adsPos?: THREE.Vector3;
  adsRot?: THREE.Vector3;
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

export class ViewmodelRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  private rules: CampaignRules;
  private model: THREE.Group | null = null;
  private rig: BuiltRig | null = null;
  private lastId = '';
  private bobT = 0;
  private kick = 0;
  private pos = new THREE.Vector3();
  private rot = new THREE.Vector3();
  private hipPos = new THREE.Vector3();
  private hipRot = new THREE.Vector3();
  private aimPos = new THREE.Vector3();
  private aimRot = new THREE.Vector3();

  constructor(rules: CampaignRules) {
    this.rules = rules;
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.008, 8);
    this.scene.add(new THREE.AmbientLight(0xb9bfc4, 0.9));
    const key = new THREE.DirectionalLight(0xffe8c8, 2.2);
    key.position.set(-0.6, 1.0, 0.7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb4c8, 0.8);
    rim.position.set(0.4, 0.2, -1);
    this.scene.add(rim);
    this.scene.add(this.root);
  }

  update(dt: number, player: FirstPersonPlayer) {
    const id = this.rules.activeWeapon?.def.id || '';
    if (id !== this.lastId) {
      this.lastId = id;
      if (this.model) this.root.remove(this.model);
      const builder = BUILDERS[id];
      if (builder) {
        const built = builder();
        this.model = built.group;
        this.rig = built;
        this.root.add(built.group);
      } else {
        this.model = null;
        this.rig = null;
      }
      this.kick = 0;
    }

    const basePos = this.rig?.basePos || FALLBACK_POS;
    const baseRot = this.rig?.baseRot || FALLBACK_ROT;
    const adsPos = this.rig?.adsPos || basePos;
    const adsRot = this.rig?.adsRot || FALLBACK_ROT;

    const speed = player.horizontalSpeed;
    const moving = speed > 0.6 && player.input.forward;
    const sprinting = player.input.sprint && speed > 4.5;
    const walkAmount = THREE.MathUtils.clamp(speed / 4.9, 0, 1.25);
    this.bobT += dt * (sprinting ? 11 : moving ? speed * 1.35 : 0);
    const bobY = Math.sin(this.bobT * 2) * 0.007 * walkAmount;
    const bobX = Math.sin(this.bobT) * 0.009 * walkAmount;
    const breathe = Math.sin(performance.now() * 0.0011) * 0.002;
    const swayX = Math.sin(performance.now() * 0.0009 + player.yaw) * 0.006;
    const swayY = Math.cos(performance.now() * 0.0007 + player.pitch) * 0.005;

    const stanceDrop = player.prone ? 0.105 : player.crouch ? 0.06 : 0;
    const sprintDrop = sprinting ? 0.07 : 0;
    const sprintTilt = sprinting ? -0.28 : 0;

    this.hipPos.set(
      basePos.x + bobX + swayX + player.pitch * -0.004,
      basePos.y + bobY + swayY - stanceDrop - sprintDrop,
      basePos.z + breathe
    );
    this.hipRot.set(baseRot.x + bobX * 0.35 + breathe, baseRot.y + swayX * 0.4, baseRot.z + bobY * 0.6 + sprintTilt);

    this.aimPos.set(
      adsPos.x + swayX * 0.25,
      adsPos.y + swayY * 0.25 - stanceDrop * 0.75,
      adsPos.z + breathe * 0.5
    );
    this.aimRot.set(adsRot.x + swayX * 0.15, adsRot.y + swayY * 0.12, adsRot.z);

    const k = this.ease(this.rules.adsEase);
    this.pos.lerpVectors(this.hipPos, this.aimPos, k);
    this.rot.lerpVectors(this.hipRot, this.aimRot, k);

    /* Weapon switch and reload both dip the gun below the frame, matching the
       single-player animation language. */
    if (this.rules.switching) {
      const p = Math.sin((1 - this.rules.switchT / 0.28) * Math.PI);
      this.pos.y -= p * 0.24;
      this.rot.x += p * 0.5;
    }
    if (this.rules.reloading) {
      const p = Math.sin((this.rules.reloadT / this.rules.reloadDuration) * Math.PI);
      this.pos.y -= p * 0.19;
      this.rot.x += p * 0.42;
    }

    this.kick = THREE.MathUtils.damp(this.kick, 0, 12, dt);
    this.pos.z += this.kick * 0.055;
    this.rot.x += this.kick * 0.055;

    this.root.position.copy(this.pos);
    this.root.rotation.set(this.rot.x, this.rot.y, this.rot.z);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  punch() {
    this.kick = 1;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private ease(t: number) {
    return t * t * (3 - 2 * t);
  }
}
