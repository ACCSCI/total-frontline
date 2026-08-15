import * as THREE from 'three';
import movementData from '../../shared/movement.json';
import type { LevelObstacle, P0Level } from './level';
import { SFX } from './sfx';

const SPEED = movementData.speeds;
const PHYS = movementData.physics;
const STANCE = movementData.stance;

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

  yaw = 0;
  pitch = 0;
  proneRequested = false;
  crouch = false;
  prone = false;
  height = STANCE.standHeight;
  aimEase = 0;
  adsFov = STANCE.baseFov;
  scoped = false;
  lookScale = 1;
  canSprint = true;
  reloadMoveScale = 1;
  private swayT = 0;
  private swayAmp = 1;
  private breath = 0;
  private breathHeld = false;
  private breathLock = false;
  recoilPitch = 0;
  recoilYaw = 0;
  recoilVelP = 0;
  recoilVelY = 0;
  fovKick = 0;
  shake = 0;
  landShake = 0;
  private pos = new THREE.Vector3(0, 0, 82);
  private vel = new THREE.Vector3();
  private onGround = true;
  private jumpHeld = false;
  private jumpsLeft = 1;
  private bobAmp = 0;
  private stepPhase = 0;
  private eye = STANCE.standHeight * 0.92;
  private hipFov = STANCE.baseFov;
  private baseFov = STANCE.baseFov;

  constructor(level: P0Level) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.08, 260);
    this.camera.rotation.order = 'YXZ';
    this.snapToGround(level);
    this.applyView();
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get grounded(): boolean {
    return this.onGround;
  }

  get verticalSpeed(): number {
    return this.vel.y;
  }

  /** Single-player stance spread recovery: prone/crouch settle the cone faster. */
  get spreadRecoveryMultiplier(): number {
    return this.prone ? 1.65 : this.crouch ? 1.28 : 1;
  }

  /** Single-player stance recoil multiplier, also used by the campaign cone. */
  get stanceRecoilMultiplier(): number {
    return this.prone ? 0.56 : this.crouch ? 0.8 : 1;
  }

  addYaw(delta: number) {
    this.yaw -= delta * this.lookScale;
  }

  addPitch(delta: number) {
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - delta * this.lookScale,
      -Math.PI / 2 + 0.02,
      Math.PI / 2 - 0.02
    );
  }

  setLookScale(scale: number) {
    this.lookScale = THREE.MathUtils.clamp(scale, 0.18, 1);
  }

  update(dt: number, level: P0Level) {
    const input = this.input;
    const wasGrounded = this.onGround;

    /* stance: Z toggles prone, Alt toggles crouch; standing requires headroom
       and is skipped when there is no real ceiling in this graybox map. */
    if (this.proneRequested) {
      this.proneRequested = false;
      if (this.prone) {
        this.prone = false;
      } else {
        this.prone = true;
        this.crouch = false;
      }
    } else if (input.crouch) {
      if (this.prone) this.prone = false;
      this.crouch = true;
    } else if (this.crouch) {
      this.crouch = false;
    }
    const wantSprint =
      input.sprint && this.canSprint && !this.crouch && !this.prone && input.forward;
    const stanceHeight = this.prone
      ? STANCE.proneHeight
      : this.crouch
        ? STANCE.crouchHeight
        : STANCE.standHeight;
    this.height = THREE.MathUtils.damp(this.height, stanceHeight, 13, dt);

    const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const wishX = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe;
    const wishZ = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe;
    const wl = Math.hypot(wishX, wishZ);
    const moving = wl > 0.01;
    let maxSpeed =
      (this.prone
        ? SPEED.prone
        : this.crouch
          ? SPEED.crouch
          : wantSprint
            ? SPEED.sprint
            : SPEED.walk) *
      this.reloadMoveScale *
      (1 - 0.4 * this.aimEase);

    const accel = this.onGround ? PHYS.acceleration : PHYS.airAcceleration;
    if (moving) {
      this.vel.x += (wishX / (wl || 1)) * accel * dt;
      this.vel.z += (wishZ / (wl || 1)) * accel * dt;
    }
    if (this.onGround) {
      const sp = this.horizontalSpeed;
      if (sp > 0) {
        const drop = sp * PHYS.friction * dt * (moving ? 0.55 : 1.0);
        const k = Math.max(0, sp - drop) / sp;
        this.vel.x *= k;
        this.vel.z *= k;
      }
    }
    const hv = this.horizontalSpeed;
    if (hv > maxSpeed) {
      const k = maxSpeed / hv;
      this.vel.x *= k;
      this.vel.z *= k;
    }

    /* Jumping is hold-driven like the single-player update, so a held Space
       keeps hopping on landing. The second air hop stays edge-triggered. */
    const jumpPressed = input.jump && !this.jumpHeld;
    this.jumpHeld = input.jump;
    if (this.onGround) this.jumpsLeft = 1;
    let jumpedNow = false;
    if (input.jump && this.onGround && !this.crouch && !this.prone) {
      this.vel.y = PHYS.jumpVelocity;
      this.onGround = false;
      this.jumpsLeft = 1;
      jumpedNow = true;
      SFX.jump();
    } else if (!jumpedNow && !this.onGround && jumpPressed && this.jumpsLeft > 0 && !this.prone) {
      this.jumpsLeft--;
      this.vel.y = PHYS.doubleJumpVelocity;
      SFX.jump();
      this.shake = Math.min(1.2, this.shake + 0.1);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.vel.y += PHYS.gravity * dt;
    if (this.vel.y < -46) this.vel.y = -46;
    const prevVy = this.vel.y;
    this.pos.y += this.vel.y * dt;

    const { minX, maxX, minZ, maxZ } = level.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, minX, maxX);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, minZ, maxZ);

    for (const obstacle of level.obstacles) {
      this.collideCircle(obstacle);
    }

    const groundY = level.groundY(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + 0.02) {
      if (!wasGrounded && prevVy < -3) {
        const f = THREE.MathUtils.clamp(-prevVy / 16, 0, 1);
        this.landShake = f * 0.9;
        this.shake = Math.min(1.5, this.shake + f * 0.55);
        SFX.land(f);
      }
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    /* Head bob is the same two-axis, amplitude-smoothed bob as single-player. */
    const hSpeed = this.horizontalSpeed;
    const walking = hSpeed > 0.6 && this.onGround;
    this.bobAmp = THREE.MathUtils.damp(
      this.bobAmp,
      walking ? THREE.MathUtils.clamp(hSpeed / SPEED.walk, 0, 1.5) : 0,
      9,
      dt
    );
    if (walking) {
      const prev = this.stepPhase;
      this.stepPhase += dt * hSpeed * (this.prone ? 0.72 : this.crouch ? 1.05 : 1.42);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) {
        const vol = wantSprint ? 1.15 : this.prone ? 0.18 : this.crouch ? 0.35 : 0.8;
        SFX.footstep(vol, THREE.MathUtils.clamp(Math.sin(this.stepPhase) * 0.35, -1, 1));
      }
    }
    const bobY = Math.sin(this.stepPhase * 2) * 0.032 * this.bobAmp;
    const bobX = Math.sin(this.stepPhase) * 0.036 * this.bobAmp;
    const bobR = Math.sin(this.stepPhase) * 0.01 * this.bobAmp;
    this.eye = THREE.MathUtils.damp(this.eye, this.height * 0.92, 16, dt);

    /* Recoil and camera shake are the same damped springs as single-player. */
    this.recoilVelP = THREE.MathUtils.damp(this.recoilVelP, 0, 16, dt);
    this.recoilVelY = THREE.MathUtils.damp(this.recoilVelY, 0, 16, dt);
    this.recoilPitch += this.recoilVelP * dt;
    this.recoilYaw += this.recoilVelY * dt;
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 6.5, dt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 6.5, dt);
    this.fovKick = THREE.MathUtils.damp(this.fovKick, 0, 13, dt);
    this.shake = THREE.MathUtils.damp(this.shake, 0, 7.5, dt);
    this.landShake = THREE.MathUtils.damp(this.landShake, 0, 9, dt);

    /* Scoped breathing is the single-player hold-breath sway cycle. */
    this.swayT += dt;
    if (this.scoped && input.sprint && !this.breathLock && this.breath <= 0) {
      this.breath = 3;
      this.breathHeld = true;
    }
    if (!input.sprint) this.breathLock = false;
    if (this.breath > 0) {
      this.breath -= dt;
      if (!input.sprint || !this.scoped) {
        this.breath = 0;
        this.breathHeld = false;
      } else if (this.breath <= 0) {
        this.breathHeld = false;
        this.breathLock = true;
      }
    } else {
      this.breathHeld = false;
    }
    this.swayAmp = THREE.MathUtils.damp(
      this.swayAmp,
      this.breathHeld ? 0.04 : 1,
      this.breathHeld ? 9 : 3.4,
      dt
    );
    let scopeSwayX = 0;
    let scopeSwayY = 0;
    if (this.scoped && this.aimEase > 0.02) {
      const a = 0.0125 * this.aimEase * this.swayAmp * (this.prone ? 0.45 : this.crouch ? 0.72 : 1);
      scopeSwayX = Math.sin(this.swayT * 0.62) * a + Math.sin(this.swayT * 1.13 + 1.7) * a * 0.3;
      scopeSwayY =
        Math.sin(this.swayT * 0.47 + 2.2) * a * 0.72 + Math.sin(this.swayT * 0.91) * a * 0.22;
    }

    const t = performance.now() * 0.001;
    const sX = (Math.sin(t * 57.3) + Math.sin(t * 31.1)) * 0.5 * this.shake * 0.03;
    const sY = (Math.sin(t * 43.7 + 1) + Math.sin(t * 67.3)) * 0.5 * this.shake * 0.03;
    const sR = Math.sin(t * 39.9 + 2) * this.shake * 0.016;
    /* ADS pins bob, sway and shake down exactly like single-player. */
    const steady = 1 - 0.82 * this.aimEase;
    this.camera.position.set(
      this.pos.x + (bobX * 0.4 + sX) * steady,
      this.pos.y + this.eye + (bobY + sY) * steady - this.landShake * 0.16,
      this.pos.z + sX * 0.5 * steady
    );
    this.camera.rotation.set(
      this.pitch + this.recoilPitch - this.landShake * 0.1 + sY * 0.6 * steady + scopeSwayY,
      this.yaw + this.recoilYaw + scopeSwayX,
      (bobR + sR) * steady
    );

    const hipFov =
      this.baseFov +
      (wantSprint && hSpeed > 4.5 ? 7.5 : 0) +
      THREE.MathUtils.clamp(hSpeed - 5, 0, 3) * 0.6;
    this.hipFov = THREE.MathUtils.damp(this.hipFov, hipFov, 7, dt);
    this.camera.fov =
      THREE.MathUtils.lerp(this.hipFov, this.adsFov, this.aimEase) +
      this.fovKick * (1 - this.aimEase * 0.75);
    this.camera.updateProjectionMatrix();
  }

  snapToGround(level: P0Level) {
    this.pos.y = level.groundY(this.pos.x, this.pos.z);
    this.eye = this.height * 0.92;
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  resetPose(level: P0Level) {
    this.pos.set(0, 0, 82);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.06;
    this.onGround = true;
    this.jumpHeld = false;
    this.jumpsLeft = 1;
    this.proneRequested = false;
    this.crouch = false;
    this.prone = false;
    this.height = STANCE.standHeight;
    this.aimEase = 0;
    this.adsFov = STANCE.baseFov;
    this.scoped = false;
    this.lookScale = 1;
    this.canSprint = true;
    this.reloadMoveScale = 1;
    this.swayT = 0;
    this.swayAmp = 1;
    this.breath = 0;
    this.breathHeld = false;
    this.breathLock = false;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilVelP = 0;
    this.recoilVelY = 0;
    this.fovKick = 0;
    this.shake = 0;
    this.landShake = 0;
    this.bobAmp = 0;
    this.stepPhase = 0;
    this.hipFov = STANCE.baseFov;
    this.camera.fov = STANCE.baseFov;
    this.camera.updateProjectionMatrix();
    this.snapToGround(level);
    this.applyView();
  }

  private collideCircle(obstacle: LevelObstacle) {
    const dx = this.pos.x - obstacle.x;
    const dz = this.pos.z - obstacle.z;
    const minDist = obstacle.r + STANCE.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minDist * minDist || d2 < 1e-6) return;
    const d = Math.sqrt(d2);
    this.pos.x = obstacle.x + (dx / d) * minDist;
    this.pos.z = obstacle.z + (dz / d) * minDist;
  }

  private applyView() {
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0);
  }

  applyRecoil(
    camPitch: number,
    camYaw: number,
    fovKick: number,
    scale: number,
    burst: number,
    shakeAmt = 0
  ) {
    const vert = burst === 0 ? 1.55 : burst < 4 ? 1.12 : 0.82 + Math.sin(burst * 0.9) * 0.1;
    const drift = Math.sin(burst * 0.62) * 0.85 + Math.sin(burst * 0.23 + 1.1) * 0.45;
    this.recoilVelP += camPitch * 38 * vert * scale;
    this.recoilVelY += (drift + (Math.random() - 0.5) * 0.55) * camYaw * 38 * scale;
    this.fovKick = Math.min(3.2, this.fovKick + fovKick * scale);
    this.shake = Math.min(
      1.4,
      this.shake + shakeAmt * 0.5 * THREE.MathUtils.lerp(1, 0.68, this.aimEase)
    );
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
