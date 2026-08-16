import * as THREE from 'three';
import {
  ammoLootLabel,
  currentSpread,
  damageFalloff,
  type EnemyKind,
  isShotgun,
  isSuppressed,
  MELEE_RANGE,
  nearestWeaponLootIndex,
  type PenetrationHit,
  partMultiplier,
  rollEnemyDrops,
  stealthActive,
  stepThrow,
  type ThrowableKind,
  tracePenetrations,
  weaponLootLabel,
} from '../../shared/gameplay';
import missionsData from '../../shared/missions.json';
import {
  type CampaignRules,
  type Enemy,
  type Pickup,
  PRIMARY_WEAPONS,
  type ThrowableProjectile,
} from './campaign';
import { CheckpointTrack, stealthUntilZ } from './checkpoints';
import {
  respawnAtCheckpoint,
  showHudPrompt,
  showHudToast,
  stepAmmoPickups,
  updateHealthHud,
} from './combat-hud';
import { stepCampaignTutorial } from './tutorial';
import { enemyNameAt, makePickupRoot, spawnCampaignEnemy } from './combat-spawn'; import { assignEnemyIdles } from './enemy-idles';
import { detonateThrown, makeThrownGrenade } from './combat-throw';
import { animateEnemyDeath, updateCampaignEnemy } from './combat-utils';
import { DamageHud } from './damage-hud';
import { spawnEnemyMuzzleFlash, spawnMuzzleFlash, spawnShell, spawnTracer, spawnWallSparks, warmupCombatFx } from './fx';
import type { P0Level } from './level';
import { MissionRuntime } from './mission-runtime';
import { revealNameplate, updateEnemyNameplates } from './nameplates';
import type { FirstPersonPlayer } from './player';
import { SFX } from './sfx';
import type { SoldierRig } from './soldier';

export class P0Combat {
  private scene: THREE.Scene;
  level: P0Level;
  private player: FirstPersonPlayer;
  rules: CampaignRules;
  pickups: Pickup[] = []; enemies: Enemy[] = []; throwables: ThrowableProjectile[] = []; kills = 0;
  private triggeredWaves = new Set<string>(); private spawnTemplate: SoldierRig | null = null; private waveReserve: Enemy[] = [];
  private enemiesSpawned = false;
  private raycaster = new THREE.Raycaster(); private rayDir = new THREE.Vector3(); private rayRight = new THREE.Vector3(); private rayUp = new THREE.Vector3(); private muzzleWorld = new THREE.Vector3();
  private activeCamera: THREE.PerspectiveCamera | null = null;
  private worldTargets: THREE.Object3D[] = [];
  private shotObjects: THREE.Object3D[] = []; private shotDir = new THREE.Vector3(); private shotEnd = new THREE.Vector3(); private shellOrigin = new THREE.Vector3();
  private flashEl = document.getElementById('p0Flash') as HTMLDivElement; readonly damageHud = new DamageHud();
  private hitEl = document.getElementById('p0Hitmark') as HTMLDivElement; private pickupPrompt = document.getElementById('p0PickupPrompt') as HTMLDivElement; private toastEl = document.getElementById('p0Toast') as HTMLDivElement;
  readonly checkpoints = new CheckpointTrack(); readonly mission: MissionRuntime; private shotSuppressed = false; private shotLoud = false;

  constructor(
    scene: THREE.Scene,
    level: P0Level,
    rules: CampaignRules,
    player: FirstPersonPlayer,
    private onExfil: () => void = () => {}
  ) {
    this.scene = scene;
    this.level = level;
    this.rules = rules;
    this.player = player;
    this.mission = new MissionRuntime(scene, level);
    this.collectWorldTargets();
    this.spawnPickups();
    rules.updateHud();
    updateHealthHud(this.rules.playerHealth);
    warmupCombatFx(scene);
  }
  ensureEnemiesSpawned() {
    if (this.enemiesSpawned) return;
    this.enemiesSpawned = true;
    this.spawnEnemies();
    this.prewarmWaveReserve();
  }
  private collectWorldTargets() {
    const take = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return;
      if (o.name === 'P0_GRAYBOX_GROUND' || o.userData.enemyRoot) return;
      if (o.userData.debugKind === 'fx' || o.userData.debugKind === 'pickup') return;
      this.worldTargets.push(o);
    };
    for (const child of this.level.group.children) child.traverse(take);
    for (const child of this.scene.children) {
      if (child !== this.level.group) child.traverse(take);
    }
  }

  private spawnPickups() {
    for (const p of missionsData.mission01.weaponPickups)
      this.addPickup('weapon', p.weapon, new THREE.Vector3(p.x, 0, p.z));
    for (const p of missionsData.mission01.ammoPickups)
      this.addPickup('ammo', undefined, new THREE.Vector3(p.x, 0, p.z), '弹药补给');
  }

  private addPickup(
    kind: Pickup['kind'],
    weaponId: string | undefined,
    pos: THREE.Vector3,
    labelOverride?: string
  ) {
    const def = weaponId ? PRIMARY_WEAPONS[weaponId] : null;
    const label = labelOverride || (def ? weaponLootLabel(def.name, true) : ammoLootLabel(false));
    const color = kind === 'ammo' ? 0x7f9a6a : 0xc88a3a;
    const root = makePickupRoot(color, label);
    root.position.set(pos.x, this.level.groundY(pos.x, pos.z) + 0.02, pos.z);
    root.userData.debugKind = 'pickup';
    this.scene.add(root);
    this.pickups.push({
      root,
      kind,
      weaponId,
      label,
      coolUntil: -1,
      bobT: Math.random() * Math.PI * 2,
    });
  }

  private spawnEnemies() {
    for (let i = 0; i < missionsData.mission01.enemyPositions.length; i++) {
      const p = missionsData.mission01.enemyPositions[i];
      const spawned = spawnCampaignEnemy(
        this.scene,
        this.level,
        p.x,
        p.z,
        enemyNameAt(i),
        this.spawnTemplate,
        { kind: ((p as { kind?: EnemyKind }).kind || 'rifle') as EnemyKind }
      );
      this.spawnTemplate = spawned.template;
      this.enemies.push(spawned.enemy);
    }
    assignEnemyIdles(this.enemies);
  }

  private prewarmWaveReserve() {
    for (const wave of missionsData.mission01.reinforcementWaves)
      for (const p of wave.positions) {
        const spawned = spawnCampaignEnemy(this.scene, this.level, p.x, p.z, enemyNameAt(this.enemies.length + this.waveReserve.length), this.spawnTemplate, {
          kind: ((p as { kind?: EnemyKind }).kind || 'rifle') as EnemyKind,
        });
        this.spawnTemplate = spawned.template;
        spawned.enemy.root.visible = false;
        this.waveReserve.push(spawned.enemy);
      }
    const warmX = this.player.position.x + 1.5;
    const warmZ = this.player.position.z + 4;
    for (const e of this.waveReserve) {
      e.root.visible = true;
      e.root.position.set(warmX, this.level.groundY(warmX, warmZ) + 0.02, warmZ);
    }
    setTimeout(() => {
      for (const e of this.waveReserve) e.root.visible = false;
    }, 700);
  }

  private spawnWave(wave: { z: number; positions: Array<{ x: number; z: number }> }) {
    for (let i = 0; i < wave.positions.length; i++) {
      const p = wave.positions[i];
      const e = this.waveReserve.shift();
      if (!e) break;
      e.root.visible = true;
      e.root.position.set(p.x, this.level.groundY(p.x, p.z) + 0.02, p.z);
      e.baseX = p.x; e.baseZ = p.z;
      e.kind = ((p as { kind?: EnemyKind }).kind || 'rifle') as EnemyKind;
      e.fireT = 0.8 + Math.random() * 0.6; e.engaged = true; e.reactionT = 0.2; e.lastSeenT = 2;
      e.patrolT = Math.random() * Math.PI * 2;
      this.enemies.push(e);
    }
  }

  nearestWeaponPickup(pos: THREE.Vector3): Pickup | null {
    const i = nearestWeaponLootIndex(
      this.pickups.map((p) => ({
        kind: p.kind,
        x: p.root.position.x,
        z: p.root.position.z,
        coolUntil: p.coolUntil,
        weaponId: p.weaponId,
      })),
      pos.x,
      pos.z,
      performance.now()
    );
    return i < 0 ? null : this.pickups[i];
  }

  tryInteractWeapon(pos: THREE.Vector3) {
    const story = this.mission.tryInteract(this.player);
    if (story === 'fuel-blast') {
      this.mission.explodeFuel(this.enemies, (enemy) => this.killEnemy(enemy), this.player);
      showHudToast(this.toastEl, '油料场已爆破 · 装甲追兵被延阻', 2.4);
      return true;
    }
    if (story === 'exfil') {
      showHudToast(this.toastEl, 'VEGA 已登车 · 立即撤离', 1.8);
      this.onExfil();
      return true;
    }
    if (story) {
      showHudToast(this.toastEl, story, 2);
      return true;
    }
    const p = this.nearestWeaponPickup(pos);
    if (!p?.weaponId) return false;
    const old = this.rules.pickupWeapon(p.weaponId);
    if (old) {
      p.weaponId = old.id;
      p.label = weaponLootLabel(old.name, true);
    } else {
      p.root.visible = false;
      p.coolUntil = performance.now() + 999999;
    }
    return true;
  }

  private alertEnemiesToGunfire(radius: number, suppressed: boolean) {
    const p = this.player.position;
    const hear = suppressed ? Math.min(radius, 9) : radius;
    for (const e of this.enemies) {
      if (!e.alive || e.engaged) continue;
      const d = Math.hypot(e.root.position.x - p.x, e.root.position.z - p.z);
      if (d > hear) continue;
      e.suspicion = Math.max(e.suspicion, suppressed ? 0.7 : 1);
      e.lastSeenX = p.x;
      e.lastSeenZ = p.z;
      if (!suppressed) {
        e.engaged = true;
        e.reactionT = Math.min(e.reactionT, 0.25);
      }
    }
  }

  shoot(camera: THREE.PerspectiveCamera, muzzle?: THREE.Vector3): boolean {
    const w = this.rules.activeWeapon;
    if (!w) return false;
    if (this.player.raisingFromSprint && !isShotgun(w.def.id)) return false;
    const magBefore = w.mag;
    if (!this.rules.tryFire(this.rules.triggerReleased)) return false;
    const firedRound = w.mag !== magBefore;
    if (!firedRound) return false;
    const def = w.def;
    const stanceScale = this.player.stanceRecoilMultiplier;
    const recoilScale = THREE.MathUtils.lerp(1, def.adsRecoil, this.rules.adsEase) * stanceScale;
    this.player.applyRecoil(def.camPitch, def.camYaw, def.fovKick, recoilScale, Math.max(0, this.rules.burstCount - 1), def.shakeAmt);
    const suppressed = isSuppressed(w.attachments);
    SFX.gunshot(def.sound, suppressed);
    this.shotSuppressed = suppressed;
    this.shotLoud = !suppressed;
    this.player.markSprintFire();
    if (muzzle) {
      spawnMuzzleFlash(this.scene, muzzle);
      camera.getWorldDirection(this.rayDir);
      this.rayRight.crossVectors(this.rayDir, camera.up).normalize();
      this.shellOrigin.copy(muzzle).addScaledVector(this.rayRight, 0.08);
      spawnShell(this.scene, this.shellOrigin, this.rayRight);
      SFX.shellDrop(0, !!def.shellBig);
    }
    this.alertEnemiesToGunfire(def.noise, suppressed);
    camera.getWorldDirection(this.rayDir);
    this.rayRight.crossVectors(this.rayDir, camera.up).normalize();
    this.rayUp.crossVectors(this.rayRight, this.rayDir).normalize();

    const spread = currentSpread(w.spread, def, this.player.horizontalSpeed, this.player.grounded, this.player.prone, this.player.crouch, this.rules.adsEase);

    const pellets = Math.max(1, def.pellets);
    const objects = this.shotObjects; objects.length = 0; objects.push(...this.worldTargets);
    for (const e of this.enemies) if (e.alive) objects.push(e.soldier.hbHead, e.soldier.hbBody, e.soldier.hbLegs);
    const origin = muzzle || camera.position;

    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (pellets > 1 ? Math.sqrt(Math.random()) : Math.random()) * spread;
      const dir = this.shotDir
        .copy(this.rayDir)
        .addScaledVector(this.rayRight, Math.cos(a) * r)
        .addScaledVector(this.rayUp, Math.sin(a) * r)
        .normalize();
      this.raycaster.set(camera.position, dir);
      this.raycaster.far = def.range;
      const hits = this.raycaster
        .intersectObjects(objects, true)
        .filter((hit) => hit.distance > 0.4);
      const groundT = this.rayHitGround(camera.position, dir, def.range);
      const described: PenetrationHit[] = hits.map((hit) =>
        this.describeHit(hit.object, hit.instanceId)
      );
      const path = tracePenetrations(described, def.id);
      let terminal = path.terminalIndex == null ? null : hits[path.terminalIndex];
      if (groundT != null && (!terminal || groundT < terminal.distance)) {
        terminal = null;
        path.enemy = false;
      }
      const end = terminal
        ? this.shotEnd.copy(terminal.point)
        : this.shotEnd.copy(camera.position).addScaledVector(dir, groundT ?? def.range);
      if (i === 0 || pellets <= 3 || Math.random() < 0.45)
        spawnTracer(
          this.scene,
          origin,
          end,
          def.id === 'sr7' ? 0xfff3c8 : 0xffd27a,
          def.id === 'sr7'
        );

      const mel = camera.matrixWorld.elements;
      const panAt = (x: number, z: number) =>
        THREE.MathUtils.clamp(
          ((x - camera.position.x) * mel[0] + (z - camera.position.z) * mel[2]) / 14,
          -1,
          1
        );
      const wetHit = this.level.waterDepth(end.x, end.z) > 0.01;
      if (wetHit && i === 0) {
        this.level.spawnWaterSplashAt(end);
        SFX.waterImpact(panAt(end.x, end.z), groundT ?? terminal?.distance ?? 0);
      } else if (path.surfaces.length) {
        const surface = path.surfaces[path.surfaces.length - 1];
        const point = hits[surface.index].point;
        SFX.impactWall(panAt(point.x, point.z), hits[surface.index].distance);
        if (i === 0) spawnWallSparks(this.scene, point);
      } else if (!path.enemy && groundT != null && i === 0) {
        spawnWallSparks(this.scene, end);
      }
      if (!terminal || !path.enemy) continue;
      const resolved = this.resolveEnemy(terminal.object);
      if (!resolved?.enemy.alive) continue;
      const { enemy, headshot, legshot } = resolved;
      const dist = terminal.distance;
      const dmg =
        def.baseDamage *
        path.damageScale *
        damageFalloff(dist, def.falloffStart, def.falloffRange, def.falloffMin) *
        partMultiplier(headshot, legshot, def.headMult);
      enemy.health -= dmg;
      enemy.hitFlash = 0.12;
      enemy.flinch = Math.min(1, enemy.flinch + (headshot ? 0.9 : 0.55));
      enemy.engaged = true;
      enemy.reactionT = Math.min(enemy.reactionT, 0.25);
      revealNameplate(enemy);
      SFX.hitBeep(headshot);
      SFX.impactFlesh(panAt(enemy.root.position.x, enemy.root.position.z), dist);
      if (this.hitEl) {
        this.hitEl.classList.add('on');
        setTimeout(() => this.hitEl.classList.remove('on'), 90);
      }
      if (enemy.health <= 0)
        this.killEnemy(enemy, panAt(enemy.root.position.x, enemy.root.position.z), dist);
    }
    return true;
  }

  private rayHitGround(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
    for (let t = 0.6; t <= maxDist; t += 1.4) {
      const y = origin.y + dir.y * t;
      const gy = this.level.groundY(origin.x + dir.x * t, origin.z + dir.z * t);
      if (y <= gy + 0.05) return t;
    }
    return null;
  }

  private hitMaterial(object: THREE.Object3D) {
    const mesh = object as THREE.Mesh;
    const mat = mesh.material;
    return Array.isArray(mat) ? mat[0] : mat;
  }

  private describeHit(object: THREE.Object3D, instanceId?: number): PenetrationHit {
    const resolved = this.resolveEnemy(object);
    const std = this.hitMaterial(object) as THREE.MeshStandardMaterial | undefined;
    return {
      id: `${object.uuid}:${instanceId ?? -1}`,
      liveEnemy: !!resolved?.enemy.alive,
      key: std?.userData?.surfaceKey || '',
      transparent: !!std?.transparent,
      opacity: std?.opacity ?? 1,
    };
  }

  private resolveEnemy(object: THREE.Object3D) {
    const part = object.userData.part as string | undefined;
    const headshot = part === 'head';
    const legshot = part === 'legs';
    let node: THREE.Object3D | null = object;
    while (node && !node.userData.enemyRoot) node = node.parent;
    const enemy = node ? this.enemies.find((e) => e.root === node) : null;
    if (!enemy) return null;
    return { enemy, headshot, legshot };
  }

  startMelee(camera: THREE.PerspectiveCamera): boolean {
    if (!this.rules.startMelee()) return false;
    SFX.melee(false);
    camera.getWorldDirection(this.rayDir);
    this.raycaster.set(camera.position, this.rayDir);
    this.raycaster.far = MELEE_RANGE;
    const objects = this.shotObjects; objects.length = 0; objects.push(...this.worldTargets);
    for (const e of this.enemies) if (e.alive) objects.push(e.soldier.hbHead, e.soldier.hbBody, e.soldier.hbLegs);
    const hit = this.raycaster.intersectObjects(objects, true)[0];
    if (!hit) return true;
    const resolved = this.resolveEnemy(hit.object);
    if (!resolved?.enemy.alive) return true;
    const { enemy, headshot } = resolved;
    const fx = enemy.root.position.x - camera.position.x;
    const fz = enemy.root.position.z - camera.position.z;
    const facingDot = Math.sin(enemy.root.rotation.y) * fx + Math.cos(enemy.root.rotation.y) * fz;
    const backstab = !enemy.engaged && enemy.suspicion < 0.5 && facingDot < -0.25;
    enemy.hitFlash = 0.12;
    enemy.flinch = Math.min(1, enemy.flinch + 0.9);
    SFX.melee(true);
    SFX.hitBeep(true);
    if (this.hitEl) { this.hitEl.classList.add('on'); setTimeout(() => this.hitEl.classList.remove('on'), 90); }
    enemy.health = 0;
    if (backstab) { showHudToast(this.toastEl, '背刺成功 · 未被发现', 1.6); this.killEnemy(enemy, 0, hit.distance); return true; }
    enemy.engaged = true; revealNameplate(enemy); this.alertNeighbors(enemy, 18);
    this.killEnemy(enemy, 0, hit.distance);
    return true;
  }

  private killEnemy(enemy: Enemy, pan = 0, dist = 0) {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.deathT = 0;
    enemy.health = 0;
    enemy.soldier.tag.sprite.visible = false;
    enemy.soldier.tag.draw(0, false);
    SFX.killChime();
    SFX.enemyDeath(pan, dist);
    this.kills++;
    const x = enemy.root.position.x;
    const z = enemy.root.position.z;
    const y = this.level.groundY(x, z);
    const drops = rollEnemyDrops();
    if (drops.ammo)
      this.addPickup('ammo', undefined, new THREE.Vector3(x, 0, z), ammoLootLabel(true));
    if (drops.weaponId) {
      const def = PRIMARY_WEAPONS[drops.weaponId];
      this.addPickup(
        'lootWeapon',
        drops.weaponId,
        new THREE.Vector3(x + 0.8, 0, z),
        weaponLootLabel(def?.name || drops.weaponId, false)
      );
    }
    void y;
  }

  throwGrenade(kind: ThrowableKind, camera: THREE.PerspectiveCamera): boolean {
    if (!this.rules.useThrowable(kind)) return false;
    this.throwables.push(makeThrownGrenade(this.scene, kind, camera));
    return true;
  }

  private detonate(t: ThrowableProjectile) {
    detonateThrown(this.scene, t, this.enemies, this.flashEl, (enemy) => this.killEnemy(enemy));
  }

  update(dt: number, playerPos: THREE.Vector3, camera: THREE.PerspectiveCamera) {
    this.activeCamera = camera;
    this.checkpoints.update(playerPos.x, playerPos.z, this.player.yaw);
    stepCampaignTutorial(this.toastEl, this.player, this.rules, this.enemies, playerPos.z);
    if (this.mission.step(dt, this.player, this.level, this.enemies) === 'vega-dead')
      this.failToCheckpoint('VEGA 阵亡 · 已返回检查点');
    if (this.rules.playerHealth < 100 && this.rules.playerHealth > 0)
      updateHealthHud(this.rules.playerHealth);
    stepAmmoPickups(this.pickups, playerPos, this.level.groundY, dt, this.rules, this.toastEl);
    const story = this.mission.prompt(this.player);
    const wp = this.nearestWeaponPickup(playerPos);
    showHudPrompt(this.pickupPrompt, story || (wp ? wp.label : ''), 0);
    for (const wave of missionsData.mission01.reinforcementWaves) {
      const key = `${wave.z}:${wave.positions.length}`;
      if (!this.triggeredWaves.has(key) && playerPos.z <= wave.z + 2) {
        this.triggeredWaves.add(key);
        this.spawnWave(wave);
        showHudToast(this.toastEl, '侦测到敌军增援，保持移动', 2);
      }
    }
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      const ground = this.level.groundY(t.body.x, t.body.z);
      const result = stepThrow(t.body, dt, ground);
      t.mesh.position.set(t.body.x, t.body.y, t.body.z);
      if (result === 'detonate') {
        this.throwables.splice(i, 1);
        this.detonate(t);
      }
    }

    const stealth = stealthActive(playerPos.z, stealthUntilZ());
    const sense = {
      crouch: this.player.crouch,
      prone: this.player.prone,
      sprint: this.player.sprint,
      stealth,
      suppressedShot: this.shotSuppressed,
      loudShot: this.shotLoud,
    };
    for (const e of this.enemies) {
      if (!e.alive) {
        animateEnemyDeath(this.scene, e, dt);
        continue;
      }
      updateCampaignEnemy(this, e, dt, playerPos, sense);
    }
    this.shotSuppressed = false;
    this.shotLoud = false;
    updateEnemyNameplates(this.enemies, camera, dt);
  }

  onSpotted(enemy?: Enemy) {
    if (enemy) enemy.engaged = true;
  }

  onEnemyMuzzleFlash(enemy: Enemy) {
    enemy.soldier.gunMuzzle.getWorldPosition(this.muzzleWorld);
    spawnEnemyMuzzleFlash(this.scene, this.muzzleWorld);
  }

  alertNeighbors(source: Enemy, radius: number) {
    const reach = source.kind === 'nco' ? radius * 1.45 : radius;
    for (const e of this.enemies) {
      if (!e.alive || e === source) continue;
      const d = Math.hypot(
        e.root.position.x - source.root.position.x,
        e.root.position.z - source.root.position.z
      );
      if (d < reach) {
        e.suspicion = Math.max(e.suspicion, source.kind === 'nco' ? 0.85 : 0.64);
        e.lastSeenX = source.lastSeenX;
        e.lastSeenZ = source.lastSeenZ;
      }
    }
  }

  hurtPlayer(amount: number, shooter?: Enemy) {
    if (this.rules.playerHealth <= 0) return;
    this.rules.playerHealth = Math.max(0, this.rules.playerHealth - amount);
    this.rules.lastHurt = performance.now();
    updateHealthHud(this.rules.playerHealth);
    let pan = 0;
    let dist = 0;
    if (shooter && this.activeCamera) {
      const cam = this.activeCamera;
      const mel = cam.matrixWorld.elements;
      dist = Math.hypot(
        shooter.root.position.x - cam.position.x,
        shooter.root.position.z - cam.position.z
      );
      pan = THREE.MathUtils.clamp(
        ((shooter.root.position.x - cam.position.x) * mel[0] +
          (shooter.root.position.z - cam.position.z) * mel[2]) /
          14,
        -1,
        1
      );
    }
    SFX.gunshotAt('m4', pan, dist);
    SFX.damageTaken();
    const from = shooter ? shooter.root.position : this.player.position;
    this.damageHud.show(
      from.x,
      from.z,
      this.player.camera.position.x,
      this.player.camera.position.z,
      this.player.yaw,
      amount
    );
    this.player.addShake(this.damageHud.shakeFor(amount));
    if (this.rules.playerHealth <= 0) this.failToCheckpoint('阵亡 · 已返回检查点');
  }

  private failToCheckpoint(message: string) {
    respawnAtCheckpoint(message, {
      failEl: document.getElementById('failBanner') as HTMLDivElement,
      toastEl: this.toastEl,
      rules: this.rules,
      checkpoints: this.checkpoints,
      player: this.player,
      level: this.level,
      enemies: this.enemies,
      mission: this.mission.state,
    });
  }
}
