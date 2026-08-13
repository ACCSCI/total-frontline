export async function runReloadSmoke(page, check) {
  const handling = await page.evaluate(() => {
    const savedWeapon = player.weapon;
    const savedAmmo = WEAPONS.map((w) => ({ mag: w.mag, res: w.res }));
    const worldDistance = (a, b) => {
      a.updateWorldMatrix(true, false);
      b.updateWorldMatrix(true, false);
      return a
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(b.getWorldPosition(new THREE.Vector3()));
    };
    const pose = (weapon, progress, empty = false, duration, rounds = 0) => {
      player.weapon = weapon;
      player.switching = 0;
      player.switchTo = -1;
      player.pumpT = 0;
      player.boltT = 0;
      player.meleeT = 0;
      player.reloadEmpty = empty;
      player.reloadRounds = rounds;
      player.reloadDuration = duration || WEAPONS[weapon].reloadTime;
      player.reloadT = player.reloadDuration * (1 - progress);
      updateViewmodel(0, 0, 0);
      WEAPONS[weapon].vm.group.updateMatrixWorld(true);
      return WEAPONS[weapon].vm;
    };

    const rifle = WEAPONS[0];
    const reloadPoses = [];
    rifle.mag = 15;
    rifle.res = 210;
    player.weapon = 0;
    startReload();
    const tacticalTime = player.reloadDuration;
    player.reloadT = 0;
    finishReload();
    const tacticalMag = rifle.mag;
    rifle.mag = 0;
    startReload();
    const emptyTime = player.reloadDuration;
    player.reloadT = 0;
    finishReload();
    const emptyMag = rifle.mag;

    let vm = pose(0, 0.22);
    const rifleTurn = vm.weaponPivot.rotation.y > 0.25 && vm.weaponPivot.rotation.z < -0.95;
    const rifleHandsIndependent =
      Math.abs(vmSway.rotation.z) < 0.1 &&
      Math.abs(vm.rightHand.rotation.z - vm.rightHand._reloadBaseRot.z) < 0.6 &&
      Math.abs(vm.leftHand.rotation.z - vm.leftHand._reloadBaseRot.z) < 0.1;
    vm = pose(0, 0.16);
    const rifleOldMagThrown =
      !vm.mag.visible &&
      vm.ejectedMag.visible &&
      vm.ejectedMag.parent === vm.group &&
      vm.mag.parent === vm.weaponPivot &&
      vm.ejectedMag.position.distanceTo(vm._magReleasePos) > 0.12 &&
      vm._magTangentialVelocity.length() > 0.9 &&
      vm._magReleaseVelocity.distanceTo(vm._magTangentialVelocity) < 0.14;
    const flightAge = vm._magFlight.age;
    player.reloadT = 0;
    updateDetachedMagazinePhysics(0.016);
    const rifleFlightPersists = vm.ejectedMag.visible && vm._magFlight.age > flightAge;
    vm = pose(0, 0.46);
    const rifleSeparateMags =
      vm.ejectedMag !== vm.newMag &&
      vm.mag !== vm.newMag &&
      vm.mag !== vm.ejectedMag &&
      vm.newMag.visible;
    vm = pose(0, 0.54);
    const rifleGrip =
      !vm.mag.visible && vm.newMag.visible && worldDistance(vm.newMag, vm.leftHand) < 0.09;
    const rifleHorizontal = vm.weaponPivot.rotation.z < -0.95 && Math.abs(vmSway.position.x) < 0.08;
    vm = pose(0, 0.765, true);
    const rifleSlap = worldDistance(vm.reloadSlap, vm.leftHand) < 0.1;

    const shotgun = WEAPONS[1];
    shotgun.mag = 5;
    shotgun.res = 2;
    player.weapon = 1;
    player.pumpT = player.boltT = player.meleeT = 0;
    player.reloadT = player.reloadDuration = 0;
    startReload();
    const shotgunRounds = player.reloadRounds;
    const shotgunDuration = player.reloadDuration;
    player.reloadT = 0;
    finishReload();
    const shotgunLoaded = shotgun.mag;
    vm = pose(1, (0.2 + 0.42 * 0.5) / shotgunDuration, false, shotgunDuration, shotgunRounds);
    const shotgunLoad =
      vm.reloadShell.visible &&
      worldDistance(vm.reloadShell, vm.leftHand) < 0.09 &&
      vmSway.rotation.y > vm.baseRot.y + 0.1;
    reloadPoses.push({ x: vmSway.position.x, roll: vmSway.rotation.z });
    const emptyShotgunDuration = 0.46 + shotgun.magSize * 0.42 + 0.18;
    vm = pose(
      1,
      (0.2 + shotgun.magSize * 0.42 + 0.08) / emptyShotgunDuration,
      true,
      emptyShotgunDuration,
      shotgun.magSize
    );
    const shotgunPump = vm._reloadPump > 0.9;

    clearAllReloadProgress();
    player.weapon = 2;
    WEAPONS[2].mag = 0;
    startReload();
    updatePlayerReload(player.reloadDuration * 0.31);
    updateViewmodel(0, 0, 0);
    vm = WEAPONS[2].vm;
    const pistolOldMagGone =
      !vm.mag.visible && vm.ejectedMag.visible && vm.ejectedMag !== vm.newMag;
    updatePlayerReload(player.reloadDuration * (0.53 - 0.31));
    updateViewmodel(0, 0, 0);
    const pistolGrip = vm.newMag.visible && worldDistance(vm.newMag, vm.leftHand) < 0.09;
    reloadPoses.push({ x: vmSway.position.x, roll: vmSway.rotation.z });
    vm = pose(2, 0.8, true);
    const pistolRack = vm.slide.position.z > 0.06;

    clearAllReloadProgress();
    player.weapon = 3;
    WEAPONS[3].mag = 0;
    startReload();
    updatePlayerReload(player.reloadDuration * 0.35);
    updateViewmodel(0, 0, 0);
    vm = WEAPONS[3].vm;
    const sniperThrowsOld =
      !vm.mag.visible &&
      vm.ejectedMag.visible &&
      vm.mag !== vm.ejectedMag &&
      vm.newMag !== vm.ejectedMag;
    const sniperOldOutsidePivot =
      vm.ejectedMag.parent === vm.group && vm.ejectedMag.parent !== vm.weaponPivot;
    const sniperThrowNatural =
      vm._magFlight.velocity.x < -0.4 &&
      vm._magFlight.velocity.x > -0.6 &&
      vm._magFlight.velocity.y <= 0 &&
      vm._magFlight.angularVelocity.length() < 3;
    const armSamples = [];
    for (let progress = 0.35; progress <= 0.88; progress += 0.02) {
      player.reloadT = player.reloadDuration * (1 - progress);
      updateViewmodel(0, 0, 0);
      armSamples.push(vm.leftHand.position.clone());
    }
    const sniperArmSteps = armSamples.slice(1).map((point, i) => point.distanceTo(armSamples[i]));
    const sniperArmMaxStep = Math.max(...sniperArmSteps);
    const sniperArmMaxAt = 0.37 + sniperArmSteps.indexOf(sniperArmMaxStep) * 0.02;
    const sniperArmCurve = sniperArmMaxStep < 0.085;
    const freshEntrySamples = [];
    for (let progress = 0.48; progress <= 0.9; progress += 0.02) {
      player.reloadT = player.reloadDuration * (1 - progress);
      updateViewmodel(0, 0, 0);
      vm.group.updateMatrixWorld(true);
      const ndc = vm.newMag.getWorldPosition(new THREE.Vector3()).project(vmCamera);
      freshEntrySamples.push({
        visible: vm.newMag.visible,
        y: ndc.y,
        hand: worldDistance(vm.newMag, vm.leftHand),
      });
    }
    const firstFreshVisible = freshEntrySamples.find((sample) => sample.visible);
    const firstFreshInFrame = freshEntrySamples.find((sample) => sample.visible && sample.y > -1);
    const sniperFreshComesFromPouch =
      !!firstFreshVisible &&
      firstFreshVisible.y < -1 &&
      !!firstFreshInFrame &&
      firstFreshInFrame.hand < 0.1;
    player.reloadT = player.reloadDuration * (1 - 0.74);
    WEAPONS[3].reloadState.progress = 0.74;
    updateViewmodel(0, 0, 0);
    updateViewmodel(0, 0, 0);
    const sniperGrip = vm.newMag.visible && worldDistance(vm.newMag, vm.leftHand) < 0.09;
    const armAtFresh = vm.leftHand.position.clone();
    player.reloadT += player.reloadDuration * 0.01;
    updateViewmodel(0, 0, 0);
    const sniperArmContinuous = vm.leftHand.position.distanceTo(armAtFresh) < 0.12;
    const flyingMagBefore = vm.ejectedMag.position.clone();
    const armBeforeFlight = vm.leftHand.position.clone();
    updateDetachedMagazinePhysics(0.08);
    updateViewmodel(0, 0, 0);
    const sniperArmIgnoresOldFlight =
      vm.ejectedMag.position.distanceTo(flyingMagBefore) > 0.03 &&
      vm.leftHand.position.distanceTo(armBeforeFlight) < 0.12;
    player.reloadT -= player.reloadDuration * 0.01;
    updatePlayerReload(player.reloadDuration * (0.94 - 0.74));
    updateViewmodel(0, 0, 0);
    const sniperSeatedMag =
      vm.mag.visible && vm.mag.position.distanceTo(vm._magPos) < 0.001 && !vm.newMag.visible;
    const sniperBolt = vm._reloadBoltLift > 0.9 && vm._reloadBoltBack > 0.5;
    const sniperSideways =
      vm.weaponPivot.rotation.z < -0.25 &&
      Math.abs(vmSway.rotation.z) < 0.15 &&
      vm.leftHand.forearm.visible &&
      vm.rightHand.forearm.visible;
    const sniperReloadHand = worldDistance(vm.knob, vm.rightHand) < 0.1;
    player.weapon = 3;
    player.reloadT = 0;
    player.boltT = WEAPONS[3].boltTime * 0.5;
    updateViewmodel(0, 0, 0);
    vm.group.updateMatrixWorld(true);
    const sniperShotBoltHand = worldDistance(vm.knob, vm.rightHand) < 0.1;
    player.boltT = 0;

    clearAllReloadProgress();
    player.weapon = 4;
    WEAPONS[4].mag = 0;
    startReload();
    updatePlayerReload(player.reloadDuration * 0.44);
    updateViewmodel(0, 0, 0);
    vm = WEAPONS[4].vm;
    const lmgFeed = vm.topCover.rotation.x - vm._coverRot.x > 0.9;
    const lmgThrowsOld = !vm.mag.visible && vm.ejectedMag.visible;
    updatePlayerReload(player.reloadDuration * (0.58 - 0.44));
    updateViewmodel(0, 0, 0);
    const lmgGrip = vm.newMag.visible && worldDistance(vm.newMag, vm.leftHand) < 0.1;
    reloadPoses.push({ x: vmSway.position.x, roll: vmSway.rotation.z });
    vm = pose(4, 0.9, true);
    const lmgRack = vm.chargeHandle.position.z - vm._chargePos.z > 0.075;

    clearAllReloadProgress();
    player.weapon = 5;
    const ak = WEAPONS[5];
    ak.mag = 12;
    ak.res = ak.reserve;
    startReload();
    updatePlayerReload(player.reloadDuration * 0.299);
    updateViewmodel(0, 0, 0);
    vm = ak.vm;
    vm.group.updateMatrixWorld(true);
    const akOldBeforeRelease = vm.mag.getWorldPosition(new THREE.Vector3());
    vm.group.worldToLocal(akOldBeforeRelease);
    updatePlayerReload(player.reloadDuration * 0.002);
    updateViewmodel(0, 0, 0);
    vm = ak.vm;
    const akRetainContinuous = vm.ejectedMag.position.distanceTo(akOldBeforeRelease) < 0.055;
    updatePlayerReload(player.reloadDuration * 0.019);
    updateViewmodel(0, 0, 0);
    const akTacticalRetains =
      !vm.mag.visible && vm.ejectedMag.visible && !vm._magFlight && vm.newMag !== vm.ejectedMag;
    updatePlayerReload(player.reloadDuration * 0.18);
    updateViewmodel(0, 0, 0);
    const akFreshGrip = vm.newMag.visible && worldDistance(vm.newMag, vm.leftHand) < 0.1;
    vm = pose(5, 0.84, true);
    const akEmptyRack = vm.chargeHandle.position.z - vm._chargePos.z > 0.08;
    player.reloadEmpty = false;
    vm = pose(5, 0.84, false);
    const akTacticalDoesNotRack = vm.chargeHandle.position.z - vm._chargePos.z < 0.001;
    const akModelQuality =
      vm.picatinnyCount === 27 &&
      vm.dot.material.depthTest === false &&
      vm.attachmentNodes.optic.micro_dot.userData.windowRadius >= 0.04 &&
      vm.attachmentNodes.optic.micro_dot.userData.frameRadius >= 0.051 &&
      vm.attachmentNodes.muzzle.compensator !== vm.attachmentNodes.muzzle.suppressor &&
      vm.attachmentNodes.underbarrel.angled_grip !== vm.attachmentNodes.underbarrel.vertical_grip;
    const savedAkAttachments = { ...ak.attachments };
    const prismRendersBefore = prismRenderCount;
    setWeaponAttachment('ak', 'optic', 'prism_2_5');
    player.adsEase = 1;
    const prismRendered =
      renderActivePrism() &&
      prismRenderCount === prismRendersBefore + 1 &&
      vm.prism.lens.visible &&
      vm.prism.group.userData.magnification === 2.5 &&
      vm.attachmentNodes.optic.micro_dot.visible === false;
    setWeaponAttachment('ak', 'muzzle', 'suppressor');
    setWeaponAttachment('ak', 'underbarrel', 'vertical_grip');
    setWeaponAttachment('ak', 'magazine', 'extended');
    const akAttachmentsWork =
      vm.attachmentNodes.muzzle.suppressor.visible &&
      !vm.attachmentNodes.muzzle.compensator.visible &&
      vm.attachmentNodes.underbarrel.vertical_grip.visible &&
      ak.magSize === 40 &&
      JSON.parse(localStorage.getItem('tf.attachments.ak')).muzzle === 'suppressor';
    for (const [slot, id] of Object.entries(savedAkAttachments))
      setWeaponAttachment('ak', slot, id);
    player.ads = false;
    player.adsEase = 0;

    /* Every detachable-mag weapon freezes the exact removal checkpoint. */
    const stagedResume = [];
    for (const index of [0, 2, 3, 4, 5]) {
      clearAllReloadProgress();
      player.weapon = index;
      player.switching = player.pumpT = player.boltT = player.meleeT = 0;
      const staged = WEAPONS[index];
      staged.mag = 0;
      staged.res = staged.reserve;
      startReload();
      const removeAt = RELOAD_STAGE[staged.id].remove + 0.02;
      updatePlayerReload(player.reloadDuration * removeAt);
      interruptReload();
      const frozen = staged.reloadState.progress;
      const removed = staged.reloadState.magOut && !staged.reloadState.inserted;
      startReload();
      const resumed = Math.abs(1 - player.reloadT / player.reloadDuration - frozen) < 0.002;
      const insertAt = RELOAD_STAGE[staged.id].insert + 0.02;
      updatePlayerReload(player.reloadDuration * (insertAt - frozen));
      interruptReload();
      const seatedAmmo = staged.mag;
      startReload();
      finishReload();
      stagedResume.push(removed && resumed && seatedAmmo > 0 && staged.mag === seatedAmmo);
    }
    clearAllReloadProgress();
    player.weapon = 0;
    player.switching = player.pumpT = player.boltT = player.meleeT = 0;
    player.sprint = false;
    player.sprintFireRaise = 0;
    rifle.mag = 7;
    rifle.res = 30;
    startReload();
    updatePlayerReload(player.reloadDuration * 0.09);
    updateViewmodel(0, 0, 0);
    interruptReload();
    updateViewmodel(0, 0, 0);
    const magHiddenAfterInterrupt = !rifle.vm.mag.visible;
    const interruptedFlightAge = rifle.vm._magFlight.age;
    updateDetachedMagazinePhysics(0.08);
    const flightContinuesAfterInterrupt = rifle.vm._magFlight.age > interruptedFlightAge;
    const shotsBeforeBlockedTrigger = G.shots;
    const roundsBeforeBlockedTrigger = rifle.mag;
    fireWeapon();
    const triggerResumesOpenReload =
      player.reloadT > 0 &&
      rifle.mag === roundsBeforeBlockedTrigger &&
      G.shots === shotsBeforeBlockedTrigger;
    interruptReload();
    const releasedState = rifle.reloadState;
    rifle.vm._magFlight.age = 1.99;
    updateDetachedMagazinePhysics(0.05);
    const expiredFlight = !rifle.vm._magFlight;
    updateViewmodel(0, 0, 0);
    const noSecondThrownMag =
      releasedState.magVisualReleased && !rifle.vm._magFlight && !rifle.vm.ejectedMag.visible;
    finishReload();
    clearAllReloadProgress();
    player.weapon = 1;
    shotgun.mag = 3;
    shotgun.res = 5;
    startReload();
    updatePlayerReload(0.64);
    interruptReload();
    const shellsBeforeResume = shotgun.mag;
    const shellProgress = shotgun.reloadState.progress;
    startReload();
    const shotgunResumed =
      shellsBeforeResume === 5 &&
      Math.abs(1 - player.reloadT / player.reloadDuration - shellProgress) < 0.002;
    finishReload();
    const shotgunNoDuplicate = shotgun.mag === 8 && shotgun.res === 0;
    clearAllReloadProgress();
    shotgun.mag = 3;
    shotgun.res = 5;
    player.weapon = 1;
    player.fireCooldown = player.pumpT = player.boltT = 0;
    player.triggerReleased = true;
    startReload();
    updatePlayerReload(0.64);
    const loadedBeforeShot = shotgun.mag;
    const shotsBeforeShotgunInterrupt = G.shots;
    fireWeapon();
    const shotgunFireInterrupt =
      loadedBeforeShot > 3 &&
      !shotgun.reloadState &&
      player.reloadT === 0 &&
      shotgun.mag === loadedBeforeShot - 1 &&
      G.shots === shotsBeforeShotgunInterrupt + 1;
    player.fireCooldown = player.pumpT = 0;
    player.triggerHeld = false;
    player.triggerReleased = true;
    shotgun.mag = Math.max(2, shotgun.mag);
    const immediateShotCount = G.shots;
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    const shotgunClickImmediate = G.shots === immediateShotCount + 1;
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    player.fireCooldown = player.pumpT = 0;
    player.sprint = true;
    player.triggerReleased = true;
    shotgun.mag = Math.max(2, shotgun.mag);
    const sprintShotCount = G.shots;
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    const shotgunSprintImmediate =
      G.shots === sprintShotCount + 1 && !player.sprint && player.sprintFireRaise === 0;
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));

    keys.KeyW = keys.ShiftLeft = true;
    player.triggerHeld = true;
    mouseDX = 24;
    mouseDY = -18;
    clearLatchedInput();
    const lostFocusClearsInput =
      !keys.KeyW && !keys.ShiftLeft && !player.triggerHeld && mouseDX === 0 && mouseDY === 0;
    accumulateMouseInput(1200, -1200);
    const mouseWarpClamped = Math.abs(mouseDX) <= 90 && Math.abs(mouseDY) <= 90;
    mouseDX = mouseDY = 0;

    const sprintPoses = [];
    for (let i = 0; i < NORMAL_WEAPON_COUNT; i++) {
      player.weapon = i;
      player.reloadT = 0;
      player.sprint = true;
      player.bobAmp = 1;
      WEAPONS[i].vm._sprintK = 1;
      updateViewmodel(0, 0, 0);
      sprintPoses.push({
        x: vmSway.position.x,
        yaw: vmSway.rotation.y,
        roll: vmSway.rotation.z,
        pitch: vmSway.rotation.x,
      });
    }
    player.sprint = false;
    player.bobAmp = 0;

    player.weapon = 0;
    player.reloadT = player.reloadDuration = 0;
    player.reloadEmpty = false;
    switchWeapon(1);
    const switchTime = player.switching;
    player.switching = 0;
    player.switchTo = -1;
    savedAmmo.forEach((ammo, i) => Object.assign(WEAPONS[i], ammo));
    player.weapon = savedWeapon;
    updateViewmodel(0, 0, 0);
    updateAmmoUI();
    return {
      tacticalTime,
      emptyTime,
      tacticalMag,
      emptyMag,
      rifleTurn,
      rifleHandsIndependent,
      rifleOldMagThrown,
      rifleFlightPersists,
      rifleSeparateMags,
      rifleGrip,
      rifleHorizontal,
      rifleSlap,
      shotgunLoad,
      shotgunPump,
      shotgunRounds,
      shotgunDuration,
      shotgunLoaded,
      pistolOldMagGone,
      pistolGrip,
      pistolRack,
      sniperGrip,
      sniperArmContinuous,
      sniperArmCurve,
      sniperFreshComesFromPouch,
      sniperArmMaxStep,
      sniperArmMaxAt,
      sniperArmIgnoresOldFlight,
      sniperThrowsOld,
      sniperThrowNatural,
      sniperOldOutsidePivot,
      sniperSeatedMag,
      sniperBolt,
      sniperSideways,
      sniperReloadHand,
      sniperShotBoltHand,
      lmgFeed,
      lmgGrip,
      lmgThrowsOld,
      lmgRack,
      akTacticalRetains,
      akRetainContinuous,
      akFreshGrip,
      akEmptyRack,
      akTacticalDoesNotRack,
      akModelQuality,
      akAttachmentsWork,
      prismRendered,
      stagedResume: stagedResume.every(Boolean),
      magHiddenAfterInterrupt,
      flightContinuesAfterInterrupt,
      triggerResumesOpenReload,
      expiredFlight,
      noSecondThrownMag,
      shotgunResumed,
      shotgunNoDuplicate,
      shotgunFireInterrupt,
      shotgunClickImmediate,
      shotgunSprintImmediate,
      lostFocusClearsInput,
      mouseWarpClamped,
      reloadCentred: reloadPoses.every(
        (p) => p.x >= 0.02 && p.x <= 0.13 && Math.abs(p.roll) < 0.11
      ),
      sprintLeft: sprintPoses.every(
        (p) => p.x > -0.1 && p.x < -0.035 && p.yaw > 0.35 && p.roll < -0.22 && p.pitch > 0.3
      ),
      switchTime,
      audio:
        typeof SFX.magOut === 'function' &&
        typeof SFX.magIn === 'function' &&
        typeof SFX.weaponSwap === 'function',
    };
  });
  console.log('reload:', JSON.stringify(handling));

  check(
    handling.tacticalTime < handling.emptyTime &&
      handling.tacticalMag === 31 &&
      handling.emptyMag === 30,
    'tactical reload is faster, preserves the chambered round, and empty reload fills normally'
  );
  check(
    handling.rifleTurn &&
      handling.rifleHandsIndependent &&
      handling.rifleOldMagThrown &&
      handling.rifleFlightPersists &&
      handling.rifleSeparateMags &&
      handling.rifleGrip &&
      handling.rifleHorizontal &&
      handling.rifleSlap,
    'M4 receiver flicks independently of the hands, throws the old mag, inserts a fresh mag, then slaps home'
  );
  check(
    handling.shotgunLoad &&
      handling.shotgunPump &&
      handling.shotgunRounds === 2 &&
      handling.shotgunLoaded === 7 &&
      Math.abs(handling.shotgunDuration - 1.3) < 0.001,
    'shotgun animates exactly the available shells, follows each by hand, then pumps if empty'
  );
  check(
    handling.pistolOldMagGone && handling.pistolGrip && handling.pistolRack,
    'pistol drops its old mag, inserts a hand-held fresh mag, and racks the empty slide'
  );
  check(
    handling.sniperGrip &&
      handling.sniperArmContinuous &&
      handling.sniperArmCurve &&
      handling.sniperFreshComesFromPouch &&
      handling.sniperArmIgnoresOldFlight &&
      handling.sniperThrowsOld &&
      handling.sniperThrowNatural &&
      handling.sniperOldOutsidePivot &&
      handling.sniperSeatedMag &&
      handling.sniperBolt &&
      handling.sniperSideways &&
      handling.sniperReloadHand &&
      handling.sniperShotBoltHand,
    'sniper turns sideways and the right hand works the bolt during reload and post-shot cycling'
  );
  check(
    handling.lmgFeed && handling.lmgGrip && handling.lmgThrowsOld && handling.lmgRack,
    'LMG throws its old belt box, brings in a distinct new box, and pulls the charging handle'
  );
  check(
    handling.akTacticalRetains &&
      handling.akRetainContinuous &&
      handling.akFreshGrip &&
      handling.akEmptyRack &&
      handling.akTacticalDoesNotRack &&
      handling.akModelQuality &&
      handling.akAttachmentsWork &&
      handling.prismRendered,
    'AK reload mechanics, enlarged red dot, and true 2.5x prism rendering all work'
  );
  check(
    handling.stagedResume &&
      handling.magHiddenAfterInterrupt &&
      handling.flightContinuesAfterInterrupt &&
      handling.triggerResumesOpenReload &&
      handling.expiredFlight &&
      handling.noSecondThrownMag &&
      handling.shotgunResumed &&
      handling.shotgunNoDuplicate &&
      handling.shotgunFireInterrupt &&
      handling.shotgunClickImmediate &&
      handling.shotgunSprintImmediate,
    'open magwells resume, thrown mags never respawn, and shotguns fire immediately from reload or sprint'
  );
  check(
    handling.lostFocusClearsInput && handling.mouseWarpClamped,
    'focus loss clears stuck inputs and pointer-lock mouse warps are clamped'
  );
  check(
    handling.reloadCentred && handling.sprintLeft,
    'reloads stay visible while sprint carries every normal weapon low on the left with its muzzle left'
  );
  check(
    handling.switchTime < 0.7 && handling.audio,
    'weapon switching is faster and handling SFX are wired'
  );
}
