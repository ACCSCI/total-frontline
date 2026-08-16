import puppeteer from 'puppeteer-core'; import { runReloadSmoke } from './smoke-reload.mjs'; import { runStanceSmoke } from './smoke-stance.mjs'; import { runSmgSmoke } from './smoke-smg.mjs'; import { runBallisticsSmoke } from './smoke-ballistics.mjs'; import { runMenuSmoke } from './smoke-menu.mjs'; import { runMissionSmoke } from './smoke-missions.mjs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  URL = process.env.SMOKE_URL || 'http://127.0.0.1:8123/index.html';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = m.location() && m.location().url;
  if (url && url.includes('favicon')) return;
  errors.push('console: ' + m.text());
});
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
try {
  await page.waitForFunction(() => document.getElementById('boot').classList.contains('hide'), {
    timeout: 30000,
  });
} catch (error) {
  console.error('boot diagnostics:', errors.join('\n') || 'no browser error captured');
  throw error;
}
await new Promise((r) => setTimeout(r, 1200));
/* The branded click-to-enter gate is the first user gesture: it unlocks Web
   Audio and dismisses the intro so the main menu is interactive. */
const introEl = await page.$('#intro');
if (introEl) {
  const introHidden = await page.evaluate(() =>
    document.getElementById('intro').classList.contains('hide')
  );
  if (!introHidden) {
    await page.click('#intro');
    await new Promise((r) => setTimeout(r, 600));
  }
}
const fail = (msg) => {
  console.error('FAIL: ' + msg);
  process.exitCode = 1;
};
const check = (cond, msg) => {
  console.log((cond ? '  ok  ' : '  BAD ') + msg);
  if (!cond) fail(msg);
};
await runMenuSmoke(page, check);
const yard = await page.evaluate(() => ({
  maps: MAPS.length,
  cur: CUR.id,
  enemies: enemies.length,
  colliders: colliders.length,
  solid: worldSolid.length,
  spawnWalkable: walkable(SPAWN.x, SPAWN.z),
}));
console.log('yard:', JSON.stringify(yard));
check(yard.maps === 2, 'two maps registered');
check(yard.cur === 'yard', 'yard is the default map');
check(yard.enemies === 6, 'six hostiles spawned for 6v6');
check(yard.colliders > 50, 'yard has colliders');
check(yard.spawnWalkable, 'yard spawn is walkable');
await page.screenshot({ path: '_smoke-menu-yard.png' });
await page.evaluate(() => applyMap(MAP_NUKE));
await new Promise((r) => setTimeout(r, 1200));
const nuke = await page.evaluate(() => ({
  cur: CUR.id,
  enemies: enemies.length,
  colliders: colliders.length,
  spawnWalkable: walkable(SPAWN.x, SPAWN.z),
  ground: groundAt(0, 26, 1),
  houseFloor: groundAt(-13, -6, 1),
  busTop: groundAt(-2, -3, 4),
  label: document.getElementById('mapMode').textContent,
  squadEast: enemies.every(
    (e) => !e.upper && e.obj.position.x > 17.5 && Math.abs(e.obj.position.y) < 0.1
  ),
  connected: [
    [0, 0],
    [25, 16],
    [-13, -7.5],
    [13, 2.5],
    [-26, -20],
    [0, 26],
  ].every(([x, z]) => walkable(x, z)),
  stairRampClear: !blocked(-11.65, -9.35, 1.85, 3.16, 0.42),
  stairBackSolid: blocked(-14.4, -9.35, 0.3, 1.7, 0.36),
  sofaMoved: blocked(-17.32, -4.45, 0.3, 1.1, 0.1) && !blocked(-15.8, -8.6, 0.3, 1.1, 0.1),
  busCrossPass:
    [-3.45, -2.8, -2, -1.2, -0.55].every((x) => !blocked(x, -3, 0.3, 1.95, 0.34)) &&
    groundAt(-2, -3, 1) > 0.2 &&
    blocked(-2, -6.96, 0.3, 1.95, 0.34),
}));
console.log('nuke:', JSON.stringify(nuke));
check(nuke.cur === 'nuke', 'switched to nuketown');
check(nuke.enemies === 6, 'six hostiles respawned on nuketown');
check(nuke.spawnWalkable, 'nuke spawn is walkable');
check(nuke.squadEast, 'all hostiles start outdoors behind the east house');
check(nuke.connected, 'walkable grid reaches both backyards, both houses, the street');
check(nuke.stairRampClear && nuke.stairBackSolid, 'west-house stairs climb clear and back face solid');
check(nuke.sofaMoved, 'west-house sofa is against the rear wall and clear of the stairs');
check(nuke.busCrossPass, 'centre bus has paired middle doors for a side-to-side crossing');
check(Math.abs(nuke.ground) < 0.05, 'street ground at y=0');
check(nuke.houseFloor > 0.03 && nuke.houseFloor < 0.2, 'house has a raised wood floor');
check(nuke.busTop > 2.3 && nuke.busTop < 3.0, 'bus roof is stand-on-able');
check(nuke.label === '核弹小镇', 'minimap label follows the map');
await page.screenshot({ path: '_smoke-menu-nuke.png' });
await page.evaluate(() => applyMap(MAP_YARD));
await new Promise((r) => setTimeout(r, 600));
const back = await page.evaluate(() => ({ cur: CUR.id, spawnWalkable: walkable(0, 24) }));
check(back.cur === 'yard' && back.spawnWalkable, 'switching back to the yard works');
await page.evaluate(() => applyMap(MAP_NUKE));
await page.click('.mapCard[data-map="nuke"]');
await new Promise((r) => setTimeout(r, 800));
const game = await page.evaluate(() => {
  const p = camera.position.clone(), r = camera.rotation.clone(), aim = (y) => {
    camera.rotation.set(0, y, 0); camera.updateMatrixWorld(true); return SFX.panAt(8, 0);
  };
  camera.position.set(0, 1.6, 0);
  const spatial = aim(0) > 0.4 && aim(Math.PI) < -0.4;
  camera.position.copy(p); camera.rotation.copy(r); camera.updateMatrixWorld(true);
  return {
    started: G.started, hud: document.getElementById('hud').classList.contains('on'),
    menuHidden: document.getElementById('startScreen').classList.contains('hide'),
    time: G.time, spawn: { x: player.pos.x, z: player.pos.z }, spatial,
  };
});
console.log('game:', JSON.stringify(game));
check(game.started && game.hud && game.menuHidden, 'deploying from the menu starts a round');
check(game.time > 595 && game.time <= 600, 'deathmatch runs ten minutes');
check(game.spawn.x === -24 && game.spawn.z === -6, 'player spawns behind the west house');
check(game.spatial, 'world sounds pan with the camera, not the map east-west axis');
const muzzleAlignment = await page.evaluate(() => {
  const originalWeapon = player.weapon;
  const originalAds = player.adsEase;
  let maxError = 0;
  for (let weapon = 0; weapon < WEAPONS.length; weapon++) {
    player.weapon = weapon;
    for (const ads of [0, 1]) {
      player.adsEase = ads;
      updateViewmodel(0, 0, 0);
      camera.getWorldDirection(_fwd);
      placeWorldMuzzleFromViewmodel(WEAPONS[weapon].vm.muzzle);
      const viewNdc = WEAPONS[weapon].vm.muzzle
        .getWorldPosition(new THREE.Vector3())
        .project(vmCamera);
      const worldNdc = _muzzleWorld.clone().project(camera);
      maxError = Math.max(
        maxError,
        Math.abs(viewNdc.x - worldNdc.x),
        Math.abs(viewNdc.y - worldNdc.y)
      );
    }
  }
  player.weapon = originalWeapon;
  player.adsEase = originalAds;
  updateViewmodel(0, 0, 0);
  return maxError;
});
check(muzzleAlignment < 1e-5, 'tracers align with every weapon muzzle in hip-fire and ADS');
const recoilDirection = await page.evaluate(() => {
  const saved = { ...vmRec };
  for (const key of Object.keys(vmRec)) vmRec[key] = 0;
  vmKick(WEAPONS[0]);
  updateViewmodel(1 / 120, 0, 0);
  const muzzleRise = vmRecoil.rotation.x;
  Object.assign(vmRec, saved);
  updateViewmodel(0, 0, 0);
  return muzzleRise;
});
check(recoilDirection > 0, 'viewmodel muzzle rises with camera recoil');
const tracerMotion = await page.evaluate(() => {
  spawnTracer(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 2, -80), 0xffcf7a, 1);
  const tr = TRACERS[(tracerHead - 1 + TRACERS.length) % TRACERS.length];
  const z0 = tr.mesh.position.z;
  updateTracers(0.016); // preserves the muzzle-attached first frame
  updateTracers(0.016);
  return { moved: tr.mesh.position.z < z0, segment: tr.mesh.scale.z, full: tr.length };
});
check(
  tracerMotion.moved && tracerMotion.segment < tracerMotion.full,
  'tracer is a moving short streak'
);
const adsCrosshair = await page.evaluate(() => {
  player.adsEase = 0.5;
  updateCrosshair(0);
  const hidden = document.getElementById('cross').classList.contains('hidden');
  player.adsEase = 0;
  updateCrosshair(0);
  return { hidden, restored: !document.getElementById('cross').classList.contains('hidden') };
});
check(
  adsCrosshair.hidden && adsCrosshair.restored,
  'ADS hides the hip-fire crosshair and restores it'
);

const gatlingBrace = await page.evaluate(() => {
  const savedWeapon = player.weapon;
  const savedAds = player.adsEase;
  player.weapon = JUG_WEAPON;
  player.adsEase = 0;
  updateViewmodel(0, 0, 0);
  const hip = vmSway.position.clone();
  player.adsEase = 1;
  updateViewmodel(0, 0, 0);
  updateCrosshair(0);
  const braced = vmSway.position.clone();
  const result = {
    crosshair: !document.getElementById('cross').classList.contains('hidden'),
    raised: braced.y > hip.y,
    pulledIn: braced.z > hip.z,
    conventionalZoom: vmCamera.position.z !== 0,
  };
  player.weapon = savedWeapon;
  player.adsEase = savedAds;
  updateViewmodel(0, 0, 0);
  updateCrosshair(0);
  return result;
});
check(
  gatlingBrace.crosshair &&
    gatlingBrace.raised &&
    gatlingBrace.pulledIn &&
    !gatlingBrace.conventionalZoom,
  'Gatling RMB raises and pulls in the weapon without conventional ADS zoom'
);

await runReloadSmoke(page, check); await runStanceSmoke(page, check); await runSmgSmoke(page, check); await runBallisticsSmoke(page, check);
const bindings = await page.evaluate(() => {
  const key = (code, type = 'keydown') => dispatchEvent(new KeyboardEvent(type, { code }));
  const rifle = WEAPONS[0];
  player.weapon = 0;
  player.meleeT = 0;
  player.switching = 0;
  player.dead = false;
  G.running = true;
  rifle.semi = false;
  key('KeyB');
  const fireMode = rifle.semi;
  key('KeyV');
  const melee = player.meleeT > 0;
  player.meleeT = 0;
  key('AltLeft');
  updatePlayer(0.016);
  const altCrouch = player.crouch;
  key('AltLeft', 'keyup');
  key('ControlLeft');
  updatePlayer(0.016);
  const ctrlIgnored = !player.crouch;
  key('ControlLeft', 'keyup');
  rifle.semi = false;
  return { fireMode, melee, altCrouch, ctrlIgnored };
});
check(
  bindings.fireMode && bindings.melee && bindings.altCrouch && bindings.ctrlIgnored,
  'B toggles fire mode, V melees, Alt crouches, and Ctrl is unbound'
);

await page.screenshot({ path: '_smoke-ingame-nuke.png' });

await page.evaluate(() => {
  G.streak = 3;
  G.protect = 0;
  damagePlayer(999, new THREE.Vector3(0, 1, 0));
});
const dead = await page.evaluate(() => ({
  dead: player.dead,
  over: G.over,
  overlay: document.getElementById('respawn').classList.contains('on'),
  streak: G.streak,
}));
check(dead.dead && !dead.over && dead.overlay, 'death shows the redeploy overlay, round lives on');
check(dead.streak === 0, 'dying cashes out the killstreak');
await new Promise((r) => setTimeout(r, 3400));
await page.evaluate(() => {
  /* Keep integration timing deterministic while validating the rest of the
     systems; live combat has its own AI assertions below. */
  G.protect = 12;
});
const back2 = await page.evaluate(() => ({
  alive: !player.dead,
  deaths: G.deaths,
  hp: player.hp,
  running: G.running,
  atSpawn: player.pos.x === -24 && player.pos.z === -6,
}));
console.log('after respawn:', JSON.stringify(back2));
check(
  back2.alive && back2.deaths === 1 && back2.hp === 100 && back2.running,
  'player redeploys at full health'
);
check(back2.atSpawn, 'redeploy lands back on the house-side spawn');

await page.evaluate(() => {
  player.hp = 50;
  player.armor = 0;
  player.lastHurt = 0;
});
await new Promise((r) => setTimeout(r, 700));
const regen = await page.evaluate(() => player.hp);
check(regen > 56, 'health regenerates out of combat (hp=' + regen.toFixed(0) + ')');

await page.evaluate(() => {
  G.protect = 12;
  const e = enemies.find((x) => !x.dead);
  damageEnemy(e, 9999, false, null, e.obj.position);
});
await new Promise((r) => setTimeout(r, 7500));
const refill = await page.evaluate(() => enemies.filter((e) => !e.dead).length);
check(refill >= 5, 'enemy slot refills after a kill');

const squad = await page.evaluate(() => ({
  n: allies.length,
  tactical:
    allyTacticalGoal(
      { idx: 0, tgtVisible: true, obj: { position: new THREE.Vector3(0, 0, 0) } },
      { obj: { position: new THREE.Vector3(10, 0, 0) } }
    ).x > 0,
  iff:
    allies.every((a) => a.tag.side === 'ally' && a.tag.color === '#55a8ff') &&
    enemies.every((e) => e.tag.side === 'enemy' && e.tag.color === '#ff5145'),
}));
check(squad.n === 5, 'five squadmates deploy with you');
check(squad.tactical, 'squadmates take target-relative arcs instead of only following');
check(squad.iff, 'allies and hostiles use explicit blue/red IFF plates');

const allyMovement = await page.evaluate(() => {
  const a = allies[0],
    before = a.obj.position.clone(),
    saved = { tgt: a.tgt, stuckT: a.stuckT, stuckN: a.stuckN, stuckX: a.stuckX, stuckZ: a.stuckZ };
  a.tgt = null;
  a.stuckT = 0.56;
  a.stuckN = 2;
  a.stuckX = before.x;
  a.stuckZ = before.z;
  allyMoveSmart(a, before.x + 25, before.z, 0.1);
  const moved = a.obj.position.distanceTo(before);
  a.obj.position.copy(before);
  Object.assign(a, saved);
  a.detour = null;
  return moved;
});
check(allyMovement <= 0.66, 'stuck allies reroute without teleporting');

await page.evaluate(() => {
  const a = allies.find((x) => !x.dead);
  const e = enemies.find((x) => !x.dead && !x.upper);
  e.obj.position.set(a.obj.position.x + 4, 0, a.obj.position.z);
  e.yaw = e.targetYaw = PI / 2; // facing -X, straight at the ally
  e.route = [[a.obj.position.x + 4, a.obj.position.z]];
  e.wp = 0;
  e.idleT = 0;
  e.state = ST.PATROL;
  e.alerted = false;
  e.tgt = null;
  player.dead = true;
  window._ua = updateAlly;
  updateAlly = () => {};
});
await new Promise((r) => setTimeout(r, 1200));
const picksAlly = await page.evaluate(() => {
  const r = enemies.some((e) => e.tgt) || allies.some((a) => a.hp < 100 || a.dead);
  updateAlly = window._ua;
  player.dead = false;
  return r;
});
check(picksAlly, 'hostiles engage squadmates, not just the player');

const streaks = await page.evaluate(() => {
  const out = {};
  G.streaksReady.length = 0;
  G.streak = 0;
  const kill = () => {
    const e = enemies.find((x) => !x.dead) || (respawnEnemy(enemies[0]), enemies[0]);
    damageEnemy(e, 9999, false, null, e.obj.position);
  };
  for (let n = 0; n < 12; n++) noteKillstreak();
  out.hoard = G.streaksReady.map((s) => s.id).join();
  G.streaksReady.length = 0;
  updateStreakDock();
  G.streak = 2;
  kill();
  out.earned = G.streaksReady.map((s) => s.id).join();
  out.dock = document.getElementById('streakDock').children.length;
  out.pop = document.getElementById('streakPop').textContent.includes('就绪');
  activateStreak(0);
  out.uav = G.uavT > 20 && G.streaksReady.length === 0;
  G.streak = 4;
  kill();
  activateStreak(0);
  out.airstrike = !!G.airstrike;
  G.streak = 6;
  kill();
  activateStreak(0);
  out.emp = G.empT > 10;
  G.streak = 7;
  kill();
  activateStreak(0);
  out.heli = !!G.heli;
  G.streak = 9;
  kill();
  activateStreak(0);
  out.gunship = !!G.gunship?.controlled;
  out.gunshipHud =
    document.getElementById('hud').classList.contains('gunship') &&
    !vmRoot.visible &&
    compMat.uniforms.gunship.value === 1;
  out.operatorBody = !!playerBody?.obj.visible &&
    Math.hypot(playerBody.obj.position.x - player.pos.x, playerBody.obj.position.z - player.pos.z) < 0.05;
  const markerEnemy = enemies[0];
  if (markerEnemy.dead) respawnEnemy(markerEnemy);
  markerEnemy.obj.position.set(0, 0, 0);
  G.gunship.aim.set(0, 0, 0);
  const aimBefore = G.gunship.aim.clone();
  selectGunshipWeapon(2);
  updateGunship(0, 0, 0);
  const screenUpGround = _gunshipPlanar.clone();
  updateGunship(0, 0, -40);
  out.gunshipVertical = G.gunship.aim.clone().sub(aimBefore).dot(screenUpGround) > 0;
  updateGunship(0.016, 80, 0);
  out.gunshipControl =
    G.gunship.weapon === 2 &&
    G.gunship.aim.distanceToSquared(aimBefore) > 0.01 &&
    camera.position.y > 40;
  const visibleTarget = UI.gunshipTargetEls.findIndex((el) => el.style.display === 'block');
  out.gunshipThermal = visibleTarget >= 0 && E_MAT.cloth.emissiveIntensity > 1 && UI.gunshipSelf.style.display === 'block';
  if (visibleTarget >= 0) {
    const e = enemies[visibleTarget];
    const target = e.obj.position.clone().add(new THREE.Vector3(0, 1, 0));
    const blocker = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    blocker.position.copy(camera.position).lerp(target, 0.5);
    scene.add(blocker);
    worldSolid.push(blocker);
    blocker.updateMatrixWorld(true);
    updateGunship(0, 0, 0);
    out.gunshipOccluded = UI.gunshipTargetEls[visibleTarget].classList.contains('occluded');
    worldSolid.splice(worldSolid.indexOf(blocker), 1);
    scene.remove(blocker);
    blocker.geometry.dispose();
    blocker.material.dispose();
  }
  G.gunship.trigger = true;
  updateGunship(0.016, 0, 0);
  out.gunshipFire = G.gunship.cooldowns[2] > 3;
  G.gunship.trigger = false;
  G.streak = 11;
  kill();
  activateStreak(0);
  out.jug =
    G.jug === true &&
    player.armor === 300 &&
    player.armorMax === 300 &&
    WEAPONS[player.weapon].id === 'jug_gatling' &&
    !!WEAPONS[player.weapon].vm.barrels &&
    document.getElementById('hud').classList.contains('jug');
  out.gunshipExit =
    !G.gunship &&
    !document.getElementById('hud').classList.contains('gunship') &&
    !playerBody?.obj.visible && compMat.uniforms.gunship.value === 0;
  switchWeapon(4);
  out.jugLocked = player.weapon === JUG_WEAPON;
  const jugWeapon = WEAPONS[JUG_WEAPON];
  jugWeapon.mag = 1;
  player.switching = player.fireCooldown = 0;
  fireWeapon();
  updateAmmoUI();
  startReload();
  out.jugInfinite =
    jugWeapon.mag === 1 &&
    player.reloadT === 0 &&
    document.getElementById('magNum').textContent === '∞';
  player.triggerHeld = true;
  const spinBefore = WEAPONS[JUG_WEAPON].vm.barrels.rotation.z;
  updateViewmodel(0.1, 0, 0);
  out.gatlingSpin = WEAPONS[JUG_WEAPON].vm.barrels.rotation.z !== spinBefore;
  player.triggerHeld = false;
  G.protect = 0;
  damagePlayer(100, new THREE.Vector3(0, 1, 0));
  out.jugArmor = player.hp === 100 && player.armor === 200;
  out.jugCracks =
    document.getElementById('jugFrame').classList.contains('damage1') &&
    document.getElementById('jugStatus').textContent.includes('受损');
  return out;
});
check(streaks.earned === 'uav' && streaks.dock === 1, '3 kills: UAV readied on the left dock');
check(streaks.pop, 'killstreak banner pops under the timer');
check(streaks.uav, 'activating the UAV starts the sweep');
check(streaks.airstrike, '5 kills: airstrike callable');
check(streaks.emp, '7 kills: EMP paralyses enemy fire');
check(streaks.heli, '8 kills: attack helo on station');
check(streaks.gunship && streaks.gunshipHud && streaks.operatorBody, '10 kills: gunship view with the operator body on the ground');
check(streaks.gunshipControl, 'gunship mouse aim and 1/2/3 weapon selection work');
check(streaks.gunshipVertical, 'gunship mouse-up input moves the reticle upward');
check(streaks.gunshipThermal, 'gunship thermal view marks enemies and the friendly operator position');
check(streaks.gunshipOccluded, 'building-obscured gunship targets receive a red X');
check(streaks.gunshipFire, 'gunship 105 mm cannon fires and enters cooldown');
check(streaks.hoard === 'uav,airstrike,emp,heli,gunship,juggernaut', 'hoarding every streak still grants juggernaut');
check(streaks.jug && streaks.jugLocked, '12 kills: juggernaut equips a locked Gatling loadout');
check(streaks.jugInfinite, 'Juggernaut Gatling has unlimited ammunition and cannot reload');
check(streaks.gatlingSpin, 'Juggernaut Gatling barrels spin under fire');
check(streaks.jugArmor, 'Juggernaut armour absorbs damage before health');
check(streaks.jugCracks, 'Juggernaut visor cracks and status reflect armour damage');
check(streaks.gunshipExit, 'entering Juggernaut restores the first-person HUD from gunship mode');
await runMissionSmoke(page, check);
await page.screenshot({ path: '_smoke-juggernaut.png' });

await page.evaluate(() => {
  exitJuggernaut(true);
  switchWeapon(4);
});
await new Promise((r) => setTimeout(r, 1300));
const lmg = await page.evaluate(() => ({
  id: WEAPONS[player.weapon].id,
  name: document.getElementById('wname').textContent,
  mode: document.getElementById('wmode').textContent,
  slots: document.querySelectorAll('.slot').length,
}));
check(lmg.id === 'lmg' && lmg.name === 'SAW-250 机枪', 'slot 5 is the SAW-250 LMG');
check(lmg.mode === '全自动' && lmg.slots === 8, 'HUD weapon mode is Chinese, eight slots listed');

await page.evaluate(() => {
  callGunship();
  updateGunship(0.016, 0, 0);
});
await page.screenshot({ path: '_smoke-gunship.png' });
const gunshipExpiry = await page.evaluate(() => {
  G.gunship.t = 0.001;
  updateGunship(0.016, 0, 0);
  return {
    ended: !G.gunship,
    hud: !document.getElementById('hud').classList.contains('gunship'),
    filter: compMat.uniforms.gunship.value,
    vm: vmRoot.visible,
  };
});
check(
  gunshipExpiry.ended && gunshipExpiry.hud && gunshipExpiry.filter === 0 && gunshipExpiry.vm,
  'gunship expiry restores camera, HUD, filter and viewmodel'
);

const gunshipDeath = await page.evaluate(() => {
  const standardSpawn = { x: SPAWN.x, z: SPAWN.z, yaw: CUR.spawnYaw || 0 };
  player.pos.x += 2;
  player.pos.z -= 2;
  callGunship();
  const timer = G.respawnT;
  damagePlayer(9999, new THREE.Vector3(player.pos.x + 2, 1, player.pos.z), '测试');
  const continued =
    !!G.gunship?.controlled && G.gunship.operatorDead && !UI.respawn.classList.contains('on');
  const pausedTimer = G.respawnT === 2.6 && G.respawnT !== timer;
  G.gunship.t = 0.001;
  updateGunship(0.016, 0, 0);
  const redeployed =
    !G.gunship &&
    !player.dead &&
    G.respawnT === 0 &&
    !UI.respawn.classList.contains('on') &&
    player.hp === 100 &&
    Math.abs(player.pos.x - standardSpawn.x) < 0.01 &&
    Math.abs(player.pos.z - standardSpawn.z) < 0.01 &&
    Math.abs(player.yaw - standardSpawn.yaw) < 0.01;
  const modelRestored =
    vmRoot.visible &&
    WEAPONS[player.weapon].vm.group.visible &&
    WEAPONS.filter((w) => w.vm.group.visible).length === 1;
  return { continued, pausedTimer, redeployed, modelRestored };
});
check(
  gunshipDeath.continued &&
    gunshipDeath.pausedTimer &&
    gunshipDeath.redeployed &&
    gunshipDeath.modelRestored,
  'operator death keeps the gunship active, then expiry immediately redeploys at the map spawn'
);

await page.evaluate(() => {
  if (G.heli) {
    scene.remove(G.heli.obj);
    G.heli = null;
  }
  if (G.gunship) {
    scene.remove(G.gunship.obj);
    G.gunship = null;
  }
  window._ue = updateEnemy;
  updateEnemy = () => {};
  for (const e of enemies) if (!e.dead) damageEnemy(e, 9999, false, null, e.obj.position, '测试');
});
await new Promise((r) => setTimeout(r, 7500));
const sides = await page.evaluate(() => {
  updateEnemy = window._ue;
  return {
    allOutdoorEast: enemies.every(
      (e) => !e.upper && e.obj.position.x > 17.5 && Math.abs(e.obj.position.y) < 0.1
    ),
  };
});
check(sides.allOutdoorEast, 'all hostiles respawn outdoors behind the east house');

if (errors.length) {
  console.log('page errors:');
  for (const e of errors) console.log('  ' + e);
  fail(errors.length + ' page errors');
}
await browser.close();
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
