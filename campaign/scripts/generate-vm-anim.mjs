import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = ['src/23a-vm-rifle-physics.ts', 'src/23b-vm-magazines.ts', 'src/24-vm-anim.ts'];

const prefix = `// @ts-nocheck
/* GENERATED from single-player viewmodel animation. Do not edit. */
import * as THREE from 'three';

export function createViewmodelAnimator() {
  const PI = Math.PI;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (cur, tgt, lambda, dt) => lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  let player;
  let WEAPONS;
  let camera;
  let vmCamera;
  let vmSway;
  let vmRecoil;
  const vmRec = { pz: 0, py: 0, rx: 0, ry: 0, rz: 0, vz: 0, vy: 0, vrx: 0, vry: 0, vrz: 0 };
  let flashT = 0;
  const flashDur = 0.055;
  let flashPower = 1;
  const muzzleSprite = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    material: { opacity: 0, rotation: 0 },
  };
  const muzzleGlow = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    material: { opacity: 0 },
  };
  const vmMuzzleLight = { position: new THREE.Vector3(), intensity: 0 };
  const muzzleLight = { position: new THREE.Vector3(), intensity: 0 };
  const G = { running: true };
  const _tmpV = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const VM_FOV = 41.9;
  const VM_ADS_DOLLY = 0.58;
  const VM_LIGHT_BASE = { amb: 0.4, key: 1.52, fill: 0.38, rim: 0.42 };
  const vmAmb = { intensity: 0.4 };
  const vmKey = { intensity: 1.52 };
  const vmFill = { intensity: 0.38 };
  const vmRim = { intensity: 0.42 };

`;

let body = '';
for (const file of sources) {
  let text = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  text = text.replace(/'use strict';\s*/g, '');
  body += `\n/* ==== ${file} ==== */\n${text}\n`;
}

const suffix = `
  return {
    step(dt, mdx, mdy, env) {
      player = env.player;
      WEAPONS = env.weapons;
      camera = env.camera;
      vmCamera = env.vmCamera;
      vmSway = env.vmSway;
      vmRecoil = env.vmRecoil;
      G.running = env.running !== false;
      updateViewmodel(dt, mdx, mdy);
      updateDetachedMagazinePhysics(dt);
    },
    kick(w, scale = 1) {
      vmRec.vz += w.recoilKick * 46 * scale;
      vmRec.vy += w.recoilKick * 13 * scale;
      vmRec.vrx += w.recoilRot * 46 * scale;
      vmRec.vry += (Math.random() - 0.5) * w.recoilRot * 24 * scale;
      vmRec.vrz += (Math.random() - 0.5) * w.recoilRot * 30 * scale;
    },
    flash(power = 1) {
      flashT = flashDur;
      flashPower = power;
    },
    reset() {
      vmRec.pz = vmRec.py = vmRec.rx = vmRec.ry = vmRec.rz = 0;
      vmRec.vz = vmRec.vy = vmRec.vrx = vmRec.vry = vmRec.vrz = 0;
      flashT = 0;
    },
  };
}
`;

await writeFile(new URL('../src/generated-vm-anim.ts', import.meta.url), prefix + body + suffix);
console.log(`wrote ${root}src/generated-vm-anim.ts`);
