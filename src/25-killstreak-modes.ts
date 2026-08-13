'use strict';
/* =========================================================================
   19B. PLAYER-CONTROLLED KILLSTREAK MODES
   ========================================================================= */
const GUNSHIP_WEAPONS = [
  { name: '25 毫米机炮', cooldown: 0.1, damage: 58, radius: 1.5, tracer: 1.2, fx: 0.45 },
  { name: '40 毫米机炮', cooldown: 0.65, damage: 165, radius: 3.5, tracer: 1.7, fx: 0.8 },
  { name: '105 毫米榴弹炮', cooldown: 3.2, damage: 430, radius: 7.0, tracer: 2.4, fx: 1.4 },
];
const _gunshipAim = new THREE.Vector3(),
  _gunshipDir = new THREE.Vector3(),
  _gunshipFrom = new THREE.Vector3(),
  _gunshipBlastFrom = new THREE.Vector3(),
  _gunshipRight = new THREE.Vector3(),
  _gunshipPlanar = new THREE.Vector3(),
  _gunshipFeet = new THREE.Vector3(),
  _gunshipHead = new THREE.Vector3(),
  _gunshipFeetNdc = new THREE.Vector3(),
  _gunshipHeadNdc = new THREE.Vector3();
const _gunshipThermalMats = new Map();

function setGunshipThermal(on) {
  if (on) {
    for (const e of enemies)
      e.obj.traverse((part) => {
        const mat = part.material;
        if (!mat?.emissive || _gunshipThermalMats.has(mat)) return;
        _gunshipThermalMats.set(mat, {
          emissive: mat.emissive.getHex(),
          intensity: mat.emissiveIntensity,
        });
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = 1.35;
      });
    return;
  }
  for (const [mat, saved] of _gunshipThermalMats) {
    mat.emissive.setHex(saved.emissive);
    mat.emissiveIntensity = saved.intensity;
  }
  _gunshipThermalMats.clear();
}

function callGunship() {
  if (G.gunship) endGunship('replace');
  const obj = buildGunship();
  obj.visible = false;
  scene.add(obj);
  let ax = 0,
    az = 0,
    n = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    ax += e.obj.position.x;
    az += e.obj.position.z;
    n++;
  }
  G.gunship = {
    obj,
    t: 25,
    ang: rand(0, 7),
    controlled: true,
    aim: new THREE.Vector3(n ? ax / n : 0, 0, n ? az / n : 0),
    weapon: 0,
    cooldowns: [0, 0, 0],
    trigger: false,
  };
  player.triggerHeld = false;
  player.vel.set(0, 0, 0);
  setADS(false);
  vmRoot.visible = false;
  setGunshipUI(true);
  setGunshipThermal(true);
  compMat.uniforms.gunship.value = 1;
  comms(null, '空中炮艇已接管 — 1/2/3 切换武器，鼠标左键开火', true);
}

function selectGunshipWeapon(i) {
  const s = G.gunship;
  if (!s?.controlled || i < 0 || i >= GUNSHIP_WEAPONS.length) return;
  s.weapon = i;
  SFX.boltClick();
  updateGunshipUI(s);
}

function endGunship(reason?) {
  const s = G.gunship;
  if (!s) return;
  const redeployOperator = !!s.operatorDead && player.dead && G.running && !G.over;
  scene.remove(s.obj);
  G.gunship = null;
  mouseDX = mouseDY = 0;
  setGunshipThermal(false);
  setGunshipUI(false);
  compMat.uniforms.gunship.value = 0;
  if (redeployOperator) {
    G.respawnT = 0;
    UI.respawn.classList.remove('on');
    respawnPlayer();
    comms(null, '炮艇任务结束 — 已从标准部署点重新投入战斗', true);
  }
  restorePlayerViewmodel();
  fovCur = G.jug ? 68 : BASE_FOV;
  camera.fov = fovCur;
  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  camera.rotation.set(player.pitch + player.recoilPitch, player.yaw + player.recoilYaw, 0);
  camera.updateProjectionMatrix();
  if (player.dead && G.running && !G.over) {
    UI.respawnNum.textContent = Math.max(1, Math.ceil(G.respawnT));
    UI.respawn.classList.add('on');
  }
  if (G.running && !player.dead && reason === 'expired') comms(null, '空中炮艇已脱离航线', true);
}

function gunshipGroundPoint(s) {
  _gunshipDir.subVectors(s.aim, camera.position).normalize();
  shootRay.set(camera.position, _gunshipDir);
  shootRay.far = 140;
  const hit = shootRay.intersectObjects(worldSolid, false)[0];
  return hit ? _gunshipAim.copy(hit.point) : _gunshipAim.copy(s.aim);
}

function gunshipImpactFx(at, scale) {
  for (let i = 0; i < Math.round(15 * scale); i++)
    spawnParticle(
      PS_SOFT,
      at.x,
      at.y + 0.25,
      at.z,
      rand(-4, 4) * scale,
      rand(2, 7) * scale,
      rand(-4, 4) * scale,
      {
        color: [0.35, 0.34, 0.31],
        size: rand(0.25, 0.65) * scale,
        life: rand(0.45, 1.1),
        alpha: 0.5,
        drag: 1.4,
        grav: -2,
      }
    );
  for (let i = 0; i < Math.round(10 * scale); i++)
    spawnParticle(
      PS_SPARK,
      at.x,
      at.y + 0.2,
      at.z,
      rand(-8, 8) * scale,
      rand(2, 10),
      rand(-8, 8) * scale,
      {
        color: [1, 0.65, 0.25],
        size: rand(0.04, 0.1),
        life: rand(0.2, 0.5),
        drag: 0.9,
        grav: -15,
      }
    );
  SFX.boom(0, 18);
}

function fireGunship(s) {
  const weapon = GUNSHIP_WEAPONS[s.weapon];
  if (s.cooldowns[s.weapon] > 0) return;
  const at = gunshipGroundPoint(s);
  _gunshipFrom
    .copy(camera.position)
    .addScaledVector(_gunshipRight, -0.9)
    .addScaledVector(_up, -0.5);
  spawnTracer(_gunshipFrom, at, s.weapon === 0 ? 0xdff5d8 : 0xfff3c8, weapon.tracer);
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.obj.position.x - at.x, e.obj.position.z - at.z);
    if (d > weapon.radius) continue;
    _gunshipDir.set(
      e.obj.position.x - at.x,
      e.obj.position.y + 1.1 - (at.y + 0.25),
      e.obj.position.z - at.z
    );
    const coverDist = _gunshipDir.length();
    if (coverDist > 0.3) {
      _gunshipDir.divideScalar(coverDist);
      shootRay.set(_gunshipBlastFrom.copy(at).addScaledVector(_up, 0.25), _gunshipDir);
      shootRay.far = coverDist - 0.15;
      if (shootRay.intersectObjects(worldSolid, false).length) continue;
    }
    const dmg = weapon.damage * clamp(1 - d / (weapon.radius * 1.25), 0.35, 1);
    _blastDir.set(e.obj.position.x - at.x, 0, e.obj.position.z - at.z).normalize();
    damageEnemy(e, dmg, false, _blastDir, e.obj.position, '空中炮艇', true);
  }
  if (s.weapon === 0) {
    fxImpactWall(at, _up, at.distanceTo(camera.position));
    SFX.gunshot('lmg', 0, 18);
  } else gunshipImpactFx(at, weapon.fx);
  s.cooldowns[s.weapon] = weapon.cooldown;
}

function updateGunshipTargets() {
  camera.getWorldDirection(_gunshipDir);
  for (let i = 0; i < UI.gunshipTargetEls.length; i++) {
    const marker = UI.gunshipTargetEls[i];
    const e = enemies[i];
    if (!e || e.dead) {
      marker.style.display = 'none';
      continue;
    }
    _gunshipFeet.set(e.obj.position.x, e.obj.position.y + 0.12, e.obj.position.z);
    _gunshipHead.set(e.obj.position.x, e.obj.position.y + 1.82, e.obj.position.z);
    _gunshipAim.copy(_gunshipHead).lerp(_gunshipFeet, 0.45);
    _gunshipFrom.subVectors(_gunshipAim, camera.position);
    if (_gunshipFrom.dot(_gunshipDir) <= 0) {
      marker.style.display = 'none';
      continue;
    }
    _gunshipFeetNdc.copy(_gunshipFeet).project(camera);
    _gunshipHeadNdc.copy(_gunshipHead).project(camera);
    const x = (_gunshipHeadNdc.x * 0.5 + 0.5) * innerWidth;
    const y = (1 - (_gunshipHeadNdc.y + _gunshipFeetNdc.y) * 0.25 - 0.5) * innerHeight;
    const h = clamp(Math.abs(_gunshipHeadNdc.y - _gunshipFeetNdc.y) * innerHeight * 0.5, 20, 78);
    const visible =
      _gunshipHeadNdc.z > -1 &&
      _gunshipHeadNdc.z < 1 &&
      x > -h &&
      x < innerWidth + h &&
      y > -h &&
      y < innerHeight + h;
    if (!visible) {
      marker.style.display = 'none';
      continue;
    }
    const distance = _gunshipFrom.length();
    _gunshipFrom.divideScalar(distance);
    shootRay.set(camera.position, _gunshipFrom);
    shootRay.far = Math.max(0, distance - 0.35);
    const occluded = shootRay.intersectObjects(worldSolid, false).length > 0;
    marker.style.display = 'block';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = `${clamp(h * 0.56, 18, 44)}px`;
    marker.style.height = `${h}px`;
    marker.classList.toggle('occluded', occluded);
  }
  /* The gunship camera has no first-person body to render, but the operator
     still exists at player.pos and can be killed. Keep that ground location
     explicit in blue, clamping it to the viewport edge if the orbit/zoom
     moves it off-screen. */
  const self = UI.gunshipSelf;
  _gunshipAim.set(player.pos.x, player.pos.y + 0.9, player.pos.z).project(camera);
  const behind = _gunshipAim.z < -1 || _gunshipAim.z > 1;
  let sx = (_gunshipAim.x * 0.5 + 0.5) * innerWidth,
    sy = (-_gunshipAim.y * 0.5 + 0.5) * innerHeight;
  const edge = behind || sx < 24 || sx > innerWidth - 24 || sy < 48 || sy > innerHeight - 24;
  sx = clamp(sx, 24, innerWidth - 24);
  sy = clamp(sy, 48, innerHeight - 24);
  self.style.display = 'block';
  self.style.left = `${sx}px`;
  self.style.top = `${sy}px`;
  self.classList.toggle('edge', edge);
  self.classList.toggle('dead', player.dead);
  self.querySelector('span').textContent = player.dead ? '操作员阵亡 // 待重新部署' : '己方操作员';
}

function updateGunship(dt, mdx?, mdy?) {
  const s = G.gunship;
  s.t -= dt;
  if (s.t <= 0) {
    endGunship('expired');
    return;
  }
  s.ang += dt * 0.22;
  s.obj.position.set(Math.cos(s.ang) * 42, 52, Math.sin(s.ang) * 42);
  s.obj.rotation.set(0, PI - s.ang, 0.1);
  for (const pr of s.obj.userData.props) pr.rotation.z += dt * 40;
  camera.position.copy(s.obj.position);
  camera.lookAt(s.aim);
  camera.getWorldDirection(_gunshipDir);
  _gunshipRight.crossVectors(_gunshipDir, _up).normalize();
  _gunshipPlanar.set(_gunshipDir.x, 0, _gunshipDir.z).normalize();
  s.aim.addScaledVector(_gunshipRight, (mdx || 0) * 0.035);
  /* Pointer movementY is negative when the mouse moves up. Screen-up projects
     along the camera's planar forward direction in this top-down view. */
  s.aim.addScaledVector(_gunshipPlanar, -(mdy || 0) * 0.035);
  s.aim.x = clamp(s.aim.x, -HALF + 2, HALF - 2);
  s.aim.z = clamp(s.aim.z, -HALF + 2, HALF - 2);
  camera.lookAt(s.aim);
  camera.fov = [28, 38, 50][s.weapon];
  camera.updateProjectionMatrix();
  updateGunshipTargets();
  for (let i = 0; i < s.cooldowns.length; i++) s.cooldowns[i] = Math.max(0, s.cooldowns[i] - dt);
  if (s.trigger) fireGunship(s);
  updateGunshipUI(s);
}

function goJuggernaut() {
  if (G.gunship?.controlled) endGunship('juggernaut');
  clearAllReloadProgress();
  for (const w of WEAPONS) w.vm.group.visible = false;
  G.jug = true;
  player.armorMax = 300;
  player.armor = 300;
  player.hp = 100;
  player.weapon = JUG_WEAPON;
  player.switchTo = -1;
  player.switching = WEAPONS[JUG_WEAPON].drawTime;
  player.reloadT = player.pumpT = player.boltT = 0;
  player.reloadDuration = 0;
  player.reloadEmpty = false;
  player.reloadRounds = 0;
  player.meleeT = 0;
  player.ads = false;
  player.adsK = player.adsEase = 0;
  WEAPONS[JUG_WEAPON].vm.group.visible = true;
  setJuggernautUI(true);
  updateVitalsUI();
  updateAmmoUI();
  comms(null, '无畏战士装甲已着装 — JUG-M134 加特林已上线', true);
}

function exitJuggernaut(showRifle?) {
  if (WEAPONS[JUG_WEAPON]?.vm) WEAPONS[JUG_WEAPON].vm.group.visible = false;
  G.jug = false;
  player.armorMax = 50;
  setJuggernautUI(false);
  if (showRifle) {
    player.switching = 0;
    player.switchTo = -1;
    player.reloadT = 0;
    player.reloadDuration = 0;
    player.reloadEmpty = false;
    player.reloadRounds = 0;
    player.meleeT = 0;
    player.weapon = 0;
    WEAPONS[0].vm.group.visible = true;
    updateAmmoUI();
  }
}
