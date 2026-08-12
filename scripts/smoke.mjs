/* dev-only smoke test: loads the game in headless Chrome, fails on any page
   error, and exercises the map switch in both directions. */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:8123/index.html';

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
  if (url && url.includes('favicon')) return; /* the game ships no favicon */
  errors.push('console: ' + m.text());
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.getElementById('boot').classList.contains('hide'), {
  timeout: 30000,
});
await new Promise((r) => setTimeout(r, 1200));

const fail = (msg) => {
  console.error('FAIL: ' + msg);
  process.exitCode = 1;
};
const check = (cond, msg) => {
  console.log((cond ? '  ok  ' : '  BAD ') + msg);
  if (!cond) fail(msg);
};

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
check(yard.enemies === 10, 'ten hostiles spawned');
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
  /* original-Nuketown spawns: the ground squad musters behind the east house,
     while the two upstairs marksmen start on their second-floor routes */
  squadEast: enemies.filter((e) => !e.upper).every((e) => e.obj.position.x > 17.5),
  upstairs: enemies
    .filter((e) => e.upper)
    .every((e) => e.obj.position.x > 7 && e.obj.position.y > 2.5),
  /* and the walkable flood fill from the west-backyard spawn reaches everywhere
     (points picked on open floor, clear of the picnic table and swing posts) */
  connected: [
    [0, 0],
    [25, 16],
    [-13, -7.5],
    [13, 2.5],
    [-26, -20],
    [0, 26],
  ].every(([x, z]) => walkable(x, z)),
}));
console.log('nuke:', JSON.stringify(nuke));
check(nuke.cur === 'nuke', 'switched to nuketown');
check(nuke.enemies === 10, 'hostiles respawned on nuketown');
check(nuke.spawnWalkable, 'nuke spawn is walkable');
check(nuke.squadEast, 'ground squad spawns behind the east house');
check(nuke.upstairs, 'upstairs marksmen start on the second floor');
check(nuke.connected, 'walkable grid reaches both backyards, both houses, the street');
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
const game = await page.evaluate(() => ({
  started: G.started,
  hud: document.getElementById('hud').classList.contains('on'),
  menuHidden: document.getElementById('startScreen').classList.contains('hide'),
  time: G.time,
  spawn: { x: player.pos.x, z: player.pos.z },
}));
console.log('game:', JSON.stringify(game));
check(game.started && game.hud && game.menuHidden, 'deploying from the menu starts a round');
check(game.time > 595 && game.time <= 600, 'deathmatch runs ten minutes');
check(game.spawn.x === -24 && game.spawn.z === -6, 'player spawns behind the west house');

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
await page.screenshot({ path: '_smoke-ingame-nuke.png' });

/* deathmatch: death is a respawn, not the end of the round — and it cashes
   out any killstreak in progress */
await page.evaluate(() => {
  G.streak = 3;
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

/* regen: out of the fight for 4.5s, health knits back up */
await page.evaluate(() => {
  player.hp = 50;
  player.armor = 0;
  player.lastHurt = 0;
});
await new Promise((r) => setTimeout(r, 700));
const regen = await page.evaluate(() => player.hp);
check(regen > 56, 'health regenerates out of combat (hp=' + regen.toFixed(0) + ')');

/* enemy slots refill: kill one, wait out the queue, squad is back to ten */
await page.evaluate(() => {
  const e = enemies.find((x) => !x.dead);
  damageEnemy(e, 9999, false, null, e.obj.position);
});
await new Promise((r) => setTimeout(r, 7500));
const refill = await page.evaluate(() => enemies.filter((e) => !e.dead).length);
check(refill === 10, 'enemy slot refills after a kill');

/* squadmates: three of them, holding the wedge near the player */
const squad = await page.evaluate(() => ({
  n: allies.length,
  near: allies.filter(
    (a) => Math.hypot(a.obj.position.x - player.pos.x, a.obj.position.z - player.pos.z) < 12
  ).length,
}));
check(squad.n === 3, 'three squadmates deploy with you');
check(squad.near >= 2, 'squadmates hold formation near the player');

/* hostiles pick squadmates as targets too: pin one in the open facing an
   ally, with the player briefly out of the perception pool — the player is
   standing right there at the spawn and is always the preferred target */
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
});
await new Promise((r) => setTimeout(r, 1200));
const picksAlly = await page.evaluate(() => {
  const r = enemies.some((e) => e.tgt) || allies.some((a) => a.hp < 100 || a.dead);
  player.dead = false;
  return r;
});
check(picksAlly, 'hostiles engage squadmates, not just the player');

/* killstreaks: earning docks them on the left, keys 6–0 fire them */
const streaks = await page.evaluate(() => {
  const out = {};
  G.streaksReady.length = 0;
  const kill = () => {
    const e = enemies.find((x) => !x.dead);
    damageEnemy(e, 9999, false, null, e.obj.position);
  };
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
  out.gunshipThermal = visibleTarget >= 0 && E_MAT.cloth.emissiveIntensity > 1;
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
    compMat.uniforms.gunship.value === 0;
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
check(
  streaks.gunship && streaks.gunshipHud,
  '10 kills: player enters the gunship fire-control view'
);
check(streaks.gunshipControl, 'gunship mouse aim and 1/2/3 weapon selection work');
check(streaks.gunshipVertical, 'gunship mouse-up input moves the reticle upward');
check(streaks.gunshipThermal, 'gunship thermal view highlights visible enemies with red boxes');
check(streaks.gunshipOccluded, 'building-obscured gunship targets receive a red X');
check(streaks.gunshipFire, 'gunship 105 mm cannon fires and enters cooldown');
check(streaks.jug && streaks.jugLocked, '12 kills: juggernaut equips a locked Gatling loadout');
check(streaks.jugInfinite, 'Juggernaut Gatling has unlimited ammunition and cannot reload');
check(streaks.gatlingSpin, 'Juggernaut Gatling barrels spin under fire');
check(streaks.jugArmor, 'Juggernaut armour absorbs damage before health');
check(streaks.jugCracks, 'Juggernaut visor cracks and status reflect armour damage');
check(streaks.gunshipExit, 'entering Juggernaut restores the first-person HUD from gunship mode');
await page.screenshot({ path: '_smoke-juggernaut.png' });

/* the LMG: slot 5 switches in and shows up on the HUD in Chinese */
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
check(lmg.mode === '全自动' && lmg.slots === 5, 'HUD weapon mode is Chinese, five slots listed');

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

/* respawns honour the sides: wipe the squad, everyone comes back east.
   Gun platforms come off station first and the AI is frozen for the wait, so
   what gets measured is the spawn point, not where a body walked or fell. */
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
    groundEast: enemies.filter((e) => !e.upper).every((e) => e.obj.position.x > 17.5),
    upperEast: enemies
      .filter((e) => e.upper)
      .every((e) => e.obj.position.x > 7 && e.obj.position.y > 2.5),
  };
});
check(sides.groundEast, 'ground squad always respawns behind the east house');
check(sides.upperEast, 'upstairs marksmen respawn in the east house');

if (errors.length) {
  console.log('page errors:');
  for (const e of errors) console.log('  ' + e);
  fail(errors.length + ' page errors');
}
await browser.close();
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
