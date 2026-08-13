'use strict';
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
