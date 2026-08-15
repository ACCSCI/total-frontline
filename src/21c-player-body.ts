'use strict';
/* First-person play has no body. The gunship camera looks at the yard, so the
   operator has to exist as a soldier or the ground is empty where you stood. */
let playerBody = null;

function makePlayerBody() {
  const parts = buildEnemyModel();
  parts.model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material === E_MAT.accent) o.material = ALLY_ACCENT;
  });
  const obj = new THREE.Group();
  obj.add(parts.model);
  const tag = makeTag('操作员', '#55a8ff', 'ally');
  obj.add(tag.sprite);
  obj.visible = false;
  scene.add(obj);
  playerBody = { obj, tag, p: parts, deathT: 0, walkPhase: 0 };
}

function setPlayerBodyVisible(on) {
  if (!playerBody) makePlayerBody();
  playerBody.obj.visible = !!on;
  if (on) {
    playerBody.deathT = player.dead ? playerBody.deathT : 0;
    syncPlayerBody(0);
  }
}

function posePlayerRig(p, dt) {
  if (player.dead) {
    playerBody.deathT = Math.min(1, playerBody.deathT + dt / 0.85);
    const k = easeOutCubic(playerBody.deathT);
    p.model.rotation.x = k * PI * 0.49;
    p.model.position.set(0, -k * 0.1, 0);
    return;
  }
  playerBody.deathT = 0;
  const prone = player.prone ? 1 : 0,
    crouch = player.crouch && !player.prone ? 1 : 0;
  p.model.rotation.set(prone * 1.45, 0, 0);
  p.model.position.set(0, prone ? -0.12 : 0, 0);
  const walk =
    prone || !player.onGround ? 0 : clamp(Math.hypot(player.vel.x, player.vel.z) / 2.4, 0, 1);
  playerBody.walkPhase += dt * (3 + walk * 5);
  const s1 = Math.sin(playerBody.walkPhase);
  p.legs[0].hip.rotation.x = s1 * 0.62 * walk - crouch * 0.85;
  p.legs[1].hip.rotation.x = -s1 * 0.62 * walk - crouch * 0.85;
  p.legs[0].knee.rotation.x = Math.max(0, -Math.cos(playerBody.walkPhase)) * 0.7 * walk + crouch * 1.15;
  p.legs[1].knee.rotation.x = Math.max(0, Math.cos(playerBody.walkPhase)) * 0.7 * walk + crouch * 1.15;
  p.body.position.y = Math.abs(Math.cos(playerBody.walkPhase)) * 0.045 * walk - crouch * 0.22;
  p.arms[0].sh.rotation.set(1.5, 0, 0.62);
  p.arms[0].el.rotation.x = -0.15;
  p.arms[1].sh.rotation.set(1.99, 0, -0.68);
  p.arms[1].el.rotation.x = -1.69;
  p.gun.position.set(0.1, -0.05, -0.26);
  p.gun.rotation.set(0, 0, 0);
  p.rig.rotation.x = player.pitch * 0.35;
  p.head.rotation.x = player.pitch * 0.4;
}

function syncPlayerBody(dt) {
  if (!playerBody?.obj.visible) return;
  const obj = playerBody.obj,
    p = playerBody.p;
  obj.position.set(player.pos.x, player.pos.y, player.pos.z);
  obj.rotation.y = player.yaw;
  posePlayerRig(p, dt);
  playerBody.tag.sprite.visible = !player.dead;
  if (playerBody.tag.sprite.visible) {
    playerBody.tag.draw(player.hp, false);
    const dCam = obj.position.distanceTo(camera.position);
    const s = clamp(dCam * 0.045, 0.55, 1.9) * (camera.fov / BASE_FOV);
    playerBody.tag.sprite.scale.set(1.75 * s, 0.52 * s, 1);
    playerBody.tag.sprite.position.y = player.prone ? 0.55 : 2.22;
  }
}
