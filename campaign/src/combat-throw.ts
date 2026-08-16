import * as THREE from 'three';
import { lethalEnemyDamage, spawnThrow, type ThrowableKind } from '../../shared/gameplay';
import type { Enemy, ThrowableProjectile } from './campaign';
import { spawnExplosion } from './fx';
import { revealNameplate } from './nameplates';
import { SFX } from './sfx';

export function makeThrownGrenade(
  scene: THREE.Scene,
  kind: ThrowableKind,
  camera: THREE.PerspectiveCamera
): ThrowableProjectile {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const body = spawnThrow(
    kind,
    camera.position.x,
    camera.position.y,
    camera.position.z,
    dir.x,
    dir.y,
    dir.z
  );
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 8),
    new THREE.MeshStandardMaterial({
      color: kind === 'lethal' ? 0x2b3320 : 0xb9c6d0,
      emissive: kind === 'lethal' ? 0x5a1f10 : 0x8096a4,
      emissiveIntensity: 0.8,
    })
  );
  mesh.position.set(body.x, body.y, body.z);
  mesh.userData.debugKind = 'throwable';
  scene.add(mesh);
  return { mesh, kind, body };
}

export function detonateThrown(
  scene: THREE.Scene,
  t: ThrowableProjectile,
  enemies: Enemy[],
  flashEl: HTMLDivElement | null,
  killEnemy: (enemy: Enemy) => void
) {
  const pos = t.mesh.position;
  scene.remove(t.mesh);
  if (t.kind !== 'lethal') {
    SFX.flashbang();
    if (flashEl) {
      flashEl.classList.add('on');
      setTimeout(() => flashEl.classList.remove('on'), 180);
    }
    return;
  }
  SFX.explosion();
  spawnExplosion(scene, pos, 0.72);
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const d = Math.hypot(enemy.root.position.x - pos.x, enemy.root.position.z - pos.z);
    const dmg = lethalEnemyDamage(d);
    if (dmg <= 0) continue;
    enemy.health -= dmg;
    revealNameplate(enemy);
    if (enemy.health <= 0) killEnemy(enemy);
  }
}
