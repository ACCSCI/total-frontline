export async function runBallisticsSmoke(page, check) {
  const result = await page.evaluate(() => {
    const enemy = { dead: false };
    const worldHit = (material, distance) => ({ object: { material, userData: {} }, distance });
    const enemyHit = { object: { userData: { enemy } }, distance: 12 };
    const glassRifle = traceBulletPath([worldHit(MAT.glassBroke, 4), enemyHit], WEAPONS[0]);
    const woodSmg = traceBulletPath([worldHit(NMAT.wood, 5), enemyHit], WEAPONS[6]);
    const steelShotgun = traceBulletPath([worldHit(MAT.container, 4), enemyHit], WEAPONS[1]);
    const concreteRifle = traceBulletPath([worldHit(MAT.concrete, 3), enemyHit], WEAPONS[0]);
    return {
      tagged: MAT.glassBroke.userData.surfaceKey === 'glassBroke' && NMAT.wood.userData.surfaceKey === 'wood',
      glass: glassRifle.enemy && glassRifle.surfaces[0].penetrated && glassRifle.damageScale < 1,
      wood: woodSmg.enemy && woodSmg.surfaces[0].penetrated && woodSmg.damageScale < 1,
      steel: !steelShotgun.enemy && !steelShotgun.surfaces[0].penetrated,
      concrete: !concreteRifle.enemy && !concreteRifle.surfaces[0].penetrated,
    };
  });
  console.log('ballistics:', JSON.stringify(result));
  check(result.tagged, 'map materials carry ballistic surface metadata');
  check(result.glass && result.wood, 'glass and wood pass eligible rounds with damage loss');
  check(result.steel && result.concrete, 'buckshot stops on steel and rifle rounds stop on concrete');
}
