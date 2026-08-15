import * as THREE from 'three';
import audioData from '../../shared/audio-params.json';

export function hash2(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function noise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function terrainHeight(x: number, z: number): number {
  /* Wide, gently rising forest floor. Near the playable corridor the ground
     stays almost flat; beyond it the valley climbs smoothly into mountains.
     Once |z| leaves the mission area, large rolling hills begin so the far
     ground is never a flat sheet with an obvious edge. */
  const side = Math.max(0, Math.abs(x) - 8) / 42;
  const rise = side ** 2.1 * 22;
  const wave = Math.sin(z * 0.08) * 0.35 + Math.cos(x * 0.22 + z * 0.05) * 0.28;
  const fine = noise2(x * 0.13, z * 0.17) * 0.75 - 0.25;
  const far = Math.min(1, Math.max(0, Math.abs(z) - 100) / 240);
  const rolling =
    (Math.sin(z * 0.019) * 5.2 +
      Math.sin(z * 0.047 + 1.7) * 2.8 +
      (noise2(x * 0.006, z * 0.007) - 0.5) * 7.5) *
    far;
  return rise + wave + fine + rolling;
}

/* ---------------------------------------------------------------------------
   Ground snapping: place an object by sampling terrain under its footprint
   and using the LOWEST sampled ground height as support. That makes uneven
   ground sink the object slightly instead of leaving it floating. This is the
   foundation of the one-key "snap to ground" map-authoring tool.
   ------------------------------------------------------------------------- */
export interface SnapOptions {
  points?: Array<[number, number]>;
  sink?: number;
  groundAt?: (x: number, z: number) => number;
  mode?: 'min' | 'center' | 'median' | 'max';
}

export function snapObjectToTerrain(
  object: THREE.Object3D,
  x: number,
  z: number,
  options: SnapOptions = {}
) {
  object.position.set(x, 0, z);
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const localBottom = box.min.y;
  const groundAt = options.groundAt || terrainHeight;
  const mode = options.mode || 'min';
  let support: number;
  if (mode === 'center') {
    support = groundAt(x, z);
  } else {
    const points = options.points?.length ? options.points : [[x, z]];
    const heights = points.map(([px, pz]) => groundAt(px, pz));
    if (mode === 'max') {
      support = Math.max(...heights);
    } else if (mode === 'median') {
      const sorted = [...heights].sort((a, b) => a - b);
      support = sorted[Math.floor(sorted.length / 2)];
    } else {
      support = Math.min(...heights);
    }
  }
  object.position.y = support - localBottom - (options.sink ?? 0.04);
}

/** Lowest terrain sample under a small circular footprint. */
export function supportHeightAt(x: number, z: number, radius = 0.4): number {
  let support = terrainHeight(x, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    support = Math.min(support, terrainHeight(x + Math.cos(a) * radius, z + Math.sin(a) * radius));
  }
  return support;
}

/** Shared wind model: visible rain tilt, screen droplets and audio all use it. */
export function windAt(time: number): number {
  const w = audioData.environment.wind;
  return (
    Math.sin(time * 0.53) * w.baseAmp +
    Math.sin(time * 0.19 + 1.4) * w.secondaryAmp +
    Math.sin(time * 1.31) * w.gustAmp
  );
}

export function makeTerrainMaterial(
  colorA: THREE.ColorRepresentation,
  colorB: THREE.ColorRepresentation
) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
}

export function paintGround(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(0x30352f);
  const cB = new THREE.Color(0x4a493c);
  const cMud = new THREE.Color(0x514536);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = noise2(x * 0.09, z * 0.11);
    const c = cA.clone().lerp(cB, THREE.MathUtils.clamp(n, 0, 1));
    if (Math.abs(x) < 4) c.lerp(cMud, 0.55);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
