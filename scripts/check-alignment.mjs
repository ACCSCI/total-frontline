import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const weaponsJson = JSON.parse(
  readFileSync(new URL('../shared/weapons.json', import.meta.url), 'utf8')
);
const src = readFileSync(new URL('../src/17-weapons.ts', import.meta.url), 'utf8');

class V3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set() {}
  clone() {
    return new V3(this.x, this.y, this.z);
  }
  setScalar() {}
}
class Group {
  constructor() {
    this.children = [];
    this.visible = false;
    this.scale = new V3(1, 1, 1);
    this.position = new V3();
    this.rotation = new V3();
  }
  add(...objs) {
    this.children.push(...objs);
  }
  traverse() {}
}
const THREE = { Group, Vector3: V3, Euler: V3 };
const base = {};
for (const w of Object.values(weaponsJson.weapons)) {
  base[w.legacyId] = {
    id: w.legacyId,
    name: w.name,
    magSize: w.magSize,
    reserve: w.reserve,
    maxReserve: w.maxReserve,
    damage: w.damage,
    pellets: w.pellets,
    rpm: w.rpm,
    auto: w.auto,
  };
}
const builders = [
  'buildRifle',
  'buildShotgun',
  'buildPistol',
  'buildSniper',
  'buildLMG',
  'buildModernAK',
  'buildVector',
  'buildP90',
  'buildJugGatling',
];
const stubBuilder = () => ({
  group: new Group(),
  adsPos: new V3(),
  adsRot: new V3(),
  basePos: new V3(),
  baseRot: new V3(),
  mag: new Group(),
  newMag: new Group(),
});
const sandbox = {
  THREE,
  SHARED_WEAPON_BASE: base,
  vmScene: new Group(),
  GUN_PER_M: 1,
  texelize() {},
  console,
};
for (const b of builders) sandbox[b] = stubBuilder;
let code = src.replace("'use strict';", '');
code = code.replace('const WEAPONS: any[] = [', 'const WEAPONS = [');
code += '\n;globalThis.__WEAPONS = WEAPONS;';
const context = vm.createContext(sandbox);
vm.runInContext(code, context, { filename: '17-weapons.ts' });
const legacy = sandbox.__WEAPONS;

const legacyById = {};
for (const w of legacy) legacyById[w.id] = w;
const compareFields = [
  'damage',
  'headMult',
  'pellets',
  'rpm',
  'spreadBase',
  'spreadMax',
  'spreadShot',
  'spreadRecover',
  'moveSpread',
  'airSpread',
  'crouchMult',
  'recoilKick',
  'recoilRot',
  'camPitch',
  'camYaw',
  'adsRecoil',
  'fovKick',
  'reloadTime',
  'tacticalReloadTime',
  'drawTime',
  'shakeAmt',
  'range',
  'falloffStart',
  'falloffRange',
  'falloffMin',
  'adsFov',
  'adsSpread',
  'adsTime',
  'noise',
];
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const campaignMain = read('../campaign/src/main.ts');
const campaignPlayer = read('../campaign/src/player.ts');
const campaignRules = read('../campaign/src/campaign.ts');
const campaignCombat = read('../campaign/src/combat.ts');
const campaignCombatUtils = read('../campaign/src/combat-utils.ts');
const campaignCrosshair = read('../campaign/src/crosshair.ts');
const campaignSfx = read('../campaign/src/sfx.ts');
const campaignSoldier = read('../campaign/src/soldier.ts');
const campaignViewmodel = read('../campaign/src/viewmodel.ts');
const sharedMovement = read('../shared/gameplay/movement.ts');
const sharedStance = read('../shared/gameplay/stance.ts');
const sharedSpread = read('../shared/gameplay/spread.ts');
const sharedAi = read('../shared/gameplay/ai.ts');
const sharedReload = read('../shared/gameplay/reload.ts');

let mismatches = 0;
const aligned = (ok, label) => {
  if (!ok) {
    console.log(`MISMATCH ${label}`);
    mismatches++;
  }
};
const has = (text, needle, label) => aligned(text.includes(needle), label);

/* Movement / camera feel must be the single-player update, not a simplified copy. */
has(
  campaignPlayer,
  "from '../../shared/gameplay'",
  'player steps locomotion from the shared gameplay layer'
);
has(sharedMovement, 'ADS_MOVE_PENALTY = 0.4', 'shared ADS move penalty matches single-player');
has(sharedMovement, 'MANTLE_RISE = 1.95', 'shared mantle rise matches single-player');
const legacyPlayerUpdate = read('../src/23-player-update.ts');
has(
  legacyPlayerUpdate,
  'Gameplay.stepLocomotion',
  'single-player locomotion calls the shared stepper'
);
has(
  legacyPlayerUpdate,
  'Gameplay.stepLook',
  'single-player look uses the extracted single-player controller'
);
has(
  legacyPlayerUpdate,
  'Gameplay.stepView',
  'single-player camera uses the extracted single-player controller'
);
has(
  read('../shared/gameplay/controller.ts'),
  'loco.prone ? 0.72 : loco.crouch ? 1.05 : 1.42',
  'player footstep cadence matches single-player'
);
has(
  sharedStance,
  'prone ? 1.65 : crouch ? 1.28 : 1',
  'shared stance recovery matches single-player'
);
has(
  read('../shared/gameplay/controller.ts'),
  'view.stepPhase * 2) * 0.032',
  'player head bob amplitude matches single-player'
);
has(
  read('../shared/gameplay/controller.ts'),
  '0.0125',
  'scoped sway amplitude matches single-player'
);
has(campaignPlayer, 'stepPlayer', 'player position uses the extracted single-player controller');
has(campaignPlayer, 'SFX.land(f)', 'landing audio matches single-player');
has(
  read('../shared/gameplay/controller.ts'),
  'Math.tan((weapon.adsFov * PI) / 360)',
  'ADS mouse sensitivity scales with zoom like single-player'
);
has(
  campaignMain,
  'campaign?.update(dt, player.spreadRecoveryMultiplier)',
  'campaign rules consume player stance recovery'
);

/* Ballistics and hit fidelity. */
has(
  campaignCombat,
  'e.soldier.hbHead, e.soldier.hbBody, e.soldier.hbLegs',
  'campaign bullets use single-player hitboxes'
);
has(
  read('../shared/gameplay/ballistics.ts'),
  'LEG_MULTIPLIER = 0.78',
  'shared leg shots use single-player 0.78 multiplier'
);
has(sharedStance, '(crouchMult || 0.7) * 0.55', 'shared prone spread matches single-player');
has(sharedSpread, 'weapon.adsSpread', 'shared ADS cone matches single-player');
has(campaignCombat, 'this.worldTargets', 'campaign bullets stop on rendered world geometry');
has(
  read('../shared/gameplay/ballistics.ts'),
  'resistance: 0.34',
  'shared wood penetration matches single-player'
);
has(
  read('../src/19c-ballistics.ts'),
  'Gameplay.tracePenetrations',
  'legacy ballistics calls the shared tracer'
);
has(campaignCombat, 'tracePenetrations', 'campaign bullets use shared penetration');
has(
  campaignCombat,
  'this.alertEnemiesToGunfire(def.noise, suppressed)',
  'campaign gunfire alert radius matches single-player noise'
);
has(sharedAi, 'ENEMY_SIGHT = 52', 'shared enemy sight range matches single-player');
has(sharedAi, '5.5 + rng() * 3.5', 'shared enemy damage matches single-player');
has(sharedAi, 'dist - 25) / 55, 0.5, 1', 'shared enemy damage falloff matches single-player');
has(campaignCombatUtils, 'combatSteer', 'campaign AI steers from the shared combat layer');
const sharedMelee = read('../shared/gameplay/melee.ts');
has(sharedMelee, 'MELEE_RANGE = 2.35', 'shared melee range matches single-player');
has(sharedMelee, 'MELEE_BODY_DAMAGE = 65', 'shared melee body damage matches single-player');
has(read('../src/20a-melee.ts'), 'Gameplay.MELEE_RANGE', 'legacy melee uses the shared range');
has(read('../campaign/src/combat.ts'), 'MELEE_RANGE', 'campaign melee uses the shared range');
has(read('../campaign/src/input.ts'), 'KeyV', 'campaign binds V to melee like single-player');
has(
  read('../campaign/src/input.ts'),
  'host.campaign.switchSlot((host.campaign.activeSlot + dir + n) % n)',
  'campaign mouse wheel cycles weapons like single-player'
);
has(
  read('../campaign/src/main.ts'),
  'adsHidesCrosshair',
  'campaign hides the hip reticle on ADS like single-player'
);
has(
  read('../shared/gameplay/attachments.ts'),
  "optic: 'micro_dot'",
  'campaign rifles default to the single-player red-dot'
);
has(
  read('../shared/gameplay/attachments.ts'),
  "muzzle: 'suppressor'",
  'campaign start loadout issues a suppressor'
);
has(
  read('../campaign/src/campaign.ts'),
  'PRIMARY_WEAPONS.p9',
  'campaign mission 1 issues a pistol'
);
has(read('../shared/gameplay/ai.ts'), '>= 0.2', 'shared enemy FOV matches single-player');
has(
  read('../shared/gameplay/throwables.ts'),
  'LETHAL_ENEMY_RADIUS = 6.5',
  'shared grenade blast uses the single-player explode radius'
);
has(
  read('../src/20e-throwables.ts'),
  'Gameplay.spawnThrow',
  'single-player throws the shared grenade'
);
has(read('../campaign/src/combat-throw.ts'), 'spawnThrow', 'campaign throws the shared grenade');
has(
  read('../campaign/src/viewmodel.ts'),
  'ejectedMag',
  'campaign keeps the single-player ejected magazine on the rifle'
);
has(
  read('../shared/gameplay/loot.ts'),
  'ENEMY_DROP_WEAPON_CHANCE = 0.55',
  'shared enemy weapon drop chance'
);
has(
  read('../src/20f-loot.ts'),
  'Gameplay.rollEnemyDrops',
  'single-player enemy drops use shared loot'
);
has(read('../campaign/src/combat.ts'), 'rollEnemyDrops', 'campaign enemy drops use shared loot');
has(
  read('../src/20f-loot.ts'),
  'Gameplay.interactGroundWeapon',
  'single-player F-swap uses shared loot'
);
has(
  read('../campaign/src/campaign.ts'),
  'interactGroundWeapon',
  'campaign F-swap uses shared loot'
);

/* Weapon transaction state. */
has(
  read('../shared/gameplay/controller.ts'),
  'easeInOutCubic(view.adsK)',
  'shared ADS ease curve matches single-player'
);
has(
  read('../campaign/src/player.ts'),
  'stepPlayer',
  'campaign player uses the extracted single-player controller'
);
has(
  read('../campaign/src/viewmodel.ts'),
  "from './generated-vm-anim'",
  'campaign viewmodel plays the generated single-player animation'
);
has(sharedReload, 'reloadBlocksFire', 'shared reload blocks fire exactly like single-player');
has(campaignRules, 'cancelReload', 'campaign sprint cancels reload like single-player');
has(campaignRules, 'w.pumpT > 0 ||', 'campaign reload guards pump like single-player');

/* Crosshair is the same canvas reticle and formula. */
const sharedCrosshair = read('../shared/gameplay/crosshair.ts');
for (const needle of ['baseScale: 105', 'fireScale: 240', 'reloadErr: 2.0', 'maxSpread: 12'])
  has(sharedCrosshair, needle, `shared crosshair ${needle} matches single-player`);
has(
  sharedCrosshair,
  '1 - 0.45 * state.adsEase',
  'shared crosshair ADS contraction matches single-player'
);
has(
  campaignCrosshair,
  "from '../../shared/gameplay'",
  'campaign crosshair imports the shared reticle'
);
has(
  read('../src/19-player-hud.ts'),
  'Gameplay.crosshairTarget',
  'single-player crosshair imports the shared reticle'
);
has(read('../campaign/src/fx.ts'), 'createTracerFlight', 'campaign tracers import shared flight');
has(
  read('../campaign/src/combat-utils.ts'),
  'stepDeathBody',
  'campaign death imports shared death poses'
);
has(
  read('../src/22-ai-b.ts'),
  'Gameplay.stepDeathBody',
  'single-player death imports shared poses'
);

/* Audio and rig reuse. */
has(
  campaignSfx,
  '0.64 / (1 + (d / 11) ** 1.65)',
  'campaign gunshot distance gain matches single-player'
);
has(campaignSfx, 'delay = dist / 340', 'campaign gunshot distance delay matches single-player');
has(
  campaignSoldier,
  't.wrapS = t.wrapT = THREE.RepeatWrapping',
  'campaign soldier camo tiling matches single-player'
);
has(
  campaignSoldier,
  "hbHead.userData.part = 'head'",
  'campaign soldier hitboxes carry single-player body parts'
);
has(campaignViewmodel, 'VM_FOV = 41.9', 'campaign viewmodel telephoto FOV matches single-player');
has(campaignViewmodel, 'VM_SCALE = 0.86', 'campaign viewmodel scale matches single-player');

for (const [id, shared] of Object.entries(weaponsJson.weapons)) {
  const leg = legacyById[shared.legacyId || id];
  if (!leg) {
    console.log(`MISSING legacy weapon ${id}`);
    mismatches++;
    continue;
  }
  for (const f of compareFields) {
    if (leg[f] !== shared[f]) {
      console.log(`MISMATCH ${id}.${f}: shared=${shared[f]} legacy=${leg[f]}`);
      mismatches++;
    }
  }
}
console.log(`campaign/single-player alignment mismatches: ${mismatches}`);
process.exitCode = mismatches ? 1 : 0;
