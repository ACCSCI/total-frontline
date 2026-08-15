'use strict';
/* =========================================================================
   TOTAL FRONTLINE — single-file FPS
   three.js r128 (no addons available: composer / capsule / merge utils
   are all implemented by hand below)
   ========================================================================= */

/* ------------------------------ error trap ------------------------------ */
(() => {
  const box = document.getElementById('err');
  function show(msg) {
    box.style.display = 'block';
    box.textContent += msg + '\n';
  }
  window.addEventListener('error', (e) => show('⛔ ' + e.message + '  @' + (e.lineno || '?')));
  window.addEventListener('unhandledrejection', (e) => show('⛔ ' + e.reason));
})();

if (typeof THREE === 'undefined') {
  document.getElementById('boot').textContent = 'FAILED TO LOAD THREE.JS — CHECK CONNECTION';
  throw new Error('three.js missing');
}

/* ------------------------------- helpers -------------------------------- */
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const PI = Math.PI;
let perfNow = performance.now();
const rand = (a, b) => a + Math.random() * (b - a);
const randI = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[(Math.random() * a.length) | 0];
/** framerate independent exponential smoothing */
const damp = (cur, tgt, lambda, dt) => lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** hex literals here are authored in sRGB; the renderer treats material.color
 *  as linear, so convert or everything reads neon-bright */
const sRGB = (hex) => new THREE.Color(hex).convertSRGBToLinear();
function linearizeMats(dict) {
  for (const k in dict) {
    const m = dict[k];
    if (m) {
      m.userData ||= {};
      m.userData.surfaceKey ||= k;
    }
    if (m && m.color) m.color.convertSRGBToLinear();
    if (m && m.emissive) m.emissive.convertSRGBToLinear();
  }
  return dict;
}

/* merge an array of BufferGeometries sharing one material (no addons in r128) */
function mergeGeoms(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    uv = new Float32Array(n * 2);
  let po = 0,
    uo = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, po);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, po);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, uo);
    po += g.attributes.position.count * 3;
    uo += g.attributes.position.count * 2;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
