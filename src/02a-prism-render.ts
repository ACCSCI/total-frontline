'use strict';
/* Modern Warfare-style optical zoom. The world camera supplies the calibrated
   magnification; the lens adds tint/reticle without a second, misaligned view. */
const PRISM_MAGNIFICATION = 2.5;
let prismRenderCount = 0;

function renderActivePrism() {
  const w = WEAPONS[player.weapon],
    prism = w?.vm?.prism,
    active =
      !!prism &&
      w.attachments?.optic === 'prism_2_5' &&
      player.adsEase > 0.08 &&
      G.started &&
      !G.gunship?.controlled;
  if (prism?.lens) prism.lens.visible = active;
  if (!active) return false;
  prismRenderCount++;
  return true;
}
