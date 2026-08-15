/* Direct port of the main game's canvas crosshair from src/19-player-hud.ts.
   Same geometry constants, same two-pass keyline/white drawing, same snapping
   to whole device pixels. */

const XH = {
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
  dpr: 1,
  cx: 0,
  cy: 0,
  size: 0,
  _last: -1,
};
XH.size = 2 * Math.ceil(XH.inGap + XH.maxSpread + XH.inLen + XH.outline) + 8;

let crossSpread = 0;
let fireT = 0;

export class Crosshair {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  hidden = false;

  constructor(canvas: HTMLCanvasElement) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.layout();
  }

  layout() {
    const d = Math.max(1, devicePixelRatio || 1);
    this.cv.width = this.cv.height = Math.round(XH.size * d);
    this.cv.style.width = this.cv.style.height = `${XH.size}px`;
    XH.dpr = d;
    XH.cx = Math.round(this.cv.width / 2);
    XH.cy = Math.round(this.cv.height / 2);
    XH._last = -1;
  }

  setHidden(v: boolean) {
    this.hidden = v;
    this.cv.classList.toggle('hidden', v);
  }

  onFire() {
    fireT = XH.fireHold;
  }

  update(dt: number, speed: number, baseSpread: number, firing: boolean) {
    if (this.hidden) return;
    let target = baseSpread + (speed / 7) * 0.0022 + 0.0018;
    target *= XH.baseScale;
    fireT = Math.max(0, fireT - dt);
    if (firing) fireT = XH.fireHold;
    if (fireT > 0) target += 0.003 * XH.fireScale;
    target = Math.min(XH.maxSpread, Math.max(0, target));
    crossSpread = target > crossSpread ? target : damp(crossSpread, target, XH.fallRate, dt);
    const iA = Math.round((XH.inGap + crossSpread) * XH.dpr);
    if (iA !== XH._last) {
      XH._last = iA;
      this.draw(iA);
    }
  }

  private draw(iA: number) {
    const ctx = this.ctx;
    const d = XH.dpr;
    const cx = XH.cx;
    const cy = XH.cy;
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    const u = (v: number) => Math.max(1, Math.round(v * d));
    const o = Math.max(1, Math.round(XH.outline * d));
    const oA = Math.round((XH.inGap + XH.inLen + XH.outGap) * d);
    const arms = [
      [iA, u(XH.inLen), u(XH.inThick), 0],
      [oA, u(XH.outLen), u(XH.outThick), 1],
    ] as const;

    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? 'rgba(255,255,255,.97)' : 'rgba(0,0,0,.88)';
      const kf = pass ? 0 : o;
      for (const [a, len, t, near] of arms) {
        const kn = pass ? 0 : o * near;
        const thin = t + (pass ? 0 : 2 * o);
        const long = len + kf + kn;
        const off = (t >> 1) + (pass ? 0 : o);
        ctx.fillRect(cx - off, cy - a - len - kf, thin, long);
        ctx.fillRect(cx - off, cy + a - kn, thin, long);
        ctx.fillRect(cx - a - len - kf, cy - off, long, thin);
        ctx.fillRect(cx + a - kn, cy - off, long, thin);
      }
    }
  }
}

function damp(a: number, b: number, rate: number, dt: number) {
  return b + (a - b) * Math.exp(-rate * dt);
}
