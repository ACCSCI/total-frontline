export const PI = Math.PI;

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function damp(cur: number, tgt: number, lambda: number, dt: number) {
  return lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function randI(a: number, b: number) {
  return Math.floor(rand(a, b + 1));
}
