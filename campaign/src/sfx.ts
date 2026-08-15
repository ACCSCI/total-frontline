/* ---------------------------------------------------------------------------
   P0 procedural environment audio — same philosophy as the main game's
   `01-audio.ts`: 100% Web Audio synthesis, zero audio files.

   Layers for the black-forest valley:
   - close rain bed (two decorrelated noise voices)
   - wind with slow filter/pan drift
   - forest air rumble
   - generated thunder (low sweep + crack), scheduled on its own clock
   ------------------------------------------------------------------------- */

const SFX = (() => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let ready = false;
  let thunderNext = 14;
  let rainDropNext = 0.1;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 2;
    comp.ratio.value = 10;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    startAmbience();
    ready = true;
  }

  function noiseSource(rate = 1) {
    if (!ctx || !noiseBuf) return null;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    return src;
  }

  function panner(pan: number) {
    if (!ctx?.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  }

  /* Close rain: four independent noise voices, each with its own playback rate,
     filter centre and slow amplitude LFO. The incommensurate LFO rates break up
     the looped-buffer periodicity that made the first pass sound machine-like.
     On top of the beds, update() sprinkles random droplet transients. */
  function addRain() {
    if (!ctx || !master) return;
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
  }

  /* Wind: a moving band of noise whose centre and stereo position drift. */
  function addWind() {
    if (!ctx || !master) return;
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
  }

  /* Forest air: very low filtered noise so the scene never sounds dead. */
  function addAir() {
    if (!ctx || !master) return;
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
  }

  function startAmbience() {
    addRain();
    addWind();
    addAir();
  }

  /* One-shot filtered noise burst, same shape as the main game's SFX.noise. */
  function noiseBurst(o: {
    type?: BiquadFilterType;
    freq?: number;
    q?: number;
    sweep?: number;
    gain?: number;
    atk?: number;
    dur?: number;
    delay?: number;
    rate?: number;
    pan?: number;
  }) {
    if (!ctx || !master || !noiseBuf) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 0.82 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 800, t0);
    if (o.sweep)
      f.frequency.exponentialRampToValueAtTime(Math.max(30, o.sweep), t0 + (o.dur || 0.4));
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.2), t0 + (o.atk || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.4));
    src.connect(f);
    f.connect(g);
    const pan = panner(o.pan || 0);
    if (pan) {
      g.connect(pan);
      pan.connect(master);
    } else {
      g.connect(master);
    }
    src.start(t0, Math.random());
    src.stop(t0 + (o.dur || 0.4) + 0.05);
  }

  /* Ported from the main game's SFX.footstep: two noise layers, no samples. */
  function footstep(vol: number, pan: number) {
    noiseBurst({
      type: 'lowpass',
      freq: 380 + Math.random() * 240,
      gain: 0.16 * vol,
      dur: 0.075,
      atk: 0.002,
      rate: 0.85 + Math.random() * 0.3,
      pan,
    });
    noiseBurst({
      type: 'highpass',
      freq: 2400 + Math.random() * 1800,
      gain: 0.045 * vol,
      dur: 0.035,
      atk: 0.001,
      pan,
    });
  }

  function toneBurst(o: {
    f0?: number;
    f1?: number;
    gain?: number;
    dur?: number;
    type?: OscillatorType;
    delay?: number;
    lp?: number;
  }) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 120, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + (o.dur || 1.2));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.1), t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 1.2));
    osc.connect(g);
    if (o.lp) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      g.connect(lp);
      lp.connect(master);
    } else {
      g.connect(master);
    }
    osc.start(t0);
    osc.stop(t0 + (o.dur || 1.2) + 0.05);
  }

  /* Storm cell: low pressure wave, then a bright crack. intensity 1 = ambient,
     1.25+ = the visual lightning strike. */
  function thunder(intensity = 1) {
    noiseBurst({
      type: 'lowpass',
      freq: 300,
      sweep: 46,
      q: 0.4,
      gain: 0.85 * intensity,
      atk: 0.12,
      dur: 2.8,
      delay: 0.05,
    });
    toneBurst({ f0: 68, f1: 28, gain: 0.3 * intensity, dur: 2.6, type: 'sine' });
    noiseBurst({
      type: 'bandpass',
      freq: 1500,
      sweep: 300,
      q: 0.7,
      gain: 0.34 * intensity,
      atk: 0.002,
      dur: 0.9,
      delay: 0.45 + Math.random() * 0.2,
    });
    noiseBurst({
      type: 'highpass',
      freq: 3200,
      gain: 0.16 * intensity,
      dur: 0.12,
      atk: 0.0008,
      delay: 0.52 + Math.random() * 0.2,
    });
  }

  /* Typewriter / cinematic reveal layers for the intro briefing. */
  function typeKey() {
    noiseBurst({
      type: 'bandpass',
      freq: 2600 + Math.random() * 2400,
      q: 6,
      gain: 0.04,
      dur: 0.016,
      atk: 0.0004,
      pan: (Math.random() * 2 - 1) * 0.12,
    });
    noiseBurst({
      type: 'highpass',
      freq: 5200,
      gain: 0.016,
      dur: 0.009,
      atk: 0.0003,
    });
  }

  function lineConfirm() {
    toneBurst({ f0: 640, f1: 430, gain: 0.05, dur: 0.07, type: 'square' });
    noiseBurst({ type: 'bandpass', freq: 900, q: 2.5, gain: 0.03, dur: 0.05 });
  }

  function revealHit() {
    toneBurst({ f0: 120, f1: 36, gain: 0.3, dur: 1.5, type: 'sine' });
    noiseBurst({ type: 'lowpass', freq: 420, sweep: 70, gain: 0.24, dur: 1.4, atk: 0.02 });
  }

  function explosion() {
    noiseBurst({ type: 'lowpass', freq: 500, sweep: 60, gain: 0.5, dur: 0.9, atk: 0.006 });
    toneBurst({ f0: 90, f1: 28, gain: 0.24, dur: 0.8, type: 'sine' });
    noiseBurst({ type: 'highpass', freq: 2200, gain: 0.14, dur: 0.16, atk: 0.001, delay: 0.03 });
  }

  function flashbang() {
    toneBurst({ f0: 1500, f1: 700, gain: 0.09, dur: 0.55, type: 'sine' });
    toneBurst({ f0: 2200, f1: 900, gain: 0.07, dur: 0.45, type: 'sine', delay: 0.02 });
  }

  function magOut() {
    noiseBurst({ type: 'bandpass', freq: 2300, q: 2, gain: 0.32, dur: 0.09 });
    toneBurst({ type: 'square', f0: 620, f1: 260, dur: 0.065, gain: 0.12, lp: 2600 });
    noiseBurst({ type: 'lowpass', freq: 700, gain: 0.18, dur: 0.08, delay: 0.055 });
  }

  function magIn() {
    noiseBurst({ type: 'lowpass', freq: 1500, gain: 0.42, dur: 0.11, atk: 0.001 });
    toneBurst({ type: 'square', f0: 310, f1: 105, dur: 0.085, gain: 0.16, lp: 1900 });
    noiseBurst({ type: 'highpass', freq: 2600, gain: 0.15, dur: 0.035, delay: 0.065 });
  }

  function boltClick() {
    noiseBurst({ type: 'highpass', freq: 3200, gain: 0.24, dur: 0.05, atk: 0.001 });
    toneBurst({ type: 'square', f0: 1100, f1: 600, dur: 0.04, gain: 0.08, lp: 5000 });
  }

  function dryFire() {
    toneBurst({ type: 'square', f0: 1500, f1: 700, dur: 0.035, gain: 0.1, lp: 4000 });
    noiseBurst({ type: 'highpass', freq: 3000, gain: 0.1, dur: 0.04 });
  }

  function pumpSound(back: boolean) {
    noiseBurst({
      type: 'bandpass',
      freq: back ? 1500 : 2600,
      q: 2.2,
      gain: 0.3,
      dur: 0.09,
      atk: 0.001,
    });
    toneBurst({
      type: 'square',
      f0: back ? 380 : 820,
      f1: back ? 200 : 420,
      dur: 0.06,
      gain: 0.09,
      lp: 3000,
    });
  }

  function boltCycle(phase: number) {
    if (phase === 0) {
      noiseBurst({ type: 'bandpass', freq: 2900, q: 3, gain: 0.26, dur: 0.05, atk: 0.001 });
      noiseBurst({
        type: 'bandpass',
        freq: 1250,
        q: 1.6,
        gain: 0.3,
        dur: 0.16,
        atk: 0.004,
        sweep: 830,
        delay: 0.05,
      });
      toneBurst({ type: 'square', f0: 520, f1: 250, dur: 0.1, gain: 0.07, lp: 2600, delay: 0.04 });
    } else {
      noiseBurst({
        type: 'bandpass',
        freq: 1500,
        q: 1.8,
        gain: 0.26,
        dur: 0.11,
        atk: 0.003,
        sweep: 2100,
      });
      noiseBurst({ type: 'highpass', freq: 3400, gain: 0.3, dur: 0.05, atk: 0.0008, delay: 0.09 });
      toneBurst({ type: 'square', f0: 900, f1: 420, dur: 0.05, gain: 0.09, lp: 4200, delay: 0.09 });
    }
  }

  function reloadStage(weaponId: string, stage: 'lift' | 'out' | 'in' | 'action') {
    if (stage === 'out') magOut();
    else if (stage === 'in') magIn();
    else if (stage === 'action') boltClick();
    else weaponSwap();
  }

  function gunshot(weaponId = 'm4') {
    const ak = weaponId === 'ak12';
    let kind: 'rifle' | 'shotgun' | 'sniper' | 'pistol' = 'rifle';
    if (weaponId === 'ks12') kind = 'shotgun';
    else if (weaponId === 'sr7') kind = 'sniper';
    else if (weaponId === 'p9') kind = 'pistol';

    if (kind === 'rifle') {
      noiseBurst({ type: 'highpass', freq: 4200, gain: 0.62, dur: 0.022, atk: 0.0004 });
      noiseBurst({
        type: 'bandpass',
        freq: 2100,
        q: 0.7,
        gain: 0.9,
        dur: 0.14,
        atk: 0.001,
        sweep: 600,
      });
      noiseBurst({ type: 'lowpass', freq: 420, gain: 0.66, dur: 0.11, atk: 0.001 });
      toneBurst({
        type: 'triangle',
        f0: ak ? 175 : 210,
        f1: ak ? 40 : 48,
        dur: 0.1,
        gain: ak ? 0.5 : 0.42,
      });
      toneBurst({
        type: 'sine',
        f0: ak ? 68 : 82,
        f1: ak ? 32 : 38,
        dur: 0.14,
        gain: ak ? 0.42 : 0.34,
        lp: 200,
      });
      noiseBurst({ type: 'highpass', freq: 1400, gain: 0.1, dur: 0.42, atk: 0.02, delay: 0.02 });
    } else if (kind === 'shotgun') {
      noiseBurst({ type: 'highpass', freq: 3600, gain: 0.5, dur: 0.026, atk: 0.0004 });
      noiseBurst({ type: 'lowpass', freq: 900, gain: 1.05, dur: 0.42, atk: 0.001, sweep: 170 });
      noiseBurst({ type: 'bandpass', freq: 1500, q: 0.6, gain: 0.6, dur: 0.12, atk: 0.001 });
      toneBurst({ type: 'sine', f0: 110, f1: 30, dur: 0.32, gain: 0.72 });
      toneBurst({ type: 'sine', f0: 62, f1: 28, dur: 0.2, gain: 0.4, lp: 150 });
      noiseBurst({ type: 'highpass', freq: 900, gain: 0.16, dur: 0.7, atk: 0.03, delay: 0.02 });
    } else if (kind === 'sniper') {
      noiseBurst({ type: 'highpass', freq: 5200, gain: 0.85, dur: 0.014, atk: 0.0002 });
      noiseBurst({ type: 'highpass', freq: 3200, gain: 1, dur: 0.05, atk: 0.0005 });
      noiseBurst({
        type: 'bandpass',
        freq: 1250,
        q: 0.5,
        gain: 1.05,
        dur: 0.3,
        atk: 0.0008,
        sweep: 340,
      });
      noiseBurst({ type: 'lowpass', freq: 260, gain: 0.95, dur: 0.24, atk: 0.001 });
      toneBurst({ type: 'triangle', f0: 150, f1: 34, dur: 0.28, gain: 0.62 });
      toneBurst({ type: 'sine', f0: 58, f1: 26, dur: 0.3, gain: 0.44, lp: 150 });
      noiseBurst({
        type: 'bandpass',
        freq: 900,
        q: 0.8,
        gain: 0.3,
        dur: 1.25,
        atk: 0.05,
        delay: 0.05,
      });
      noiseBurst({ type: 'highpass', freq: 2200, gain: 0.14, dur: 0.85, atk: 0.03, delay: 0.02 });
    } else {
      noiseBurst({ type: 'highpass', freq: 4600, gain: 0.42, dur: 0.016, atk: 0.0003 });
      noiseBurst({
        type: 'bandpass',
        freq: 1700,
        q: 1.1,
        gain: 0.7,
        dur: 0.11,
        atk: 0.001,
        sweep: 520,
      });
      noiseBurst({ type: 'lowpass', freq: 340, gain: 0.4, dur: 0.075, atk: 0.001 });
      toneBurst({ type: 'square', f0: 280, f1: 70, dur: 0.06, gain: 0.24, lp: 1600 });
      toneBurst({ type: 'sine', f0: 96, f1: 44, dur: 0.1, gain: 0.2, lp: 220 });
      noiseBurst({ type: 'highpass', freq: 1800, gain: 0.07, dur: 0.28, atk: 0.02, delay: 0.02 });
    }
  }

  function enemyShot() {
    noiseBurst({ type: 'lowpass', freq: 900, sweep: 180, gain: 0.24, dur: 0.18, atk: 0.002 });
    toneBurst({ f0: 150, f1: 58, gain: 0.1, dur: 0.14, type: 'sine' });
  }

  function enemyDown() {
    toneBurst({ f0: 210, f1: 58, gain: 0.14, dur: 0.34, type: 'sine' });
    noiseBurst({ type: 'lowpass', freq: 620, sweep: 120, gain: 0.16, dur: 0.3, atk: 0.004 });
  }

  function jump() {
    noiseBurst({ type: 'lowpass', freq: 500, gain: 0.1, dur: 0.09 });
  }

  function weaponSwap() {
    noiseBurst({ type: 'lowpass', freq: 820, gain: 0.24, dur: 0.11 });
    toneBurst({ type: 'square', f0: 280, f1: 95, dur: 0.07, gain: 0.1, lp: 1700, delay: 0.045 });
  }

  function update(dt: number) {
    if (!ready || !ctx) return;

    /* Non-periodic droplet transients break up the rain-bed texture. */
    rainDropNext -= dt;
    if (rainDropNext <= 0) {
      rainDropNext = 0.025 + Math.random() * 0.085;
      const drops = Math.random() < 0.32 ? 2 : 1;
      for (let i = 0; i < drops; i++) {
        noiseBurst({
          type: 'bandpass',
          freq: 2800 + Math.random() * 4200,
          q: 7 + Math.random() * 4,
          gain: 0.012 + Math.random() * 0.03,
          dur: 0.022 + Math.random() * 0.03,
          atk: 0.0006,
          delay: Math.random() * 0.05,
          pan: (Math.random() * 2 - 1) * 0.85,
        });
      }
    }

    /* Occasional distant storm cells; visual lightning is triggered separately
       by the level so the bright flash and the loud crack land together. */
    thunderNext -= dt;
    if (thunderNext <= 0) {
      thunderNext = 18 + Math.random() * 20;
      thunder(0.45 + Math.random() * 0.3);
    }
  }

  return {
    init,
    update,
    thunder,
    footstep,
    typeKey,
    lineConfirm,
    revealHit,
    explosion,
    flashbang,
    gunshot,
    enemyShot,
    enemyDown,
    jump,
    reloadStage,
    dryFire,
    pumpSound,
    boltCycle,
    boltClick,
    weaponSwap,
  };
})();

export { SFX };
