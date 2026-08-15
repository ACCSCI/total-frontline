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

const BUILDERS: Record<string, () => { group: THREE.Group; basePos?: THREE.Vector3; baseRot?: THREE.Vector3 }> = {
  m4: buildRifle as never,
  ks12: buildShotgun as never,
  ak12: buildModernAK as never,
  sr7: buildSniper as never,
  p90: buildP90 as never,
};

export class ViewmodelRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  private rules: CampaignRules;
  private model: THREE.Group | null = null;
  private rig: { basePos?: THREE.Vector3; baseRot?: THREE.Vector3 } | null = null;
  private lastId = '';
  private bobT = 0;
  private kick = 0;

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
    }
    const basePos = this.rig?.basePos || new THREE.Vector3(0.24, -0.26, -0.62);
    const baseRot = this.rig?.baseRot || new THREE.Vector3(0, 0, -0.06);
    const input = player.input;
    const moving = input.forward || input.back || input.left || input.right;
    this.bobT += dt * (input.sprint ? 10 : moving ? 7 : 0);
    const bob = moving ? Math.sin(this.bobT) * 0.012 : 0;
    const breathe = Math.sin(performance.now() * 0.0011) * 0.002;
    this.root.position.set(basePos.x + bob * 0.5, basePos.y + bob, basePos.z);
    this.root.rotation.set(baseRot.x + bob * 0.18 + breathe, baseRot.y, baseRot.z + bob * 0.35);
    this.kick = THREE.MathUtils.damp(this.kick, 0, 12, dt);
    this.root.position.z += this.kick * 0.05;
    this.root.rotation.x += this.kick * 0.05;
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
}
