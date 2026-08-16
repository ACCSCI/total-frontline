import * as THREE from 'three';
import missionsData from '../../shared/missions.json';
import type { LevelObstacle } from './level';

interface CampDef {
  x: number;
  z: number;
  roles: string[];
}

export function placeEnemyCamps(
  group: THREE.Group,
  obstacles: LevelObstacle[],
  propSnaps: Array<() => void>,
  groundAt: (x: number, z: number) => number
) {
  const camps = (missionsData.mission01 as { camps?: CampDef[] }).camps || [];
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4d49, roughness: 0.94 });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.95 });
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xff7a28,
    emissive: 0xff5a10,
    emissiveIntensity: 2.2,
    roughness: 0.6,
  });

  for (const camp of camps) {
    const root = new THREE.Group();
    root.name = 'P0_ENEMY_CAMP';
    root.position.set(camp.x, groundAt(camp.x, camp.z), camp.z);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 12), stoneMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.receiveShadow = true;
    root.add(ring);
    for (let i = 0; i < 8; i++) {
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (i % 3) * 0.05, 0), stoneMat);
      const a = (i / 8) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1);
      stone.rotation.set(i, i * 1.7, 0);
      root.add(stone);
    }
    for (const [sx, sz, ry] of [[-0.5, 0.2, 0.4], [0.55, -0.1, -0.7], [0.1, 0.5, 1.2]] as Array<[number, number, number]>) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 6), logMat);
      log.position.set(sx, 0.28, sz);
      log.rotation.set(0, ry, Math.PI / 2);
      log.castShadow = true;
      root.add(log);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 7), fireMat);
    fire.position.y = 0.62;
    fire.castShadow = true;
    root.add(fire);
    const glow = new THREE.PointLight(0xff8a38, 8, 14, 1.3);
    glow.position.y = 1.0;
    root.add(glow);

    group.add(root);
    obstacles.push({ x: camp.x, z: camp.z, r: 1.5 });
    propSnaps.push(() => {
      root.position.set(camp.x, groundAt(camp.x, camp.z), camp.z);
    });
  }
}
