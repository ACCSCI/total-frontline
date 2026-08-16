// @ts-nocheck
/* GENERATED from single-player viewmodel animation. Do not edit. */
import * as THREE from 'three';

export function createViewmodelAnimator() {
  const PI = Math.PI;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (cur, tgt, lambda, dt) => lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  let player;
  let WEAPONS;
  let camera;
  let vmCamera;
  let vmSway;
  let vmRecoil;
  const vmRec = { pz: 0, py: 0, rx: 0, ry: 0, rz: 0, vz: 0, vy: 0, vrx: 0, vry: 0, vrz: 0 };
  let flashT = 0;
  const flashDur = 0.055;
  let flashPower = 1;
  const muzzleSprite = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    material: { opacity: 0, rotation: 0 },
  };
  const muzzleGlow = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    material: { opacity: 0 },
  };
  const vmMuzzleLight = { position: new THREE.Vector3(), intensity: 0 };
  const muzzleLight = { position: new THREE.Vector3(), intensity: 0 };
  const G = { running: true };
  const _tmpV = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const VM_FOV = 41.9;
  const VM_ADS_DOLLY = 0.58;
  const VM_LIGHT_BASE = { amb: 0.4, key: 1.52, fill: 0.38, rim: 0.42 };
  const vmAmb = { intensity: 0.4 };
  const vmKey = { intensity: 1.52 };
  const vmFill = { intensity: 0.38 };
  const vmRim = { intensity: 0.42 };


/* ==== src/23a-vm-rifle-physics.ts ==== */
function rifleTurnRotation(t, out) {
  const present =
    easeOutCubic(clamp(t / 0.12, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.86) / 0.14, 0, 1)));
  const flick = Math.sin(PI * clamp((t - 0.035) / 0.13, 0, 1));
  return out.set(present * 0.1, present * 0.42 + flick * 0.16, -present * 1.12 - flick * 0.18);
}

function poseRifleEjectedMag(vm) {
  const s = vm._magFlight;
  if (!s) return;
  vm.ejectedMag.position.copy(s.position).addScaledVector(s.velocity, s.age);
  vm.ejectedMag.position.y -= 0.5 * (s.gravity || 2.5) * s.age * s.age;
  vm.ejectedMag.quaternion.copy(s.quaternion);
  const tumble = (vm._magTumble || (vm._magTumble = new THREE.Euler())).set(
    s.angularVelocity.x * s.age,
    s.angularVelocity.y * s.age,
    s.angularVelocity.z * s.age
  );
  vm.ejectedMag.quaternion.multiply(
    (vm._magTumbleQuat || (vm._magTumbleQuat = new THREE.Quaternion())).setFromEuler(tumble)
  );
  const p = vm.ejectedMag.position;
  const outside = Math.abs(p.x) > 1.45 || p.y < -1.35 || p.y > 1.35;
  vm.ejectedMag.visible = !outside && s.age < 2;
  if (!vm.ejectedMag.visible) vm._magFlight = null;
}

function animateRifleEjectedMag(vm, t, total, state) {
  const releaseT = 0.055;
  if (t < releaseT) return;
  vm.mag.visible = false;
  /* The same interrupted reload may cross this point many times. Once its
     physical mag has left and expired, never manufacture another one. */
  if (state?.magVisualReleased && !vm._magFlight) return;
  if (state && vm._magFlight) state.magVisualReleased = true;
  const releaseRot =
    vm._magReleaseRot || (vm._magReleaseRot = rifleTurnRotation(releaseT, new THREE.Euler()));
  const releasePos =
    vm._magReleasePos || (vm._magReleasePos = vm._magPos.clone().applyEuler(releaseRot));
  const sampleSeconds = 1 / 120;
  const previousT = Math.max(0, releaseT - sampleSeconds / total);
  const previousRot = rifleTurnRotation(
    previousT,
    vm._magPreviousRot || (vm._magPreviousRot = new THREE.Euler())
  );
  const previousPos = (vm._magPreviousPos || (vm._magPreviousPos = new THREE.Vector3()))
    .copy(vm._magPos)
    .applyEuler(previousRot);
  const tangentialVelocity = (
    vm._magTangentialVelocity || (vm._magTangentialVelocity = new THREE.Vector3())
  )
    .copy(releasePos)
    .sub(previousPos)
    .divideScalar(sampleSeconds);
  const releaseVelocity = (
    vm._magReleaseVelocity || (vm._magReleaseVelocity = new THREE.Vector3())
  ).copy(tangentialVelocity);
  releaseVelocity.add(
    (vm._magLatchImpulse || (vm._magLatchImpulse = new THREE.Vector3(0, -0.1, 0.012)))
      .clone()
      .applyEuler(releaseRot)
  );
  const angularVelocity = (
    vm._magAngularVelocity || (vm._magAngularVelocity = new THREE.Vector3())
  ).set(
    (releaseRot.x - previousRot.x) / sampleSeconds,
    (releaseRot.y - previousRot.y) / sampleSeconds,
    (releaseRot.z - previousRot.z) / sampleSeconds
  );
  const magBaseQuat =
    vm._magRotQuat || (vm._magRotQuat = new THREE.Quaternion().setFromEuler(vm._magRot));
  if (!vm._magFlight) {
    vm._magFlight = {
      age: 0,
      position: releasePos.clone(),
      velocity: releaseVelocity.clone(),
      angularVelocity: angularVelocity.clone(),
      quaternion: new THREE.Quaternion().setFromEuler(releaseRot).multiply(magBaseQuat),
    };
    if (state) state.magVisualReleased = true;
  }
  vm._magFlight.age = Math.max(vm._magFlight.age, (t - releaseT) * total);
  poseRifleEjectedMag(vm);
}

function continueRifleEjectedMag(vm, dt) {
  if (!vm._magFlight) return;
  vm._magFlight.age += dt;
  poseRifleEjectedMag(vm);
}

function launchViewmodelMagazine(vm, state, source, velocity, angularVelocity, gravity?) {
  if (!state || state.magVisualReleased || vm._magFlight) return;
  vm.group.updateMatrixWorld(true);
  const position = source.getWorldPosition(new THREE.Vector3());
  vm.group.worldToLocal(position);
  const quaternion = vm.group
    .getWorldQuaternion(new THREE.Quaternion())
    .invert()
    .multiply(source.getWorldQuaternion(new THREE.Quaternion()));
  vm._magFlight = {
    age: 0,
    position,
    velocity: velocity.clone(),
    angularVelocity: angularVelocity.clone(),
    quaternion,
    gravity: gravity || 2.5,
  };
  state.magVisualReleased = true;
  poseRifleEjectedMag(vm);
}

function copyMagazineOutsideWeaponPivot(vm, source) {
  vm.group.updateMatrixWorld(true);
  const position = source.getWorldPosition(new THREE.Vector3());
  vm.group.worldToLocal(position);
  const quaternion = vm.group
    .getWorldQuaternion(new THREE.Quaternion())
    .invert()
    .multiply(source.getWorldQuaternion(new THREE.Quaternion()));
  vm.ejectedMag.position.copy(position);
  vm.ejectedMag.quaternion.copy(quaternion);
  vm.ejectedMag.visible = true;
}

function updateDetachedMagazinePhysics(dt) {
  for (let i = 0; i < WEAPONS.length; i++) {
    const vm = WEAPONS[i].vm;
    if (!vm?._magFlight) continue;
    /* The active M4 reload derives age from its normalized animation time.
       Every interrupted/holstered flight advances independently instead. */
    if (i === player.weapon && player.reloadT > 0 && WEAPONS[i].id === 'rifle') continue;
    continueRifleEjectedMag(vm, dt);
  }
}


/* ==== src/23b-vm-magazines.ts ==== */
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


/* ==== src/24-vm-anim.ts ==== */
/* =========================================================================
   18. VIEWMODEL ANIMATION
   ========================================================================= */
let swayX = 0,
  swayY = 0,
  swayLagX = 0,
  swayLagY = 0;

function poseReloadHand(
  vm,
  target,
  offset,
  rotation,
  blend,
  hand = vm.leftHand,
  hideForearm = true
) {
  if (!hand || blend <= 0) return;
  /* The hand and detachable magazine do not always share a parent (the
     pistol mag lives under its angled grip, for example). Resolve the grab
     point through world space, then convert it back into the hand parent's
     local space so both objects really meet instead of receiving merely
     similar-looking local offsets. */
  vm.group.updateMatrixWorld(true);
  const grab = vm._reloadHandTarget || (vm._reloadHandTarget = new THREE.Vector3());
  grab.copy(offset);
  target.localToWorld(grab);
  hand.parent.worldToLocal(grab);
  hand.position.lerp(grab, blend);
  hand.rotation.x = lerp(hand.rotation.x, rotation.x, blend);
  hand.rotation.y = lerp(hand.rotation.y, rotation.y, blend);
  hand.rotation.z = lerp(hand.rotation.z, rotation.z, blend);
  if (hideForearm && hand.forearm) hand.forearm.visible = blend < 0.002;
}

function updateViewmodel(dt, mdx, mdy) {
  const w = WEAPONS[player.weapon];
  const vm = w.vm;

  /* sway from mouse movement */
  const heavy = w.heavy ? 1 : 0;
  swayX = damp(swayX, clamp(-mdx * 0.0016, -0.055, 0.055), heavy ? 6 : 12, dt);
  swayY = damp(swayY, clamp(mdy * 0.0016, -0.045, 0.045), heavy ? 6 : 12, dt);
  swayLagX = damp(swayLagX, swayX, heavy ? 4.5 : 9, dt);
  swayLagY = damp(swayLagY, swayY, heavy ? 4.5 : 9, dt);

  /* recoil spring */
  const K = 210,
    D = 19;
  vmRec.vz += -vmRec.pz * K * dt;
  vmRec.vz -= vmRec.vz * D * dt;
  vmRec.pz += vmRec.vz * dt;
  vmRec.vy += -vmRec.py * K * dt;
  vmRec.vy -= vmRec.vy * D * dt;
  vmRec.py += vmRec.vy * dt;
  vmRec.vrx += -vmRec.rx * K * dt;
  vmRec.vrx -= vmRec.vrx * D * dt;
  vmRec.rx += vmRec.vrx * dt;
  vmRec.vry += -vmRec.ry * K * dt;
  vmRec.vry -= vmRec.vry * D * dt;
  vmRec.ry += vmRec.vry * dt;
  vmRec.vrz += -vmRec.rz * K * dt;
  vmRec.vrz -= vmRec.vrz * D * dt;
  vmRec.rz += vmRec.vrz * dt;

  /* base pose */
  let px = vm.basePos.x,
    py = vm.basePos.y,
    pz = vm.basePos.z;
  let rx = vm.baseRot.x,
    ry = vm.baseRot.y,
    rz = vm.baseRot.z;

  /* Compressed high-ready: stock in the pec, muzzle up along the ribs. */
  const sprintK = damp(vm._sprintK || 0, player.sprint && player.bobAmp > 0.6 ? 1 : 0, 9, dt);
  vm._sprintK = sprintK;
  const amp = player.bobAmp * (1 - sprintK * 0.65);
  px += Math.sin(player.bob) * (heavy ? 0.015 : 0.022) * amp;
  py += (Math.abs(Math.cos(player.bob)) - 0.5) * (heavy ? 0.028 : 0.02) * amp;
  rz += Math.sin(player.bob) * (heavy ? 0.044 : 0.03) * amp;
  rx += Math.cos(player.bob * 2) * 0.014 * amp;

  /* airborne float */
  if (!player.onGround) {
    py -= clamp(player.vel.y * 0.006, -0.05, 0.05);
    rx += clamp(player.vel.y * 0.01, -0.09, 0.09);
  }

  px = lerp(px, heavy ? -0.01 : -0.048, sprintK);
  py -= sprintK * (heavy ? 0.17 : 0.208);
  pz += sprintK * (heavy ? 0.2 : 0.275);
  rx = lerp(rx, heavy ? 0.68 : 0.86, sprintK);
  ry = lerp(ry, heavy ? 0.4 : 0.46, sprintK);
  rz = lerp(rz, heavy ? -0.34 : -0.5, sprintK);

  /* crouch: tucked in slightly */
  const crouchK = damp(vm._crouchK || 0, player.crouch ? 1 : 0, 10, dt);
  vm._crouchK = crouchK;
  px -= crouchK * 0.018;
  py += crouchK * 0.012;
  pz += crouchK * 0.02;

  if (vm.mag) {
    vm._magPos ||= vm.mag.position.clone();
    vm._magRot ||= vm.mag.rotation.clone();
    vm.mag.position.copy(vm._magPos);
    vm.mag.rotation.copy(vm._magRot);
    const interrupted = w.reloadState;
    vm.mag.visible = !(interrupted?.magOut && !interrupted?.inserted);
  }
  if (vm.newMag) {
    vm._newMagPos ||= vm.newMag.position.clone();
    vm._newMagRot ||= vm.newMag.rotation.clone();
    vm.newMag.position.copy(vm._newMagPos);
    vm.newMag.rotation.copy(vm._newMagRot);
    vm.newMag.visible = false;
  }
  if (w.id === 'ak' && vm.ejectedMag && !w.reloadState && !vm._magFlight)
    vm.ejectedMag.visible = false;
  for (const hand of [vm.leftHand, vm.rightHand]) {
    if (!hand) continue;
    hand._reloadBasePos ||= hand.position.clone();
    hand._reloadBaseRot ||= hand.rotation.clone();
    hand.position.copy(hand._reloadBasePos);
    hand.rotation.copy(hand._reloadBaseRot);
    if (hand.forearm) hand.forearm.visible = true;
  }
  if (vm.weaponPivot) {
    vm._weaponPivotPos ||= vm.weaponPivot.position.clone();
    vm._weaponPivotRot ||= vm.weaponPivot.rotation.clone();
    vm.weaponPivot.position.copy(vm._weaponPivotPos);
    vm.weaponPivot.rotation.copy(vm._weaponPivotRot);
  }
  if (vm.topCover) {
    vm._coverRot ||= vm.topCover.rotation.clone();
    vm.topCover.rotation.copy(vm._coverRot);
  }
  if (vm.chargeHandle) {
    vm._chargePos ||= vm.chargeHandle.position.clone();
    vm.chargeHandle.position.copy(vm._chargePos);
  }
  vm._reloadSlide = 0;
  vm._reloadBoltLift = 0;
  vm._reloadBoltBack = 0;
  vm._reloadPump = 0;
  if (vm.reloadShell) vm.reloadShell.visible = false;

  /* Keep the receiver inside the lower-centre safe area. The magazine itself
     now leaves and re-enters the well, rather than faking the action by moving
     the whole weapon off the right or bottom of the screen. */
  if (player.reloadT > 0) {
    const total = player.reloadDuration || w.reloadTime;
    const t = 1 - player.reloadT / total;
    const dip =
      t < 0.22 ? easeOutCubic(t / 0.22) : t < 0.72 ? 1 : 1 - easeInOutCubic((t - 0.72) / 0.28);
    /* Each weapon exposes the part the operator actually needs to reach. */
    if (w.id === 'rifle') {
      /* M4-specific presentation: snap the receiver across the body and hold
         it nearly horizontal long enough to see the empty magwell, insertion,
         and final palm strike. */
      const present =
        easeOutCubic(clamp(t / 0.12, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.86) / 0.14, 0, 1)));
      px = lerp(px, 0.015, present);
      py += present * 0.12;
      pz -= present * 0.11;
      rx = lerp(rx, 0.04, present);
      ry = lerp(ry, 0.1, present);
      rz = lerp(rz, 0.02, present);
      const turnRot = rifleTurnRotation(
        t,
        vm._rifleTurnRot || (vm._rifleTurnRot = new THREE.Euler())
      );
      vm.weaponPivot.rotation.x += turnRot.x;
      vm.weaponPivot.rotation.y += turnRot.y;
      vm.weaponPivot.rotation.z += turnRot.z;
      /* A short overshoot makes this read as a deliberate sideways flick,
         instead of the receiver simply interpolating into a display pose. */
      const flick = Math.sin(PI * clamp((t - 0.035) / 0.13, 0, 1));
      px -= flick * 0.065;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._rifleRightGrip || (vm._rifleRightGrip = new THREE.Vector3()),
        vm._rifleRightRot || (vm._rifleRightRot = new THREE.Vector3(0.34, 0.1, -0.34)),
        present,
        vm.rightHand,
        false
      );
    } else if (w.id === 'ak') {
      /* Keep the arms upright while the receiver rolls into a readable AK
         rock-and-lock presentation. The support hand owns both magazines. */
      const side =
        easeOutCubic(clamp(t / 0.13, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.9) / 0.1, 0, 1)));
      px = lerp(px, 0.035, side);
      py += side * 0.105;
      pz -= side * 0.095;
      rx = lerp(rx, 0.04, side);
      ry = lerp(ry, 0.1, side);
      rz = lerp(rz, -0.02, side);
      vm.weaponPivot.rotation.x += side * 0.08;
      vm.weaponPivot.rotation.y += side * 0.18;
      vm.weaponPivot.rotation.z -= side * 0.82;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._akRightGrip || (vm._akRightGrip = new THREE.Vector3()),
        vm._akRightRot || (vm._akRightRot = new THREE.Vector3(0.3, 0.08, -0.25)),
        side * 0.86,
        vm.rightHand,
        false
      );
    } else if (w.id === 'shotgun') {
      px = lerp(px, 0.06, dip);
      py += dip * 0.095;
      pz -= dip * 0.08;
      rx = lerp(rx, 0.17, dip);
      ry = lerp(ry, 0.22, dip);
      rz = lerp(rz, -0.045, dip);
    } else if (w.id === 'pistol') {
      px = lerp(px, 0.045, dip);
      py += dip * 0.08;
      pz -= dip * 0.055;
      rx = lerp(rx, 0.12, dip);
      ry = lerp(ry, 0.2, dip);
      rz = lerp(rz, -0.07, dip);
    } else if (w.id === 'sniper') {
      /* Only the rifle rolls. The camera-space carry and shoulders stay
         upright; wrists follow individual controls without twisting arms. */
      const side =
        easeOutCubic(clamp(t / 0.18, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.86) / 0.135, 0, 1)));
      px = lerp(px, 0.045, side);
      py += side * 0.08;
      pz -= side * 0.07;
      rx = lerp(rx, 0.04, side);
      ry = lerp(ry, 0.13, side);
      rz = lerp(rz, -0.04, side);
      vm.weaponPivot.rotation.x += side * 0.04;
      vm.weaponPivot.rotation.y += side * 0.2;
      vm.weaponPivot.rotation.z -= side * 1.15;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._sniperRightGrip || (vm._sniperRightGrip = new THREE.Vector3()),
        vm._sniperRightRot || (vm._sniperRightRot = new THREE.Vector3(0.28, 0.08, -0.22)),
        side * 0.82,
        vm.rightHand,
        false
      );
    } else if (w.id === 'lmg') {
      px = lerp(px, 0.09, dip);
      py += dip * 0.07;
      pz -= dip * 0.09;
      rx = lerp(rx, 0.11, dip);
      ry = lerp(ry, 0.25, dip);
      rz = lerp(rz, -0.04, dip);
    } else if (w.id === 'vector' || w.id === 'p90') {
      const smgPose = [px, py, pz];
      animateSmgReloadPresentation(w, vm, t, smgPose);
      [px, py, pz] = smgPose;
    }
    if (w.id !== 'rifle' && w.id !== 'shotgun') animateDistinctMagazine(w, vm, t);

    if (w.id === 'rifle') {
      /* Release at peak receiver speed. The old magazine then lives outside
         weaponPivot and follows a tiny frame-rate-independent rigid-body
         trajectory: initial velocity + gravity + angular velocity. */
      animateRifleEjectedMag(vm, t, total, w.reloadState);

      /* 44–70%: a distinct fresh mag rises from below in the support hand and
         seats along the actual magwell axis. */
      const insert = 1 - easeInOutCubic(clamp((t - 0.47) / 0.23, 0, 1));
      vm.newMag.visible = t >= 0.42 && t < 0.9;
      vm.newMag.position.x -= insert * 0.16;
      vm.newMag.position.y -= insert * 0.32;
      vm.newMag.position.z += insert * 0.08;
      vm.newMag.rotation.x += insert * 0.12;
      vm.newMag.rotation.z += insert * 0.38;
      if (vm.leftHand && t >= 0.42) {
        const hold =
          easeInOutCubic(clamp((t - 0.42) / 0.06, 0, 1)) *
          (1 - easeInOutCubic(clamp((t - 0.79) / 0.1, 0, 1)));
        poseReloadHand(
          vm,
          vm.newMag,
          vm._rifleMagGrip || (vm._rifleMagGrip = new THREE.Vector3(-0.056, -0.025, 0.012)),
          vm._rifleMagGripRot || (vm._rifleMagGripRot = new THREE.Vector3(0.16, 0.12, -0.48)),
          hold
        );
      }
    }

    if (w.id === 'rifle') {
      const slap = Math.sin(PI * clamp((t - 0.7) / (player.reloadEmpty ? 0.17 : 0.13), 0, 1));
      poseReloadHand(
        vm,
        vm.reloadSlap,
        vm._slapOffset || (vm._slapOffset = new THREE.Vector3()),
        vm._slapRot || (vm._slapRot = new THREE.Vector3(0.05, 0.18, -0.62)),
        slap
      );
      py += slap * 0.024;
      pz += slap * 0.028;
      rx -= slap * 0.09;
      rz += slap * 0.06;
    }
    if (w.id === 'pistol' && player.reloadEmpty) {
      const rack = Math.sin(PI * clamp((t - 0.7) / 0.2, 0, 1));
      vm._reloadSlide = rack;
      poseReloadHand(
        vm,
        vm.slide,
        vm._pistolRackGrip || (vm._pistolRackGrip = new THREE.Vector3(-0.046, 0.025, 0.035)),
        vm._pistolRackRot || (vm._pistolRackRot = new THREE.Vector3(0.2, 0.2, -0.58)),
        rack
      );
      pz += rack * 0.025;
    }
    if (w.id === 'ak' && player.reloadEmpty) {
      const rack = Math.sin(PI * clamp((t - 0.76) / 0.17, 0, 1));
      vm.chargeHandle.position.z += rack * 0.105;
      poseReloadHand(
        vm,
        vm.chargeHandle,
        vm._akRackGrip || (vm._akRackGrip = new THREE.Vector3(-0.042, 0, 0.012)),
        vm._akRackRot || (vm._akRackRot = new THREE.Vector3(0.16, -0.1, -0.52)),
        rack,
        vm.leftHand,
        false
      );
      py += rack * 0.015;
      pz += rack * 0.025;
    }
    animateSmgReloadRack(w, vm, t);
    if (w.id === 'sniper') {
      const action = clamp((t - 0.89) / 0.1, 0, 1);
      vm._reloadBoltLift = Math.sin(PI * action);
      vm._reloadBoltBack = Math.sin(PI * clamp((action - 0.16) / 0.72, 0, 1));
      poseReloadHand(
        vm,
        vm.knob,
        vm._boltGrip || (vm._boltGrip = new THREE.Vector3(0.035, -0.005, 0.015)),
        vm._boltGripRot || (vm._boltGripRot = new THREE.Vector3(0.08, -0.12, -0.42)),
        Math.sin(PI * action),
        vm.rightHand,
        false
      );
    }
    if (w.id === 'lmg') {
      const open =
        easeInOutCubic(clamp((t - 0.1) / 0.18, 0, 1)) *
        (1 - easeInOutCubic(clamp((t - 0.72) / 0.14, 0, 1)));
      vm.topCover.rotation.x += open * 1.08;
      const rack = Math.sin(PI * clamp((t - 0.84) / 0.12, 0, 1));
      vm.chargeHandle.position.z += rack * 0.085;
      py += rack * 0.018;
      pz += rack * 0.025;
    }
    if (vm.reloadShell) {
      const elapsed = t * total,
        loadStart = 0.2,
        shellTime = 0.42,
        rounds = Math.max(1, player.reloadRounds || 1),
        shellIndex = Math.floor(Math.max(0, elapsed - loadStart) / shellTime),
        cycle = clamp((elapsed - loadStart - shellIndex * shellTime) / shellTime, 0, 1),
        feed = easeInOutCubic(clamp(cycle / 0.78, 0, 1));
      vm.reloadShell.visible = elapsed >= loadStart && shellIndex < rounds;
      vm.reloadShell.position.set(-0.18 * (1 - feed), -0.2 * (1 - feed) - 0.075, -0.015);
      vm.reloadShell.rotation.set(0.25, 0, -0.45 * (1 - feed));
      if (vm.leftHand) {
        const shellHandBlend =
          easeInOutCubic(clamp(cycle / 0.14, 0, 1)) *
          (1 - easeInOutCubic(clamp((cycle - 0.76) / 0.18, 0, 1)));
        poseReloadHand(
          vm,
          vm.reloadShell,
          vm._shellHandOffset || (vm._shellHandOffset = new THREE.Vector3(-0.047, -0.006, 0.012)),
          vm._shellHandRotation || (vm._shellHandRotation = new THREE.Vector3(0.16, 0.1, -0.5)),
          shellHandBlend
        );
      }
      const seat = Math.sin(PI * clamp((cycle - 0.58) / 0.32, 0, 1));
      py += seat * 0.012;
      rx -= seat * 0.035;
      const loadEnd = loadStart + rounds * shellTime;
      if (player.reloadEmpty && elapsed > loadEnd)
        vm._reloadPump = Math.sin(PI * clamp((elapsed - loadEnd) / 0.16, 0, 1));
    }
  }
  if (player.meleeT > 0) {
    const mt = 1 - player.meleeT / 0.46,
      wind = easeInOutCubic(clamp(mt / 0.32, 0, 1)),
      strike = Math.sin(PI * clamp((mt - 0.25) / 0.55, 0, 1));
    px -= wind * 0.14;
    py += wind * 0.06;
    pz += strike * 0.2;
    rx -= strike * 0.45;
    ry += wind * 0.5 - strike * 0.72;
    rz -= wind * 0.38;
  }
  /* draw/holster */
  if (player.switching > 0) {
    const w2 = WEAPONS[player.switchTo >= 0 ? player.switchTo : player.weapon];
    let k = 0;
    if (player.switchTo >= 0) {
      k = 1 - clamp((player.switching - w2.drawTime) / player.holsterAt, 0, 1); // holstering
    } else {
      k = clamp(player.switching / w.drawTime, 0, 1); // drawing
    }
    const e2 = easeOutCubic(k);
    py -= e2 * 0.4;
    pz += e2 * 0.1;
    rx += e2 * 1.05;
    rz += e2 * 0.45;
  }
  /* pump action */
  if (vm.forend) {
    let slide = vm._reloadPump || 0;
    if (player.pumpT > 0) {
      const t = 1 - player.pumpT / w.pumpTime;
      slide = t < 0.45 ? easeOutCubic(t / 0.45) : 1 - easeOutCubic((t - 0.45) / 0.55);
    }
    vm.forend.position.z = -0.34 + slide * 0.105;
    pz += slide * 0.028;
    rx -= slide * 0.05;
  }
  /* pistol slide cycling */
  if (vm.slide) {
    const t = clamp(flashT / flashDur, 0, 1);
    vm.slide.position.z = Math.max(t * 0.045, (vm._reloadSlide || 0) * 0.07);
  }
  /* bolt: lift, pull, hold, push, lock */
  if (vm.bolt) {
    let back = 0,
      lift = 0;
    if (player.boltT > 0) {
      const t = 1 - player.boltT / w.boltTime;
      lift = t < 0.14 ? easeOutCubic(t / 0.14) : t > 0.74 ? 1 - easeOutCubic((t - 0.74) / 0.26) : 1;
      back =
        t < 0.14
          ? 0
          : t < 0.4
            ? easeOutCubic((t - 0.14) / 0.26)
            : t < 0.56
              ? 1
              : t < 0.74
                ? 1 - easeInOutCubic((t - 0.56) / 0.18)
                : 0;
    }
    lift = Math.max(lift, vm._reloadBoltLift || 0);
    back = Math.max(back, vm._reloadBoltBack || 0);
    vm.bolt.position.z = 0.1 + back * 0.125;
    /* positive Z swings the handle up over the receiver, where it's visible
       from the left-side view the player actually has */
    vm.bolt.rotation.z = lift * 1.2;
    px -= back * 0.012;
    pz += back * 0.022;
    ry -= lift * 0.055;
    rz -= lift * 0.035;
    if (player.boltT > 0) {
      const cycle = 1 - player.boltT / w.boltTime;
      const grip = Math.sin(PI * clamp(cycle / 0.9, 0, 1));
      poseReloadHand(
        vm,
        vm.knob,
        vm._boltGrip || (vm._boltGrip = new THREE.Vector3(0.035, -0.005, 0.015)),
        vm._boltGripRot || (vm._boltGripRot = new THREE.Vector3(0.08, -0.12, -0.42)),
        grip,
        vm.rightHand,
        false
      );
    }
  }

  /* ---- ADS: slide the sight onto the camera axis ---- */
  const ae = player.adsEase;
  const equippedOptic = w.attachments?.optic;
  if (vm.dotGlow) {
    vm.dotGlow.material.opacity = lerp(0.24, 0.82, ae);
    const dotScale = lerp(0.0062, 0.0074, ae);
    vm.dotGlow.scale.set(dotScale, dotScale, 1);
  }
  if (vm.opticGlass) vm.opticGlass.material.opacity = lerp(0.12, 0.19, ae);
  if (ae > 0.0005 && vm.adsPos) {
    const opticNode = vm.attachmentNodes?.optic?.[equippedOptic];
    /* The world ray and HUD confirmation are fixed to screen centre. Each
       optic has a different rail/window height, so lift that actual optical
       axis to y=0 instead of reusing the iron-sight pose for every attachment. */
    const adsAimY = opticNode
      ? -(opticNode.position.y + (opticNode.userData.aimY || 0) * opticNode.scale.y) *
        vm.group.scale.y
      : vm.adsPos.y;
    const adsAimX = opticNode ? -opticNode.position.x * vm.group.scale.x : vm.adsPos.x;
    px = lerp(px, adsAimX, ae);
    py = lerp(py, adsAimY, ae);
    const opticDepth =
      equippedOptic === 'prism_2_5'
        ? -0.34
        : equippedOptic === 'holo'
          ? -0.4
          : equippedOptic === 'micro_dot'
            ? -0.42
            : vm.adsPos.z;
    pz = lerp(pz, opticDepth, ae);
    rx = lerp(rx, vm.adsRot.x, ae);
    ry = lerp(ry, vm.adsRot.y, ae);
    rz = lerp(rz, vm.adsRot.z, ae);
  }
  /* Pull the eye back and narrow the lens by the matching amount. The sight is
     on the camera's -Z axis, so sliding along that axis cannot break alignment
     — it only trades wide-angle bulge for telephoto flatness. */
  {
    const ref = vm.adsRef || 0.68;
    const optic = equippedOptic;
    /* COD-style eye relief: mounted optics come to the eye and dominate the
       frame. Do not counter-shrink them with the old telephoto dolly formula. */
    const opticDolly =
      optic === 'prism_2_5'
        ? -0.14
        : optic === 'holo'
          ? -0.11
          : optic === 'micro_dot'
            ? -0.1
            : null;
    const dolly = w.bracedAim ? 0 : (opticDolly ?? VM_ADS_DOLLY) * ae;
    const f = optic
      ? VM_FOV
      : (Math.atan((Math.tan((VM_FOV * PI) / 360) * ref) / (ref + dolly)) * 360) / PI;
    if (vmCamera.position.z !== dolly || vmCamera.fov !== f) {
      vmCamera.position.z = dolly;
      vmCamera.fov = f;
      vmCamera.updateProjectionMatrix();
    }
  }

  /* lift the fill only while aiming — see the light rig comment up top */
  vmAmb.intensity = VM_LIGHT_BASE.amb + 0.24 * ae;
  vmKey.intensity = VM_LIGHT_BASE.key + 0.4 * ae;
  vmFill.intensity = VM_LIGHT_BASE.fill + 0.3 * ae;
  vmRim.intensity = VM_LIGHT_BASE.rim + 0.16 * ae;

  /* sway is what breaks sight alignment, so damp it hard while aiming */
  const swayK = 1 - 0.88 * ae;

  /* apply */
  vmSway.position.set(px + swayLagX * swayK, py + swayLagY * swayK, pz);
  vmSway.rotation.set(
    rx + swayLagY * 1.6 * swayK,
    ry + swayLagX * 2.1 * swayK,
    rz - swayLagX * 1.4 * swayK
  );
  vmRecoil.position.set(0, vmRec.py * 0.5, vmRec.pz);
  vmRecoil.rotation.set(vmRec.rx * 0.6, vmRec.ry * 0.6, vmRec.rz * 0.6);
  if (vm.barrels) {
    const spinWant = player.triggerHeld && G.running && !player.dead ? 32 : 0;
    vm.barrelSpin = damp(vm.barrelSpin || 0, spinWant, spinWant ? 8 : 3.2, dt);
    vm.barrels.rotation.z += vm.barrelSpin * dt;
  }

  /* muzzle flash */
  if (flashT > 0) {
    flashT -= dt;
    const k = clamp(flashT / flashDur, 0, 1);
    vm.muzzle.getWorldPosition(_tmpV);
    muzzleSprite.position.copy(_tmpV);
    muzzleGlow.position.copy(_tmpV);
    /* Sized against the frame, not the gun. The muzzle sits ~1.6 units from the
       viewmodel eye, where the visible frame is only ~1.2 units tall, so a sprite
       scaled in model units balloons: the old 0.89 covered three quarters of the
       screen height and full-auto turned the lower half of the frame into a white
       sheet. A real flash reads at roughly a sixth of frame height. */
    const sc = (0.065 + 0.075 * flashPower) * (0.55 + k * 0.8);
    /* The sprites hang off vmScene rather than vmRoot, so hiding the gun behind
       the scope leaves them floating in the middle of the sight picture. Down a
       scope the muzzle is a metre forward and well below the optical axis; you
       do not see the flash at all, so it fades out with the weapon. */
    const seen = 1 - (w.scope ? clamp((player.adsEase - 0.45) / 0.4, 0, 1) : 0);
    muzzleSprite.scale.set(sc, sc, 1);
    muzzleSprite.material.rotation = muzzleSprite.material.rotation || 0;
    muzzleSprite.material.opacity = k * seen;
    muzzleGlow.scale.set(sc * 1.9, sc * 1.9, 1);
    muzzleGlow.material.opacity = k * 0.62 * seen;
    vmMuzzleLight.position.copy(_tmpV);
    vmMuzzleLight.intensity = k * 9 * flashPower * seen;
    camera.getWorldDirection(_fwd);
    muzzleLight.position.copy(camera.position).addScaledVector(_fwd, 0.8);
    muzzleLight.intensity = k * 11 * flashPower;
    if (flashT <= 0) {
      muzzleSprite.material.opacity = 0;
      muzzleGlow.material.opacity = 0;
      vmMuzzleLight.intensity = 0;
      muzzleLight.intensity = 0;
    }
  }
}


  return {
    step(dt, mdx, mdy, env) {
      player = env.player;
      WEAPONS = env.weapons;
      camera = env.camera;
      vmCamera = env.vmCamera;
      vmSway = env.vmSway;
      vmRecoil = env.vmRecoil;
      G.running = env.running !== false;
      updateViewmodel(dt, mdx, mdy);
      updateDetachedMagazinePhysics(dt);
    },
    kick(w, scale = 1) {
      vmRec.vz += w.recoilKick * 46 * scale;
      vmRec.vy += w.recoilKick * 13 * scale;
      vmRec.vrx += w.recoilRot * 46 * scale;
      vmRec.vry += (Math.random() - 0.5) * w.recoilRot * 24 * scale;
      vmRec.vrz += (Math.random() - 0.5) * w.recoilRot * 30 * scale;
    },
    flash(power = 1) {
      flashT = flashDur;
      flashPower = power;
    },
    reset() {
      vmRec.pz = vmRec.py = vmRec.rx = vmRec.ry = vmRec.rz = 0;
      vmRec.vz = vmRec.vy = vmRec.vrx = vmRec.vry = vmRec.vrz = 0;
      flashT = 0;
    },
  };
}
