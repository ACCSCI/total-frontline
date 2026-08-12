'use strict';
/* =========================================================================
   16. ENEMY AI
   ========================================================================= */
const losRay = new THREE.Raycaster();
losRay.far = 70;
const _eDir = new THREE.Vector3(),
  _ePos = new THREE.Vector3(),
  _eEye = new THREE.Vector3();
const _revDir = new THREE.Vector3();

function enemyEye(e, out) {
  return out.set(e.obj.position.x, e.obj.position.y + 1.62, e.obj.position.z);
}
function playerChest(out) {
  return out.set(player.pos.x, player.pos.y + player.height * 0.62, player.pos.z);
}
/* whoever this enemy is currently engaging: a squadmate (e.tgt) or the player */
function targetChest(e, out) {
  const t = e.tgt;
  if (t) return out.set(t.obj.position.x, t.obj.position.y + 1.1, t.obj.position.z);
  return playerChest(out);
}
function hasLOS(e, tp?) {
  enemyEye(e, _eEye);
  /* tp lets the same test look at a squadmate; default is the player's chest */
  if (tp) _ePos.copy(tp);
  else playerChest(_ePos);
  _eDir.subVectors(_ePos, _eEye);
  const dist = _eDir.length();
  if (dist > 52) return false;
  _eDir.divideScalar(dist);
  /* field of view (skip when already alerted — they've been told where you are) */
  if (!e.alerted) {
    const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
    if (fwd.dot(_eDir) < 0.2) return false;
  }
  /* Trace from the player's end, not the shooter's.
     Materials are single-sided, so a ray that starts inside a container never
     registers its walls — back faces are culled. A soldier who had clipped a
     corner therefore read the yard as wide open and could shoot out through
     steel the player's own bullets stopped dead against. Casting the same
     segment from the player guarantees the two agree: if you can't shoot him,
     he can't shoot you. */
  losRay.set(_ePos, _eDir.clone().negate());
  losRay.far = dist - 0.4;
  const hits = losRay.intersectObjects(worldSolid, false);
  return hits.length === 0;
}

/**
 * Can the gun, as opposed to the eye, actually reach the player?
 *
 * A head over a parapet or a shoulder past a container corner gives clear eye
 * LOS while the muzzle — 30cm lower and offset to the side — still points into
 * steel. Firing on eye LOS alone puts a soldier in the open emptying magazines
 * into the crate in front of him: the rounds stop correctly, but what you see
 * is a man shooting a box. One ray, and only when he is about to start a burst.
 */
const _mzTmp = new THREE.Vector3();
function muzzleClear(e) {
  e.p.gunMuzzle.getWorldPosition(_mzTmp);
  targetChest(e, _ePos);
  _revDir.subVectors(_mzTmp, _ePos);
  const len = _revDir.length();
  if (len < 0.8) return true;
  _revDir.divideScalar(len);
  losRay.set(_ePos, _revDir);
  losRay.far = len - 0.35;
  return losRay.intersectObjects(worldSolid, false).length === 0;
}

function enemyShoot(e, atPoint?) {
  enemyEye(e, _eEye);
  const muzzle = _eEye.clone();
  e.p.gunMuzzle.getWorldPosition(muzzle);
  targetChest(e, _ePos);
  /* suppressive fire is walked onto a map point, not a body */
  const tgt = atPoint ? null : e.tgt || null;
  const aim = atPoint ? _tmpAim.set(atPoint.x, 1.2, atPoint.z) : _ePos;
  const dist = muzzle.distanceTo(_ePos);
  const speed = tgt ? tgt.speed : Math.hypot(player.vel.x, player.vel.z);
  /* Human-ish accuracy: worse at range, worse against a moving target, and it
     tightens the longer they have been shooting at you — standing still is what
     gets you killed, not being seen.

     The opening burst is deliberately wide. A squad that lands four rounds the
     instant it sees you isn't dangerous, it's just unfair: you die before you
     know which direction it came from. Missing first means the player gets the
     crack and the dust puff as a warning and has a couple of seconds to break
     contact, and the shots that do land later feel earned. */
  const warm = atPoint ? 2.2 : lerp(1.55, 0.8, clamp((e.engage || 0) / 5.5, 0, 1));
  const err =
    0.04 * warm * (1 + dist * 0.028) * (1 + speed * 0.075) * (!tgt && player.crouch ? 1.15 : 1);
  const dir = aim.clone().sub(muzzle).normalize();
  const rgt = new THREE.Vector3().crossVectors(dir, _up).normalize();
  const upv = new THREE.Vector3().crossVectors(rgt, dir).normalize();
  const a = Math.random() * PI * 2,
    r = Math.sqrt(Math.random()) * err * 2.4;
  dir
    .addScaledVector(rgt, Math.cos(a) * r)
    .addScaledVector(upv, Math.sin(a) * r)
    .normalize();

  enemyMuzzleFlash(muzzle);
  const pan = clamp((e.obj.position.x - camera.position.x) / 16, -1, 1);
  SFX.gunshot(Math.random() < 0.5 ? 'rifle' : 'pistol', pan, dist);

  /* trace against the world, then test every friendly capsule on the way */
  losRay.set(muzzle, dir);
  losRay.far = 90;
  const hits = losRay.intersectObjects(worldSolid, false);
  const wallDist = hits.length ? hits[0].distance : 90;

  /* ray vs vertical cylinder; nearest body along the ray takes the hit */
  let tHit = Infinity,
    hitWho = null; // null = the player, an ally object otherwise
  const testBody = (bx, bz, by0, by1, rad, who) => {
    const px = bx - muzzle.x,
      pz = bz - muzzle.z;
    const dx = dir.x,
      dz = dir.z;
    const dd = dx * dx + dz * dz;
    if (dd < 1e-6) return;
    const t = (px * dx + pz * dz) / dd;
    if (t <= 0 || t >= tHit) return;
    const lateral = Math.hypot(dx * t - px, dz * t - pz);
    if (lateral >= rad) return;
    const y = muzzle.y + dir.y * t;
    if (y > by0 && y < by1) {
      tHit = t;
      hitWho = who;
    }
  };
  if (!player.dead)
    testBody(
      player.pos.x,
      player.pos.z,
      player.pos.y + 0.05,
      player.pos.y + player.height,
      P_RADIUS * 1.05,
      null
    );
  for (const al of allies) {
    if (al.dead) continue;
    testBody(
      al.obj.position.x,
      al.obj.position.z,
      al.obj.position.y + 0.05,
      al.obj.position.y + 1.7,
      P_RADIUS * 1.05,
      al
    );
  }
  const end = muzzle
    .clone()
    .addScaledVector(dir, Math.min(wallDist, tHit === Infinity ? 90 : tHit));
  spawnTracer(muzzle, end, 0xff9a5a, 1.25);

  /* Confirm the path from the victim's end before it costs health — same
     back-face problem as hasLOS, and this is the one that actually hurts. */
  let clearPath = tHit < wallDist;
  if (clearPath) {
    if (hitWho)
      _ePos.set(hitWho.obj.position.x, hitWho.obj.position.y + 1.1, hitWho.obj.position.z);
    _revDir.subVectors(muzzle, _ePos);
    const revLen = _revDir.length();
    if (revLen > 0.6) {
      _revDir.divideScalar(revLen);
      losRay.set(_ePos, _revDir);
      losRay.far = revLen - 0.35;
      if (losRay.intersectObjects(worldSolid, false).length) clearPath = false;
    }
  }

  if (clearPath) {
    const dmg = rand(5.5, 9.0) * clamp(1 - Math.max(0, dist - 25) / 55, 0.5, 1);
    if (hitWho) damageAlly(hitWho, dmg, e.obj.position, e.name);
    else damagePlayer(dmg, e.obj.position, e.name);
  } else if (hits.length) {
    const n = hits[0].face
      ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    fxImpactWall(hits[0].point, n, hits[0].distance);
    /* near-miss whip crack */
    if (hits[0].point.distanceTo(camera.position) < 4.5 && Math.random() < 0.6) {
      SFX.impactWall(clamp((hits[0].point.x - camera.position.x) / 6, -1, 1), 2);
    }
  }
}

/* -------------------------------------------------------------------------
   Cover anchors.

   Derived from the map footprints: one standing spot off the middle of each
   face. An enemy holding one of these has the box between it and wherever the
   player was when it chose, which is enough to read as deliberate.
   ------------------------------------------------------------------------- */
/* cover anchors around every mapped structure — derived per map by
   deriveCover() in the registry and installed here by applyMap */
let COVER = [];
function pickCover(e, tx, tz) {
  let best = null,
    bestScore = Infinity;
  const ex = e.obj.position.x,
    ez = e.obj.position.z;
  for (let i = 0; i < COVER.length; i++) {
    const c = COVER[i];
    if (Math.abs(c.x) > HALF - 1.5 || Math.abs(c.z) > HALF - 1.5) continue;
    const dp = Math.hypot(c.x - tx, c.z - tz);
    if (dp < 7 || dp > 24) continue; // not on top of him, not a different postcode
    /* the anchor must sit on the far side of its own box from the target */
    const ax = c.x - c.ox,
      az = c.z - c.oz;
    const px = tx - c.ox,
      pz = tz - c.oz;
    if (ax * px + az * pz > 0) continue;
    const de = Math.hypot(c.x - ex, c.z - ez);
    if (de > 20) continue;
    const score = de + Math.abs(dp - 13) * 0.8;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------
   Squad comms. Text callouts with a radio blip. Costs nothing and does more
   for "these things are co-ordinating" than any amount of steering code.
   ------------------------------------------------------------------------- */
const COMMS_COOLDOWN: { last?: number } = {};
function comms(e, text, priority?) {
  if (!G.running || G.over) return;
  const now = perfNow;
  if (!priority && COMMS_COOLDOWN.last && now - COMMS_COOLDOWN.last < 1700) return;
  if (COMMS_COOLDOWN.last && now - COMMS_COOLDOWN.last < 420) return;
  COMMS_COOLDOWN.last = now;
  pushComms(e ? e.name : '指挥部', text);
  SFX.radio();
}

const _wpDir = new THREE.Vector3();
const _tmpAim = new THREE.Vector3();
const MAX_SHOOTERS = 2;
let _sweepAt = 0;
/* compass bearing of an enemy relative to the player, for callouts */
function bearingWord(e) {
  const dx = e.obj.position.x - player.pos.x,
    dz = e.obj.position.z - player.pos.z;
  const a = Math.atan2(dx, -dz); // 0 = north (-Z)
  const i = Math.round(((a + PI * 2) % (PI * 2)) / (PI / 4)) % 8;
  return ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][i];
}
/**
 * Combat director: everyone with eyes on the player keeps manoeuvring, but only
 * the nearest few are cleared to shoot. Without this, standing in the open means
 * six simultaneous shooters and an unwinnable 30 dps.
 */
const _active = [];
function updateCombatDirector() {
  _active.length = 0;
  for (const e of enemies) {
    e.mayFire = false;
    if (!e.dead && e.state === ST.COMBAT && e.canSee) _active.push(e);
  }
  /* Endgame sweep. An alert decays after a few seconds of no contact, which is
     right in the middle of a fight and wrong at the end of one: the last man
     drops back onto his patrol loop and the round turns into hide-and-seek
     against a clock. Once the squad is nearly gone the survivors keep getting
     re-tasked onto the player's rough position until somebody finds him. */
  if (G.running && perfNow > _sweepAt) {
    let alive = 0;
    for (const e of enemies) if (!e.dead) alive++;
    if (alive > 0 && alive <= 3) {
      _sweepAt = perfNow + 6000;
      for (const e of enemies) {
        if (e.dead || e.canSee) continue;
        e.alerted = true;
        e.state = ST.COMBAT;
        e.saidLost = true;
        e.cover = null;
        e.hunt = Math.max(e.hunt, 9);
        const f = nearestFree(
          player.pos.x + rand(-4, 4),
          player.pos.z + rand(-4, 4),
          0.5,
          1.7,
          6,
          e.obj.position.y
        );
        e.lastKnown.set(f[0], e.obj.position.y, f[1]);
      }
    }
  }

  if (G.grace > 0 || G.empT > 0) return; // spotted and closing, but holding fire
  _active.sort(
    (a, b) =>
      a.obj.position.distanceToSquared(camera.position) -
      b.obj.position.distanceToSquared(camera.position)
  );
  for (let i = 0; i < Math.min(MAX_SHOOTERS, _active.length); i++) _active[i].mayFire = true;
}

/* =========================================================================
   16b. ALLIES — a three-man fireteam on the player's side. They hold a loose
   wedge off the player's shoulder and engage whatever they can see; enemies
   pick between them and the player in updateEnemy's perception pass (e.tgt).
   ========================================================================= */
const ALLY_NAMES = ['磐石', '猎鹰', '流星'];
const allies = [];
const _allyT = new THREE.Vector3();
/* blue IFF strobe, so a squadmate never reads as a hostile silhouette */
const ALLY_ACCENT = new THREE.MeshStandardMaterial({
  color: 0x2a7aff,
  emissive: 0x1a5aff,
  emissiveIntensity: 1.6,
  roughness: 0.5,
});
linearizeMats({ accent: ALLY_ACCENT });

function allyChest(a, out) {
  return out.set(a.obj.position.x, a.obj.position.y + 1.1, a.obj.position.z);
}
const _aEye = new THREE.Vector3(),
  _aDir = new THREE.Vector3();
/* traced from the target's end, same back-face reasoning as hasLOS */
function allyLOS(a, tp) {
  _aEye.set(a.obj.position.x, a.obj.position.y + 1.62, a.obj.position.z);
  _aDir.subVectors(tp, _aEye);
  const dist = _aDir.length();
  if (dist < 0.5) return true;
  _aDir.divideScalar(dist);
  losRay.set(tp, _aDir.clone().negate());
  losRay.far = dist - 0.4;
  return losRay.intersectObjects(worldSolid, false).length === 0;
}

function makeAlly(i) {
  const parts = buildEnemyModel();
  parts.model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material === E_MAT.accent) o.material = ALLY_ACCENT;
  });
  const obj = new THREE.Group();
  obj.add(parts.model);
  const tag = makeTag(ALLY_NAMES[i], '#7ab8ff');
  obj.add(tag.sprite);
  return {
    ally: true,
    idx: i,
    name: ALLY_NAMES[i],
    obj,
    tag,
    p: parts,
    hp: 100,
    dead: false,
    yaw: rand(0, 7),
    targetYaw: 0,
    speed: 0,
    walkPhase: rand(0, 7),
    scanT: rand(0, 0.2),
    reactT: 0,
    fireT: 0,
    burst: 0,
    tgt: null,
    cb: 0,
    deathT: 0,
    aimPitch: 0,
  };
}
function placeAlly(a) {
  const f = nearestReachable(SPAWN.x + rand(-2.5, 2.5), SPAWN.z + rand(-2.5, 2.5), 0.5, 1.7, 6);
  a.obj.position.set(f[0], 0, f[1]);
}
function spawnAllies() {
  clearAllies();
  for (let i = 0; i < ALLY_NAMES.length; i++) {
    const a = makeAlly(i);
    placeAlly(a);
    scene.add(a.obj);
    allies.push(a);
  }
}
function clearAllies() {
  for (const a of allies) {
    scene.remove(a.obj);
    a.tag.tex.dispose();
  }
  allies.length = 0;
}
/* the body is reused — same soldier picks himself up at the spawn */
function respawnAlly(a) {
  a.hp = 100;
  a.dead = false;
  a.deathT = 0;
  a.tgt = null;
  a.burst = 0;
  a.p.model.rotation.set(0, 0, 0);
  a.p.model.position.set(0, 0, 0);
  placeAlly(a);
  a.tag.draw(100, false);
}
function damageAlly(a, dmg, fromPos, killer) {
  if (a.dead || G.over) return;
  a.hp -= dmg;
  if (a.hp > 0) {
    a.tag.draw(a.hp, false);
    return;
  }
  a.hp = 0;
  a.dead = true;
  a.deathT = 0;
  a.tag.sprite.visible = false;
  killFeed(a.name, false, killer);
  comms(null, a.name + ' 阵亡 — 正在重新集结', true);
  respawnQueue.push({ e: a, t: 8 });
}

const _aMuz = new THREE.Vector3(),
  _aEnd = new THREE.Vector3();
function allyShoot(a, e) {
  a.p.gunMuzzle.getWorldPosition(_aMuz);
  _aEnd.set(e.obj.position.x, e.obj.position.y + 1.25, e.obj.position.z);
  const dist = _aMuz.distanceTo(_aEnd);
  enemyMuzzleFlash(_aMuz);
  const pan = clamp((_aMuz.x - camera.position.x) / 16, -1, 1);
  SFX.gunshot('rifle', pan, dist);
  /* the world gets first claim on the round: a wall between them eats it */
  _aDir.subVectors(_aEnd, _aMuz).divideScalar(dist);
  losRay.set(_aMuz, _aDir);
  losRay.far = dist + 1;
  const hits = losRay.intersectObjects(worldSolid, false);
  if (hits.length && hits[0].distance < dist - 0.3) {
    _aEnd.copy(hits[0].point);
  } else {
    /* human-ish hit chance: range and a sprinting target both thin it out */
    const chance = clamp(0.62 - dist * 0.009 - e.speed * 0.05, 0.12, 0.62);
    if (Math.random() < chance) {
      const head = Math.random() < 0.12;
      damageEnemy(e, rand(9, 16), head, _aDir, _aEnd, a.name);
    }
  }
  spawnTracer(_aMuz, _aEnd, 0xffd27a, 1);
}

/* wedge offsets in player space: [right, behind] — clear of his line of fire */
const ALLY_FORM = [
  [-1.7, 2.3],
  [1.7, 2.3],
  [0, 3.6],
];
function updateAlly(a, dt) {
  const obj = a.obj,
    p = a.p;

  /* death: keel over, the respawn queue brings him back */
  if (a.dead) {
    if (a.deathT < 1) {
      a.deathT = Math.min(1, a.deathT + dt / 0.85);
      const k = easeOutCubic(a.deathT);
      p.model.rotation.x = k * (PI * 0.5) * 0.98;
      p.model.position.y = -k * 0.1;
    }
    return;
  }

  /* ---------- target scan: nearest visible hostile ---------- */
  a.scanT -= dt;
  if (a.scanT <= 0) {
    a.scanT = 0.16;
    let best = null,
      bd = 45;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.obj.position.x - obj.position.x, e.obj.position.z - obj.position.z);
      if (
        d < bd &&
        allyLOS(a, _allyT.set(e.obj.position.x, e.obj.position.y + 1.3, e.obj.position.z))
      ) {
        bd = d;
        best = e;
      }
    }
    if (best && best !== a.tgt) {
      a.reactT = rand(0.35, 0.8); // human reaction delay
      if (Math.random() < 0.4) comms(a, pick(['发现敌人', '接敌，正在开火', '目标出现，压制他']));
    }
    if (!best) a.reactT = 0;
    a.tgt = best;
  }

  /* ---------- formation follow ---------- */
  const fy = player.yaw;
  const f = ALLY_FORM[a.idx % ALLY_FORM.length];
  const tx = player.pos.x + Math.cos(fy) * f[0] + Math.sin(fy) * f[1];
  const tz = player.pos.z - Math.sin(fy) * f[0] + Math.cos(fy) * f[1];
  const dxF = tx - obj.position.x,
    dzF = tz - obj.position.z;
  const dF = Math.hypot(dxF, dzF);
  let sp = 0;
  if (dF > 2.2) {
    sp = dF > 8 ? 5.5 : 3.2; // hustles to catch up, walks inside the wedge
    moveSlide(obj.position, (dxF / dF) * sp * dt, (dzF / dF) * sp * dt, 0.42, 1.7);
    obj.position.x = clamp(obj.position.x, -HALF + 1, HALF - 1);
    obj.position.z = clamp(obj.position.z, -HALF + 1, HALF - 1);
  }
  /* left far behind or wedged on geometry: rejoin on open ground */
  if (dF > 16) {
    const nf = nearestFree(
      player.pos.x + rand(-3, 3),
      player.pos.z + rand(-3, 3),
      0.5,
      1.7,
      6,
      obj.position.y
    );
    obj.position.x = nf[0];
    obj.position.z = nf[1];
  }
  a.speed = damp(a.speed, sp, 10, dt);

  const gy = groundAt(obj.position.x, obj.position.z, obj.position.y + 0.75);
  if (gy !== null) {
    if (obj.position.y > gy + 0.05) obj.position.y = Math.max(gy, obj.position.y - 12 * dt);
    else obj.position.y = gy;
  } else obj.position.y = Math.max(0, obj.position.y - 12 * dt);

  /* ---------- engage ---------- */
  const e = a.tgt && !a.tgt.dead ? a.tgt : null;
  if (e) {
    const dEx = e.obj.position.x - obj.position.x,
      dEz = e.obj.position.z - obj.position.z;
    a.targetYaw = Math.atan2(dEx, dEz) + PI;
    a.aimPitch = lerp(
      a.aimPitch,
      clamp(Math.atan2(e.obj.position.y - obj.position.y - 0.4, Math.hypot(dEx, dEz)), -0.7, 0.7),
      dt * 8
    );
    if (a.reactT > 0) {
      a.reactT -= dt;
    } else if (G.grace <= 0 && G.empT <= 0) {
      a.fireT -= dt;
      if (a.fireT <= 0) {
        if (a.burst <= 0) a.burst = randI(2, 4);
        a.burst--;
        allyShoot(a, e);
        a.fireT = a.burst > 0 ? rand(0.11, 0.16) : rand(0.7, 1.4);
      }
    }
  } else {
    a.burst = 0;
    a.targetYaw = player.yaw; // no contact: watch where the player watches
    a.aimPitch = lerp(a.aimPitch, 0, dt * 4);
  }

  /* ---------- facing ---------- */
  let dyw = a.targetYaw - a.yaw;
  while (dyw > PI) dyw -= PI * 2;
  while (dyw < -PI) dyw += PI * 2;
  a.yaw += dyw * Math.min(1, dt * (e ? 9 : 4.2));
  obj.rotation.y = a.yaw;

  /* ---------- animation (same rig poses as the hostiles) ---------- */
  const walk = clamp(a.speed / 2.4, 0, 1);
  a.walkPhase += dt * (3.0 + a.speed * 2.2);
  const s1 = Math.sin(a.walkPhase),
    c1 = Math.cos(a.walkPhase);
  p.legs[0].hip.rotation.x = s1 * 0.62 * walk;
  p.legs[1].hip.rotation.x = -s1 * 0.62 * walk;
  p.legs[0].knee.rotation.x = Math.max(0, -Math.cos(a.walkPhase)) * 0.7 * walk;
  p.legs[1].knee.rotation.x = Math.max(0, Math.cos(a.walkPhase)) * 0.7 * walk;
  p.body.position.y = Math.abs(c1) * 0.045 * walk;
  p.body.rotation.z = s1 * 0.035 * walk;
  a.cb = damp(a.cb, e ? 1 : 0, 7, dt);
  const cb = a.cb;
  p.arms[0].sh.rotation.x = lerp(0.85 + s1 * 0.25 * walk, 1.5, cb);
  p.arms[0].sh.rotation.z = lerp(0.65, 0.62, cb);
  p.arms[0].el.rotation.x = lerp(-0.11, -0.15, cb);
  p.arms[1].sh.rotation.x = lerp(1.12 - s1 * 0.25 * walk, 1.99, cb);
  p.arms[1].sh.rotation.z = lerp(-0.28, -0.68, cb);
  p.arms[1].el.rotation.x = lerp(-1.39, -1.69, cb);
  p.gun.position.set(lerp(0.14, 0.1, cb), lerp(-0.3, -0.05, cb), lerp(-0.2, -0.26, cb));
  p.gun.rotation.set(lerp(-0.42, 0, cb), lerp(-0.16, 0, cb), lerp(0.2, 0, cb));
  p.rig.rotation.x = lerp(0, a.aimPitch, cb);
  p.head.rotation.x = lerp(0, a.aimPitch * 0.5, cb);

  /* nameplate — same zoom-cancelling as the hostiles */
  const dCam = obj.position.distanceTo(camera.position);
  a.tag.sprite.visible = G.started && dCam < 46;
  if (a.tag.sprite.visible) {
    const s = clamp(dCam * 0.055, 0.85, 2.4) * (camera.fov / BASE_FOV);
    a.tag.sprite.scale.set(1.55 * s, 0.46 * s, 1);
    a.tag.sprite.position.y = 2.16;
  }
}
