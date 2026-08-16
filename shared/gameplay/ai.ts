import { clamp, rand, randI } from './math';

export const ENEMY_SIGHT = 52;
export const ENEMY_HP = 100;
export const ENEMY_REACTION_MIN = 0.3;
export const ENEMY_REACTION_MAX = 0.8;
export const ENEMY_BURST_GAP = [0.11, 0.15] as const;
export const ENEMY_BURST_REST = [0.85, 1.9] as const;

export type EnemyTactic = 'hold' | 'flank' | 'push';
export type EnemyPhase = 'patrol' | 'alert' | 'combat';

export function rollEnemyTactic(rng = Math.random): EnemyTactic {
  const r = rng();
  return r < 0.42 ? 'hold' : r < 0.72 ? 'flank' : 'push';
}

export function enemyPlayerDamage(dist: number, rng = Math.random) {
  return (5.5 + rng() * 3.5) * clamp(1 - Math.max(0, dist - 25) / 55, 0.5, 1);
}

export function nextReactionDelay(rng = Math.random) {
  return ENEMY_REACTION_MIN + rng() * (ENEMY_REACTION_MAX - ENEMY_REACTION_MIN);
}

export function nextBurstCount(rng = Math.random) {
  return randI(2, 4);
}

export function combatSteer(
  dist: number,
  tactic: EnemyTactic,
  strafeDir: number,
  dx: number,
  dz: number
) {
  const inv = 1 / (dist || 1);
  const fx = dx * inv;
  const fz = dz * inv;
  const sx = -fz * strafeDir;
  const sz = fx * strafeDir;
  if (tactic === 'flank') {
    const closeness = clamp((dist - 12) / 9, -1, 1);
    return { mx: sx + fx * closeness * 0.5, mz: sz + fz * closeness * 0.5, speed: 3.5 };
  }
  if (tactic === 'push') {
    const closeness = clamp((dist - 8.5) / 7, -1, 1);
    return {
      mx: sx * 0.55 + fx * closeness * 1.1,
      mz: sz * 0.55 + fz * closeness * 1.1,
      speed: 3.3,
    };
  }
  return { mx: sx * 0.85, mz: sz * 0.85, speed: 2.5 };
}

/** Single-player unalerted cone: forward · toTarget >= 0.2. Alerted skips FOV. */
export function inEnemyFov(
  forwardX: number,
  forwardZ: number,
  toX: number,
  toZ: number,
  alerted: boolean
) {
  if (alerted) return true;
  const fl = Math.hypot(forwardX, forwardZ) || 1;
  const tl = Math.hypot(toX, toZ) || 1;
  return (forwardX * toX + forwardZ * toZ) / (fl * tl) >= 0.2;
}

export function patrolOffset(t: number, baseX: number, baseZ: number, scale = 1) {
  return {
    x: baseX + Math.sin(t * 0.55) * 2.4 * scale,
    z: baseZ + Math.cos(t * 0.4) * 1.8 * scale,
  };
}

export function burstGap(continuing: boolean, rng = Math.random) {
  return continuing
    ? rand(ENEMY_BURST_GAP[0], ENEMY_BURST_GAP[1])
    : rand(ENEMY_BURST_REST[0], ENEMY_BURST_REST[1]);
}
