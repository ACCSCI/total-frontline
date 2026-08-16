import * as THREE from 'three';
import missionsData from '../../shared/missions.json';
import type { LevelObstacle, P0Level } from './level';
import { hash2, snapObjectToTerrain } from './terrain';

function box(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.12 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.debugKind = 'decor';
  parent.add(mesh);
  return mesh;
}

function makeWaterBumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#7d7d7d';
  g.fillRect(0, 0, 128, 128);
  g.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const len = 4 + Math.random() * 16;
    const horizontal = Math.random() < 0.6;
    g.strokeStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${0.12 + Math.random() * 0.2})`
      : `rgba(0,0,0,${0.12 + Math.random() * 0.2})`;
    g.lineWidth = 0.6 + Math.random() * 1.6;
    g.beginPath();
    if (horizontal) {
      g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.4, y + 2, x + len * 0.7, y - 2, x + len, y);
    } else {
      g.moveTo(x, y);
      g.bezierCurveTo(x + 2, y + len * 0.4, x - 2, y + len * 0.7, x, y + len);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

let waterBump: THREE.CanvasTexture | null = null;
let waterEnv: THREE.CanvasTexture | null = null;
let sharedWater: THREE.MeshStandardMaterial | null = null;

function makeSkyEnvTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#162c3c');
  sky.addColorStop(0.45, '#0b1a26');
  sky.addColorStop(1, '#04080c');
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 128);
  const moon = g.createRadialGradient(190, 38, 0, 190, 38, 34);
  moon.addColorStop(0, 'rgba(220,236,250,0.9)');
  moon.addColorStop(0.2, 'rgba(180,205,225,0.45)');
  moon.addColorStop(1, 'rgba(180,205,225,0)');
  g.fillStyle = moon;
  g.fillRect(140, 0, 100, 100);
  const glow = g.createRadialGradient(50, 78, 0, 50, 78, 60);
  glow.addColorStop(0, 'rgba(120,170,210,0.35)');
  glow.addColorStop(1, 'rgba(120,170,210,0)');
  g.fillStyle = glow;
  g.fillRect(0, 30, 120, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export function makeWaterMaterial() {
  if (sharedWater) return sharedWater;
  if (!waterBump) waterBump = makeWaterBumpTexture();
  if (!waterEnv) waterEnv = makeSkyEnvTexture();
  sharedWater = new THREE.MeshStandardMaterial({
    color: 0x2b6478,
    metalness: 0.42,
    roughness: 0.16,
    envMap: waterEnv,
    envMapIntensity: 1.35,
    emissive: 0x081e28,
    bumpMap: waterBump,
    bumpScale: 0.07,
    transparent: true,
    opacity: 0.8,
  });
  return sharedWater;
}

export function updateWaterMaterial(dt: number) {
  if (!waterBump || !sharedWater) return;
  waterBump.offset.y += dt * 0.05;
  waterBump.offset.x += dt * 0.012;
  sharedWater.envMapIntensity = 0.8 + Math.sin(performance.now() * 0.002) * 0.08;
}

export function placeGroundScatter(
  group: THREE.Group,
  propSnaps: Array<() => void>,
  groundAt: (x: number, z: number) => number
) {
  const FERNS = 2200;
  const STONES = 600;
  const fernGeo = new THREE.ConeGeometry(0.3, 0.9, 5);
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x1d3322, roughness: 0.94 });
  const fernMesh = new THREE.InstancedMesh(fernGeo, fernMat, FERNS);
  fernMesh.castShadow = false;
  const stoneGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3c403e, roughness: 0.94 });
  const stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, STONES);
  stoneMesh.castShadow = false;
  const fernData: Array<{ x: number; z: number; s: number; r: number }> = [];
  const GRASS = 2400;
  const grassGeo = new THREE.ConeGeometry(0.12, 0.8, 4);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x263f28, roughness: 0.93 });
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, GRASS);
  grassMesh.castShadow = false;
  const stoneData: Array<{ x: number; z: number; s: number; r: number }> = [];
  const grassData: Array<{ x: number; z: number; s: number; r: number }> = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const eul = new THREE.Euler();
  for (let i = 0; i < FERNS; i++) {
    const x = (hash2(i * 2.1, 4.7) * 2 - 1) * (1.2 + hash2(i, 8.8) * 7.2);
    const z = 1160 - i * 8.1 - hash2(i, 19.3) * 5;
    const s = 1.0 + hash2(i * 3.3, 12.4) * 2.6;
    fernData.push({ x, z, s, r: hash2(i, 31.7) * Math.PI * 2 });
    const y = groundAt(x, z) + 0.18 * s - 0.02;
    pos.set(x, y, z);
    scale.set(s, s * (0.8 + hash2(i, 7.7) * 0.5), s);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fernData[i].r);
    m.compose(pos, q, scale);
    fernMesh.setMatrixAt(i, m);
  }
  for (let i = 0; i < GRASS; i++) {
    const x = (hash2(i * 5.3, 13.7) * 2 - 1) * (0.7 + hash2(i, 26.6) * 8.2);
    const z = 1160 - i * 3.9 - hash2(i, 9.7) * 2;
    const s = 0.9 + hash2(i * 2.9, 33.1) * 2.4;
    grassData.push({ x, z, s, r: hash2(i, 17.9) * Math.PI * 2 });
    pos.set(x, groundAt(x, z) + 0.2 * s - 0.03, z);
    scale.set(s, s * (0.85 + hash2(i, 29.9) * 0.5), s);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), grassData[i].r);
    m.compose(pos, q, scale);
    grassMesh.setMatrixAt(i, m);
  }
  for (let i = 0; i < STONES; i++) {
    const x = (hash2(i * 6.1, 1.9) * 2 - 1) * (1.6 + hash2(i, 22.2) * 7.4);
    const z = 1140 - i * 17.6 - hash2(i, 37.1) * 9;
    const s = 0.8 + hash2(i * 2.7, 41.3) * 1.8;
    stoneData.push({ x, z, s, r: hash2(i, 3.3) * Math.PI * 2 });
    const y = groundAt(x, z) + 0.05;
    pos.set(x, y, z);
    scale.setScalar(s);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), stoneData[i].r);
    m.compose(pos, q, scale);
    stoneMesh.setMatrixAt(i, m);
  }
  const resnap = () => {
    for (let i = 0; i < fernData.length; i++) {
      const d = fernData[i];
      pos.set(d.x, groundAt(d.x, d.z) + 0.18 * d.s - 0.02, d.z);
      scale.set(d.s, d.s * (0.8 + hash2(i, 7.7) * 0.5), d.s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.r);
      m.compose(pos, q, scale);
      fernMesh.setMatrixAt(i, m);
    }
    for (let i = 0; i < grassData.length; i++) {
      const d = grassData[i];
      pos.set(d.x, groundAt(d.x, d.z) + 0.2 * d.s - 0.03, d.z);
      scale.set(d.s, d.s * (0.85 + hash2(i, 29.9) * 0.5), d.s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.r);
      m.compose(pos, q, scale);
      grassMesh.setMatrixAt(i, m);
    }
    for (let i = 0; i < stoneData.length; i++) {
      const d = stoneData[i];
      pos.set(d.x, groundAt(d.x, d.z) + 0.05, d.z);
      scale.setScalar(d.s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.r);
      m.compose(pos, q, scale);
      stoneMesh.setMatrixAt(i, m);
    }
    fernMesh.instanceMatrix.needsUpdate = true;
    grassMesh.instanceMatrix.needsUpdate = true;
    stoneMesh.instanceMatrix.needsUpdate = true;
  };
  resnap();
  propSnaps.push(resnap);
  group.add(fernMesh, grassMesh, stoneMesh);

  return (time: number, playerPos: THREE.Vector3) => {
    const px = playerPos.x;
    const pz = playerPos.z;
    for (let i = 0; i < grassData.length; i++) {
      const d = grassData[i];
      const dx = d.x - px;
      const dz = d.z - pz;
      const dist = Math.hypot(dx, dz) || 1;
      const bend = Math.max(0, 1 - dist / 1.7) * 0.85;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const sway = Math.sin(time * 1.6 + d.x * 0.55 + d.z * 0.4) * 0.12;
      const sway2 = Math.sin(time * 0.8 + d.z * 0.23) * 0.07;
      pos.set(d.x, groundAt(d.x, d.z) + 0.2 * d.s - 0.03, d.z);
      scale.set(d.s, d.s * (0.85 + hash2(i, 29.9) * 0.5), d.s);
      eul.set(sway + bend * dirX * 0.55, d.r, sway2 + bend * dirZ * 0.55);
      q.setFromEuler(eul);
      m.compose(pos, q, scale);
      grassMesh.setMatrixAt(i, m);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
  };
}

export function placeMissionSetDressing(
  group: THREE.Group,
  obstacles: LevelObstacle[],
  propSnaps: Array<() => void>,
  groundAt: (x: number, z: number) => number
) {
  const hut = new THREE.Group();
  box(hut, 4.2, 2.4, 3.4, 0x3a342c, 0, 1.2, 0);
  box(hut, 4.4, 0.16, 3.6, 0x2a241c, 0, 2.45, 0);
  hut.userData.debugKind = 'decor';
  group.add(hut);
  const snapHut = () =>
    snapObjectToTerrain(hut, -8.5, 640, { sink: 0.05, groundAt, mode: 'center' });
  snapHut();
  propSnaps.push(snapHut);
  obstacles.push({ x: -8.5, z: 640, r: 2.6 });

  const fuel = new THREE.Group();
  fuel.name = 'P0_FUEL_TANKS';
  for (const ox of [-1.6, 1.6]) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.55, metalness: 0.35 })
    );
    tank.position.set(ox, 1.3, 0);
    tank.castShadow = true;
    tank.userData.debugKind = 'fuel';
    fuel.add(tank);
  }
  box(fuel, 1.1, 1.1, 0.7, 0x2c2c24, 0, 0.55, 1.6);
  group.add(fuel);
  const snapFuel = () =>
    snapObjectToTerrain(fuel, 0, -230, { sink: 0.04, groundAt, mode: 'center' });
  snapFuel();
  propSnaps.push(snapFuel);
  obstacles.push({ x: 0, z: -230, r: 2.8 });

  // Shallow flooded stream at valley B. Wet Phong surface picks up the key
  // light so the crossing reads as water even in the dark.
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.5), makeWaterMaterial());
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(0, groundAt(0, -520) + 0.06, -520);
  stream.receiveShadow = true;
  stream.userData.debugKind = 'decor';
  group.add(stream);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xdfefff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  for (const [gx, gz, gw] of [[-2.6, -517, 3.6], [2.4, -523, 2.8]] as Array<[number, number, number]>) {
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(gw, 0.16), glintMat);
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(gx, groundAt(gx, gz) + 0.09, gz);
    glint.userData.debugKind = 'decor';
    group.add(glint);
  }

  // Stream banks: pebbles and grass so the crossing isn't a flat blue slab.
  const PEBBLES = 64;
  const BANK_GRASS = 140;
  const pebbleGeo = new THREE.IcosahedronGeometry(0.14, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x7a837d, roughness: 0.72, metalness: 0.05 });
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, PEBBLES);
  const bankGeo = new THREE.ConeGeometry(0.18, 0.55, 4);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x3f7a40, roughness: 0.88, emissive: 0x061306 });
  const bankGrass = new THREE.InstancedMesh(bankGeo, bankMat, BANK_GRASS);
  const sm = new THREE.Matrix4();
  const sq = new THREE.Quaternion();
  const sp = new THREE.Vector3();
  const ss = new THREE.Vector3();
  for (let i = 0; i < PEBBLES; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (0.7 + hash2(i, 4.2) * 7.5);
    const z = -520 + (hash2(i * 1.7, 9.1) - 0.5) * 9;
    const s = 0.85 + hash2(i, 18.2) * 1.7;
    sp.set(x, groundAt(x, z) + 0.07, z);
    ss.setScalar(s);
    sq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(i, 3.3) * Math.PI * 2);
    sm.compose(sp, sq, ss);
    pebbles.setMatrixAt(i, sm);
  }
  for (let i = 0; i < BANK_GRASS; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (0.9 + hash2(i, 6.6) * 7.8);
    const z = -520 + (hash2(i * 2.3, 14.4) - 0.5) * 10;
    const s = 1.3 + hash2(i, 22.7) * 2.4;
    sp.set(x, groundAt(x, z) + 0.2 * s, z);
    ss.set(s, s * (0.8 + hash2(i, 7.1) * 0.5), s);
    sq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(i, 2.9) * Math.PI * 2);
    sm.compose(sp, sq, ss);
    bankGrass.setMatrixAt(i, sm);
  }
  group.add(pebbles, bankGrass);

  const post = new THREE.Group();
  box(post, 3.6, 2.1, 2.8, 0x353830, 0, 1.05, 0);
  box(post, 0.18, 1.4, 2.2, 0xc9c3b4, 1.9, 1.4, 0);
  group.add(post);
  const snapPost = () =>
    snapObjectToTerrain(post, 7.2, -860, { sink: 0.04, groundAt, mode: 'center' });
  snapPost();
  propSnaps.push(snapPost);
  obstacles.push({ x: 7.2, z: -860, r: 2.2 });

  // Bridge approach clutter: rusted drums and sandbags so the final run-up
  // doesn't read as an empty parking lot.
  const drumGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10);
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x5a3b2c, roughness: 0.6, metalness: 0.45 });
  const sandGeo = new THREE.BoxGeometry(0.85, 0.42, 0.5);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3e, roughness: 0.95 });
  const approach = new THREE.Group();
  approach.name = 'P0_BRIDGE_APPROACH';
  const clutter: Array<[number, number]> = [
    [3.8, -770],
    [-3.6, -785],
    [4.6, -815],
    [-4.4, -800],
    [2.8, -840],
    [-3.1, -850],
  ];
  clutter.forEach(([cx, cz], i) => {
    if (i % 2) {
      const drum = new THREE.Mesh(drumGeo, drumMat);
      drum.position.set(cx, 0.48, cz);
      drum.rotation.z = 0.12;
      drum.castShadow = true;
      drum.userData.debugKind = 'decor';
      approach.add(drum);
      obstacles.push({ x: cx, z: cz, r: 0.62 });
    } else {
      const sandbag = new THREE.Mesh(sandGeo, sandMat);
      sandbag.position.set(cx, 0.23, cz);
      sandbag.rotation.y = i;
      sandbag.castShadow = true;
      sandbag.userData.debugKind = 'decor';
      approach.add(sandbag);
      obstacles.push({ x: cx, z: cz, r: 0.55 });
    }
  });
  group.add(approach);
  const snapApproach = () =>
    snapObjectToTerrain(approach, 0, -800, {
      points: clutter.map(([x, z]) => [x, z]),
      sink: 0.04,
      groundAt,
      mode: 'min',
    });
  snapApproach();
  propSnaps.push(snapApproach);
}

export function makeExfilVehicle(level: P0Level) {
  const pos = (missionsData.mission01 as { interactives: { exfil?: { x: number; z: number } } })
    .interactives.exfil || { x: 0, z: -985 };
  const g = new THREE.Group();
  g.name = 'P0_EXFIL_TRUCK';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.0, 5.6),
    new THREE.MeshStandardMaterial({ color: 0x2b332c, roughness: 0.6, metalness: 0.4 })
  );
  body.position.y = 1.35;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.25, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x333a30, roughness: 0.5, metalness: 0.5 })
  );
  cab.position.set(0.15, 1.15, 2.6);
  cab.castShadow = true;
  g.add(cab);
  const canvas = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 1.0, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x3b422e, roughness: 0.9 })
  );
  canvas.position.set(0, 2.15, -0.7);
  canvas.castShadow = true;
  g.add(canvas);
  for (const [sx, sz] of [[-1.05, 1.8], [1.05, 1.8], [-1.05, -1.8], [1.05, -1.8]]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x111312, roughness: 0.9 })
    );
    wheel.name = 'exfilWheel';
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.42, sz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2cc,
    emissive: 0xffe6a8,
    emissiveIntensity: 2.2,
  });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), headMat);
    head.position.set(sx, 0.85, 3.55);
    g.add(head);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x8a1414,
    emissive: 0x661010,
    emissiveIntensity: 1.1,
  });
  for (const sx of [-1.0, 1.0]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.06), tailMat);
    tail.position.set(sx, 0.78, -2.82);
    g.add(tail);
  }
  const beacon = new THREE.PointLight(0x77ccff, 6, 14, 1.5);
  beacon.position.y = 3.0;
  g.add(beacon);
  g.position.set(pos.x, level.groundY(pos.x, pos.z) + 0.02, pos.z);
  g.rotation.y = Math.PI;
  g.userData.debugKind = 'decor';
  return g;
}

export function makeModuleMarker(level: P0Level) {
  const pos = (missionsData.mission01 as { interactives: { module: { x: number; z: number } } })
    .interactives.module;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.22, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0x2a6a8a,
      emissive: 0x14506a,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    })
  );
  mesh.position.set(pos.x, level.groundY(pos.x, pos.z) + 0.28, pos.z);
  mesh.userData.debugKind = 'module';
  return mesh;
}

export function makeApcMesh() {
  const g = new THREE.Group();
  g.name = 'P0_APC';
  const armor = new THREE.MeshStandardMaterial({ color: 0x2c3028, roughness: 0.66, metalness: 0.45 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 5.4), armor);
  hull.position.y = 0.85;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.55, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x33382d, roughness: 0.6, metalness: 0.5 })
  );
  nose.position.set(0, 0.62, 2.85);
  nose.rotation.x = -0.14;
  nose.castShadow = true;
  g.add(nose);
  const turret = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.45, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x242820, roughness: 0.65, metalness: 0.5 })
  );
  turret.position.set(0, 1.6, 0.4);
  turret.castShadow = true;
  g.add(turret);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 1.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x151713, roughness: 0.5, metalness: 0.6 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.66, 1.35);
  barrel.castShadow = true;
  g.add(barrel);
  for (const [sx, sz] of [[-1.05, 1.7], [1.05, 1.7], [-1.05, -1.7], [1.05, -1.7]]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0x111312, roughness: 0.9 })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.4, sz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c0,
    emissive: 0xffe6a0,
    emissiveIntensity: 2.0,
  });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), headMat);
    head.position.set(sx, 0.68, 2.92);
    g.add(head);
  }
  const search = new THREE.PointLight(0xaaccff, 8, 22, 1.5);
  search.position.set(0, 2.1, 2.4);
  g.add(search);
  return g;
}

export function makeBurnBlock(level: P0Level) {
  const g = new THREE.Group();
  g.name = 'P0_BURN_BLOCK';
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.4, 4.2, 6),
      new THREE.MeshStandardMaterial({
        color: 0x1a100c,
        roughness: 0.95,
        emissive: 0x3a1208,
        emissiveIntensity: 0.35,
      })
    );
    log.rotation.z = Math.PI / 2;
    log.position.set((i - 2) * 1.3, 0.4, 0);
    g.add(log);
  }
  g.position.set(-2.2, level.groundY(-2.2, -520), -520);
  g.visible = false;
  return g;
}
