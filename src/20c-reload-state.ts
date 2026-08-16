'use strict';
/* Reloads are weapon-owned transactions. The state machine lives in
   shared/gameplay/reload.ts; this file only binds WEAPONS / player / SFX. */

function reloadView(w) {
  return {
    get id() {
      return w.id;
    },
    get mag() {
      return w.mag;
    },
    set mag(v) {
      w.mag = v;
    },
    get reserve() {
      return w.res;
    },
    set reserve(v) {
      w.res = v;
    },
    get magSize() {
      return w.magSize;
    },
    get reloadTime() {
      return w.reloadTime;
    },
    get tacticalReloadTime() {
      return w.tacticalReloadTime;
    },
    get reloadState() {
      return w.reloadState || null;
    },
    set reloadState(v) {
      if (v) w.reloadState = v;
      else delete w.reloadState;
    },
  };
}

function reloadHooks() {
  return {
    onHud: updateAmmoUI,
    onSound: (family, stage) => SFX.reloadStage(family, stage),
  };
}

function maybeAutoReload() {
  const w = WEAPONS[player.weapon];
  if (!w || w.infiniteAmmo || w.mag > 0 || w.res <= 0) return;
  startReload();
}

function startReload() {
  const w = WEAPONS[player.weapon];
  if (!w || w.infiniteAmmo || player.meleeT > 0) return;
  const busy = player.switching > 0 || player.pumpT > 0 || player.boltT > 0;
  if (Gameplay.startReload(reloadView(w), player, busy, reloadHooks())) setADS(false);
}

function interruptReload() {
  const w = WEAPONS[player.weapon];
  Gameplay.interruptReload(w ? reloadView(w) : null, player);
}

function finishReload() {
  const w = WEAPONS[player.weapon];
  if (!w) return;
  Gameplay.finishReload(reloadView(w), player, reloadHooks());
  w.spread = w.spreadBase;
}

function updatePlayerReload(dt) {
  if (player.reloadT <= 0) return;
  const w = WEAPONS[player.weapon];
  if (!w) {
    player.reloadT = 0;
    return;
  }
  const before = player.reloadT;
  Gameplay.updateReload(dt, reloadView(w), player, reloadHooks());
  if (before > 0 && player.reloadT <= 0) w.spread = w.spreadBase;
}

const RELOAD_STAGE = Gameplay.RELOAD_STAGE;

function reloadBlocksFire(w) {
  const busy = player.switching > 0 || player.pumpT > 0 || player.boltT > 0 || player.meleeT > 0;
  return Gameplay.reloadBlocksFire(reloadView(w), player, busy, reloadHooks());
}

function interruptShotgunReloadForFire(w) {
  return Gameplay.interruptShotgunReloadForFire(reloadView(w), player);
}

function discardReloadCheckpoint(w) {
  Gameplay.discardReloadCheckpoint(reloadView(w));
}

function clearAllReloadProgress() {
  for (const w of WEAPONS) delete w.reloadState;
  player.reloadT = player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = player.reloadPhase = 0;
}
