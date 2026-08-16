import { isShotgun, weaponFamily } from './ids';

export interface FireWeapon {
  id: string;
  auto: boolean;
  semi: boolean;
  mag: number;
  reserve: number;
  rpm: number;
  pumpTime?: number;
  boltTime?: number;
  spread: number;
  spreadMax: number;
  spreadShot: number;
}

export type FireKind = 'blocked' | 'dry' | 'reload' | 'fired';

export interface FireResult {
  kind: FireKind;
  pump?: boolean;
  bolt?: boolean;
  emptyAutoReload?: boolean;
}

export function isFullAuto(w: FireWeapon) {
  return w.auto && !w.semi;
}

export function tryConsumeShot(
  w: FireWeapon,
  triggerReleased: boolean,
  blocked: boolean
): FireResult {
  if (blocked) return { kind: 'blocked' };
  if (!isFullAuto(w) && !triggerReleased) return { kind: 'blocked' };
  if (w.mag <= 0) {
    if (triggerReleased && w.reserve > 0) return { kind: 'reload' };
    return { kind: 'dry' };
  }
  w.mag--;
  w.spread = Math.min(w.spreadMax, w.spread + w.spreadShot);
  const family = weaponFamily(w.id);
  if (isShotgun(w.id)) return { kind: 'fired', pump: true };
  if (family === 'sniper') return { kind: 'fired', bolt: true };
  if (w.mag === 0) return { kind: 'fired', emptyAutoReload: true };
  return { kind: 'fired' };
}

export function fireInterval(rpm: number) {
  return 60 / Math.max(1, rpm);
}

export const SPRINT_FIRE_RAISE = 0.11;
