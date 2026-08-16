import type { Vec3, WorldQuery } from './types';

/** Axis-separated slide from src/13-map-apply.ts. Depenetration stays in the adapter. */
export function moveSlide(
  world: WorldQuery,
  pos: Vec3,
  dx: number,
  dz: number,
  radius: number,
  height: number
) {
  const y0 = pos.y + 0.3;
  const y1 = pos.y + height - 0.05;
  if (world.blocked(pos.x, pos.z, y0, y1, radius)) {
    pos.x += dx;
    pos.z += dz;
    world.depenetrate(pos, radius, y0, y1);
    return;
  }
  if (dx !== 0 && !world.blocked(pos.x + dx, pos.z, y0, y1, radius)) pos.x += dx;
  if (dz !== 0 && !world.blocked(pos.x, pos.z + dz, y0, y1, radius)) pos.z += dz;
}
