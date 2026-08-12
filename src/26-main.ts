'use strict';
/* =========================================================================
   21. MAIN LOOP
   ========================================================================= */
let last = perfNow;
let mapAccum = 0,
  hudAccum = 0;

/* Half the static scene is trim — rail teeth, bolts, cones, small debris — and
   every one of them was being re-rendered into the 2048 shadow map for a smudge
   you cannot see. Dropping sub-45cm casters halves the shadow pass. Contact
   shadows under this clutter are already painted in as decals, so nothing
   visible is lost. Runs before the soldiers exist so it can't strip their limbs. */
{
  const box = new THREE.Box3(),
    sz = new THREE.Vector3();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.castShadow || o instanceof THREE.InstancedMesh) return;
    box.setFromObject(o);
    box.getSize(sz);
    if (Math.max(sz.x, sz.y, sz.z) < 0.45) o.castShadow = false;
  });
}

applyMap(MAP_YARD);
WEAPONS[0].vm.group.visible = true;
updateVitalsUI();
updateAmmoUI();
layoutCrosshair();
UI.boot.classList.add('hide');

function frame(now) {
  requestAnimationFrame(frame);
  perfNow = now;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // avoid tunneling after a stall
  if (dt <= 0) return;
  adaptive(dt);

  const mdx = mouseDX,
    mdy = mouseDY;

  if (G.running && !G.over) {
    G.elapsed += dt;
    G.time -= dt;
    if (G.grace > 0) G.grace -= dt;
    if (G.protect > 0) G.protect -= dt;
    const controllingGunship = !!G.gunship?.controlled;
    if (!controllingGunship) {
      updatePlayer(dt);
      updateViewmodel(dt, mdx, mdy);
      updatePlayerFiring(dt);
    } else {
      mouseDX = mouseDY = 0;
    }
    updateCombatDirector();
    for (const e of enemies) updateEnemy(e, dt);
    for (const a of allies) updateAlly(a, dt);
    /* killstreak timers: UAV/EMP run down, an inbound airstrike walks its
       sticks of bombs onto the marked grid square */
    if (G.uavT > 0) G.uavT -= dt;
    if (G.empT > 0) G.empT -= dt;
    if (G.airstrike) {
      const as = G.airstrike;
      as.t -= dt;
      if (as.t <= 0) {
        explodeAt(as.x + rand(-2.5, 2.5), as.z + rand(-2.5, 2.5));
        as.n--;
        as.t = 0.22;
        if (as.n <= 0) G.airstrike = null;
      }
    }
    if (G.heli) updateHeli(dt);
    if (G.gunship) updateGunship(dt, mdx, mdy);
    /* deathmatch bookkeeping: the squad refills its dead, and a dead player
       is back on their feet in 2.6s — only the clock ends the round */
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
      respawnQueue[i].t -= dt;
      if (respawnQueue[i].t <= 0) {
        const dead = respawnQueue[i].e;
        respawnQueue.splice(i, 1);
        if (dead.ally) respawnAlly(dead);
        else respawnEnemy(dead);
      }
    }
    if (player.dead && G.respawnT > 0) {
      G.respawnT -= dt;
      UI.respawnNum.textContent = Math.max(1, Math.ceil(G.respawnT));
      if (G.respawnT <= 0) {
        UI.respawn.classList.remove('on');
        respawnPlayer();
      }
    }
    if (G.time <= 0) {
      G.time = 0;
      endGame(G.kills >= G.deaths);
    }
  } else {
    mouseDX = mouseDY = 0;
    /* menu backdrop: each map has its own slow camera move */
    if (!G.started && !G.over) {
      CUR.menuCam(now, camera);
      /* enemies aren't ticking here, so their nameplates have to be cleared
         explicitly or they hang over the menu like a debug overlay */
      for (const e of enemies) e.tag.sprite.visible = false;
      for (const a of allies) a.tag.sprite.visible = false;
    }
  }

  /* always-running visual systems */
  dustField.time.value = now * 0.001;
  dustField.camPos.value.copy(camera.position);
  skyUniforms.uTime.value = now * 0.001;
  updateSunShafts();
  if ((!G.running || G.over) && !G.gunship?.controlled) updateViewmodel(dt, mdx, mdy);
  updateShells(dt);
  updateTracers(dt);
  updateEnemyFlashes(dt);
  updateParticles(PS_SPARK, dt);
  updateParticles(PS_SOFT, dt);
  updateCrosshair(dt);
  updateDmgArcs(dt);

  /* HUD throttled */
  hudAccum += dt;
  if (hudAccum > 0.1) {
    hudAccum = 0;
    if (G.running) {
      const t = Math.max(0, G.time);
      UI.timer.textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
      UI.timer.classList.toggle('warn', t < 30);
      /* killstreak status: active countdowns, else progress toward the next */
      let sl = '';
      if (G.uavT > 0) sl = '无人侦察机 ' + Math.ceil(G.uavT) + 's';
      if (G.empT > 0) sl = (sl ? sl + ' · ' : '') + '电磁脉冲 ' + Math.ceil(G.empT) + 's';
      if (G.heli) sl = (sl ? sl + ' · ' : '') + '武装直升机 ' + Math.ceil(G.heli.t) + 's';
      if (G.gunship) sl = (sl ? sl + ' · ' : '') + '空中炮艇 ' + Math.ceil(G.gunship.t) + 's';
      if (G.jug) sl = (sl ? sl + ' · ' : '') + '无畏战士';
      if (!sl && G.streak > 0 && !player.dead) {
        const next = STREAK_LADDER.find((s) => s.at > G.streak);
        sl = next
          ? `连杀 ×${G.streak} — 再消灭 ${next.at - G.streak} 人：${next.name}`
          : `连杀 ×${G.streak}`;
      }
      if (UI.streakLine.textContent !== sl) UI.streakLine.textContent = sl;
    }
  }
  mapAccum += dt;
  if (mapAccum > 0.055) {
    mapAccum = 0;
    if (G.started) drawMinimap();
  }

  /* damage / low-health post uniforms */
  G.dmgFlash = damp(G.dmgFlash, 0, 4.2, dt);
  const lowT = G.running && player.hp < 20 && player.hp > 0 ? 1 : 0;
  G.lowPulse = damp(G.lowPulse, lowT, 3, dt);
  if (lowT) {
    G.hbTimer -= dt;
    if (G.hbTimer <= 0) {
      SFX.heartbeat();
      G.hbTimer = 0.95;
    }
  }
  const pulse = G.lowPulse * (0.55 + 0.45 * Math.sin(now * 0.006));
  UI.lowhp.style.opacity = String(pulse * 0.8);
  G.killFlash = damp(G.killFlash, 0, 7, dt);

  compMat.uniforms.time.value = now * 0.001;
  compMat.uniforms.dmg.value = G.dmgFlash;
  compMat.uniforms.low.value = pulse * 0.55;
  compMat.uniforms.flash.value = G.killFlash * 0.045;
  compMat.uniforms.ab.value = 0.18;

  /* ---------------- render ---------------- */
  renderer.setRenderTarget(sceneRT);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  if (G.started && !G.gunship?.controlled) {
    /* viewmodel stays hidden on the menus */
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }

  brightMat.uniforms.tDiffuse.value = sceneRT.texture;
  blit(brightMat, bloomA);
  const bw = 1 / Math.max(1, RTW >> 2),
    bh = 1 / Math.max(1, RTH >> 2);
  blurMat.uniforms.tDiffuse.value = bloomA.texture;
  blurMat.uniforms.dir.value.set(bw * 1.0, 0);
  blit(blurMat, bloomB);
  blurMat.uniforms.tDiffuse.value = bloomB.texture;
  blurMat.uniforms.dir.value.set(0, bh * 1.0);
  blit(blurMat, bloomA);
  blurMat.uniforms.tDiffuse.value = bloomA.texture;
  blurMat.uniforms.dir.value.set(bw * 2.6, 0);
  blit(blurMat, bloomB);
  blurMat.uniforms.tDiffuse.value = bloomB.texture;
  blurMat.uniforms.dir.value.set(0, bh * 2.6);
  blit(blurMat, bloomA);

  compMat.uniforms.tScene.value = sceneRT.texture;
  compMat.uniforms.tBloom.value = bloomA.texture;
  blit(compMat, null);
}
requestAnimationFrame(frame);
