/** Named 鹰落 beats. Campaign frame loop and tests call these same functions. */

export const PATH_METERS = 2000;
export const SPAWN_Z = 1000;
export const EXIT_Z = -1000;
export const STEALTH_UNTIL_Z = 500;
export const VEGA_INTERACT_RANGE = 2.6;
export const MODULE_INTERACT_RANGE = 2.4;
export const FUEL_INTERACT_RANGE = 3.2;
export const VEGA_MAX_HP = 100;
export const APC_SPEED = 3.8;

export type EnemyKind = 'rifle' | 'shotgun' | 'nco';
export type InfilMode = 'stealth-or-combat' | 'combat';

export const ZONES = {
  teach: { id: 'teach', minZ: 800, maxZ: 1000, label: '坠机残骸 A' },
  road: { id: 'road', minZ: 500, maxZ: 800, label: '林间旧伐木道' },
  crash: { id: 'crash', minZ: 200, maxZ: 500, label: '主坠机点' },
  valleyA: { id: 'valleyA', minZ: -100, maxZ: 200, label: '河谷 A' },
  fuel: { id: 'fuel', minZ: -400, maxZ: -100, label: '油料场' },
  valleyB: { id: 'valleyB', minZ: -750, maxZ: -400, label: '河谷 B' },
  bridge: { id: 'bridge', minZ: -1000, maxZ: -750, label: '公路桥' },
} as const;

export type ZoneId = keyof typeof ZONES;

export const RADIO = {
  wake: 'HAMMER：隼，听到请回答。保持隐蔽，夜视仪就位。',
  nvTeach: 'WEBER：按 N 开启夜视仪。蹲下再接近巡逻。',
  nvOn: 'WEBER：夜视已同步。伐木道上有两组搜索队，可潜行也可交火。',
  kit: 'HAMMER：装备点确认。消音 M4 继续前进。',
  road: 'HAMMER：旧伐木道。两队巡逻，别恋战。',
  crash: 'HAMMER：主残骸就在前方。找到 VEGA，拿回通讯模块。',
  vega: 'VEGA：我还能走。模块在货舱左侧，快拿。',
  module: 'WEBER：模块在线。沿河谷撤，北风会从三面压过来。',
  valley: 'HAMMER：追兵进河谷了，边打边撤，别回头固守。',
  fuel: 'HAMMER：油料场。炸罐，挡住后面的装甲。',
  fuelBlown: 'HAMMER：油罐炸了。追兵被切断，继续往桥走。',
  lightning: 'WEBER：雷击点燃树冠！主路封死，改走浅滩右侧。',
  apc: 'HAMMER：装甲车从桥北压过来，不可摧毁，在它到之前登车！',
  exfil: 'HAMMER：接应到了。上车！',
};

export interface MissionApc {
  spawned: boolean;
  x: number;
  z: number;
  speed: number;
}

export interface MissionState {
  flags: Record<string, boolean>;
  nvOn: boolean;
  nvTaught: boolean;
  vegaHp: number;
  vegaRescued: boolean;
  moduleTaken: boolean;
  fuelBlown: boolean;
  routeBlocked: boolean;
  apc: MissionApc;
  zone: ZoneId;
  radio: string;
  checkpointId: string;
}

export function createMissionState(): MissionState {
  return {
    flags: {},
    nvOn: false,
    nvTaught: false,
    vegaHp: VEGA_MAX_HP,
    vegaRescued: false,
    moduleTaken: false,
    fuelBlown: false,
    routeBlocked: false,
    apc: { spawned: false, x: 0, z: -720, speed: APC_SPEED },
    zone: 'teach',
    radio: RADIO.wake,
    checkpointId: 'cp_spawn',
  };
}

export function zoneAt(z: number): ZoneId {
  for (const id of Object.keys(ZONES) as ZoneId[]) {
    const zone = ZONES[id];
    if (z <= zone.maxZ && z > zone.minZ) return id;
  }
  return z > ZONES.teach.maxZ ? 'teach' : 'bridge';
}

export function infiltrationMode(z: number): InfilMode {
  return z > STEALTH_UNTIL_Z ? 'stealth-or-combat' : 'combat';
}

export function setFlag(state: MissionState, id: string) {
  if (state.flags[id]) return false;
  state.flags[id] = true;
  return true;
}

export function toggleNightVision(state: MissionState) {
  state.nvOn = !state.nvOn;
  if (!state.nvTaught) {
    state.nvTaught = true;
    state.radio = RADIO.nvOn;
    setFlag(state, 'nvTaught');
  }
  return state.nvOn;
}

export function teachNightVision(state: MissionState) {
  if (state.nvTaught) return false;
  state.radio = RADIO.nvTeach;
  return true;
}

export function interactVega(state: MissionState, dist: number) {
  if (state.vegaRescued || state.vegaHp <= 0 || dist > VEGA_INTERACT_RANGE) return false;
  state.vegaRescued = true;
  state.radio = RADIO.vega;
  setFlag(state, 'vegaRescued');
  return true;
}

export function takeCommsModule(state: MissionState, dist: number) {
  if (state.moduleTaken || dist > MODULE_INTERACT_RANGE) return false;
  state.moduleTaken = true;
  state.radio = RADIO.module;
  setFlag(state, 'moduleTaken');
  return true;
}

export function hurtVega(state: MissionState, amount: number) {
  if (state.vegaRescued || state.vegaHp <= 0) return false;
  state.vegaHp = Math.max(0, state.vegaHp - amount);
  return state.vegaHp <= 0;
}

export function tickVegaThreat(state: MissionState, nearbyHostile: boolean, dt: number) {
  if (!nearbyHostile) return false;
  return hurtVega(state, 16 * dt);
}

export function triggerFuelBlast(state: MissionState, inFuelZone: boolean) {
  if (state.fuelBlown || !inFuelZone) return false;
  state.fuelBlown = true;
  state.radio = RADIO.fuelBlown;
  setFlag(state, 'fuelBlown');
  return true;
}

export function triggerLightningReroute(state: MissionState, inValleyB: boolean) {
  if (state.routeBlocked || !inValleyB) return false;
  state.routeBlocked = true;
  state.radio = RADIO.lightning;
  setFlag(state, 'routeBlocked');
  return true;
}

export function spawnApcPressure(state: MissionState, inBridge: boolean) {
  if (state.apc.spawned || !inBridge) return false;
  state.apc.spawned = true;
  state.apc.x = 0;
  state.apc.z = -720;
  state.apc.speed = APC_SPEED;
  state.radio = RADIO.apc;
  setFlag(state, 'apcSpawned');
  return true;
}

export function stepApc(state: MissionState, dt: number, _playerZ: number) {
  if (!state.apc.spawned) return state.apc;
  // The BTR advances north along the road only. It is a time pressure from
  // behind, not a pet that mirrors the player's movement.
  state.apc.z -= state.apc.speed * dt;
  return state.apc;
}

export function enterZone(state: MissionState, z: number) {
  const next = zoneAt(z);
  const changed = next !== state.zone;
  if (!changed) return { zone: next, entered: false, radio: state.radio };
  state.zone = next;
  const lines: Record<ZoneId, string> = {
    teach: RADIO.wake,
    road: RADIO.road,
    crash: RADIO.crash,
    valleyA: RADIO.valley,
    fuel: RADIO.fuel,
    valleyB: state.routeBlocked ? RADIO.lightning : RADIO.fuelBlown,
    bridge: RADIO.apc,
  };
  state.radio = lines[next];
  setFlag(state, `zone:${next}`);
  return { zone: next, entered: true, radio: state.radio };
}

export function checkpointForZone(zone: ZoneId) {
  const map: Record<ZoneId, string> = {
    teach: 'cp_spawn',
    road: 'cp_road',
    crash: 'cp_crash',
    valleyA: 'cp_valley',
    fuel: 'cp_fuel',
    valleyB: 'cp_valleyB',
    bridge: 'cp_bridge',
  };
  return map[zone];
}

export function restoreMissionStage(state: MissionState, checkpointId: string) {
  state.checkpointId = checkpointId;
  if (!state.vegaRescued || state.vegaHp <= 0) {
    state.vegaRescued = false;
    state.vegaHp = VEGA_MAX_HP;
    if (!state.flags.moduleTaken) state.moduleTaken = false;
  }
  return state;
}

export function shouldResetLivingEnemy(_baseZ: number) {
  return true;
}

export type RestoreEnemy = {
  alive: boolean;
  engaged: boolean;
  suspicion: number;
  lastSeenT: number;
  reactionT: number;
  baseX: number;
  baseZ: number;
  root?: { position: { x: number; z: number } };
};

export function applyCheckpointRestore(
  state: MissionState,
  checkpointId: string,
  enemies: RestoreEnemy[]
) {
  restoreMissionStage(state, checkpointId);
  for (const e of enemies) {
    if (!e.alive || !shouldResetLivingEnemy(e.baseZ)) continue;
    e.engaged = false;
    e.suspicion = 0;
    e.lastSeenT = 0;
    e.reactionT = 0.55;
    if (e.root) {
      e.root.position.x = e.baseX;
      e.root.position.z = e.baseZ;
    }
  }
  return state;
}
