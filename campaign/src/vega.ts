import * as THREE from 'three';
import missionsData from '../../shared/missions.json';
import type { P0Level } from './level';

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeVegaModel(level: P0Level) {
  const pos = (missionsData.mission01 as { interactives: { vega: { x: number; z: number } } })
    .interactives.vega;
  const g = new THREE.Group();
  g.name = 'P0_VEGA';

  const flightSuit = new THREE.MeshStandardMaterial({ color: 0x52634b, roughness: 0.8, metalness: 0.04, emissive: 0x0a1008 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x2b312a, roughness: 0.7, metalness: 0.1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb2875e, roughness: 0.8 });
  const gear = new THREE.MeshStandardMaterial({ color: 0x22251f, roughness: 0.55, metalness: 0.25 });
  const helmet = new THREE.MeshStandardMaterial({ color: 0x4a4e3e, roughness: 0.6, metalness: 0.08 });
  const blood = new THREE.MeshStandardMaterial({ color: 0x6e1512, roughness: 0.95 });

  const torso = new THREE.Group();
  torso.name = 'vegaTorso';
  torso.position.y = 0.78;
  g.add(torso);
  part(torso, new THREE.CapsuleGeometry(0.27, 0.55, 4, 10), flightSuit, 0, 0.35, 0);
  part(torso, new THREE.BoxGeometry(0.5, 0.46, 0.3), vest, 0, 0.42, 0.01);
  part(torso, new THREE.BoxGeometry(0.16, 0.2, 0.08), vest, -0.18, 0.4, -0.17);
  part(torso, new THREE.BoxGeometry(0.16, 0.2, 0.08), vest, 0.18, 0.4, -0.17);
  part(torso, new THREE.BoxGeometry(0.2, 0.08, 0.1), gear, 0.02, 0.66, 0.06);
  part(torso, new THREE.BoxGeometry(0.2, 0.34, 0.04), blood, -0.02, 0.45, -0.145);

  const head = new THREE.Group();
  head.name = 'vegaHead';
  head.position.y = 1.38;
  g.add(head);
  part(head, new THREE.SphereGeometry(0.16, 14, 12), skin, 0, 0, 0);
  part(head, new THREE.SphereGeometry(0.174, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), helmet, 0, 0.02, 0);
  part(head, new THREE.BoxGeometry(0.24, 0.07, 0.2), helmet, 0, 0.055, -0.03);
  part(head, new THREE.BoxGeometry(0.22, 0.05, 0.12), gear, 0, -0.035, -0.12);
  part(head, new THREE.BoxGeometry(0.02, 0.05, 0.02), gear, 0.1, -0.02, -0.13);

  const armL = new THREE.Group();
  armL.name = 'vegaArmL';
  armL.position.set(-0.3, 1.32, 0);
  g.add(armL);
  part(armL, new THREE.BoxGeometry(0.14, 0.46, 0.14), flightSuit, 0, -0.22, 0);
  part(armL, new THREE.BoxGeometry(0.13, 0.34, 0.13), skin, 0, -0.55, 0);

  const armR = new THREE.Group();
  armR.name = 'vegaArmR';
  armR.position.set(0.3, 1.3, 0);
  armR.rotation.z = 0.55;
  g.add(armR);
  part(armR, new THREE.BoxGeometry(0.15, 0.48, 0.15), flightSuit, 0, -0.2, 0.03);
  part(armR, new THREE.BoxGeometry(0.2, 0.5, 0.06), blood, 0, -0.18, 0.02);

  const legL = new THREE.Group();
  legL.name = 'vegaLegL';
  legL.position.set(-0.17, 0.74, 0);
  g.add(legL);
  part(legL, new THREE.BoxGeometry(0.19, 0.52, 0.2), flightSuit, 0, -0.26, 0);
  part(legL, new THREE.BoxGeometry(0.21, 0.12, 0.32), gear, 0, -0.52, -0.04);

  const legR = new THREE.Group();
  legR.name = 'vegaLegR';
  legR.position.set(0.17, 0.74, 0);
  legR.rotation.x = 0.35;
  g.add(legR);
  part(legR, new THREE.BoxGeometry(0.19, 0.5, 0.2), flightSuit, 0, -0.25, 0);
  part(legR, new THREE.BoxGeometry(0.21, 0.12, 0.3), gear, 0, -0.5, -0.03);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  beacon.position.y = 1.8;
  g.add(beacon);
  const beaconLight = new THREE.PointLight(0xff3020, 4, 10, 1.5);
  beaconLight.position.y = 1.86;
  g.add(beaconLight);
  const rescueLight = new THREE.PointLight(0xffc080, 4, 8, 1.4);
  rescueLight.position.set(0, 1.5, 0.5);
  g.add(rescueLight);
  const bloodStain = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 18),
    new THREE.MeshBasicMaterial({ color: 0x6e1512, transparent: true, opacity: 0.38, depthWrite: false })
  );
  bloodStain.rotation.x = -Math.PI / 2;
  bloodStain.position.y = 0.025;
  g.add(bloodStain);

  // Nameplate: make it unmistakable that this is a person, not a pickup.
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = 'rgba(4,8,12,0.72)';
  ctx.fillRect(18, 8, 220, 44);
  ctx.strokeStyle = 'rgba(120,220,150,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 8, 220, 44);
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8f5e2';
  ctx.fillText('VEGA · 织女', 128, 40);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, fog: false })
  );
  label.name = 'vegaLabel';
  label.scale.set(1.05, 0.26, 1);
  label.position.y = 2.25;
  g.add(label);

  g.position.set(pos.x, level.groundY(pos.x, pos.z) + 0.02, pos.z);
  g.userData.debugKind = 'vega';
  return g;
}

export function animateVega(g: THREE.Group, time: number, dt: number, rescued: boolean) {
  const torso = g.getObjectByName('vegaTorso');
  const head = g.getObjectByName('vegaHead');
  const armL = g.getObjectByName('vegaArmL');
  const legL = g.getObjectByName('vegaLegL');
  const legR = g.getObjectByName('vegaLegR');
  const label = g.getObjectByName('vegaLabel') as THREE.Sprite | null;
  if (label) {
    const pulse = 0.82 + Math.sin(time * 2.4) * 0.18;
    label.scale.set(1.05 * pulse, 0.26 * pulse, 1);
  }
  if (rescued) {
    const swing = Math.sin(time * 9.5);
    if (torso) torso.position.y = 0.78 + Math.abs(Math.sin(time * 9.5)) * 0.05;
    if (head) {
      head.rotation.y = Math.sin(time * 1.3) * 0.18;
      head.rotation.x = 0.06 + Math.sin(time * 2.1) * 0.04;
    }
    if (armL) armL.rotation.x = swing * 0.55;
    if (legL) legL.rotation.x = swing * 0.6;
    if (legR) legR.rotation.x = 0.2 - swing * 0.6;
  } else {
    const breath = Math.sin(time * 2.1) * 0.035;
    if (torso) {
      torso.rotation.x = 0.22 + breath;
      torso.position.y = 0.78;
    }
    if (head) {
      head.rotation.x = 0.26 + Math.sin(time * 1.7) * 0.05;
      head.rotation.y = 0.12;
    }
    if (legL) legL.rotation.x = 0.25;
    if (legR) legR.rotation.x = 0.55 + breath;
    if (armL) armL.rotation.x = 0.2 + breath;
  }
  void dt;
}
