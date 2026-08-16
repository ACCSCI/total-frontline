import * as THREE from 'three';
import { ammoLootLabel, type EnemyKind, weaponLootLabel } from '../../shared/gameplay';
import missionsData from '../../shared/missions.json';
import type { Enemy, Pickup } from './campaign';
import {
  buildModernAK,
  buildP90,
  buildPistol,
  buildRifle,
  buildShotgun,
  buildSniper,
} from './generated-viewmodels';
import type { P0Level } from './level';
import { buildSoldierModel, cloneSoldierRig, ENEMY_NAMES, type SoldierRig } from './soldier';
import { PRIMARY_WEAPONS } from './weapon-defs';

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

export function prewarmWaveReserve(
  scene: THREE.Scene,
  level: P0Level,
  playerX: number,
  playerZ: number,
  enemies: Enemy[],
  reserve: Enemy[],
  template: SoldierRig | null
): SoldierRig | null {
  for (const wave of missionsData.mission01.reinforcementWaves)
    for (const p of wave.positions) {
      const spawned = spawnCampaignEnemy(
        scene,
        level,
        p.x,
        p.z,
        enemyNameAt(enemies.length + reserve.length),
        template,
        {
          kind: ((p as { kind?: EnemyKind }).kind || 'rifle') as EnemyKind,
        }
      );
      template = spawned.template;
      spawned.enemy.root.visible = false;
      reserve.push(spawned.enemy);
    }
  const warmX = playerX + 1.5;
  const warmZ = playerZ + 4;
  for (const e of reserve) {
    e.root.visible = true;
    e.root.position.set(warmX, level.groundY(warmX, warmZ) + 0.02, warmZ);
  }
  setTimeout(() => {
    for (const e of reserve) e.root.visible = false;
  }, 700);
  return template;
}

export function spawnWaveFromReserve(
  level: P0Level,
  reserve: Enemy[],
  enemies: Enemy[],
  wave: { z: number; positions: Array<{ x: number; z: number }> }
) {
  for (let i = 0; i < wave.positions.length; i++) {
    const p = wave.positions[i];
    const e = reserve.shift();
    if (!e) break;
    e.root.visible = true;
    e.root.position.set(p.x, level.groundY(p.x, p.z) + 0.02, p.z);
    e.baseX = p.x;
    e.baseZ = p.z;
    e.kind = ((p as { kind?: EnemyKind }).kind || 'rifle') as EnemyKind;
    e.fireT = 0.8 + Math.random() * 0.6;
    e.engaged = true;
    e.reactionT = 0.2;
    e.lastSeenT = 2;
    e.patrolT = Math.random() * Math.PI * 2;
    enemies.push(e);
  }
}

const WEAPON_BUILDERS: Record<string, () => { group: THREE.Group; [key: string]: unknown }> = {
  m4: buildRifle as never,
  ks12: buildShotgun as never,
  ak12: buildModernAK as never,
  sr7: buildSniper as never,
  p90: buildP90 as never,
  p9: buildPistol as never,
};

function buildAmmoCrate(root: THREE.Group) {
  const olive = new THREE.MeshStandardMaterial({
    color: 0x3f4b34,
    roughness: 0.82,
    metalness: 0.06,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22261d, roughness: 0.7, metalness: 0.16 });
  const strap = new THREE.MeshStandardMaterial({ color: 0x15170f, roughness: 0.88 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.38), olive);
  crate.position.y = 0.17;
  crate.castShadow = true;
  crate.receiveShadow = true;
  root.add(crate);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.42), dark);
  lid.position.y = 0.365;
  lid.castShadow = true;
  root.add(lid);
  for (const [sx, sz] of [
    [-0.31, 0],
    [0.31, 0],
    [0, -0.19],
    [0, 0.19],
  ]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(Math.abs(sx) > 0 ? 0.07 : 0.7, 0.42, Math.abs(sz) > 0 ? 0.07 : 0.46),
      strap
    );
    band.position.set(sx, 0.19, sz);
    root.add(band);
  }
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.16, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xa9c46a, emissive: 0x3f5a18, emissiveIntensity: 0.8 })
  );
  marker.position.set(0, 0.21, 0.205);
  root.add(marker);
  for (let i = 0; i < 4; i++) {
    const round = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0xc89a3c, roughness: 0.36, metalness: 0.72 })
    );
    round.position.set(-0.18 + i * 0.12, 0.46, 0.08);
    round.rotation.z = Math.PI / 2;
    round.castShadow = true;
    root.add(round);
  }
}

function buildWorldWeapon(weaponId: string): THREE.Group | null {
  const builder = WEAPON_BUILDERS[weaponId];
  if (!builder) return null;
  const built = builder();
  const group = built.group;
  const hands = (built as { hands?: THREE.Object3D }).hands;
  if (hands) group.remove(hands);
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  group.scale.setScalar(0.55);
  group.rotation.x = -Math.PI / 2;
  group.position.y = 0;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  group.position.y = 0.07 - bounds.min.y;
  return group;
}

export function makePickupRoot(
  kind: Pickup['kind'],
  weaponId: string | undefined,
  label: string
): THREE.Group {
  const root = new THREE.Group();
  if (kind === 'weapon' || kind === 'lootWeapon') {
    const weapon = buildWorldWeapon(weaponId || '');
    if (weapon) {
      weapon.userData.debugKind = 'pickup';
      root.add(weapon);
    } else {
      buildAmmoCrate(root);
    }
  } else {
    buildAmmoCrate(root);
  }
  root.userData.debugKind = 'pickup';
  root.userData.pickupLabel = label;
  return root;
}

interface PickupHost {
  scene: THREE.Scene;
  level: P0Level;
  pickups: Pickup[];
}

export function addWorldPickup(
  host: PickupHost,
  kind: Pickup['kind'],
  weaponId: string | undefined,
  pos: THREE.Vector3,
  labelOverride?: string,
  lifetime = 0
) {
  const def = weaponId ? PRIMARY_WEAPONS[weaponId] : null;
  const label = labelOverride || (def ? weaponLootLabel(def.name, true) : ammoLootLabel(false));
  const root = makePickupRoot(kind, weaponId, label);
  root.position.set(pos.x, host.level.groundY(pos.x, pos.z) + 0.02, pos.z);
  root.userData.debugKind = 'pickup';
  host.scene.add(root);
  host.pickups.push({
    root,
    kind,
    weaponId,
    label,
    coolUntil: -1,
    bobT: Math.random() * Math.PI * 2,
    expiresAt: lifetime > 0 ? performance.now() + lifetime : 0,
  });
}

export function spawnMissionPickups(host: PickupHost) {
  for (const p of missionsData.mission01.weaponPickups)
    addWorldPickup(host, 'weapon', p.weapon, new THREE.Vector3(p.x, 0, p.z));
  for (const p of missionsData.mission01.ammoPickups)
    addWorldPickup(host, 'ammo', undefined, new THREE.Vector3(p.x, 0, p.z), '弹药补给');
}
