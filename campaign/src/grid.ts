export function gridFootprint(
  cx: number,
  cz: number,
  hw: number,
  hd: number,
  steps = 5
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let ix = 0; ix < steps; ix++) {
    for (let iz = 0; iz < steps; iz++) {
      out.push([cx - hw + (ix / (steps - 1)) * hw * 2, cz - hd + (iz / (steps - 1)) * hd * 2]);
    }
  }
  return out;
}
