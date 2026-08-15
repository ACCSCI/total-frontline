import * as THREE from 'three';

/* Port of the main game's procedural soldier rig (src/18-enemies.ts), adapted
   to the standalone r185/WebGPU prototype. Same silhouette, same proportions,
   same hitboxes; the expensive per-bone geometry collapse is omitted because
   six enemies are far below the draw-call budget here. */

function B(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}

function CYL(rt: number, rb: number, h: number, seg: number) {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}

function CYLZ(rt: number, rb: number, h: number, seg: number) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  /* Night forest enemies stay out of the shadow pass: thirty soldiers times
     thirty meshes would otherwise dominate the frame budget. */
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function makeCamoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = '#585a41';
  x.fillRect(0, 0, 128, 128);
  const blob = (fill: string, count: number, rMin: number, rMax: number) => {
    x.fillStyle = fill;
    for (let i = 0; i < count; i++) {
      const cx = Math.random() * 128;
      const cy = Math.random() * 128;
      const r = rMin + Math.random() * (rMax - rMin);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const px = cx + ox * 128;
          const py = cy + oy * 128;
          x.beginPath();
          for (let k = 0; k <= 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const rr = r * (0.6 + 0.4 * Math.abs(Math.sin(a * 2.1 + cx)));
            const qx = px + Math.cos(a) * rr;
            const qy = py + Math.sin(a) * rr;
            k ? x.lineTo(qx, qy) : x.moveTo(qx, qy);
          }
          x.closePath();
          x.fill();
        }
    }
  };
  blob('#464934', 9, 8, 18);
  blob('#33372a', 7, 6, 14);
  blob('#6d6650', 6, 5, 12);
  blob('#22241d', 5, 3, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function capsuleGroup(parent: THREE.Group, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number) {
  part(parent, CYL(r, r, h, 12), mat, x, y, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y + h / 2, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y - h / 2, z);
}

export interface SoldierRig {
  model: THREE.Group;
  body: THREE.Group;
  legs: Array<{ hip: THREE.Group; knee: THREE.Group }>;
  arms: Array<{ sh: THREE.Group; el: THREE.Group }>;
  rig: THREE.Group;
  gun: THREE.Group;
  gunMuzzle: THREE.Object3D;
  head: THREE.Group;
  hbHead: THREE.Mesh;
  hbBody: THREE.Mesh;
  hbLegs: THREE.Mesh;
}

export function buildSoldierModel(): SoldierRig {
  const camo = makeCamoTexture();
  const MAT = {
    cloth: new THREE.MeshStandardMaterial({ map: camo, roughness: 0.94, metalness: 0.02 }),
    webb: new THREE.MeshStandardMaterial({ color: 0x565842, roughness: 0.94, metalness: 0.02 }),
    vest: new THREE.MeshStandardMaterial({ color: 0x32342f, roughness: 0.8, metalness: 0.06 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xa87f5b, roughness: 0.86 }),
    helm: new THREE.MeshStandardMaterial({ color: 0x4b4d40, roughness: 0.62, metalness: 0.08 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.94, metalness: 0.04 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x44484c, roughness: 0.48, metalness: 0.16 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.14, metalness: 0.24 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff3b2a, emissive: 0xff2a18, emissiveIntensity: 1.6, roughness: 0.5 }),
  };
  const INVIS = new THREE.MeshBasicMaterial({ visible: false });

  const model = new THREE.Group();
  model.name = 'soldierModel';
  const body = new THREE.Group();
  body.name = 'soldierBody';
  model.add(body);

  const legs: Array<{ hip: THREE.Group; knee: THREE.Group }> = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.name = s < 0 ? 'hipL' : 'hipR';
    hip.position.set(s * 0.135, 0.9, 0);
    body.add(hip);
    part(hip, B(0.185, 0.46, 0.2), MAT.cloth, 0, -0.23, 0);
    part(hip, B(0.155, 0.115, 0.055), MAT.vest, 0, -0.4, -0.106);
    const knee = new THREE.Group();
    knee.name = s < 0 ? 'kneeL' : 'kneeR';
    knee.position.set(0, -0.46, 0);
    hip.add(knee);
    part(knee, B(0.165, 0.44, 0.185), MAT.cloth, 0, -0.22, 0);
    part(knee, B(0.172, 0.17, 0.195), MAT.boot, 0, -0.38, -0.004);
    part(knee, B(0.175, 0.1, 0.28), MAT.boot, 0, -0.42, -0.035);
    legs.push({ hip, knee });
  }

  capsuleGroup(body, 0.215, 0.44, MAT.cloth, 0, 1.2, 0);
  part(body, B(0.455, 0.5, 0.315), MAT.vest, 0, 1.25, -0.005);
  part(body, B(0.3, 0.2, 0.075), MAT.vest, 0, 1.3, -0.175);
  part(body, B(0.115, 0.115, 0.075), MAT.webb, 0.135, 1.13, -0.175);
  part(body, B(0.115, 0.115, 0.075), MAT.webb, 0, 1.13, -0.178);
  part(body, B(0.115, 0.115, 0.075), MAT.webb, -0.135, 1.13, -0.175);
  part(body, B(0.2, 0.075, 0.06), MAT.webb, 0, 1.44, -0.168);
  part(body, B(0.075, 0.02, 0.02), MAT.accent, 0, 1.4, -0.196);
  part(body, B(0.485, 0.115, 0.3), MAT.vest, 0, 1.48, -0.005);
  part(body, B(0.4, 0.1, 0.32), MAT.webb, 0, 1.06, -0.005);
  part(body, B(0.11, 0.15, 0.09), MAT.webb, 0.2, 1.02, -0.06);
  part(body, B(0.11, 0.15, 0.09), MAT.webb, -0.2, 1.02, -0.06);
  part(body, B(0.3, 0.3, 0.16), MAT.webb, 0, 1.34, 0.21);
  part(body, B(0.11, 0.24, 0.1), MAT.vest, 0.13, 1.36, 0.3);

  part(body, CYL(0.062, 0.062, 0.1, 8), MAT.skin, 0, 1.53, 0);
  const head = new THREE.Group();
  head.name = 'soldierHead';
  head.position.set(0, 1.655, 0);
  body.add(head);
  part(head, new THREE.SphereGeometry(0.135, 14, 12), MAT.skin, 0, 0, 0);
  part(head, new THREE.SphereGeometry(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.64), MAT.helm, 0, 0.012, 0);
  part(head, B(0.3, 0.035, 0.3), MAT.helm, 0, -0.048, 0.004);
  part(head, B(0.055, 0.1, 0.05), MAT.vest, 0.145, -0.035, 0.01);
  part(head, B(0.055, 0.1, 0.05), MAT.vest, -0.145, -0.035, 0.01);
  part(head, B(0.2, 0.055, 0.06), MAT.glass, 0, 0.01, -0.115);
  part(head, B(0.21, 0.022, 0.05), MAT.vest, 0, 0.048, -0.108);
  part(head, B(0.13, 0.075, 0.06), MAT.vest, 0, -0.062, -0.105);
  part(head, B(0.026, 0.026, 0.1), MAT.helm, 0.1, 0.055, -0.02);
  part(head, B(0.055, 0.045, 0.045), MAT.helm, 0, 0.075, -0.1);

  const rig = new THREE.Group();
  rig.name = 'soldierRig';
  rig.position.set(0, 1.4, 0);
  body.add(rig);
  const arms: Array<{ sh: THREE.Group; el: THREE.Group }> = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.name = s < 0 ? 'shoulderL' : 'shoulderR';
    sh.position.set(s * 0.275, 0.02, 0);
    rig.add(sh);
    part(sh, B(0.15, 0.135, 0.165), MAT.vest, 0, -0.035, 0);
    part(sh, B(0.155, 0.07, 0.176), MAT.accent, 0, -0.07, 0);
    part(sh, B(0.135, 0.34, 0.145), MAT.cloth, 0, -0.17, 0);
    part(sh, B(0.14, 0.075, 0.15), MAT.vest, 0, -0.3, 0);
    const el = new THREE.Group();
    el.name = s < 0 ? 'elbowL' : 'elbowR';
    el.position.set(0, -0.34, 0);
    sh.add(el);
    part(el, B(0.115, 0.3, 0.125), MAT.cloth, 0, -0.15, 0);
    part(el, B(0.1, 0.1, 0.13), MAT.boot, 0, -0.3, 0.01);
    arms.push({ sh, el });
  }

  const gun = new THREE.Group();
  gun.name = 'soldierGun';
  rig.add(gun);
  part(gun, B(0.065, 0.085, 0.34), MAT.gun, 0, 0, -0.1);
  part(gun, CYLZ(0.016, 0.016, 0.32, 8), MAT.gun, 0, 0.006, -0.4);
  part(gun, B(0.045, 0.14, 0.07), MAT.gun, 0, -0.1, -0.05);
  part(gun, B(0.05, 0.1, 0.06), MAT.gun, 0, -0.075, 0.05);
  part(gun, B(0.055, 0.075, 0.16), MAT.gun, 0, -0.005, 0.16);
  const gunMuzzle = new THREE.Object3D();
  gunMuzzle.name = 'soldierGunMuzzle';
  gunMuzzle.position.set(0, 0.006, -0.56);
  gun.add(gunMuzzle);

  const hbHead = new THREE.Mesh(B(0.33, 0.34, 0.33), INVIS);
  hbHead.name = 'hbHead';
  hbHead.position.set(0, 1.66, 0);
  body.add(hbHead);
  const hbBody = new THREE.Mesh(B(0.62, 0.62, 0.42), INVIS);
  hbBody.name = 'hbBody';
  hbBody.position.set(0, 1.2, 0);
  body.add(hbBody);
  const hbLegs = new THREE.Mesh(B(0.55, 0.92, 0.36), INVIS);
  hbLegs.name = 'hbLegs';
  hbLegs.position.set(0, 0.46, 0);
  body.add(hbLegs);

  return { model, body, legs, arms, rig, gun, gunMuzzle, head, hbHead, hbBody, hbLegs };
}

export function cloneSoldierRig(template: SoldierRig): SoldierRig {
  const model = template.model.clone(true);
  const body = model.getObjectByName('soldierBody') as THREE.Group;
  const head = model.getObjectByName('soldierHead') as THREE.Group;
  const rig = model.getObjectByName('soldierRig') as THREE.Group;
  const gun = model.getObjectByName('soldierGun') as THREE.Group;
  const gunMuzzle = model.getObjectByName('soldierGunMuzzle') as THREE.Object3D;
  const hbHead = model.getObjectByName('hbHead') as THREE.Mesh;
  const hbBody = model.getObjectByName('hbBody') as THREE.Mesh;
  const hbLegs = model.getObjectByName('hbLegs') as THREE.Mesh;
  const legs = (['hipL', 'hipR'] as const).map((name, li) => ({
    hip: model.getObjectByName(name) as THREE.Group,
    knee: model.getObjectByName(li === 0 ? 'kneeL' : 'kneeR') as THREE.Group,
  }));
  const arms = (['shoulderL', 'shoulderR'] as const).map((name, li) => ({
    sh: model.getObjectByName(name) as THREE.Group,
    el: model.getObjectByName(li === 0 ? 'elbowL' : 'elbowR') as THREE.Group,
  }));
  return { model, body, legs, arms, rig, gun, gunMuzzle, head, hbHead, hbBody, hbLegs };
}
