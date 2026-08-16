import * as THREE from 'three';
import type { P0Level } from './level';

export function buildSupplyCrate(): THREE.Group {
  const crate = new THREE.Group();
  crate.name = 'P0_SUPPLY_CRATE';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3e4a36,
    roughness: 0.8,
    metalness: 0.15,
  });
  bodyMat.userData.surfaceKey = 'crate';
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x24251f,
    roughness: 0.7,
    metalness: 0.3,
  });
  trimMat.userData.surfaceKey = 'metal';
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c17,
    roughness: 0.6,
    metalness: 0.2,
  });
  strapMat.userData.surfaceKey = 'metal';

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

export function addCrateObstacles(
  level: P0Level,
  crate: THREE.Object3D,
  x: number,
  z: number,
  step: number,
  radius: number
) {
  const top = new THREE.Box3().setFromObject(crate).max.y;
  for (const dx of [-step, 0, step]) level.addObstacle(x + dx, z, radius, top);
}
