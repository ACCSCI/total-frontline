import weaponsData from '../../shared/weapons.json';

export interface WeaponDef {
  id: string;
  name: string;
  sound: string;
  magSize: number;
  reserve: number;
  maxReserve: number;
  damage: number;
  baseDamage: number;
  headMult: number;
  pellets: number;
  rpm: number;
  auto: boolean;
  semiToggle: boolean;
  pumpTime?: number;
  boltTime?: number;
  campaignReserve?: number;
  spreadBase: number;
  spreadMax: number;
  spreadShot: number;
  spreadRecover: number;
  moveSpread: number;
  airSpread: number;
  crouchMult: number;
  recoilKick: number;
  recoilRot: number;
  camPitch: number;
  camYaw: number;
  adsRecoil: number;
  fovKick: number;
  reloadTime: number;
  tacticalReloadTime: number;
  drawTime: number;
  shakeAmt: number;
  range: number;
  falloffStart: number;
  falloffRange: number;
  falloffMin: number;
  adsFov: number;
  adsSpread: number;
  adsTime: number;
  scope?: boolean;
  noise: number;
  shellBig: boolean;
}

const rawWeapons = weaponsData.weapons as unknown as Record<
  string,
  Partial<WeaponDef> & { legacyId?: string }
>;

export const PRIMARY_WEAPONS: Record<string, WeaponDef> = {};
for (const [id, w] of Object.entries(rawWeapons)) {
  PRIMARY_WEAPONS[id] = {
    ...w,
    id,
    name: w.name ?? id,
    sound: w.sound ?? id,
    magSize: w.magSize ?? 30,
    reserve: w.campaignReserve ?? w.reserve ?? 120,
    maxReserve: w.maxReserve ?? w.reserve ?? 120,
    damage: w.damage ?? 25,
    baseDamage: w.damage ?? 25,
    headMult: w.headMult ?? 1.8,
    pellets: w.pellets ?? 1,
    rpm: w.rpm ?? 700,
    auto: w.auto ?? false,
    semiToggle: w.semiToggle ?? false,
    spreadBase: w.spreadBase ?? 0.0055,
    spreadMax: w.spreadMax ?? 0.06,
    spreadShot: w.spreadShot ?? 0.005,
    spreadRecover: w.spreadRecover ?? 0.08,
    moveSpread: w.moveSpread ?? 0.01,
    airSpread: w.airSpread ?? 0.02,
    crouchMult: w.crouchMult ?? 0.65,
    recoilKick: w.recoilKick ?? 0.04,
    recoilRot: w.recoilRot ?? 0.06,
    camPitch: w.camPitch ?? 0.012,
    camYaw: w.camYaw ?? 0.005,
    adsRecoil: w.adsRecoil ?? 0.55,
    fovKick: w.fovKick ?? 0.6,
    reloadTime: w.reloadTime ?? 1.5,
    tacticalReloadTime: w.tacticalReloadTime ?? (w.reloadTime ?? 1.5) * 0.78,
    drawTime: w.drawTime ?? 0.3,
    shakeAmt: w.shakeAmt ?? 0.2,
    range: w.range ?? 120,
    falloffStart: w.falloffStart ?? 40,
    falloffRange: w.falloffRange ?? 50,
    falloffMin: w.falloffMin ?? 0.5,
    adsFov: w.adsFov ?? 50,
    adsSpread: w.adsSpread ?? 0.4,
    adsTime: w.adsTime ?? 0.2,
    noise: w.noise ?? 34,
    shellBig: w.shellBig ?? false,
  };
}
