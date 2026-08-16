'use strict';
/* Close-quarters weapon butt / knife strike. Kept separate from the already
   dense shooting unit, but loaded immediately after it so input can call it. */
const _muzzleWorld = new THREE.Vector3(),
  _muzzleView = new THREE.Vector3(),
  _muzzleRayPoint = new THREE.Vector3(),
  _muzzleRayDir = new THREE.Vector3();
const MUZZLE_FORWARD_DEPTH = 0.55;

/** The weapon is rendered by a second camera, so its scene coordinates cannot
 * be copied into the world. Preserve the muzzle's exact screen position and
 * place it a short, safe distance in front of the gameplay camera instead. */
function placeWorldMuzzleFromViewmodel(muzzle) {
  muzzle.updateWorldMatrix(true, false);
  vmCamera.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  muzzle.getWorldPosition(_muzzleView).project(vmCamera);
  _muzzleRayPoint.set(_muzzleView.x, _muzzleView.y, 0).unproject(camera);
  _muzzleRayDir.subVectors(_muzzleRayPoint, camera.position).normalize();
  const forwardDot = _muzzleRayDir.dot(_fwd);
  if (!Number.isFinite(forwardDot) || forwardDot <= 0.05)
    return _muzzleWorld.copy(camera.position).addScaledVector(_fwd, MUZZLE_FORWARD_DEPTH);
  return _muzzleWorld
    .copy(camera.position)
    .addScaledVector(_muzzleRayDir, MUZZLE_FORWARD_DEPTH / forwardDot);
}

const meleeRay = new THREE.Raycaster();
function startMelee() {
  if (
    !Gameplay.canStartMelee({
      dead: player.dead,
      meleeT: player.meleeT,
      switching: player.switching > 0,
      blocked: !!G.gunship?.controlled || !G.running,
    })
  )
    return;
  setADS(false);
  if (player.reloadT > 0) interruptReload();
  player.triggerHeld = false;
  player.clickBuf = 0;
  const clock = Gameplay.beginMeleeClock();
  player.meleeT = clock.meleeT;
  player.fireCooldown = Math.max(player.fireCooldown, clock.fireLock);
  SFX.melee(false);

  camera.getWorldDirection(_fwd);
  meleeRay.set(camera.position, _fwd);
  meleeRay.far = Gameplay.MELEE_RANGE;
  const hit = meleeRay.intersectObjects(
    enemyHitMeshes.concat(worldSolidCandidates(meleeRay)),
    false
  )[0];
  if (!hit?.object.userData?.enemy || hit.object.userData.enemy.dead) return;
  const e = hit.object.userData.enemy;
  const head = hit.object.userData.part === 'head';
  const killed = damageEnemy(e, Gameplay.meleeDamage(head), head, _fwd, hit.point);
  fxImpactFlesh(hit.point, _fwd, hit.distance, head);
  SFX.melee(true);
  SFX.hitBeep(head);
  showHitmark(killed);
  G.hits++;
}
