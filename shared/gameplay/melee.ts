export const MELEE_RANGE = 2.35;
export const MELEE_DURATION = 0.46;
export const MELEE_BODY_DAMAGE = 65;
export const MELEE_HEAD_DAMAGE = 100;

export interface MeleeBusy {
  dead?: boolean;
  meleeT: number;
  switching: boolean;
  blocked?: boolean;
}

export function canStartMelee(busy: MeleeBusy) {
  return !busy.dead && busy.meleeT <= 0 && !busy.switching && !busy.blocked;
}

export function meleeDamage(head: boolean) {
  return head ? MELEE_HEAD_DAMAGE : MELEE_BODY_DAMAGE;
}

export function beginMeleeClock() {
  return { meleeT: MELEE_DURATION, fireLock: MELEE_DURATION };
}
