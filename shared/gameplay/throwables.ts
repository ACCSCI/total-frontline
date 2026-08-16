import { clamp } from './math';

export type ThrowableKind = 'lethal' | 'tactical';

export const THROW_SPEED = 13;
export const THROW_LIFT = 5.5;
export const THROW_GRAVITY = 12;
export const THROW_LIFE = 4;
export const THROWABLE_MAX = 3;
export const THROWABLE_START_LETHAL = 1;
export const THROWABLE_START_TACTICAL = 1;
export const LETHAL_ENEMY_RADIUS = 6.5;
export const LETHAL_PLAYER_RADIUS = 5;

export interface ThrowInventory {
  lethals: number;
  tacticals: number;
  max: number;
}

export interface FlyingThrow {
  kind: ThrowableKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export function createThrowInventory(
  lethals = THROWABLE_START_LETHAL,
  tacticals = THROWABLE_START_TACTICAL,
  max = THROWABLE_MAX
): ThrowInventory {
  return { lethals, tacticals, max };
}

export function canThrow(inv: ThrowInventory, kind: ThrowableKind) {
  return kind === 'lethal' ? inv.lethals > 0 : inv.tacticals > 0;
}

export function consumeThrow(inv: ThrowInventory, kind: ThrowableKind) {
  if (!canThrow(inv, kind)) return false;
  if (kind === 'lethal') inv.lethals--;
  else inv.tacticals--;
  return true;
}

export function addThrowables(inv: ThrowInventory, amount = 1) {
  inv.lethals = Math.min(inv.max, inv.lethals + amount);
  inv.tacticals = Math.min(inv.max, inv.tacticals + amount);
}

export function spawnThrow(
  kind: ThrowableKind,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number
): FlyingThrow {
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    kind,
    x: ox + (dx / len) * 0.7,
    y: oy + (dy / len) * 0.7 - 0.2,
    z: oz + (dz / len) * 0.7,
    vx: (dx / len) * THROW_SPEED,
    vy: (dy / len) * THROW_SPEED + THROW_LIFT,
    vz: (dz / len) * THROW_SPEED,
    life: THROW_LIFE,
  };
}

export function stepThrow(t: FlyingThrow, dt: number, groundY: number): 'flying' | 'detonate' {
  t.life -= dt;
  t.vy -= THROW_GRAVITY * dt;
  t.x += t.vx * dt;
  t.y += t.vy * dt;
  t.z += t.vz * dt;
  if (t.life <= 0 || t.y <= groundY + 0.06) return 'detonate';
  return 'flying';
}

export function lethalEnemyDamage(dist: number) {
  if (dist >= LETHAL_ENEMY_RADIUS) return 0;
  return 400 * clamp(1 - dist / 8, 0.35, 1);
}

export function lethalPlayerDamage(dist: number) {
  if (dist >= LETHAL_PLAYER_RADIUS) return 0;
  return 60 * clamp(1 - dist / 6, 0.3, 1);
}
