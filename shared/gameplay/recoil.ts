import { lerp } from './math';
import type { RecoilImpulse } from './types';

export function currentRecoilScale(
  adsRecoil: number,
  adsEase: number,
  stanceMult: number,
  magnified = false
) {
  const adsStability = lerp(1, adsRecoil ?? 0.62, adsEase);
  const magnifiedComp = magnified ? lerp(1, 0.86, adsEase) : 1;
  return adsStability * magnifiedComp * stanceMult;
}

/** Same burst-shaped camera kick as src/23-player-update + fireWeapon. */
export function recoilImpulse(
  camPitch: number,
  camYaw: number,
  fovKick: number,
  scale: number,
  burst: number,
  shakeAmt: number,
  adsEase: number
): RecoilImpulse {
  const vert = burst === 0 ? 1.55 : burst < 4 ? 1.12 : 0.82 + Math.sin(burst * 0.9) * 0.1;
  const drift = Math.sin(burst * 0.62) * 0.85 + Math.sin(burst * 0.23 + 1.1) * 0.45;
  return {
    velP: camPitch * 38 * vert * scale,
    velY: (drift + (Math.random() - 0.5) * 0.55) * camYaw * 38 * scale,
    fovKick: fovKick * scale,
    shake: shakeAmt * 0.5 * lerp(1, 0.68, adsEase),
  };
}
