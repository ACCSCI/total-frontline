import * as THREE from 'three';
import { campaignStartAttachments, currentRecoilScale, weaponFamily } from '../../shared/gameplay';
import type { CampaignRules, CarriedWeapon } from './campaign';
import {
  buildModernAK,
  buildP90,
  buildPistol,
  buildRifle,
  buildShotgun,
  buildSniper,
} from './generated-viewmodels';
import { createViewmodelAnimator } from './generated-vm-anim';
import type { FirstPersonPlayer } from './player';

const BUILDERS: Record<string, () => { group: THREE.Group; [key: string]: unknown }> = {
  m4: buildRifle as never,
  ks12: buildShotgun as never,
  ak12: buildModernAK as never,
  sr7: buildSniper as never,
  p90: buildP90 as never,
  p9: buildPistol as never,
};

const VM_SCALE = 0.86;
const VM_FOV = 41.9;

function attachmentsFor(slot: CarriedWeapon | null, id: string): Record<string, string> {
  return slot?.attachments || campaignStartAttachments(id);
}

function suppressedMuzzleZ(id: string, suppressed: boolean): number | null {
  if (id === 'm4' || id === 'rifle') return suppressed ? -0.92 : -0.73;
  if (id === 'ak12' || id === 'ak') return suppressed ? -1.1 : -1.02;
  if (id === 'p9' || id === 'pistol') return suppressed ? -0.284 : -0.185;
  return null;
}

function applyAttachmentNodes(
  built: {
    attachmentNodes?: Record<string, Record<string, THREE.Object3D>>;
    muzzle?: THREE.Object3D;
  },
  attachments: Record<string, string>,
  weaponId: string
) {
  const nodes = built.attachmentNodes;
  if (nodes) {
    for (const [slot, selected] of Object.entries(attachments)) {
      const group = nodes[slot];
      if (!group) continue;
      for (const [id, node] of Object.entries(group)) node.visible = id === selected;
    }
  }
  const z = suppressedMuzzleZ(weaponId, attachments.muzzle === 'suppressor');
  if (z != null && built.muzzle) built.muzzle.position.z = z;
}

export class ViewmodelRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  private sway = new THREE.Group();
  private recoil = new THREE.Group();
  private rules: CampaignRules;
  private anim = createViewmodelAnimator();
  private model: THREE.Group | null = null;
  private vm: Record<string, unknown> | null = null;
  private lastId = '';
  private weapons: unknown[] = [];
  private stanceRecoil = 1;
  private _mzView = new THREE.Vector3();
  private _mzPoint = new THREE.Vector3();
  private _mzDir = new THREE.Vector3();
  private _mzFwd = new THREE.Vector3();

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
    this.root.add(this.sway);
    this.sway.add(this.recoil);
    this.scene.add(this.root);
  }

  update(dt: number, player: FirstPersonPlayer) {
    this.stanceRecoil = player.stanceRecoilMultiplier;
    const id = this.rules.activeWeapon?.def.id || '';
    if (id !== this.lastId) this.swapModel(id);
    if (!this.vm) return;

    this.weapons = this.rules.slots.map((slot) => this.bindWeapon(slot));
    const look = player.consumeLookDelta();
    this.anim.step(dt, look.x, look.y, {
      player: this.bindPlayer(player),
      weapons: this.weapons,
      camera: player.camera,
      vmCamera: this.camera,
      vmSway: this.sway,
      vmRecoil: this.recoil,
    });
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  punch() {
    const w = this.rules.activeWeapon;
    if (!w) return;
    const scale = currentRecoilScale(w.def.adsRecoil, this.rules.adsEase, this.stanceRecoil);
    this.anim.kick({ recoilKick: w.def.recoilKick, recoilRot: w.def.recoilRot }, scale);
    const family = weaponFamily(w.def.id);
    this.anim.flash(
      family === 'shotgun' ? 1.7 : family === 'sniper' ? 1.9 : family === 'rifle' ? 1 : 0.8
    );
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  placeWorldMuzzle(gameCamera: THREE.PerspectiveCamera, out: THREE.Vector3): THREE.Vector3 {
    gameCamera.getWorldDirection(this._mzFwd);
    const fallback = out.copy(gameCamera.position).addScaledVector(this._mzFwd, 0.55);
    const muzzle = this.vm?.muzzle as THREE.Object3D | undefined;
    if (!muzzle) return fallback;
    muzzle.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld(true);
    gameCamera.updateMatrixWorld(true);
    muzzle.getWorldPosition(this._mzView).project(this.camera);
    this._mzPoint.set(this._mzView.x, this._mzView.y, 0).unproject(gameCamera);
    this._mzDir.subVectors(this._mzPoint, gameCamera.position).normalize();
    const forwardDot = this._mzDir.dot(this._mzFwd);
    if (!Number.isFinite(forwardDot) || forwardDot <= 0.05) return fallback;
    return out.copy(gameCamera.position).addScaledVector(this._mzDir, 0.55 / forwardDot);
  }

  private bindPlayer(player: FirstPersonPlayer) {
    const w = this.rules.activeWeapon;
    return {
      weapon: this.rules.activeSlot,
      sprint: player.sprint,
      bob: player.bob,
      bobAmp: player.bobAmp,
      crouch: player.crouch,
      prone: player.prone,
      onGround: player.grounded,
      vel: { y: player.verticalSpeed },
      adsEase: player.adsEase,
      reloadT: this.rules.reloadT,
      reloadDuration: this.rules.reloadDuration,
      reloadEmpty: this.rules.reloadEmpty,
      reloadRounds: this.rules.reloadRounds,
      meleeT: this.rules.meleeT,
      switching: this.rules.switchT,
      switchTo: this.rules.switchTo,
      holsterAt: this.rules.holsterAt,
      pumpT: w?.pumpT || 0,
      boltT: w?.boltT || 0,
      triggerHeld: false,
    };
  }

  private bindWeapon(slot: CarriedWeapon | null) {
    if (!slot) return { id: 'rifle', vm: this.vm, recoilKick: 0.04, recoilRot: 0.06 };
    const family = weaponFamily(slot.def.id);
    return {
      id: family,
      vm: this.vm,
      heavy: family === 'lmg',
      reloadTime: slot.def.reloadTime,
      pumpTime: slot.def.pumpTime,
      boltTime: slot.def.boltTime,
      drawTime: slot.def.drawTime,
      scope: !!slot.def.scope,
      bracedAim: !!slot.def.bracedAim,
      attachments: slot.attachments,
      reloadState: slot.reloadState,
      recoilKick: slot.def.recoilKick,
      recoilRot: slot.def.recoilRot,
    };
  }

  private swapModel(id: string) {
    this.lastId = id;
    if (this.model) this.recoil.remove(this.model);
    const builder = BUILDERS[id];
    if (!builder) {
      this.model = null;
      this.vm = null;
      return;
    }
    const built = builder();
    this.model = built.group;
    this.vm = built;
    applyAttachmentNodes(
      built as {
        attachmentNodes?: Record<string, Record<string, THREE.Object3D>>;
        muzzle?: THREE.Object3D;
      },
      attachmentsFor(this.rules.activeWeapon, id),
      id
    );
    const ejected = built.ejectedMag as THREE.Object3D | undefined;
    if (ejected) {
      built.group.add(ejected);
      ejected.frustumCulled = false;
      ejected.traverse((o) => {
        o.frustumCulled = false;
        o.visible = o === ejected ? false : o.visible;
      });
    }
    this.recoil.add(built.group);
    this.anim.reset();
  }
}
