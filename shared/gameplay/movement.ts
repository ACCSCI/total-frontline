import { moveSlide } from './collide';
import { clamp, damp, easeInOutCubic, easeOutCubic, lerp, PI } from './math';
import type { LocoEvents, LocoInput, LocoState, MovementTuning, Vec3, WorldQuery } from './types';

export const MANTLE_RISE = 1.95;
export const MANTLE_MIN = 0.45;
export const STEP_HEIGHT = 0.62;
export const RELOAD_MOVE_SCALE = 0.86;
export const ADS_MOVE_PENALTY = 0.4;

function findMantle(
  state: LocoState,
  world: WorldQuery,
  standHeight: number,
  radius: number
): Vec3 | null {
  const fx = -Math.sin(state.yaw);
  const fz = -Math.cos(state.yaw);
  const feet = state.pos.y;
  for (let i = 0; i < 3; i++) {
    const reach = 0.55 + i * 0.25;
    const px = state.pos.x + fx * reach;
    const pz = state.pos.z + fz * reach;
    const top = world.groundY(px, pz, feet + MANTLE_RISE);
    if (top === null) continue;
    const rise = top - feet;
    if (rise < MANTLE_MIN || rise > MANTLE_RISE) continue;
    if (world.blocked(px, pz, top + 0.1, top + standHeight - 0.06, radius * 0.92)) continue;
    const ahead = world.groundY(px + fx * 0.35, pz + fz * 0.35, top + 0.35);
    if (ahead === null || ahead < top - 0.45) continue;
    return { x: px + fx * 0.28, y: top + 0.02, z: pz + fz * 0.28 };
  }
  return null;
}

function beginMantle(state: LocoState, target: Vec3, events: LocoEvents) {
  state.mantleFrom = { x: state.pos.x, y: state.pos.y, z: state.pos.z };
  state.mantleTo = { x: target.x, y: target.y, z: target.z };
  const rise = Math.max(0.2, target.y - state.pos.y);
  state.mantleDur = clamp(0.26 + rise * 0.13, 0.28, 0.55);
  state.mantleT = 1e-4;
  state.vel.x = state.vel.y = state.vel.z = 0;
  state.onGround = false;
  state.jumpsLeft = 0;
  events.onMantleStart?.();
}

export function createLocoState(x: number, y: number, z: number, standHeight: number): LocoState {
  return {
    pos: { x, y, z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    crouch: false,
    prone: false,
    sprint: false,
    height: standHeight,
    onGround: true,
    jumpsLeft: 1,
    mantleT: 0,
    mantleDur: 0.4,
    mantleFrom: { x, y, z },
    mantleTo: { x, y, z },
    mantleTilt: 0,
    ads: false,
    adsEase: 0,
    reloading: false,
    sprintFireRaise: 0,
    canSprint: true,
    canProne: true,
    canMantle: true,
    canDoubleJump: true,
    jumpScale: 1,
    speedScale: 1,
  };
}

export function stepLocomotion(
  dt: number,
  state: LocoState,
  input: LocoInput,
  world: WorldQuery,
  tuning: MovementTuning,
  events: LocoEvents = {}
) {
  const SPEED = tuning.speeds;
  const PHYS = tuning.physics;
  const STANCE = tuning.stance;

  if (state.sprintFireRaise > 0) state.sprintFireRaise = Math.max(0, state.sprintFireRaise - dt);

  if (input.pronePressed) {
    if (state.prone) {
      const ceil = world.ceilingY(state.pos.x, state.pos.z, state.pos.y + STANCE.proneHeight);
      if (ceil - state.pos.y > STANCE.crouchHeight + 0.1) {
        state.prone = false;
        state.crouch = true;
      }
    } else if (state.canProne && state.onGround && state.mantleT <= 0) {
      state.prone = true;
      state.crouch = false;
      state.sprint = false;
    }
  }
  if (!state.canProne) state.prone = false;
  if (input.crouch && state.prone) {
    const ceil = world.ceilingY(state.pos.x, state.pos.z, state.pos.y + STANCE.proneHeight);
    if (ceil - state.pos.y > STANCE.crouchHeight + 0.1) state.prone = false;
  }

  const wantSprint =
    state.canSprint &&
    input.sprint &&
    !input.crouch &&
    !state.prone &&
    !state.ads &&
    input.forward &&
    state.sprintFireRaise <= 0;

  if (!state.prone && !input.crouch && state.crouch) {
    const ceil = world.ceilingY(state.pos.x, state.pos.z, state.pos.y + STANCE.crouchHeight);
    if (ceil - state.pos.y > STANCE.standHeight + 0.1) state.crouch = false;
  } else if (!state.prone) state.crouch = input.crouch;
  state.sprint = wantSprint && !state.crouch && !state.prone;

  const stanceHeight = state.prone
    ? STANCE.proneHeight
    : state.crouch
      ? STANCE.crouchHeight
      : STANCE.standHeight;
  state.height = damp(state.height, stanceHeight, 13, dt);

  const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let wx = -Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe;
  let wz = -Math.cos(state.yaw) * forward - Math.sin(state.yaw) * strafe;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) {
    wx /= wl;
    wz /= wl;
  }

  let maxSpeed = state.prone
    ? SPEED.prone
    : state.crouch
      ? SPEED.crouch
      : state.sprint
        ? SPEED.sprint
        : SPEED.walk;
  if (state.reloading) maxSpeed *= RELOAD_MOVE_SCALE;
  maxSpeed *= 1 - ADS_MOVE_PENALTY * state.adsEase;
  maxSpeed *= state.speedScale;

  const accel = state.onGround ? PHYS.acceleration : PHYS.airAcceleration;
  if (wl > 0) {
    state.vel.x += wx * accel * dt;
    state.vel.z += wz * accel * dt;
  }
  if (state.onGround) {
    const sp = Math.hypot(state.vel.x, state.vel.z);
    if (sp > 0) {
      const drop = sp * PHYS.friction * dt * (wl > 0 ? 0.55 : 1);
      const k = Math.max(0, sp - drop) / sp;
      state.vel.x *= k;
      state.vel.z *= k;
    }
  }
  {
    const sp = Math.hypot(state.vel.x, state.vel.z);
    if (sp > maxSpeed) {
      const k = maxSpeed / sp;
      state.vel.x *= k;
      state.vel.z *= k;
    }
  }

  if (state.onGround) state.jumpsLeft = 1;
  let jumpedNow = false;
  if (input.jumpHeld && state.onGround && !state.crouch && !state.prone) {
    state.vel.y = PHYS.jumpVelocity * state.jumpScale;
    state.onGround = false;
    state.jumpsLeft = 1;
    jumpedNow = true;
    events.onJump?.();
  }
  if (!state.prone && !jumpedNow && !state.onGround && state.mantleT <= 0) {
    if (state.canMantle && input.jumpHeld && state.vel.y < 2.6) {
      const led = findMantle(state, world, STANCE.standHeight, STANCE.radius);
      if (led) beginMantle(state, led, events);
    }
    if (state.canDoubleJump && state.mantleT <= 0 && input.jumpPressed && state.jumpsLeft > 0) {
      state.jumpsLeft--;
      state.vel.y = PHYS.doubleJumpVelocity;
      events.onJump?.();
    }
  }

  state.vel.y += PHYS.gravity * dt;
  if (state.vel.y < -46) state.vel.y = -46;

  if (state.mantleT > 0) {
    state.mantleT += dt;
    const k = clamp(state.mantleT / state.mantleDur, 0, 1);
    const ku = easeOutCubic(clamp(k * 1.42, 0, 1));
    const kf = easeInOutCubic(clamp((k - 0.3) / 0.7, 0, 1));
    state.pos.y = lerp(state.mantleFrom.y, state.mantleTo.y, ku);
    state.pos.x = lerp(state.mantleFrom.x, state.mantleTo.x, kf);
    state.pos.z = lerp(state.mantleFrom.z, state.mantleTo.z, kf);
    state.vel.x = state.vel.y = state.vel.z = 0;
    state.mantleTilt = Math.sin(k * PI) * 0.085;
    if (k >= 1) {
      state.mantleT = 0;
      state.mantleTilt = 0;
      state.onGround = true;
      state.jumpsLeft = 1;
      events.onMantleEnd?.();
    } else state.onGround = false;
  } else {
    moveSlide(world, state.pos, state.vel.x * dt, state.vel.z * dt, STANCE.radius, state.height);
    world.clampHorizontal(state.pos, STANCE.radius + 0.44);

    const prevVy = state.vel.y;
    const prevY = state.pos.y;
    state.pos.y += state.vel.y * dt;
    if (state.vel.y > 0) {
      const ceil = world.ceilingY(state.pos.x, state.pos.z, state.pos.y + state.height);
      if (state.pos.y + state.height > ceil) {
        state.pos.y = ceil - state.height - 0.01;
        state.vel.y = 0;
      }
    }
    const step = state.onGround && state.vel.y <= 0 ? STEP_HEIGHT : 0;
    const gy = world.groundY(state.pos.x, state.pos.z, Math.max(prevY, state.pos.y) + step);
    const floorY = gy === null ? 0 : gy;
    if (state.pos.y <= floorY + 0.02) {
      if (!state.onGround && prevVy < -3) events.onLand?.(clamp(-prevVy / 16, 0, 1));
      state.pos.y = floorY;
      state.vel.y = 0;
      state.onGround = true;
    } else {
      state.onGround = false;
    }
  }

  {
    const y0 = state.pos.y + 0.3;
    const y1 = state.pos.y + state.height - 0.05;
    if (world.blocked(state.pos.x, state.pos.z, y0, y1, STANCE.radius))
      world.depenetrate(state.pos, STANCE.radius, y0, y1);
  }
}
