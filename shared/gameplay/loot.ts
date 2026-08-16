/** Enemy drops, ground ammo, and F-to-swap. Both shooters import this. */

export type LootKind = 'weapon' | 'ammo' | 'lootWeapon';

export const LOOT_WEAPON_RANGE = 2.4;
export const LOOT_AMMO_RANGE = 2.2;
export const ENEMY_DROP_WEAPON_CHANCE = 0.55;
export const ENEMY_DROP_WEAPON_POOL = ['ak12', 'p90'] as const;
export const AMMO_PICKUP_AMOUNT = 60;
export const AMMO_PICKUP_COOLDOWN_MS = 15000;

export interface LootQuery {
  kind: LootKind;
  x: number;
  z: number;
  coolUntil: number;
  weaponId?: string;
}

export function ammoLootLabel(fromEnemy: boolean) {
  return fromEnemy ? '敌人弹药' : '弹药补给';
}

export function weaponLootLabel(name: string, replace: boolean, slot = 2) {
  return `F ${replace ? '替换' : '拾取'} 主武器 ${slot} — ${name}`;
}

export function nearestWeaponLootIndex(items: LootQuery[], px: number, pz: number, now: number) {
  let best = -1;
  let bestD = LOOT_WEAPON_RANGE;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (p.kind === 'ammo' || p.coolUntil > now || !p.weaponId) continue;
    const d = Math.hypot(p.x - px, p.z - pz);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function shouldAutoPickupAmmo(dist: number, coolUntil: number, now: number) {
  return dist < LOOT_AMMO_RANGE && coolUntil <= now;
}

export function nextAmmoCooldown(now: number) {
  return now + AMMO_PICKUP_COOLDOWN_MS;
}

export function rollEnemyDrops(rng = Math.random): { ammo: boolean; weaponId: string | null } {
  const weaponId =
    rng() < ENEMY_DROP_WEAPON_CHANCE
      ? ENEMY_DROP_WEAPON_POOL[(rng() * ENEMY_DROP_WEAPON_POOL.length) | 0]
      : null;
  return { ammo: true, weaponId };
}

/** Swap the ground gun with whatever is in the active slot. */
export function interactGroundWeapon(
  groundWeaponId: string,
  currentWeaponId: string | null
): { take: string; leave: string | null } {
  return { take: groundWeaponId, leave: currentWeaponId };
}
