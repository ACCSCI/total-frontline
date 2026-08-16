'use strict';
/* Shared stance tuning keeps the ballistic cone, recoil and HUD in agreement. */
const PRONE_H = SHARED_MOVEMENT.stance.proneHeight;
const PRONE_SPEED = SHARED_MOVEMENT.speeds.prone;

function stanceSpreadMultiplier(w) {
  return Gameplay.stanceSpreadMultiplier(!!player.prone, !!player.crouch, w.crouchMult || 0.7);
}

function stanceRecoilMultiplier() {
  return Gameplay.stanceRecoilMultiplier(!!player.prone, !!player.crouch);
}

function stanceRecoveryMultiplier() {
  return Gameplay.stanceRecoveryMultiplier(!!player.prone, !!player.crouch);
}

let lastStanceHud = '';
function updateStanceUI() {
  const stance = player.prone ? 'prone' : player.crouch ? 'crouch' : 'stand';
  if (stance === lastStanceHud) return;
  lastStanceHud = stance;
  const el = $('stance');
  el.className = stance;
  el.textContent =
    stance === 'prone'
      ? '卧姿 // 最稳定 · Z 起身'
      : stance === 'crouch'
        ? '蹲姿 // 稳定 · Z 卧倒'
        : '站姿 // C 蹲下 · Z 卧倒';
}
