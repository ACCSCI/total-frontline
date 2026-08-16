/* Extracted from the verified single-player update in src/23-player-update.ts.
   Campaign and legacy both call these functions; hosts only supply world/input. */
import { clamp, damp, easeInOutCubic, lerp, PI } from './math';
import { stepLocomotion } from './movement';
import type { LocoEvents, LocoInput, LocoState, MovementTuning, WorldQuery } from './types';

export const LOOK_SENS = 0.0022;
export const BREATH_TIME = 3;

export interface ViewWeapon {
  adsTime: number;
  adsFov: number;
  scope?: boolean;
  bracedAim?: boolean;
}

export interface ViewState {
  yaw: number;
  pitch: number;
  recoilPitch: number;
  recoilYaw: number;
  recoilVelP: number;
  recoilVelY: number;
  fovKick: number;
  shake: number;
  landShake: number;
  shakeSeed: number;
  ads: boolean;
  adsK: number;
  adsEase: number;
  scoped: boolean;
  breath: number;
  breathHeld: boolean;
  breathLock: boolean;
  swayT: number;
  swayAmp: number;
  scopeSwayX: number;
  scopeSwayY: number;
  bobAmp: number;
  stepPhase: number;
  eye: number;
  hipFov: number;
  fov: number;
  sensScale: number;
  mouseDX: number;
  mouseDY: number;
}

export interface ViewPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  fov: number;
  footstep: { vol: number; pan: number } | null;
}

export function createViewState(baseFov: number, standHeight: number): ViewState {
  return {
    yaw: 0,
    pitch: -0.06,
    recoilPitch: 0,
    recoilYaw: 0,
    recoilVelP: 0,
    recoilVelY: 0,
    fovKick: 0,
    shake: 0,
    landShake: 0,
    shakeSeed: Math.random() * 100,
    ads: false,
    adsK: 0,
    adsEase: 0,
    scoped: false,
    breath: 0,
    breathHeld: false,
    breathLock: false,
    swayT: 0,
    swayAmp: 1,
    scopeSwayX: 0,
    scopeSwayY: 0,
    bobAmp: 0,
    stepPhase: 0,
    eye: standHeight * 0.92,
    hipFov: baseFov,
    fov: baseFov,
    sensScale: 1,
    mouseDX: 0,
    mouseDY: 0,
  };
}

export function accumulateLook(view: ViewState, dx: number, dy: number) {
  view.mouseDX = clamp(view.mouseDX + clamp(dx || 0, -90, 90), -180, 180);
  view.mouseDY = clamp(view.mouseDY + clamp(dy || 0, -90, 90), -180, 180);
}

/** Single-player look / ADS / breath. Mouse is applied once per frame. */
export function stepLook(
  dt: number,
  view: ViewState,
  weapon: ViewWeapon,
  opts: { shiftDown: boolean; reloading: boolean; switching: boolean; dead?: boolean },
  mouseSens: number,
  baseFov: number
) {
  view.yaw -= view.mouseDX * LOOK_SENS * mouseSens * view.sensScale;
  view.pitch -= view.mouseDY * LOOK_SENS * mouseSens * view.sensScale;
  view.pitch = clamp(view.pitch, -PI / 2 + 0.02, PI / 2 - 0.02);
  view.mouseDX = 0;
  view.mouseDY = 0;

  view.recoilVelP = damp(view.recoilVelP, 0, 16, dt);
  view.recoilVelY = damp(view.recoilVelY, 0, 16, dt);
  view.recoilPitch += view.recoilVelP * dt;
  view.recoilYaw += view.recoilVelY * dt;
  view.recoilPitch = damp(view.recoilPitch, 0, 6.5, dt);
  view.recoilYaw = damp(view.recoilYaw, 0, 6.5, dt);

  if (view.ads && (opts.reloading || opts.dead)) view.ads = false;
  const adsWant = view.ads && !opts.switching;
  const adsSpeed = 1 / (weapon.adsTime || 0.2);
  view.adsK = clamp(view.adsK + (adsWant ? adsSpeed : -adsSpeed) * dt, 0, 1);
  view.adsEase = easeInOutCubic(view.adsK);
  view.scoped = !!weapon.scope && view.adsEase > 0.55;

  if (view.scoped && opts.shiftDown && !view.breathLock && view.breath <= 0) {
    view.breath = BREATH_TIME;
    view.breathHeld = true;
  }
  if (!opts.shiftDown) view.breathLock = false;
  if (view.breath > 0) {
    view.breath -= dt;
    if (!opts.shiftDown || !view.scoped) {
      view.breath = 0;
      view.breathHeld = false;
    } else if (view.breath <= 0) {
      view.breathHeld = false;
      view.breathLock = true;
    }
  } else view.breathHeld = false;

  view.swayT += dt;
  view.swayAmp = damp(view.swayAmp, view.breathHeld ? 0.04 : 1, view.breathHeld ? 9 : 3.4, dt);

  view.sensScale = lerp(
    1,
    weapon.bracedAim
      ? 1
      : clamp(Math.tan((weapon.adsFov * PI) / 360) / Math.tan((baseFov * PI) / 360), 0.18, 1),
    view.adsEase
  );
}

/** Single-player bob, footsteps and camera pose. */
export function stepView(
  dt: number,
  view: ViewState,
  loco: LocoState,
  weapon: ViewWeapon,
  walkSpeed: number,
  baseFov: number,
  nowSec: number,
  keys: { left: boolean; right: boolean },
  jug = false
): ViewPose {
  const hSpeed = Math.hypot(loco.vel.x, loco.vel.z);
  const moving = hSpeed > 0.6 && loco.onGround;
  view.bobAmp = damp(view.bobAmp, moving ? clamp(hSpeed / walkSpeed, 0, 1.5) : 0, 9, dt);
  let footstep: ViewPose['footstep'] = null;
  if (moving) {
    const prev = view.stepPhase;
    view.stepPhase += dt * hSpeed * (jug ? 0.92 : loco.prone ? 0.72 : loco.crouch ? 1.05 : 1.42);
    if (Math.floor(prev / PI) !== Math.floor(view.stepPhase / PI)) {
      const vol = jug ? 1.25 : loco.prone ? 0.18 : loco.crouch ? 0.35 : loco.sprint ? 1.15 : 0.8;
      footstep = { vol, pan: clamp(Math.sin(view.stepPhase) * 0.35, -1, 1) };
    }
  }

  view.shake = damp(view.shake, 0, 7.5, dt);
  view.landShake = damp(view.landShake, 0, 9, dt);
  view.eye = damp(view.eye, loco.height * 0.92, 16, dt);
  view.fovKick = damp(view.fovKick, 0, 13, dt);

  const bobY = Math.sin(view.stepPhase * 2) * 0.032 * view.bobAmp;
  const bobX = Math.sin(view.stepPhase) * 0.036 * view.bobAmp;
  const bobR = Math.sin(view.stepPhase) * 0.01 * view.bobAmp;
  const shk = view.shake;
  const sX =
    (Math.sin(nowSec * 57.3 + view.shakeSeed) + Math.sin(nowSec * 31.1)) * 0.5 * shk * 0.03;
  const sY =
    (Math.sin(nowSec * 43.7 + view.shakeSeed * 2) + Math.sin(nowSec * 67.3)) * 0.5 * shk * 0.03;
  const sR = Math.sin(nowSec * 39.9 + view.shakeSeed * 3) * shk * 0.016;
  const steady = 1 - 0.82 * view.adsEase;
  const stance = loco.prone ? 0.45 : loco.crouch ? 0.72 : 1;
  view.scopeSwayX = 0;
  view.scopeSwayY = 0;
  if (weapon.scope && view.adsEase > 0.02) {
    const a = 0.0125 * view.adsEase * view.swayAmp * stance;
    view.scopeSwayX = Math.sin(view.swayT * 0.62) * a + Math.sin(view.swayT * 1.13 + 1.7) * a * 0.3;
    view.scopeSwayY =
      Math.sin(view.swayT * 0.47 + 2.2) * a * 0.72 + Math.sin(view.swayT * 0.91) * a * 0.22;
  }

  const hipTarget = jug
    ? 68
    : baseFov + (loco.sprint && hSpeed > 4.5 ? 7.5 : 0) + clamp(hSpeed - 5, 0, 3) * 0.6;
  view.hipFov = damp(view.hipFov, hipTarget, 7, dt);
  const aimFov = weapon.bracedAim ? view.hipFov : weapon.adsFov;
  view.fov = lerp(view.hipFov, aimFov, view.adsEase) + view.fovKick * (1 - view.adsEase * 0.75);

  return {
    x: loco.pos.x + (bobX * 0.4 + sX) * steady,
    y: loco.pos.y + view.eye + (bobY + sY) * steady - view.landShake * 0.16,
    z: loco.pos.z + sX * 0.5 * steady,
    pitch:
      view.pitch +
      view.recoilPitch -
      view.landShake * 0.1 -
      (loco.mantleTilt || 0) +
      sY * 0.6 * steady +
      view.scopeSwayY,
    yaw: view.yaw + view.recoilYaw + view.scopeSwayX,
    roll: (bobR + sR) * steady + ((keys.left ? 0.014 : 0) - (keys.right ? 0.014 : 0)) * steady,
    fov: view.fov,
    footstep,
  };
}

/** Single-player look + feet + camera, in that order. Hosts only bind world/input. */
export function stepPlayer(
  dt: number,
  view: ViewState,
  loco: LocoState,
  weapon: ViewWeapon,
  lookOpts: { shiftDown: boolean; reloading: boolean; switching: boolean; dead?: boolean },
  mouseSens: number,
  baseFov: number,
  input: LocoInput,
  world: WorldQuery,
  movement: MovementTuning,
  walkSpeed: number,
  nowSec: number,
  lean: { left: boolean; right: boolean },
  events: LocoEvents,
  jug = false
): ViewPose {
  stepLook(dt, view, weapon, lookOpts, mouseSens, baseFov);
  loco.yaw = view.yaw;
  loco.ads = view.ads;
  loco.adsEase = view.adsEase;
  stepLocomotion(dt, loco, input, world, movement, events);
  return stepView(dt, view, loco, weapon, walkSpeed, baseFov, nowSec, lean, jug);
}
