'use strict';
/* =========================================================================
   10. ENEMIES
   ========================================================================= */
const ENEMY_NAMES = [
  '毒蛇',
  '幽灵',
  '收割者',
  '浩劫',
  '突击手',
  '眼镜蛇',
  '利爪',
  '恶狼',
  '柴油',
  '暗影',
];
/* Multi-scale blob camo. Flat-coloured primitives are the single loudest tell
   that a model was generated rather than made; a pattern at a believable
   physical scale kills it faster than any amount of extra geometry. */
function makeCamoTex() {
  const S = 256,
    [c, x] = cvs(S);
  x.fillStyle = '#585a41';
  x.fillRect(0, 0, S, S);
  const blob = (fill, count, rMin, rMax, lobes) => {
    x.fillStyle = fill;
    for (let i = 0; i < count; i++) {
      const cx = rand(0, S),
        cy = rand(0, S),
        r = rand(rMin, rMax);
      /* draw at nine offsets so the pattern tiles seamlessly */
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const px = cx + ox * S,
            py = cy + oy * S;
          if (px < -r * 2 || px > S + r * 2 || py < -r * 2 || py > S + r * 2) continue;
          x.beginPath();
          for (let k = 0; k <= lobes; k++) {
            const a = (k / lobes) * PI * 2,
              rr = r * (0.62 + 0.38 * Math.abs(Math.sin(a * 2.3 + cx)));
            const qx = px + Math.cos(a) * rr,
              qy = py + Math.sin(a) * rr;
            k ? x.lineTo(qx, qy) : x.moveTo(qx, qy);
          }
          x.closePath();
          x.fill();
        }
    }
  };
  blob('#464934', 16, 16, 34, 9);
  blob('#33372a', 13, 11, 26, 8);
  blob('#6d6650', 11, 10, 22, 8);
  blob('#22241d', 9, 6, 15, 7);
  grain(x, S, 14);
  const t = finishTex(c, [1, 1]);
  return t;
}
const TEX_CAMO = makeCamoTex();

/* Box UVs run 0..1 per face, so a shared map stretches differently on every
   part. Scaling by face size keeps the camo at one physical size. */
const CAMO_PER_M = 3.6;
function EB(w, h, d) {
  const g = B(w, h, d);
  const uv = g.attributes.uv;
  const face = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const su = face[f][0] * CAMO_PER_M,
      sv = face[f][1] * CAMO_PER_M;
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return g;
}

/* Spread across a wide albedo range on purpose. The old palette sat between 2%
   and 6% reflectance, which the tonemap compressed into one flat silhouette —
   a soldier has to read as jacket / armour / boots at forty metres. */
const E_MAT = {
  cloth: new THREE.MeshStandardMaterial({ map: TEX_CAMO, roughness: 0.94, metalness: 0.02 }),
  webb: new THREE.MeshStandardMaterial({ color: 0x565842, roughness: 0.94, metalness: 0.02 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x32342f, roughness: 0.8, metalness: 0.06 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xa87f5b, roughness: 0.86, metalness: 0.0 }),
  helm: new THREE.MeshStandardMaterial({ color: 0x4b4d40, roughness: 0.62, metalness: 0.08 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.94, metalness: 0.04 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x44484c, roughness: 0.48, metalness: 0.16 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.14, metalness: 0.24 }),
  accent: new THREE.MeshStandardMaterial({
    color: 0xff3b2a,
    emissive: 0xff2a18,
    emissiveIntensity: 1.6,
    roughness: 0.5,
  }),
};
linearizeMats(E_MAT);
const INVIS = new THREE.MeshBasicMaterial({ visible: false });

/* capsule from cylinder + hemispheres (r128 has no CapsuleGeometry).
   Parts go straight onto the parent so collapseRig can fold them in with the
   rest of that bone's geometry. */
function capsuleGroup(parent, r, h, mat, x, y, z) {
  x = x || 0;
  y = y || 0;
  z = z || 0;
  part(parent, CYL(r, r, h, 12), mat, x, y, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y + h / 2, z);
  part(parent, new THREE.SphereGeometry(r, 12, 8), mat, x, y - h / 2, z);
}

/* Every bone here is rigid, so the meshes hanging off one can be baked into a
   single buffer per material. Cuts a soldier from ~32 draws to ~20. */
function collapseRig(root) {
  const groups = [];
  root.traverse((o) => {
    if (o.isGroup || o === root) groups.push(o);
  });
  for (const g of groups) {
    const byMat = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.material === INVIS) continue;
      if (!byMat.has(c.material)) byMat.set(c.material, []);
      byMat.get(c.material).push(c);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      for (const m of list) g.remove(m);
      const merged = new THREE.Mesh(mergeGeoms(geos), mat);
      merged.castShadow = merged.receiveShadow = true;
      g.add(merged);
    }
  }
}

function buildEnemyModel() {
  const model = new THREE.Group();
  const body = new THREE.Group();
  model.add(body);

  /* legs (pivot at hip) */
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.135, 0.9, 0);
    body.add(hip);
    part(hip, EB(0.185, 0.46, 0.2), E_MAT.cloth, 0, -0.23, 0);
    part(hip, B(0.155, 0.115, 0.055), E_MAT.vest, 0, -0.4, -0.106); // knee pad
    const knee = new THREE.Group();
    knee.position.set(0, -0.46, 0);
    hip.add(knee);
    part(knee, EB(0.165, 0.44, 0.185), E_MAT.cloth, 0, -0.22, 0);
    part(knee, B(0.172, 0.17, 0.195), E_MAT.boot, 0, -0.38, -0.004); // boot upper
    part(knee, B(0.175, 0.1, 0.28), E_MAT.boot, 0, -0.42, -0.035); // toe
    legs.push({ hip, knee });
  }
  /* torso: soft body under a hard plate carrier, so the armour reads as a
     separate slab rather than a colour change.
     -Z is the front, matching the head, the rifle, and the yaw the AI steers to. */
  capsuleGroup(body, 0.215, 0.44, E_MAT.cloth, 0, 1.2, 0);
  part(body, B(0.455, 0.5, 0.315), E_MAT.vest, 0, 1.25, -0.005); // carrier
  part(body, B(0.3, 0.2, 0.075), E_MAT.vest, 0, 1.3, -0.175); // front plate
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, 0.135, 1.13, -0.175); // mag pouches
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, 0.0, 1.13, -0.178);
  part(body, B(0.115, 0.115, 0.075), E_MAT.webb, -0.135, 1.13, -0.175);
  part(body, B(0.2, 0.075, 0.06), E_MAT.webb, 0, 1.44, -0.168); // radio on chest
  part(body, B(0.075, 0.02, 0.02), E_MAT.accent, 0, 1.4, -0.196); // IFF strobe
  part(body, B(0.485, 0.115, 0.3), E_MAT.vest, 0, 1.48, -0.005); // shoulder yoke
  part(body, B(0.4, 0.1, 0.32), E_MAT.webb, 0, 1.06, -0.005); // belt kit
  part(body, B(0.11, 0.15, 0.09), E_MAT.webb, 0.2, 1.02, -0.06); // hip pouches
  part(body, B(0.11, 0.15, 0.09), E_MAT.webb, -0.2, 1.02, -0.06);
  part(body, B(0.3, 0.3, 0.16), E_MAT.webb, 0, 1.34, 0.21); // daypack
  part(body, B(0.11, 0.24, 0.1), E_MAT.vest, 0.13, 1.36, 0.3); // roll on pack
  /* neck + head */
  part(body, CYL(0.062, 0.062, 0.1, 8), E_MAT.skin, 0, 1.53, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.655, 0);
  body.add(head);
  part(head, new THREE.SphereGeometry(0.135, 14, 12), E_MAT.skin, 0, 0, 0);
  part(
    head,
    new THREE.SphereGeometry(0.158, 14, 10, 0, PI * 2, 0, PI * 0.64),
    E_MAT.helm,
    0,
    0.012,
    0
  );
  part(head, B(0.3, 0.035, 0.3), E_MAT.helm, 0, -0.048, 0.004); // helmet rim
  part(head, B(0.055, 0.1, 0.05), E_MAT.vest, 0.145, -0.035, 0.01); // ear cups
  part(head, B(0.055, 0.1, 0.05), E_MAT.vest, -0.145, -0.035, 0.01);
  part(head, B(0.2, 0.055, 0.06), E_MAT.glass, 0, 0.01, -0.115); // goggles
  part(head, B(0.21, 0.022, 0.05), E_MAT.vest, 0, 0.048, -0.108); // goggle strap
  part(head, B(0.13, 0.075, 0.06), E_MAT.vest, 0, -0.062, -0.105); // mask
  part(head, B(0.026, 0.026, 0.1), E_MAT.helm, 0.1, 0.055, -0.02); // nvg mount
  part(head, B(0.055, 0.045, 0.045), E_MAT.helm, 0, 0.075, -0.1); // nvg shroud
  /* arms — rifle rig */
  const rig = new THREE.Group();
  rig.position.set(0, 1.4, 0);
  body.add(rig);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.275, 0.02, 0);
    rig.add(sh);
    part(sh, B(0.15, 0.135, 0.165), E_MAT.vest, 0, -0.035, 0); // shoulder pad
    part(sh, EB(0.135, 0.34, 0.145), E_MAT.cloth, 0, -0.17, 0);
    part(sh, B(0.14, 0.075, 0.15), E_MAT.vest, 0, -0.3, 0); // elbow pad
    const el = new THREE.Group();
    el.position.set(0, -0.34, 0);
    sh.add(el);
    part(el, EB(0.115, 0.3, 0.125), E_MAT.cloth, 0, -0.15, 0);
    part(el, B(0.1, 0.1, 0.13), E_MAT.boot, 0, -0.3, 0.01); // glove
    arms.push({ sh, el });
  }
  /* enemy weapon */
  const gun = new THREE.Group();
  rig.add(gun);
  part(gun, B(0.065, 0.085, 0.34), E_MAT.gun, 0, 0, -0.1);
  part(gun, CYLZ(0.016, 0.016, 0.32, 8), E_MAT.gun, 0, 0.006, -0.4);
  part(gun, B(0.045, 0.14, 0.07), E_MAT.gun, 0, -0.1, -0.05);
  part(gun, B(0.05, 0.1, 0.06), E_MAT.gun, 0, -0.075, 0.05);
  part(gun, B(0.055, 0.075, 0.16), E_MAT.gun, 0, -0.005, 0.16);
  const gunMuzzle = new THREE.Object3D();
  gunMuzzle.position.set(0, 0.006, -0.56);
  gun.add(gunMuzzle);

  /* hitboxes (material invisible → still raycastable) */
  const hbHead = new THREE.Mesh(B(0.33, 0.34, 0.33), INVIS);
  hbHead.position.set(0, 1.66, 0);
  body.add(hbHead);
  const hbBody = new THREE.Mesh(B(0.62, 0.62, 0.42), INVIS);
  hbBody.position.set(0, 1.2, 0);
  body.add(hbBody);
  const hbLegs = new THREE.Mesh(B(0.55, 0.92, 0.36), INVIS);
  hbLegs.position.set(0, 0.46, 0);
  body.add(hbLegs);

  model.traverse((o) => {
    if (o.isMesh && o.material !== INVIS) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  collapseRig(model);
  return { model, body, legs, arms, rig, gun, gunMuzzle, head, hbHead, hbBody, hbLegs };
}

/* name tag + health bar sprite; allies pass a colour so blue reads friendly */
function makeTag(name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 76;
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  const mat = new THREE.SpriteMaterial({
    map: t,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.55, 0.46, 1);
  spr.position.y = 2.16;
  const ctx = c.getContext('2d');
  function draw(hp, alerted) {
    ctx.clearRect(0, 0, 256, 76);
    ctx.font = 'bold 27px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(name, 128, 22);
    ctx.fillStyle = color || (alerted ? '#ff6a58' : '#e9eef3');
    ctx.fillText(name, 128, 22);
    const bx = 40,
      bw = 176,
      by = 44,
      bh = 13;
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(bx, by, bw, bh);
    const f = clamp(hp / 100, 0, 1);
    ctx.fillStyle = f > 0.6 ? '#5fd06a' : f > 0.28 ? '#ffb340' : '#ff3b30';
    ctx.fillRect(bx, by, bw * f, bh);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(bx, by, bw * f, 3);
    ctx.strokeStyle = 'rgba(255,255,255,.42)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(bx + (bw * i) / 4, by, 2, bh);
    }
    t.needsUpdate = true;
  }
  draw(100, false);
  return { sprite: spr, draw, tex: t };
}

/* patrol routes (loops of waypoints) — per map, installed by applyMap */
let ROUTES = [];
let UPPER_ROUTES = new Set();

const ST = { PATROL: 0, ALERT: 1, COMBAT: 2, DEAD: 3 };
const enemies = [];
let enemyHitMeshes = [];
/* deathmatch: the dead come back. Entries are {e, t} seconds-to-respawn. */
const respawnQueue = [];

function makeEnemy(i) {
  const _sBox = new THREE.Box3(),
    _sSz = new THREE.Vector3();
  const parts = buildEnemyModel();
  /* Ten soldiers at 26 shadow casters each were most of the shadow pass. The
     torso, head, limbs and pack still cast, so the silhouette on the ground is
     unmistakably a man; what goes is the pouches-and-knee-pads detail, which
     at 2048 over a 60m yard was never more than a pixel of noise anyway. */
  parts.model.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    _sBox.setFromObject(o);
    _sBox.getSize(_sSz);
    if (Math.max(_sSz.x, _sSz.y, _sSz.z) < 0.4) o.castShadow = false;
  });
  const obj = new THREE.Group();
  obj.add(parts.model);
  const tag = makeTag(ENEMY_NAMES[i]);
  obj.add(tag.sprite);
  const upper = UPPER_ROUTES.has(i);
  /* Hand-placed waypoints drift into props as the map changes, and a body
     standing inside a crate can never resolve a legal move — it just stands
     there for three minutes. Snap every leg to open floor at load. */
  /* the upper floor is reachable by ramp, which a flat flood fill can't see,
     so only ground routes get the reachability constraint */
  const floorY = upper ? CUR.upperY : 0;
  const route = upper
    ? ROUTES[i].map(([wx, wz]) => nearestFree(wx, wz, 0.5, 1.7, 6, floorY))
    : ROUTES[i].map(([wx, wz]) => nearestReachable(wx, wz, 0.5, 1.7, 10));
  /* two routes loop straight past the player spawn — start those enemies on
     the far leg so nobody opens fire before you have your bearings */
  let wpStart = 0;
  for (let k = 0; k < route.length; k++) {
    const d = Math.hypot(route[k][0] - SPAWN.x, route[k][1] - SPAWN.z);
    const dBest = Math.hypot(route[wpStart][0] - SPAWN.x, route[wpStart][1] - SPAWN.z);
    if (d > dBest) wpStart = k;
  }
  const e = {
    idx: i,
    name: ENEMY_NAMES[i],
    obj,
    tag,
    upper,
    route,
    wp: (wpStart + 1) % route.length,
    floorY,
    startPos: route[wpStart],
    p: parts,
    hp: 100,
    state: ST.PATROL,
    dead: false,
    yaw: rand(0, 7),
    targetYaw: rand(0, 7),
    vel: new THREE.Vector3(),
    walkPhase: rand(0, 7),
    speed: 0,
    losTimer: rand(0, 0.2),
    canSee: false,
    lastSeen: 0,
    reactT: 0,
    alerted: false,
    fireT: 0,
    burst: 0,
    burstT: 0,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeT: rand(0.6, 1.8),
    flinch: 0,
    deathT: 0,
    aimPitch: 0,
    gunDropped: false,
    combatBlend: 0,
    idleT: rand(0, 2),
    repathT: 0,
    avoidT: 0,
    avoidX: 0,
    avoidZ: 0,
    avoidSide: 0,
    clearT: 0,
    stuckT: 0,
    stuckN: 0,
    stuckX: 0,
    stuckZ: 0,
    tactic: 'push',
    tacticT: 0,
    cover: null,
    engage: 0,
    rounds: 30,
    reloadT: 0,
    suppress: 0,
    saidLost: false,
    hunt: 0,
    lastKnown: new THREE.Vector3(),
  };
  parts.hbHead.userData = { enemy: e, part: 'head' };
  parts.hbBody.userData = { enemy: e, part: 'body' };
  parts.hbLegs.userData = { enemy: e, part: 'legs' };
  return e;
}

/* Nuketown spawns its squad behind the east house like the original; maps
   without an enemyZone start each man on the far leg of his patrol instead */
function placeEnemy(e) {
  const zone = CUR && CUR.enemyZone;
  if (zone && !e.upper) {
    for (let t = 0; t < 20; t++) {
      const x = rand(zone.x0, zone.x1),
        z = rand(zone.z0, zone.z1);
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < 8) continue;
      if (blocked(x, z, 0.3, 1.65, 0.5)) continue;
      if (t < 12 && !walkable(x, z)) continue; // late tries: standable is enough
      e.obj.position.set(x, 0, z);
      return;
    }
    /* never fall back to a patrol waypoint here — those roam the whole map,
       and one behind the player's spawn reads as an enemy materialising over
       his shoulder. Worst case is the middle of the muster zone. */
    const f = nearestFree((zone.x0 + zone.x1) / 2, (zone.z0 + zone.z1) / 2, 0.5, 1.7, 8, 0);
    e.obj.position.set(f[0], 0, f[1]);
    return;
  }
  e.obj.position.set(e.startPos[0], e.floorY, e.startPos[1]);
}

function spawnEnemies() {
  for (let i = 0; i < 10; i++) {
    const e = makeEnemy(i);
    placeEnemy(e);
    scene.add(e.obj);
    enemies.push(e);
  }
  rebuildHitMeshes();
}

/* a fresh soldier replaces the ragdoll — same name, same route, new body */
function respawnEnemy(e) {
  const at = enemies.indexOf(e);
  scene.remove(e.obj);
  if (e.gunDropped) scene.remove(e.p.gun);
  e.tag.tex.dispose();
  const ne = makeEnemy(e.idx);
  placeEnemy(ne);
  scene.add(ne.obj);
  if (at >= 0) enemies[at] = ne;
  else enemies.push(ne);
  rebuildHitMeshes();
}
function rebuildHitMeshes() {
  enemyHitMeshes = [];
  for (const e of enemies) {
    if (e.dead) continue;
    enemyHitMeshes.push(e.p.hbHead, e.p.hbBody, e.p.hbLegs);
  }
}
