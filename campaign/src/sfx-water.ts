type NoiseBurst = (o: {
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  gain?: number;
  dur?: number;
  atk?: number;
  pan?: number;
}) => void;

export function installWaterSfx(noise: NoiseBurst) {
  function waterStep(vol: number, pan: number) {
    noise({
      type: 'bandpass',
      freq: 1100 + Math.random() * 700,
      q: 1.1,
      gain: 0.17 * vol,
      dur: 0.085,
      atk: 0.0015,
      pan,
    });
    noise({
      type: 'highpass',
      freq: 3200 + Math.random() * 1600,
      q: 1.4,
      gain: 0.06 * vol,
      dur: 0.04,
      atk: 0.001,
      pan,
    });
  }

  function waterImpact(pan: number, dist: number) {
    const vol = Math.max(0.05, 0.55 / (1 + (Math.max(0, dist) / 12) ** 1.5));
    waterStep(vol, pan);
    noise({
      type: 'lowpass',
      freq: 600,
      gain: 0.2 * vol,
      dur: 0.14,
      atk: 0.001,
      pan,
    });
  }

  return { waterStep, waterImpact };
}
