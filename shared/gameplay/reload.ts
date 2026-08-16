import { isShotgun, weaponFamily } from './ids';
import { clamp } from './math';

export interface ReloadState {
  progress: number;
  duration: number;
  empty: boolean;
  rounds: number;
  phase: number;
  magOut: boolean;
  inserted: boolean;
  actionDone: boolean;
  magVisualReleased: boolean;
  active: boolean;
  soundLift: boolean;
  soundOut: boolean;
  soundIn: boolean;
  soundAction: boolean;
}

export interface ReloadWeapon {
  id: string;
  mag: number;
  reserve: number;
  magSize: number;
  reloadTime: number;
  tacticalReloadTime: number;
  reloadState: ReloadState | null;
}

export interface ReloadClock {
  reloadT: number;
  reloadDuration: number;
  reloadEmpty: boolean;
  reloadRounds: number;
  reloadPhase: number;
}

export type ReloadStageName = 'lift' | 'out' | 'in' | 'action';

export interface ReloadHooks {
  onHud?: () => void;
  onSound?: (family: string, stage: ReloadStageName) => void;
}

export const RELOAD_STAGE: Record<string, { remove: number; insert: number; action: number }> = {
  rifle: { remove: 0.055, insert: 0.7, action: 0.83 },
  ak: { remove: 0.3, insert: 0.72, action: 0.91 },
  pistol: { remove: 0.28, insert: 0.66, action: 0.9 },
  sniper: { remove: 0.34, insert: 0.86, action: 0.98 },
  lmg: { remove: 0.42, insert: 0.72, action: 0.96 },
  vector: { remove: 0.28, insert: 0.68, action: 0.9 },
  p90: { remove: 0.31, insert: 0.72, action: 0.91 },
};

export function reloadCapacity(w: ReloadWeapon, empty: boolean) {
  return isShotgun(w.id) ? w.magSize : w.magSize + (empty ? 0 : 1);
}

export function makeReloadState(w: ReloadWeapon): ReloadState {
  const empty = w.mag <= 0;
  const rounds = Math.min(reloadCapacity(w, empty) - w.mag, w.reserve);
  const duration = isShotgun(w.id)
    ? 0.46 + rounds * 0.42 + (empty ? 0.18 : 0)
    : empty
      ? w.reloadTime
      : w.tacticalReloadTime || w.reloadTime * 0.78;
  return {
    progress: 0,
    duration,
    empty,
    rounds,
    phase: 0,
    magOut: false,
    inserted: false,
    actionDone: false,
    magVisualReleased: false,
    active: false,
    soundLift: false,
    soundOut: false,
    soundIn: false,
    soundAction: false,
  };
}

function restore(clock: ReloadClock, state: ReloadState) {
  clock.reloadDuration = state.duration;
  clock.reloadT = Math.max(0.001, state.duration * (1 - state.progress));
  clock.reloadEmpty = state.empty;
  clock.reloadRounds = state.rounds;
  clock.reloadPhase = state.phase;
  state.active = true;
}

export function startReload(
  w: ReloadWeapon,
  clock: ReloadClock,
  busy: boolean,
  hooks: ReloadHooks = {}
) {
  if (busy || clock.reloadT > 0) return false;
  if (w.reloadState) {
    restore(clock, w.reloadState);
    hooks.onHud?.();
    return true;
  }
  if (w.mag >= w.magSize || w.reserve <= 0) return false;
  w.reloadState = makeReloadState(w);
  restore(clock, w.reloadState);
  if (!w.reloadState.soundLift) {
    w.reloadState.soundLift = true;
    hooks.onSound?.(weaponFamily(w.id), 'lift');
  }
  hooks.onHud?.();
  return true;
}

export function interruptReload(w: ReloadWeapon | null, clock: ReloadClock) {
  if (clock.reloadT <= 0) return;
  const state = w?.reloadState;
  if (state) {
    state.progress = Math.max(
      state.progress,
      clamp(1 - clock.reloadT / Math.max(0.001, clock.reloadDuration), 0, 0.999)
    );
    state.phase = clock.reloadPhase;
    state.active = false;
  }
  clock.reloadT = 0;
  clock.reloadDuration = 0;
  clock.reloadEmpty = false;
  clock.reloadRounds = 0;
  clock.reloadPhase = 0;
}

function seatMagazine(w: ReloadWeapon, state: ReloadState, clock: ReloadClock, hooks: ReloadHooks) {
  if (state.inserted) return;
  const take = Math.min(Math.max(0, reloadCapacity(w, state.empty) - w.mag), w.reserve);
  w.mag += take;
  w.reserve -= take;
  state.inserted = true;
  if (!state.soundIn) {
    state.soundIn = true;
    hooks.onSound?.(weaponFamily(w.id), 'in');
  }
  hooks.onHud?.();
}

function loadShotgunRounds(
  w: ReloadWeapon,
  state: ReloadState,
  clock: ReloadClock,
  desired: number,
  hooks: ReloadHooks
) {
  while (state.phase < desired && state.phase < state.rounds && w.reserve > 0) {
    if (w.mag >= w.magSize) break;
    w.mag++;
    w.reserve--;
    state.phase++;
    clock.reloadPhase = state.phase;
    hooks.onSound?.('shotgun', 'in');
  }
  hooks.onHud?.();
}

export function finishReload(w: ReloadWeapon, clock: ReloadClock, hooks: ReloadHooks = {}) {
  const state = w.reloadState;
  if (state) {
    if (isShotgun(w.id)) loadShotgunRounds(w, state, clock, state.rounds, hooks);
    else seatMagazine(w, state, clock, hooks);
    state.actionDone = true;
    w.reloadState = null;
  }
  clock.reloadT = 0;
  clock.reloadDuration = 0;
  clock.reloadEmpty = false;
  clock.reloadRounds = 0;
  clock.reloadPhase = 0;
  hooks.onHud?.();
}

export function updateReload(
  dt: number,
  w: ReloadWeapon,
  clock: ReloadClock,
  hooks: ReloadHooks = {}
) {
  const state = w.reloadState;
  if (!state) {
    clock.reloadT = 0;
    return;
  }
  clock.reloadT = Math.max(0, clock.reloadT - dt);
  state.progress = clamp(1 - clock.reloadT / state.duration, 0, 1);
  if (isShotgun(w.id)) {
    const elapsed = state.progress * state.duration;
    const desired = clamp(Math.floor((elapsed - 0.2) / 0.42) + 1, 0, state.rounds);
    loadShotgunRounds(w, state, clock, desired, hooks);
    if (state.empty && elapsed >= 0.2 + state.rounds * 0.42 && !state.soundAction) {
      state.soundAction = true;
      hooks.onSound?.('shotgun', 'action');
    }
  } else {
    const marks = RELOAD_STAGE[weaponFamily(w.id)] || { remove: 0.32, insert: 0.68, action: 0.9 };
    if (state.progress >= marks.remove) {
      state.magOut = true;
      if (!state.soundOut) {
        state.soundOut = true;
        hooks.onSound?.(weaponFamily(w.id), 'out');
      }
    }
    if (state.progress >= marks.insert) seatMagazine(w, state, clock, hooks);
    if (state.progress >= marks.action && !state.actionDone) {
      state.actionDone = true;
      if (state.empty && !state.soundAction) {
        state.soundAction = true;
        hooks.onSound?.(weaponFamily(w.id), 'action');
      }
    }
  }
  if (clock.reloadT <= 0) finishReload(w, clock, hooks);
}

export function reloadBlocksFire(
  w: ReloadWeapon,
  clock: ReloadClock,
  busy: boolean,
  hooks: ReloadHooks
) {
  const state = w.reloadState;
  if (!state || state.active || isShotgun(w.id)) return false;
  const open = !state.inserted || (state.empty && !state.actionDone);
  if (open) startReload(w, clock, busy, hooks);
  return open;
}

export function interruptShotgunReloadForFire(w: ReloadWeapon, clock: ReloadClock) {
  if (!isShotgun(w.id) || clock.reloadT <= 0 || w.mag <= 0) return false;
  interruptReload(w, clock);
  w.reloadState = null;
  return true;
}

export function discardReloadCheckpoint(w: ReloadWeapon) {
  if (w.reloadState?.active) return;
  w.reloadState = null;
}
