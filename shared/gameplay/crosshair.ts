import { clamp, damp } from './math';

export const CROSSHAIR = {
  inGap: 1,
  inLen: 4,
  inThick: 2,
  outGap: 2,
  outLen: 3,
  outThick: 2,
  outline: 1,
  maxSpread: 12,
  baseScale: 105,
  reloadErr: 2.0,
  fireScale: 240,
  fireHold: 0.11,
  fallRate: 20,
};

export function crosshairCanvasSize() {
  return (
    2 * Math.ceil(CROSSHAIR.inGap + CROSSHAIR.maxSpread + CROSSHAIR.inLen + CROSSHAIR.outline) + 8
  );
}

export function crosshairTarget(state: {
  baseSpread: number;
  moveSpread: number;
  speed: number;
  airSpread: number;
  stanceSpread: number;
  adsEase: number;
  reloading: boolean;
  firing: boolean;
  spread: number;
}) {
  let target =
    (state.baseSpread + (state.speed / 7) * state.moveSpread + state.airSpread) *
    CROSSHAIR.baseScale *
    state.stanceSpread;
  if (state.reloading) target += CROSSHAIR.reloadErr;
  if (state.firing)
    target += (state.spread - state.baseSpread) * CROSSHAIR.fireScale * state.stanceSpread;
  target *= 1 - 0.45 * state.adsEase;
  return clamp(target, 0, CROSSHAIR.maxSpread);
}

export function stepCrosshairSpread(current: number, target: number, dt: number) {
  return target > current ? target : damp(current, target, CROSSHAIR.fallRate, dt);
}

export function adsHidesCrosshair(adsEase: number, bracedAim: boolean) {
  return adsEase > 0.12 && !bracedAim;
}

export function scopeBlend(adsEase: number, hasScope: boolean) {
  return hasScope ? clamp((adsEase - 0.45) / 0.4, 0, 1) : 0;
}

export function showBreathHint(
  scopeK: number,
  breathLock: boolean,
  breath: number,
  breathHeld: boolean
) {
  return scopeK > 0.5 && !breathLock && breath <= 0 && !breathHeld;
}

export function drawCrosshair(
  ctx: {
    clearRect: (x: number, y: number, w: number, h: number) => void;
    fillRect: (x: number, y: number, w: number, h: number) => void;
    fillStyle: unknown;
  },
  layout: { dpr: number; cx: number; cy: number; width: number; height: number },
  iA: number
) {
  ctx.clearRect(0, 0, layout.width, layout.height);
  const d = layout.dpr;
  const u = (v: number) => Math.max(1, Math.round(v * d));
  const o = Math.max(1, Math.round(CROSSHAIR.outline * d));
  const oA = Math.round((CROSSHAIR.inGap + CROSSHAIR.inLen + CROSSHAIR.outGap) * d);
  const arms = [
    [iA, u(CROSSHAIR.inLen), u(CROSSHAIR.inThick), 0],
    [oA, u(CROSSHAIR.outLen), u(CROSSHAIR.outThick), 1],
  ];
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? 'rgba(255,255,255,.97)' : 'rgba(0,0,0,.88)';
    const kf = pass ? 0 : o;
    for (const [a, len, t, near] of arms) {
      const kn = pass ? 0 : o * near;
      const thin = t + (pass ? 0 : 2 * o);
      const long = len + kf + kn;
      const off = (t >> 1) + (pass ? 0 : o);
      ctx.fillRect(layout.cx - off, layout.cy - a - len - kf, thin, long);
      ctx.fillRect(layout.cx - off, layout.cy + a - kn, thin, long);
      ctx.fillRect(layout.cx - a - len - kf, layout.cy - off, long, thin);
      ctx.fillRect(layout.cx + a - kn, layout.cy - off, long, thin);
    }
  }
}
