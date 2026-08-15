/* Lens-water overlay. Most droplets cling to the camera lens: they hold
   position, tremble with wind, and only occasionally slide. A few soft mist
   streaks communicate horizontal air movement. */

interface LensDrop {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  speed: number;
  drift: number;
  alpha: number;
  phase: number;
  wobble: number;
  slide: boolean;
  sprite: HTMLCanvasElement;
}

interface Mist {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  thickness: number;
}

function makeLensDropSprite(base: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, 96, 96);
  const cx = 48;
  const cy = 46;
  const rx = base * 2.7;
  const ry = base * 2.2;

  /* soft shadow / dark rim that makes the drop read as sitting on glass */
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = base * 2.2;
  g.shadowOffsetY = base * 0.7;
  g.fillStyle = 'rgba(12,22,32,0.85)';
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, -0.12, 0, Math.PI * 2);
  g.fill();
  g.restore();

  /* refractive body: brighter toward the light, nearly transparent edges */
  const body = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, rx * 0.1, cx, cy, Math.max(rx, ry) * 1.15);
  body.addColorStop(0, 'rgba(215,235,248,0.55)');
  body.addColorStop(0.35, 'rgba(175,210,232,0.34)');
  body.addColorStop(0.7, 'rgba(150,195,224,0.16)');
  body.addColorStop(1, 'rgba(140,188,218,0.04)');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.92, ry * 0.92, -0.12, 0, Math.PI * 2);
  g.fill();

  /* inner lens highlight */
  const hi = g.createRadialGradient(cx - rx * 0.45, cy - ry * 0.45, 0, cx - rx * 0.45, cy - ry * 0.45, rx * 0.55);
  hi.addColorStop(0, 'rgba(255,255,255,0.85)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.beginPath();
  g.ellipse(cx - rx * 0.42, cy - ry * 0.42, rx * 0.5, ry * 0.42, -0.55, 0, Math.PI * 2);
  g.fill();

  /* lower rim reflection */
  g.strokeStyle = 'rgba(215,235,248,0.35)';
  g.lineWidth = Math.max(0.7, base * 0.3);
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.8, ry * 0.8, -0.12, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  return c;
}

export class ScreenRain {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drops: LensDrop[] = [];
  private mists: Mist[] = [];
  private sprites: HTMLCanvasElement[] = [];
  private spawnTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.sprites = [3.4, 4.8, 6.4].map(makeLensDropSprite);
    this.resize();
    for (let i = 0; i < 120; i++) this.drops.push(this.makeDrop(true));
    for (let i = 0; i < 8; i++) this.mists.push(this.makeMist(true));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(2, Math.floor(innerWidth * dpr));
    this.canvas.height = Math.max(2, Math.floor(innerHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(dt: number, wind: number) {
    for (const d of this.drops) {
      d.phase += dt * (0.4 + d.wobble);
      const windPush = wind * (1.2 + d.size * 0.4);
      if (d.slide) {
        d.y += d.speed * dt;
        d.x += (d.drift + windPush) * dt;
        if (d.y - d.size * 3 > innerHeight) {
          Object.assign(d, this.makeDrop(false));
          d.y = -d.size * 3;
          d.baseY = d.y;
        }
      } else {
        d.x = d.baseX + Math.sin(d.phase) * d.wobble + windPush * 0.5;
        d.y = d.baseY + Math.cos(d.phase * 0.8) * d.wobble * 0.35;
        if (d.x < -d.size * 2) d.x = innerWidth + d.size;
        if (d.x > innerWidth + d.size * 2) d.x = -d.size;
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.5 + Math.random() * 1.2;
      const idle = this.drops.find((d) => !d.slide);
      if (idle) Object.assign(idle, this.makeDrop(false));
    }
    for (const m of this.mists) {
      m.x += (m.speed + wind * 85) * dt;
      m.y += wind * 12 * dt;
      if (m.x - m.len > innerWidth + 80) Object.assign(m, this.makeMist(false));
    }
  }

  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.lineCap = 'round';

    for (const m of this.mists) {
      const grad = c.createLinearGradient(m.x, m.y, m.x - m.len, m.y - m.len * 0.08);
      grad.addColorStop(0, `rgba(205,225,238,${m.alpha})`);
      grad.addColorStop(1, 'rgba(205,225,238,0)');
      c.strokeStyle = grad;
      c.lineWidth = m.thickness;
      c.beginPath();
      c.moveTo(m.x, m.y);
      c.quadraticCurveTo(m.x - m.len * 0.5, m.y - m.len * 0.035, m.x - m.len, m.y - m.len * 0.08);
      c.stroke();
    }

    for (const d of this.drops) {
      const s = d.size * 9;
      c.globalAlpha = d.alpha;
      c.drawImage(d.sprite, d.x - s / 2, d.y - s / 2, s, s);
    }
    c.globalAlpha = 1;
  }

  private makeDrop(anywhere: boolean): LensDrop {
    const size = 3.0 + Math.random() * 3.6;
    const slide = Math.random() < 0.2;
    const y = anywhere
      ? Math.random() * innerHeight * 0.86
      : slide
        ? -size * 3
        : Math.random() * innerHeight * 0.7;
    const x = Math.random() * (innerWidth + 40) - 20;
    return {
      x,
      y,
      baseX: x,
      baseY: y,
      size,
      speed: 8 + Math.random() * 18,
      drift: (Math.random() * 2 - 1) * 9,
      alpha: 0.12 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      wobble: 0.4 + Math.random() * 1.4,
      slide,
      sprite: this.sprites[Math.floor(Math.random() * this.sprites.length)],
    };
  }

  private makeMist(anywhere: boolean): Mist {
    return {
      x: anywhere ? Math.random() * innerWidth : innerWidth + 80,
      y: Math.random() * innerHeight * 0.5,
      len: 90 + Math.random() * 260,
      speed: 190 + Math.random() * 320,
      alpha: 0.02 + Math.random() * 0.04,
      thickness: 0.6 + Math.random() * 1.2,
    };
  }
}
