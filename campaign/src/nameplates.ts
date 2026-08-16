import * as THREE from 'three';
import { NAMEPLATE_HIT_REVEAL, nameplateVisible } from '../../shared/gameplay';
import type { Enemy } from './campaign';
import { SETTINGS } from './settings';

const _aim = new THREE.Vector3();
const _to = new THREE.Vector3();

export function revealNameplate(enemy: Enemy) {
  enemy.tagRevealT = NAMEPLATE_HIT_REVEAL;
  enemy.soldier.tag.draw(enemy.health, enemy.engaged);
}

export function updateEnemyNameplates(
  enemies: Enemy[],
  camera: THREE.PerspectiveCamera,
  dt: number
) {
  camera.getWorldDirection(_aim);
  const baseFov = SETTINGS.baseFov || 75;
  for (const e of enemies) {
    if (!e.alive) {
      e.soldier.tag.sprite.visible = false;
      continue;
    }
    e.tagRevealT = Math.max(0, e.tagRevealT - dt);
    const pos = e.root.position;
    _to.set(pos.x - camera.position.x, pos.y + 1.55 - camera.position.y, pos.z - camera.position.z);
    const dist = _to.length();
    const aimDot = dist > 0.001 ? _aim.dot(_to.normalize()) : 0;
    const show = nameplateVisible(true, dist, aimDot, e.tagRevealT);
    e.soldier.tag.sprite.visible = show;
    if (!show) continue;
    e.soldier.tag.draw(e.health, e.engaged);
    const s = Math.min(1.9, Math.max(0.55, dist * 0.045)) * (camera.fov / baseFov);
    e.soldier.tag.sprite.scale.set(1.75 * s, 0.52 * s, 1);
    e.soldier.tag.sprite.position.y = 2.22;
  }
}
