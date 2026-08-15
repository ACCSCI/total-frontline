'use strict';
/* Bullet penetration is deliberately separate from movement collision and AI
   visibility. A wall may stop a player and hide an enemy while still allowing
   a sufficiently energetic round to punch through it at reduced damage. */
function ballisticSurface(object) {
  const mat = Array.isArray(object?.material) ? object.material[0] : object?.material;
  const key = mat?.userData?.surfaceKey || '';
  if (key.includes('glass') || key === 'fence' || key === 'leaf' || key === 'leaf2')
    return { kind: 'glass', resistance: 0.07 };
  if (['wood', 'woodDk', 'crate', 'card', 'bark'].includes(key))
    return { kind: 'wood', resistance: 0.34 };
  if (['sidY', 'sidB', 'trim', 'ceil', 'roof'].includes(key))
    return { kind: 'panel', resistance: 0.48 };
  if (
    [
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
    ].includes(key)
  )
    return { kind: 'metal', resistance: 0.58 };
  if (key === 'rubber' || key === 'sack' || key === 'plastic')
    return { kind: 'soft', resistance: 0.22 };
  if (mat?.transparent && mat.opacity < 0.65) return { kind: 'glass', resistance: 0.07 };
  return { kind: 'structure', resistance: Infinity };
}

function weaponPenetration(w) {
  if (w.id === 'sniper') return 1.85;
  if (w.id === 'jug_gatling') return 1.45;
  if (w.id === 'ak' || w.id === 'lmg') return 1.16;
  if (w.id === 'rifle') return 1.02;
  if (w.id === 'p90') return 0.72;
  if (w.id === 'vector') return 0.66;
  if (w.id === 'pistol') return 0.54;
  return 0.28; // buckshot: glass and light cover only
}

function traceBulletPath(hits, w) {
  let energy = weaponPenetration(w),
    damageScale = 1;
  const surfaces = [],
    visited = new Set();
  for (const hit of hits) {
    const enemy = hit.object?.userData?.enemy;
    if (enemy && !enemy.dead)
      return { terminal: hit, enemy: true, surfaces, damageScale, energy };
    const surfaceId = `${hit.object.uuid}:${hit.instanceId ?? -1}`;
    if (visited.has(surfaceId)) continue;
    visited.add(surfaceId);
    const surface = ballisticSurface(hit.object),
      penetrated = Number.isFinite(surface.resistance) && energy > surface.resistance;
    surfaces.push({ hit, kind: surface.kind, penetrated });
    if (!penetrated)
      return { terminal: hit, enemy: false, surfaces, damageScale, energy: 0 };
    damageScale *= clamp(1 - (surface.resistance / energy) * 0.48, 0.28, 0.9);
    energy -= surface.resistance;
  }
  return { terminal: null, enemy: false, surfaces, damageScale, energy };
}
