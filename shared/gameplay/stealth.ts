/** Stealth sense for campaign infiltration. Combat after stealthUntilZ. */
export const STEALTH_FAIL_HOLD = 1.15;

export function sightDetectRate(opts: {
  dist: number;
  inFov: boolean;
  hasLos: boolean;
  crouched: boolean;
  prone: boolean;
  sprinting: boolean;
}) {
  if (!opts.hasLos) return -0.42;
  const range = opts.prone ? 13 : opts.crouched ? 21 : opts.sprinting ? 36 : 28;
  if (opts.dist > range + 6) return opts.inFov ? -0.12 : -0.28;
  if (!opts.inFov && opts.dist > 7) return -0.16;
  if (opts.dist > range) return opts.inFov ? 0.04 : -0.1;
  const closeness = 1 - opts.dist / range;
  let rate = 0.18 + closeness * 0.9;
  if (opts.prone) rate *= 0.32;
  else if (opts.crouched) rate *= 0.52;
  if (opts.sprinting) rate *= 1.5;
  if (!opts.inFov) rate *= 0.22;
  return rate;
}

export function hearSpike(
  dist: number,
  sprinting: boolean,
  suppressedShot: boolean,
  loudShot: boolean
) {
  if (loudShot && dist < 44) return 1;
  if (suppressedShot && dist < 9) return 0.58;
  if (sprinting && dist < 10) return 0.2;
  return 0;
}

export function stealthActive(playerZ: number, untilZ: number) {
  return playerZ > untilZ;
}
