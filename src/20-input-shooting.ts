'use strict';
/* INPUT */
const keys = Object.create(null);
const SETTINGS = {
  sprintCancelsReload: localStorage.getItem('tf.sprintCancelsReload') !== 'false',
  mouseSensitivity: clamp(Number(localStorage.getItem('tf.mouseSensitivity')) || 1, 0.5, 2),
};
let mouseDX = 0,
  mouseDY = 0;
let discardLockedMouseMoves = 0;
const SENS = 0.0022;
let sensScale = 1; // shrinks with ADS zoom so aim stays 1:1 on screen

function clearLatchedInput() {
  for (const code of Object.keys(keys)) keys[code] = false;
  mouseDX = mouseDY = 0;
  player.spaceEdge = false;
  player.proneEdge = false;
  player.triggerHeld = false;
  player.triggerReleased = true;
  player.sprint = false;
  if (G.gunship) G.gunship.trigger = false;
}

function accumulateMouseInput(dx, dy) {
  /* Pointer-lock transitions can report a desktop-sized warp. No real hand
     movement needs hundreds of counts in one DOM event. */
  mouseDX = clamp(mouseDX + clamp(dx || 0, -90, 90), -180, 180);
  mouseDY = clamp(mouseDY + clamp(dy || 0, -90, 90), -180, 180);
}

addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (REPEAT_BLOCKED_KEYS.includes(e.code)) e.preventDefault();
    return;
  }
  keys[e.code] = true;
  if (e.code === 'Space') player.spaceEdge = true; // consumed by the jump/mantle step
  if (e.code === 'KeyZ') player.proneEdge = true;
  if (
    (e.code === 'ShiftLeft' || e.code === 'ShiftRight') &&
    SETTINGS.sprintCancelsReload &&
    player.reloadT > 0 &&
    keys['KeyW']
  ) {
    interruptReload();
  }
  if (BLOCKED_GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!G.running) return;
  if (G.gunship?.controlled) {
    if (e.code === 'Digit1') selectGunshipWeapon(0);
    if (e.code === 'Digit2') selectGunshipWeapon(1);
    if (e.code === 'Digit3') selectGunshipWeapon(2);
    return;
  }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') switchWeapon(0);
  if (e.code === 'Digit2') switchWeapon(1);
  if (e.code === 'Digit3') switchWeapon(2);
  if (e.code === 'Digit4') switchWeapon(3);
  if (e.code === 'Digit5') switchWeapon(4);
    if (e.code === 'Digit6') switchWeapon(5);
    if (e.code === 'Digit7') switchWeapon(6);
    if (e.code === 'Digit8') switchWeapon(7);
  if (e.code === 'F1') activateStreak(0);
  if (e.code === 'F2') activateStreak(1);
  if (e.code === 'F3') activateStreak(2);
  if (e.code === 'F4') activateStreak(3);
  if (e.code === 'F5') activateStreak(4);
  if (e.code === 'KeyV') startMelee();
  if (e.code === 'KeyB') {
    const w = WEAPONS[player.weapon];
    if (w.semiToggle) {
      w.semi = !w.semi;
      SFX.boltClick();
      updateAmmoUI();
    }
  }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== document.body) return;
  if (discardLockedMouseMoves > 0) {
    discardLockedMouseMoves--;
    return;
  }
  accumulateMouseInput(e.movementX, e.movementY);
});
addEventListener('mousedown', (e) => {
  if (!G.running) return;
  if (G.gunship?.controlled) {
    if (e.button === 0) G.gunship.trigger = true;
    return;
  }
  if (e.button === 0) {
    if (player.sprint) {
      player.sprint = false;
      player.sprintFireRaise = WEAPONS[player.weapon].id === 'shotgun' ? 0 : 0.11;
      keys['ShiftLeft'] = keys['ShiftRight'] = false;
      const vm = WEAPONS[player.weapon].vm;
      if (vm) vm._sprintK = 0;
    }
    player.triggerHeld = true;
    player.clickBuf = 0.12;
    const w = WEAPONS[player.weapon];
    /* A pump gun is click-driven, so consume a valid press in this event
       instead of waiting one requestAnimationFrame. The normal buffer remains
       for presses during sprint raise/pump recovery. */
    if (w.id === 'shotgun' && player.sprintFireRaise <= 0 && player.triggerReleased) {
      if (fireWeapon()) player.clickBuf = 0;
    }
  }
  if (e.button === 2) {
    e.preventDefault();
    toggleADS();
  }
});
addEventListener('mouseup', (e) => {
  if (G.gunship?.controlled && e.button === 0) G.gunship.trigger = false;
  if (e.button === 0) {
    player.triggerHeld = false;
    player.triggerReleased = true;
  }
});
addEventListener(
  'wheel',
  (e) => {
    if (!G.running) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (G.gunship?.controlled) {
      selectGunshipWeapon((G.gunship.weapon + dir + 3) % 3);
      return;
    }
    const n = NORMAL_WEAPON_COUNT;
    switchWeapon((player.weapon + dir + n) % n);
  },
  { passive: true }
);
addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === document.body;
  clearLatchedInput();
  if (locked) discardLockedMouseMoves = 2;
  if (!locked && G.started && !G.over) {
    G.paused = true;
    G.running = false;
    player.ads = false;
    player.adsK = 0;
    player.adsEase = 0;
    UI._scopeK = -1;
    UI.scope.style.opacity = 0;
    compMat.uniforms.scope.value = 0;
    UI.cross.classList.remove('hidden');
    vmRoot.visible = true;
    UI.pause.classList.add('on');
    SFX.suspend();
  } else if (locked) {
    G.paused = false;
    UI.pause.classList.remove('on');
    if (G.started && !G.over) {
      G.running = true;
      SFX.resume();
    }
  }
});
addEventListener('blur', clearLatchedInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearLatchedInput();
});
function requestLock() {
  const p = document.body.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
  /* Fall back to pause if the browser denies pointer lock. */
  clearTimeout((requestLock as any)._t);
  (requestLock as any)._t = setTimeout(() => {
    if (document.pointerLockElement === document.body) return;
    if (!G.started || G.over) return;
    G.paused = true;
    G.running = false;
    UI.pause.classList.add('on');
  }, 350);
}
document.querySelectorAll<HTMLElement>('.mapCard').forEach((card) => {
  const rec = card.dataset.map === 'nuke' ? MAP_NUKE : MAP_YARD;
  card.addEventListener('mouseenter', () => applyMap(rec));
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    SFX.init();
    applyMap(rec);
    startGame();
  });
});
UI.pause.addEventListener('click', () => {
  SFX.init();
  requestLock();
});
$('restartBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  restart();
});
$('menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  showMenu();
});
$('quitBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  showMenu();
});
const shootRay = new THREE.Raycaster();
shootRay.far = 200;
const _fwd = new THREE.Vector3(),
  _rgt = new THREE.Vector3(),
  _up = new THREE.Vector3(0, 1, 0);
const _hitN = new THREE.Vector3();

function currentSpreadMult() {
  const w = WEAPONS[player.weapon];
  const speed = Math.hypot(player.vel.x, player.vel.z);
  let s = w.spread;
  s += (speed / 7) * w.moveSpread;
  if (!player.onGround) s += w.airSpread;
  s *= stanceSpreadMultiplier(w);
  s *= lerp(1, w.adsSpread, player.adsEase);
  return s;
}
function currentRecoilScale(w, adsEase = player.adsEase) {
  const adsStability = lerp(1, w.adsRecoil ?? 0.62, adsEase);
  const magnifiedComp = w.attachments?.optic === 'prism_2_5' ? lerp(1, 0.86, adsEase) : 1;
  return adsStability * magnifiedComp * stanceRecoilMultiplier();
}
function setADS(on) {
  if (on === player.ads) return;
  if (on && (player.dead || !G.running)) return;
  player.ads = on;
  if (!on) {
    player.breathHeld = false;
    player.breathLock = false;
  }
}
function toggleADS() {
  setADS(!player.ads);
}
function switchWeapon(i, force?) {
  if (!force && (i < 0 || i >= NORMAL_WEAPON_COUNT || G.jug)) return;
  if (force && (i < 0 || i >= WEAPONS.length)) return;
  if (i === player.weapon && player.switchTo < 0) return;
  if (player.switching > 0 || player.meleeT > 0) return;
  if (player.reloadT > 0) interruptReload();
  setADS(false);
  player.boltT = 0;
  player.switchTo = i;
  player.holsterAt = 0.14;
  player.switching = WEAPONS[i].drawTime + player.holsterAt;
  SFX.weaponSwap(!!WEAPONS[i].heavy);
}
function fireWeapon() {
  const w = WEAPONS[player.weapon];
  if (player.sprint) {
    player.sprint = false;
    player.sprintFireRaise = w.id === 'shotgun' ? 0 : 0.11;
    keys['ShiftLeft'] = keys['ShiftRight'] = false;
    if (w.vm) w.vm._sprintK = 0;
    if (w.id !== 'shotgun') return false;
  }
  if (player.sprintFireRaise > 0) return false;
  interruptShotgunReloadForFire(w);
  if (reloadBlocksFire(w)) return false;
  if (
    player.fireCooldown > 0 ||
    player.reloadT > 0 ||
    player.switching > 0 ||
    player.pumpT > 0 ||
    player.boltT > 0 ||
    player.meleeT > 0
  )
    return false;
  if (!w.infiniteAmmo && w.mag <= 0) {
    if (player.triggerReleased) {
      SFX.dryFire();
      player.triggerReleased = false;
    }
    if (w.res > 0) startReload();
    return true;
  }
  if (!w.infiniteAmmo) w.mag--;
  discardReloadCheckpoint(w);
  player.fireCooldown = 60 / w.rpm;
  G.shots++;
  player.triggerReleased = false;

  for (const e of enemies) if (!e.dead) e.obj.updateMatrixWorld(true);
  camera.getWorldDirection(_fwd);
  _rgt.crossVectors(_fwd, _up).normalize();
  const upv = new THREE.Vector3().crossVectors(_rgt, _fwd).normalize();
  placeWorldMuzzleFromViewmodel(w.vm.muzzle);

  const spread = currentSpreadMult();
  let anyHit = false,
    killedSomething = false,
    headHit = false;
  const targets = enemyHitMeshes.concat(worldSolid);

  for (let p = 0; p < w.pellets; p++) {
    const dir = _fwd.clone();
    const a = Math.random() * PI * 2;
    const r = (w.pellets > 1 ? Math.sqrt(Math.random()) : Math.random()) * spread;
    dir
      .addScaledVector(_rgt, Math.cos(a) * r)
      .addScaledVector(upv, Math.sin(a) * r)
      .normalize();

    shootRay.set(camera.position, dir);
    shootRay.far = w.range;
    const hits = shootRay.intersectObjects(targets, false);
    let end = camera.position.clone().addScaledVector(dir, w.range);

    if (hits.length) {
      const trace = traceBulletPath(hits, w);
      for (const surface of trace.surfaces) {
        const h = surface.hit;
        _hitN.set(0, 1, 0);
        if (h.face) _hitN.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        fxImpactWall(h.point, _hitN, h.distance);
      }
      const h = trace.terminal;
      if (h) end = h.point.clone();
      if (h && trace.enemy) {
      const ud = h.object.userData;
        const e = ud.enemy;
        const dist = h.distance;
        let dmg = w.damage * trace.damageScale;
        const fo = clamp(1 - Math.max(0, dist - w.falloffStart) / w.falloffRange, w.falloffMin, 1);
        dmg *= fo;
        const isHead = ud.part === 'head';
        if (isHead) dmg *= w.headMult;
        else if (ud.part === 'legs') dmg *= 0.78;
        const killed = damageEnemy(e, dmg, isHead, dir, h.point);
        anyHit = true;
        if (isHead) headHit = true;
        if (killed) killedSomething = true;
        fxImpactFlesh(h.point, dir, dist, isHead);
      }
    }
    if (p === 0 || w.pellets <= 3 || Math.random() < 0.45)
      spawnTracer(
        _muzzleWorld,
        end,
        w.id === 'sniper' ? 0xfff3c8 : 0xffd27a,
        w.id === 'sniper' ? 2.1 : 1
      );
  }

  if (anyHit) {
    G.hits++;
    SFX.hitBeep(headHit);
    showHitmark(killedSomething);
  }

  SFX.gunshot(w.sound, 0, 0);
  alertToGunfire(w.noise || 34);
  w.spread = Math.min(w.spreadMax, w.spread + w.spreadShot);

  /* Recoil is a pattern, not noise: a hard first kick, a settled climb, then a
     lateral drift that reverses. Learnable enough that holding a long burst on
     target is a skill, random enough that it never feels like a rail. */
  const n = player.burstCount++;
  player.burstIdle = 0;
  const vert = n === 0 ? 1.55 : n < 4 ? 1.12 : 0.82 + Math.sin(n * 0.9) * 0.1;
  const drift = Math.sin(n * 0.62) * 0.85 + Math.sin(n * 0.23 + 1.1) * 0.45;
  /* ADS stabilises the weapon regardless of sight type, including irons. The
     previous implementation only compensated the 2.5x prism, so every other
     sight narrowed the picture while keeping full hip-fire angular recoil.
     A magnified optic gets a small extra visual correction, while each weapon
     keeps its own single-shot character through adsRecoil. */
  const recoilScale = currentRecoilScale(w);
  player.recoilVelP += w.camPitch * 38 * vert * recoilScale;
  player.recoilVelY += (drift + (Math.random() - 0.5) * 0.55) * w.camYaw * 38 * recoilScale;
  player.shake = Math.min(1.4, player.shake + w.shakeAmt * 0.5 * lerp(1, 0.68, player.adsEase));
  player.fovKick = Math.min(3.2, player.fovKick + (w.fovKick || 1.0) * recoilScale);
  vmKick(w, recoilScale);
  flashT = flashDur;
  flashPower = w.id === 'shotgun' ? 1.7 : w.id === 'sniper' ? 1.9 : w.id === 'rifle' ? 1.0 : 0.8;

  if (w.id === 'shotgun') {
    player.pumpT = w.pumpTime;
    player.pumpEjected = false;
  } else if (w.id === 'sniper') {
    /* the case only leaves the gun when the bolt is worked */
    player.boltT = w.boltTime;
    player.boltPhase = 0;
    SFX.boltCycle(0);
  } else {
    const ejPos = camera.position
      .clone()
      .addScaledVector(_fwd, 0.36)
      .addScaledVector(_rgt, 0.24)
      .addScaledVector(upv, -0.08);
    ejectShell(ejPos, _rgt.clone().addScaledVector(_fwd, 0.15), false);
  }
  for (let i = 0; i < 2; i++) {
    spawnParticle(
      PS_SOFT,
      _muzzleWorld.x,
      _muzzleWorld.y,
      _muzzleWorld.z,
      _fwd.x * rand(1, 3) + rand(-0.4, 0.4),
      rand(0.2, 0.7),
      _fwd.z * rand(1, 3) + rand(-0.4, 0.4),
      {
        color: [0.62, 0.6, 0.58],
        size: 0.09,
        grow: 0.42,
        life: rand(0.4, 0.8),
        drag: 2.6,
        grav: 0.5,
        alpha: 0.3,
      }
    );
  }
  updateAmmoUI();
  return true;
}

/* -------------------------------------------------------------------------
   Gunfire carries.

   Without this the squad only reacts to what it can see, so a player who works
   one corner of the yard leaves the far patrols standing in a field they never
   left — which is both unconvincing and a way to lose on the clock hunting for
   the last man. Anyone inside earshot walks the shot in instead.
   ------------------------------------------------------------------------- */
function alertSquad(radius, spread, line, chance) {
  const px = player.pos.x,
    pz = player.pos.z;
  /* as the squad thins the survivors stop being a patrol and start being a
     manhunt — otherwise the last man is a hide-and-seek chore on the clock */
  const alive = enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
  if (alive <= 3) radius = Math.max(radius, 200);
  let called = false;
  for (const e of enemies) {
    if (e.dead || e.state === ST.COMBAT) continue;
    const d = Math.hypot(e.obj.position.x - px, e.obj.position.z - pz);
    if (d > radius) continue;
    e.alerted = true;
    e.state = ST.COMBAT;
    e.tacticT = 0;
    e.engage = 0;
    e.cover = null;
    e.saidLost = true; // never had eyes, so nothing to lose
    /* they know roughly where it came from, not exactly */
    e.lastKnown.set(px + rand(-spread, spread), 0, pz + rand(-spread, spread));
    e.lastSeen = 2.6; // stale enough that they hold fire
    e.hunt = 8 + d * 0.28; // long enough to actually get there
    if (!called && Math.random() < chance) {
      called = true;
      comms(e, line(e));
    }
  }
}

let _noiseCd = 0;
function alertToGunfire(radius) {
  if (perfNow - _noiseCd < 0.55) return; // one alert per burst, not per round
  _noiseCd = perfNow;
  alertSquad(
    radius,
    3,
    (e) =>
      pick([
        '发现枪声 — ' + bearingWord(e) + '方向',
        '接敌，正在支援',
        '有枪声，向' + bearingWord(e) + '搜索',
      ]),
    0.7
  );
}

function damageEnemy(e, dmg, head, dir, point, killer?, creditPlayer?) {
  e.hp -= dmg;
  e.flinch = Math.min(1, e.flinch + (head ? 0.9 : 0.55));
  e.alerted = true;
  e.lastSeen = 0;
  if (e.state === ST.PATROL) {
    e.state = ST.ALERT;
    e.reactT = rand(0.14, 0.3);
  }
  if (e.hp <= 0) {
    killEnemy(e, head, dir, killer, creditPlayer);
    return true;
  }
  e.tag.draw(e.hp, true);
  return false;
}

function killEnemy(e, head, dir, killer, creditPlayer?) {
  e.dead = true;
  e.hp = 0;
  e.state = ST.DEAD;
  e.deathT = 0;
  e.deathDir = dir ? Math.atan2(dir.x, dir.z) : 0;
  e.tag.sprite.visible = false;
  rebuildHitMeshes();
  killFeed(e.name, head, killer);
  if (!killer || creditPlayer) {
    /* controlled streak kills score the match but do not feed themselves */
    G.kills++;
    if (!killer) noteKillstreak();
    if (head) G.headshots++;
    SFX.killChime();
    G.killFlash = 1;
    UI.killCount.textContent = G.kills;
    UI.edgeGlow.style.opacity = '0.9';
    setTimeout(() => (UI.edgeGlow.style.opacity = '0'), 130);
  }
  SFX.enemyDeath(
    clamp((e.obj.position.x - camera.position.x) / 14, -1, 1),
    e.obj.position.distanceTo(camera.position)
  );
  /* a man going down is louder than the shot that did it, and the squad's
     reach grows as it shrinks — the survivors come to you */
  alertSquad(
    30 + Math.min(G.kills, 14) * 5,
    5,
    (ex) =>
      pick([e.name + ' 阵亡 — ' + bearingWord(ex), '有人倒下，向我靠拢', e.name + ' 没了，压上去']),
    0.85
  );
  /* deathmatch: the slot refills a few seconds later */
  respawnQueue.push({ e, t: rand(4.5, 6.5) });
}

const vmRec = { pz: 0, py: 0, rx: 0, ry: 0, rz: 0, vz: 0, vy: 0, vrx: 0, vry: 0, vrz: 0 };
function vmKick(w, scale = 1) {
  vmRec.vz += w.recoilKick * 46 * scale;
  vmRec.vy += w.recoilKick * 13 * scale;
  /* The viewmodel points down -Z, so positive local X raises the muzzle.
     A negative impulse pitches it toward the floor and fights camera recoil. */
  vmRec.vrx += w.recoilRot * 46 * scale;
  vmRec.vry += (Math.random() - 0.5) * w.recoilRot * 24 * scale;
  vmRec.vrz += (Math.random() - 0.5) * w.recoilRot * 30 * scale;
}
function damagePlayer(amount, fromPos, killer) {
  if (player.dead || G.over || G.protect > 0) return;
  player.lastHurt = perfNow;
  let dmg = amount;
  if (G.jug) {
    const absorbed = Math.min(player.armor, dmg);
    player.armor -= absorbed;
    dmg -= absorbed;
  }
  if (!G.jug && player.armor > 0) {
    const absorbed = dmg * 0.5;
    player.armor -= absorbed;
    dmg -= absorbed;
    if (player.armor < 0) {
      dmg += -player.armor;
      player.armor = 0;
    }
  }
  player.hp -= dmg;
  G.dmgFlash = Math.min(0.72, G.dmgFlash + clamp(amount / 30, 0.22, 0.55));
  player.shake = Math.min(1.6, player.shake + clamp(amount / 24, 0.18, 0.6));
  damageIndicator(fromPos);
  SFX.damageTaken();
  updateVitalsUI();
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    const operatingGunship = !!G.gunship?.controlled;
    if (operatingGunship) G.gunship.operatorDead = true;
    if (G.jug) exitJuggernaut(false);
    setADS(false);
    updateVitalsUI();
    /* deathmatch: death costs you 2.6 seconds, not the round */
    G.deaths++;
    G.streak = 0; // dying cashes out the killstreak
    killFeed('你', false, killer);
    G.respawnT = 2.6;
    if (!operatingGunship) UI.respawn.classList.add('on');
    pushComms('指挥部', pick(['你已阵亡 — 重新部署已就位', '坚持住 — 增援正在路上']));
  }
}
