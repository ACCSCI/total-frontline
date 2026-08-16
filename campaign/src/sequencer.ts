import * as THREE from 'three';
import { EXIT_Z, SPAWN_Z } from '../../shared/gameplay';

export interface CutsceneEvent {
  at: number;
  text?: string;
  clearText?: boolean;
  callback?: () => void;
}

interface NumberKeyframe {
  at: number;
  value: number;
}

export interface CutsceneDefinition {
  duration: number;
  cameraPositions: THREE.Vector3[];
  lookTargets: THREE.Vector3[];
  events: CutsceneEvent[];
  /** Local camera roll around the view axis, sampled by arc-length u. */
  rolls?: NumberKeyframe[];
  /** Perspective FOV keyframes, also sampled by arc-length u. */
  fovs?: NumberKeyframe[];
  /** Positional turbulence envelope, e.g. the last seconds before impact. */
  shake?: { from: number; to: number; amount: number };
  /** Smoothstep time remap for a gentle landing into gameplay. */
  ease?: 'smooth';
}

function sampleKeys(keys: NumberKeyframe[] | undefined, u: number): number | null {
  if (!keys || keys.length === 0) return null;
  if (keys.length === 1) return keys[0].value;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (u <= first.at) return first.value;
  if (u >= last.at) return last.value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (u < b.at) {
      const span = b.at - a.at;
      const t = span <= 0 ? 0 : (u - a.at) / span;
      return THREE.MathUtils.lerp(a.value, b.value, t);
    }
  }
  return last.value;
}

export class Sequencer {
  private def: CutsceneDefinition;
  private time = 0;
  private path: THREE.CatmullRomCurve3;
  private look: THREE.CatmullRomCurve3;
  private fired: Set<CutsceneEvent>;
  private done: boolean;
  onFinished: (() => void) | null = null;
  onUpdate: ((time: number, dt: number, u: number) => void) | null = null;

  constructor(def: CutsceneDefinition) {
    this.def = def;
    this.path = new THREE.CatmullRomCurve3(def.cameraPositions);
    this.look = new THREE.CatmullRomCurve3(def.lookTargets);
    this.fired = new Set();
    this.done = false;
  }

  get finished() {
    return this.done;
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    if (this.done) return;
    this.time += dt;
    const raw = THREE.MathUtils.clamp(this.time / this.def.duration, 0, 1);
    const u = this.def.ease === 'smooth' ? raw * raw * (3 - 2 * raw) : raw;

    camera.position.copy(this.path.getPointAt(u));
    camera.up.set(0, 1, 0);
    camera.lookAt(this.look.getPointAt(u));
    const roll = sampleKeys(this.def.rolls, u);
    if (roll !== null) camera.rotateZ(roll);

    if (this.def.shake) {
      const { from, to, amount } = this.def.shake;
      if (u >= from && u <= to) {
        const k = to > from ? (u - from) / (to - from) : 1;
        const env = Math.sin(k * Math.PI);
        const amp = amount * env;
        const t = this.time;
        camera.position.x += (Math.sin(t * 43.7) + Math.sin(t * 29.3) * 0.6) * amp;
        camera.position.y += (Math.sin(t * 37.1 + 1.7) + Math.sin(t * 51.3) * 0.4) * amp * 0.5;
        camera.position.z += (Math.sin(t * 31.7 + 0.5) + Math.sin(t * 47.9) * 0.5) * amp * 0.4;
      }
    }

    const fov = sampleKeys(this.def.fovs, u);
    if (fov !== null && Math.abs(camera.fov - fov) > 0.01) camera.fov = fov;
    camera.updateProjectionMatrix();

    for (const event of this.def.events) {
      if (u >= event.at && !this.fired.has(event)) {
        this.fired.add(event);
        if (event.text !== undefined) this.setText(event.text);
        if (event.clearText) this.setText('');
        event.callback?.();
      }
    }
    this.onUpdate?.(this.time, dt, raw);
    if (u >= 1) {
      this.done = true;
      this.onFinished?.();
    }
  }

  skip() {
    this.time = this.def.duration + 1;
    if (this.done) return;
    this.done = true;
    this.onFinished?.();
  }

  private setText(text: string) {
    const el = document.getElementById('cutsceneText');
    if (el) el.textContent = text;
  }
}

/* 16-second crash-to-ground move instead of a 72-second aerial tour:
   establish the valley from high on the right, bank hard, dive over the
   forest, shake through the last canopy pass, and land exactly at the
   player's spawn eye so control hand-off has no cut. */
export function makeIntroCutscene(): CutsceneDefinition {
  return {
    duration: 9.5,
    ease: 'smooth',
    cameraPositions: [
      new THREE.Vector3(5, 6.5, SPAWN_Z + 190),
      new THREE.Vector3(2, 7, SPAWN_Z + 160),
      new THREE.Vector3(-1, 5.5, SPAWN_Z + 100),
      new THREE.Vector3(2, 3.8, SPAWN_Z + 60),
      new THREE.Vector3(0.8, 2.3, SPAWN_Z + 20),
      new THREE.Vector3(0, 1.58, SPAWN_Z),
    ],
    lookTargets: [
      new THREE.Vector3(4, -0.5, SPAWN_Z + 135),
      new THREE.Vector3(0, 1, SPAWN_Z + 80),
      new THREE.Vector3(0, 1.2, SPAWN_Z + 40),
      new THREE.Vector3(0, 1.3, SPAWN_Z + 10),
      new THREE.Vector3(0, 1.2, SPAWN_Z - 10),
      new THREE.Vector3(0, 1.1, SPAWN_Z - 28),
    ],
    rolls: [
      { at: 0.0, value: 0.08 },
      { at: 0.12, value: 0.2 },
      { at: 0.34, value: -0.14 },
      { at: 0.55, value: 0.06 },
      { at: 0.78, value: -0.06 },
      { at: 0.9, value: 0.02 },
      { at: 1.0, value: 0 },
    ],
    fovs: [
      { at: 0.0, value: 68 },
      { at: 0.28, value: 78 },
      { at: 0.62, value: 68 },
      { at: 0.85, value: 75 },
      { at: 1.0, value: 75 },
    ],
    shake: { from: 0.52, to: 0.84, amount: 0.12 },
    events: [
      { at: 0.04, text: 'HAMMER：鱼鹰编队低空穿过雷暴，保持队形。' },
      { at: 0.15, text: 'WEBER：地面导弹告警！红外源锁定机腹。' },
      { at: 0.28, text: 'HAMMER：干扰弹，立刻！第一枚脱靶。' },
      { at: 0.42, text: 'WEBER：第二枚命中引擎——机身解体！' },
      { at: 0.62, text: '舱门被撕开。森林扑面而来。' },
      { at: 0.86, text: '黑屏。隼，醒醒。' },
      { at: 0.97, clearText: true },
    ],
  };
}

export function makeOutroCutscene(): CutsceneDefinition {
  return {
    duration: 18,
    ease: 'smooth',
    cameraPositions: [
      new THREE.Vector3(0, 2.4, EXIT_Z + 25),
      new THREE.Vector3(3, 4.6, EXIT_Z - 20),
      new THREE.Vector3(-3, 10, EXIT_Z - 70),
      new THREE.Vector3(0, 24, EXIT_Z - 130),
      new THREE.Vector3(0, 42, EXIT_Z - 180),
    ],
    lookTargets: [
      new THREE.Vector3(0, 1.5, EXIT_Z - 25),
      new THREE.Vector3(0, 1.7, EXIT_Z - 70),
      new THREE.Vector3(0, 4, EXIT_Z - 120),
      new THREE.Vector3(0, 12, EXIT_Z - 160),
      new THREE.Vector3(0, 22, EXIT_Z - 190),
    ],
    rolls: [
      { at: 0.0, value: 0.04 },
      { at: 0.2, value: -0.09 },
      { at: 0.5, value: 0.1 },
      { at: 0.8, value: -0.03 },
      { at: 1.0, value: 0 },
    ],
    fovs: [
      { at: 0.0, value: 74 },
      { at: 0.3, value: 70 },
      { at: 0.7, value: 82 },
      { at: 1.0, value: 76 },
    ],
    shake: { from: 0.16, to: 0.46, amount: 0.07 },
    events: [
      { at: 0.05, text: '车队冲出公路桥。残骸在后视中燃烧。' },
      { at: 0.2, text: 'HAMMER：任务成功。VEGA 与模块都在车上。' },
      { at: 0.52, text: '云层中出现未知无人机红色光点。' },
      { at: 0.74, text: '无人机锁定框套住车队。' },
      { at: 0.95, clearText: true },
    ],
  };
}
