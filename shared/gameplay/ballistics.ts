import { weaponFamily } from './ids';
import { clamp } from './math';

export const LEG_MULTIPLIER = 0.78;

export type SurfaceKind = 'glass' | 'wood' | 'panel' | 'metal' | 'soft' | 'structure';

export interface SurfaceSpec {
  kind: SurfaceKind;
  resistance: number;
}

export interface PenetrationHit {
  id: string;
  liveEnemy: boolean;
  key?: string;
  transparent?: boolean;
  opacity?: number;
}

export interface PenetrationSurface {
  index: number;
  kind: SurfaceKind;
  penetrated: boolean;
}

export interface PenetrationResult {
  terminalIndex: number | null;
  enemy: boolean;
  surfaces: PenetrationSurface[];
  damageScale: number;
  energy: number;
}

const WOOD = new Set(['wood', 'woodDk', 'crate', 'card', 'bark']);
const PANEL = new Set(['sidY', 'sidB', 'trim', 'ceil', 'roof']);
const METAL = new Set([
  'container',
  'barrel',
  'metal',
  'darkMetal',
  'rust',
  'steel',
  'dark',
  'yellow',
  'green',
  'busGrn',
  'truckWh',
  'truckTl',
  'carPink',
  'carTeal',
  'red',
]);
const SOFT = new Set(['rubber', 'sack', 'plastic']);

export function ballisticSurfaceFromKey(
  key: string,
  transparent = false,
  opacity = 1
): SurfaceSpec {
  if (key.includes('glass') || key === 'fence' || key === 'leaf' || key === 'leaf2')
    return { kind: 'glass', resistance: 0.07 };
  if (WOOD.has(key)) return { kind: 'wood', resistance: 0.34 };
  if (PANEL.has(key)) return { kind: 'panel', resistance: 0.48 };
  if (METAL.has(key)) return { kind: 'metal', resistance: 0.58 };
  if (SOFT.has(key)) return { kind: 'soft', resistance: 0.22 };
  if (transparent && opacity < 0.65) return { kind: 'glass', resistance: 0.07 };
  return { kind: 'structure', resistance: Number.POSITIVE_INFINITY };
}

export function weaponPenetrationFor(id: string) {
  const family = weaponFamily(id);
  if (family === 'sniper') return 1.85;
  if (family === 'jug_gatling') return 1.45;
  if (family === 'ak' || family === 'lmg') return 1.16;
  if (family === 'rifle') return 1.02;
  if (family === 'p90') return 0.72;
  if (family === 'vector') return 0.66;
  if (family === 'pistol') return 0.54;
  return 0.28;
}

export function damageFalloff(dist: number, start: number, range: number, min: number) {
  return clamp(1 - Math.max(0, dist - start) / Math.max(1, range), min, 1);
}

export function partMultiplier(head: boolean, legs: boolean, headMult: number) {
  if (head) return headMult;
  if (legs) return LEG_MULTIPLIER;
  return 1;
}

export function tracePenetrations(hits: PenetrationHit[], weaponId: string): PenetrationResult {
  let energy = weaponPenetrationFor(weaponId);
  let damageScale = 1;
  const surfaces: PenetrationSurface[] = [];
  const visited = new Set<string>();
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (hit.liveEnemy) return { terminalIndex: i, enemy: true, surfaces, damageScale, energy };
    if (visited.has(hit.id)) continue;
    visited.add(hit.id);
    const surface = ballisticSurfaceFromKey(hit.key || '', !!hit.transparent, hit.opacity ?? 1);
    const penetrated = Number.isFinite(surface.resistance) && energy > surface.resistance;
    surfaces.push({ index: i, kind: surface.kind, penetrated });
    if (!penetrated) return { terminalIndex: i, enemy: false, surfaces, damageScale, energy: 0 };
    damageScale *= clamp(1 - (surface.resistance / energy) * 0.48, 0.28, 0.9);
    energy -= surface.resistance;
  }
  return { terminalIndex: null, enemy: false, surfaces, damageScale, energy };
}
