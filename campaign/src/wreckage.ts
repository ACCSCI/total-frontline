import * as THREE from 'three';
import type { LevelObstacle } from './level';
import { snapObjectToTerrain } from './terrain';

function metal(color: number, rough = 0.62) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.55 });
  m.userData.surfaceKey = 'metal';
  return m;
}

function addHull(
  group: THREE.Group,
  mat: THREE.Material,
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.debugKind = 'wreck';
  group.add(mesh);
  return mesh;
}

function buildOspreyWreck(scale: number, burnt: boolean) {
  const g = new THREE.Group();
  g.name = 'P0_OSPREY_WRECK';
  const hull = metal(burnt ? 0x2a2622 : 0x3a3d38, 0.78);
  const soot = metal(0x1a1816, 0.9);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1c2830,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.45,
  });
  addHull(
    g,
    hull,
    new THREE.BoxGeometry(2.4 * scale, 1.15 * scale, 7.2 * scale),
    0,
    0.7 * scale,
    0,
    0.12,
    0.18,
    0.08
  );
  addHull(
    g,
    soot,
    new THREE.BoxGeometry(2.1 * scale, 0.22 * scale, 2.4 * scale),
    0,
    1.28 * scale,
    1.6 * scale,
    0.08,
    0.18,
    0
  );
  addHull(
    g,
    glass,
    new THREE.BoxGeometry(1.6 * scale, 0.55 * scale, 1.1 * scale),
    0,
    1.05 * scale,
    3.1 * scale,
    0.2,
    0.1,
    0
  );
  addHull(
    g,
    hull,
    new THREE.BoxGeometry(6.4 * scale, 0.18 * scale, 1.1 * scale),
    0.4 * scale,
    1.15 * scale,
    0.2 * scale,
    0.05,
    0.35,
    -0.4
  );
  addHull(
    g,
    soot,
    new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 2.8 * scale, 8),
    -2.6 * scale,
    1.4 * scale,
    0.4 * scale,
    1.2,
    0.2,
    0.4
  );
  addHull(
    g,
    hull,
    new THREE.BoxGeometry(0.7 * scale, 0.55 * scale, 3.1 * scale),
    0.2 * scale,
    0.55 * scale,
    -4.2 * scale,
    0.5,
    0.4,
    0.15
  );
  for (let i = 0; i < 3; i++) {
    addHull(
      g,
      soot,
      new THREE.BoxGeometry(0.18 * scale, 0.06 * scale, 1.8 * scale),
      2.4 * scale,
      1.55 * scale,
      -0.2 + i * 0.35,
      0.2,
      i * 0.7,
      0.3
    );
  }
  const fire = new THREE.PointLight(0xff6a28, burnt ? 8 : 3.2, 12 * scale);
  fire.position.set(-0.4 * scale, 1.1 * scale, 1.2 * scale);
  g.add(fire);
  return g;
}

export function placeCrashWrecks(
  group: THREE.Group,
  obstacles: LevelObstacle[],
  propSnaps: Array<() => void>,
  groundAt: (x: number, z: number) => number
) {
  const sites: Array<{ x: number; z: number; scale: number; yaw: number; burnt: boolean }> = [
    { x: 3.2, z: 960, scale: 0.72, yaw: 0.55, burnt: false },
    { x: 1.1, z: 340, scale: 1.05, yaw: -0.4, burnt: true },
    { x: -4.6, z: 318, scale: 0.42, yaw: 1.3, burnt: true },
  ];
  for (const site of sites) {
    const wreck = buildOspreyWreck(site.scale, site.burnt);
    wreck.rotation.y = site.yaw;
    wreck.userData.debugKind = 'wreck';
    group.add(wreck);
    const radius = 2.4 * site.scale;
    const snap = () =>
      snapObjectToTerrain(wreck, site.x, site.z, {
        points: [
          [site.x, site.z],
          [site.x + 2, site.z],
          [site.x - 2, site.z + 2],
        ],
        sink: 0.12,
        groundAt,
        mode: 'center',
      });
    snap();
    propSnaps.push(snap);
    const hullTop = wreck.position.y + 1.3 * site.scale;
    obstacles.push({ x: site.x, z: site.z, r: radius, topY: hullTop, climbR: 1.25 * site.scale });
    obstacles.push({
      x: site.x + Math.sin(site.yaw) * 2.4,
      z: site.z + Math.cos(site.yaw) * 2.4,
      r: radius * 0.7,
      topY: wreck.position.y + 0.82 * site.scale,
      climbR: 0.62 * site.scale,
    });
  }
}
