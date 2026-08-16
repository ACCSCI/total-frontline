import { clamp, PI } from './math';

/** World bearing of a hit, relative to view forward. Same as single-player arcs. */
export function damageBearing(
  fromX: number,
  fromZ: number,
  camX: number,
  camZ: number,
  yaw: number
) {
  return Math.atan2(fromX - camX, fromZ - camZ) - (yaw + PI);
}

export function damageFlashAmount(amount: number) {
  return Math.min(0.72, clamp(amount / 30, 0.22, 0.55));
}

export function damageShakeAmount(amount: number) {
  return clamp(amount / 24, 0.18, 0.6);
}

export function lowHealthPulse(hp: number, timeMs: number, pulse: number) {
  if (hp >= 20 || hp <= 0) return 0;
  return pulse * (0.55 + 0.45 * Math.sin(timeMs * 0.006));
}
