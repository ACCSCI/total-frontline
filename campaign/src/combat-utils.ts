import * as THREE from 'three';
import {
  blendDeathLimb,
  burstGap,
  clamp,
  combatSteer,
  deathGunImpulse,
  deathGunRestRotation,
  deathLimbTargets,
  ENEMY_SIGHT,
  enemyPlayerDamage,
  hearSpike,
  inEnemyFov,
  lerp,
  nextBurstCount,
  nextReactionDelay,
  patrolOffset,
  randI,
  rollEnemyTactic,
  sightDetectRate,
  stepDeathBody,
  stepDeathGun,
} from '../../shared/gameplay';
import type { Enemy } from './campaign';
import { spawnTracer } from './fx';
import type { LevelObstacle, P0Level } from './level';
import { SFX } from './sfx';
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

const _muzzleWorld = new THREE.Vector3();
const _aimWorld = new THREE.Vector3();
const _shotEnd = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _shotRight = new THREE.Vector3();
const _shotUp = new THREE.Vector3(0, 1, 0);

function enemyWeaponId(e: Enemy) {
  return e.kind === 'shotgun' ? 'ks12' : e.kind === 'nco' ? 'ak12' : 'm4';
}

function enemyShotPan(enemyX: number, playerX: number) {
  return clamp((enemyX - playerX) / 14, -1, 1);
}

function pointInsideObstacle(
  x: number,
  z: number,
  obstacles: LevelObstacle[],
  skip: LevelObstacle | null,
  radius: number
) {
  for (const o of obstacles) {
    if (o === skip) continue;
    const min = o.r + radius;
    const dx = x - o.x;
    const dz = z - o.z;
    if (dx * dx + dz * dz < min * min) return true;
  }
  return false;
}

function pickCampaignCover(
  host: EnemyAIHost,
  enemy: Enemy,
  targetX: number,
  targetZ: number
): { x: number; z: number } | null {
  const ex = enemy.root.position.x;
  const ez = enemy.root.position.z;
  let best: { x: number; z: number } | null = null;
  let bestScore = Infinity;
  for (const o of host.level.obstacles) {
    const ox = o.x - targetX;
    const oz = o.z - targetZ;
    const dp = Math.hypot(ox, oz);
    if (dp < 5 || dp > 30) continue;
    const de = Math.hypot(ex - o.x, ez - o.z);
    if (de > 26) continue;
    const inv = 1 / (dp || 1);
    const cx = o.x + ox * inv * (o.r + 0.85);
    const cz = o.z + oz * inv * (o.r + 0.85);
    if (
      cx < host.level.bounds.minX + 0.8 ||
      cx > host.level.bounds.maxX - 0.8 ||
      cz < host.level.bounds.minZ + 0.8 ||
      cz > host.level.bounds.maxZ - 0.8
    )
      continue;
    if (pointInsideObstacle(cx, cz, host.level.obstacles, o, 0.5)) continue;
    const score = de + Math.abs(dp - 13) * 0.8;
    if (score < bestScore) {
      bestScore = score;
      best = { x: cx, z: cz };
    }
  }
  return best;
}

/**
 * Single-player enemy gun model ported to campaign: every round is traced with
 * human-ish error instead of being an automatic hit. Opening bursts are wide
 * and tighten over ~5.5s of continuous contact. Suppressive rounds never cost
 * health directly — they are noise/light only, like firing into a wall.
 */
function fireCampaignRound(
  host: EnemyAIHost,
  e: Enemy,
  playerPos: THREE.Vector3,
  dist: number,
  aimX: number,
  aimZ: number,
  sense: EnemySense,
  suppressing: boolean
) {
  e.soldier.gunMuzzle.getWorldPosition(_muzzleWorld);
  host.onEnemyMuzzleFlash?.(e);
  _aimWorld.set(aimX, _muzzleWorld.y + 0.08, aimZ);
  _shotDir.subVectors(_aimWorld, _muzzleWorld);
  if (_shotDir.lengthSq() < 1e-6) _shotDir.set(0, 0, -1);
  else _shotDir.normalize();
  _shotRight.crossVectors(_shotDir, _shotUp).normalize();

  const speed =
    sense.playerSpeed ?? (sense.sprint ? 5.5 : sense.prone ? 0.4 : sense.crouch ? 1.2 : 2.2);
  const warm = suppressing ? 2.2 : lerp(1.55, 0.8, clamp(e.engage / 5.5, 0, 1));
  const err = 0.04 * warm * (1 + dist * 0.028) * (1 + speed * 0.075) * (sense.crouch ? 1.15 : 1);
  const angle = Math.random() * Math.PI * 2;
  const lateral = Math.sqrt(Math.random()) * err * 2.4 * dist;
  const missX = Math.cos(angle) * lateral;
  const missY = Math.sin(angle) * lateral * 0.4;
  const hit = !suppressing && lateral < 0.55;

  _shotEnd
    .copy(_muzzleWorld)
    .addScaledVector(_shotDir, Math.max(4, dist + 3))
    .addScaledVector(_shotRight, missX)
    .addScaledVector(_shotUp, missY);
  spawnTracer(host.scene, _muzzleWorld, _shotEnd, 0xff9a5a, false);

  if (hit) {
    const dmg = enemyPlayerDamage(dist) * (e.kind === 'shotgun' ? 1.45 : 1);
    host.hurtPlayer(dmg, e);
  } else {
    SFX.gunshotAt(
      enemyWeaponId(e),
      enemyShotPan(_muzzleWorld.x, playerPos.x),
      Math.max(1, dist),
      false
    );
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
  /** Optional: exact horizontal speed. Falls back to stance estimate. */
  playerSpeed?: number;
}

export interface EnemyAIHost {
  scene: THREE.Scene;
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
  const hasLos = dist < sightRange && !losBlocked(e.root.position, playerPos, host.level.obstacles);
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
      e.hasCover = false;
    }
    const aimX = canSee ? dx : e.lastSeenX - px;
    const aimZ = canSee ? dz : e.lastSeenZ - pz;
    const aimDist = Math.hypot(aimX, aimZ) || 1;
    const behindCover = losBlocked(e.root.position, playerPos, host.level.obstacles);
    const tactic = !canSee ? 'push' : behindCover && e.reloadT > 0 ? 'hold' : e.tactic;
    const sideX = -aimZ / aimDist;
    const sideZ = aimX / aimDist;
    let speed = 0;
    let covering = false;
    if (e.engaged && tactic === 'hold') {
      if (!e.hasCover) {
        const cover = pickCampaignCover(host, e, playerPos.x, playerPos.z);
        if (cover) {
          e.coverX = cover.x;
          e.coverZ = cover.z;
          e.hasCover = true;
        }
      }
      if (e.hasCover) {
        covering = true;
        const cdx = e.coverX - px;
        const cdz = e.coverZ - pz;
        const coverDist = Math.hypot(cdx, cdz) || 1;
        if (coverDist > 1.1) {
          mx = (cdx / coverDist) * (e.kind === 'nco' ? 2.0 : 3.4);
          mz = (cdz / coverDist) * (e.kind === 'nco' ? 2.0 : 3.4);
          speed = e.kind === 'nco' ? 2.0 : 3.4;
        } else {
          mx = sideX * e.strafeDir * 1.1;
          mz = sideZ * e.strafeDir * 1.1;
          speed = 1.1;
        }
      }
    }
    if (!covering) {
      const steer = combatSteer(canSee ? dist : aimDist, tactic, e.strafeDir, aimX, aimZ);
      const ml = Math.hypot(steer.mx, steer.mz) || 1;
      speed = steer.speed;
      if (e.reloadT > 0) speed *= 0.62;
      if (!canSee) speed *= 1.16;
      if (e.suspicion > 0.4 && !e.engaged) speed *= 0.7;
      mx = (steer.mx / ml) * speed;
      mz = (steer.mz / ml) * speed;
    } else if (e.reloadT > 0) speed *= 0.62;
    if (canSee) {
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = 0.7 + Math.random() * 1.2;
        if (Math.random() < 0.55) e.strafeDir *= -1;
      }
    }
    if (e.engaged && canSee) e.engage = Math.min(6, e.engage + dt);
    else if (e.engaged) e.engage = Math.max(0, e.engage - dt * 0.6);

    if (e.engaged) {
      if (e.reloadT > 0) {
        e.reloadT -= dt;
        e.burst = 0;
        if (e.reloadT <= 0) {
          e.rounds = 30;
          e.hasCover = false;
        }
      } else if (canSee && (e.kind !== 'shotgun' || dist < 14)) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          if (e.burst > 0) {
            e.burst--;
            e.rounds--;
            fireCampaignRound(host, e, playerPos, dist, dx, dz, sense, false);
            e.fireT = burstGap(e.burst > 0);
            if (e.rounds <= 0) {
              e.burst = 0;
              e.reloadT = 1.7 + Math.random() * 0.8;
              e.hasCover = false;
            }
          } else {
            e.burst = nextBurstCount();
            e.fireT = 0.03;
          }
        }
      } else if (!canSee) {
        e.fireT -= dt;
        if (e.suppress > 0 && e.fireT <= 0 && aimDist > 3) {
          e.suppress--;
          e.rounds--;
          fireCampaignRound(host, e, playerPos, aimDist, e.lastSeenX, e.lastSeenZ, sense, true);
          e.fireT = e.suppress > 0 ? 0.12 + Math.random() * 0.06 : 1.4 + Math.random() * 1.2;
          if (e.rounds <= 0) {
            e.reloadT = 1.7 + Math.random() * 0.8;
            e.suppress = 0;
          }
        } else if (e.fireT <= 0 && e.lastSeenT < 2.2 && Math.random() < 0.02) {
          e.suppress = randI(2, 4);
        }
        e.burst = 0;
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
