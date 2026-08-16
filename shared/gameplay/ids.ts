/** Campaign ids → single-player family ids used by reload stages and fire rules. */
const FAMILY: Record<string, string> = {
  m4: 'rifle',
  ks12: 'shotgun',
  p9: 'pistol',
  sr7: 'sniper',
  ak12: 'ak',
  p90: 'p90',
  rifle: 'rifle',
  shotgun: 'shotgun',
  pistol: 'pistol',
  sniper: 'sniper',
  ak: 'ak',
  lmg: 'lmg',
  vector: 'vector',
  jug_gatling: 'jug_gatling',
};

export function weaponFamily(id: string) {
  return FAMILY[id] || id;
}

export function isShotgun(id: string) {
  return weaponFamily(id) === 'shotgun';
}
