import { stanceSpreadMultiplier } from './stance';
import type { SpreadWeapon } from './types';

/** Hip-fire cone used by both shooters: heat + move + air + stance + ADS. */
export function currentSpread(
  heat: number,
  weapon: SpreadWeapon,
  speed: number,
  grounded: boolean,
  prone: boolean,
  crouch: boolean,
  adsEase: number
) {
  let spread = heat + (speed / 7) * weapon.moveSpread;
  if (!grounded) spread += weapon.airSpread;
  spread *= stanceSpreadMultiplier(prone, crouch, weapon.crouchMult);
  spread *= 1 + (weapon.adsSpread - 1) * adsEase;
  return spread;
}
