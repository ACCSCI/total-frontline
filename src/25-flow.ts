'use strict';
/* =========================================================================
   19. GAME FLOW
   ========================================================================= */
function clearEnemies() {
  for (const e of enemies) {
    scene.remove(e.obj);
    if (e.gunDropped) scene.remove(e.p.gun); // reparented on death
    e.tag.tex.dispose();
  }
  enemies.length = 0;
}
function restorePlayerViewmodel() {
  for (const w of WEAPONS) w.vm.group.visible = false;
  const active = WEAPONS[player.weapon] || WEAPONS[0];
  active.vm.group.visible = true;
  vmRoot.visible = !player.dead && !G.gunship?.controlled;
}
function resetWorldState() {
  if (G.gunship) endGunship('reset');
  exitJuggernaut(false);
  clearAllReloadProgress();
  for (const w of WEAPONS) {
    w.mag = w.magSize;
    w.res = w.reserve;
    w.spread = w.spreadBase;
    w.semi = false;
    w.vm.group.visible = false;
  }
  player.pos.set(SPAWN.x, 0, SPAWN.z);
  player.vel.set(0, 0, 0);
  player.yaw = CUR.spawnYaw || 0; // face into the map, not the fence
  player.pitch = 0;
  player.hp = 100;
  player.armor = 50;
  player.dead = false;
  player.lastHurt = 0;
  player.weapon = 0;
  player.switching = 0;
  player.switchTo = -1;
  player.reloadT = 0;
  player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = 0;
  player.meleeT = 0;
  player.pumpT = 0;
  player.boltT = 0;
  player.fireCooldown = 0;
  player.triggerHeld = false;
  player.clickBuf = 0;
  player.triggerReleased = true;
  player.recoilPitch = player.recoilYaw = player.recoilVelP = player.recoilVelY = 0;
  player.burstCount = 0;
  player.burstIdle = 0;
  player.fovKick = 0;
  player.shake = 0;
  player.landShake = 0;
  player.crouch = false;
  player.prone = false;
  player.proneEdge = false;
  player.height = STAND_H;
  player.eye = STAND_H;
  player.ads = false;
  player.adsK = 0;
  player.adsEase = 0;
  player.swayAmp = 1;
  player.breath = 0;
  player.breathHeld = false;
  player.breathLock = false;
  player.mantleT = 0;
  player.mantleTilt = 0;
  player.jumpsLeft = 1;
  player.spaceEdge = false;
  sensScale = 1;
  fovCur = BASE_FOV;
  vmRoot.visible = true;
  vmCamera.position.z = 0;
  vmCamera.fov = VM_FOV;
  vmCamera.updateProjectionMatrix();
  UI._scopeK = -1;
  UI.scope.style.opacity = 0;
  compMat.uniforms.scope.value = 0;
  compMat.uniforms.gunship.value = 0;
  UI.cross.classList.remove('hidden');
  UI._crossHidden = false;
  crossSpread = 0;
  crossFireT = 0;
  crossShots = G.shots; // redeploy with the reticle already closed
  UI.breathTag.classList.remove('on');
  UI._breathTip = null;
  restorePlayerViewmodel();

  clearEnemies();
  spawnEnemies();
  clearAllies();

  for (const d of DECALS) d.visible = false;
  for (const s of SHELLS) {
    s.life = 0;
    s.mesh.visible = false;
    s.mesh.scale.setScalar(1);
  }
  for (const t of TRACERS) t.mesh.visible = false;
  for (const sys of [PS_SPARK, PS_SOFT]) {
    for (let i = 0; i < sys.count; i++) {
      sys.data[i].life = 0;
      sys.alp[i] = 0;
    }
    sys.geo.attributes.palpha.needsUpdate = true;
  }
  UI.feed.innerHTML = '';

  G.time = 600;
  G.kills = 0;
  G.deaths = 0;
  G.respawnT = 0;
  G.protect = 0;
  G.streak = 0;
  G.uavT = 0;
  G.empT = 0;
  G.airstrike = null;
  G.streaksReady.length = 0;
  G.jug = false;
  player.armorMax = 50;
  if (G.heli) {
    scene.remove(G.heli.obj);
    G.heli = null;
  }
  updateStreakDock();
  G.headshots = 0;
  G.shots = 0;
  G.hits = 0;
  G.elapsed = 0;
  G.over = false;
  G.dmgFlash = 0;
  G.lowPulse = 0;
  G.hbTimer = 0;
  G.killFlash = 0;
  G.grace = GRACE_TIME;
  respawnQueue.length = 0;
  UI.respawn.classList.remove('on');
  _sweepAt = 0;
  _noiseCd = 0;
  UI.killCount.textContent = '0';
  updateVitalsUI();
  updateAmmoUI();
}

/* deathmatch redeploy: fresh body and loadout at the spawn, the scoreboard
   and the clock keep running. Two seconds of protection against spawn campers. */
function respawnPlayer() {
  exitJuggernaut(false);
  clearAllReloadProgress();
  for (const w of WEAPONS) {
    w.mag = w.magSize;
    w.res = w.reserve;
    w.spread = w.spreadBase;
    w.semi = false;
    w.vm.group.visible = false;
  }
  player.pos.set(SPAWN.x, 0, SPAWN.z);
  player.vel.set(0, 0, 0);
  player.yaw = CUR.spawnYaw || 0;
  player.pitch = 0;
  player.hp = 100;
  player.armor = 50;
  player.dead = false;
  player.lastHurt = 0;
  player.weapon = 0;
  player.switching = 0;
  player.switchTo = -1;
  player.reloadT = 0;
  player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = 0;
  player.meleeT = 0;
  player.pumpT = 0;
  player.boltT = 0;
  player.fireCooldown = 0;
  player.triggerHeld = false;
  player.clickBuf = 0;
  player.triggerReleased = true;
  player.recoilPitch = player.recoilYaw = player.recoilVelP = player.recoilVelY = 0;
  player.crouch = false;
  player.prone = false;
  player.proneEdge = false;
  player.height = STAND_H;
  player.eye = STAND_H;
  player.ads = false;
  player.adsK = 0;
  player.adsEase = 0;
  player.mantleT = 0;
  player.jumpsLeft = 1;
  player.shake = 0;
  player.landShake = 0;
  player.armorMax = 50;
  G.jug = false; // the suit is lost with the body
  restorePlayerViewmodel();
  G.protect = 2.0;
  G.dmgFlash = 0;
  updateVitalsUI();
  updateAmmoUI();
}

/* ------------------------- killstreaks -------------------------
   3 侦察机 / 5 空袭 / 7 电磁脉冲 / 8 武装直升机 / 10 空中炮艇 / 12 无畏战士。
   达标只进待命栏（屏幕左侧），按 F1–F5 手动释放；阵亡清连杀，不清已就绪奖励。 */
const STREAK_LADDER = [
  { at: 3, id: 'uav', name: '无人侦察机' },
  { at: 5, id: 'airstrike', name: '空袭' },
  { at: 7, id: 'emp', name: '电磁脉冲' },
  { at: 8, id: 'heli', name: '武装直升机' },
  { at: 10, id: 'gunship', name: '空中炮艇' },
  { at: 12, id: 'juggernaut', name: '无畏战士' },
];
/* the banner under the timer — comms text alone was too easy to miss */
function streakPop(text) {
  UI.streakPop.textContent = text;
  UI.streakPop.classList.remove('on');
  void UI.streakPop.offsetWidth;
  UI.streakPop.classList.add('on');
  clearTimeout((streakPop as any)._t);
  (streakPop as any)._t = setTimeout(() => UI.streakPop.classList.remove('on'), 2600);
}
function noteKillstreak() {
  G.streak++;
  for (const s of STREAK_LADDER) {
    if (s.at !== G.streak) continue;
    if (G.streaksReady.length >= 5) break; // the dock has five slots, F1–F5
    G.streaksReady.push(s);
    updateStreakDock();
    streakPop(s.name + ' 已就绪 — 按 F' + G.streaksReady.length);
    SFX.radio();
  }
}
function activateStreak(i) {
  const s = G.streaksReady[i];
  if (!s || player.dead || !G.running) return;
  G.streaksReady.splice(i, 1);
  updateStreakDock();
  streakPop(s.name + ' 已激活');
  if (s.id === 'uav') {
    G.uavT = 25;
    comms(null, '无人侦察机上线 — 全图敌情可见', true, 'uav');
  } else if (s.id === 'airstrike') {
    callAirstrike();
  } else if (s.id === 'emp') {
    G.empT = 12;
    comms(null, '电磁脉冲释放 — 敌方火力瘫痪', true);
  } else if (s.id === 'heli') {
    callHeli();
  } else if (s.id === 'gunship') {
    callGunship();
  } else if (s.id === 'juggernaut') {
    goJuggernaut();
  }
}
function callAirstrike() {
  /* aim where the squad is thickest: the living enemy with the most company */
  let best = null,
    bestN = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    let n = 0,
      cx = 0,
      cz = 0;
    for (const o of enemies) {
      if (o.dead) continue;
      if (e.obj.position.distanceTo(o.obj.position) < 9) {
        n++;
        cx += o.obj.position.x;
        cz += o.obj.position.z;
      }
    }
    if (n > bestN) {
      bestN = n;
      best = { x: cx / n, z: cz / n };
    }
  }
  if (!best) return;
  comms(null, '空袭就位 — 注意躲避', true, 'airstrike');
  G.airstrike = { x: best.x, z: best.z, t: 1.4, n: 3 };
}
const _blastDir = new THREE.Vector3();
function explodeAt(x, z, killer?) {
  killer = killer || '空袭';
  const gy = groundAt(x, z, 3);
  const y = gy === null ? 0 : gy;
  for (let i = 0; i < 22; i++)
    spawnParticle(PS_SOFT, x, y + 0.4, z, rand(-5, 5), rand(2.5, 9), rand(-5, 5), {
      color: [0.32, 0.3, 0.28],
      size: rand(0.5, 1.1),
      life: rand(0.7, 1.5),
      alpha: 0.55,
      drag: 1.2,
      grav: -2.5,
    });
  for (let i = 0; i < 18; i++)
    spawnParticle(PS_SPARK, x, y + 0.3, z, rand(-9, 9), rand(3, 13), rand(-9, 9), {
      color: i < 6 ? [1.0, 0.9, 0.6] : [1.0, 0.55, 0.2],
      size: rand(0.05, 0.12),
      life: rand(0.25, 0.6),
      drag: 0.8,
      grav: -16,
    });
  const dCam = Math.hypot(x - camera.position.x, z - camera.position.z);
  SFX.boom(clamp((x - camera.position.x) / 16, -1, 1), dCam);
  player.shake = Math.min(1.6, player.shake + clamp(1.3 - dCam / 26, 0, 1.1));
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.obj.position.x - x, e.obj.position.z - z);
    if (d < 6.5) {
      _blastDir.set(e.obj.position.x - x, 0, e.obj.position.z - z);
      damageEnemy(e, 400 * clamp(1 - d / 8, 0.35, 1), false, _blastDir, e.obj.position, killer);
    }
  }
  const dp = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (dp < 5) damagePlayer(60 * clamp(1 - dp / 6, 0.3, 1), _blastDir.set(x, y, z), killer);
}

/* ------------------- attack helo / gunship -------------------
   An orbiting gun platform that strafes whatever has sky. Houses genuinely
   protect: the LOS ray from the orbit eats their roofs, so indoors is safe. */
const HELI_MAT = new THREE.MeshStandardMaterial({
  color: 0x33383d,
  roughness: 0.55,
  metalness: 0.35,
});
const HELI_GLASS = new THREE.MeshStandardMaterial({
  color: 0x1c2836,
  roughness: 0.15,
  metalness: 0.3,
});
linearizeMats({ HELI_MAT, HELI_GLASS });

function buildHeli() {
  const g = new THREE.Group();
  part(g, B(2.1, 1.25, 4.4), HELI_MAT, 0, 0, 0); // fuselage
  part(g, B(1.7, 0.85, 1.3), HELI_GLASS, 0, 0.12, -2.3); // canopy
  part(g, B(0.5, 0.5, 3.6), HELI_MAT, 0, 0.25, 3.7); // tail boom
  part(g, B(0.14, 1.3, 0.8), HELI_MAT, 0, 0.9, 5.3); // fin
  part(g, B(0.14, 0.5, 1.4), HELI_MAT, 0, 0.35, 5.3);
  for (const s of [-1, 1]) {
    part(g, B(0.12, 0.12, 2.8), HELI_MAT, s * 0.85, -1.05, -0.2); // skids
    part(g, B(0.1, 0.5, 0.1), HELI_MAT, s * 0.85, -0.75, -1.2);
    part(g, B(0.1, 0.5, 0.1), HELI_MAT, s * 0.85, -0.75, 0.9);
  }
  part(g, B(3.4, 0.18, 0.9), HELI_MAT, 0, -0.1, 0.1); // stub wings
  part(g, CYLZ(0.07, 0.07, 1.0, 8), HELI_MAT, 0, -0.55, -2.6); // chin gun
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.95, 0);
  part(rotor, B(8.0, 0.05, 0.4), HELI_MAT, 0, 0, 0);
  part(rotor, B(0.4, 0.05, 8.0), HELI_MAT, 0, 0, 0);
  part(rotor, CYL(0.12, 0.12, 0.5, 8), HELI_MAT, 0, -0.1, 0);
  g.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.3, 0.75, 5.35);
  part(tail, B(0.05, 1.5, 0.25), HELI_MAT, 0, 0, 0);
  part(tail, B(0.05, 0.25, 1.5), HELI_MAT, 0, 0, 0);
  g.add(tail);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.userData.rotor = rotor;
  g.userData.tail = tail;
  return g;
}
function buildGunship() {
  const g = new THREE.Group();
  part(g, B(1.9, 1.9, 9.5), HELI_MAT, 0, 0, 0); // fuselage
  part(g, B(1.5, 1.0, 2.2), HELI_GLASS, 0, 0.3, -4.6); // cockpit
  part(g, B(13.5, 0.22, 2.4), HELI_MAT, 0, 0.5, -0.6); // wing
  part(g, B(5.2, 0.18, 1.4), HELI_MAT, 0, 0.7, 4.4); // tailplane
  part(g, B(0.18, 2.0, 1.6), HELI_MAT, 0, 1.2, 4.6); // fin
  const props = [];
  for (const s of [-6.2, -3.4, 3.4, 6.2]) {
    part(g, CYLZ(0.45, 0.45, 1.7, 10), HELI_MAT, s, 0.1, -1.1); // engine nacelles
    const pr = new THREE.Group();
    pr.position.set(s, 0.1, -2.1);
    part(pr, B(0.06, 2.1, 0.16), HELI_MAT, 0, 0, 0);
    part(pr, B(2.1, 0.06, 0.16), HELI_MAT, 0, 0, 0);
    g.add(pr);
    props.push(pr);
  }
  part(g, B(0.5, 0.5, 2.6), HELI_MAT, 0.95, -0.8, 1.0); // side gun pack
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.userData.props = props;
  return g;
}

/* nearest living hostile with clear sky, never one huddled next to the player */
function skyTarget(from, maxDist, minPlayerDist) {
  let best = null,
    bd = maxDist;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.obj.position.x - from.x, e.obj.position.z - from.z);
    if (d >= bd) continue;
    const dp = Math.hypot(e.obj.position.x - player.pos.x, e.obj.position.z - player.pos.z);
    if (dp < minPlayerDist) continue; // danger close is off the cards
    _allyT.set(e.obj.position.x, e.obj.position.y + 1.2, e.obj.position.z);
    _revDir.subVectors(_allyT, from);
    const len = _revDir.length();
    _revDir.divideScalar(len);
    losRay.set(from, _revDir);
    losRay.far = len - 0.4;
    if (losRay.intersectObjects(worldSolid, false).length) continue;
    bd = d;
    best = e;
  }
  return best;
}
const _skyEnd = new THREE.Vector3();
function heliShoot(h, e) {
  const from = h.obj.position;
  _skyEnd.set(
    e.obj.position.x + rand(-0.5, 0.5),
    e.obj.position.y + 1.2,
    e.obj.position.z + rand(-0.5, 0.5)
  );
  enemyMuzzleFlash(from);
  spawnTracer(from, _skyEnd, 0xffd27a, 1.4);
  SFX.gunshot(
    'rifle',
    clamp((from.x - camera.position.x) / 16, -1, 1),
    from.distanceTo(camera.position)
  );
  if (Math.random() < 0.5) {
    _revDir.subVectors(_skyEnd, from).normalize();
    damageEnemy(e, rand(14, 22), false, _revDir, _skyEnd, '武装直升机');
  }
}
function callHeli() {
  if (G.heli) {
    G.heli.t = 40; // already on station: refuel and rearm
  } else {
    const obj = buildHeli();
    scene.add(obj);
    G.heli = { obj, t: 40, ang: rand(0, 7), fireT: 1.2, burst: 0, burstT: 0, tgt: null };
  }
  comms(null, '武装直升机已就位 — 正在巡逻支援', true);
}
function updateHeli(dt) {
  const h = G.heli;
  h.t -= dt;
  if (h.t <= 0) {
    scene.remove(h.obj);
    G.heli = null;
    return;
  }
  h.ang += dt * 0.33;
  h.obj.position.set(Math.cos(h.ang) * 18, 13, Math.sin(h.ang) * 18);
  h.obj.rotation.set(0, PI - h.ang, 0.14); // nose along the orbit, banked in
  h.obj.userData.rotor.rotation.y += dt * 24;
  h.obj.userData.tail.rotation.x += dt * 30;
  if (h.tgt && h.tgt.dead) h.tgt = null;
  h.fireT -= dt;
  if (h.fireT <= 0) {
    h.tgt = skyTarget(h.obj.position, 45, 4);
    h.burst = h.tgt ? randI(3, 5) : 0;
    h.fireT = h.tgt ? rand(0.9, 1.5) : 0.4;
  }
  if (h.burst > 0 && h.tgt && !h.tgt.dead) {
    h.burstT -= dt;
    if (h.burstT <= 0) {
      h.burstT = 0.09;
      h.burst--;
      heliShoot(h, h.tgt);
    }
  }
}
function startGame() {
  document.body.classList.remove('menu-open');
  SFX.menuMusic(false);
  resetWorldState();
  spawnAllies();
  UI.startScreen.classList.add('hide');
  UI.endScreen.classList.add('hide');
  UI.hud.classList.add('on');
  G.started = true;
  G.running = true;
  G.over = false;
  SFX.music(true);
  SFX.voice('deploy');
  requestLock();
}
function restart() {
  UI.endScreen.classList.add('hide');
  startGame();
}
/* back to the main menu: clean field, live map behind the menu cards */
function showMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  G.started = false;
  G.running = false;
  G.over = false;
  G.paused = false;
  UI.pause.classList.remove('on');
  UI.hud.classList.remove('on');
  UI.endScreen.classList.add('hide');
  resetWorldState();
  UI.startScreen.classList.remove('hide');
  document.body.classList.add('menu-open');
  showMainMenuPage('', false);
  SFX.music(false);
  SFX.init();
  SFX.resume();
  SFX.menuMusic(true);
}
function endGame(win) {
  if (G.over) return;
  if (G.gunship) endGunship('round-end');
  if (G.jug) exitJuggernaut(false);
  G.over = true;
  document.body.classList.remove('menu-open');
  SFX.menuMusic(false);
  G.running = false;
  G.started = false;
  if (document.pointerLockElement) document.exitPointerLock();
  player.ads = false;
  player.adsK = 0;
  player.adsEase = 0;
  UI._scopeK = -1;
  UI.scope.style.opacity = 0;
  compMat.uniforms.scope.value = 0;
  UI.cross.classList.remove('hidden');
  UI._crossHidden = false;
  vmRoot.visible = true;
  UI.hud.classList.remove('on');
  UI.pause.classList.remove('on');
  SFX.music(false);
  /* enemies stop ticking here, so their nameplates have to be cleared by hand
     or they float over the debrief */
  for (const e of enemies) e.tag.sprite.visible = false;
  for (const a of allies) a.tag.sprite.visible = false;
  const es = UI.endScreen;
  es.classList.remove('hide', 'win', 'lose');
  es.classList.add(win ? 'win' : 'lose');
  $('endTitle').textContent = win ? '死斗胜利' : '死斗失败';
  $('endTag').textContent = win ? '战报 // 击坠王' : '战报 // 寡不敌众';
  $('sKills').textContent = G.kills;
  $('sHeads').textContent = G.headshots;
  const acc = G.shots > 0 ? Math.round((G.hits / G.shots) * 100) : 0;
  $('sAcc').innerHTML = acc + '<span>%</span>';
  $('sDeaths').textContent = G.deaths;
  SFX.alarm(win);
}

/* =========================================================================
   20. RESIZE
   ========================================================================= */
function onResize() {
  const w = innerWidth,
    h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  vmCamera.aspect = w / h;
  vmCamera.updateProjectionMatrix();
  renderer.setSize(w, h);
  allocTargets();
  layoutCrosshair(); // recentre, and pick up a display-scale change
}
addEventListener('resize', onResize);
/* now that the post chain and particle pools exist, let target reallocation
   (resize or a dynamic-resolution step) keep their uniforms in sync */
(allocTargets as any).onResize = () => {
  compMat.uniforms.res.value.set(RTW, RTH);
  PS_SPARK.pts.material.uniforms.hscale.value = RTH * 0.5;
  PS_SOFT.pts.material.uniforms.hscale.value = RTH * 0.5;
  for (const update of (allocTargets as any).onPrismResize || []) update();
};
(allocTargets as any).onResize();
