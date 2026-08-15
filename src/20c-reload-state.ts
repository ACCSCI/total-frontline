'use strict';
/* Reloads are weapon-owned transactions. Interrupting one freezes its exact
   normalized time and completed mechanical stages; selecting the weapon and
   pressing reload later continues that transaction instead of spawning a
   second magazine or replaying the removal. */
const RELOAD_STAGE = {
  rifle: { remove: 0.055, insert: 0.7, action: 0.83 },
  ak: { remove: 0.3, insert: 0.72, action: 0.91 },
  pistol: { remove: 0.28, insert: 0.66, action: 0.9 },
  sniper: { remove: 0.34, insert: 0.86, action: 0.98 },
  lmg: { remove: 0.42, insert: 0.72, action: 0.96 },
  vector: { remove: 0.28, insert: 0.68, action: 0.9 },
  p90: { remove: 0.31, insert: 0.72, action: 0.91 },
};

function reloadCapacity(w, empty) {
  return w.id === 'shotgun' ? w.magSize : w.magSize + (empty ? 0 : 1);
}

function makeReloadState(w) {
  const empty = w.mag <= 0;
  const rounds = Math.min(reloadCapacity(w, empty) - w.mag, w.res);
  const duration =
    w.id === 'shotgun'
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

function restoreReloadPlayerState(state) {
  player.reloadDuration = state.duration;
  player.reloadT = Math.max(0.001, state.duration * (1 - state.progress));
  player.reloadEmpty = state.empty;
  player.reloadRounds = state.rounds;
  player.reloadPhase = state.phase;
  state.active = true;
}

function maybeAutoReload() {
  const w = WEAPONS[player.weapon];
  if (!w || w.infiniteAmmo || w.mag > 0 || w.res <= 0) return;
  startReload();
}

function startReload() {
  const w = WEAPONS[player.weapon];
  if (
    w.infiniteAmmo ||
    player.reloadT > 0 ||
    player.switching > 0 ||
    player.pumpT > 0 ||
    player.boltT > 0 ||
    player.meleeT > 0
  )
    return;
  if (w.reloadState) {
    setADS(false);
    restoreReloadPlayerState(w.reloadState);
    return;
  }
  if (w.mag >= w.magSize || w.res <= 0) return;
  setADS(false);
  w.reloadState = makeReloadState(w);
  restoreReloadPlayerState(w.reloadState);
  if (!w.reloadState.soundLift) {
    w.reloadState.soundLift = true;
    SFX.reloadStage(w.id, 'lift');
  }
}

function interruptReload() {
  if (player.reloadT <= 0) return;
  const w = WEAPONS[player.weapon],
    state = w.reloadState;
  if (state) {
    state.progress = Math.max(
      state.progress,
      clamp(1 - player.reloadT / Math.max(0.001, player.reloadDuration), 0, 0.999)
    );
    state.phase = player.reloadPhase;
    state.active = false;
  }
  player.reloadT = 0;
  player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = 0;
}

function seatReloadMagazine(w, state) {
  if (state.inserted) return;
  const need = reloadCapacity(w, state.empty) - w.mag;
  const take = Math.min(Math.max(0, need), w.res);
  w.mag += take;
  w.res -= take;
  state.inserted = true;
  if (!state.soundIn) {
    state.soundIn = true;
    SFX.reloadStage(w.id, 'in');
  }
  updateAmmoUI();
}

function loadShotgunRounds(w, state, desiredPhase) {
  while (state.phase < desiredPhase && state.phase < state.rounds && w.res > 0) {
    if (w.mag >= w.magSize) break;
    w.mag++;
    w.res--;
    state.phase++;
    player.reloadPhase = state.phase;
    SFX.reloadStage('shotgun', 'in');
  }
  updateAmmoUI();
}

function finishReload() {
  const w = WEAPONS[player.weapon],
    state = w.reloadState;
  if (state) {
    if (w.id === 'shotgun') loadShotgunRounds(w, state, state.rounds);
    else seatReloadMagazine(w, state);
    state.actionDone = true;
    delete w.reloadState;
  }
  player.reloadT = 0;
  player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = 0;
  player.reloadPhase = 0;
  w.spread = w.spreadBase;
  updateAmmoUI();
}

function updatePlayerReload(dt) {
  if (player.reloadT <= 0) return;
  const w = WEAPONS[player.weapon],
    state = w.reloadState;
  if (!state) {
    player.reloadT = 0;
    return;
  }
  player.reloadT = Math.max(0, player.reloadT - dt);
  state.progress = clamp(1 - player.reloadT / state.duration, 0, 1);
  if (w.id === 'shotgun') {
    const elapsed = state.progress * state.duration;
    const desired = clamp(Math.floor((elapsed - 0.2) / 0.42) + 1, 0, state.rounds);
    loadShotgunRounds(w, state, desired);
    if (state.empty && elapsed >= 0.2 + state.rounds * 0.42 && !state.soundAction) {
      state.soundAction = true;
      SFX.reloadStage('shotgun', 'action');
    }
  } else {
    const marks = RELOAD_STAGE[w.id] || { remove: 0.32, insert: 0.68, action: 0.9 };
    if (state.progress >= marks.remove) {
      state.magOut = true;
      if (!state.soundOut) {
        state.soundOut = true;
        SFX.reloadStage(w.id, 'out');
      }
    }
    if (state.progress >= marks.insert) seatReloadMagazine(w, state);
    if (state.progress >= marks.action && !state.actionDone) {
      state.actionDone = true;
      if (state.empty && !state.soundAction) {
        state.soundAction = true;
        SFX.reloadStage(w.id, 'action');
      }
    }
  }
  if (player.reloadT <= 0) finishReload();
}

function reloadBlocksFire(w) {
  const state = w.reloadState;
  if (!state || state.active || w.id === 'shotgun') return false;
  const mechanicallyOpen = !state.inserted || (state.empty && !state.actionDone);
  /* Pulling the trigger on a rifle with no seated magazine (or an empty gun
     whose action is still open) resumes the remaining manipulation. It must
     never spend the stale HUD round count as if the detached mag were fitted. */
  if (mechanicallyOpen) startReload();
  return mechanicallyOpen;
}

function interruptShotgunReloadForFire(w) {
  if (w.id !== 'shotgun' || player.reloadT <= 0 || w.mag <= 0) return false;
  interruptReload();
  /* Inserted shells are already committed one by one. Firing closes this
     loading transaction; a later R starts a fresh loop for the new deficit. */
  delete w.reloadState;
  return true;
}

function discardReloadCheckpoint(w) {
  if (w.reloadState?.active) return;
  delete w.reloadState;
}

function clearAllReloadProgress() {
  for (const w of WEAPONS) delete w.reloadState;
  player.reloadT = player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = player.reloadPhase = 0;
}
