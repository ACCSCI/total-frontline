import * as THREE from 'three';
import {
  blendDeathLimb,
  burstGap,
  combatSteer,
  deathGunImpulse,
  deathGunRestRotation,
  deathLimbTargets,
  ENEMY_SIGHT,
  enemyPlayerDamage,
  hearSpike,
  inEnemyFov,
  nextBurstCount,
  nextReactionDelay,
  patrolOffset,
  rollEnemyTactic,
  sightDetectRate,
  stepDeathBody,
  stepDeathGun,
} from '../../shared/gameplay';
import type { Enemy } from './campaign';
import type { LevelObstacle, P0Level } from './level';
import { poseCampaignSoldier } from './soldier-anim';

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

export function animateEnemyDeath(scene: THREE.Scene, e: Enemy, dt: number) {
  const body = stepDeathBody(e.deathT, dt);
  e.deathT = body.deathT;
  const p = e.soldier;
  p.model.rotation.x = body.modelRotX;
  p.model.position.y = body.modelPosY;
  p.model.rotation.z = body.modelRotZ;
  p.legs.forEach((l, i) => {
    const t = deathLimbTargets(i, 'leg');
    l.hip.rotation.x = blendDeathLimb(l.hip.rotation.x, t.hipX, dt);
    l.knee.rotation.x = blendDeathLimb(l.knee.rotation.x, t.kneeX, dt);
  });
  p.arms.forEach((a, i) => {
    const t = deathLimbTargets(i, 'arm');
    a.sh.rotation.x = blendDeathLimb(a.sh.rotation.x, t.shX, dt);
    a.sh.rotation.z = blendDeathLimb(a.sh.rotation.z, t.shZ, dt);
    a.el.rotation.x = blendDeathLimb(a.el.rotation.x, t.elX, dt);
  });
  p.rig.rotation.x = blendDeathLimb(p.rig.rotation.x, 0, dt);
  if (!e.gunDropped && body.dropGun) {
    e.gunDropped = true;
    scene.attach(p.gun);
    const kick = deathGunImpulse();
    e.gunVel = new THREE.Vector3(kick.vx, kick.vy, kick.vz);
    e.gunAV = new THREE.Vector3(kick.avx, kick.avy, kick.avz);
  }
  if (e.gunDropped && e.gunVel && e.gunAV) {
    const g = {
      x: p.gun.position.x,
      y: p.gun.position.y,
      z: p.gun.position.z,
      vx: e.gunVel.x,
      vy: e.gunVel.y,
      vz: e.gunVel.z,
      avx: e.gunAV.x,
      avy: e.gunAV.y,
      avz: e.gunAV.z,
    };
    const result = stepDeathGun(g, dt);
    p.gun.position.set(g.x, g.y, g.z);
    e.gunVel.set(g.vx, g.vy, g.vz);
    e.gunAV.set(g.avx, g.avy, g.avz);
    p.gun.rotation.x += g.avx * dt;
    p.gun.rotation.y += g.avy * dt;
    p.gun.rotation.z += g.avz * dt;
    if (result.settled) {
      e.gunVel = null;
      const rest = deathGunRestRotation();
      p.gun.rotation.set(rest.x, rest.y, rest.z);
    }
  }
}

export interface EnemySense {
  crouch: boolean;
  prone: boolean;
  sprint: boolean;
  stealth: boolean;
  suppressedShot: boolean;
  loudShot: boolean;
}

export interface EnemyAIHost {
  level: P0Level;
  hurtPlayer(amount: number, shooter?: Enemy): void;
  onSpotted(enemy: Enemy): void;
  alertNeighbors(source: Enemy, radius: number): void;
  onEnemyMuzzleFlash?(enemy: Enemy): void;
}

export function updateCampaignEnemy(
  host: EnemyAIHost,
  e: Enemy,
  dt: number,
  playerPos: THREE.Vector3,
  sense: EnemySense
) {
  e.phase += dt;
  const px = e.root.position.x;
  const pz = e.root.position.z;
  const dx = playerPos.x - px;
  const dz = playerPos.z - pz;
  const dist = Math.hypot(dx, dz) || 1;
  if (e.flinch > 0.35) {
    e.suspicion = 1;
    e.engaged = true;
    e.lastSeenT = 4;
    e.lastSeenX = playerPos.x;
    e.lastSeenZ = playerPos.z;
  }
  const facingX = Math.sin(e.root.rotation.y);
  const facingZ = Math.cos(e.root.rotation.y);
  const inFov = inEnemyFov(facingX, facingZ, dx, dz, e.engaged || e.suspicion > 0.55);
  const sightRange = ENEMY_SIGHT * (sense.prone ? 0.5 : sense.crouch ? 0.72 : 1);
  const hasLos =
    dist < sightRange && !losBlocked(e.root.position, playerPos, host.level.obstacles);
  const canSee = hasLos && (inFov || e.engaged);
  e.suspicion = THREE.MathUtils.clamp(
    e.suspicion +
      sightDetectRate({
        dist,
        inFov,
        hasLos,
        crouched: sense.crouch,
        prone: sense.prone,
        sprinting: sense.sprint,
      }) *
        dt +
      hearSpike(dist, sense.sprint, sense.suppressedShot, sense.loudShot),
    0,
    1
  );
  if (canSee) {
    e.lastSeenT = 4.4;
    e.lastSeenX = playerPos.x;
    e.lastSeenZ = playerPos.z;
  } else {
    e.lastSeenT = Math.max(0, e.lastSeenT - dt);
  }
  if (!e.engaged && e.suspicion >= 1) {
    e.engaged = true;
    e.reactionT = sense.stealth ? 0 : nextReactionDelay() * 0.7;
    host.alertNeighbors(e, 16);
    if (sense.stealth) host.onSpotted(e);
  }
  if (e.engaged && e.lastSeenT <= 0 && e.suspicion < 0.2) {
    e.engaged = false;
    e.reactionT = nextReactionDelay();
  }
  e.root.visible = dist < ENEMY_SIGHT || e.engaged;

  let mx = 0;
  let mz = 0;
  const hunting = e.engaged || e.suspicion > 0.4;
  if (hunting) {
    e.tacticT -= dt;
    if (e.tacticT <= 0) {
      e.tacticT = 1.6 + Math.random() * 1.8;
      e.tactic = e.kind === 'nco' ? 'flank' : rollEnemyTactic();
      e.strafeDir *= -1;
    }
    const aimX = canSee ? dx : e.lastSeenX - px;
    const aimZ = canSee ? dz : e.lastSeenZ - pz;
    const aimDist = Math.hypot(aimX, aimZ) || 1;
    const behindCover = losBlocked(e.root.position, playerPos, host.level.obstacles);
    const tactic = !canSee ? 'push' : behindCover && e.reloadT > 0 ? 'hold' : e.tactic;
    const steer = combatSteer(canSee ? dist : aimDist, tactic, e.strafeDir, aimX, aimZ);
    const ml = Math.hypot(steer.mx, steer.mz) || 1;
    let speed = steer.speed;
    if (e.reloadT > 0) speed *= 0.62;
    if (!canSee) speed *= 1.16;
    if (e.suspicion > 0.4 && !e.engaged) speed *= 0.7;
    mx = (steer.mx / ml) * speed;
    mz = (steer.mz / ml) * speed;
    if (e.engaged) {
      if (e.reloadT > 0) {
        e.reloadT -= dt;
        e.burst = 0;
        if (e.reloadT <= 0) e.rounds = 30;
      } else if (canSee && (e.kind !== 'shotgun' || dist < 14)) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          if (e.burst > 0) {
            e.burst--;
            e.rounds--;
            const dmg = enemyPlayerDamage(dist) * (e.kind === 'shotgun' ? 1.45 : 1);
            host.onEnemyMuzzleFlash?.(e);
            host.hurtPlayer(dmg, e);
            e.fireT = burstGap(e.burst > 0);
            if (e.rounds <= 0) {
              e.burst = 0;
              e.reloadT = 1.7 + Math.random() * 0.8;
            }
          } else {
            e.burst = nextBurstCount();
            e.fireT = 0.03;
          }
        }
      }
    }
  } else {
    e.patrolT += dt;
    e.lookScan = Math.sin(e.phase * 0.7) * 0.35;
    const dest = patrolOffset(e.patrolT, e.baseX, e.baseZ, e.patrolScale || 1);
    const pdx = dest.x - px;
    const pdz = dest.z - pz;
    const pl = Math.hypot(pdx, pdz);
    if (pl > 0.3) {
      mx = (pdx / pl) * 0.85;
      mz = (pdz / pl) * 0.85;
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
  e.stuckT += dt;
  if (e.stuckT >= 0.5) {
    const moved = Math.hypot(e.root.position.x - e.stuckX, e.root.position.z - e.stuckZ);
    if (Math.hypot(mx, mz) > 0.2 && moved < 0.2) {
      e.strafeDir *= -1;
      e.tactic = 'flank';
      e.tacticT = 1.2;
    }
    e.stuckT = 0;
    e.stuckX = e.root.position.x;
    e.stuckZ = e.root.position.z;
  }
  if (hunting) {
    e.root.rotation.y = Math.atan2(canSee ? dx : e.lastSeenX - px, canSee ? dz : e.lastSeenZ - pz);
    e.lookScan = 0;
  } else if (Math.hypot(mx, mz) > 0.05) e.root.rotation.y = Math.atan2(mx, mz);

  const moving = Math.hypot(mx, mz) > 0.05;
  e.speed = THREE.MathUtils.damp(e.speed, moving ? Math.hypot(mx, mz) : 0, 10, dt);
  if (e.flinch > 0) e.flinch = Math.max(0, e.flinch - dt * 3.2);
  e.walkPhase += dt * (3.0 + e.speed * 2.2);
  poseCampaignSoldier(e, dt, dist);
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.root.scale.setScalar(1 + e.hitFlash * 0.6);
}
