import * as THREE from 'three';
import {
  createTracerFlight,
  SPARK_LIFE,
  shellImpulse,
  stepShellBody,
  stepTracerFlight,
  type TracerFlight,
} from '../../shared/gameplay';

const MAX_SPARKS = 32;
const MAX_SHELLS = 10;
const MAX_TRACERS = 24;
const MAX_FLASHES = 5;
const MAX_EXPLOSIONS = 4;

const sparkGeo = new THREE.SphereGeometry(0.02, 4, 3);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, depthWrite: false });
const shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 5);
const shellMat = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
const tracerGeo = new THREE.CylinderGeometry(0.018, 0.01, 1, 5);
tracerGeo.rotateX(Math.PI / 2);

interface Flash {
  light: THREE.PointLight;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  base: number;
}

interface Ember {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface SmokePuff {
  sprite: THREE.Sprite;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface WaterSplash {
  ring: THREE.Mesh;
  drops: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }>;
  life: number;
  maxLife: number;
}

interface Explosion {
  fire: THREE.Mesh;
  light: THREE.PointLight;
  smoke: SmokePuff[];
  embers: Ember[];
  life: number;
  maxLife: number;
  scale: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  life: number;
}

interface ShellParticle {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  avx: number;
  avy: number;
  avz: number;
  life: number;
}

interface TracerParticle {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  flight: TracerFlight;
  life: number;
}

const sparks: SparkParticle[] = [];
const shells: ShellParticle[] = [];
const tracers: TracerParticle[] = [];
const tracerMat = new THREE.MeshBasicMaterial({
  color: 0xffd27a,
  depthWrite: false,
  transparent: true,
  opacity: 0.95,
});
const tracerMatSniper = new THREE.MeshBasicMaterial({
  color: 0xfff3c8,
  depthWrite: false,
  transparent: true,
  opacity: 0.95,
});
const flashes: Flash[] = [];
const explosions: Explosion[] = [];
const splashes: WaterSplash[] = [];
const splashRingGeo = new THREE.RingGeometry(0.06, 0.1, 20);
splashRingGeo.rotateX(-Math.PI / 2);
const splashMat = new THREE.MeshBasicMaterial({
  color: 0xcfe8ff,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const splashDropGeo = new THREE.SphereGeometry(0.014, 4, 3);
const splashDropMat = new THREE.MeshBasicMaterial({
  color: 0xdff2ff,
  transparent: true,
  depthWrite: false,
});

let smokeTexture: THREE.CanvasTexture | null = null;
function getSmokeTexture() {
  if (smokeTexture) return smokeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  smokeTexture = new THREE.CanvasTexture(c);
  return smokeTexture;
}

export function spawnWaterSplash(scene: THREE.Scene, point: THREE.Vector3) {
  let s = splashes.find((node) => node.life <= 0);
  if (!s) {
    if (splashes.length >= 10) s = splashes.shift()!;
    if (!s) {
      const ring = new THREE.Mesh(splashRingGeo, splashMat);
      ring.visible = false;
      scene.add(ring);
      const drops: WaterSplash['drops'] = [];
      for (let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(splashDropGeo, splashDropMat);
        mesh.visible = false;
        scene.add(mesh);
        drops.push({ mesh, vx: 0, vy: 0, vz: 0 });
      }
      s = { ring, drops, life: 0, maxLife: 0.5 };
      splashes.push(s);
    }
  }
  s.ring.visible = true;
  s.ring.position.copy(point).add(new THREE.Vector3(0, 0.02, 0));
  s.ring.scale.setScalar(0.7);
  (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.85;
  for (const d of s.drops) {
    d.mesh.visible = true;
    d.mesh.position.copy(point).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.04, (Math.random() - 0.5) * 0.06)
    );
    d.vx = (Math.random() - 0.5) * 0.5;
    d.vy = 0.7 + Math.random() * 0.8;
    d.vz = (Math.random() - 0.5) * 0.5;
  }
  s.life = 0.5;
  s.maxLife = 0.5;
}

export function spawnWallSparks(scene: THREE.Scene, point: THREE.Vector3) {
  let p = sparks.find((node) => node.life <= 0);
  if (!p) {
    if (sparks.length >= MAX_SPARKS) p = sparks.shift()!;
    if (!p) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      scene.add(mesh);
      p = { mesh, life: 0 };
      sparks.push(p);
    }
  }
  p.mesh.visible = true;
  p.mesh.position.copy(point);
  p.life = SPARK_LIFE;
}

function spawnFlash(scene: THREE.Scene, origin: THREE.Vector3, scale: number) {
  let f = flashes.find((node) => node.life <= 0);
  if (!f) {
    if (flashes.length >= MAX_FLASHES) f = flashes.shift()!;
    if (!f) {
      const light = new THREE.PointLight(0xffc27a, 0, 7.5);
      light.visible = true;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffd9a0,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      mesh.visible = false;
      scene.add(light, mesh);
      f = { light, mesh, life: 0, maxLife: 0.055, base: 0 };
      flashes.push(f);
    }
  }
  f.light.visible = true;
  f.mesh.visible = true;
  f.light.position.copy(origin);
  f.mesh.position.copy(origin);
  f.mesh.scale.setScalar(1.4 + Math.random() * 0.5);
  f.mesh.scale.multiplyScalar(scale);
  f.life = 0.055;
  f.maxLife = 0.055;
  f.base = 24 * scale;
}

export function spawnMuzzleFlash(scene: THREE.Scene, origin: THREE.Vector3) {
  spawnFlash(scene, origin, 1);
}

export function spawnEnemyMuzzleFlash(scene: THREE.Scene, origin: THREE.Vector3) {
  spawnFlash(scene, origin, 0.42);
}

function makeSmoke(scene: THREE.Scene, pos: THREE.Vector3, scale: number): SmokePuff {
  const mat = new THREE.SpriteMaterial({
    map: getSmokeTexture(),
    color: 0x777f87,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const baseScale = (0.9 + Math.random() * 1.4) * scale;
  sprite.scale.setScalar(baseScale);
  sprite.position.copy(pos).add(
    new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6)
  );
  scene.add(sprite);
  return {
    sprite,
    x: sprite.position.x,
    y: sprite.position.y,
    z: sprite.position.z,
    vx: (Math.random() - 0.5) * 1.6,
    vy: 1.2 + Math.random() * 1.7,
    vz: (Math.random() - 0.5) * 1.6,
    life: 1.1 + Math.random() * 0.9,
    maxLife: 0,
    baseScale,
  };
}

function makeEmber(scene: THREE.Scene, pos: THREE.Vector3): Ember {
  const mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
  mesh.scale.setScalar(0.7 + Math.random() * 1.6);
  mesh.position.copy(pos);
  scene.add(mesh);
  return {
    mesh,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    vx: (Math.random() - 0.5) * 4.5,
    vy: 2.4 + Math.random() * 6.0,
    vz: (Math.random() - 0.5) * 6.0,
    life: 0.6 + Math.random() * 1.0,
    maxLife: 0,
  };
}

export function spawnExplosion(scene: THREE.Scene, pos: THREE.Vector3, scale = 1) {
  let ex = explosions.find((node) => node.life <= 0);
  if (!ex) {
    if (explosions.length >= MAX_EXPLOSIONS) ex = explosions.shift()!;
    if (!ex) {
      const light = new THREE.PointLight(0xffb45a, 0, 18);
      light.visible = true;
      const fire = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 14, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff9a3a,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      fire.visible = false;
      scene.add(light, fire);
      const smoke: SmokePuff[] = [];
      for (let i = 0; i < 10; i++) smoke.push(makeSmoke(scene, pos, 1));
      const embers: Ember[] = [];
      for (let i = 0; i < 18; i++) embers.push(makeEmber(scene, pos));
      for (const s of smoke) {
        s.sprite.visible = false;
        s.maxLife = s.life;
      }
      for (const e of embers) {
        e.mesh.visible = false;
        e.maxLife = e.life;
      }
      ex = { fire, light, smoke, embers, life: 0, maxLife: 0.85, scale: 1 };
      explosions.push(ex);
    }
  }
  ex.light.position.copy(pos);
  ex.light.visible = true;
  ex.fire.visible = true;
  ex.fire.position.copy(pos);
  ex.fire.scale.setScalar(0.8);
  for (const s of ex.smoke) {
    s.sprite.visible = true;
    s.sprite.position.copy(pos).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6)
    );
    s.x = s.sprite.position.x;
    s.y = s.sprite.position.y;
    s.z = s.sprite.position.z;
    s.vx = (Math.random() - 0.5) * 1.6;
    s.vy = 1.2 + Math.random() * 1.7;
    s.vz = (Math.random() - 0.5) * 1.6;
    s.life = 1.1 + Math.random() * 0.9;
    s.maxLife = s.life;
  }
  for (const e of ex.embers) {
    e.mesh.visible = true;
    e.mesh.position.copy(pos);
    e.x = pos.x;
    e.y = pos.y;
    e.z = pos.z;
    e.vx = (Math.random() - 0.5) * 4.5;
    e.vy = 2.4 + Math.random() * 6;
    e.vz = (Math.random() - 0.5) * 6;
    e.life = 0.6 + Math.random() * 1;
    e.maxLife = e.life;
  }
  ex.life = 0.85;
  ex.maxLife = 0.85;
  ex.scale = scale;
}

export function spawnShell(scene: THREE.Scene, origin: THREE.Vector3, right: THREE.Vector3) {
  let p = shells.find((node) => node.life <= 0);
  if (!p) {
    if (shells.length >= MAX_SHELLS) p = shells.shift()!;
    if (!p) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      scene.add(mesh);
      p = {
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        avx: 0,
        avy: 0,
        avz: 0,
        life: 0,
      };
      shells.push(p);
    }
  }
  p.mesh.visible = true;
  p.mesh.position.copy(origin);
  const kick = shellImpulse(right.x, right.z);
  p.x = origin.x;
  p.y = origin.y;
  p.z = origin.z;
  p.vx = kick.vx;
  p.vy = kick.vy;
  p.vz = kick.vz;
  p.avx = kick.avx;
  p.avy = kick.avy;
  p.avz = kick.avz;
  p.life = 4;
}

export function spawnTracer(
  scene: THREE.Scene,
  from: THREE.Vector3,
  to: THREE.Vector3,
  _color: number,
  sniper = false
) {
  const length = from.distanceTo(to);
  if (length < 0.2) return;
  let p = tracers.find((node) => node.life <= 0);
  if (!p) {
    if (tracers.length >= MAX_TRACERS) p = tracers.shift()!;
    if (!p) {
      const mesh = new THREE.Mesh(tracerGeo, sniper ? tracerMatSniper : tracerMat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      p = {
        mesh,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        flight: createTracerFlight(1, false),
        life: 0,
      };
      tracers.push(p);
    }
  }
  if (p.mesh.material !== (sniper ? tracerMatSniper : tracerMat)) {
    p.mesh.material = sniper ? tracerMatSniper : tracerMat;
  }
  p.mesh.visible = true;
  p.from.copy(from);
  p.to.copy(to);
  p.flight = createTracerFlight(length, sniper);
  p.life = 1;
}

const _dir = new THREE.Vector3();
const _axis = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function warmupCombatFx(scene: THREE.Scene) {
  const p = new THREE.Vector3(0, -10, 0);
  const q = new THREE.Vector3(0.1, -10, -1);
  spawnMuzzleFlash(scene, p);
  spawnEnemyMuzzleFlash(scene, p);
  spawnWallSparks(scene, p);
  spawnShell(scene, p, new THREE.Vector3(1, 0, 0));
  spawnTracer(scene, p, q, 0xffd27a, false);
  spawnExplosion(scene, p, 1);
  spawnExplosion(scene, p, 2.2);
}

export function updateCombatFx(scene: THREE.Scene, dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.scale.multiplyScalar(0.82);
    if (p.life <= 0) p.mesh.visible = false;
  }
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    if (s.life <= 0) continue;
    const { dead } = stepShellBody(s, dt);
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.x += s.avx * dt;
    if (dead) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    if (tr.life <= 0) continue;
    const step = stepTracerFlight(tr.flight, dt);
    _dir.subVectors(tr.to, tr.from);
    if (_dir.lengthSq() > 1e-6) _dir.normalize();
    _a.copy(tr.from).addScaledVector(_dir, step.tail);
    _b.copy(tr.from).addScaledVector(_dir, step.head);
    tr.mesh.position.lerpVectors(_a, _b, 0.5);
    if (_dir.lengthSq() > 1e-6) tr.mesh.quaternion.setFromUnitVectors(_axis, _dir);
    tr.mesh.scale.set(step.scale, step.scale, Math.max(0.2, step.head - step.tail));
    (tr.mesh.material as THREE.MeshBasicMaterial).opacity = step.opacity;
    if (step.done) {
      tr.life = 0;
      tr.mesh.visible = false;
    }
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.life -= dt;
    const k = Math.max(0, f.life / f.maxLife);
    f.light.intensity = f.base * k;
    f.mesh.scale.setScalar(1.4 + (1 - k) * 2.2);
    (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * k;
    if (f.life <= 0) {
      f.light.intensity = 0;
      f.mesh.visible = false;
    }
  }
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i];
    if (s.life <= 0) continue;
    s.life -= dt;
    const k = Math.max(0, s.life / s.maxLife);
    s.ring.scale.setScalar(0.7 + (1 - k) * 2.2);
    (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
    for (const d of s.drops) {
      d.vy -= 6.5 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.mesh.position.y < s.ring.position.y) {
        d.mesh.visible = false;
      }
    }
    if (s.life <= 0) {
      s.ring.visible = false;
      for (const d of s.drops) d.mesh.visible = false;
    }
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.life -= dt;
    const k = Math.max(0, ex.life / ex.maxLife);
    const grown = 1 - k;
    ex.fire.scale.setScalar(0.8 + grown * 9 * ex.scale);
    (ex.fire.material as THREE.MeshBasicMaterial).opacity = 0.92 * k;
    ex.light.intensity = 42 * ex.scale * k;
    for (const s of ex.smoke) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy *= 0.985;
      s.sprite.position.set(s.x, s.y, s.z);
      s.sprite.scale.setScalar(s.baseScale * (1 + (1 - s.life / s.maxLife) * 1.4));
      (s.sprite.material as THREE.SpriteMaterial).opacity =
        0.5 * Math.max(0, s.life / s.maxLife) * 0.85;
    }
    for (const e of ex.embers) {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;
      e.vy -= 8.5 * dt;
      e.mesh.position.set(e.x, e.y, e.z);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        Math.min(1, e.life / e.maxLife)
      );
    }
    if (ex.life <= 0) {
      ex.fire.visible = false;
      ex.light.intensity = 0;
      for (const s of ex.smoke) s.sprite.visible = false;
      for (const e of ex.embers) e.mesh.visible = false;
    }
  }
}
