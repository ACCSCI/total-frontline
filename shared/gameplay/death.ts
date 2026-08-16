import { easeOutCubic, lerp, rand } from './math';

export const DEATH_DURATION = 0.85;
export const DEATH_GUN_DROP_AT = 0.14;
export const DEATH_GUN_GRAVITY = 17;
export const DEATH_GUN_FLOOR = 0.07;

export interface DeathBody {
  deathT: number;
  modelRotX: number;
  modelPosY: number;
  modelRotZ: number;
  dropGun: boolean;
  done: boolean;
}

export function stepDeathBody(deathT: number, dt: number): DeathBody {
  const next = Math.min(1, deathT + dt / DEATH_DURATION);
  const k = easeOutCubic(next);
  return {
    deathT: next,
    modelRotX: k * Math.PI * 0.5 * 0.98,
    modelPosY: -k * 0.1,
    modelRotZ: Math.sin(next * 4) * 0.08 * (1 - k),
    dropGun: next > DEATH_GUN_DROP_AT,
    done: next >= 1,
  };
}

export function deathLimbTargets(index: number, kind: 'leg' | 'arm') {
  if (kind === 'leg') {
    return { hipX: index ? 0.3 : -0.25, kneeX: 0.55, shX: 0, shZ: 0, elX: 0 };
  }
  return {
    hipX: 0,
    kneeX: 0,
    shX: index ? 0.6 : 0.35,
    shZ: (index ? 1 : -1) * 0.5,
    elX: 0.2,
  };
}

export function blendDeathLimb(cur: number, tgt: number, dt: number) {
  return lerp(cur, tgt, Math.min(1, dt * 6));
}

export function deathGunImpulse(rng = Math.random) {
  return {
    vx: rand(-1.6, 1.6),
    vy: rand(0.6, 1.8),
    vz: rand(-1.6, 1.6),
    avx: rand(-6, 6),
    avy: rand(-6, 6),
    avz: rand(-6, 6),
  };
}

export function stepDeathGun(
  g: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    avx: number;
    avy: number;
    avz: number;
  },
  dt: number
) {
  g.vy -= DEATH_GUN_GRAVITY * dt;
  g.x += g.vx * dt;
  g.y += g.vy * dt;
  g.z += g.vz * dt;
  let bounced = false;
  let settled = false;
  if (g.y <= DEATH_GUN_FLOOR) {
    g.y = DEATH_GUN_FLOOR;
    if (Math.abs(g.vy) < 0.7) settled = true;
    else {
      g.vy *= -0.32;
      g.vx *= 0.55;
      g.vz *= 0.55;
      g.avx *= 0.5;
      g.avy *= 0.5;
      g.avz *= 0.5;
      bounced = true;
    }
  }
  return { settled, bounced };
}

export function deathGunRestRotation(rng = Math.random) {
  return { x: rand(-0.1, 0.1), y: rand(0, 7), z: Math.PI / 2 + rand(-0.3, 0.3) };
}
