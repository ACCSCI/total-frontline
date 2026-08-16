'use strict';
/* Look / move / camera: the extracted single-player controller in Gameplay. */
const WALK_SPEED = SHARED_MOVEMENT.speeds.walk;
let fovCur = BASE_FOV;

function legacyWorld() {
  return {
    groundY(x, z, probeY) {
      return groundAt(x, z, probeY === undefined ? 200 : probeY);
    },
    ceilingY(x, z, fromY) {
      return ceilingAt(x, z, fromY);
    },
    blocked,
    depenetrate,
    clampHorizontal(pos, padding) {
      pos.x = clamp(pos.x, -HALF + padding, HALF - padding);
      pos.z = clamp(pos.z, -HALF + padding, HALF - padding);
    },
  };
}

function readView() {
  return {
    yaw: player.yaw,
    pitch: player.pitch,
    recoilPitch: player.recoilPitch,
    recoilYaw: player.recoilYaw,
    recoilVelP: player.recoilVelP,
    recoilVelY: player.recoilVelY,
    fovKick: player.fovKick,
    shake: player.shake,
    landShake: player.landShake,
    shakeSeed: player.shakeSeed,
    ads: player.ads,
    adsK: player.adsK,
    adsEase: player.adsEase,
    scoped: !!player.scoped,
    breath: player.breath,
    breathHeld: player.breathHeld,
    breathLock: player.breathLock,
    swayT: player.swayT,
    swayAmp: player.swayAmp === undefined ? 1 : player.swayAmp,
    scopeSwayX: player.scopeSwayX || 0,
    scopeSwayY: player.scopeSwayY || 0,
    bobAmp: player.bobAmp,
    stepPhase: player.stepPhase,
    eye: player.eye,
    hipFov: fovCur,
    fov: camera.fov,
    sensScale,
    mouseDX,
    mouseDY,
  };
}

function writeView(view) {
  player.yaw = view.yaw;
  player.pitch = view.pitch;
  player.recoilPitch = view.recoilPitch;
  player.recoilYaw = view.recoilYaw;
  player.recoilVelP = view.recoilVelP;
  player.recoilVelY = view.recoilVelY;
  player.fovKick = view.fovKick;
  player.shake = view.shake;
  player.landShake = view.landShake;
  player.shakeSeed = view.shakeSeed;
  player.ads = view.ads;
  player.adsK = view.adsK;
  player.adsEase = view.adsEase;
  player.scoped = view.scoped;
  player.breath = view.breath;
  player.breathHeld = view.breathHeld;
  player.breathLock = view.breathLock;
  player.swayT = view.swayT;
  player.swayAmp = view.swayAmp;
  player.scopeSwayX = view.scopeSwayX;
  player.scopeSwayY = view.scopeSwayY;
  player.bobAmp = view.bobAmp;
  player.stepPhase = view.stepPhase;
  player.bob = view.stepPhase;
  player.eye = view.eye;
  fovCur = view.hipFov;
  sensScale = view.sensScale;
  mouseDX = view.mouseDX;
  mouseDY = view.mouseDY;
}

function bindLegacyLoco() {
  return {
    pos: player.pos,
    vel: player.vel,
    yaw: player.yaw,
    crouch: player.crouch,
    prone: player.prone,
    sprint: player.sprint,
    height: player.height,
    onGround: player.onGround,
    jumpsLeft: player.jumpsLeft,
    mantleT: player.mantleT,
    mantleDur: player.mantleDur,
    mantleFrom: player.mantleFrom,
    mantleTo: player.mantleTo,
    mantleTilt: player.mantleTilt || 0,
    ads: player.ads,
    adsEase: player.adsEase,
    reloading: player.reloadT > 0,
    sprintFireRaise: player.sprintFireRaise,
    canSprint: !G.jug && !player.ads && (player.reloadT <= 0 || !SETTINGS.sprintCancelsReload),
    canProne: !G.jug,
    canMantle: !G.jug,
    canDoubleJump: !G.jug,
    jumpScale: G.jug ? 0.72 : 1,
    speedScale: G.jug ? 0.62 : 1,
  };
}

function applyLegacyLoco(loco) {
  player.crouch = loco.crouch;
  player.prone = loco.prone;
  player.sprint = loco.sprint;
  player.height = loco.height;
  player.onGround = loco.onGround;
  player.jumpsLeft = loco.jumpsLeft;
  player.mantleT = loco.mantleT;
  player.mantleDur = loco.mantleDur;
  player.mantleFrom = loco.mantleFrom;
  player.mantleTo = loco.mantleTo;
  player.mantleTilt = loco.mantleTilt;
  player.sprintFireRaise = loco.sprintFireRaise;
}

function updatePlayer(dt) {
  if (player.dead) {
    mouseDX = mouseDY = 0;
    player.shake = damp(player.shake, 0, 7.5, dt);
    player.eye = damp(player.eye, 0.4, 2.6, dt);
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0.12);
    return;
  }
  if (player.hp < 100 && perfNow - player.lastHurt > 4500) {
    player.hp = Math.min(100, player.hp + 26 * dt);
    updateVitalsUI();
  }

  const wpn = WEAPONS[player.weapon];
  const view = readView();
  const wasAds = player.ads;
  const shiftDown = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  Gameplay.stepLook(
    dt,
    view,
    wpn,
    {
      shiftDown,
      reloading: player.reloadT > 0,
      switching: player.switching > 0,
      dead: player.dead,
    },
    SETTINGS.mouseSensitivity,
    BASE_FOV
  );
  if (G.jug) view.sensScale *= 0.82;
  writeView(view);
  if (wasAds && !player.ads) {
    player.breathHeld = false;
    player.breathLock = false;
  }

  const jumpPressed = player.spaceEdge;
  player.spaceEdge = false;
  const pronePressed = player.proneEdge;
  player.proneEdge = false;
  const loco = bindLegacyLoco();
  Gameplay.stepLocomotion(
    dt,
    loco,
    {
      forward: !!keys['KeyW'],
      back: !!keys['KeyS'],
      left: !!keys['KeyA'],
      right: !!keys['KeyD'],
      sprint: shiftDown,
      jumpHeld: !!keys['Space'],
      jumpPressed,
      crouch: !!player.crouch,
      pronePressed,
    },
    legacyWorld(),
    SHARED_MOVEMENT,
    {
      onJump: () => {
        SFX.jumpSound();
        if (loco.jumpsLeft === 0) player.shake = Math.min(1.2, player.shake + 0.1);
      },
      onLand: (f) => {
        player.landShake = f * 0.9;
        player.shake = Math.min(1.5, player.shake + f * 0.55);
        SFX.landSound(f);
      },
      onMantleStart: () => SFX.footstep(0.5, 0),
      onMantleEnd: () => SFX.footstep(0.7, 0),
    }
  );
  applyLegacyLoco(loco);
  updateStanceUI();

  const pose = Gameplay.stepView(
    dt,
    view,
    loco,
    wpn,
    WALK_SPEED,
    BASE_FOV,
    perfNow * 0.001,
    { left: !!keys['KeyA'], right: !!keys['KeyD'] },
    !!G.jug
  );
  if (pose.footstep) SFX.footstep(pose.footstep.vol, pose.footstep.pan);
  writeView(view);
  camera.position.set(pose.x, pose.y, pose.z);
  camera.rotation.set(pose.pitch, pose.yaw, pose.roll);
  if (Math.abs(camera.fov - pose.fov) > 0.005) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }

  const w = WEAPONS[player.weapon];
  w.spread = Math.max(w.spreadBase, w.spread - w.spreadRecover * stanceRecoveryMultiplier() * dt);

  if (player.meleeT > 0) player.meleeT = Math.max(0, player.meleeT - dt);
  updatePlayerReload(dt);
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
      maybeAutoReload();
    }
  }
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
      maybeAutoReload();
    }
  }
  if (player.switching > 0) {
    const before = player.switching;
    player.switching -= dt;
    if (player.switchTo >= 0 && before > 0 && player.switching <= WEAPONS[player.switchTo].drawTime) {
      WEAPONS[player.weapon].vm.group.visible = false;
      player.weapon = player.switchTo;
      player.switchTo = -1;
      WEAPONS[player.weapon].vm.group.visible = true;
      updateAmmoUI();
      SFX.weaponSwap(!!WEAPONS[player.weapon].heavy);
    }
    if (player.switching <= 0) player.switching = 0;
  }
}

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
