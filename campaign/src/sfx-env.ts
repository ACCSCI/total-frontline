/* Campaign ambience: close rain bed, wind and forest air. Extracted from
   sfx.ts so the one-shot weapon bus stays under the file-size gate. */

type NoiseSource = (rate?: number) => AudioBufferSourceNode | null;
type Panner = (pan: number) => StereoPannerNode | null;

export function installAmbience(
  ctx: AudioContext,
  master: GainNode,
  noiseSource: NoiseSource,
  panner: Panner
) {
  const addRain = () => {
    for (let i = 0; i < 4; i++) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 360 + i * 130;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1300 + i * 320;
      lp.Q.value = 0.45;
      const g = ctx.createGain();
      g.gain.value = 0.02 + i * 0.005;
      const src = noiseSource(0.83 + Math.random() * 0.31);
      if (!src) continue;
      src.connect(hp);
      hp.connect(lp);
      lp.connect(g);
      const pan = panner(-0.5 + i * 0.32 + (Math.random() - 0.5) * 0.2);
      if (pan) {
        g.connect(pan);
        pan.connect(master);
      } else {
        g.connect(master);
      }
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11 + i * 0.067 + Math.random() * 0.05;
      const amt = ctx.createGain();
      amt.gain.value = 0.011 + i * 0.003;
      lfo.connect(amt);
      amt.connect(g.gain);
      src.start();
      lfo.start();
    }
  };

  const addWind = () => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 340;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.055;
    const src = noiseSource(0.63);
    if (!src) return;
    src.connect(bp);
    bp.connect(g);
    const pan = panner(0);
    if (pan) {
      g.connect(pan);
      pan.connect(master);
    } else {
      g.connect(master);
    }
    const fLfo = ctx.createOscillator();
    fLfo.frequency.value = 0.05;
    const fAmt = ctx.createGain();
    fAmt.gain.value = 170;
    fLfo.connect(fAmt);
    fAmt.connect(bp.frequency);
    const pLfo = ctx.createOscillator();
    pLfo.frequency.value = 0.083;
    const pAmt = ctx.createGain();
    pAmt.gain.value = 0.6;
    pLfo.connect(pAmt);
    if (pan) pAmt.connect(pan.pan);
    const aLfo = ctx.createOscillator();
    aLfo.frequency.value = 0.11;
    const aAmt = ctx.createGain();
    aAmt.gain.value = 0.022;
    aLfo.connect(aAmt);
    aAmt.connect(g.gain);
    src.start();
    fLfo.start();
    pLfo.start();
    aLfo.start();
  };

  const addAir = () => {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    const src = noiseSource(0.8);
    if (!src) return;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();
  };

  addRain();
  addWind();
  addAir();
}
