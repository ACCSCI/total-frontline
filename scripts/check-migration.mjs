import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async (p) => readFile(new URL(p, import.meta.url), 'utf-8');
const exists = async (p) => {
  try {
    await stat(new URL(p, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

const checks = [];
const check = (cond, label) => {
  checks.push({ ok: !!cond, label });
  console.log(`${cond ? '  ok  ' : '  BAD '}${label}`);
};

const weapons = JSON.parse(await read('../shared/weapons.json'));
const missions = JSON.parse(await read('../shared/missions.json'));
const movement = JSON.parse(await read('../shared/movement.json'));
const loadout = JSON.parse(await read('../shared/loadout.json'));

const legacyIndex = await read('../index.html');
const campaignIndex = await read('../campaign/index.html');
const legacyBuild = await read('../scripts/build.mjs');
const legacyMovement = await read('../src/generated-movement.ts');
const legacyWeapons = await read('../src/generated-weapons.ts');
const campaignRules = await read('../campaign/src/campaign.ts');
const campaignCombat = await read('../campaign/src/combat.ts');
const campaignLevel = await read('../campaign/src/level.ts');
const campaignPlayer = await read('../campaign/src/player.ts');

check(
  Object.keys(weapons.weapons).length >= 6,
  'shared weapon definitions cover the six campaign weapons'
);
check(
  missions.mission01.objectives.length === 9,
  'mission 01 defines the nine-step objective chain'
);
check(
  missions.mission01.enemyPositions.length >= 26 && missions.mission01.enemyPositions.length <= 34,
  'mission 01 fields 26-34 hostiles'
);
check(
  movement.speeds.walk === 4.9 && movement.stance.standHeight === 1.72,
  'shared movement data holds the single-player feel'
);
check(!loadout.campaign.killstreaksEnabled, 'campaign rules disable killstreaks');

check(
  legacyIndex.includes('id="campaignLaunch"'),
  'legacy main menu owns the campaign launch card'
);
check(campaignIndex.includes('id="menuLink"'), 'campaign HUD links back to the shared main menu');
check(
  legacyBuild.includes('shared/movement.json'),
  'legacy build generates movement constants from shared data'
);
check(
  legacyBuild.includes('shared/weapons.json'),
  'legacy build generates weapon constants from shared data'
);
check(legacyMovement.includes('SHARED_MOVEMENT'), 'generated legacy movement bridge exists');
check(legacyWeapons.includes('SHARED_WEAPON_BASE'), 'generated legacy weapon bridge exists');
check(campaignRules.includes('../../shared/weapons.json'), 'campaign rules consume shared weapons');
check(
  campaignCombat.includes('../../shared/missions.json'),
  'campaign combat consumes shared missions'
);
check(
  campaignLevel.includes('../../shared/missions.json'),
  'campaign level consumes shared missions'
);
check(
  campaignLevel.includes('../../shared/audio-params.json'),
  'campaign level consumes shared audio params'
);
check(
  campaignPlayer.includes('../../shared/movement.json'),
  'campaign player consumes shared movement'
);

check(await exists('../dist/index.html'), 'legacy build output exists');
check(await exists('../dist/js/game.js'), 'legacy game bundle exists');
check(await exists('../dist/campaign/index.html'), 'campaign build output exists');
check(await exists('../dist/campaign/assets'), 'campaign assets output exists');

const failures = checks.filter((c) => !c.ok);
console.log(`\nMIGRATION CHECK: ${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f.label}`);
  process.exitCode = 1;
}
