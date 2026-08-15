import * as THREE from 'three';

const clamp01 = (t: number) => THREE.MathUtils.clamp(t, 0, 1);

export function easeOutCubic(t: number) {
  const k = clamp01(t);
  return 1 - (1 - k) ** 3;
}

export function easeInOutCubic(t: number) {
  const k = clamp01(t);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}
