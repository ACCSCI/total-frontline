import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Exact port of src/18-enemies.ts: same multi-scale camo, same EB UV scaling,
   same part list, same per-bone geometry collapse and the same nameplate/health
   tag. The campaign reuses the single-player soldier instead of a simplified
   stand-in. */

export const ENEMY_NAMES = [
  '毒蛇',
  '幽灵',
  '收割者',
  '浩劫',
  '突击手',
  '眼镜蛇',
  '利爪',
  '恶狼',
  '柴油',
  '暗影',
];

function cvs(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function finishTex(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

function grain(x: CanvasRenderingContext2D, size: number, count: number) {
  x.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < count; i++) x.fillRect(Math.random() * size, Math.random() * size, 1, 1);
}

function makeCamoTex() {
  const S = 256;
  const [c, x] = cvs(S);
  x.fillStyle = '#585a41';
  x.fillRect(0, 0, S, S);
  const blob = (fill: string, count: number, rMin: number, rMax: number, lobes: number) => {
    x.fillStyle = fill;
    for (let i = 0; i < count; i++) {
      const cx = Math.random() * S;
      const cy = Math.random() * S;
      const r = rMin + Math.random() * (rMax - rMin);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const px = cx + ox * S;
          const py = cy + oy * S;
          if (px < -r * 2 || px > S + r * 2 || py < -r * 2 || py > S + r * 2) continue;
          x.beginPath();
          for (let k = 0; k <= lobes; k++) {
            const a = (k / lobes) * Math.PI * 2;
            const rr = r * (0.62 + 0.38 * Math.abs(Math.sin(a * 2.3 + cx)));
            const qx = px + Math.cos(a) * rr;
            const qy = py + Math.sin(a) * rr;
            k ? x.lineTo(qx, qy) : x.moveTo(qx, qy);
          }
          x.closePath();
          x.fill();
        }
    }
  };
  blob('#464934', 16, 16, 34, 9);
  blob('#33372a', 13, 11, 26, 8);
  blob('#6d6650', 11, 10, 22, 8);
  blob('#22241d', 9, 6, 15, 7);
  grain(x, S, 14);
  return finishTex(c, [1, 1]);
}

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

function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

const TEX_CAMO = makeCamoTex();
const CAMO_PER_M = 3.6;

/* Box UVs run 0..1 per face, so the shared map is scaled by face size. */
function EB(w: number, h: number, d: number) {
  const g = B(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const face = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const su = face[f][0] * CAMO_PER_M;
    const sv = face[f][1] * CAMO_PER_M;
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return g;
}

const E_MAT = {
  cloth: new THREE.MeshStandardMaterial({ map: TEX_CAMO, roughness: 0.94, metalness: 0.02 }),
  webb: new THREE.MeshStandardMaterial({ color: 0x565842, roughness: 0.94, metalness: 0.02 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x32342f, roughness: 0.8, metalness: 0.06 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xa87f5b, roughness: 0.86, metalness: 0.0 }),
  helm: new THREE.MeshStandardMaterial({ color: 0x4b4d40, roughness: 0.62, metalness: 0.08 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.94, metalness: 0.04 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x44484c, roughness: 0.48, metalness: 0.16 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.14, metalness: 0.24 }),
  accent: new THREE.MeshStandardMaterial({
    color: 0xff3b2a,
    emissive: 0xff2a18,
    emissiveIntensity: 1.6,
    roughness: 0.5,
  }),
};
const INVIS = new THREE.MeshBasicMaterial({ visible: false });

function capsuleGroup(
  parent: THREE.Object3D,
  r: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
) {
  part(parent, CYL(r, r, h, 12), mat, x, y, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y + h / 2, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y - h / 2, z);
}

/** Fold every rigid bone into one buffer per material, exactly like legacy. */
function collapseRig(root: THREE.Object3D) {
  const groups: THREE.Group[] = [];
  root.traverse((o) => {
    if ((o as THREE.Group).isGroup || o === root) groups.push(o as THREE.Group);
  });
  for (const g of groups) {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of g.children) {
      const m = c as THREE.Mesh;
      if (!(m as THREE.Mesh).isMesh || m.material === INVIS) continue;
      if (!byMat.has(m.material as THREE.Material)) byMat.set(m.material as THREE.Material, []);
      byMat.get(m.material as THREE.Material)?.push(m);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      for (const m of list) g.remove(m);
      const merged = new THREE.Mesh(mergeGeometries(geos) as THREE.BufferGeometry, mat);
      merged.castShadow = merged.receiveShadow = false;
      g.add(merged);
    }
  }
}

export interface EnemyTag {
  sprite: THREE.Sprite;
  draw(hp: number, alerted: boolean): void;
  tex: THREE.CanvasTexture;
  side: 'enemy' | 'ally';
  color: string;
}

export function makeEnemyTag(name: string, color = '#ff5145'): EnemyTag {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 76;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: t,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.75, 0.52, 1);
  spr.position.y = 2.22;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const draw = (hp: number, alerted: boolean) => {
    void alerted;
    ctx.clearRect(0, 0, 256, 76);
    ctx.fillStyle = 'rgba(4,8,12,.78)';
    ctx.fillRect(31, 2, 194, 38);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(31, 2, 194, 38);
    ctx.beginPath();
    ctx.moveTo(18, 21);
    ctx.lineTo(28, 11);
    ctx.lineTo(38, 21);
    ctx.lineTo(28, 31);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('敌军', 44, 13);
    ctx.font = 'bold 25px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(name, 136, 27);
    ctx.fillStyle = color;
    ctx.fillText(name, 136, 27);
    const bx = 40;
    const bw = 176;
    const by = 44;
    const bh = 13;
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(bx, by, bw, bh);
    const f = Math.max(0, Math.min(1, hp / 100));
    ctx.fillStyle = f > 0.6 ? '#5fd06a' : f > 0.28 ? '#ffb340' : '#ff3b30';
    ctx.fillRect(bx, by, bw * f, bh);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(bx, by, bw * f, 3);
    ctx.strokeStyle = 'rgba(255,255,255,.42)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(bx + (bw * i) / 4, by, 2, bh);
    }
    t.needsUpdate = true;
  };
  draw(100, false);
  return { sprite: spr, draw, tex: t, side: 'enemy', color };
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
  tag: EnemyTag;
}

export function buildSoldierModel(name = ENEMY_NAMES[0]): SoldierRig {
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
    part(hip, EB(0.185, 0.46, 0.2), E_MAT.cloth, 0, -0.23, 0);
    part(hip, B(0.155, 0.115, 0.055), E_MAT.vest, 0, -0.4, -0.106);
    const knee = new THREE.Group();
    knee.name = s < 0 ? 'kneeL' : 'kneeR';
    knee.position.set(0, -0.46, 0);
    hip.add(knee);
    part(knee, EB(0.165, 0.44, 0.185), E_MAT.cloth, 0, -0.22, 0);
    part(knee, B(0.172, 0.17, 0.195), E_MAT.boot, 0, -0.38, -0.004);
    part(knee, B(0.175, 0.1, 0.28), E_MAT.boot, 0, -0.42, -0.035);
    legs.push({ hip, knee });
  }

  capsuleGroup(body, 0.215, 0.44, E_MAT.cloth, 0, 1.2, 0);
  part(body, B(0.455, 0.5, 0.315), E_MAT.vest, 0, 1.25, -0.005);
  part(body, B(0.3, 0.2, 0.075), E_MAT.vest, 0, 1.3, -0.175);
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, 0.135, 1.13, -0.175);
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, 0, 1.13, -0.178);
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, -0.135, 1.13, -0.175);
  part(body, B(0.2, 0.075, 0.06), E_MAT.webb, 0, 1.44, -0.168);
  part(body, B(0.075, 0.02, 0.02), E_MAT.accent, 0, 1.4, -0.196);
  part(body, B(0.485, 0.115, 0.3), E_MAT.vest, 0, 1.48, -0.005);
  part(body, B(0.4, 0.1, 0.32), E_MAT.webb, 0, 1.06, -0.005);
  part(body, B(0.11, 0.15, 0.09), E_MAT.webb, 0.2, 1.02, -0.06);
  part(body, B(0.11, 0.15, 0.09), E_MAT.webb, -0.2, 1.02, -0.06);
  part(body, B(0.3, 0.3, 0.16), E_MAT.webb, 0, 1.34, 0.21);
  part(body, B(0.11, 0.24, 0.1), E_MAT.vest, 0.13, 1.36, 0.3);

  part(body, CYL(0.062, 0.062, 0.1, 8), E_MAT.skin, 0, 1.53, 0);
  const head = new THREE.Group();
  head.name = 'soldierHead';
  head.position.set(0, 1.655, 0);
  body.add(head);
  part(head, new THREE.SphereGeometry(0.135, 14, 12), E_MAT.skin, 0, 0, 0);
  part(
    head,
    new THREE.SphereGeometry(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.64),
    E_MAT.helm,
    0,
    0.012,
    0
  );
  part(head, B(0.3, 0.035, 0.3), E_MAT.helm, 0, -0.048, 0.004);
  part(head, B(0.055, 0.1, 0.05), E_MAT.vest, 0.145, -0.035, 0.01);
  part(head, B(0.055, 0.1, 0.05), E_MAT.vest, -0.145, -0.035, 0.01);
  part(head, B(0.2, 0.055, 0.06), E_MAT.glass, 0, 0.01, -0.115);
  part(head, B(0.21, 0.022, 0.05), E_MAT.vest, 0, 0.048, -0.108);
  part(head, B(0.13, 0.075, 0.06), E_MAT.vest, 0, -0.062, -0.105);
  part(head, B(0.026, 0.026, 0.1), E_MAT.helm, 0.1, 0.055, -0.02);
  part(head, B(0.055, 0.045, 0.045), E_MAT.helm, 0, 0.075, -0.1);

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
    part(sh, B(0.15, 0.135, 0.165), E_MAT.vest, 0, -0.035, 0);
    part(sh, B(0.155, 0.07, 0.176), E_MAT.accent, 0, -0.07, 0);
    part(sh, EB(0.135, 0.34, 0.145), E_MAT.cloth, 0, -0.17, 0);
    part(sh, B(0.14, 0.075, 0.15), E_MAT.vest, 0, -0.3, 0);
    const el = new THREE.Group();
    el.name = s < 0 ? 'elbowL' : 'elbowR';
    el.position.set(0, -0.34, 0);
    sh.add(el);
    part(el, EB(0.115, 0.3, 0.125), E_MAT.cloth, 0, -0.15, 0);
    part(el, B(0.1, 0.1, 0.13), E_MAT.boot, 0, -0.3, 0.01);
    arms.push({ sh, el });
  }

  const gun = new THREE.Group();
  gun.name = 'soldierGun';
  rig.add(gun);
  part(gun, B(0.065, 0.085, 0.34), E_MAT.gun, 0, 0, -0.1);
  part(gun, CYLZ(0.016, 0.016, 0.32, 8), E_MAT.gun, 0, 0.006, -0.4);
  part(gun, B(0.045, 0.14, 0.07), E_MAT.gun, 0, -0.1, -0.05);
  part(gun, B(0.05, 0.1, 0.06), E_MAT.gun, 0, -0.075, 0.05);
  part(gun, B(0.055, 0.075, 0.16), E_MAT.gun, 0, -0.005, 0.16);
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

  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material !== INVIS) {
      (o as THREE.Mesh).castShadow = true;
      (o as THREE.Mesh).receiveShadow = true;
    }
  });
  collapseRig(model);
  hbHead.userData.part = 'head';
  hbBody.userData.part = 'body';
  hbLegs.userData.part = 'legs';
  const tag = makeEnemyTag(name);
  return { model, body, legs, arms, rig, gun, gunMuzzle, head, hbHead, hbBody, hbLegs, tag };
}

export function cloneSoldierRig(template: SoldierRig, name = ENEMY_NAMES[0]): SoldierRig {
  const model = template.model.clone(true);
  const body = model.getObjectByName('soldierBody') as THREE.Group;
  const head = model.getObjectByName('soldierHead') as THREE.Group;
  const rig = model.getObjectByName('soldierRig') as THREE.Group;
  const gun = model.getObjectByName('soldierGun') as THREE.Group;
  const gunMuzzle = model.getObjectByName('soldierGunMuzzle') as THREE.Object3D;
  const hbHead = model.getObjectByName('hbHead') as THREE.Mesh;
  const hbBody = model.getObjectByName('hbBody') as THREE.Mesh;
  const hbLegs = model.getObjectByName('hbLegs') as THREE.Mesh;
  hbHead.userData.part = 'head';
  hbBody.userData.part = 'body';
  hbLegs.userData.part = 'legs';
  const legs = ['hipL', 'hipR'].map((n, li) => ({
    hip: model.getObjectByName(n) as THREE.Group,
    knee: model.getObjectByName(li === 0 ? 'kneeL' : 'kneeR') as THREE.Group,
  }));
  const arms = ['shoulderL', 'shoulderR'].map((n, li) => ({
    sh: model.getObjectByName(n) as THREE.Group,
    el: model.getObjectByName(li === 0 ? 'elbowL' : 'elbowR') as THREE.Group,
  }));
  return {
    model,
    body,
    legs,
    arms,
    rig,
    gun,
    gunMuzzle,
    head,
    hbHead,
    hbBody,
    hbLegs,
    tag: makeEnemyTag(name),
  };
}
