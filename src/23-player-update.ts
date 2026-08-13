'use strict';
/* =========================================================================
   17. PLAYER UPDATE
   ========================================================================= */
const WALK_SPEED = 4.9,
  SPRINT_SPEED = 7.9,
  CROUCH_SPEED = 2.35;
const ACCEL = 64,
  AIR_ACCEL = 11,
  FRICTION = 11.5,
  GRAVITY = -19.5,
  JUMP_V = 6.95;
const DOUBLE_JUMP_V = 6.05; // second hop, slightly weaker than the first
const BREATH_TIME = 3.0; // seconds of steady hold per breath
/* a ledge this far above the feet can still be pulled up onto */
const MANTLE_RISE = 1.95,
  MANTLE_MIN = 0.45;
let fovCur = BASE_FOV;

/**
 * Looks for a ledge in front of the player and returns the spot to end up on,
 * or null. Requires a flat-ish top with room to stand and nothing in the way.
 */
const _mtA = new THREE.Vector3();
function findMantle() {
  const fx = -Math.sin(player.yaw),
    fz = -Math.cos(player.yaw);
  const feet = player.pos.y;
  for (let i = 0; i < 3; i++) {
    const reach = 0.55 + i * 0.25;
    const px = player.pos.x + fx * reach,
      pz = player.pos.z + fz * reach;
    const top = groundAt(px, pz, feet + MANTLE_RISE);
    if (top === null) continue;
    const rise = top - feet;
    if (rise < MANTLE_MIN || rise > MANTLE_RISE) continue;
    /* the landing needs standing room and a surface that doesn't just repeat
       the wall we're hugging */
    if (blocked(px, pz, top + 0.1, top + STAND_H - 0.06, P_RADIUS * 0.92)) continue;
    const ahead = groundAt(px + fx * 0.35, pz + fz * 0.35, top + 0.35);
    if (ahead === null || ahead < top - 0.45) continue;
    return _mtA.set(px + fx * 0.28, top + 0.02, pz + fz * 0.28);
  }
  return null;
}
function startMantle(target) {
  player.mantleFrom.copy(player.pos);
  player.mantleTo.copy(target);
  const rise = Math.max(0.2, target.y - player.pos.y);
  player.mantleDur = clamp(0.26 + rise * 0.13, 0.28, 0.55);
  player.mantleT = 1e-4; // must be > 0: that's the "mantling" flag

  player.vel.set(0, 0, 0);
  player.onGround = false;
  player.jumpsLeft = 0;
  SFX.footstep(0.5, 0);
}

function updatePlayer(dt) {
  if (player.sprintFireRaise > 0) player.sprintFireRaise = Math.max(0, player.sprintFireRaise - dt);
  if (player.dead) {
    /* KIA: input dies with you. The camera slumps over the body while the
       redeploy counter runs — the round itself never stops. */
    mouseDX = mouseDY = 0;
    player.shake = damp(player.shake, 0, 7.5, dt);
    player.eye = damp(player.eye, 0.4, 2.6, dt);
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0.12);
    return;
  }
  /* catch your breath: 4.5s without taking fire knits you back up. Armour
     does not come back — only the man does. */
  if (player.hp < 100 && perfNow - player.lastHurt > 4500) {
    player.hp = Math.min(100, player.hp + 26 * dt);
    updateVitalsUI();
  }
  /* ---- look ---- */
  player.yaw -= mouseDX * SENS * SETTINGS.mouseSensitivity * sensScale;
  player.pitch -= mouseDY * SENS * SETTINGS.mouseSensitivity * sensScale;
  player.pitch = clamp(player.pitch, -PI / 2 + 0.02, PI / 2 - 0.02);
  const swayInX = mouseDX,
    swayInY = mouseDY;
  mouseDX = mouseDY = 0;

  /* recoil spring (partial auto-recovery) */
  player.recoilVelP = damp(player.recoilVelP, 0, 16, dt);
  player.recoilVelY = damp(player.recoilVelY, 0, 16, dt);
  player.recoilPitch += player.recoilVelP * dt;
  player.recoilYaw += player.recoilVelY * dt;
  player.recoilPitch = damp(player.recoilPitch, 0, 6.5, dt);
  player.recoilYaw = damp(player.recoilYaw, 0, 6.5, dt);

  /* ---- aim down sights ---- */
  const wpn = WEAPONS[player.weapon];
  if (player.ads && (player.reloadT > 0 || player.dead)) setADS(false);
  /* a draw only suspends the aim — press right click mid-swap and the gun
     comes up as soon as it's in your hands */
  const adsWant = player.ads && player.switching <= 0;
  const adsSpeed = 1 / (wpn.adsTime || 0.2);
  player.adsK = clamp(player.adsK + (adsWant ? adsSpeed : -adsSpeed) * dt, 0, 1);
  player.adsEase = easeInOutCubic(player.adsK);
  const scoped = !!wpn.scope && player.adsEase > 0.55;

  /* scope sway: two slow sines at different rates so the drift never repeats
     on an obvious beat. holding shift settles it for three seconds. */
  const shiftDown = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  if (scoped && shiftDown && !player.breathLock && player.breath <= 0) {
    player.breath = BREATH_TIME;
    player.breathHeld = true;
  }
  if (!shiftDown) player.breathLock = false;
  if (player.breath > 0) {
    player.breath -= dt;
    if (!shiftDown || !scoped) {
      player.breath = 0;
      player.breathHeld = false;
    } else if (player.breath <= 0) {
      player.breathHeld = false;
      player.breathLock = true;
    } // out of air
  } else player.breathHeld = false;

  player.swayT += dt;
  const swayAmp = damp(
    player.swayAmp === undefined ? 1 : player.swayAmp,
    player.breathHeld ? 0.04 : 1,
    player.breathHeld ? 9 : 3.4,
    dt
  );
  player.swayAmp = swayAmp;
  let scopeSwayX = 0,
    scopeSwayY = 0;
  if (wpn.scope && player.adsEase > 0.02) {
    const a =
      0.0125 * player.adsEase * swayAmp * (player.prone ? 0.45 : player.crouch ? 0.72 : 1);
    scopeSwayX = Math.sin(player.swayT * 0.62) * a + Math.sin(player.swayT * 1.13 + 1.7) * a * 0.3;
    scopeSwayY =
      Math.sin(player.swayT * 0.47 + 2.2) * a * 0.72 + Math.sin(player.swayT * 0.91) * a * 0.22;
  }

  /* ---- stance ---- */
  const wantCrouch = !!(keys['AltLeft'] || keys['AltRight']);
  if (player.proneEdge) {
    player.proneEdge = false;
    if (player.prone) {
      const ceil = ceilingAt(player.pos.x, player.pos.z, player.pos.y + PRONE_H);
      if (ceil - player.pos.y > CROUCH_H + 0.1) {
        player.prone = false;
        player.crouch = true;
      }
    } else if (!G.jug && player.onGround && player.mantleT <= 0) {
      player.prone = true;
      player.crouch = false;
      player.sprint = false;
    }
  }
  if (G.jug) player.prone = false;
  if (wantCrouch && player.prone) {
    const ceil = ceilingAt(player.pos.x, player.pos.z, player.pos.y + PRONE_H);
    if (ceil - player.pos.y > CROUCH_H + 0.1) player.prone = false;
  }
  const wantSprint =
    !G.jug &&
    shiftDown &&
    !wantCrouch &&
    !player.prone &&
    !player.ads &&
    keys['KeyW'] &&
    player.sprintFireRaise <= 0 &&
    (player.reloadT <= 0 || !SETTINGS.sprintCancelsReload);
  if (!player.prone && !wantCrouch && player.crouch) {
    /* only stand if there's headroom */
    const ceil = ceilingAt(player.pos.x, player.pos.z, player.pos.y + CROUCH_H);
    if (ceil - player.pos.y > STAND_H + 0.1) player.crouch = false;
  } else if (!player.prone) player.crouch = wantCrouch;
  player.sprint = wantSprint && !player.crouch && !player.prone;

  const stanceHeight = player.prone ? PRONE_H : player.crouch ? CROUCH_H : STAND_H;
  player.height = damp(player.height, stanceHeight, 13, dt);
  updateStanceUI();

  /* ---- wish direction ---- */
  const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const sy = Math.sin(player.yaw),
    cy = Math.cos(player.yaw);
  let wx = -sy * f + cy * s;
  let wz = -cy * f - sy * s;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) {
    wx /= wl;
    wz /= wl;
  }

  let maxSpeed = player.prone
    ? PRONE_SPEED
    : player.crouch
      ? CROUCH_SPEED
      : player.sprint
        ? SPRINT_SPEED
        : WALK_SPEED;
  if (player.reloadT > 0) maxSpeed *= 0.86;
  maxSpeed *= 1 - 0.4 * player.adsEase;
  if (G.jug) maxSpeed *= 0.62;

  const accel = player.onGround ? ACCEL : AIR_ACCEL;
  if (wl > 0) {
    player.vel.x += wx * accel * dt;
    player.vel.z += wz * accel * dt;
  }
  /* friction */
  if (player.onGround) {
    const sp = Math.hypot(player.vel.x, player.vel.z);
    if (sp > 0) {
      const drop = sp * FRICTION * dt * (wl > 0 ? 0.55 : 1.0);
      const k = Math.max(0, sp - drop) / sp;
      player.vel.x *= k;
      player.vel.z *= k;
    }
  }
  /* clamp horizontal speed */
  {
    const sp = Math.hypot(player.vel.x, player.vel.z);
    if (sp > maxSpeed) {
      const k = maxSpeed / sp;
      player.vel.x *= k;
      player.vel.z *= k;
    }
  }

  /* ---- jump / double jump / mantle ---- */
  const spacePressed = player.spaceEdge;
  player.spaceEdge = false;
  if (player.onGround) player.jumpsLeft = 1; // the air hop
  let jumpedNow = false;
  if (keys['Space'] && player.onGround && !player.crouch && !player.prone) {
    player.vel.y = JUMP_V * (G.jug ? 0.72 : 1);
    player.onGround = false;
    player.jumpsLeft = 1;
    jumpedNow = true;
    SFX.jumpSound();
  }
  if (!player.prone && !jumpedNow && !player.onGround && player.mantleT <= 0) {
    /* holding space into a ledge climbs it; a fresh tap does too, so the
       double jump is only spent when there's nothing to grab */
    if (!G.jug && keys['Space'] && player.vel.y < 2.6) {
      const led = findMantle();
      if (led) startMantle(led);
    }
    if (!G.jug && player.mantleT <= 0 && spacePressed && player.jumpsLeft > 0) {
      player.jumpsLeft--;
      player.vel.y = DOUBLE_JUMP_V;
      SFX.jumpSound();
      player.shake = Math.min(1.2, player.shake + 0.1);
    }
  }
  player.vel.y += GRAVITY * dt;
  if (player.vel.y < -46) player.vel.y = -46;

  if (player.mantleT > 0) {
    /* scripted pull-up: rise first, then slide forward over the lip, so it
       reads as a climb instead of a diagonal float */
    player.mantleT += dt;
    const k = clamp(player.mantleT / player.mantleDur, 0, 1);
    const ku = easeOutCubic(clamp(k * 1.42, 0, 1));
    const kf = easeInOutCubic(clamp((k - 0.3) / 0.7, 0, 1));
    player.pos.y = lerp(player.mantleFrom.y, player.mantleTo.y, ku);
    player.pos.x = lerp(player.mantleFrom.x, player.mantleTo.x, kf);
    player.pos.z = lerp(player.mantleFrom.z, player.mantleTo.z, kf);
    player.vel.set(0, 0, 0);
    player.mantleTilt = Math.sin(k * PI) * 0.085;
    if (k >= 1) {
      player.mantleT = 0;
      player.mantleTilt = 0;
      player.onGround = true;
      player.jumpsLeft = 1;
      SFX.footstep(0.7, 0);
    } else player.onGround = false;
  } else {
    /* ---- horizontal move + collide ---- */
    moveSlide(player.pos, player.vel.x * dt, player.vel.z * dt, P_RADIUS, player.height);
    player.pos.x = clamp(player.pos.x, -HALF + 0.8, HALF - 0.8);
    player.pos.z = clamp(player.pos.z, -HALF + 0.8, HALF - 0.8);

    /* ---- vertical ---- */
    const prevVy = player.vel.y,
      prevY = player.pos.y;
    player.pos.y += player.vel.y * dt;
    if (player.vel.y > 0) {
      const ceil = ceilingAt(player.pos.x, player.pos.z, player.pos.y + player.height);
      if (player.pos.y + player.height > ceil) {
        player.pos.y = ceil - player.height - 0.01;
        player.vel.y = 0;
      }
    }
    /* step allowance only applies while grounded, so jumps aren't cancelled */
    const step = player.onGround && player.vel.y <= 0 ? 0.62 : 0.0;
    const probeTop = Math.max(prevY, player.pos.y) + step;
    const gy = groundAt(player.pos.x, player.pos.z, probeTop);
    const floorY = gy === null ? 0 : gy;
    if (player.pos.y <= floorY + 0.02) {
      if (!player.onGround && prevVy < -3) {
        const f2 = clamp(-prevVy / 16, 0, 1);
        player.landShake = f2 * 0.9;
        player.shake = Math.min(1.5, player.shake + f2 * 0.55);
        SFX.landSound(f2);
      }
      player.pos.y = floorY;
      player.vel.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
  }

  /* Standing still inside geometry is the one state moveSlide can't fix, since
     it only runs while you're moving: a mantle that lands you on a lip, or the
     ground snap dropping you into a stack, would leave you free to walk out
     through the far wall. Eject the moment it happens. */
  {
    const y0 = player.pos.y + 0.3,
      y1 = player.pos.y + player.height - 0.05;
    if (blocked(player.pos.x, player.pos.z, y0, y1, P_RADIUS))
      depenetrate(player.pos, P_RADIUS, y0, y1);
  }

  /* ---- head bob + footsteps ---- */
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  const moving = hSpeed > 0.6 && player.onGround;
  player.bobAmp = damp(player.bobAmp, moving ? clamp(hSpeed / WALK_SPEED, 0, 1.5) : 0, 9, dt);
  if (moving) {
    const prev = player.stepPhase;
    player.stepPhase +=
      dt * hSpeed * (G.jug ? 0.92 : player.prone ? 0.72 : player.crouch ? 1.05 : 1.42);
    if (Math.floor(prev / PI) !== Math.floor(player.stepPhase / PI)) {
      const vol = G.jug
        ? 1.25
        : player.prone
          ? 0.18
          : player.crouch
            ? 0.35
            : player.sprint
              ? 1.15
              : 0.8;
      SFX.footstep(vol, clamp(Math.sin(player.stepPhase) * 0.35, -1, 1));
    }
  }
  player.bob = player.stepPhase;

  /* ---- shake decay ---- */
  player.shake = damp(player.shake, 0, 7.5, dt);
  player.landShake = damp(player.landShake, 0, 9, dt);

  /* ---- camera ---- */
  const bobY = Math.sin(player.bob * 2) * 0.032 * player.bobAmp;
  const bobX = Math.sin(player.bob) * 0.036 * player.bobAmp;
  const bobR = Math.sin(player.bob) * 0.01 * player.bobAmp;
  player.eye = damp(player.eye, player.height * 0.92, 16, dt);

  const t = perfNow * 0.001;
  const shk = player.shake;
  const sX = (Math.sin(t * 57.3 + player.shakeSeed) + Math.sin(t * 31.1)) * 0.5 * shk * 0.03;
  const sY = (Math.sin(t * 43.7 + player.shakeSeed * 2) + Math.sin(t * 67.3)) * 0.5 * shk * 0.03;
  const sR = Math.sin(t * 39.9 + player.shakeSeed * 3) * shk * 0.016;

  /* ADS pins the camera down: bob, lean and shake all shrink toward zero */
  const steady = 1 - 0.82 * player.adsEase;

  camera.position.set(
    player.pos.x + (bobX * 0.4 + sX) * steady,
    player.pos.y + player.eye + (bobY + sY) * steady - player.landShake * 0.16,
    player.pos.z + sX * 0.5 * steady
  );
  camera.rotation.set(
    player.pitch +
      player.recoilPitch -
      player.landShake * 0.1 -
      (player.mantleTilt || 0) +
      sY * 0.6 * steady +
      scopeSwayY,
    player.yaw + player.recoilYaw + scopeSwayX,
    (bobR + sR) * steady + ((keys['KeyA'] ? 0.014 : 0) - (keys['KeyD'] ? 0.014 : 0)) * steady
  );

  /* ---- fov ---- */
  const hipFov = G.jug
    ? 68
    : BASE_FOV + (player.sprint && hSpeed > 4.5 ? 7.5 : 0) + clamp(hSpeed - 5, 0, 3) * 0.6;
  fovCur = damp(fovCur, hipFov, 7, dt);
  /* the ADS blend rides on top of the damped hipfire value so the 0.2s ramp
     is exact rather than doubly smoothed */
  player.fovKick = damp(player.fovKick, 0, 13, dt);
  const aimFov = wpn.bracedAim ? fovCur : wpn.adsFov;
  const fovNow =
    lerp(fovCur, aimFov, player.adsEase) + player.fovKick * (1 - player.adsEase * 0.75);
  if (Math.abs(camera.fov - fovNow) > 0.005) {
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
  }
  /* mouse feel has to scale with zoom or the sniper is unusable */
  sensScale = lerp(
    1,
    wpn.bracedAim
      ? 1
      : clamp(Math.tan((wpn.adsFov * PI) / 360) / Math.tan((BASE_FOV * PI) / 360), 0.18, 1),
    player.adsEase
  );
  if (G.jug) sensScale *= 0.82;

  /* ---- weapon spread recovery ---- */
  const w = WEAPONS[player.weapon];
  w.spread = Math.max(
    w.spreadBase,
    w.spread - w.spreadRecover * stanceRecoveryMultiplier() * dt
  );

  if (player.meleeT > 0) player.meleeT = Math.max(0, player.meleeT - dt);
  updatePlayerReload(dt);
  /* ---- pump ---- */
  if (player.pumpT > 0) {
    player.pumpT -= dt;
    const w2 = WEAPONS[1];
    const k = 1 - player.pumpT / w2.pumpTime;
    if (!player.pumpEjected && k > 0.42) {
      player.pumpEjected = true;
      SFX.pumpSound(true);
      camera.getWorldDirection(_fwd);
      _rgt.crossVectors(_fwd, _up).normalize();
      const ejPos = camera.position.clone().addScaledVector(_fwd, 0.3).addScaledVector(_rgt, 0.22);
      ejPos.y -= 0.06;
      ejectShell(ejPos, _rgt.clone().addScaledVector(_fwd, 0.1), true);
    }
    if (player.pumpT <= 0) {
      player.pumpT = 0;
      SFX.pumpSound(false);
    }
  }
  /* ---- bolt cycle (sniper) ---- */
  if (player.boltT > 0) {
    const wS = WEAPONS[3];
    player.boltT -= dt;
    const k = 1 - player.boltT / wS.boltTime;
    if (player.boltPhase === 0 && k > 0.3) {
      player.boltPhase = 1;
      camera.getWorldDirection(_fwd);
      _rgt.crossVectors(_fwd, _up).normalize();
      const ejPos = camera.position.clone().addScaledVector(_fwd, 0.2).addScaledVector(_rgt, 0.2);
      ejPos.y -= 0.04;
      ejectShell(ejPos, _rgt.clone().addScaledVector(_fwd, 0.05), true);
    }
    if (player.boltPhase === 1 && k > 0.6) {
      player.boltPhase = 2;
      SFX.boltCycle(1);
    }
    if (player.boltT <= 0) {
      player.boltT = 0;
      player.boltPhase = 3;
    }
  }
  /* ---- weapon switch ---- */
  if (player.switching > 0) {
    const before = player.switching;
    player.switching -= dt;
    if (
      player.switchTo >= 0 &&
      before > 0 &&
      player.switching <= WEAPONS[player.switchTo].drawTime
    ) {
      WEAPONS[player.weapon].vm.group.visible = false;
      player.weapon = player.switchTo;
      player.switchTo = -1;
      WEAPONS[player.weapon].vm.group.visible = true;
      updateAmmoUI();
      SFX.weaponSwap(!!WEAPONS[player.weapon].heavy);
    }
    if (player.switching <= 0) {
      player.switching = 0;
    }
  }
}

/* Runs after updateViewmodel so a shot samples the muzzle pose that will be
   rendered in this frame, rather than the previous frame's bob/sway pose. */
function updatePlayerFiring(dt) {
  const w = WEAPONS[player.weapon];
  player.fireCooldown -= dt;
  player.burstIdle += dt;
  if (player.burstIdle > 0.32) player.burstCount = 0;
  player.clickBuf = Math.max(0, player.clickBuf - dt);
  if (player.dead || (!player.triggerHeld && player.clickBuf <= 0)) return;
  if (w.auto && !w.semi) {
    if (fireWeapon()) player.clickBuf = 0;
  } else if (player.triggerReleased && fireWeapon()) player.clickBuf = 0;
}
