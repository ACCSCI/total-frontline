import * as THREE from 'three';
import {
  accumulateLook,
  createLocoState,
  createViewState,
  type LocoState,
  recoilImpulse,
  SPAWN_Z,
  stanceRecoilMultiplier,
  stanceRecoveryMultiplier,
  stepPlayer,
  type ViewState,
  type ViewWeapon,
} from '../../shared/gameplay';
import movementData from '../../shared/movement.json';
import type { P0Level } from './level';
import { SETTINGS } from './settings';
import { SFX } from './sfx';
import { makeCampaignWorld } from './world-query';

const SPEED = movementData.speeds;
const BASE_FOV = SETTINGS.baseFov;
const STAND_H = movementData.stance.standHeight;

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
}

export class FirstPersonPlayer {
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
  };

  spaceEdge = false;
  proneRequested = false;
  private loco: LocoState = createLocoState(0, 0, SPAWN_Z, STAND_H);
  private view: ViewState = createViewState(BASE_FOV, STAND_H);
  private pos = new THREE.Vector3(0, 0, SPAWN_Z);
  private lookForVm = { x: 0, y: 0 };

  constructor(level: P0Level) {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.14, 520);
    this.camera.rotation.order = 'YXZ';
    this.snapToGround(level);
    this.camera.rotation.set(this.view.pitch, this.view.yaw, 0);
  }

  get yaw() {
    return this.view.yaw;
  }
  get pitch() {
    return this.view.pitch;
  }
  get ads() {
    return this.view.ads;
  }
  set ads(v: boolean) {
    this.setAds(v);
  }
  get adsEase() {
    return this.view.adsEase;
  }
  get adsK() {
    return this.view.adsK;
  }
  get aimEase() {
    return this.view.adsEase;
  }
  get scoped() {
    return this.view.scoped;
  }
  get holdingBreath() {
    return this.view.breathHeld;
  }
  get breathLock() {
    return this.view.breathLock;
  }
  get breath() {
    return this.view.breath;
  }
  get crouch() {
    return this.loco.crouch;
  }
  get prone() {
    return this.loco.prone;
  }
  get height() {
    return this.loco.height;
  }
  get position(): THREE.Vector3 {
    this.pos.set(this.loco.pos.x, this.loco.pos.y, this.loco.pos.z);
    return this.pos;
  }
  get horizontalSpeed() {
    return Math.hypot(this.loco.vel.x, this.loco.vel.z);
  }
  get grounded() {
    return this.loco.onGround;
  }
  get sprint() {
    return this.loco.sprint;
  }
  get bob() {
    return this.view.stepPhase;
  }
  get bobAmp() {
    return this.view.bobAmp;
  }
  get verticalSpeed() {
    return this.loco.vel.y;
  }
  get mantleTilt() {
    return this.loco.mantleTilt;
  }
  get spreadRecoveryMultiplier() {
    return stanceRecoveryMultiplier(this.loco.prone, this.loco.crouch);
  }
  get stanceRecoilMultiplier() {
    return stanceRecoilMultiplier(this.loco.prone, this.loco.crouch);
  }

  addLook(dx: number, dy: number) {
    accumulateLook(this.view, dx, dy);
  }

  addShake(amount: number) {
    this.view.shake = Math.min(1.6, this.view.shake + amount);
  }

  setAds(on: boolean) {
    if (on === this.view.ads) return;
    this.view.ads = on;
    if (!on) {
      this.view.breathHeld = false;
      this.view.breathLock = false;
    }
  }

  get raisingFromSprint() {
    return this.loco.sprintFireRaise > 0;
  }

  cancelSprintForFire(shotgun: boolean) {
    if (!this.loco.sprint) return;
    this.loco.sprint = false;
    this.loco.sprintFireRaise = shotgun ? 0 : 0.11;
    this.input.sprint = false;
  }

  consumeLookDelta() {
    return this.lookForVm;
  }

  markSprintFire() {
    this.loco.sprintFireRaise = 0.11;
  }

  update(
    dt: number,
    level: P0Level,
    weapon: ViewWeapon,
    busy: { reloading: boolean; switching: boolean }
  ) {
    const jumpPressed = this.spaceEdge;
    this.spaceEdge = false;
    const pronePressed = this.proneRequested;
    this.proneRequested = false;

    this.lookForVm = { x: this.view.mouseDX, y: this.view.mouseDY };
    this.loco.reloading = busy.reloading;
    this.loco.canSprint = !this.view.ads && (!busy.reloading || !SETTINGS.sprintCancelsReload);
    this.loco.canProne = true;
    this.loco.canMantle = true;
    this.loco.canDoubleJump = true;
    this.loco.jumpScale = 1;
    this.loco.speedScale = 1;

    const pose = stepPlayer(
      dt,
      this.view,
      this.loco,
      weapon,
      { shiftDown: this.input.sprint, ...busy },
      SETTINGS.mouseSensitivity,
      BASE_FOV,
      {
        forward: this.input.forward,
        back: this.input.back,
        left: this.input.left,
        right: this.input.right,
        sprint: this.input.sprint,
        jumpHeld: this.input.jump,
        jumpPressed,
        crouch: this.input.crouch,
        pronePressed,
      },
      makeCampaignWorld(level),
      movementData,
      SPEED.walk,
      performance.now() * 0.001,
      { left: this.input.left, right: this.input.right },
      {
        onJump: () => {
          SFX.jump();
          if (this.loco.jumpsLeft === 0) this.view.shake = Math.min(1.2, this.view.shake + 0.1);
        },
        onLand: (f) => {
          this.view.landShake = f * 0.9;
          this.view.shake = Math.min(1.5, this.view.shake + f * 0.55);
          SFX.land(f);
        },
        onMantleStart: () => SFX.footstep(0.5, 0),
        onMantleEnd: () => SFX.footstep(0.7, 0),
      }
    );
    if (pose.footstep) {
      if (level.waterDepth(pose.x, pose.z) > 0.02) {
        SFX.waterStep(pose.footstep.vol, pose.footstep.pan);
        level.spawnWaterSplashAt(
          new THREE.Vector3(pose.x, level.groundY(pose.x, pose.z) + 0.03, pose.z)
        );
      } else {
        SFX.footstep(pose.footstep.vol, pose.footstep.pan);
      }
    }
    this.camera.position.set(pose.x, pose.y, pose.z);
    this.camera.rotation.set(pose.pitch, pose.yaw, pose.roll);
    if (Math.abs(this.camera.fov - pose.fov) > 0.005) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  snapToGround(level: P0Level) {
    this.loco.pos.y = level.groundY(this.loco.pos.x, this.loco.pos.z);
    this.view.eye = this.loco.height * 0.92;
    this.camera.position.set(this.loco.pos.x, this.loco.pos.y + this.view.eye, this.loco.pos.z);
  }

  resetPose(level: P0Level) {
    this.input.crouch = false;
    this.restorePose(0, SPAWN_Z, 0, level);
  }

  restorePose(x: number, z: number, yaw: number, level: P0Level) {
    this.loco = createLocoState(x, 0, z, STAND_H);
    this.loco.yaw = yaw;
    this.view = createViewState(BASE_FOV, STAND_H);
    this.view.yaw = yaw;
    this.spaceEdge = false;
    this.proneRequested = false;
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    this.snapToGround(level);
    this.camera.rotation.set(this.view.pitch, this.view.yaw, 0);
  }

  applyRecoil(
    camPitch: number,
    camYaw: number,
    fovKick: number,
    scale: number,
    burst: number,
    shakeAmt = 0
  ) {
    const kick = recoilImpulse(
      camPitch,
      camYaw,
      fovKick,
      scale,
      burst,
      shakeAmt,
      this.view.adsEase
    );
    this.view.recoilVelP += kick.velP;
    this.view.recoilVelY += kick.velY;
    this.view.fovKick = Math.min(3.2, this.view.fovKick + kick.fovKick);
    this.view.shake = Math.min(1.4, this.view.shake + kick.shake);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
