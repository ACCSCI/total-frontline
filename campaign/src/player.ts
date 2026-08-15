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
  private pos = new THREE.Vector3(0, 0, 82);
  private vel = new THREE.Vector3();
  private onGround = true;
  private jumpHeld = false;
  private bobT = 0;
  private stepPhase = 0;
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

  addYaw(delta: number) {
    this.yaw -= delta;
  }

  addPitch(delta: number) {
    this.pitch = THREE.MathUtils.clamp(this.pitch - delta, -1.45, 1.45);
  }

  update(dt: number, level: P0Level) {
    const input = this.input;

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
    const wantSprint = input.sprint && !this.crouch && !this.prone && input.forward;
    const stanceHeight = this.prone
      ? STANCE.proneHeight
      : this.crouch
        ? STANCE.crouchHeight
        : STANCE.standHeight;
    this.height = THREE.MathUtils.damp(this.height, stanceHeight, 13, dt);

    const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxSpeed = this.prone
      ? SPEED.prone
      : this.crouch
        ? SPEED.crouch
        : wantSprint
          ? SPEED.sprint
          : SPEED.walk;
    const wishX = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe;
    const wishZ = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe;
    const len = Math.hypot(wishX, wishZ) || 1;
    const moving = Math.hypot(wishX, wishZ) > 0.01;

    const accel = this.onGround ? PHYS.acceleration : PHYS.airAcceleration;
    if (moving) {
      this.vel.x += (wishX / len) * accel * dt;
      this.vel.z += (wishZ / len) * accel * dt;
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
      this.vel.x *= maxSpeed / hv;
      this.vel.z *= maxSpeed / hv;
    }

    const jumpPressed = input.jump && !this.jumpHeld;
    this.jumpHeld = input.jump;
    if (this.onGround && jumpPressed && !this.crouch && !this.prone) {
      this.vel.y = PHYS.jumpVelocity;
      this.onGround = false;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (!this.onGround) {
      this.vel.y += PHYS.gravity * dt;
      if (this.vel.y < -46) this.vel.y = -46;
    }

    const { minX, maxX, minZ, maxZ } = level.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, minX, maxX);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, minZ, maxZ);

    for (const obstacle of level.obstacles) {
      this.collideCircle(obstacle);
    }

    const groundY = level.terrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + this.height * 0.5 + 0.02) {
      this.pos.y = groundY + this.height * 0.5;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.bobT += dt * (moving ? (wantSprint ? 10 : this.crouch ? 6 : 7) : 0);
    const bob = moving && this.onGround ? Math.sin(this.bobT) * 0.028 : 0;
    const eye = this.pos.y + this.height * 0.92 + bob;
    this.camera.position.set(this.pos.x, eye, this.pos.z);
    this.applyView();

    if (moving && this.onGround && this.horizontalSpeed > 0.6) {
      const prev = this.stepPhase;
      const stepRate = this.prone ? 0.72 : this.crouch ? 1.05 : 1.42;
      this.stepPhase += dt * this.horizontalSpeed * stepRate;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) {
        const vol = wantSprint ? 1.15 : this.prone ? 0.18 : this.crouch ? 0.35 : 0.8;
        const pan = THREE.MathUtils.clamp(Math.sin(this.stepPhase) * 0.35, -1, 1);
        SFX.footstep(vol, pan);
      }
    }

    const fovTarget = wantSprint && this.horizontalSpeed > 4.5 ? this.baseFov + 7.5 : this.baseFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fovTarget, 0.2);
    this.camera.updateProjectionMatrix();
  }

  snapToGround(level: P0Level) {
    this.pos.y = level.terrainHeight(this.pos.x, this.pos.z) + this.height * 0.5;
    this.camera.position.set(this.pos.x, this.pos.y + this.height * 0.92, this.pos.z);
  }

  resetPose(level: P0Level) {
    this.pos.set(0, 0, 82);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.06;
    this.onGround = true;
    this.jumpHeld = false;
    this.proneRequested = false;
    this.crouch = false;
    this.prone = false;
    this.height = STANCE.standHeight;
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
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
