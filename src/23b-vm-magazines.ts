'use strict';
/* Pistols, sniper rifles and belt boxes use three distinct scene objects:
   seated magazine, discarded magazine and incoming fresh magazine. */
const MAG_RELOAD_POSE = {
  pistol: {
    pull: 0.1,
    release: 0.28,
    fresh: 0.4,
    insert: 0.66,
    travel: new THREE.Vector3(-0.085, -0.28, 0.045),
    throw: new THREE.Vector3(-0.35, -1.8, 0.18),
    spin: new THREE.Vector3(3.5, 1.2, 4.2),
    grip: new THREE.Vector3(-0.052, 0.012, 0.004),
  },
  ak: {
    pull: 0.09,
    release: 0.3,
    fresh: 0.38,
    insert: 0.7,
    travel: new THREE.Vector3(-0.13, -0.31, 0.06),
    throw: new THREE.Vector3(-0.92, -0.48, 0.16),
    spin: new THREE.Vector3(2.8, -1.2, 4.6),
    gravity: 3.8,
    grip: new THREE.Vector3(-0.055, -0.025, 0.012),
  },
  sniper: {
    pull: 0.12,
    release: 0.34,
    fresh: 0.52,
    catch: 0.58,
    insert: 0.86,
    extract: new THREE.Vector3(-0.075, -0.17, 0.035),
    pouchOffset: new THREE.Vector3(-0.2, -0.56, 0.1),
    throw: new THREE.Vector3(-0.56, -0.03, 0.1),
    spin: new THREE.Vector3(1.2, -0.5, 2.0),
    gravity: 3.2,
    grip: new THREE.Vector3(-0.054, -0.02, 0.012),
  },
  lmg: {
    pull: 0.14,
    release: 0.42,
    fresh: 0.48,
    insert: 0.72,
    travel: new THREE.Vector3(-0.2, -0.3, 0.045),
    throw: new THREE.Vector3(-1.15, -0.7, 0.2),
    spin: new THREE.Vector3(2.4, -1.8, 4.0),
    grip: new THREE.Vector3(-0.064, -0.035, 0.018),
  },
  vector: {
    pull: 0.11,
    release: 0.28,
    fresh: 0.4,
    insert: 0.68,
    travel: new THREE.Vector3(-0.1, -0.3, 0.035),
    throw: new THREE.Vector3(-0.72, -0.9, 0.16),
    spin: new THREE.Vector3(3.2, -1, 4.4),
    gravity: 4.2,
    grip: new THREE.Vector3(-0.052, -0.02, 0.01),
  },
  p90: {
    pull: 0.1,
    release: 0.31,
    fresh: 0.43,
    insert: 0.72,
    travel: new THREE.Vector3(-0.16, 0.16, 0.08),
    throw: new THREE.Vector3(-0.95, 0.3, 0.22),
    spin: new THREE.Vector3(2, -2.4, 3.4),
    gravity: 4.4,
    grip: new THREE.Vector3(-0.046, 0, 0.02),
  },
};

function magazineGripInHandSpace(vm, object, offset, out) {
  vm.group.updateMatrixWorld(true);
  out.copy(offset);
  object.localToWorld(out);
  vm.leftHand.parent.worldToLocal(out);
  return out;
}

function poseMagazineArmAt(vm, position, rotation) {
  vm.leftHand.position.copy(position);
  vm.leftHand.rotation.set(rotation.x, rotation.y, rotation.z);
  if (vm.leftHand.forearm) vm.leftHand.forearm.visible = true;
}

function smootherStep(k) {
  k = clamp(k, 0, 1);
  return k * k * k * (k * (k * 6 - 15) + 10);
}

function placeSniperOldMagazine(vm, pull, cfg) {
  copyMagazineOutsideWeaponPivot(vm, vm.mag);
  const offset = (vm._sniperExtract || (vm._sniperExtract = new THREE.Vector3()))
    .copy(cfg.extract)
    .multiplyScalar(pull)
    .applyQuaternion(vm.weaponPivot.quaternion);
  vm.ejectedMag.position.add(offset);
  vm.ejectedMag.rotateZ(-pull * 0.18);
  vm.mag.visible = false;
}

function placeSniperFreshMagazine(vm, t, cfg) {
  vm.group.updateMatrixWorld(true);
  const pouch = (vm._sniperPouchPos || (vm._sniperPouchPos = new THREE.Vector3()))
    .copy(vm._newMagPos)
    .add(cfg.pouchOffset);
  const seated = vm.mag.getWorldPosition(
    vm._sniperSeatedPos || (vm._sniperSeatedPos = new THREE.Vector3())
  );
  vm.group.worldToLocal(seated);
  /* Constant speed keeps the long pouch-to-well travel readable and removes
     the high-velocity midpoint that looked like the arm teleported. */
  const rise = clamp((t - cfg.catch) / (cfg.insert - cfg.catch), 0, 1);
  vm.newMag.position.lerpVectors(pouch, seated, rise);
  const pouchQ = (
    vm._sniperPouchQ ||
    (vm._sniperPouchQ = new THREE.Quaternion()
      .setFromEuler(vm._newMagRot)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, -0.08, 0.4))))
  ).clone();
  const groupQ = vm.group
    .getWorldQuaternion(vm._sniperGroupQ || (vm._sniperGroupQ = new THREE.Quaternion()))
    .invert();
  const seatedQ = groupQ.multiply(
    vm.mag.getWorldQuaternion(vm._sniperSeatedQ || (vm._sniperSeatedQ = new THREE.Quaternion()))
  );
  vm.newMag.quaternion.copy(pouchQ).slerp(seatedQ, rise);
  vm.newMag.visible = t >= cfg.fresh && t < cfg.insert;
}

function animateSniperMagazine(vm, state, t, cfg) {
  const rotation =
    vm._reloadHandRotation || (vm._reloadHandRotation = new THREE.Vector3(0.16, 0.12, -0.48));
  placeSniperFreshMagazine(vm, t, cfg);
  if (t < cfg.pull) {
    vm.mag.visible = !state?.magVisualReleased;
    return;
  }
  if (t < cfg.release) {
    const pull = smootherStep((t - cfg.pull) / (cfg.release - cfg.pull));
    placeSniperOldMagazine(vm, pull, cfg);
    const reach = easeInOutCubic(clamp((t - cfg.pull) / 0.08, 0, 1));
    poseReloadHand(vm, vm.ejectedMag, cfg.grip, rotation, reach, vm.leftHand, false);
    return;
  }
  if (!state?.magVisualReleased) {
    placeSniperOldMagazine(vm, 1, cfg);
    state.armReleasePos = magazineGripInHandSpace(vm, vm.ejectedMag, cfg.grip, new THREE.Vector3());
    launchViewmodelMagazine(vm, state, vm.ejectedMag, cfg.throw, cfg.spin, cfg.gravity);
  }
  vm.mag.visible = false;
  const pouchGrip = magazineGripInHandSpace(
    vm,
    vm.newMag,
    cfg.grip,
    vm._sniperPouchGrip || (vm._sniperPouchGrip = new THREE.Vector3())
  );
  if (t < cfg.fresh) {
    /* Cover the long trip to the chest at a constant hand speed. A smoothstep
       doubles midpoint velocity here and reads as a one-frame arm teleport. */
    const k = clamp((t - cfg.release) / (cfg.fresh - cfg.release), 0, 1);
    const p = vm._sniperArmPose || (vm._sniperArmPose = new THREE.Vector3());
    poseMagazineArmAt(vm, p.lerpVectors(state.armReleasePos, pouchGrip, k), rotation);
    return;
  }
  const returnAt = cfg.insert + 0.12;
  if (t >= cfg.insert) {
    vm.mag.visible = true;
    vm.newMag.visible = false;
  }
  if (t < returnAt) {
    const release = 1 - easeInOutCubic(clamp((t - cfg.insert) / 0.12, 0, 1));
    poseReloadHand(vm, vm.newMag, cfg.grip, rotation, release, vm.leftHand, false);
  }
}

function poseAKFreshMagazine(fresh, t, strikeStart, strikeAt, hookAt, lockAt) {
  if (t < strikeAt) {
    const k = smootherStep((t - strikeStart) / (strikeAt - strikeStart));
    fresh.position.x += lerp(-0.25, -0.065, k);
    fresh.position.y += lerp(-0.39, -0.1, k);
    fresh.position.z += lerp(0.13, 0.035, k);
    fresh.rotation.x += lerp(0.62, 0.42, k);
    fresh.rotation.z += lerp(0.54, 0.28, k);
  } else if (t < hookAt) {
    const k = smootherStep((t - strikeAt) / (hookAt - strikeAt));
    fresh.position.x += lerp(-0.065, -0.015, k);
    fresh.position.y += lerp(-0.1, -0.055, k);
    fresh.position.z += lerp(0.035, -0.025, k);
    fresh.rotation.x += lerp(0.42, 0.5, k);
    fresh.rotation.z += lerp(0.28, 0.08, k);
  } else {
    const rock = smootherStep((t - hookAt) / (lockAt - hookAt));
    fresh.position.x -= 0.015 * (1 - rock);
    fresh.position.y -= 0.055 * (1 - rock);
    fresh.position.z -= 0.025 * (1 - rock);
    fresh.rotation.x += 0.5 * (1 - rock);
    fresh.rotation.z += 0.08 * (1 - rock);
  }
}

function poseAKRetainedMagazine(vm, state, t, strikeAt, lockAt) {
  const old = vm.ejectedMag,
    fresh = vm.newMag,
    stow = smootherStep((t - lockAt) / 0.18),
    catchK = smootherStep((t - strikeAt) / 0.14);
  vm.group.updateMatrixWorld(true);
  const target = fresh.getWorldPosition(
    vm._akHeldOldTarget || (vm._akHeldOldTarget = new THREE.Vector3())
  );
  vm.group.worldToLocal(target);
  target.x -= 0.075 + stow * 0.12;
  target.y -= 0.018 + stow * 0.38;
  target.z += 0.035 + stow * 0.08;
  const q = fresh.getWorldQuaternion(
    vm._akHeldOldWorldQ || (vm._akHeldOldWorldQ = new THREE.Quaternion())
  );
  const inverseGroup = vm.group
    .getWorldQuaternion(vm._akHeldOldGroupQ || (vm._akHeldOldGroupQ = new THREE.Quaternion()))
    .invert();
  const targetQ = inverseGroup.multiply(q);
  targetQ.multiply(
    (vm._akRetainTilt || (vm._akRetainTilt = new THREE.Quaternion())).setFromEuler(
      vm._akRetainEuler || (vm._akRetainEuler = new THREE.Euler(0, 0, -0.18))
    )
  );
  /* At latch release the duplicate inherits the seated magazine's exact
     world pose. Blend from that captured pose into the two-magazine grip so
     it visibly rocks out of the well instead of teleporting into the hand. */
  state.retainedStartPos ||= old.position.clone();
  state.retainedStartQ ||= old.quaternion.clone();
  old.position.lerpVectors(state.retainedStartPos, target, catchK);
  old.quaternion.copy(state.retainedStartQ).slerp(targetQ, catchK);
  old.visible = stow < 0.98;
}

function animateAKMagazine(vm, state, t, cfg) {
  /* Empty reload sweeps the old magazine away. A reload with a chambered
     round traps and retains the partial magazine instead of throwing it. */
  const strikeStart = 0.055,
    strikeAt = cfg.release,
    hookAt = 0.5,
    lockAt = cfg.insert;
  const fresh = vm.newMag,
    emergency = !!state?.empty;
  fresh.visible = t >= strikeStart && t < lockAt;
  vm.mag.visible = t < strikeAt && !state?.magVisualReleased;
  poseAKFreshMagazine(fresh, t, strikeStart, strikeAt, hookAt, lockAt);

  if (t < strikeAt) {
    const impact = easeOutCubic(clamp((t - 0.245) / 0.055, 0, 1));
    if (emergency) {
      vm.mag.rotation.x -= impact * 0.18;
      vm.mag.rotation.z -= impact * 0.16;
    }
  } else {
    if (!state?.magVisualReleased && !vm._magFlight) copyMagazineOutsideWeaponPivot(vm, vm.mag);
    vm.mag.visible = false;
    if (emergency) {
      launchViewmodelMagazine(vm, state, vm.ejectedMag, cfg.throw, cfg.spin, cfg.gravity);
    } else {
      state.magVisualReleased = true;
      poseAKRetainedMagazine(vm, state, t, strikeAt, lockAt);
    }
  }
  if (t >= lockAt) vm.mag.visible = true;
  if (!vm.leftHand || !fresh.visible) return;
  const grip = smootherStep((t - strikeStart) / 0.055) * (1 - smootherStep((t - lockAt) / 0.1));
  poseReloadHand(
    vm,
    fresh,
    cfg.grip,
    vm._akMagHandRot || (vm._akMagHandRot = new THREE.Vector3(0.2, 0.1, -0.5)),
    grip,
    vm.leftHand,
    false
  );
}

function animateDistinctMagazine(w, vm, t) {
  const cfg = MAG_RELOAD_POSE[w.id];
  if (!cfg || !vm.newMag || !vm.ejectedMag) return;
  const state = w.reloadState;
  if (w.id === 'ak') {
    animateAKMagazine(vm, state, t, cfg);
    return;
  }
  if (w.id === 'sniper') {
    animateSniperMagazine(vm, state, t, cfg);
    return;
  }
  const pull = easeOutCubic(clamp((t - cfg.pull) / (cfg.release - cfg.pull), 0, 1));
  const extracting = t >= cfg.pull && t < cfg.release;
  if (extracting) {
    vm.mag.position.addScaledVector(cfg.travel, pull);
    vm.mag.rotation.z += pull * (w.id === 'lmg' ? 0.42 : 0.3);
    if (w.id === 'ak') vm.mag.rotation.x += pull * 0.34;
    /* The old magazine leaves weaponPivot as soon as it clears the well. Its
       pose is copied through world space, so further gun roll cannot drag it. */
    copyMagazineOutsideWeaponPivot(vm, vm.mag);
    vm.mag.visible = false;
  } else {
    vm.mag.visible = t < cfg.pull && !state?.magVisualReleased;
  }
  if (t >= cfg.release) {
    launchViewmodelMagazine(vm, state, vm.ejectedMag, cfg.throw, cfg.spin, cfg.gravity);
    vm.mag.visible = false;
  }

  const insertStart = cfg.fresh + 0.05;
  const insertK = clamp((t - insertStart) / (cfg.insert - insertStart), 0, 1);
  /* The long sniper magazine travels far across the frame. A linear seating
     path keeps the support hand at constant speed instead of snapping through
     the steep midpoint of an ease curve. */
  const incoming = 1 - easeInOutCubic(insertK);
  vm.newMag.visible = t >= cfg.fresh && t < cfg.insert;
  vm.newMag.position.addScaledVector(cfg.travel, incoming);
  vm.newMag.rotation.z += incoming * (w.id === 'lmg' ? 0.42 : 0.3);
  if (w.id === 'ak') vm.newMag.rotation.x += incoming * 0.34;
  /* updateViewmodel already restored the seated object's base transform. Do
     not reapply the extraction travel after the fresh mag reaches the well. */
  if (t >= cfg.insert) vm.mag.visible = true;

  if (!vm.leftHand) return;
  const oldGrip =
    w.id === 'pistol'
      ? 0
      : easeInOutCubic(clamp(t / cfg.pull, 0, 1)) *
        (1 - easeInOutCubic(clamp((t - cfg.release + 0.04) / 0.08, 0, 1)));
  if (oldGrip > 0)
    poseReloadHand(
      vm,
      extracting ? vm.ejectedMag : vm.mag,
      cfg.grip,
      vm._reloadHandRotation || (vm._reloadHandRotation = new THREE.Vector3(0.16, 0.12, -0.48)),
      oldGrip,
      vm.leftHand,
      false
    );
  const newGrip =
    easeInOutCubic(clamp((t - cfg.fresh) / 0.06, 0, 1)) *
    (1 - easeInOutCubic(clamp((t - cfg.insert) / 0.1, 0, 1)));
  if (newGrip > 0)
    poseReloadHand(
      vm,
      vm.newMag,
      cfg.grip,
      vm._reloadHandRotation || (vm._reloadHandRotation = new THREE.Vector3(0.16, 0.12, -0.48)),
      newGrip,
      vm.leftHand,
      false
    );
}

function animateSmgReloadPresentation(w, vm, t, pose) {
  const compact =
    easeOutCubic(clamp(t / 0.14, 0, 1)) *
    (1 - easeInOutCubic(clamp((t - 0.86) / 0.14, 0, 1)));
  pose[0] = lerp(pose[0], w.id === 'p90' ? 0.03 : 0.055, compact);
  pose[1] += compact * 0.095;
  pose[2] -= compact * 0.075;
  vm.weaponPivot.rotation.y += compact * (w.id === 'p90' ? 0.28 : 0.16);
  vm.weaponPivot.rotation.z -= compact * (w.id === 'p90' ? 0.3 : 0.18);
  poseReloadHand(
    vm,
    vm.rightGrip,
    vm._smgRightGrip || (vm._smgRightGrip = new THREE.Vector3()),
    vm._smgRightRot || (vm._smgRightRot = new THREE.Vector3(0.28, 0.06, -0.2)),
    compact * 0.76,
    vm.rightHand,
    false
  );
}

function animateSmgReloadRack(w, vm, t) {
  if ((w.id !== 'vector' && w.id !== 'p90') || !player.reloadEmpty) return;
  const rack = Math.sin(PI * clamp((t - 0.78) / 0.17, 0, 1));
  vm.chargeHandle.position.z += rack * 0.09;
  poseReloadHand(
    vm,
    vm.chargeHandle,
    vm._smgRackGrip || (vm._smgRackGrip = new THREE.Vector3(-0.04, 0, 0.01)),
    vm._smgRackRot || (vm._smgRackRot = new THREE.Vector3(0.14, -0.08, -0.48)),
    rack
  );
}
