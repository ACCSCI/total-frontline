'use strict';
/* Bullet penetration is deliberately separate from movement collision and AI
   visibility. The numbers live in shared/gameplay/ballistics.ts. */

function hitMaterial(object) {
  return Array.isArray(object?.material) ? object.material[0] : object?.material;
}

function ballisticSurface(object) {
  const mat = hitMaterial(object);
  return Gameplay.ballisticSurfaceFromKey(
    mat?.userData?.surfaceKey || '',
    !!mat?.transparent,
    mat?.opacity ?? 1
  );
}

function weaponPenetration(w) {
  return Gameplay.weaponPenetrationFor(w.id);
}

function traceBulletPath(hits, w) {
  const mapped = [];
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const enemy = hit.object?.userData?.enemy;
    const mat = hitMaterial(hit.object);
    mapped.push({
      id: `${hit.object.uuid}:${hit.instanceId ?? -1}`,
      liveEnemy: !!(enemy && !enemy.dead),
      key: mat?.userData?.surfaceKey || '',
      transparent: !!mat?.transparent,
      opacity: mat?.opacity ?? 1,
    });
  }
  const result = Gameplay.tracePenetrations(mapped, w.id);
  return {
    terminal: result.terminalIndex == null ? null : hits[result.terminalIndex],
    enemy: result.enemy,
    surfaces: result.surfaces.map((s) => ({
      hit: hits[s.index],
      kind: s.kind,
      penetrated: s.penetrated,
    })),
    damageScale: result.damageScale,
    energy: result.energy,
  };
}
