import * as THREE from 'three';
import type { Enemy } from './campaign';
import type { P0Level } from './level';
import { buildSoldierModel, cloneSoldierRig, ENEMY_NAMES, type SoldierRig } from './soldier';

export function spawnCampaignEnemy(
  scene: THREE.Scene,
  level: P0Level,
  x: number,
  z: number,
  name: string,
  template: SoldierRig | null,
  extras: Partial<Enemy>
): { enemy: Enemy; template: SoldierRig } {
  const root = new THREE.Group();
  const soldier = template ? cloneSoldierRig(template, name) : buildSoldierModel(name);
  root.add(soldier.model);
  root.add(soldier.tag.sprite);
  root.position.set(x, level.groundY(x, z) + 0.02, z);
  root.userData.enemyRoot = root;
  root.userData.debugKind = 'enemy';
  scene.add(root);
  return {
    template: soldier,
    enemy: {
      root,
      alive: true,
      health: 100,
      phase: Math.random() * Math.PI * 2,
      baseX: x,
      baseZ: z,
      patrolT: Math.random() * Math.PI * 2,
      fireT: 1 + Math.random() * 2,
      burst: 0,
      soldier,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      engaged: false,
      suspicion: 0,
      lookScan: 0,
      patrolScale: z > 500 ? 2.1 : 1,
      kind: 'rifle',
      reactionT: 0.35 + Math.random() * 0.45,
      lastSeenT: 0,
      lastSeenX: x,
      lastSeenZ: z,
      stuckT: 0,
      stuckX: x,
      stuckZ: z,
      hitFlash: 0,
      tagRevealT: 0,
      deathT: 0,
      walkPhase: Math.random() * Math.PI * 2,
      speed: 0,
      flinch: 0,
      aimPitch: 0,
      combatBlend: 0,
      gunDropped: false,
      gunVel: null,
      gunAV: null,
      tactic: 'hold',
      tacticT: 0,
      reloadT: 0,
      rounds: 30,
      ...extras,
    },
  };
}

export function enemyNameAt(index: number) {
  return ENEMY_NAMES[index % ENEMY_NAMES.length];
}

export function makePickupRoot(color: number, label: string): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.18, 0.18),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      roughness: 0.5,
    })
  );
  body.position.y = 0.18;
  body.castShadow = true;
  body.userData.debugKind = 'pickup';
  root.add(body);
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.7 })
  );
  tip.position.y = 0.32;
  tip.userData.debugKind = 'pickup';
  root.add(tip);
  root.userData.debugKind = 'pickup';
  root.userData.pickupLabel = label;
  return root;
}
