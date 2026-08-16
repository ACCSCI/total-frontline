type NoiseBurst = (o: {
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  sweep?: number;
  gain?: number;
  atk?: number;
  dur?: number;
  delay?: number;
}) => void;

type ToneBurst = (o: {
  type?: OscillatorType;
  f0?: number;
  f1?: number;
  gain?: number;
  dur?: number;
  delay?: number;
  lp?: number;
}) => void;

export function playProceduralGunshot(
  weaponId: string,
  suppressed: boolean,
  noise: NoiseBurst,
  tone: ToneBurst
) {
  const ak = weaponId === 'ak12';
  let kind: 'rifle' | 'shotgun' | 'sniper' | 'pistol' = 'rifle';
  if (weaponId === 'ks12') kind = 'shotgun';
  else if (weaponId === 'sr7') kind = 'sniper';
  else if (weaponId === 'p9' || weaponId === 'pistol') kind = 'pistol';

  if (suppressed) {
    const pistol = kind === 'pistol';
    noise({
      type: 'bandpass',
      freq: pistol ? 1550 : kind === 'sniper' ? 880 : 1180,
      q: 0.9,
      gain: pistol ? 0.4 : 0.48,
      dur: pistol ? 0.042 : 0.055,
      atk: 0.0004,
    });
    noise({
      type: 'highpass',
      freq: pistol ? 2700 : 2100,
      q: 1.35,
      gain: 0.26,
      dur: 0.026,
      atk: 0.0003,
    });
    noise({
      type: 'lowpass',
      freq: pistol ? 200 : 150,
      gain: pistol ? 0.16 : 0.24,
      dur: 0.048,
      atk: 0.0008,
    });
    return;
  }

  if (kind === 'rifle') {
    noise({ type: 'highpass', freq: 4200, gain: 0.62, dur: 0.022, atk: 0.0004 });
    noise({ type: 'bandpass', freq: 2100, q: 0.7, gain: 0.9, dur: 0.14, atk: 0.001, sweep: 600 });
    noise({ type: 'lowpass', freq: 420, gain: 0.66, dur: 0.11, atk: 0.001 });
    tone({
      type: 'triangle',
      f0: ak ? 175 : 210,
      f1: ak ? 40 : 48,
      dur: 0.1,
      gain: ak ? 0.5 : 0.42,
    });
    tone({
      type: 'sine',
      f0: ak ? 68 : 82,
      f1: ak ? 32 : 38,
      dur: 0.14,
      gain: ak ? 0.42 : 0.34,
      lp: 200,
    });
    noise({ type: 'highpass', freq: 1400, gain: 0.1, dur: 0.42, atk: 0.02, delay: 0.02 });
    return;
  }
  if (kind === 'shotgun') {
    noise({ type: 'highpass', freq: 3600, gain: 0.5, dur: 0.026, atk: 0.0004 });
    noise({ type: 'lowpass', freq: 900, gain: 1.05, dur: 0.42, atk: 0.001, sweep: 170 });
    noise({ type: 'bandpass', freq: 1500, q: 0.6, gain: 0.6, dur: 0.12, atk: 0.001 });
    tone({ type: 'sine', f0: 110, f1: 30, dur: 0.32, gain: 0.72 });
    tone({ type: 'sine', f0: 62, f1: 28, dur: 0.2, gain: 0.4, lp: 150 });
    noise({ type: 'highpass', freq: 900, gain: 0.16, dur: 0.7, atk: 0.03, delay: 0.02 });
    return;
  }
  if (kind === 'sniper') {
    noise({ type: 'highpass', freq: 5200, gain: 0.85, dur: 0.014, atk: 0.0002 });
    noise({ type: 'highpass', freq: 3200, gain: 1, dur: 0.05, atk: 0.0005 });
    noise({ type: 'bandpass', freq: 1250, q: 0.5, gain: 1.05, dur: 0.3, atk: 0.0008, sweep: 340 });
    noise({ type: 'lowpass', freq: 260, gain: 0.95, dur: 0.24, atk: 0.001 });
    tone({ type: 'triangle', f0: 150, f1: 34, dur: 0.28, gain: 0.62 });
    tone({ type: 'sine', f0: 58, f1: 26, dur: 0.3, gain: 0.44, lp: 150 });
    noise({ type: 'bandpass', freq: 900, q: 0.8, gain: 0.3, dur: 1.25, atk: 0.05, delay: 0.05 });
    noise({ type: 'highpass', freq: 2200, gain: 0.14, dur: 0.85, atk: 0.03, delay: 0.02 });
    return;
  }
  noise({ type: 'highpass', freq: 4600, gain: 0.42, dur: 0.016, atk: 0.0003 });
  noise({ type: 'bandpass', freq: 1700, q: 1.1, gain: 0.7, dur: 0.11, atk: 0.001, sweep: 520 });
  noise({ type: 'lowpass', freq: 340, gain: 0.4, dur: 0.075, atk: 0.001 });
  tone({ type: 'square', f0: 280, f1: 70, dur: 0.06, gain: 0.24, lp: 1600 });
  tone({ type: 'sine', f0: 96, f1: 44, dur: 0.1, gain: 0.2, lp: 220 });
  noise({ type: 'highpass', freq: 1800, gain: 0.07, dur: 0.28, atk: 0.02, delay: 0.02 });
}
