'use strict';
/* Keep hit/kill confirmation on the visible optical point. During recoil the
   viewmodel reticle moves inside its housing, so a fixed 50/50 DOM marker can
   look detached even though the gameplay ray remains screen-centred. */
function currentViewmodelAimObject(w) {
  const optic = w.attachments?.optic;
  if (optic === 'micro_dot') return w.vm.dot;
  if (optic === 'holo') return w.vm.holo?.dot;
  if (optic === 'prism_2_5') return w.vm.prism?.group.userData.reticle?.h;
  return w.vm.aimPoint;
}

function syncHitmarkToAim() {
  const w = WEAPONS[player.weapon];
  const target = player.adsEase > 0.12 ? currentViewmodelAimObject(w) : null;
  let x = 50,
    y = 50;
  if (target) {
    target.updateWorldMatrix(true, false);
    const ndc = target
      .getWorldPosition(UI._aimNdc || (UI._aimNdc = new THREE.Vector3()))
      .project(vmCamera);
    if (Number.isFinite(ndc.x) && Number.isFinite(ndc.y)) {
      x += ndc.x * 50;
      y -= ndc.y * 50;
    }
  }
  UI.hitmark.style.left = `${clamp(x, 2, 98)}%`;
  UI.hitmark.style.top = `${clamp(y, 2, 98)}%`;
}
