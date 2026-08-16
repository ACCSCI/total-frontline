import missionsData from '../../shared/missions.json';
import { showHudToast } from './combat-hud';
import type { P0Level } from './level';
import type { FirstPersonPlayer } from './player';

export interface Checkpoint {
  id: string;
  x?: number;
  z: number;
  label: string;
}

const LIST = (missionsData.mission01 as { checkpoints?: Checkpoint[] }).checkpoints || [
  { id: 'cp_spawn', z: 1000, label: '坠机残骸 A' },
];

export function stealthUntilZ() {
  return (missionsData.mission01 as { stealthUntilZ?: number }).stealthUntilZ ?? 500;
}

export class CheckpointTrack {
  current = { x: 0, z: 1000, yaw: 0 };
  currentId = 'cp_spawn';
  private passed = new Set<string>(['cp_spawn']);

  update(x: number, z: number, yaw: number) {
    for (const cp of LIST) {
      if (this.passed.has(cp.id) || z > cp.z) continue;
      this.passed.add(cp.id);
      this.current = { x: cp.x ?? x, z: cp.z, yaw };
      this.currentId = cp.id;
    }
  }

  restore(player: FirstPersonPlayer, level: P0Level) {
    player.restorePose(this.current.x, this.current.z, this.current.yaw, level);
  }

  /** Debug-only F1/F2 hop through the mission's checkpoint list. */
  jump(player: FirstPersonPlayer, level: P0Level, delta: -1 | 1) {
    const index = LIST.findIndex((cp) => cp.id === this.currentId);
    const next = LIST[Math.min(LIST.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))];
    if (!next || next.id === this.currentId) return null;
    this.currentId = next.id;
    this.current = { x: next.x ?? player.position.x, z: next.z, yaw: player.yaw };
    this.passed.add(next.id);
    player.restorePose(this.current.x, this.current.z, this.current.yaw, level);
    const toast = document.getElementById('p0Toast') as HTMLDivElement | null;
    showHudToast(toast, `调试跳转：${next.label}`, 1.8);
    return next;
  }
}
