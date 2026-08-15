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
  "import movementData from '../../shared/movement.json'",
  'player uses shared movement data'
);
has(campaignPlayer, '1 - 0.4 * this.aimEase', 'player ADS move penalty matches single-player');
has(
  campaignPlayer,
  'this.prone ? 0.72 : this.crouch ? 1.05 : 1.42',
  'player footstep cadence matches single-player'
);
has(
  campaignPlayer,
  'this.prone ? 1.65 : this.crouch ? 1.28 : 1',
  'player stance spread recovery matches single-player'
);
has(
  campaignPlayer,
  'Math.sin(this.stepPhase * 2) * 0.032',
  'player head bob amplitude matches single-player'
);
has(campaignPlayer, '0.0125', 'scoped sway amplitude matches single-player');
has(campaignPlayer, 'this.pos.y = groundY', 'player position uses single-player feet semantics');
has(campaignPlayer, 'SFX.land(f)', 'landing audio matches single-player');
has(
  campaignMain,
  'Math.tan((aimFov * Math.PI) / 360)',
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
has(campaignCombat, 'legshot ? 0.78 : 1', 'campaign leg shots use single-player 0.78 multiplier');
has(
  campaignCombat,
  'Math.max(0.28, def.crouchMult * 0.55)',
  'campaign prone spread matches single-player'
);
has(campaignCombat, 'def.adsSpread, this.rules.adsEase', 'campaign ADS cone matches single-player');
has(campaignCombat, 'this.worldTargets', 'campaign bullets stop on rendered world geometry');
has(
  campaignCombat,
  'this.alertEnemiesToGunfire(def.noise)',
  'campaign gunfire alert radius matches single-player noise'
);
has(campaignCombatUtils, 'dist < 52', 'campaign enemy sight range matches single-player');
has(
  campaignCombatUtils,
  '5.5 + Math.random() * 3.5',
  'campaign enemy damage matches single-player'
);
has(
  campaignCombatUtils,
  'dist - 25) / 55, 0.5, 1',
  'campaign enemy damage falloff matches single-player'
);

/* Weapon transaction state. */
has(campaignRules, 'k * k * (3 - 2 * k)', 'campaign ADS ease curve matches single-player');
has(campaignRules, 'reloadBlocksFire', 'campaign reload blocks fire exactly like single-player');
has(campaignRules, 'cancelReload', 'campaign sprint cancels reload like single-player');
has(campaignRules, 'w.pumpT > 0 ||', 'campaign reload guards pump like single-player');

/* Crosshair is the same canvas reticle and formula. */
for (const needle of ['baseScale: 105', 'fireScale: 240', 'reloadErr: 2.0', 'maxSpread: 12'])
  has(campaignCrosshair, needle, `campaign crosshair ${needle} matches single-player`);
has(
  campaignCrosshair,
  '1 - 0.45 * state.adsEase',
  'campaign crosshair ADS contraction matches single-player'
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
