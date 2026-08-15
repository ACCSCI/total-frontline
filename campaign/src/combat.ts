import * as THREE from 'three';
import loadoutData from '../../shared/loadout.json';
import missionsData from '../../shared/missions.json';
import {
  type CampaignRules,
  type Enemy,
  type Pickup,
  PRIMARY_WEAPONS,
  type ThrowableProjectile,
} from './campaign';
import type { P0Level } from './level';
import type { FirstPersonPlayer } from './player';
import { SFX } from './sfx';
import { buildSoldierModel, cloneSoldierRig, type SoldierRig } from './soldier';

function makePickupRoot(color: number, label: string): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.18, 0.18),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      roughness: 0.5,
    })
  );
  body.position.y = 0.18;
  body.castShadow = true;
  body.userData.debugKind = 'pickup';
  root.add(body);
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.7 })
  );
  tip.position.y = 0.32;
  tip.userData.debugKind = 'pickup';
  root.add(tip);
  root.userData.debugKind = 'pickup';
  root.userData.pickupLabel = label;
  return root;
}

export class P0Combat {
  private scene: THREE.Scene;
  private level: P0Level;
  private player: FirstPersonPlayer;
  rules: CampaignRules;
  pickups: Pickup[] = [];
  enemies: Enemy[] = [];
  throwables: ThrowableProjectile[] = [];
  kills = 0;
  private triggeredWaves = new Set<string>();
  private spawnTemplate: SoldierRig | null = null;
  private enemiesSpawned = false;
  private raycaster = new THREE.Raycaster();
  private rayDir = new THREE.Vector3();
  private rayRight = new THREE.Vector3();
  private rayUp = new THREE.Vector3();
  private flashEl = document.getElementById('p0Flash') as HTMLDivElement;
  private damageEl = document.getElementById('p0Damage') as HTMLDivElement;
  private hitEl = document.getElementById('p0Hitmark') as HTMLDivElement;
  private pickupPrompt = document.getElementById('p0PickupPrompt') as HTMLDivElement;

  constructor(scene: THREE.Scene, level: P0Level, rules: CampaignRules, player: FirstPersonPlayer) {
    this.scene = scene;
    this.level = level;
    this.rules = rules;
    this.player = player;
    this.spawnPickups();
    rules.updateHud();
    this.updateHealthHud();
  }

  /** Heavy soldier construction is deferred until after the loading screen is
      hidden, so the boot paint is never blocked behind 30 rigs. */
  ensureEnemiesSpawned() {
    if (this.enemiesSpawned) return;
    this.enemiesSpawned = true;
    this.spawnEnemies();
  }

  private spawnPickups() {
    for (const p of missionsData.mission01.weaponPickups) {
      this.addPickup('weapon', p.weapon, new THREE.Vector3(p.x, 0, p.z));
    }
    for (const p of missionsData.mission01.ammoPickups) {
      this.addPickup('ammo', undefined, new THREE.Vector3(p.x, 0, p.z), '弹药补给');
    }
  }

  private addPickup(
    kind: Pickup['kind'],
    weaponId: string | undefined,
    pos: THREE.Vector3,
    labelOverride?: string
  ) {
    const def = weaponId ? PRIMARY_WEAPONS[weaponId] : null;
    const label = labelOverride || (def ? `${def.name} — F 替换` : '弹药补给');
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
    const positions = missionsData.mission01.enemyPositions.map(
      (p) => new THREE.Vector3(p.x, 0, p.z)
    );
    for (const pos of positions) {
      const root = new THREE.Group();
      const soldier = this.spawnTemplate
        ? cloneSoldierRig(this.spawnTemplate)
        : buildSoldierModel();
      this.spawnTemplate ||= soldier;
      root.add(soldier.model);
      root.position.set(pos.x, this.level.groundY(pos.x, pos.z) + 0.02, pos.z);
      root.userData.enemyRoot = root;
      root.userData.debugKind = 'enemy';
      this.scene.add(root);
      this.enemies.push({
        root,
        alive: true,
        health: 100,
        phase: Math.random() * Math.PI * 2,
        baseX: pos.x,
        baseZ: pos.z,
        patrolT: Math.random() * Math.PI * 2,
        fireT: 1 + Math.random() * 2,
        soldier,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        engaged: false,
        reactionT: 0.35 + Math.random() * 0.55,
        hitFlash: 0,
        deathT: 0,
      });
    }
  }

  private spawnWave(wave: { z: number; positions: Array<{ x: number; z: number }> }) {
    for (const p of wave.positions) {
      const pos = new THREE.Vector3(p.x, 0, p.z);
      const root = new THREE.Group();
      const soldier = this.spawnTemplate
        ? cloneSoldierRig(this.spawnTemplate)
        : buildSoldierModel();
      this.spawnTemplate ||= soldier;
      root.add(soldier.model);
      root.position.set(pos.x, this.level.groundY(pos.x, pos.z) + 0.02, pos.z);
      root.userData.enemyRoot = root;
      root.userData.debugKind = 'enemy';
      this.scene.add(root);
      this.enemies.push({
        root,
        alive: true,
        health: 100,
        phase: Math.random() * Math.PI * 2,
        baseX: pos.x,
        baseZ: pos.z,
        patrolT: Math.random() * Math.PI * 2,
        fireT: 0.8 + Math.random() * 0.6,
        soldier,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        engaged: true,
        reactionT: 0.2,
        hitFlash: 0,
        deathT: 0,
      });
    }
  }

  nearestWeaponPickup(pos: THREE.Vector3): Pickup | null {
    let best: Pickup | null = null;
    let bestD = 2.4;
    for (const p of this.pickups) {
      if (p.kind === 'ammo' || p.coolUntil > performance.now()) continue;
      const d = Math.hypot(p.root.position.x - pos.x, p.root.position.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  tryInteractWeapon(pos: THREE.Vector3) {
    const p = this.nearestWeaponPickup(pos);
    if (!p?.weaponId) return false;
    const old = this.rules.pickupWeapon(p.weaponId);
    if (old) {
      p.weaponId = old.id;
      p.label = `${old.name} — F 替换`;
    } else {
      p.root.visible = false;
      p.coolUntil = performance.now() + 999999;
    }
    return true;
  }

  shoot(camera: THREE.PerspectiveCamera): boolean {
    const w = this.rules.activeWeapon;
    if (!w || !this.rules.tryFire(this.rules.triggerReleased)) return false;
    const def = w.def;
    const stanceScale = this.player.prone ? 0.56 : this.player.crouch ? 0.8 : 1;
    const recoilScale = THREE.MathUtils.lerp(1, def.adsRecoil, this.rules.adsEase) * stanceScale;
    this.player.applyRecoil(
      def.camPitch,
      def.camYaw,
      def.fovKick,
      recoilScale,
      Math.max(0, this.rules.burstCount - 1)
    );
    SFX.gunshot(def.sound);
    camera.getWorldDirection(this.rayDir);
    this.rayRight.crossVectors(this.rayDir, camera.up).normalize();
    this.rayUp.crossVectors(this.rayRight, this.rayDir).normalize();

    /* The exact single-player cone: weapon heat + movement + air + stance + ADS. */
    const speed = this.player.horizontalSpeed;
    let spread = w.spread + (speed / 7) * def.moveSpread;
    if (!this.player.grounded) spread += def.airSpread;
    if (this.player.prone) spread *= Math.max(0.28, def.crouchMult * 0.55);
    else if (this.player.crouch) spread *= def.crouchMult;
    spread *= THREE.MathUtils.lerp(1, def.adsSpread, this.rules.adsEase);

    const pellets = Math.max(1, def.pellets);
    const objects: THREE.Object3D[] = [];
    for (const e of this.enemies) if (e.alive) objects.push(e.root);

    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (pellets > 1 ? Math.sqrt(Math.random()) : Math.random()) * spread;
      const dir = this.rayDir
        .clone()
        .addScaledVector(this.rayRight, Math.cos(a) * r)
        .addScaledVector(this.rayUp, Math.sin(a) * r)
        .normalize();
      this.raycaster.set(camera.position, dir);
      this.raycaster.far = def.range;
      const hits = this.raycaster.intersectObjects(objects, true);
      if (!hits.length) continue;
      let node: THREE.Object3D | null = hits[0].object;
      let headshot = false;
      while (node && !node.userData.enemyRoot) {
        if (node.name === 'soldierHead') headshot = true;
        node = node.parent;
      }
      const enemy = node ? this.enemies.find((e) => e.root === node) : null;
      if (!enemy?.alive) continue;
      if (this.losBlocked(camera.position, enemy.root.position)) continue;
      const dist = hits[0].distance;
      const falloff = THREE.MathUtils.clamp(
        1 - Math.max(0, dist - def.falloffStart) / Math.max(1, def.falloffRange),
        def.falloffMin,
        1
      );
      const dmg = def.baseDamage * falloff * (headshot ? def.headMult : 1);
      enemy.health -= dmg;
      enemy.hitFlash = 0.12;
      enemy.engaged = true;
      enemy.reactionT = Math.min(enemy.reactionT, 0.25);
      if (this.hitEl) {
        this.hitEl.classList.add('on');
        setTimeout(() => this.hitEl.classList.remove('on'), 90);
      }
      if (enemy.health <= 0) this.killEnemy(enemy);
    }
    return true;
  }

  private losBlocked(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-6) return false;
    for (const o of this.level.obstacles) {
      const t = THREE.MathUtils.clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / lenSq, 0, 1);
      const cx = a.x + dx * t - o.x;
      const cz = a.z + dz * t - o.z;
      const r = o.r * 0.85;
      if (cx * cx + cz * cz < r * r) return true;
    }
    return false;
  }

  private killEnemy(enemy: Enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.deathT = 0.75;
    enemy.health = 0;
    this.kills++;
    const x = enemy.root.position.x;
    const z = enemy.root.position.z;
    const y = this.level.groundY(x, z);
    /* ammo drop is picked up automatically; weapon drop is swappable with F */
    this.addPickup('ammo', undefined, new THREE.Vector3(x, 0, z), '敌人弹药');
    if (Math.random() < loadoutData.campaign.enemyDrop.weaponChance) {
      const pool = loadoutData.campaign.enemyDrop.weaponPool;
      const id = pool[Math.floor(Math.random() * pool.length)];
      this.addPickup(
        'lootWeapon',
        id,
        new THREE.Vector3(x + 0.8, 0, z),
        `${PRIMARY_WEAPONS[id].name} — F 拾取`
      );
    }
    void y;
    SFX.enemyDown();
  }

  throwGrenade(kind: 'lethal' | 'tactical', camera: THREE.PerspectiveCamera): boolean {
    if (!this.rules.useThrowable(kind)) return false;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position
      .clone()
      .add(dir.clone().multiplyScalar(0.7))
      .add(new THREE.Vector3(0, -0.2, 0));
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      new THREE.MeshStandardMaterial({
        color: kind === 'lethal' ? 0x2b3320 : 0xb9c6d0,
        emissive: kind === 'lethal' ? 0x5a1f10 : 0x8096a4,
        emissiveIntensity: 0.8,
      })
    );
    mesh.position.copy(origin);
    mesh.userData.debugKind = 'throwable';
    this.scene.add(mesh);
    const vel = dir.multiplyScalar(13).add(new THREE.Vector3(0, 5.5, 0));
    this.throwables.push({ mesh, velocity: vel, kind, life: 4 });
    return true;
  }

  private detonate(t: ThrowableProjectile) {
    const pos = t.mesh.position;
    this.scene.remove(t.mesh);
    if (t.kind === 'lethal') {
      SFX.explosion();
      const flash = new THREE.PointLight(0xffb45a, 26, 16);
      flash.position.copy(pos);
      this.scene.add(flash);
      setTimeout(() => this.scene.remove(flash), 240);
      const boom = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 14, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff9a3a,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      );
      boom.position.copy(pos);
      boom.userData.debugKind = 'fx';
      this.scene.add(boom);
      const start = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - start) / 420);
        boom.scale.setScalar(0.5 + k * 8);
        (boom.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
        if (k < 1) requestAnimationFrame(tick);
        else this.scene.remove(boom);
      };
      tick();
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.root.position.x - pos.x, enemy.root.position.z - pos.z);
        if (d < 5.5) this.killEnemy(enemy);
      }
    } else {
      SFX.flashbang();
      if (this.flashEl) {
        this.flashEl.classList.add('on');
        setTimeout(() => this.flashEl.classList.remove('on'), 180);
      }
    }
  }

  update(dt: number, playerPos: THREE.Vector3, camera: THREE.PerspectiveCamera) {
    const now = performance.now();
    /* pickups bob and proximity logic */
    for (const p of this.pickups) {
      if (!p.root.visible) continue;
      p.bobT += dt * 2.2;
      p.root.position.y =
        this.level.groundY(p.root.position.x, p.root.position.z) + 0.04 + Math.sin(p.bobT) * 0.07;
      p.root.rotation.y += dt * 0.8;
      const d = Math.hypot(p.root.position.x - playerPos.x, p.root.position.z - playerPos.z);
      if (p.kind === 'ammo' && d < 2.2 && p.coolUntil <= now) {
        this.rules.addAmmo(loadoutData.campaign.ammoPickup.amount);
        p.coolUntil = now + loadoutData.campaign.ammoPickup.cooldownMs;
        p.root.visible = false;
        setTimeout(() => {
          p.root.visible = true;
        }, loadoutData.campaign.ammoPickup.cooldownMs);
        this.showPrompt('已拾取弹药补给 · 投掷物 +1', 1.6);
      }
    }
    const wp = this.nearestWeaponPickup(playerPos);
    this.showPrompt(wp ? wp.label : '', 0);
    /* scripted reinforcement waves arrive when the player crosses their line */
    for (const wave of missionsData.mission01.reinforcementWaves) {
      const key = `${wave.z}:${wave.positions.length}`;
      if (!this.triggeredWaves.has(key) && playerPos.z <= wave.z + 2) {
        this.triggeredWaves.add(key);
        this.spawnWave(wave);
        this.showPrompt('侦测到敌军增援，保持移动', 2);
      }
    }
    /* throwables */
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.life -= dt;
      t.velocity.y -= 12 * dt;
      t.mesh.position.addScaledVector(t.velocity, dt);
      if (
        t.life <= 0 ||
        t.mesh.position.y <= this.level.groundY(t.mesh.position.x, t.mesh.position.z) + 0.06
      ) {
        this.throwables.splice(i, 1);
        this.detonate(t);
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.deathT > 0) {
          e.deathT -= dt;
          const k = 1 - Math.max(0, e.deathT / 0.75);
          e.root.rotation.x = Math.min(1.35, k * 1.55);
          e.root.position.y =
            this.level.groundY(e.root.position.x, e.root.position.z) + 0.02 - k * 0.18;
          if (e.deathT <= 0) e.root.visible = false;
        }
        continue;
      }
      this.updateEnemy(e, dt, playerPos);
    }
    void camera;
  }

  private updateEnemy(e: Enemy, dt: number, playerPos: THREE.Vector3) {
    e.phase += dt;
    const px = e.root.position.x;
    const pz = e.root.position.z;
    const dx = playerPos.x - px;
    const dz = playerPos.z - pz;
    const dist = Math.hypot(dx, dz) || 1;
    e.root.visible = dist < 52;
    e.root.rotation.y = Math.atan2(dx, dz);

    const canSee = dist < 30 && !this.losBlocked(e.root.position, playerPos);
    if (canSee) {
      e.reactionT -= dt;
      if (e.reactionT <= 0) e.engaged = true;
    } else {
      e.engaged = false;
      e.reactionT = 0.35 + Math.random() * 0.55;
    }

    let mx = 0;
    let mz = 0;
    if (e.engaged) {
      /* strafe around the player while holding a mid-range band, the same
         readable pressure curve as the legacy firefights */
      const tangentX = -dz / dist;
      const tangentZ = dx / dist;
      const ideal = 8 + (e.baseX % 5);
      const radial = dist > ideal + 2.5 ? 1 : dist < ideal - 2.5 ? -0.7 : 0;
      mx = (dx / dist) * radial + tangentX * e.strafeDir;
      mz = (dz / dist) * radial + tangentZ * e.strafeDir;
      const ml = Math.hypot(mx, mz) || 1;
      mx = (mx / ml) * 1.55;
      mz = (mz / ml) * 1.55;
      if (Math.random() < dt * 0.45) e.strafeDir *= -1;

      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 0.95 + Math.random() * 1.35;
        if (dist < 30) this.hurtPlayer(5 + Math.random() * 4);
      }
    } else {
      e.patrolT += dt;
      const tx = e.baseX + Math.sin(e.patrolT * 0.55) * 2.4;
      const tz = e.baseZ + Math.cos(e.patrolT * 0.4) * 1.8;
      const pdx = tx - px;
      const pdz = tz - pz;
      const pl = Math.hypot(pdx, pdz);
      if (pl > 0.3) {
        mx = (pdx / pl) * 0.7;
        mz = (pdz / pl) * 0.7;
      }
    }

    e.root.position.x += mx * dt;
    e.root.position.z += mz * dt;
    this.avoidObstacles(e.root.position);
    e.root.position.x = THREE.MathUtils.clamp(
      e.root.position.x,
      this.level.bounds.minX + 0.7,
      this.level.bounds.maxX - 0.7
    );
    e.root.position.z = THREE.MathUtils.clamp(
      e.root.position.z,
      this.level.bounds.minZ + 0.7,
      this.level.bounds.maxZ - 0.7
    );
    e.root.position.y = this.level.groundY(e.root.position.x, e.root.position.z) + 0.02;

    const moving = Math.hypot(mx, mz) > 0.05;
    const step = Math.sin(e.phase * (moving ? 3.2 : 0.8)) * (moving ? 0.55 : 0.12);
    for (let li = 0; li < 2; li++) {
      const s = li === 0 ? 1 : -1;
      e.soldier.legs[li].hip.rotation.x = step * s;
      e.soldier.legs[li].knee.rotation.x = Math.max(0, -step * s) * 0.7;
      e.soldier.arms[li].sh.rotation.x = e.engaged ? -0.75 : -step * s * 0.5;
      e.soldier.arms[li].el.rotation.x = e.engaged ? -0.45 : -0.1;
    }
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.root.scale.setScalar(1 + e.hitFlash * 0.6);
  }

  private avoidObstacles(pos: THREE.Vector3) {
    for (const o of this.level.obstacles) {
      const ddx = pos.x - o.x;
      const ddz = pos.z - o.z;
      const min = o.r + 0.5;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      pos.x = o.x + (ddx / d) * min;
      pos.z = o.z + (ddz / d) * min;
    }
  }

  private hurtPlayer(amount: number) {
    if (this.rules.playerHealth <= 0) return;
    this.rules.playerHealth = Math.max(0, this.rules.playerHealth - amount);
    this.updateHealthHud();
    SFX.enemyShot();
    if (this.damageEl) {
      this.damageEl.classList.add('on');
      setTimeout(() => this.damageEl.classList.remove('on'), 140);
    }
    if (this.rules.playerHealth <= 0) {
      this.rules.playerHealth = 100;
      this.updateHealthHud();
      this.player.resetPose(this.level);
      this.showPrompt('阵亡 · 已返回检查点', 1.8);
    }
  }

  private updateHealthHud() {
    const num = document.getElementById('p0Health') as HTMLDivElement;
    const fill = document.getElementById('p0HealthFill') as HTMLDivElement;
    if (num) num.textContent = String(Math.round(this.rules.playerHealth));
    if (fill) fill.style.transform = `scaleX(${this.rules.playerHealth / 100})`;
  }

  private showPrompt(text: string, duration: number) {
    if (!this.pickupPrompt) return;
    if (!text) {
      if (duration === 0) this.pickupPrompt.textContent = '';
      return;
    }
    this.pickupPrompt.textContent = text;
    this.pickupPrompt.hidden = false;
    if (duration > 0) {
      setTimeout(() => {
        if (this.pickupPrompt.textContent === text) this.pickupPrompt.hidden = true;
      }, duration * 1000);
    }
  }
}
