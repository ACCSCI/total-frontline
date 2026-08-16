/** CoD-style plates: hidden until you aim at them, or just after you hit them. */
export const NAMEPLATE_AIM_DOT = 0.986;
export const NAMEPLATE_MAX_DIST = 46;
export const NAMEPLATE_HIT_REVEAL = 1.25;

export function nameplateVisible(started: boolean, dist: number, aimDot: number, revealT: number) {
  if (!started || dist > NAMEPLATE_MAX_DIST) return false;
  return revealT > 0 || aimDot >= NAMEPLATE_AIM_DOT;
}
