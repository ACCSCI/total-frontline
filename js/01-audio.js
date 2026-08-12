'use strict';
/* =========================================================================
   1. AUDIO — 100% procedural Web Audio
   ========================================================================= */
const SFX = (() => {
  let ctx = null,
    master = null,
    noiseBuf = null,
    ready = false,
    ambNodes = [];
  let verbSend = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 9;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    /* -------------------------------------------------------------------
       Yard reverb.

       A dry gunshot sounds like a sound effect; the same shot with slapback
       off container walls sounds like it happened somewhere. The impulse is
       generated: a handful of discrete early reflections at plausible delays
       for 10-30m of steel, then an exponentially decaying diffuse tail.
       ------------------------------------------------------------------- */
    if (ctx.createConvolver) {
      const sr = ctx.sampleRate,
        ir = ctx.createBuffer(2, (sr * 1.6) | 0, sr);
      const echoes = [0.021, 0.037, 0.058, 0.081, 0.112, 0.147, 0.191, 0.244];
      for (let ch = 0; ch < 2; ch++) {
        const b = ir.getChannelData(ch);
        for (let i = 0; i < b.length; i++) {
          const t = i / sr;
          b[i] = (Math.random() * 2 - 1) * (1 - t / 1.6) ** 3.2 * 0.34;
        }
        echoes.forEach((e, k) => {
          const i = ((e + (ch ? 0.004 : 0)) * sr) | 0;
          const a = 0.62 * 0.72 ** k;
          for (let j = 0; j < 220; j++)
            if (i + j < b.length) b[i + j] += (Math.random() * 2 - 1) * a * (1 - j / 220);
        });
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      const wet = ctx.createGain();
      wet.gain.value = 0.6;
      verbSend = ctx.createGain();
      verbSend.gain.value = 1.0;
      verbSend.connect(hp);
      hp.connect(lp);
      lp.connect(conv);
      conv.connect(wet);
      wet.connect(master);
    }
    ready = true;
    startAmbient();
  }
  const T = () => ctx.currentTime;

  function panner(pan) {
    if (!ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }
  function chain(nodes, pan, out, verb) {
    let prev = null;
    for (const n of nodes) {
      if (prev) prev.connect(n);
      prev = n;
    }
    const p = pan ? panner(pan) : null;
    if (p) {
      prev.connect(p);
      prev = p;
    }
    prev.connect(out || master);
    if (verb && verbSend && !out) {
      const s = ctx.createGain();
      s.gain.value = verb;
      prev.connect(s);
      s.connect(verbSend);
    }
    return nodes[0];
  }
  /* burst of filtered noise */
  function noise(o) {
    if (!ready) return;
    const t0 = T() + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 1000;
    f.Q.value = o.q || 1;
    if (o.sweep)
      f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweep), t0 + (o.dur || 0.15));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.4), t0 + (o.atk || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    chain([src, f, g], o.pan, o.out, o.verb);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + (o.dur || 0.15) + 0.02);
  }
  /* tonal element */
  function tone(o) {
    if (!ready) return;
    const t0 = T() + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 200, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + (o.dur || 0.2));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.2), t0 + (o.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.2));
    const nodes = [osc, g];
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      nodes.splice(1, 0, f);
    }
    chain(nodes, o.pan, o.out, o.verb);
    osc.start(t0);
    osc.stop(t0 + (o.dur || 0.2) + 0.02);
  }

  /* ------------------------------ ambience ----------------------------- */
  function startAmbient() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.055;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();
    ambNodes.push(src);

    [46, 69, 103].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.016 / (i + 1);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.04 + i * 0.031;
      const lg = ctx.createGain();
      lg.gain.value = 0.009 / (i + 1);
      lfo.connect(lg);
      lg.connect(og.gain);
      o.connect(og);
      og.connect(master);
      o.start();
      lfo.start();
      ambNodes.push(o, lfo);
    });
    /* distant metal creaks */
    (function creak() {
      if (!ready) return;
      tone({
        type: 'sawtooth',
        f0: rand(90, 220),
        f1: rand(60, 130),
        dur: rand(0.7, 1.6),
        gain: 0.012,
        lp: 700,
        pan: rand(-0.9, 0.9),
      });
      setTimeout(creak, rand(6000, 15000));
    })();
  }

  /* ------------------------------ weapons ------------------------------
     gunshot() and boom() live in 01b-audio-weapons.js (600-line gate); they
     build on the two primitives below, exported on the SFX object itself. */
  /* squelch + carrier blip under a squad callout */
  function radio() {
    noise({ type: 'bandpass', freq: 2600, q: 3.2, gain: 0.055, dur: 0.045, atk: 0.001 });
    tone({ type: 'square', f0: 1180, f1: 1180, dur: 0.028, gain: 0.028, lp: 3000, delay: 0.03 });
    noise({
      type: 'bandpass',
      freq: 1800,
      q: 2.0,
      gain: 0.03,
      dur: 0.09,
      atk: 0.004,
      delay: 0.055,
    });
  }
  function dryFire() {
    tone({ type: 'square', f0: 1500, f1: 700, dur: 0.035, gain: 0.1, lp: 4000 });
    noise({ type: 'highpass', freq: 3000, gain: 0.1, dur: 0.04 });
  }

  function magOut() {
    noise({ type: 'bandpass', freq: 2300, q: 2, gain: 0.2, dur: 0.07 });
    tone({ type: 'square', f0: 520, f1: 300, dur: 0.05, gain: 0.07, lp: 2500 });
  }
  function magIn() {
    noise({ type: 'lowpass', freq: 1300, gain: 0.3, dur: 0.09, atk: 0.001 });
    tone({ type: 'square', f0: 240, f1: 120, dur: 0.07, gain: 0.1, lp: 1800 });
  }
  function boltClick() {
    noise({ type: 'highpass', freq: 3200, gain: 0.24, dur: 0.05, atk: 0.001 });
    tone({ type: 'square', f0: 1100, f1: 600, dur: 0.04, gain: 0.08, lp: 5000 });
  }
  function pumpSound(back) {
    noise({ type: 'bandpass', freq: back ? 1500 : 2600, q: 2.2, gain: 0.3, dur: 0.09, atk: 0.001 });
    tone({
      type: 'square',
      f0: back ? 380 : 820,
      f1: back ? 200 : 420,
      dur: 0.06,
      gain: 0.09,
      lp: 3000,
    });
  }
  /* phase 0 = lift+pull, 1 = push+lock */
  function boltCycle(phase) {
    if (phase === 0) {
      noise({ type: 'bandpass', freq: 2900, q: 3.0, gain: 0.26, dur: 0.05, atk: 0.001 });
      noise({
        type: 'bandpass',
        freq: 1250,
        q: 1.6,
        gain: 0.3,
        dur: 0.16,
        atk: 0.004,
        sweep: -420,
        delay: 0.05,
      });
      tone({ type: 'square', f0: 520, f1: 250, dur: 0.1, gain: 0.07, lp: 2600, delay: 0.04 });
    } else {
      noise({
        type: 'bandpass',
        freq: 1500,
        q: 1.8,
        gain: 0.26,
        dur: 0.11,
        atk: 0.003,
        sweep: 600,
      });
      noise({ type: 'highpass', freq: 3400, gain: 0.3, dur: 0.05, atk: 0.0008, delay: 0.09 });
      tone({ type: 'square', f0: 900, f1: 420, dur: 0.05, gain: 0.09, lp: 4200, delay: 0.09 });
    }
  }
  function shellDrop(pan) {
    noise({ type: 'bandpass', freq: rand(3000, 5200), q: 6, gain: 0.1, dur: 0.09, pan });
    tone({
      type: 'triangle',
      f0: rand(1500, 2600),
      f1: rand(700, 1200),
      dur: 0.1,
      gain: 0.045,
      pan,
    });
  }
  function footstep(vol, pan) {
    noise({
      type: 'lowpass',
      freq: rand(380, 620),
      gain: 0.16 * vol,
      dur: 0.075,
      atk: 0.002,
      rate: rand(0.85, 1.15),
      pan,
    });
    noise({ type: 'highpass', freq: rand(2400, 4200), gain: 0.045 * vol, dur: 0.035, pan });
  }
  function jumpSound() {
    noise({ type: 'lowpass', freq: 500, gain: 0.1, dur: 0.09 });
  }
  function landSound(f) {
    noise({ type: 'lowpass', freq: 300, gain: 0.1 + 0.28 * f, dur: 0.16, atk: 0.002 });
    tone({ type: 'sine', f0: 110, f1: 44, dur: 0.13, gain: 0.14 * f });
  }
  function impactWall(pan, dist) {
    const v = clamp(1 - dist / 60, 0.15, 1);
    noise({
      type: 'bandpass',
      freq: rand(2200, 3800),
      q: 2.5,
      gain: 0.26 * v,
      dur: 0.07,
      atk: 0.001,
      pan,
    });
    noise({ type: 'lowpass', freq: 700, gain: 0.14 * v, dur: 0.09, pan });
    if (Math.random() < 0.28)
      tone({
        type: 'sine',
        f0: rand(2400, 3400),
        f1: rand(700, 1100),
        dur: 0.3,
        gain: 0.05 * v,
        pan,
      });
  }
  function impactFlesh(pan, dist) {
    const v = clamp(1 - dist / 60, 0.2, 1);
    noise({ type: 'lowpass', freq: rand(250, 420), gain: 0.42 * v, dur: 0.13, atk: 0.001, pan });
    tone({ type: 'sine', f0: 160, f1: 60, dur: 0.1, gain: 0.16 * v, pan });
  }
  function hitBeep(head) {
    tone({ type: 'sine', f0: head ? 1900 : 1350, dur: 0.045, gain: 0.13 });
    if (head) tone({ type: 'sine', f0: 2550, dur: 0.05, gain: 0.11, delay: 0.045 });
  }
  function killChime() {
    tone({ type: 'sine', f0: 900, dur: 0.07, gain: 0.11 });
    tone({ type: 'sine', f0: 1350, dur: 0.11, gain: 0.11, delay: 0.06 });
  }
  function enemyDeath(pan, dist) {
    const v = clamp(1 - dist / 50, 0.15, 1);
    tone({
      type: 'sawtooth',
      f0: rand(240, 330),
      f1: rand(60, 95),
      dur: 0.55,
      gain: 0.13 * v,
      lp: 1100,
      pan,
    });
    noise({ type: 'lowpass', freq: 500, gain: 0.22 * v, dur: 0.35, atk: 0.03, pan, delay: 0.18 });
  }
  function heartbeat() {
    tone({ type: 'sine', f0: 62, f1: 34, dur: 0.16, gain: 0.42, lp: 180 });
    tone({ type: 'sine', f0: 52, f1: 30, dur: 0.2, gain: 0.3, lp: 180, delay: 0.2 });
  }
  function damageTaken() {
    noise({ type: 'lowpass', freq: 220, gain: 0.3, dur: 0.2, atk: 0.002 });
    tone({ type: 'sine', f0: 150, f1: 52, dur: 0.22, gain: 0.2 });
  }
  function alarm(win) {
    if (win) {
      [660, 880, 1320].forEach((f, i) => {
        tone({ type: 'square', f0: f, dur: 0.24, gain: 0.1, lp: 3000, delay: i * 0.13 });
      });
    } else {
      [420, 330, 220].forEach((f, i) => {
        tone({
          type: 'sawtooth',
          f0: f,
          f1: f * 0.6,
          dur: 0.5,
          gain: 0.11,
          lp: 1200,
          delay: i * 0.22,
        });
      });
    }
  }
  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return {
    init,
    /* shared with 01b-audio-weapons.js, which attaches gunshot/boom */
    _noise: noise,
    _tone: tone,
    _ok: () => ready,
    radio,
    dryFire,
    magOut,
    magIn,
    boltClick,
    pumpSound,
    boltCycle,
    shellDrop,
    footstep,
    jumpSound,
    landSound,
    impactWall,
    impactFlesh,
    hitBeep,
    killChime,
    enemyDeath,
    heartbeat,
    damageTaken,
    alarm,
    suspend,
    resume,
  };
})();
