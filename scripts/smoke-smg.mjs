export async function runSmgSmoke(page, check) {
  const result = await page.evaluate(() => {
    const saved = player.weapon;
    const ids = WEAPONS.map((w) => w.id);
    const normal = WEAPONS.slice(0, NORMAL_WEAPON_COUNT);
    const vector = WEAPONS[6],
      p90 = WEAPONS[7];
    const modelOk = (w) =>
      !!w.vm.weaponPivot &&
      !!w.vm.muzzle &&
      !!w.vm.eject &&
      !!w.vm.mag &&
      w.vm.mag !== w.vm.newMag &&
      w.vm.newMag !== w.vm.ejectedMag &&
      !!w.vm.leftHand &&
      !!w.vm.rightHand;
    const reloadOk = [];
    for (const index of [6, 7]) {
      clearAllReloadProgress();
      player.weapon = index;
      player.switching = player.pumpT = player.boltT = player.meleeT = 0;
      const w = WEAPONS[index];
      w.mag = 0;
      w.res = w.reserve;
      startReload();
      updatePlayerReload(player.reloadDuration * (RELOAD_STAGE[w.id].remove + 0.03));
      updateViewmodel(0, 0, 0);
      const removed = !w.vm.mag.visible && w.vm.ejectedMag.visible;
      const afterRemove = 1 - player.reloadT / player.reloadDuration;
      updatePlayerReload(player.reloadDuration * (0.58 - afterRemove));
      updateViewmodel(0, 0, 0);
      const incoming = w.vm.newMag.visible;
      reloadOk.push(removed && incoming);
    }
    const emptyAuto = [0, 1, 2, 3, 4, 5, 6, 7].every((i) => {
      const w = WEAPONS[i];
      player.weapon = i;
      player.reloadT = player.pumpT = player.boltT = player.fireCooldown = player.switching = 0;
      player.meleeT = player.sprintFireRaise = 0;
      player.sprint = false;
      delete w.reloadState;
      w.mag = 1;
      w.res = Math.max(8, w.res);
      fireWeapon();
      if (player.boltT > 0 || player.pumpT > 0) {
        player.boltT = player.pumpT = 0;
        maybeAutoReload();
      }
      const ok = player.reloadT > 0 && w.mag === 0;
      player.reloadT = 0;
      delete w.reloadState;
      return ok;
    });
    player.weapon = saved;
    clearAllReloadProgress();
    return {
      ids,
      normal: normal.length,
      models: modelOk(vector) && modelOk(p90),
      vectorStats: vector.rpm === 1000 && vector.magSize === 25 && vector.sound === 'vector',
      p90Stats: p90.rpm === 900 && p90.magSize === 50 && p90.sound === 'p90',
      reloads: reloadOk.every(Boolean),
      slots: document.querySelectorAll('.slot').length,
      icons: WICONS.length,
      emptyAuto,
    };
  });
  console.log('smgs:', JSON.stringify(result));
  check(
    result.normal === 8 && result.slots === 8 && result.icons === 9,
    'eight normal weapon slots and all HUD icons are registered'
  );
  check(
    result.ids[6] === 'vector' && result.ids[7] === 'p90' && result.ids[8] === 'jug_gatling',
    'Vector and P90 occupy normal slots before the Juggernaut weapon'
  );
  check(
    result.models && result.vectorStats && result.p90Stats,
    'Vector and P90 models and combat profiles are complete'
  );
  check(result.reloads, 'Vector and P90 use distinct removable and incoming magazine objects');
  check(result.emptyAuto, 'emptying any normal magazine starts a reload after bolt or pump');
}
