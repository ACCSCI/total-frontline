import {
  adsHidesCrosshair,
  CROSSHAIR,
  crosshairCanvasSize,
  crosshairTarget,
  drawCrosshair,
  stepCrosshairSpread,
} from '../../shared/gameplay';

export class Crosshair {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  hidden = false;
  private spread = 0;
  private fireT = 0;
  private dpr = 1;
  private cx = 0;
  private cy = 0;
  private last = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.layout();
  }

  layout() {
    const d = Math.max(1, devicePixelRatio || 1);
    const size = crosshairCanvasSize();
    this.cv.width = this.cv.height = Math.round(size * d);
    this.cv.style.width = this.cv.style.height = `${size}px`;
    this.dpr = d;
    this.cx = Math.round(this.cv.width / 2);
    this.cy = Math.round(this.cv.height / 2);
    this.last = -1;
  }

  setHidden(v: boolean) {
    this.hidden = v;
    this.cv.classList.toggle('hidden', v);
  }

  onFire() {
    this.fireT = CROSSHAIR.fireHold;
  }

  hidesForAds(adsEase: number, bracedAim: boolean) {
    return adsHidesCrosshair(adsEase, bracedAim);
  }

  update(
    dt: number,
    state: {
      baseSpread: number;
      moveSpread: number;
      speed: number;
      airSpread: number;
      stanceSpread: number;
      adsEase: number;
      reloading: boolean;
      spread: number;
    }
  ) {
    if (this.hidden) return;
    this.fireT = Math.max(0, this.fireT - dt);
    const target = crosshairTarget({ ...state, firing: this.fireT > 0 });
    this.spread = stepCrosshairSpread(this.spread, target, dt);
    const iA = Math.round((CROSSHAIR.inGap + this.spread) * this.dpr);
    if (iA === this.last) return;
    this.last = iA;
    drawCrosshair(
      this.ctx,
      { dpr: this.dpr, cx: this.cx, cy: this.cy, width: this.cv.width, height: this.cv.height },
      iA
    );
  }
}
