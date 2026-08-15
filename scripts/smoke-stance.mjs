export async function runStanceSmoke(page, check) {
  const result = await page.evaluate(() => {
    const saved = {
      weapon: player.weapon,
      pos: player.pos.clone(),
      vel: player.vel.clone(),
      height: player.height,
      eye: player.eye,
      crouch: player.crouch,
      prone: player.prone,
      onGround: player.onGround,
      jumpsLeft: player.jumpsLeft,
      adsEase: player.adsEase,
      reloadT: player.reloadT,
      sprint: player.sprint,
    };
    const key = (code, type = 'keydown') => dispatchEvent(new KeyboardEvent(type, { code }));
    const rifle = WEAPONS[0];
    player.weapon = 0;
    player.vel.set(0, 0, 0);
    player.onGround = true;
    player.crouch = false;
    player.prone = false;
    player.adsEase = 0;
    player.reloadT = 0;
    rifle.spread = rifle.spreadBase;

    const standSpread = currentSpreadMult();
    player.vel.x = WALK_SPEED;
    const moveSpread = currentSpreadMult();
    player.onGround = false;
    const airSpread = currentSpreadMult();
    player.vel.set(0, 0, 0);
    player.onGround = true;
    player.crouch = true;
    const crouchSpread = currentSpreadMult();
    const crouchRecoil = currentRecoilScale(rifle, 0);
    player.crouch = false;
    player.prone = true;
    const proneSpread = currentSpreadMult();
    const proneRecoil = currentRecoilScale(rifle, 0);
    player.prone = false;
    const standRecoil = currentRecoilScale(rifle, 0);

    const baseCrosshairSizes = [];
    for (let i = 0; i < NORMAL_WEAPON_COUNT; i++) {
      player.weapon = i;
      player.vel.set(0, 0, 0);
      player.onGround = true;
      WEAPONS[i].spread = WEAPONS[i].spreadBase;
      crossSpread = 0;
      updateCrosshair(0);
      baseCrosshairSizes.push(crossSpread);
    }

    player.weapon = 0;
    player.pos.copy(saved.pos);
    player.vel.set(0, 0, 0);
    player.height = STAND_H;
    player.crouch = false;
    player.prone = false;
    player.onGround = true;
    keys['Space'] = keys['ShiftLeft'] = keys['KeyW'] = false;
    key('KeyZ');
    updatePlayer(1 / 60);
    key('KeyZ', 'keyup');
    const enteredProne = player.prone && !player.crouch && !player.sprint;
    const proneHud = $('stance').classList.contains('prone') && $('stance').textContent.includes('最稳定');

    player.vel.set(8, 0, 0);
    updatePlayer(1 / 60);
    const proneSpeed = Math.hypot(player.vel.x, player.vel.z);
    player.vel.set(0, 0, 0);
    player.onGround = true;
    keys['Space'] = true;
    player.spaceEdge = true;
    updatePlayer(1 / 60);
    keys['Space'] = false;
    const proneBlocksJump = player.onGround && player.vel.y === 0 && player.jumpsLeft === 1;

    keys['ShiftLeft'] = keys['KeyW'] = true;
    updatePlayer(1 / 60);
    const proneBlocksSprint = !player.sprint;
    keys['ShiftLeft'] = keys['KeyW'] = false;
    key('KeyZ');
    updatePlayer(1 / 60);
    key('KeyZ', 'keyup');
    const exitedProne = !player.prone;

    player.weapon = saved.weapon;
    player.pos.copy(saved.pos);
    player.vel.copy(saved.vel);
    player.height = saved.height;
    player.eye = saved.eye;
    player.crouch = saved.crouch;
    player.prone = saved.prone;
    player.onGround = saved.onGround;
    player.jumpsLeft = saved.jumpsLeft;
    player.adsEase = saved.adsEase;
    player.reloadT = saved.reloadT;
    player.sprint = saved.sprint;
    player.spaceEdge = player.proneEdge = false;
    keys['Space'] = keys['ShiftLeft'] = keys['KeyW'] = keys['KeyZ'] = false;
    updateStanceUI();
    updateCrosshair(0);
    return {
      standSpread,
      moveSpread,
      airSpread,
      crouchSpread,
      proneSpread,
      standRecoil,
      crouchRecoil,
      proneRecoil,
      baseCrosshairSizes,
      enteredProne,
      exitedProne,
      proneHud,
      proneSpeed,
      proneBlocksJump,
      proneBlocksSprint,
    };
  });

  check(
    new Set(result.baseCrosshairSizes.map((v) => v.toFixed(4))).size >= 5,
    'weapon base cones produce visibly different resting crosshair sizes'
  );
  check(
    result.moveSpread > result.standSpread && result.airSpread > result.moveSpread,
    'movement opens the ballistic cone and airborne movement opens it further'
  );
  check(
    result.proneSpread < result.crouchSpread && result.crouchSpread < result.standSpread,
    'crouch improves accuracy and prone is the most accurate stance'
  );
  check(
    result.proneRecoil < result.crouchRecoil && result.crouchRecoil < result.standRecoil,
    'crouch reduces recoil and prone has the strongest recoil control'
  );
  check(
    result.enteredProne && result.exitedProne && result.proneHud,
    'Z toggles prone and the HUD reports its best-stability state'
  );
  check(
    result.proneSpeed <= 1.16 && result.proneBlocksJump && result.proneBlocksSprint,
    'prone caps movement speed and blocks jumping, sprinting, and their climb entry'
  );
}
