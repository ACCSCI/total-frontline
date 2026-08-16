import * as THREE from 'three';
import type { Enemy } from './campaign';
import { poseIdleEnemy } from './enemy-idles';

/** Same carry / shouldered poses as the single-player soldier. */
export function poseCampaignSoldier(e: Enemy, dt: number, dist: number) {
  const p = e.soldier;
  const walk = THREE.MathUtils.clamp(e.speed / 2.4, 0, 1);
  if (e.idleRole && e.idleRole !== 'patrol' && walk < 0.08 && !e.engaged && e.suspicion < 0.45) {
    poseIdleEnemy(p, e.idleRole, e.phase);
    p.head.rotation.y = THREE.MathUtils.damp(p.head.rotation.y, e.lookScan, 6, dt);
    p.model.rotation.x = 0;
    p.model.position.z = 0;
    return;
  }
  const s1 = Math.sin(e.walkPhase);
  const c1 = Math.cos(e.walkPhase);
  p.legs[0].hip.rotation.x = s1 * 0.62 * walk;
  p.legs[1].hip.rotation.x = -s1 * 0.62 * walk;
  p.legs[0].knee.rotation.x = Math.max(0, -Math.cos(e.walkPhase)) * 0.7 * walk;
  p.legs[1].knee.rotation.x = Math.max(0, Math.cos(e.walkPhase)) * 0.7 * walk;
  p.body.position.y = Math.abs(c1) * 0.045 * walk - e.flinch * 0.03;
  p.body.rotation.z = s1 * 0.035 * walk;
  const combat = e.engaged || e.suspicion > 0.45 ? 1 : 0;
  e.combatBlend = THREE.MathUtils.damp(e.combatBlend, combat, 7, dt);
  const cb = e.combatBlend;
  p.arms[0].sh.rotation.x = THREE.MathUtils.lerp(0.85 + s1 * 0.25 * walk, 1.5, cb);
  p.arms[0].sh.rotation.z = THREE.MathUtils.lerp(0.65, 0.62, cb);
  p.arms[0].el.rotation.x = THREE.MathUtils.lerp(-0.11, -0.15, cb);
  p.arms[1].sh.rotation.x = THREE.MathUtils.lerp(1.12 - s1 * 0.25 * walk, 1.99, cb);
  p.arms[1].sh.rotation.z = THREE.MathUtils.lerp(-0.28, -0.68, cb);
  p.arms[1].el.rotation.x = THREE.MathUtils.lerp(-1.39, -1.69, cb);
  p.gun.position.set(
    THREE.MathUtils.lerp(0.14, 0.1, cb),
    THREE.MathUtils.lerp(-0.3, -0.05, cb),
    THREE.MathUtils.lerp(-0.2, -0.26, cb)
  );
  p.gun.rotation.set(
    THREE.MathUtils.lerp(-0.42, 0, cb),
    THREE.MathUtils.lerp(-0.16, 0, cb),
    THREE.MathUtils.lerp(0.2, 0, cb)
  );
  e.aimPitch = THREE.MathUtils.lerp(
    e.aimPitch,
    e.engaged ? THREE.MathUtils.clamp(1.2 / Math.max(1, dist), -0.25, 0.15) : 0,
    dt * 5
  );
  p.rig.rotation.x = THREE.MathUtils.lerp(0, e.aimPitch, cb);
  p.head.rotation.x = THREE.MathUtils.lerp(0, e.aimPitch * 0.5, cb);
  p.head.rotation.y = THREE.MathUtils.damp(p.head.rotation.y, e.lookScan, 6, dt);
  p.model.position.z = e.flinch * 0.14;
  p.model.rotation.x = e.flinch * 0.2;
}
