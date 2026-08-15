import * as THREE from 'three';
import type { LevelObstacle, P0Level } from './level';
import { SFX } from './sfx';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
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
  };

  yaw = 0;
  pitch = 0;
  private pos = new THREE.Vector3(0, 0, 82);
  private vel = new THREE.Vector3();
  private onGround = true;
  private bobT = 0;
  private stepPhase = 0;
  private baseFov = 72;

  constructor(level: P0Level) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.08, 260);
    this.camera.rotation.order = 'YXZ';
    this.snapToGround(level);
    this.applyView();
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }

  addYaw(delta: number) {
    this.yaw -= delta;
  }

  addPitch(delta: number) {
    this.pitch = THREE.MathUtils.clamp(this.pitch - delta, -1.45, 1.45);
  }

  update(dt: number, level: P0Level) {
    const input = this.input;
    const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = input.sprint ? 4.95 : 3.3;
    const wishX = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe;
    const wishZ = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe;
    const len = Math.hypot(wishX, wishZ) || 1;
    const moving = Math.hypot(wishX, wishZ) > 0.01;

    const accel = this.onGround ? 26 : 3;
    this.vel.x += (wishX / len) * speed * (moving ? accel : this.onGround ? 18 : 0) * dt;
    this.vel.z += (wishZ / len) * speed * (moving ? accel : this.onGround ? 18 : 0) * dt;
    if (!moving && this.onGround) {
      this.vel.x = THREE.MathUtils.damp(this.vel.x, 0, 12, dt);
      this.vel.z = THREE.MathUtils.damp(this.vel.z, 0, 12, dt);
    }
    const maxSpeed = input.sprint ? 5.4 : 3.9;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > maxSpeed) {
      this.vel.x *= maxSpeed / hv;
      this.vel.z *= maxSpeed / hv;
    }

    if (this.onGround && input.jump) {
      this.vel.y = 4.6;
      this.onGround = false;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (!this.onGround) this.vel.y -= 13.5 * dt;

    const { minX, maxX, minZ, maxZ } = level.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, minX, maxX);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, minZ, maxZ);

    for (const obstacle of level.obstacles) {
      this.collideCircle(obstacle);
    }

    const groundY = level.terrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + 0.82) {
      this.pos.y = groundY + 0.82;
      this.vel.y = 0;
      this.onGround = true;
    }

    this.bobT += dt * (moving ? (input.sprint ? 10.5 : 7.0) : 0);
    const bob = moving && this.onGround ? Math.sin(this.bobT) * 0.028 : 0;
    this.camera.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.applyView();

    /* Footsteps use the same procedural two-layer noise as the main game. */
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (moving && this.onGround && hSpeed > 0.4) {
      const prev = this.stepPhase;
      this.stepPhase += dt * hSpeed * (input.sprint ? 1.75 : 2.0);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) {
        const vol = input.sprint ? 1.0 : 0.65;
        const pan = THREE.MathUtils.clamp(Math.sin(this.stepPhase) * 0.35, -1, 1);
        SFX.footstep(vol, pan);
      }
    }

    if (input.sprint) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.baseFov + 4, 0.2);
    } else {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.baseFov, 0.2);
    }
    this.camera.updateProjectionMatrix();
  }

  snapToGround(level: P0Level) {
    this.pos.y = level.terrainHeight(this.pos.x, this.pos.z) + 0.82;
    this.camera.position.copy(this.pos);
  }

  resetPose(level: P0Level) {
    this.pos.set(0, 0, 82);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.06;
    this.onGround = true;
    this.snapToGround(level);
    this.applyView();
  }

  private collideCircle(obstacle: LevelObstacle) {
    const dx = this.pos.x - obstacle.x;
    const dz = this.pos.z - obstacle.z;
    const minDist = obstacle.r + 0.38;
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
