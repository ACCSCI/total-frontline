import * as THREE from 'three';
import type { CampaignRules } from './campaign';
import type { FirstPersonPlayer } from './player';

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.28 })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function buildWeaponModel(id: string): THREE.Group {
  const g = new THREE.Group();
  const dark = 0x24272a;
  const mid = 0x3a3f43;
  const stock = 0x4d3c2b;
  if (id === 'm4' || id === 'ak12') {
    box(0.055, 0.095, 0.72, dark, 0, 0, -0.18, g);
    box(0.04, 0.055, 0.3, mid, 0, 0.01, -0.34, g);
    box(0.05, 0.12, 0.13, mid, 0, -0.045, -0.02, g);
    box(0.04, 0.13, 0.05, mid, 0, -0.09, 0.03, g);
    box(0.045, 0.085, 0.24, stock, 0, 0.005, 0.32, g);
    box(0.065, 0.03, 0.16, mid, 0, 0.055, -0.42, g);
  } else if (id === 'ks12') {
    box(0.065, 0.08, 0.82, mid, 0, 0, -0.14, g);
    box(0.035, 0.035, 0.55, dark, 0, 0.015, 0.28, g);
    box(0.05, 0.11, 0.14, dark, 0, -0.05, -0.02, g);
    box(0.045, 0.04, 0.05, stock, 0, -0.015, 0.38, g);
  } else if (id === 'sr7') {
    box(0.055, 0.09, 0.95, dark, 0, 0, -0.2, g);
    box(0.035, 0.035, 0.5, mid, 0, 0.025, -0.55, g);
    box(0.055, 0.12, 0.16, stock, 0, 0, 0.38, g);
    box(0.05, 0.05, 0.22, mid, 0, 0.055, -0.08, g);
    box(0.07, 0.07, 0.34, 0x15181b, 0, 0.06, -0.28, g);
  } else {
    box(0.06, 0.11, 0.62, mid, 0, 0, -0.2, g);
    box(0.055, 0.14, 0.16, dark, 0, -0.07, 0.02, g);
    box(0.04, 0.1, 0.2, stock, 0, 0, 0.26, g);
    box(0.05, 0.045, 0.3, dark, 0, 0.05, -0.4, g);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return g;
}

export class ViewmodelRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  private rules: CampaignRules;
  private model: THREE.Group | null = null;
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
    this.root.position.set(0.24, -0.26, -0.62);
    this.root.rotation.y = -0.06;
    this.scene.add(this.root);
  }

  update(dt: number, player: FirstPersonPlayer) {
    const id = this.rules.activeWeapon?.def.id || '';
    if (id !== this.lastId) {
      this.lastId = id;
      if (this.model) this.root.remove(this.model);
      this.model = id ? buildWeaponModel(id) : null;
      if (this.model) this.root.add(this.model);
    }
    const input = player.input;
    const moving = input.forward || input.back || input.left || input.right;
    this.bobT += dt * (input.sprint ? 10 : moving ? 7 : 0);
    const bob = moving ? Math.sin(this.bobT) * 0.012 : 0;
    const breathe = Math.sin(performance.now() * 0.0011) * 0.002;
    this.root.position.set(0.24 + bob * 0.5, -0.26 + bob, -0.62);
    this.root.rotation.set(bob * 0.18, -0.06, bob * 0.35);
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
