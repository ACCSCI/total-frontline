import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import audioData from '../../shared/audio-params.json';
import missionsData from '../../shared/missions.json';
import { buildHorizonBackdrop } from './backdrop';
import { placeEnemyCamps } from './enemy-camps';
import { spawnWaterSplash } from './fx';
import {
  makeWaterMaterial,
  placeGroundScatter,
  placeMissionSetDressing,
  updateWaterMaterial,
} from './mission-world';
import { makeRainTexture } from './rain-texture';
import {
  hash2,
  makeTerrainMaterial,
  paintGround,
  snapObjectToTerrain,
  terrainHeight,
  windAt,
} from './terrain';
import { placeCrashWrecks } from './wreckage';

const PATH_LENGTH = 2000;
const GROUND_SPAN = 2400;
const PATH_HALF_W = 15;
const SPAWN_Z = 1000;
const BRIDGE_Z = -1000;

export interface LevelObstacle {
  x: number;
  z: number;
  r: number;
  topY?: number;
  climbR?: number;
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
  waterDepth(x: number, z: number): number;
  spawnWaterSplashAt(point: THREE.Vector3): void;
  setCinematicLighting(on: boolean): void;
  setObjectivePassed(id: string): void;
  registerPropSnap(fn: () => void): void;
  resnapProps(): number;
  addObstacle(x: number, z: number, r: number, topY?: number): void;
  climbables: LevelObstacle[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildP0Level(scene: THREE.Scene): P0Level {
  const group = new THREE.Group();
  scene.add(group);

  buildHorizonBackdrop(scene);
  const propSnaps: Array<() => void> = [];

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

  const TRUNKS = 1800;
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.4, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.95 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TRUNKS);
  trunkMesh.castShadow = true;
  trunkMesh.userData.debugKeyPrefix = 'trunk';
  const canopyGeo = new THREE.ConeGeometry(1.05, 2.6, 8);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1a3525, roughness: 0.88 });
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
  while (placed < TRUNKS && guard < 12000) {
    guard++;
    const side = hash2(guard * 1.3, 7.1) > 0.5 ? 1 : -1;
    const flank = guard < 390;
    const boundaryBand = guard >= 390 && guard < 640;
    const x = flank
      ? side * (7.4 + hash2(guard * 1.7, 0.31) * 21)
      : boundaryBand
        ? side * (7.4 + hash2(guard * 1.7, 0.31) * 27)
        : (hash2(guard * 1.7, 0.31) * 2 - 1) * 108;
    const zr = hash2(guard * 3.3, 0.77) * 2 - 1;
    const z = boundaryBand
      ? (hash2(guard * 5.1, 0.9) > 0.5 ? 1 : -1) *
        (PATH_LENGTH / 2 + 40 + hash2(guard * 2.2, 1.1) * 130)
      : zr * (guard < 300 ? PATH_LENGTH / 2 + 10 : GROUND_SPAN / 2 - 140);
    if (Math.abs(x) < 6.5 && z > BRIDGE_Z - 12 && z < SPAWN_Z + 8) continue;
    const key = `${Math.round(x)}:${Math.round(z)}`;
    if (used.has(key)) continue;
    used.add(key);
    const s = 0.65 + hash2(x * 0.31, z * 0.77) * 1.5;
    const h = hash2(x, z);
    treeData.push({ x, z, s, hash: h });
    const support = rayGroundHeight(x, z);
    const trunkY = support + 1.2 * s - 0.03;
    _pos.set(x, trunkY, z);
    _scale.set(s, s, s);
    _q.setFromEuler(new THREE.Euler((h - 0.5) * 0.08, h * Math.PI * 2, (h - 0.5) * 0.08));
    const m = new THREE.Matrix4();
    m.compose(_pos, _q, _scale);
    trunkMesh.setMatrixAt(placed, m);
    trunkMesh.setColorAt(placed, new THREE.Color().setHSL(0.065 + h * 0.02, 0.3, 0.09 + h * 0.04));
    const canopyY = trunkY + 1.2 * s + 1.3 * s - 0.35 * s;
    _pos.set(x, canopyY, z);
    const m2 = new THREE.Matrix4();
    m2.compose(_pos, _q, _scale);
    canopyMesh.setMatrixAt(placed, m2);
    canopyMesh.setColorAt(placed, new THREE.Color().setHSL(0.33 + h * 0.08, 0.5, 0.1 + h * 0.07));
    placed++;
  }
  const resnapTrees = () => {
    for (let i = 0; i < treeData.length; i++) {
      const { x, z, s, hash } = treeData[i];
      const trunkY = rayGroundHeight(x, z) + 1.2 * s - 0.03;
      _pos.set(x, trunkY, z);
      _scale.set(s, s, s);
      _q.setFromEuler(
        new THREE.Euler((hash - 0.5) * 0.08, hash * Math.PI * 2, (hash - 0.5) * 0.08)
      );
      trunkMesh.setMatrixAt(i, new THREE.Matrix4().compose(_pos, _q, _scale));
      _pos.set(x, trunkY + 2.15 * s, z);
      canopyMesh.setMatrixAt(i, new THREE.Matrix4().compose(_pos, _q, _scale));
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
  };
  resnapTrees();
  propSnaps.push(resnapTrees);
  trunkMesh.count = placed;
  canopyMesh.count = placed;
  group.add(trunkMesh, canopyMesh);

  /* Low undergrowth fills the gaps in the flanking belt so the corridor edge
     is a wall of vegetation, not a visible boundary. */
  const BUSHES = 1600;
  const bushGeo = new THREE.ConeGeometry(0.62, 1.5, 7);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1f3822, roughness: 0.92 });
  const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, BUSHES);
  bushMesh.castShadow = false;
  bushMesh.userData.debugKeyPrefix = 'bush';
  const bushData: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < BUSHES; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (6.6 + hash2(i * 1.9, 3.1) * 20) + (hash2(i, 9.9) - 0.5) * 2.4;
    const z =
      i < 430
        ? (hash2(i * 4.7, 5.3) * 2 - 1) * (PATH_LENGTH / 2 + 4)
        : (hash2(i * 4.7, 5.3) > 0.5 ? 1 : -1) * (PATH_LENGTH / 2 + 34 + hash2(i, 17.7) * 118);
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

  const obstacles: LevelObstacle[] = [];
  const climbables: LevelObstacle[] = [];
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x5a615d,
    roughness: 0.95,
    metalness: 0.03,
  });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x211b13, roughness: 0.94 });
  for (let i = 0; i < 84; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (4.2 + hash2(i * 9.1, 1.3) * 6.4);
    const z = 960 - i * 22.5 - hash2(i, 5.7) * 8;
    if (Math.abs(z) < 6) continue;
    const r = 0.35 + hash2(i * 1.3, 3.9) * 0.6;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), rockMat);
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
  for (let i = 0; i < 22; i++) {
    const x = (hash2(i * 5.3, 9.9) * 2 - 1) * 8.5;
    const z = 930 - i * 92;
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
  placeCrashWrecks(group, obstacles, propSnaps, rayGroundHeight);
  placeMissionSetDressing(group, obstacles, propSnaps, rayGroundHeight);
  placeEnemyCamps(group, obstacles, propSnaps, rayGroundHeight);
  const animateGroundScatter = placeGroundScatter(group, propSnaps, rayGroundHeight);

  const objectives: LevelObjective[] = missionsData.mission01.objectives as LevelObjective[];
  const gateGroups = new Map<string, THREE.Group>();
  for (const obj of objectives) gateGroups.set(obj.id, new THREE.Group());

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

  const puddleData: Array<{
    x: number;
    z: number;
    r: number;
    ripples: Array<{ mesh: THREE.Mesh; phase: number; speed: number }>;
  }> = [];
  for (let i = 0; i < 70; i++) {
    const near = i % 3 === 0;
    const x = (hash2(i * 3.1, 11.7) * 2 - 1) * (near ? 3.6 : 7.5);
    const z = 950 - i * 27.8 - hash2(i, 17.3) * 5;
    const r = 0.9 + hash2(i * 1.7, 23.9) * 1.8;
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
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 22), makeWaterMaterial());
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
  const rainCam = new THREE.Vector3(0, 2, SPAWN_Z);
  const rainLayers = rainLayerDefs.map((def) => {
    const count = Math.floor(def.count * 2.4);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const speed = new Float32Array(count);
    const spawn = (i: number, cam: THREE.Vector3, anywhere: boolean) => {
      const x = cam.x + (Math.random() * 2 - 1) * def.spread;
      const z = cam.z + (Math.random() * 2 - 1) * def.spread * 1.25;
      const y = anywhere
        ? Math.random() * 22
        : Math.max(1.2, terrainHeight(x, z) + 8 + Math.random() * 9);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      uv[i * 2] = (x - cam.x) / def.spread;
      uv[i * 2 + 1] = (z - cam.z) / def.spread;
      speed[i] = def.minSpeed + Math.random() * (def.maxSpeed - def.minSpeed);
    };
    for (let i = 0; i < count; i++) spawn(i, rainCam, true);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mat = new THREE.PointsMaterial({
      map: rainTextures[2],
      size: def.size * 1.8,
      transparent: true,
      opacity: 1,
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

  for (const o of obstacles) if (o.topY !== undefined) climbables.push(o);

  return {
    group,
    objectives,
    obstacles,
    terrainHeight,
    groundY: rayGroundHeight,
    bounds: { minX: -15, maxX: 15, minZ: -1020, maxZ: 1020 },
    setCinematicLighting(on: boolean) {
      sun.intensity = on ? 8.0 : 2.4;
      hemi.intensity = on ? 3.2 : 1.35;
      amb.intensity = on ? 2.0 : 0.85;
    },
    waterDepth(x: number, z: number) {
      if (Math.abs(z + 520) < 2.9 && Math.abs(x) < 8) return 0.12;
      let depth = 0;
      for (const pd of puddleData) {
        const d = Math.hypot(x - pd.x, z - pd.z);
        if (d < pd.r) depth = Math.max(depth, 0.05 * (1 - d / pd.r));
      }
      return depth;
    },
    spawnWaterSplashAt(point: THREE.Vector3) {
      spawnWaterSplash(scene, point);
    },
    updateRain(time: number, dt: number, cameraPos: THREE.Vector3) {
      updateWaterMaterial(dt);
      animateGroundScatter(time, cameraPos);
      const wind = windAt(time);
      const slantIdx = THREE.MathUtils.clamp(Math.round(wind) + 2, 0, rainTextures.length - 1);
      const jumped = Math.abs(cameraPos.z - rainCam.z) > 18;
      rainCam.copy(cameraPos);
      if (jumped)
        for (const layer of rainLayers)
          for (let i = 0; i < layer.pos.length / 3; i++) layer.spawn(i, rainCam, false);
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
    addObstacle(x: number, z: number, r: number, topY?: number) {
      const o = { x, z, r, topY };
      obstacles.push(o);
      if (topY !== undefined) climbables.push(o);
    },
    climbables,
  };
}
