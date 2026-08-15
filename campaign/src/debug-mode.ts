import * as THREE from 'three';
import type { P0Level } from './level';
import { predictGroundDelta } from './ground-model';

interface Selectable {
  key: string;
  label: string;
  kind: string;
  root?: THREE.Object3D;
  instance?: THREE.InstancedMesh;
  instanceId?: number;
  localMinY?: number;
}

interface AdjustmentRecord {
  key: string;
  label: string;
  delta: number;
}

export class PropDebugger {
  active = false;
  selected: Selectable | null = null;

  private level: P0Level;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private adjustments = new Map<string, AdjustmentRecord>();
  private selectables: Selectable[] = [];
  private panel: HTMLDivElement;
  private stateEl: HTMLElement;
  private selectedEl: HTMLElement;
  private infoEl: HTMLElement;

  constructor(level: P0Level, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.level = level;
    this.scene = scene;
    this.camera = camera;
    this.panel = document.getElementById('debugPanel') as HTMLDivElement;
    this.stateEl = document.getElementById('debugState') as HTMLElement;
    this.selectedEl = document.getElementById('debugSelected') as HTMLElement;
    this.infoEl = document.getElementById('debugInfo') as HTMLElement;
    this.buildSelectables();
  }

  toggle() {
    this.active = !this.active;
    if (!this.active) this.selected = null;
    if (this.active && document.pointerLockElement) document.exitPointerLock();
    this.panel.hidden = !this.active;
    this.refreshPanel();
  }

  trySelect(clientX: number, clientY: number) {
    if (!this.active) return;
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      const object = hit.object as THREE.Object3D;
      if (object instanceof THREE.InstancedMesh) {
        const selectable = this.selectables.find((s) => s.instance === object);
        if (!selectable || hit.instanceId === undefined) continue;
        this.selected = {
          key: `${selectable.key}:${hit.instanceId}`,
          label: `${selectable.label} #${hit.instanceId}`,
          kind: selectable.kind,
          instance: object,
          instanceId: hit.instanceId,
          localMinY: selectable.localMinY,
        };
        this.refreshPanel();
        return;
      }
      const root = this.findPropRoot(object);
      const selectable = this.selectables.find((s) => s.root === root);
      if (!selectable) continue;
      this.selected = {
        key: selectable.key,
        label: selectable.label,
        kind: selectable.kind,
        root,
      };
      this.refreshPanel();
      return;
    }
    this.selected = null;
    this.refreshPanel();
  }

  nudge(delta: number) {
    if (!this.active || !this.selected) return;
    const sel = this.selected;
    if (sel.instance && sel.instanceId !== undefined) {
      const m = new THREE.Matrix4();
      sel.instance.getMatrixAt(sel.instanceId, m);
      m.elements[13] += delta;
      sel.instance.setMatrixAt(sel.instanceId, m);
      sel.instance.instanceMatrix.needsUpdate = true;
    } else if (sel.root) {
      sel.root.position.y += delta;
    } else {
      return;
    }
    const record = this.adjustments.get(sel.key) || { key: sel.key, label: sel.label, delta: 0 };
    record.delta += delta;
    this.adjustments.set(sel.key, record);
    this.refreshPanel();
  }

  clearSelection() {
    this.selected = null;
    this.refreshPanel();
  }

  /** One-key auto fix: project every ground-contact prop onto the terrain and
      lower it until no footprint sample is floating. Trees/bushes are pulled
      to a small, consistent penetration so slopes never leave them airborne. */
  autoFix(): number {
    let fixed = 0;
    const box = new THREE.Box3();
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const canopy = this.selectables.find((s) => s.kind === 'canopy');

    for (let pass = 0; pass < 2; pass++) {
      for (const sel of this.selectables) {
        if (sel.root && (sel.kind === 'rock' || sel.kind === 'log')) {
          const delta = THREE.MathUtils.clamp(predictGroundDelta(this.groundFeatures(sel.root)), -0.75, 0.05);
          if (Math.abs(delta) > 0.002) {
            sel.root.position.y += delta;
            fixed++;
          }
        } else if (sel.root && sel.kind === 'crate') {
          box.setFromObject(sel.root);
          const gap = box.min.y - this.level.groundY(sel.root.position.x, sel.root.position.z);
          /* Center-projection placement: remove visible floating, cap sink. */
          let delta = 0;
          if (gap > 0.015) {
            delta = Math.max(-0.3, -gap - 0.05);
          } else if (gap < -0.18) {
            delta = Math.min(0.3, -gap - 0.08);
          }
          if (Math.abs(delta) > 0.004) {
            sel.root.position.y += delta;
            fixed++;
          }
        } else if (sel.instance && (sel.kind === 'trunk' || sel.kind === 'bush')) {
          const localMinY = sel.localMinY || 0;
          for (let i = 0; i < sel.instance.count; i++) {
            sel.instance.getMatrixAt(i, matrix);
            matrix.decompose(pos, quat, scale);
            const minY = pos.y + localMinY * scale.y;
            const ground = this.level.groundY(pos.x, pos.z);
            const gap = minY - ground;
            const target = -0.03;
            const delta = THREE.MathUtils.clamp(target - gap, -0.15, 0.15);
            if (Math.abs(delta) < 0.004) continue;
            matrix.elements[13] += delta;
            sel.instance.setMatrixAt(i, matrix);
            const canopyInstance = sel.kind === 'trunk' ? canopy?.instance : undefined;
            if (canopyInstance) {
              const cm = new THREE.Matrix4();
              canopyInstance.getMatrixAt(i, cm);
              cm.elements[13] += delta;
              canopyInstance.setMatrixAt(i, cm);
            }
            fixed++;
          }
          sel.instance.instanceMatrix.needsUpdate = true;
          const canopyInstanceForUpdate = sel.kind === 'trunk' ? canopy?.instance : undefined;
          if (canopyInstanceForUpdate) canopyInstanceForUpdate.instanceMatrix.needsUpdate = true;
        }
      }
    }

    this.infoEl.textContent = `一键贴地完成 · 自动修正 ${fixed} 处`;
    this.refreshPanel();
    return fixed;
  }

  writeLog() {
    const floating: Array<Record<string, unknown>> = [];
    const box = new THREE.Box3();
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (const sel of this.selectables) {
      if (sel.root) {
        box.setFromObject(sel.root);
        const terrain = this.level.groundY(sel.root.position.x, sel.root.position.z);
        const gap = box.min.y - terrain;
        if (gap > 0.02 && sel.kind !== 'canopy') {
          floating.push({
            key: sel.key,
            kind: sel.kind,
            x: Number(sel.root.position.x.toFixed(2)),
            y: Number(sel.root.position.y.toFixed(3)),
            z: Number(sel.root.position.z.toFixed(2)),
            minY: Number(box.min.y.toFixed(3)),
            terrain: Number(terrain.toFixed(3)),
            gap: Number(gap.toFixed(3)),
          });
        }
      } else if (sel.instance) {
        const localMinY = sel.localMinY || 0;
        for (let i = 0; i < sel.instance.count; i++) {
          sel.instance.getMatrixAt(i, matrix);
          matrix.decompose(pos, quat, scale);
          const minY = pos.y + localMinY * scale.y;
          const terrain = this.level.groundY(pos.x, pos.z);
          const gap = minY - terrain;
          if (gap > 0.02 && sel.kind !== 'canopy') {
            floating.push({
              key: `${sel.key}:${i}`,
              kind: sel.kind,
              x: Number(pos.x.toFixed(2)),
              y: Number(pos.y.toFixed(3)),
              z: Number(pos.z.toFixed(2)),
              minY: Number(minY.toFixed(3)),
              terrain: Number(terrain.toFixed(3)),
              gap: Number(gap.toFixed(3)),
            });
          }
        }
      }
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      adjustments: [...this.adjustments.values()].map((r) => ({
        key: r.key,
        label: r.label,
        delta: Number(r.delta.toFixed(3)),
      })),
      floatingCandidates: floating,
    };

    console.log('[P0 DEBUG LOG]', payload);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'p0-debug-adjustments.json';
    a.click();
    URL.revokeObjectURL(url);
    this.infoEl.textContent = `已输出 ${floating.length} 个悬空候选 + ${this.adjustments.size} 条手动调整`;
  }

  /** Feature vector used by the trained placement model. Must stay in sync
      with tools/train-ground-model.py FEATURES. */
  private groundFeatures(root: THREE.Object3D): Record<string, number> {
    const box = new THREE.Box3().setFromObject(root);
    const x = root.position.x;
    const z = root.position.z;
    const ground = this.level.groundY(x, z);
    const analytic = this.level.terrainHeight(x, z);
    const halfW = (box.max.x - box.min.x) / 2;
    const halfD = (box.max.z - box.min.z) / 2;
    const footR = Math.max(0.35, halfW, halfD) * 1.35;
    const ring: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ring.push(this.level.groundY(x + Math.cos(a) * footR, z + Math.sin(a) * footR));
    }
    const ringMin = Math.min(...ring);
    const ringMax = Math.max(...ring);
    const ringMean = ring.reduce((a, b) => a + b, 0) / ring.length;
    const kind = root.userData.debugKind as string;
    return {
      isRock: kind === 'rock' ? 1 : 0,
      isLog: kind === 'log' ? 1 : 0,
      size: Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z),
      halfW,
      halfD,
      height: box.max.y - box.min.y,
      bottomOffset: box.min.y - root.position.y,
      ground,
      rayBias: ground - analytic,
      slope: ringMax - ringMin,
      curv: ground - ringMean,
      ringMean,
      ringMin,
      ringMax,
      currentPenetration: ground - box.min.y,
      castsShadow: root.castShadow ? 1 : 0,
    };
  }

  /** A clicked child mesh belongs to the nearest ancestor carrying a debugId. */
  private findPropRoot(object: THREE.Object3D): THREE.Object3D {
    let node: THREE.Object3D | null = object;
    while (node && !node.userData.debugId) node = node.parent;
    return node || object;
  }

  private buildSelectables() {    const skip = new Set(['P0_GRAYBOX_GROUND', 'P0_HORIZON_BACKDROP']);
    this.scene.traverse((obj) => {
      if ((obj as THREE.Points).isPoints || (obj as THREE.Light).isLight) return;
      if (!(obj as THREE.Mesh).isMesh) return;
      if (skip.has(obj.name) || obj.name.startsWith('objective-gate') || obj.userData.debugKind === 'decor') return;

      if (obj instanceof THREE.InstancedMesh) {
        obj.geometry.computeBoundingBox();
        const localMinY = obj.geometry.boundingBox?.min.y ?? 0;
        const prefix = (obj.userData.debugKeyPrefix as string) || obj.name || obj.geometry.type;
        this.selectables.push({
          key: prefix,
          label: prefix,
          kind: prefix,
          instance: obj,
          localMinY,
        });
        return;
      }

      const root = this.findPropRoot(obj);
      if (this.selectables.some((s) => s.root === root)) return;
      const key = (root.userData.debugId as string) || `${root.name || root.type}:${root.id}`;
      const kind = (root.userData.debugKind as string) || root.name || root.type;
      this.selectables.push({ key, label: key, kind, root });
    });
  }

  private selectedState() {
    const sel = this.selected;
    if (!sel) return null;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    if (sel.instance && sel.instanceId !== undefined) {
      sel.instance.getMatrixAt(sel.instanceId, matrix);
      matrix.decompose(pos, quat, scale);
      const minY = pos.y + (sel.localMinY || 0) * scale.y;
      return {
        y: pos.y,
        terrain: this.level.groundY(pos.x, pos.z),
        gap: minY - this.level.groundY(pos.x, pos.z),
        pos: `x ${pos.x.toFixed(2)} · z ${pos.z.toFixed(2)}`,
      };
    }
    if (sel.root) {
      const box = new THREE.Box3().setFromObject(sel.root);
      return {
        y: sel.root.position.y,
        terrain: this.level.groundY(sel.root.position.x, sel.root.position.z),
        gap: box.min.y - this.level.groundY(sel.root.position.x, sel.root.position.z),
        pos: `x ${sel.root.position.x.toFixed(2)} · z ${sel.root.position.z.toFixed(2)}`,
      };
    }
    return null;
  }

  private refreshPanel() {
    this.stateEl.textContent = this.active ? 'ON' : 'OFF';
    if (!this.selected) {
      this.selectedEl.textContent = '未选中物体（左键点选）';
      this.infoEl.textContent = '';
      return;
    }
    const state = this.selectedState();
    const adj = this.adjustments.get(this.selected.key)?.delta || 0;
    this.selectedEl.textContent = `${this.selected.label} · ${this.selected.kind}`;
    if (state) {
      this.infoEl.textContent = `${state.pos} · y ${state.y.toFixed(3)} · 地形 ${state.terrain.toFixed(3)} · 离地 ${state.gap.toFixed(3)} · 调整 ${adj.toFixed(3)}`;
    }
  }
}
