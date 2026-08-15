import missionsData from '../../shared/missions.json';
import { SFX } from './sfx';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Typewriter intro lines, owned by the same mission data as single-player. */
export async function typeMissionBriefing(
  typedEl: HTMLSpanElement,
  cancelled: () => boolean
): Promise<boolean> {
  const m = missionsData.mission01;
  const lines = [m.location, m.time, `任务：回收幸存者 VEGA`];
  let full = '';
  for (const line of lines) {
    for (const ch of line) {
      if (cancelled()) return false;
      full += ch;
      typedEl.textContent = full;
      SFX.typeKey();
      await wait(42 + Math.random() * 46);
    }
    if (cancelled()) return false;
    full += '\n';
    typedEl.textContent = full;
    SFX.lineConfirm();
    await wait(300);
  }
  return !cancelled();
}
