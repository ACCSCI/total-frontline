'use strict';
/* Shared stance tuning keeps the ballistic cone, recoil and HUD in agreement. */
const PRONE_H = 0.58;
const PRONE_SPEED = 1.15;

function stanceSpreadMultiplier(w) {
  if (player.prone) return Math.max(0.28, (w.crouchMult || 0.7) * 0.55);
  if (player.crouch) return w.crouchMult || 0.7;
  return 1;
}

function stanceRecoilMultiplier() {
  return player.prone ? 0.56 : player.crouch ? 0.8 : 1;
}

function stanceRecoveryMultiplier() {
  return player.prone ? 1.65 : player.crouch ? 1.28 : 1;
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
        : '站姿 // ALT 蹲下 · Z 卧倒';
}
