import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import audioData from '../../shared/audio-params.json';
import missionsData from '../../shared/missions.json';
import { buildHorizonBackdrop } from './backdrop';
import { makeRainTexture } from './rain-texture';
import {
  hash2,
  makeTerrainMaterial,
  paintGround,
  snapObjectToTerrain,
  terrainHeight,
  windAt,
} from './terrain';

/* ---------------------------------------------------------------------------
   P0 graybox map: a brand-new linear forest valley, not a reuse of any
   existing yard/nuke geometry. Path runs north (spawn, +Z) to south (bridge).
   ------------------------------------------------------------------------- */

const PATH_LENGTH = 168;
const GROUND_SPAN = 1600;
const PATH_HALF_W = 15;
const SPAWN_Z = 82;
const BRIDGE_Z = -82;

export interface LevelObstacle {
  x: number;
  z: number;
  r: number;
}

export interface LevelObjective {
  id: string;
  label: string;
  doneLabel: string;
  z: number;
  trigger: number;
}

export interface P0Level {
  group: THREE.Group;
  objectives: LevelObjective[];
  obstacles: LevelObstacle[];
  terrainHeight(x: number, z: number): number;
  groundY(x: number, z: number): number;
  updateRain(time: number, dt: number, cameraPos: THREE.Vector3): void;
  updateLightning(time: number, dt: number): boolean;
  setObjectivePassed(id: string): void;
  registerPropSnap(fn: () => void): void;
  resnapProps(): number;
  addObstacle(x: number, z: number, r: number): void;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildSupplyCrate(): THREE.Group {
  const crate = new THREE.Group();
  crate.name = 'P0_SUPPLY_CRATE';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3e4a36,
    roughness: 0.8,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x24251f,
    roughness: 0.7,
    metalness: 0.3,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c17,
    roughness: 0.6,
    metalness: 0.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.72, 0.62), bodyMat);
  body.position.y = 0.36;
  body.castShadow = true;
  body.receiveShadow = true;
  crate.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.07, 0.66), trimMat);
  lid.position.y = 0.755;
  lid.castShadow = true;
  crate.add(lid);

  for (const [sx, sz] of [
    [-0.46, 0],
    [0.46, 0],
    [0, -0.28],
    [0, 0.28],
  ]) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(Math.abs(sx) > 0 ? 0.07 : 1.04, 0.78, Math.abs(sz) > 0 ? 0.07 : 0.68),
      strapMat
    );
    strap.position.set(sx, 0.39, sz);
    crate.add(strap);
  }

  return crate;
}

/* ---------------------------------------------------------------------------
   Horizon backdrop: one procedural canvas texture on an open cylinder gives
   the illusion of endless rolling ridges in every direction. It is low-poly
   (48 segments) and generated entirely in code — no image files. `fog:false`
   keeps it visible beyond the fog wall, exactly like a real distant range.
   ------------------------------------------------------------------------- */

export function buildP0Level(scene: THREE.Scene): P0Level {
  const group = new THREE.Group();
  scene.add(group);

  buildHorizonBackdrop(scene);
  const propSnaps: Array<() => void> = [];

  /* --- terrain: a wide valley floor whose sides keep climbing beyond the
     playable corridor; fog swallows the far distance before any edge appears */
  const groundGeo = new THREE.PlaneGeometry(280, GROUND_SPAN, 112, 168);
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const z = groundPos.getZ(i);
    groundPos.setY(i, terrainHeight(x, z));
  }
  groundGeo.computeVertexNormals();
  paintGround(groundGeo);
  (groundGeo as unknown as { boundsTree?: unknown }).boundsTree = new MeshBVH(groundGeo);
  const ground = new THREE.Mesh(groundGeo, makeTerrainMaterial(0x1d201d, 0x2b2a22));
  ground.name = 'P0_GRAYBOX_GROUND';
  ground.receiveShadow = true;
  (ground as unknown as { raycast: typeof acceleratedRaycast }).raycast = acceleratedRaycast;
  group.add(ground);

  /* Exact rendered-surface height: a downward ray against the actual ground
     mesh. This is the projection half of the overlap solver. */
  const groundRay = new THREE.Raycaster();
  const groundRayDir = new THREE.Vector3(0, -1, 0);
  const groundRayOrigin = new THREE.Vector3();
  const groundRayCache = new Map<string, number>();
  function rayGroundHeight(x: number, z: number) {
    const key = `${Math.round(x * 4)}:${Math.round(z * 4)}`;
    const cached = groundRayCache.get(key);
    if (cached !== undefined) return cached;
    groundRayOrigin.set(x, terrainHeight(x, z) + 80, z);
    groundRay.set(groundRayOrigin, groundRayDir);
    groundRay.far = 600;
    const hits = groundRay.intersectObject(ground, false);
    const y = hits.length ? hits[0].point.y : terrainHeight(x, z);
    groundRayCache.set(key, y);
    return y;
  }

  /* --- instanced forest ---
     Two populations: a dense belt on both flanks that reads as an unbroken
     tree wall, plus scattered background trees on the rising valley sides. */
  const TRUNKS = 520;
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1e1813, roughness: 0.95 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TRUNKS);
  trunkMesh.castShadow = true;
  trunkMesh.userData.debugKeyPrefix = 'trunk';
  const canopyGeo = new THREE.ConeGeometry(1.05, 2.6, 6);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x102019, roughness: 0.9 });
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, TRUNKS);
  canopyMesh.castShadow = true;
  canopyMesh.userData.debugKeyPrefix = 'canopy';
  let placed = 0;
  const used = new Set<string>();
  const treeData: Array<{ x: number; z: number; s: number; hash: number }> = [];
  const _q = new THREE.Quaternion();
  const _pos = new THREE.Vector3();
  const _scale = new THREE.Vector3();
  let guard = 0;
  while (placed < TRUNKS && guard < 9000) {
    guard++;
    const side = hash2(guard * 1.3, 7.1) > 0.5 ? 1 : -1;
    const flank = guard < 390;
    const x = flank
      ? side * (9.5 + hash2(guard * 1.7, 0.31) * 24)
      : (hash2(guard * 1.7, 0.31) * 2 - 1) * 78;
    const zr = hash2(guard * 3.3, 0.77) * 2 - 1;
    const z = guard < 300 ? zr * (PATH_LENGTH / 2 + 10) : zr * (GROUND_SPAN / 2 - 140);
    if (Math.abs(x) < 6.5 && z > BRIDGE_Z - 12 && z < SPAWN_Z + 8) continue;
    const key = `${Math.round(x)}:${Math.round(z)}`;
    if (used.has(key)) continue;
    used.add(key);
    const s = 0.65 + hash2(x * 0.31, z * 0.77) * 1.35;
    treeData.push({ x, z, s, hash: hash2(x, z) });
    const support = rayGroundHeight(x, z);
    const trunkY = support + 1.2 * s - 0.03;
    _pos.set(x, trunkY, z);
    _scale.set(s, s, s);
    _q.identity();
    const m = new THREE.Matrix4();
    m.compose(_pos, _q, _scale);
    trunkMesh.setMatrixAt(placed, m);
    const canopyY = trunkY + 1.2 * s + 1.3 * s - 0.35 * s;
    _pos.set(x, canopyY, z);
    const m2 = new THREE.Matrix4();
    m2.compose(_pos, _q, _scale);
    canopyMesh.setMatrixAt(placed, m2);
    placed++;
  }
  const resnapTrees = () => {
    for (let i = 0; i < treeData.length; i++) {
      const { x, z, s } = treeData[i];
      const support = rayGroundHeight(x, z);
      const trunkY = support + 1.2 * s - 0.03;
      _pos.set(x, trunkY, z);
      _scale.set(s, s, s);
      _q.identity();
      const m = new THREE.Matrix4();
      m.compose(_pos, _q, _scale);
      trunkMesh.setMatrixAt(i, m);
      _pos.set(x, trunkY + 2.15 * s, z);
      const m2 = new THREE.Matrix4();
      m2.compose(_pos, _q, _scale);
      canopyMesh.setMatrixAt(i, m2);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
  };
  resnapTrees();
  propSnaps.push(resnapTrees);
  trunkMesh.count = placed;
  canopyMesh.count = placed;
  group.add(trunkMesh, canopyMesh);

  /* Low undergrowth fills the gaps in the flanking belt so the corridor edge
     is a wall of vegetation, not a visible boundary. */
  const BUSHES = 430;
  const bushGeo = new THREE.ConeGeometry(0.55, 1.25, 5);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x141f16, roughness: 0.95 });
  const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, BUSHES);
  bushMesh.castShadow = false;
  bushMesh.userData.debugKeyPrefix = 'bush';
  const bushData: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < BUSHES; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (8 + hash2(i * 1.9, 3.1) * 22) + (hash2(i, 9.9) - 0.5) * 2.4;
    const z = (hash2(i * 4.7, 5.3) * 2 - 1) * (PATH_LENGTH / 2 + 4);
    const s = 0.7 + hash2(i * 2.3, 8.1) * 1.2;
    bushData.push({ x, z, s });
    const support = rayGroundHeight(x, z);
    _pos.set(x, support + 0.625 * s - 0.03, z);
    _scale.set(s, s, s);
    _q.identity();
    const m = new THREE.Matrix4();
    m.compose(_pos, _q, _scale);
    bushMesh.setMatrixAt(i, m);
  }
  const resnapBushes = () => {
    for (let i = 0; i < bushData.length; i++) {
      const { x, z, s } = bushData[i];
      const support = rayGroundHeight(x, z);
      _pos.set(x, support + 0.625 * s - 0.03, z);
      _scale.set(s, s, s);
      _q.identity();
      const m = new THREE.Matrix4();
      m.compose(_pos, _q, _scale);
      bushMesh.setMatrixAt(i, m);
    }
    bushMesh.instanceMatrix.needsUpdate = true;
  };
  resnapBushes();
  propSnaps.push(resnapBushes);
  group.add(bushMesh);

  /* --- rocks and fallen logs: gameplay cover + collision --- */
  const obstacles: LevelObstacle[] = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3d3b, roughness: 0.92 });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x211b13, roughness: 0.94 });
  for (let i = 0; i < 34; i++) {
    const x = (hash2(i * 9.1, 1.3) * 2 - 1) * 12;
    const z = 74 - i * 4.4 - hash2(i, 5.7) * 2;
    if (Math.abs(x) < 1.4) continue;
    const r = 0.5 + hash2(i * 1.3, 3.9) * 0.8;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
    rock.name = 'P0_PROP_ROCK';
    rock.userData.debugId = `rock:${i}`;
    rock.userData.debugKind = 'rock';
    rock.position.set(x, 0, z);
    rock.scale.y = 0.8 + hash2(i, 8.2) * 0.5;
    rock.rotation.set(hash2(i, 2.2) * Math.PI, hash2(i, 4.4) * Math.PI, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    const rockPoints: Array<[number, number]> = [[x, z]];
    for (const rr of [0.35, 0.65, 0.95]) {
      for (let a = 0; a < 8; a++) {
        rockPoints.push([
          x + Math.cos((a / 8) * Math.PI * 2) * r * rr,
          z + Math.sin((a / 8) * Math.PI * 2) * r * rr,
        ]);
      }
    }
    const snap = () =>
      snapObjectToTerrain(rock, x, z, {
        points: rockPoints,
        sink: 0.05,
        groundAt: rayGroundHeight,
        mode: 'center',
      });
    snap();
    propSnaps.push(snap);
    obstacles.push({ x, z, r: r * 0.85 });
  }
  for (let i = 0; i < 16; i++) {
    const x = (hash2(i * 5.3, 9.9) * 2 - 1) * 9;
    const z = 58 - i * 8.2;
    const angle = Math.PI / 2 + hash2(i, 1.1) * 0.5;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.4, 7), logMat);
    log.name = 'P0_PROP_LOG';
    log.userData.debugId = `log:${i}`;
    log.userData.debugKind = 'log';
    log.position.set(x, 0, z);
    log.rotation.set(0, 0, angle);
    log.castShadow = true;
    group.add(log);
    /* A log is not a point: cover its full 3.4m length with a chain of small
       collision circles so the player cannot walk through either end. */
    const dx = -Math.sin(angle);
    const dz = Math.cos(angle);
    const logPoints: Array<[number, number]> = [];
    for (let t = -1.7; t <= 1.7; t += 0.2) logPoints.push([x + dx * t, z + dz * t]);
    const snap = () =>
      snapObjectToTerrain(log, x, z, {
        points: logPoints,
        sink: 0.05,
        groundAt: rayGroundHeight,
        mode: 'center',
      });
    snap();
    propSnaps.push(snap);
    for (let t = -1.6; t <= 1.6; t += 0.8) {
      obstacles.push({ x: x + dx * t, z: z + dz * t, r: 0.42 });
    }
  }

  /* Objective beacons are now screen-space projections owned by the HUD.
     They have no 3D mesh and no collision, so terrain can never occlude them. */
  const objectives: LevelObjective[] = missionsData.mission01.objectives as LevelObjective[];
  const gateGroups = new Map<string, THREE.Group>();
  for (const obj of objectives) gateGroups.set(obj.id, new THREE.Group());

  /* --- bridge at the exit --- */
  const bridgeY = terrainHeight(0, BRIDGE_Z);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.85 })
  );
  deck.position.set(0, bridgeY + 0.35, BRIDGE_Z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.debugKind = 'decor';
  group.add(deck);
  for (const sx of [-6.6, -4.4, 4.4, 6.6]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 3.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x292927, roughness: 0.9 })
    );
    pillar.position.set(sx, bridgeY - 1.3, BRIDGE_Z);
    pillar.castShadow = true;
    pillar.userData.debugKind = 'decor';
    group.add(pillar);
  }
  /* Realistic checkpoint barrier: weathered concrete posts and a red/white
     striped arm instead of the old emissive orange slab. */
  const barrierGroup = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3b3d3c, roughness: 0.92 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x6b2a22, roughness: 0.78 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc9c3b4, roughness: 0.7 });
  for (const sx of [-3.4, 3.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.35, 0.3), postMat);
    post.position.set(sx, bridgeY + 0.72, BRIDGE_Z - 7);
    post.castShadow = true;
    post.userData.debugKind = 'decor';
    barrierGroup.add(post);
  }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.2, 0.14), armMat);
  arm.position.set(0, bridgeY + 1.18, BRIDGE_Z - 7);
  arm.rotation.z = -0.08;
  arm.castShadow = true;
  arm.userData.debugKind = 'decor';
  barrierGroup.add(arm);
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.205, 0.15), stripeMat);
    stripe.position.set(-2.9 + i * 1.16, bridgeY + 1.18, BRIDGE_Z - 7);
    stripe.rotation.z = -0.08;
    stripe.userData.debugKind = 'decor';
    barrierGroup.add(stripe);
  }
  group.add(barrierGroup);

  /* --- puddles: dark wet ground with animated expanding ripples --- */
  const puddleData: Array<{
    x: number;
    z: number;
    r: number;
    ripples: Array<{ mesh: THREE.Mesh; phase: number; speed: number }>;
  }> = [];
  for (let i = 0; i < 26; i++) {
    const x = (hash2(i * 3.1, 11.7) * 2 - 1) * 8;
    const z = 72 - i * 5.4 - hash2(i, 17.3) * 1.8;
    if (Math.abs(z) > 80) continue;
    const r = 0.55 + hash2(i * 1.7, 23.9) * 1.25;
    const y = rayGroundHeight(x, z);
    const puddle = new THREE.Group();
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(r * 1.45, 22),
      new THREE.MeshBasicMaterial({
        color: 0x080f16,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.y = 0.025;
    stain.userData.debugKind = 'decor';
    puddle.add(stain);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(r, 22),
      new THREE.MeshStandardMaterial({
        color: 0x16232e,
        roughness: 0.08,
        metalness: 0.55,
        transparent: true,
        opacity: 0.92,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.04;
    water.receiveShadow = true;
    water.userData.debugKind = 'decor';
    puddle.add(water);
    const ripples: Array<{ mesh: THREE.Mesh; phase: number; speed: number }> = [];
    for (let k = 0; k < 2; k++) {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.82, 1, 26),
        new THREE.MeshBasicMaterial({
          color: 0xbdd4e4,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 0.055 + k * 0.004;
      ripple.userData.debugKind = 'decor';
      puddle.add(ripple);
      ripples.push({ mesh: ripple, phase: Math.random(), speed: 0.55 + Math.random() * 0.6 });
    }
    puddle.position.set(x, y, z);
    puddle.userData.debugKind = 'decor';
    group.add(puddle);
    puddleData.push({ x, z, r, ripples });
  }

  /* --- rain: layered soft sprite streaks pooled around the camera --- */
  const rainTextures = [-2, -1, 0, 1, 2].map(makeRainTexture);
  const rainLayerDefs = audioData.environment.rainLayers;
  const rainCam = new THREE.Vector3(0, 2, 82);
  const rainLayers = rainLayerDefs.map((def) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(def.count * 3);
    const speed = new Float32Array(def.count);
    const spawn = (i: number, cam: THREE.Vector3, anywhere: boolean) => {
      const x = cam.x + (Math.random() * 2 - 1) * def.spread;
      const z = cam.z + (Math.random() * 2 - 1) * def.spread * 1.25;
      const y = anywhere
        ? Math.random() * 22
        : Math.max(1.2, terrainHeight(x, z) + 8 + Math.random() * 9);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      speed[i] = def.minSpeed + Math.random() * (def.maxSpeed - def.minSpeed);
    };
    for (let i = 0; i < def.count; i++) spawn(i, rainCam, true);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: rainTextures[2],
      size: def.size,
      transparent: true,
      opacity: def.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);
    return { points, geo, pos, speed, def, spawn };
  });

  const sun = new THREE.DirectionalLight(0xb9d0e6, 2.4);
  sun.position.set(-14, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0x6d849e, 0x2b2a20, 1.35);
  scene.add(hemi);

  const amb = new THREE.AmbientLight(0x3d5269, 0.85);
  scene.add(amb);

  scene.fog = new THREE.FogExp2(0x0b141f, 0.0085);
  scene.background = new THREE.Color(0x0b141f);

  return {
    group,
    objectives,
    obstacles,
    terrainHeight,
    groundY: rayGroundHeight,
    bounds: { minX: -15, maxX: 15, minZ: -92, maxZ: 88 },
    updateRain(time: number, dt: number, cameraPos: THREE.Vector3) {
      const wind = windAt(time);
      const slantIdx = THREE.MathUtils.clamp(Math.round(wind) + 2, 0, rainTextures.length - 1);
      rainCam.copy(cameraPos);
      for (const layer of rainLayers) {
        const attr = layer.geo.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < layer.def.count; i++) {
          let x = arr[i * 3] + wind * 2.6 * dt;
          let y = arr[i * 3 + 1] - layer.speed[i] * dt;
          const z = arr[i * 3 + 2];
          if (y < terrainHeight(x, z) + 0.04) {
            layer.spawn(i, rainCam, false);
            continue;
          }
          arr[i * 3] = x;
          arr[i * 3 + 1] = y;
          arr[i * 3 + 2] = z;
        }
        attr.needsUpdate = true;
        const mat = layer.points.material as THREE.PointsMaterial;
        if (mat.map !== rainTextures[slantIdx]) {
          mat.map = rainTextures[slantIdx];
          mat.needsUpdate = true;
        }
      }

      /* expanding puddle ripples */
      for (const puddle of puddleData) {
        for (const rip of puddle.ripples) {
          rip.phase += dt * rip.speed;
          if (rip.phase > 1) rip.phase -= 1;
          const s = puddle.r * (0.18 + rip.phase * 1.15);
          rip.mesh.scale.setScalar(s);
          (rip.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - rip.phase) * 0.28;
        }
      }
    },
    updateLightning(time: number, _dt: number) {
      const cycle = (time % 7) / 7;
      const flashing = cycle < 0.04;
      if (flashing) sun.intensity = 3.6 + Math.sin(cycle * 140) * 1.1;
      else sun.intensity = 2.4;
      return flashing;
    },
    setObjectivePassed(id: string) {
      const gate = gateGroups.get(id);
      if (gate) gate.visible = false;
    },
    registerPropSnap(fn: () => void) {
      propSnaps.push(fn);
    },
    resnapProps() {
      for (const fn of propSnaps) fn();
      return propSnaps.length;
    },
    addObstacle(x: number, z: number, r: number) {
      obstacles.push({ x, z, r });
    },
  };
}
