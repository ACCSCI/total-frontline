export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Height-aware world queries. Yard AABB and the valley heightfield both adapt this. */
export interface WorldQuery {
  groundY(x: number, z: number, probeY?: number): number | null;
  ceilingY(x: number, z: number, fromY: number): number;
  blocked(x: number, z: number, y0: number, y1: number, radius: number): boolean;
  depenetrate(pos: Vec3, radius: number, y0: number, y1: number): void;
  clampHorizontal(pos: Vec3, padding: number): void;
}

export interface MovementTuning {
  speeds: { walk: number; sprint: number; crouch: number; prone: number };
  physics: {
    acceleration: number;
    airAcceleration: number;
    friction: number;
    gravity: number;
    jumpVelocity: number;
    doubleJumpVelocity: number;
  };
  stance: {
    standHeight: number;
    crouchHeight: number;
    proneHeight: number;
    radius: number;
    baseFov: number;
  };
}

export interface LocoInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  crouch: boolean;
  pronePressed: boolean;
}

export interface LocoState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  crouch: boolean;
  prone: boolean;
  sprint: boolean;
  height: number;
  onGround: boolean;
  jumpsLeft: number;
  mantleT: number;
  mantleDur: number;
  mantleFrom: Vec3;
  mantleTo: Vec3;
  mantleTilt: number;
  ads: boolean;
  adsEase: number;
  reloading: boolean;
  sprintFireRaise: number;
  canSprint: boolean;
  canProne: boolean;
  canMantle: boolean;
  canDoubleJump: boolean;
  jumpScale: number;
  speedScale: number;
}

export interface LocoEvents {
  onJump?: () => void;
  onLand?: (force: number) => void;
  onMantleStart?: () => void;
  onMantleEnd?: () => void;
}

export interface SpreadWeapon {
  spreadBase: number;
  moveSpread: number;
  airSpread: number;
  crouchMult: number;
  adsSpread: number;
}

export interface RecoilImpulse {
  velP: number;
  velY: number;
  fovKick: number;
  shake: number;
}
