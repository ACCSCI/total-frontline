import * as THREE from 'three';

export interface CutsceneEvent {
  at: number /* normalized time 0..1 */;
  text?: string;
  clearText?: boolean;
  callback?: () => void;
}

export interface CutsceneDefinition {
  duration: number;
  cameraPositions: THREE.Vector3[];
  lookTargets: THREE.Vector3[];
  events: CutsceneEvent[];
}

/* ---------------------------------------------------------------------------
   Minimal in-engine sequencer. The camera flies through the same live scene
   the player will inhabit — no video, no load seam. Enough to validate the
   P0 real-time CG pipeline.
   ------------------------------------------------------------------------- */

export class Sequencer {
  private def: CutsceneDefinition;
  private time = 0;
  private path: THREE.CatmullRomCurve3;
  private look: THREE.CatmullRomCurve3;
  private fired: Set<CutsceneEvent>;
  private done: boolean;
  onFinished: (() => void) | null = null;

  constructor(def: CutsceneDefinition) {
    this.def = def;
    this.path = new THREE.CatmullRomCurve3(def.cameraPositions);
    this.look = new THREE.CatmullRomCurve3(def.lookTargets);
    this.fired = new Set();
    this.done = false;
  }

  get finished(): boolean {
    return this.done;
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    if (this.done) return;
    this.time += dt;
    const duration = this.def.duration;
    const u = THREE.MathUtils.clamp(this.time / duration, 0, 1);

    const pos = this.path.getPointAt(u);
    const look = this.look.getPointAt(u);
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.updateProjectionMatrix();

    for (const event of this.def.events) {
      if (u >= event.at && !this.fired.has(event)) {
        this.fired.add(event);
        if (event.text !== undefined) this.setText(event.text);
        if (event.clearText) this.setText('');
        event.callback?.();
      }
    }

    if (u >= 1) {
      this.done = true;
      this.onFinished?.();
    }
  }

  skip() {
    this.time = this.def.duration + 1;
  }

  private setText(text: string) {
    const el = document.getElementById('cutsceneText');
    if (el) el.textContent = text;
  }
}

export function makeIntroCutscene(): CutsceneDefinition {
  return {
    duration: 11,
    cameraPositions: [
      new THREE.Vector3(0, 72, 132),
      new THREE.Vector3(16, 48, 98),
      new THREE.Vector3(-14, 26, 64),
      new THREE.Vector3(0, 9, 44),
      new THREE.Vector3(0, 2.0, 82),
    ],
    lookTargets: [
      new THREE.Vector3(0, -6, 60),
      new THREE.Vector3(-4, -2, 36),
      new THREE.Vector3(0, -1, 16),
      new THREE.Vector3(0, 0, 6),
      new THREE.Vector3(0, 1, 40),
    ],
    events: [],
  };
}

export function makeOutroCutscene(): CutsceneDefinition {
  return {
    duration: 7.5,
    cameraPositions: [
      new THREE.Vector3(0, 2.4, -68),
      new THREE.Vector3(2.5, 2.5, -76),
      new THREE.Vector3(0, 2.8, -84),
      new THREE.Vector3(0, 3.2, -92),
    ],
    lookTargets: [
      new THREE.Vector3(0, 1.2, -80),
      new THREE.Vector3(0, 1.2, -88),
      new THREE.Vector3(0, 1.2, -94),
      new THREE.Vector3(0, 1.4, -98),
    ],
    events: [
      { at: 0.12, text: '公路桥已肃清\n接应车队正在穿过河谷' },
      { at: 0.52, text: '任务完成 · 哨兵特遣队回收 VEGA' },
      { at: 0.82, clearText: true },
    ],
  };
}
