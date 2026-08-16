import {
  damageBearing,
  damageFlashAmount,
  damageShakeAmount,
  lowHealthPulse,
} from '../../shared/gameplay';

const ARC_COUNT = 5;
const ARC_LIFE = 1.35;

export class DamageHud {
  private damageEl = document.getElementById('p0Damage') as HTMLDivElement | null;
  private lowEl = document.getElementById('p0LowHp') as HTMLDivElement | null;
  private dirs = document.getElementById('p0DmgDirs') as HTMLDivElement | null;
  private arcs: Array<{ el: HTMLDivElement; t: number }> = [];
  private head = 0;
  private flash = 0;

  constructor() {
    if (!this.dirs) return;
    for (let i = 0; i < ARC_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'dmgArc';
      this.dirs.appendChild(el);
      this.arcs.push({ el, t: 0 });
    }
  }

  show(fromX: number, fromZ: number, camX: number, camZ: number, yaw: number, amount: number) {
    this.flash = Math.min(0.85, this.flash + damageFlashAmount(amount));
    if (this.damageEl) this.damageEl.style.opacity = String(this.flash);
    const a = this.arcs[this.head];
    this.head = (this.head + 1) % this.arcs.length;
    if (!a) return;
    const rel = damageBearing(fromX, fromZ, camX, camZ, yaw);
    a.el.style.transform = `rotate(${-rel}rad)`;
    a.t = ARC_LIFE;
  }

  shakeFor(amount: number) {
    return damageShakeAmount(amount);
  }

  update(dt: number, hp: number, nowMs: number) {
    this.flash = Math.max(0, this.flash - dt * 2.4);
    if (this.damageEl) this.damageEl.style.opacity = String(this.flash);
    for (const a of this.arcs) {
      if (a.t <= 0) {
        a.el.style.opacity = '0';
        continue;
      }
      a.t -= dt;
      a.el.style.opacity = String(Math.max(0, Math.min(1, a.t / ARC_LIFE)) * 0.95);
    }
    const low = hp < 20 && hp > 0 ? 1 : 0;
    if (this.lowEl) this.lowEl.style.opacity = String(lowHealthPulse(hp, nowMs, low) * 0.8);
  }
}
