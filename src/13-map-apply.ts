'use strict';
function applyMap(rec) {
  if (CUR === rec) return;
  CUR = rec;
  colliders = rec.colliders;
  worldSolid = rec.worldSolid;
  groundMesh = rec.groundMesh;
  ceilMesh = rec.ceilMesh;
  mapRects = rec.mapRects;
  COVER = rec.cover;
  ROUTES = rec.routes;
  UPPER_ROUTES = rec.upper;
  dustField = rec.dust;
  sunShafts = rec.shafts;
  shaftAxis.copy(rec.shaftAxis);
  SPAWN.x = rec.spawn.x;
  SPAWN.z = rec.spawn.z;
  for (const m of MAPS) m.group.visible = m === rec;
  const E = rec.env;
  sun.position.copy(E.sunDir).multiplyScalar(92);
  sun.color.set(E.sunColor);
  sun.intensity = E.sunInt;
  hemi.color.set(E.hemiSky);
  hemi.groundColor.set(E.hemiGround);
  hemi.intensity = E.hemiInt;
  bounce.color.set(E.bounce);
  skyFill.color.set(E.skyFill);
  skyUniforms.uSun.value.copy(E.sunDir);
  skyUniforms.uSunXZ.value.set(E.sunDir.x, E.sunDir.z).normalize();
  for (const k in E.sky) skyUniforms[k].value.copy(SKY_C(E.sky[k]));
  scene.fog.color.set(E.fog);
  if (scene.fog instanceof THREE.FogExp2) scene.fog.density = E.fogDensity;
  /* per-map grade: bright pastel suburbia needs a lower exposure and a higher
     bloom threshold than the yard, or every sunlit wall smears into a halo */
  brightMat.uniforms.threshold.value = E.bloomT || 0.95;
  compMat.uniforms.expo.value = E.expo || 1.0;
  walkable.reset();
  $('mapMode').textContent = rec.tag;
  $('endSub').textContent = rec.sub;
  document.title = '全面战线 — ' + rec.title;
  clearEnemies();
  spawnEnemies();
  clearAllies();
}

/* =========================================================================
   6. WORLD QUERIES (collision / ground / ceiling)
   ========================================================================= */
function blocked(x, z, y0, y1, radius) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (y1 <= c.minY + 0.02 || y0 >= c.maxY - 0.02) continue;
    const cx = clamp(x, c.minX, c.maxX),
      cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx,
      dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}
/** axis-separated slide movement. pos.y = FEET height. */
/**
 * Shove a body out of any collider it is overlapping, along the shortest exit.
 * Two passes because being ejected from one box can seat you in its neighbour.
 */
function depenetrate(pos, radius, y0, y1) {
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (y1 <= c.minY + 0.02 || y0 >= c.maxY - 0.02) continue;
      const cx = clamp(pos.x, c.minX, c.maxX),
        cz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - cx,
        dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      moved = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2),
          push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        /* dead centre inside the box: leave by the nearest face */
        const l = pos.x - c.minX,
          r = c.maxX - pos.x;
        const b = pos.z - c.minZ,
          f = c.maxZ - pos.z;
        const m = Math.min(l, r, b, f);
        if (m === l) pos.x = c.minX - radius;
        else if (m === r) pos.x = c.maxX + radius;
        else if (m === b) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
    if (!moved) break;
  }
}

function moveSlide(pos, dx, dz, radius, height) {
  const y0 = pos.y + 0.3,
    y1 = pos.y + height - 0.05; // ignore tiny lips
  /* If the mover is already intersecting something — spawned half inside a
     crate, shoved through a corner — then every candidate position also reads
     as blocked and it freezes on the spot for the rest of the round. It still
     has to move, but it must come out rather than continue through: letting it
     travel freely was how a body that clipped a corner could walk on through the
     inside of a container wall. */
  if (blocked(pos.x, pos.z, y0, y1, radius)) {
    pos.x += dx;
    pos.z += dz;
    depenetrate(pos, radius, y0, y1);
    return;
  }
  if (dx !== 0 && !blocked(pos.x + dx, pos.z, y0, y1, radius)) pos.x += dx;
  if (dz !== 0 && !blocked(pos.x, pos.z + dz, y0, y1, radius)) pos.z += dz;
}
/** Nearest position within `maxR` that a body of `radius` can actually stand. */
function nearestFree(x, z, radius, height, maxR, baseY) {
  const y = baseY || 0;
  const free = (px, pz) => !blocked(px, pz, y + 0.3, y + height - 0.05, radius);
  if (free(x, z)) return [x, z];
  for (let r = 0.8; r <= (maxR || 7); r += 0.8) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2 + r;
      const nx = x + Math.cos(a) * r,
        nz = z + Math.sin(a) * r;
      if (Math.abs(nx) > HALF - 1.5 || Math.abs(nz) > HALF - 1.5) continue;
      if (free(nx, nz)) return [nx, nz];
    }
  }
  return [x, z];
}

/**
 * Ground the player can actually walk to, flood-filled from the spawn the first
 * time it is asked for. The yard has pens that are open floor but sealed by
 * container stacks — the north-south corridor is one. `nearestFree` happily
 * snaps a patrol leg into one of those, which strands that soldier somewhere you
 * can only reach by climbing; and since the round only ends when the last man
 * dies, one bad snap turns a ninety-second clear into a three-minute search for
 * someone standing in a box. Built lazily because the props do not exist yet
 * when this file is parsed.
 */
const walkable = (() => {
  const STEP = 0.5,
    W = Math.round((HALF * 2) / STEP) + 1;
  const cell = (v) => Math.round((v + HALF) / STEP);
  const world = (c) => c * STEP - HALF;
  let ok = null;
  function build() {
    const free = new Uint8Array(W * W);
    for (let j = 0; j < W; j++)
      for (let i = 0; i < W; i++)
        free[j * W + i] = blocked(world(i), world(j), 0.3, 1.65, 0.34) ? 0 : 1;
    ok = new Uint8Array(W * W);
    const s = cell(SPAWN.z) * W + cell(SPAWN.x);
    const q = [s];
    ok[s] = 1;
    for (let h = 0; h < q.length; h++) {
      const cur = q[h],
        ci = cur % W,
        cj = (cur - ci) / W;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di,
            nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= W) continue;
          const n = nj * W + ni;
          if (ok[n] || !free[n]) continue;
          /* no squeezing through a diagonal gap between two corners */
          if (di && dj && (!free[cj * W + ni] || !free[nj * W + ci])) continue;
          ok[n] = 1;
          q.push(n);
        }
    }
  }
  const fn = (x, z) => {
    if (!ok) build();
    const i = cell(x),
      j = cell(z);
    if (i < 0 || j < 0 || i >= W || j >= W) return false;
    return !!ok[j * W + i];
  };
  /* the flood fill is baked from the active map's colliders and spawn, so a
     map swap has to throw it away and let the next query rebuild it */
  fn.reset = () => {
    ok = null;
  };
  return fn;
})();

/* nearestFree, but the result also has to be somewhere the player can get to */
function nearestReachable(x, z, radius, height, maxR) {
  const good = (px, pz) => !blocked(px, pz, 0.3, height - 0.05, radius) && walkable(px, pz);
  if (good(x, z)) return [x, z];
  for (let r = 0.8; r <= (maxR || 10); r += 0.8) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2 + r;
      const nx = x + Math.cos(a) * r,
        nz = z + Math.sin(a) * r;
      if (Math.abs(nx) > HALF - 1.5 || Math.abs(nz) > HALF - 1.5) continue;
      if (good(nx, nz)) return [nx, nz];
    }
  }
  return nearestFree(x, z, radius, height, maxR, 0);
}
const DOWN = new THREE.Vector3(0, -1, 0),
  UPV = new THREE.Vector3(0, 1, 0);
const _downRay = new THREE.Raycaster(new THREE.Vector3(), DOWN, 0, 90);
const _upRay = new THREE.Raycaster(new THREE.Vector3(), UPV, 0, 12);
const _tmpV = new THREE.Vector3();
/**
 * Highest walkable surface at or below `maxY`. Casting starts slightly above
 * `maxY` so overhangs the entity can't reach are skipped rather than snapped to.
 */
function groundAt(x, z, maxY) {
  _downRay.set(_tmpV.set(x, maxY + 0.12, z), DOWN);
  _downRay.far = 90;
  const hits = _downRay.intersectObjects(groundMesh, false);
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].point.y <= maxY + 0.02) return hits[i].point.y;
  }
  return null;
}
function ceilingAt(x, z, headY) {
  _upRay.set(_tmpV.set(x, headY - 0.05, z), UPV);
  const hits = _upRay.intersectObjects(ceilMesh, false);
  return hits.length ? hits[0].point.y : Infinity;
}
