import * as THREE from 'three';
import {
  createMissionState,
  enterZone,
  infiltrationMode,
  interactVega,
  type MissionState,
  RADIO,
  spawnApcPressure,
  stepApc,
  takeCommsModule,
  teachNightVision,
  tickVegaThreat,
  toggleNightVision,
  triggerFuelBlast,
  triggerLightningReroute,
} from '../../shared/gameplay';
import missionsData from '../../shared/missions.json';
import type { Enemy } from './campaign';
import { showHudToast } from './combat-hud';
import { spawnExplosion } from './fx';
import type { P0Level } from './level';
import {
  makeApcMesh,
  makeBurnBlock,
  makeExfilVehicle,
  makeModuleMarker,
} from './mission-world';
import { animateVega, makeVegaModel } from './vega';
import type { FirstPersonPlayer } from './player';
import { SFX } from './sfx';

const pts = (
  missionsData.mission01 as {
    interactives: {
      vega: { x: number; z: number };
      module: { x: number; z: number };
      fuel: { x: number; z: number };
      exfil?: { x: number; z: number };
    };
  }
).interactives;
const exfilPos = pts.exfil || { x: 0, z: -985 };

export class MissionRuntime {
  readonly state: MissionState = createMissionState();
  vega: THREE.Group;
  module: THREE.Object3D;
  burn: THREE.Group;
  apc: THREE.Group;
  exfil: THREE.Group;
  readonly drone: THREE.Group;
  private scene: THREE.Scene;
  private level: P0Level;
  private radioEl = document.getElementById('radioLine') as HTMLDivElement | null;
  private nvEl = document.getElementById('nvOverlay') as HTMLDivElement | null;
  private toastEl = document.getElementById('p0Toast') as HTMLDivElement | null;
  private burnLight: THREE.PointLight | null = null;
  private fuelFire: THREE.PointLight | null = null;
  private vegaTime = 0;

  constructor(scene: THREE.Scene, level: P0Level) {
    this.scene = scene;
    this.level = level;
    this.vega = makeVegaModel(level);
    this.module = makeModuleMarker(level);
    this.burn = makeBurnBlock(level);
    this.apc = makeApcMesh();
    this.apc.position.set(0, level.groundY(0, -720) + 0.02, -720);
    this.apc.visible = true;
    this.exfil = makeExfilVehicle(level);
    this.drone = new THREE.Group();
    this.drone.name = 'P0_UNKNOWN_DRONE';
    const droneBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5, metalness: 0.6 })
    );
    const droneArm = new THREE.BoxGeometry(1.5, 0.05, 0.12);
    for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]] as Array<[number, number]>) {
      const arm = new THREE.Mesh(droneArm, droneBody.material);
      arm.rotation.y = rx || rz;
      this.drone.add(arm);
    }
    for (let i = 0; i < 4; i++) {
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.02, 6),
        droneBody.material
      );
      rotor.name = 'droneRotor';
      const a = (i / 4) * Math.PI * 2;
      rotor.position.set(Math.cos(a) * 0.7, 0.08, Math.sin(a) * 0.7);
      this.drone.add(rotor);
    }
    const droneEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff1d14,
        emissive: 0xff1208,
        emissiveIntensity: 2.4,
      })
    );
    droneEye.position.set(0, -0.1, -0.32);
    this.drone.add(droneEye);
    const droneLight = new THREE.PointLight(0xff2018, 0, 14, 1.4);
    droneLight.position.set(0, -0.2, -0.4);
    this.drone.add(droneLight);
    const laser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.06, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2418,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    laser.name = 'droneLaser';
    laser.visible = false;
    this.drone.add(laser);
    const laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff1d14,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    laserDot.name = 'droneLaserDot';
    laserDot.visible = false;
    this.drone.add(laserDot);
    this.drone.position.set(0, 46, -1260);
    this.drone.visible = false;
    this.fuelFire = new THREE.PointLight(0xff6a28, 0, 18, 1.4);
    this.fuelFire.position.set(pts.fuel.x, level.groundY(pts.fuel.x, pts.fuel.z) + 1.1, pts.fuel.z);
    this.burnLight = new THREE.PointLight(0xff6a28, 0, 16, 1.6);
    this.burnLight.position.set(-2.2, level.groundY(-2.2, -520) + 1.2, -520);
    scene.add(this.vega, this.module, this.burn, this.apc, this.exfil, this.drone, this.fuelFire, this.burnLight);
    level.addObstacle(exfilPos.x, exfilPos.z, 3.2);
    teachNightVision(this.state);
    this.pushRadio();
  }

  pushRadio() {
    if (this.radioEl) this.radioEl.textContent = this.state.radio;
  }

  toggleNv() {
    const on = toggleNightVision(this.state);
    if (this.nvEl) this.nvEl.classList.toggle('on', on);
    this.pushRadio();
    return on;
  }

  tryInteract(player: FirstPersonPlayer) {
    const p = player.position;
    const dv = Math.hypot(p.x - pts.vega.x, p.z - pts.vega.z);
    const dm = Math.hypot(p.x - pts.module.x, p.z - pts.module.z);
    const df = Math.hypot(p.x - pts.fuel.x, p.z - pts.fuel.z);
    if (interactVega(this.state, dv)) {
      this.pushRadio();
      return '解救 VEGA';
    }
    if (takeCommsModule(this.state, dm)) {
      this.module.visible = false;
      this.pushRadio();
      return '取得通讯模块';
    }
    if (triggerFuelBlast(this.state, df < 3.2)) {
      this.state.apc.speed = 2.7;
      this.pushRadio();
      return 'fuel-blast';
    }
    const de = Math.hypot(p.x - exfilPos.x, p.z - exfilPos.z);
    if (
      this.state.vegaRescued &&
      this.state.moduleTaken &&
      !this.state.flags.exfilBoarded &&
      de < 6.5
    ) {
      this.state.flags.exfilBoarded = true;
      this.state.radio = RADIO.exfil;
      this.vega.visible = false;
      this.pushRadio();
      return 'exfil';
    }
    return '';
  }

  explodeFuel(enemies: Enemy[], killEnemy: (enemy: Enemy) => void, player?: FirstPersonPlayer) {
    player?.addShake(0.75);
    const pos = new THREE.Vector3(
      pts.fuel.x,
      this.level.groundY(pts.fuel.x, pts.fuel.z) + 1.1,
      pts.fuel.z
    );
    spawnExplosion(this.scene, pos, 2.2);
    SFX.explosion();
    if (this.fuelFire) this.fuelFire.intensity = 10;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.root.position.x - pts.fuel.x, e.root.position.z - pts.fuel.z);
      if (d < 13) killEnemy(e);
    }
  }

  prompt(player: FirstPersonPlayer) {
    const p = player.position;
    if (!this.state.vegaRescued && Math.hypot(p.x - pts.vega.x, p.z - pts.vega.z) < 2.6)
      return 'F 解救 VEGA · 特遣队机师（伤员）';
    if (!this.state.moduleTaken && Math.hypot(p.x - pts.module.x, p.z - pts.module.z) < 2.4)
      return 'F 拾取通讯模块';
    if (!this.state.fuelBlown && Math.hypot(p.x - pts.fuel.x, p.z - pts.fuel.z) < 3.2)
      return 'F 爆破油罐';
    const nearExfil = Math.hypot(p.x - exfilPos.x, p.z - exfilPos.z) < 6.5;
    if (nearExfil && (!this.state.vegaRescued || !this.state.moduleTaken))
      return '需要先解救 VEGA 并取得通讯模块';
    if (
      nearExfil &&
      this.state.vegaRescued &&
      this.state.moduleTaken &&
      !this.state.flags.exfilBoarded
    )
      return 'F 登上接应车辆';
    if (!this.state.nvTaught) return RADIO.nvTeach;
    return '';
  }

  step(dt: number, player: FirstPersonPlayer, level: P0Level, enemies: Enemy[] = []) {
    this.vegaTime += dt;
    animateVega(this.vega, this.vegaTime, dt, this.state.vegaRescued);
    const z = player.position.z;
    const entered = enterZone(this.state, z);
    if (entered.entered) {
      if (entered.zone === 'bridge' && this.state.fuelBlown) {
        this.state.radio = 'HAMMER：油罐爆炸拖住了装甲，但它绕路了，快登车！';
      }
      this.pushRadio();
      const beats: Record<string, string> = {
        crash: '已抵达主坠机点 · 找到 VEGA 并取回通讯模块',
        valleyA: '河谷追击 · 边打边撤，不要原地固守',
        fuel: '前方油料场 · 爆破油罐阻断装甲追兵',
        valleyB: '雷击封锁主路 · 改走浅滩右侧',
        bridge: '公路桥接应点 · 在装甲车抵达前登车',
      };
      const beat = beats[entered.zone];
      if (beat) showHudToast(this.toastEl, beat, 2.6);
    }
    if (triggerLightningReroute(this.state, this.state.zone === 'valleyB')) {
      this.burn.visible = true;
      level.addObstacle(-2.2, -520, 4.2);
      if (this.burnLight) this.burnLight.intensity = 9;
      spawnExplosion(
        this.scene,
        new THREE.Vector3(-2.2, level.groundY(-2.2, -520) + 0.6, -520),
        1.3
      );
      SFX.thunder(1.5);
      this.pushRadio();
    }
    if (spawnApcPressure(this.state, this.state.zone === 'bridge')) this.pushRadio();
    stepApc(this.state, dt, z);
    if (this.state.apc.spawned) {
      this.apc.visible = true;
      this.apc.position.set(
        this.state.apc.x,
        level.groundY(this.state.apc.x, this.state.apc.z) + 0.02,
        this.state.apc.z
      );
      const lookZ = z > this.state.apc.z ? 1 : -1;
      this.apc.rotation.y = Math.atan2(0, lookZ);
    }

    const vx = this.vega.position.x;
    const vz = this.vega.position.z;
    if (this.state.vegaRescued && !this.state.flags.exfilBoarded) {
      const tx = player.position.x * 0.85;
      const tz = player.position.z + 1.4;
      const ddx = tx - vx;
      const ddz = tz - vz;
      const dist = Math.hypot(ddx, ddz);
      const speed = Math.min(7.5, 2.6 + dist * 1.8);
      const step = Math.min(dist, speed * dt);
      if (dist > 0.001) {
        this.vega.position.x += (ddx / dist) * step;
        this.vega.position.z += (ddz / dist) * step;
      }
      this.vega.rotation.y = Math.atan2(player.position.x - this.vega.position.x, player.position.z - this.vega.position.z);
      this.vega.position.y = level.groundY(this.vega.position.x, this.vega.position.z) + 0.02;
      this.vega.visible = true;
    } else if (!this.state.vegaRescued) {
      this.vega.position.set(pts.vega.x, level.groundY(pts.vega.x, pts.vega.z) + 0.02, pts.vega.z);
      this.vega.visible = true;
    }

    const near = enemies.some(
      (e) =>
        e.alive &&
        e.engaged &&
        Math.hypot(e.root.position.x - vx, e.root.position.z - vz) < 8
    );
    if (tickVegaThreat(this.state, near, dt)) return 'vega-dead';
    return infiltrationMode(z);
  }
}
