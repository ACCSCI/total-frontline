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
function resetWorldState() {
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
  UI.cross.classList.remove('hidden');
  crossSpread = 0;
  crossFireT = 0;
  crossShots = G.shots; // redeploy with the reticle already closed
  UI.breathTag.classList.remove('on');
  UI._breathTip = null;
  WEAPONS[0].vm.group.visible = true;

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
  player.pumpT = 0;
  player.boltT = 0;
  player.fireCooldown = 0;
  player.triggerHeld = false;
  player.clickBuf = 0;
  player.triggerReleased = true;
  player.recoilPitch = player.recoilYaw = player.recoilVelP = player.recoilVelY = 0;
  player.crouch = false;
  player.height = STAND_H;
  player.eye = STAND_H;
  player.ads = false;
  player.adsK = 0;
  player.adsEase = 0;
  player.mantleT = 0;
  player.jumpsLeft = 1;
  player.shake = 0;
  player.landShake = 0;
  WEAPONS[0].vm.group.visible = true;
  G.protect = 2.0;
  G.dmgFlash = 0;
  updateVitalsUI();
  updateAmmoUI();
}

/* ------------------------- killstreaks -------------------------
   3 连杀 无人侦察机 / 5 连杀 空袭 / 7 连杀 电磁脉冲。阵亡清零。 */
function noteKillstreak() {
  G.streak++;
  if (G.streak === 3) {
    G.uavT = 25;
    comms(null, '无人侦察机上线 — 全图敌情可见', true);
  } else if (G.streak === 5) {
    callAirstrike();
  } else if (G.streak === 7) {
    G.empT = 12;
    comms(null, '电磁脉冲释放 — 敌方火力瘫痪', true);
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
  comms(null, '空袭就位 — 注意躲避', true);
  G.airstrike = { x: best.x, z: best.z, t: 1.4, n: 3 };
}
const _blastDir = new THREE.Vector3();
function explodeAt(x, z) {
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
      damageEnemy(e, 400 * clamp(1 - d / 8, 0.35, 1), false, _blastDir, e.obj.position, '空袭');
    }
  }
  const dp = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (dp < 5) damagePlayer(60 * clamp(1 - dp / 6, 0.3, 1), _blastDir.set(x, y, z), '空袭');
}
function startGame() {
  resetWorldState();
  spawnAllies();
  UI.startScreen.classList.add('hide');
  UI.endScreen.classList.add('hide');
  UI.hud.classList.add('on');
  G.started = true;
  G.running = true;
  G.over = false;
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
  SFX.suspend();
}
function endGame(win) {
  if (G.over) return;
  G.over = true;
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
  vmRoot.visible = true;
  UI.hud.classList.remove('on');
  UI.pause.classList.remove('on');
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
allocTargets.onResize = () => {
  compMat.uniforms.res.value.set(RTW, RTH);
  PS_SPARK.pts.material.uniforms.hscale.value = RTH * 0.5;
  PS_SOFT.pts.material.uniforms.hscale.value = RTH * 0.5;
};
allocTargets.onResize();
