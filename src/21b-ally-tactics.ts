'use strict';
/* =========================================================================
   16c. ALLY TACTICS — shared contacts, local avoidance and rejoin recovery
   ========================================================================= */
const _allyMove = new THREE.Vector3();

function allyTacticalGoal(a, e) {
  if (!e) {
    const f = ALLY_FORM[a.idx % ALLY_FORM.length],
      fy = player.yaw;
    return _allyMove.set(
      player.pos.x + Math.cos(fy) * f[0] + Math.sin(fy) * f[1],
      0,
      player.pos.z - Math.sin(fy) * f[0] + Math.cos(fy) * f[1]
    );
  }
  const away = Math.atan2(a.obj.position.z - e.obj.position.z, a.obj.position.x - e.obj.position.x),
    side = a.idx % 2 ? 1 : -1,
    arc = away + side * (a.tgtVisible ? 0.5 : 0.9),
    radius = a.tgtVisible ? 8 + (a.idx % 3) * 1.4 : 6.5;
  return _allyMove.set(
    e.obj.position.x + Math.cos(arc) * radius,
    0,
    e.obj.position.z + Math.sin(arc) * radius
  );
}

function selectAllyTarget(a) {
  let best = null,
    bestDist = 45;
  a.tgtVisible = false;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.obj.position.x - a.obj.position.x, e.obj.position.z - a.obj.position.z);
    if (
      d < bestDist &&
      allyLOS(a, _allyT.set(e.obj.position.x, e.obj.position.y + 1.3, e.obj.position.z))
    ) {
      best = e;
      bestDist = d;
      a.tgtVisible = true;
    }
  }
  /* A contact called by the squad remains useful even behind cover: allies
     spread toward it, but only the soldiers with their own line of sight fire. */
  if (!best) {
    for (const mate of allies) {
      const e = mate === a ? null : mate.tgt;
      if (!e || e.dead) continue;
      const d = Math.hypot(
        e.obj.position.x - a.obj.position.x,
        e.obj.position.z - a.obj.position.z
      );
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
  }
  return best;
}

function allyMoveSmart(a, goalX, goalZ, dt) {
  const obj = a.obj;
  if (a.detour) {
    if (Math.hypot(a.detour.x - obj.position.x, a.detour.z - obj.position.z) < 0.8) a.detour = null;
    else {
      goalX = a.detour.x;
      goalZ = a.detour.z;
    }
  }
  let dx = goalX - obj.position.x,
    dz = goalZ - obj.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 2.0) return { speed: 0, distance };
  dx /= distance;
  dz /= distance;

  /* Personal space stops five soldiers collapsing into a single doorway. */
  for (const mate of allies) {
    if (mate === a || mate.dead) continue;
    const ax = obj.position.x - mate.obj.position.x,
      az = obj.position.z - mate.obj.position.z,
      d = Math.hypot(ax, az);
    if (d > 0.05 && d < 1.45) {
      const push = (1.45 - d) * 0.85;
      dx += (ax / d) * push;
      dz += (az / d) * push;
    }
  }
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl;
  dz /= dl;

  const y0 = obj.position.y + 0.3,
    y1 = obj.position.y + 1.65;
  const open = (nx, nz) =>
    !blocked(obj.position.x + nx * 0.55, obj.position.z + nz * 0.55, y0, y1, 0.45) &&
    !blocked(obj.position.x + nx * 1.7, obj.position.z + nz * 1.7, y0, y1, 0.48);
  if (!open(dx, dz)) {
    const base = Math.atan2(dx, dz),
      side = a.avoidSide || (a.idx % 2 ? 1 : -1);
    let found = false;
    for (const turn of [0.55, 0.95, 1.4, 1.9]) {
      for (const sign of [side, -side]) {
        const angle = base + turn * sign,
          nx = Math.sin(angle),
          nz = Math.cos(angle);
        if (!open(nx, nz)) continue;
        dx = nx;
        dz = nz;
        a.avoidSide = sign;
        found = true;
        break;
      }
      if (found) break;
    }
    if (!found) {
      dx = -dx;
      dz = -dz;
      a.avoidSide = -side;
    }
  } else a.avoidSide = 0;

  const speed = distance > 17 ? 6.4 : distance > 8 ? 5.7 : a.tgt ? 3.7 : 3.3;
  moveSlide(obj.position, dx * speed * dt, dz * speed * dt, 0.42, 1.7);
  obj.position.x = clamp(obj.position.x, -HALF + 1, HALF - 1);
  obj.position.z = clamp(obj.position.z, -HALF + 1, HALF - 1);

  a.stuckT = (a.stuckT || 0) + dt;
  if (a.stuckT >= 0.55) {
    const moved = Math.hypot(
      obj.position.x - (a.stuckX ?? obj.position.x),
      obj.position.z - (a.stuckZ ?? obj.position.z)
    );
    a.stuckN = moved < 0.14 ? (a.stuckN || 0) + 1 : 0;
    a.stuckT = 0;
    a.stuckX = obj.position.x;
    a.stuckZ = obj.position.z;
    if (a.stuckN >= 2) {
      /* Choose a nearby side-step, never rewrite the soldier's position. */
      const side = a.avoidSide || (a.idx % 2 ? 1 : -1),
        f = nearestReachable(
          obj.position.x + dz * side * 2.8 + dx * 1.2,
          obj.position.z - dx * side * 2.8 + dz * 1.2,
          0.5,
          1.7,
          3.5
        );
      a.detour = { x: f[0], z: f[1] };
      a.avoidSide = -side;
      a.stuckN = 0;
    }
  }
  return { speed, distance };
}
