'use strict';
/* =========================================================================
   5b. MAP REGISTRY — two swappable worlds

   Each map builds against the module-level arrays above; when it finishes,
   everything it added to the scene is adopted into a Group (one visible flag
   hides the whole map) and the array references are captured into a record.
   applyMap() points the module names at a record, and every system that
   closed over those names — collision, LOS, ground, cover, minimap — follows.
   ========================================================================= */
function deriveCover(rects) {
  const out = [];
  for (const r of rects) {
    if (r.w < 0.9 && r.d < 0.9) continue;
    const hw = r.w / 2,
      hd = r.d / 2,
      off = 1.05;
    out.push(
      { x: r.x, z: r.z + hd + off, ox: r.x, oz: r.z },
      { x: r.x, z: r.z - hd - off, ox: r.x, oz: r.z },
      { x: r.x + hw + off, z: r.z, ox: r.x, oz: r.z },
      { x: r.x - hw - off, z: r.z, ox: r.x, oz: r.z }
    );
  }
  return out;
}

const MAP_CHUNK = 20;
const MAP_CHUNK_SPAN = 24;

function partitionMapChunks(rec) {
  const box = new THREE.Box3();
  const mid = new THREE.Vector3();
  rec.chunkGlobals = [];
  rec.chunks = [];
  const byKey = new Map();
  for (const obj of rec.group.children.slice()) {
    if (obj instanceof THREE.InstancedMesh) {
      rec.chunkGlobals.push(obj);
      continue;
    }
    obj.updateWorldMatrix(true, false);
    box.setFromObject(obj);
    const spanX = box.max.x - box.min.x,
      spanZ = box.max.z - box.min.z;
    if (!(spanX < MAP_CHUNK_SPAN && spanZ < MAP_CHUNK_SPAN)) {
      rec.chunkGlobals.push(obj);
      continue;
    }
    if (isFinite(box.min.x) && isFinite(box.max.x)) box.getCenter(mid);
    else mid.set(obj.position.x, 0, obj.position.z);
    const ix = Math.floor(mid.x / MAP_CHUNK),
      iz = Math.floor(mid.z / MAP_CHUNK);
    const key = ix + ',' + iz;
    let ch = byKey.get(key);
    if (!ch) {
      const g = new THREE.Group();
      g.name = 'chunk:' + key;
      rec.group.add(g);
      ch = {
        key,
        ix,
        iz,
        group: g,
        cx: (ix + 0.5) * MAP_CHUNK,
        cz: (iz + 0.5) * MAP_CHUNK,
      };
      byKey.set(key, ch);
      rec.chunks.push(ch);
    }
    ch.group.add(obj);
  }
}

function activateNearbyChunks(x, z, radius = 72) {
  if (!CUR || !CUR.chunks) return;
  const r2 = radius * radius;
  const pix = Math.floor(x / MAP_CHUNK),
    piz = Math.floor(z / MAP_CHUNK);
  for (let i = 0; i < CUR.chunks.length; i++) {
    const ch = CUR.chunks[i];
    const cheb = Math.max(Math.abs(ch.ix - pix), Math.abs(ch.iz - piz));
    if (cheb <= 1) {
      ch.group.visible = true;
      continue;
    }
    const dx = ch.cx - x,
      dz = ch.cz - z;
    ch.group.visible = dx * dx + dz * dz < r2;
  }
  for (let i = 0; i < CUR.chunkGlobals.length; i++) CUR.chunkGlobals[i].visible = true;
}

function captureMap(pre, meta) {
  const group = new THREE.Group();
  for (const ch of [...scene.children]) if (!pre.has(ch)) group.add(ch);
  scene.add(group);
  const rec = Object.assign(
    {
      group,
      colliders,
      worldSolid,
      groundMesh,
      ceilMesh,
      mapRects,
      dust: dustField,
      shafts: sunShafts,
      shaftAxis: shaftAxis.clone(),
      cover: deriveCover(mapRects),
    },
    meta
  );
  /* query systems keep the full lists; chunks only hide far mesh groups */
  rec.allColliders = rec.colliders;
  rec.allWorldSolid = rec.worldSolid;
  rec.allGroundMesh = rec.groundMesh;
  rec.allCeilMesh = rec.ceilMesh;
  partitionMapChunks(rec);
  /* hand the next map a clean sheet to build against */
  colliders = [];
  worldSolid = [];
  groundMesh = [];
  ceilMesh = [];
  mapRects = [];
  extraShadows.length = 0;
  sunShafts = [];
  return rec;
}

/* menu backdrops: one slow camera move per map */
function menuCamYard(now, camera) {
  /* a slow crane through the yard rather than a map overview, so the
     containers pass close enough to give real parallax */
  const t = now * 0.000048;
  const r = 23.0 + Math.sin(t * 0.83) * 2.4;
  /* held above the stacks: at eye height the path scrapes container roofs
     and the frame fills with a single flat panel */
  camera.position.set(Math.sin(t) * r, 6.3 + Math.sin(t * 1.31) * 0.9, Math.cos(t) * r * 1.04);
  camera.lookAt(Math.sin(t + 0.7) * 4.5, 1.4 + Math.sin(t * 0.7) * 0.4, Math.cos(t + 0.7) * 4.5);
  camera.rotateZ(Math.sin(t * 1.9) * 0.012);
  if (camera.fov !== BASE_FOV - 8) {
    camera.fov = BASE_FOV - 8;
    camera.updateProjectionMatrix();
  }
}
function menuCamNuke(now, camera) {
  /* a wide slow orbit just above the rooflines — the cul-de-sac reads best
     when both gable ends stay in frame */
  const t = now * 0.000042;
  camera.position.set(Math.sin(t) * 23.5, 8.4 + Math.sin(t * 1.4) * 0.7, Math.cos(t) * 23.5);
  camera.lookAt(Math.sin(t + 0.6) * 3.0, 1.1, Math.cos(t + 0.6) * 3.0);
  camera.rotateZ(Math.sin(t * 1.7) * 0.01);
  if (camera.fov !== BASE_FOV - 8) {
    camera.fov = BASE_FOV - 8;
    camera.updateProjectionMatrix();
  }
}

const MAPS = [];
const MAP_YARD = captureMap(_preYardScene, {
  id: 'yard',
  title: '仓库区',
  tag: '第 7 区',
  sub: '第 7 区 — 仓库区',
  spawn: { x: 0, z: 24 },
  spawnYaw: 0,
  enemyZone: null,
  routes: [
    [
      [16, -22],
      [16, -6],
      [16, 8],
      [16, 20],
      [16, 4],
    ], // corridor north/south
    [
      [-22, -10],
      [-18, 0],
      [-22, 3],
      [-26, -6],
    ], // second floor (upper)
    [
      [-2, 6],
      [5, -4],
      [0, -10],
      [-5, -2],
    ], // centre / vehicle
    [
      [16, 20],
      [8, 22],
      [2, 16],
      [10, 10],
    ], // south-east
    [
      [-14, -22],
      [-4, -25],
      [4, -20],
      [-6, -16],
    ], // north strip
    [
      [24, -8],
      [24, -18],
      [18, -22],
      [20, -10],
    ], // guard shack
    [
      [-20, -6],
      [-24, 2],
      [-18, 4],
      [-16, -4],
    ], // second floor (upper) 2
    [
      [-6, 20],
      [2, 24],
      [-10, 26],
      [-16, 20],
    ], // south open
    [
      [-14, 10],
      [-6, 12],
      [-10, 4],
      [-16, 2],
    ], // west yard
    [
      [8, -14],
      [2, -6],
      [10, 2],
      [14, -10],
    ], // roamer
  ],
  /* respawns are always staged outdoors; routes may still take combatants
     through structures after they leave their side of the map */
  upper: new Set(),
  upperY: 4.42,
  menuCam: menuCamYard,
  env: {
    sunDir: SUN_DIR.clone(),
    sunColor: 0xffdcae,
    sunInt: 2.35,
    hemiSky: 0xa6bacd,
    hemiGround: 0x6f6450,
    hemiInt: 0.74,
    bounce: 0xb0916a,
    skyFill: 0x8fa8c4,
    fog: FOG_COLOR,
    fogDensity: 0.0074,
    sky: {
      uZen: '#2f4055',
      uHigh: '#5c6d7c',
      uMid: '#8b9196',
      uLow: '#a8a79f',
      uHaze: '#b0a99c',
      uGround: '#8a8378',
      uCloudD: '#71757c',
      uCloudL: '#c6c1b6',
    },
  },
});
MAPS.push(MAP_YARD);
