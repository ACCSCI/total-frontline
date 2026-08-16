import { campaignStartAttachments } from '../shared/gameplay/attachments.ts';
import {
  applyCheckpointRestore,
  createMissionState,
  enterZone,
  hurtVega,
  infiltrationMode,
  interactVega,
  PATH_METERS,
  restoreMissionStage,
  spawnApcPressure,
  takeCommsModule,
  teachNightVision,
  tickVegaThreat,
  toggleNightVision,
  triggerFuelBlast,
  triggerLightningReroute,
  VEGA_MAX_HP,
  zoneAt,
} from '../shared/gameplay/mission-director.ts';

const log = [];
const pass = (name, cond, detail) => {
  log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) throw new Error(log[log.length - 1]);
};

const kit = campaignStartAttachments('m4');
pass(
  'm4 start kit',
  kit.optic === 'micro_dot' &&
    kit.muzzle === 'suppressor' &&
    kit.underbarrel === 'vertical_grip' &&
    kit.magazine === 'extended'
);
pass('p9 start kit', campaignStartAttachments('p9').muzzle === 'suppressor');
pass('path is spec length', PATH_METERS >= 1800 && PATH_METERS <= 2400, String(PATH_METERS));

const s = createMissionState();
pass('spawn zone', zoneAt(980) === 'teach', zoneAt(980));
pass('road zone', zoneAt(640) === 'road', zoneAt(640));
pass('crash zone', zoneAt(360) === 'crash', zoneAt(360));
pass('fuel zone', zoneAt(-230) === 'fuel', zoneAt(-230));
pass('bridge zone', zoneAt(-860) === 'bridge', zoneAt(-860));
pass('infil stealth-or-combat', infiltrationMode(720) === 'stealth-or-combat');
pass('crash is open combat', infiltrationMode(360) === 'combat');

teachNightVision(s);
pass('nv teach radio', s.radio.includes('夜视仪'));
pass('first NV toggle teaches', toggleNightVision(s) === true && s.nvTaught);
pass('NV flag', !!s.flags.nvTaught);

const vega = createMissionState();
pass('vega too far', interactVega(vega, 9) === false);
pass('vega rescue', interactVega(vega, 1.2) === true && vega.vegaRescued);
pass('module', takeCommsModule(vega, 1) === true && vega.moduleTaken);

const fuel = createMissionState();
pass('fuel requires zone', triggerFuelBlast(fuel, false) === false);
pass('fuel blast', triggerFuelBlast(fuel, true) === true && fuel.fuelBlown);
pass('fuel radio', fuel.radio.includes('油罐'));

const storm = createMissionState();
pass('lightning', triggerLightningReroute(storm, true) === true && storm.routeBlocked);
pass('lightning radio', storm.radio.includes('雷击') || storm.radio.includes('树冠'));

const apc = createMissionState();
pass('apc spawn', spawnApcPressure(apc, true) === true && apc.apc.spawned);
pass('apc radio', apc.radio.includes('装甲'));

const z = createMissionState();
const hit = enterZone(z, 640);
pass('enter road', hit.entered && hit.zone === 'road');

const dead = createMissionState();
pass('vega dies', hurtVega(dead, VEGA_MAX_HP) === true && dead.vegaHp === 0);
restoreMissionStage(dead, 'cp_spawn');
pass('checkpoint restore resets vega', dead.vegaHp === VEGA_MAX_HP && !dead.vegaRescued);

const crashDead = createMissionState();
enterZone(crashDead, 360);
tickVegaThreat(crashDead, true, 8);
pass('vega dies at crash', crashDead.vegaHp === 0);
restoreMissionStage(crashDead, 'cp_crash');
pass('cp_crash restores vega hp', crashDead.vegaHp === VEGA_MAX_HP && !crashDead.vegaRescued);
pass('cp_crash interact vega works', interactVega(crashDead, 1.2) === true);

const crashHostiles = createMissionState();
enterZone(crashHostiles, 330);
tickVegaThreat(crashHostiles, true, 8);
const crashEnemy = {
  alive: true,
  engaged: true,
  suspicion: 1,
  lastSeenT: 4,
  reactionT: 0,
  baseX: -1.2,
  baseZ: 330,
  root: { position: { x: -0.4, z: 328 } },
};
applyCheckpointRestore(crashHostiles, 'cp_crash', [crashEnemy]);
pass('respawn path restores vega at cp_crash', crashHostiles.vegaHp === VEGA_MAX_HP);
pass('respawn path repark crash enemy', crashEnemy.engaged === false && crashEnemy.root.position.z === 330);
pass('respawn path vega interactable', interactVega(crashHostiles, 1.2) === true);

const threat = createMissionState();
pass('vega threat idle', tickVegaThreat(threat, false, 1) === false && threat.vegaHp === VEGA_MAX_HP);
pass('vega threat kill', tickVegaThreat(threat, true, 8) === true && threat.vegaHp === 0);

console.log(log.join('\n'));
console.log(`OK ${log.length} mission-director checks`);
