/** Single-player stance multipliers from src/19b-stance.ts. */

export function stanceSpreadMultiplier(prone: boolean, crouch: boolean, crouchMult: number) {
  if (prone) return Math.max(0.28, (crouchMult || 0.7) * 0.55);
  if (crouch) return crouchMult || 0.7;
  return 1;
}

export function stanceRecoilMultiplier(prone: boolean, crouch: boolean) {
  return prone ? 0.56 : crouch ? 0.8 : 1;
}

export function stanceRecoveryMultiplier(prone: boolean, crouch: boolean) {
  return prone ? 1.65 : crouch ? 1.28 : 1;
}
