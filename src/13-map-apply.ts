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
  activateNearbyChunks(SPAWN.x, SPAWN.z);
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
  rebuildWorldQueryGrids();
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
const QUERY_CELL = 8;
let colliderGrid = new Map(),
  colliderGridLen = -1,
  colliderQueryStamp = 1;
function rebuildColliderGrid() {
  colliderGrid = new Map();
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const x0 = Math.floor(c.minX / QUERY_CELL),
      x1 = Math.floor(c.maxX / QUERY_CELL),
      z0 = Math.floor(c.minZ / QUERY_CELL),
      z1 = Math.floor(c.maxZ / QUERY_CELL);
    for (let iz = z0; iz <= z1; iz++)
      for (let ix = x0; ix <= x1; ix++) {
        const key = ix + ',' + iz,
          cell = colliderGrid.get(key);
        if (cell) cell.push(c);
        else colliderGrid.set(key, [c]);
      }
  }
  colliderGridLen = colliders.length;
}
function ensureColliderGrid() {
  if (colliderGridLen !== colliders.length) rebuildColliderGrid();
}
function visitCollidersNear(x, z, radius, y0, y1, visit) {
  ensureColliderGrid();
  const stamp = ++colliderQueryStamp;
  const x0 = Math.floor((x - radius) / QUERY_CELL),
    x1 = Math.floor((x + radius) / QUERY_CELL),
    z0 = Math.floor((z - radius) / QUERY_CELL),
    z1 = Math.floor((z + radius) / QUERY_CELL);
  for (let iz = z0; iz <= z1; iz++)
    for (let ix = x0; ix <= x1; ix++) {
      const cell = colliderGrid.get(ix + ',' + iz);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const c = cell[i];
        if (c._q === stamp) continue;
        c._q = stamp;
        if (y1 <= c.minY + 0.02 || y0 >= c.maxY - 0.02) continue;
        if (visit(c)) return true;
      }
    }
  return false;
}
function blocked(x, z, y0, y1, radius) {
  const r2 = radius * radius;
  return visitCollidersNear(x, z, radius, y0, y1, (c) => {
    const dx = x - clamp(x, c.minX, c.maxX),
      dz = z - clamp(z, c.minZ, c.maxZ);
    return dx * dx + dz * dz < r2;
  });
}
/** axis-separated slide movement. pos.y = FEET height. */
/**
 * Shove a body out of any collider it is overlapping, along the shortest exit.
 * Two passes because being ejected from one box can seat you in its neighbour.
 */
function depenetrate(pos, radius, y0, y1) {
  const r2 = radius * radius;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    visitCollidersNear(pos.x, pos.z, radius, y0, y1, (c) => {
      const dx = pos.x - clamp(pos.x, c.minX, c.maxX),
        dz = pos.z - clamp(pos.z, c.minZ, c.maxZ);
      const d2 = dx * dx + dz * dz;
      if (d2 >= r2) return false;
      moved = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2),
          push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
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
      return false;
    });
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

/* Ground snapping is queried once per living soldier, every frame. Passing the
   complete map to Raycaster made a Nuketown snap inspect 220 meshes even though
   a vertical ray can only touch geometry in one small patch. This exact X/Z
   broad phase keeps only meshes whose world-space bounds overlap an 8 m cell;
   InstancedMesh is deliberately kept in the fallback list because its shared
   geometry bounds do not describe all instances in three r128. */
let groundRayGrid = new Map(),
  groundRayGlobals = [],
  groundRayReady = false;

function groundRayKey(x, z) {
  return Math.floor(x / QUERY_CELL) + ',' + Math.floor(z / QUERY_CELL);
}

function insertMeshInGrid(grid, globals, mesh, box) {
  if (mesh instanceof THREE.InstancedMesh) {
    globals.push(mesh);
    return;
  }
  mesh.updateWorldMatrix(true, false);
  box.setFromObject(mesh);
  const x0 = Math.floor(box.min.x / QUERY_CELL),
    x1 = Math.floor(box.max.x / QUERY_CELL),
    z0 = Math.floor(box.min.z / QUERY_CELL),
    z1 = Math.floor(box.max.z / QUERY_CELL);
  for (let iz = z0; iz <= z1; iz++)
    for (let ix = x0; ix <= x1; ix++) {
      const key = ix + ',' + iz,
        cell = grid.get(key);
      if (cell) cell.push(mesh);
      else grid.set(key, [mesh]);
    }
}

function bakeGlobalsIntoGrid(grid, globals) {
  if (!globals.length) return;
  for (const cell of grid.values()) cell.push(...globals);
}

function rebuildGroundRayGrid() {
  groundRayGrid = new Map();
  groundRayGlobals = [];
  groundRayReady = false;
  const box = new THREE.Box3();
  for (const mesh of groundMesh) insertMeshInGrid(groundRayGrid, groundRayGlobals, mesh, box);
  bakeGlobalsIntoGrid(groundRayGrid, groundRayGlobals);
  groundRayReady = true;
}

function groundRayCandidates(x, z) {
  if (!groundRayReady) return groundMesh;
  return groundRayGrid.get(groundRayKey(x, z)) || groundRayGlobals;
}

let solidRayGrid = new Map(),
  solidRayGlobals = [],
  solidRayLen = -1,
  solidQueryStamp = 1;
function rebuildSolidRayGrid() {
  solidRayGrid = new Map();
  solidRayGlobals = [];
  const box = new THREE.Box3();
  for (const mesh of worldSolid) insertMeshInGrid(solidRayGrid, solidRayGlobals, mesh, box);
  bakeGlobalsIntoGrid(solidRayGrid, solidRayGlobals);
  solidRayLen = worldSolid.length;
}
function ensureSolidRayGrid() {
  if (solidRayLen !== worldSolid.length) rebuildSolidRayGrid();
}
function worldSolidCandidates(ray) {
  ensureSolidRayGrid();
  const o = ray.ray.origin,
    d = ray.ray.direction;
  const tEnd = Math.min(ray.far > 0 ? ray.far : 240, 240);
  if (!(tEnd > 0)) return solidRayGlobals;
  const stamp = ++solidQueryStamp;
  const out = [];
  const take = (ix, iz) => {
    const cell = solidRayGrid.get(ix + ',' + iz) || (solidRayGlobals.length ? solidRayGlobals : null);
    if (!cell) return;
    for (let i = 0; i < cell.length; i++) {
      const m = cell[i];
      if (m._sq === stamp) continue;
      m._sq = stamp;
      out.push(m);
    }
  };
  const ix0 = Math.floor(o.x / QUERY_CELL),
    iz0 = Math.floor(o.z / QUERY_CELL);
  if (d.x * d.x + d.z * d.z < 1e-10) {
    take(ix0, iz0);
    return out.length ? out : solidRayGlobals;
  }
  const stepX = d.x > 0 ? 1 : d.x < 0 ? -1 : 0,
    stepZ = d.z > 0 ? 1 : d.z < 0 ? -1 : 0;
  const invX = stepX ? 1 / d.x : 0,
    invZ = stepZ ? 1 / d.z : 0;
  let ix = ix0,
    iz = iz0;
  let tMaxX = stepX
      ? ((stepX > 0 ? ix + 1 : ix) * QUERY_CELL - o.x) * invX
      : Infinity,
    tMaxZ = stepZ ? ((stepZ > 0 ? iz + 1 : iz) * QUERY_CELL - o.z) * invZ : Infinity;
  const tDeltaX = stepX ? Math.abs(QUERY_CELL * invX) : Infinity,
    tDeltaZ = stepZ ? Math.abs(QUERY_CELL * invZ) : Infinity;
  const ix1 = Math.floor((o.x + d.x * tEnd) / QUERY_CELL),
    iz1 = Math.floor((o.z + d.z * tEnd) / QUERY_CELL);
  take(ix, iz);
  for (let n = 0; n < 64 && (ix !== ix1 || iz !== iz1); n++) {
    if (tMaxX < tMaxZ) {
      if (tMaxX > tEnd) break;
      ix += stepX;
      tMaxX += tDeltaX;
    } else {
      if (tMaxZ > tEnd) break;
      iz += stepZ;
      tMaxZ += tDeltaZ;
    }
    take(ix, iz);
  }
  return out.length ? out : solidRayGlobals;
}
function intersectWorldSolid(ray) {
  return ray.intersectObjects(worldSolidCandidates(ray), false);
}
function rebuildWorldQueryGrids() {
  rebuildColliderGrid();
  rebuildGroundRayGrid();
  rebuildSolidRayGrid();
}
/**
 * Highest walkable surface at or below `maxY`. Casting starts slightly above
 * `maxY` so overhangs the entity can't reach are skipped rather than snapped to.
 */
function groundAt(x, z, maxY) {
  _downRay.set(_tmpV.set(x, maxY + 0.12, z), DOWN);
  _downRay.far = 90;
  const hits = _downRay.intersectObjects(groundRayCandidates(x, z), false);
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
