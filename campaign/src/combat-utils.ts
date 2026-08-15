import * as THREE from 'three';
import type { Enemy } from './campaign';
import type { LevelObstacle, P0Level } from './level';

export function losBlocked(
  a: THREE.Vector3,
  b: THREE.Vector3,
  obstacles: LevelObstacle[]
): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return false;
  for (const o of obstacles) {
    const t = THREE.MathUtils.clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / lenSq, 0, 1);
    const cx = a.x + dx * t - o.x;
    const cz = a.z + dz * t - o.z;
    const r = o.r * 0.85;
    if (cx * cx + cz * cz < r * r) return true;
  }
  return false;
}

export function avoidObstacles(pos: THREE.Vector3, obstacles: LevelObstacle[]) {
  for (const o of obstacles) {
    const ddx = pos.x - o.x;
    const ddz = pos.z - o.z;
    const min = o.r + 0.5;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 >= min * min || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    pos.x = o.x + (ddx / d) * min;
    pos.z = o.z + (ddz / d) * min;
  }
}

export function spawnTracer(
  scene: THREE.Scene,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number
) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to]);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.userData.debugKind = 'fx';
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    geo.dispose();
    mat.dispose();
  }, 90);
}

export function animateEnemyDeath(scene: THREE.Scene, e: Enemy, dt: number) {
  e.deathT -= dt;
  const k = 1 - Math.max(0, e.deathT / 0.75);
  const p = e.soldier;
  p.model.rotation.x = k * (Math.PI * 0.5) * 0.98;
  p.model.position.y = -k * 0.1;
  p.model.rotation.z = Math.sin(k * 4) * 0.08 * (1 - k);
  p.legs.forEach((l, i) => {
    l.hip.rotation.x = THREE.MathUtils.lerp(l.hip.rotation.x, i ? 0.3 : -0.25, dt * 6);
    l.knee.rotation.x = THREE.MathUtils.lerp(l.knee.rotation.x, 0.55, dt * 6);
  });
  p.arms.forEach((a, i) => {
    a.sh.rotation.x = THREE.MathUtils.lerp(a.sh.rotation.x, i ? 0.6 : 0.35, dt * 6);
    a.sh.rotation.z = THREE.MathUtils.lerp(a.sh.rotation.z, (i ? 1 : -1) * 0.5, dt * 6);
    a.el.rotation.x = THREE.MathUtils.lerp(a.el.rotation.x, 0.2, dt * 6);
  });
  p.rig.rotation.x = THREE.MathUtils.lerp(p.rig.rotation.x, 0, dt * 6);
  if (!e.gunDropped && k > 0.14) {
    e.gunDropped = true;
    scene.attach(p.gun);
    e.gunVel = new THREE.Vector3(
      (Math.random() - 0.5) * 3.2,
      0.6 + Math.random() * 1.2,
      (Math.random() - 0.5) * 3.2
    );
    e.gunAV = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );
  }
  if (e.gunDropped && e.gunVel && e.gunAV) {
    e.gunVel.y -= 17 * dt;
    p.gun.position.addScaledVector(e.gunVel, dt);
    p.gun.rotation.x += e.gunAV.x * dt;
    p.gun.rotation.y += e.gunAV.y * dt;
    p.gun.rotation.z += e.gunAV.z * dt;
    if (p.gun.position.y <= 0.07) {
      p.gun.position.y = 0.07;
      if (Math.abs(e.gunVel.y) < 0.7) {
        e.gunVel = null;
        p.gun.rotation.set(
          Math.random() - 0.5,
          Math.random() * 7,
          Math.PI / 2 + (Math.random() - 0.5) * 0.6
        );
      } else {
        e.gunVel.y *= -0.32;
        e.gunVel.x *= 0.55;
        e.gunVel.z *= 0.55;
      }
    }
  }
}

export interface EnemyAIHost {
  level: P0Level;
  hurtPlayer(amount: number, shooter?: Enemy): void;
}

export function updateCampaignEnemy(
  host: EnemyAIHost,
  e: Enemy,
  dt: number,
  playerPos: THREE.Vector3
) {
  e.phase += dt;
  const px = e.root.position.x;
  const pz = e.root.position.z;
  const dx = playerPos.x - px;
  const dz = playerPos.z - pz;
  const dist = Math.hypot(dx, dz) || 1;
  e.root.visible = dist < 52;
  e.root.rotation.y = Math.atan2(dx, dz);

  const canSee = dist < 30 && !losBlocked(e.root.position, playerPos, host.level.obstacles);
  if (canSee) {
    e.reactionT -= dt;
    if (e.reactionT <= 0) e.engaged = true;
  } else {
    e.engaged = false;
    e.reactionT = 0.35 + Math.random() * 0.55;
  }

  let mx = 0;
  let mz = 0;
  if (e.engaged) {
    const tangentX = -dz / dist;
    const tangentZ = dx / dist;
    const ideal = 8 + (e.baseX % 5);
    const radial = dist > ideal + 2.5 ? 1 : dist < ideal - 2.5 ? -0.7 : 0;
    mx = (dx / dist) * radial + tangentX * e.strafeDir;
    mz = (dz / dist) * radial + tangentZ * e.strafeDir;
    const ml = Math.hypot(mx, mz) || 1;
    mx = (mx / ml) * 1.55;
    mz = (mz / ml) * 1.55;
    if (Math.random() < dt * 0.45) e.strafeDir *= -1;
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = 0.95 + Math.random() * 1.35;
      if (dist < 30) host.hurtPlayer(5 + Math.random() * 4, e);
    }
  } else {
    e.patrolT += dt;
    const tx = e.baseX + Math.sin(e.patrolT * 0.55) * 2.4;
    const tz = e.baseZ + Math.cos(e.patrolT * 0.4) * 1.8;
    const pdx = tx - px;
    const pdz = tz - pz;
    const pl = Math.hypot(pdx, pdz);
    if (pl > 0.3) {
      mx = (pdx / pl) * 0.7;
      mz = (pdz / pl) * 0.7;
    }
  }

  e.root.position.x += mx * dt;
  e.root.position.z += mz * dt;
  avoidObstacles(e.root.position, host.level.obstacles);
  e.root.position.x = THREE.MathUtils.clamp(
    e.root.position.x,
    host.level.bounds.minX + 0.7,
    host.level.bounds.maxX - 0.7
  );
  e.root.position.z = THREE.MathUtils.clamp(
    e.root.position.z,
    host.level.bounds.minZ + 0.7,
    host.level.bounds.maxZ - 0.7
  );
  e.root.position.y = host.level.groundY(e.root.position.x, e.root.position.z) + 0.02;

  const moving = Math.hypot(mx, mz) > 0.05;
  e.speed = THREE.MathUtils.damp(e.speed, moving ? Math.hypot(mx, mz) : 0, 10, dt);
  if (e.flinch > 0) e.flinch = Math.max(0, e.flinch - dt * 3.2);
  const walk = moving ? 1 : 0;
  e.walkPhase += dt * (3.0 + e.speed * 2.2);
  const s1 = Math.sin(e.walkPhase);
  const c1 = Math.cos(e.walkPhase);
  const p = e.soldier;
  p.legs[0].hip.rotation.x = s1 * 0.62 * walk;
  p.legs[1].hip.rotation.x = -s1 * 0.62 * walk;
  p.legs[0].knee.rotation.x = Math.max(0, -Math.cos(e.walkPhase)) * 0.7 * walk;
  p.legs[1].knee.rotation.x = Math.max(0, Math.cos(e.walkPhase)) * 0.7 * walk;
  p.body.position.y = Math.abs(c1) * 0.045 * walk - e.flinch * 0.03;
  e.combatBlend = THREE.MathUtils.damp(e.combatBlend, e.engaged ? 1 : 0, 8, dt);
  e.aimPitch = THREE.MathUtils.lerp(
    e.aimPitch,
    e.engaged ? THREE.MathUtils.clamp(1.2 / Math.max(1, dist), -0.25, 0.15) : 0,
    dt * 5
  );
  p.rig.rotation.x = THREE.MathUtils.lerp(0, e.aimPitch, e.combatBlend);
  p.head.rotation.x = THREE.MathUtils.lerp(0, e.aimPitch * 0.5, e.combatBlend);
  for (let li = 0; li < 2; li++) {
    const arm = p.arms[li];
    arm.sh.rotation.x = THREE.MathUtils.lerp(arm.sh.rotation.x, e.engaged ? -0.55 : 0, dt * 8);
    arm.sh.rotation.z = THREE.MathUtils.lerp(
      arm.sh.rotation.z,
      e.engaged ? (li ? 0.25 : -0.2) : 0,
      dt * 8
    );
    arm.el.rotation.x = THREE.MathUtils.lerp(arm.el.rotation.x, e.engaged ? -0.6 : 0, dt * 8);
  }
  p.model.position.z = e.flinch * 0.14;
  p.model.rotation.x = e.flinch * 0.2;
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.root.scale.setScalar(1 + e.hitFlash * 0.6);
}
