import type { Vec3, WorldQuery } from '../../shared/gameplay';
import type { P0Level } from './level';

/** Valley adapter: heightfield + infinite cylinders. No Three types leak into gameplay. */
export function makeCampaignWorld(level: P0Level): WorldQuery {
  return {
    groundY(x, z, probeY) {
      let y = level.groundY(x, z);
      for (const o of level.climbables) {
        const dx = x - o.x;
        const dz = z - o.z;
        const rr = o.climbR ?? o.r;
        if (dx * dx + dz * dz > rr * rr) continue;
        if (probeY !== undefined && (o.topY ?? 0) > probeY + 0.02) continue;
        if ((o.topY ?? 0) > y) y = o.topY ?? 0;
      }
      if (probeY !== undefined && y > probeY) return null;
      return y;
    },
    ceilingY() {
      return Number.POSITIVE_INFINITY;
    },
    blocked(x, z, y0, _y1, radius) {
      for (const o of level.obstacles) {
        if (o.topY !== undefined && y0 >= o.topY - 0.02) continue;
        const dx = x - o.x;
        const dz = z - o.z;
        const min = o.r + radius;
        if (dx * dx + dz * dz < min * min) return true;
      }
      return false;
    },
    depenetrate(pos, radius, y0, _y1) {
      for (let pass = 0; pass < 2; pass++) {
        let moved = false;
        for (const o of level.obstacles) {
          if (o.topY !== undefined && y0 >= o.topY - 0.02) continue;
          const dx = pos.x - o.x;
          const dz = pos.z - o.z;
          const min = o.r + radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= min * min || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          pos.x = o.x + (dx / d) * min;
          pos.z = o.z + (dz / d) * min;
          moved = true;
        }
        if (!moved) break;
      }
      void (y0 + _y1);
    },
    clampHorizontal(pos: Vec3, padding) {
      pos.x = Math.min(level.bounds.maxX - padding, Math.max(level.bounds.minX + padding, pos.x));
      pos.z = Math.min(level.bounds.maxZ - padding, Math.max(level.bounds.minZ + padding, pos.z));
    },
  };
}
