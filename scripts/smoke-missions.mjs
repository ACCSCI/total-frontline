export async function runMissionSmoke(page, check) {
  const off = await page.evaluate(() => {
    const prev = G.mode;
    G.mode = 'mission';
    G.streak = 0;
    G.streaksReady.length = 0;
    G.uavT = 0;
    updateStreakDock();
    for (let n = 0; n < 12; n++) noteKillstreak();
    const e = enemies.find((x) => !x.dead) || (respawnEnemy(enemies[0]), enemies[0]);
    damageEnemy(e, 9999, false, null, e.obj.position);
    activateStreak(0);
    const ok =
      !G.streak &&
      !G.streaksReady.length &&
      !document.getElementById('streakDock').children.length &&
      G.uavT <= 0;
    G.mode = prev;
    return ok;
  });
  check(off, 'campaign awards no killstreaks');
}
