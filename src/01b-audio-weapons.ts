'use strict';
/* =========================================================================
   1b. WEAPON REPORTS — split out of 01-audio.js to keep every file under the
   600-line gate. Everything here is built on the noise/tone primitives the
   audio core exposes as SFX._noise / SFX._tone.
   ========================================================================= */
SFX.gunshot = (() => {
  const noise = (o) => SFX._noise(o);
  const tone = (o) => SFX._tone(o);

  function gunshot(kind, pan, dist) {
    if (!SFX._ok()) return;
    /* The sampled AK has its own 7.62-style transient. If samples are not
       available, retain the proven procedural rifle stack at a slightly
       lower pitch/body balance instead of falling through to the pistol. */
    const ak = kind === 'ak', smg = kind === 'vector' || kind === 'p90';
    if (ak || smg) kind = 'rifle';
    dist = dist || 0;
    const vol = SFX._weaponDistanceGain(dist);
    const delay = dist / 340;
    if (kind === 'rifle') {
      /* transient stack: a hard crack, a mid body and a chest thump. The
         sub-100Hz layer is what makes a shot feel like it has recoil. */
      noise({
        type: 'highpass',
        freq: 4200,
        gain: 0.62 * vol,
        dur: 0.022,
        atk: 0.0004,
        pan,
        delay,
      });
      noise({
        freq: 2100,
        q: 0.7,
        gain: 0.9 * vol,
        dur: 0.14,
        atk: 0.001,
        sweep: 600,
        pan,
        delay,
        verb: 0.55,
      });
      noise({
        type: 'lowpass',
        freq: 420,
        gain: 0.66 * vol,
        dur: 0.11,
        atk: 0.001,
        pan,
        delay,
        verb: 0.35,
      });
      tone({
        type: 'triangle',
        f0: ak ? 175 : 210,
        f1: ak ? 40 : 48,
        dur: 0.1,
        gain: (ak ? 0.5 : 0.42) * vol,
        pan,
        delay,
      });
      tone({
        type: 'sine',
        f0: ak ? 68 : 82,
        f1: ak ? 32 : 38,
        dur: 0.14,
        gain: (ak ? 0.42 : 0.34) * vol,
        lp: 200,
        pan,
        delay,
      });
      noise({
        type: 'highpass',
        freq: 1400,
        gain: 0.1 * vol,
        dur: 0.42,
        atk: 0.02,
        pan,
        delay: delay + 0.02,
      });
    } else if (kind === 'lmg') {
      /* bigger and slower than the rifle: more chest, less crack */
      noise({ type: 'highpass', freq: 3600, gain: 0.5 * vol, dur: 0.026, atk: 0.0004, pan, delay });
      noise({
        freq: 1600,
        q: 0.7,
        gain: 1.0 * vol,
        dur: 0.17,
        atk: 0.001,
        sweep: 420,
        pan,
        delay,
        verb: 0.6,
      });
      noise({
        type: 'lowpass',
        freq: 320,
        gain: 0.8 * vol,
        dur: 0.15,
        atk: 0.001,
        pan,
        delay,
        verb: 0.4,
      });
      tone({ type: 'triangle', f0: 160, f1: 40, dur: 0.13, gain: 0.5 * vol, pan, delay });
      tone({ type: 'sine', f0: 68, f1: 32, dur: 0.18, gain: 0.42 * vol, lp: 180, pan, delay });
    } else if (kind === 'shotgun') {
      noise({ type: 'highpass', freq: 3600, gain: 0.5 * vol, dur: 0.026, atk: 0.0004, pan, delay });
      noise({
        type: 'lowpass',
        freq: 900,
        gain: 1.05 * vol,
        dur: 0.42,
        atk: 0.001,
        sweep: 170,
        pan,
        delay,
        verb: 0.75,
      });
      noise({ freq: 1500, q: 0.6, gain: 0.6 * vol, dur: 0.12, atk: 0.001, pan, delay });
      tone({ type: 'sine', f0: 110, f1: 30, dur: 0.32, gain: 0.72 * vol, pan, delay });
      tone({ type: 'sine', f0: 62, f1: 28, dur: 0.2, gain: 0.4 * vol, lp: 150, pan, delay });
      noise({
        type: 'highpass',
        freq: 900,
        gain: 0.16 * vol,
        dur: 0.7,
        atk: 0.03,
        pan,
        delay: delay + 0.02,
      });
    } else if (kind === 'sniper') {
      /* a supersonic crack over a deep body, plus a long tail that keeps
         ringing after the transient — reads as much louder than the rifle */
      noise({
        type: 'highpass',
        freq: 5200,
        gain: 0.85 * vol,
        dur: 0.014,
        atk: 0.0002,
        pan,
        delay,
      });
      noise({ type: 'highpass', freq: 3200, gain: 1.0 * vol, dur: 0.05, atk: 0.0005, pan, delay });
      noise({
        freq: 1250,
        q: 0.5,
        gain: 1.05 * vol,
        dur: 0.3,
        atk: 0.0008,
        sweep: 340,
        pan,
        delay,
        verb: 1.0,
      });
      noise({
        type: 'lowpass',
        freq: 260,
        gain: 0.95 * vol,
        dur: 0.24,
        atk: 0.001,
        pan,
        delay,
        verb: 0.6,
      });
      tone({ type: 'triangle', f0: 150, f1: 34, dur: 0.28, gain: 0.62 * vol, pan, delay });
      tone({ type: 'sine', f0: 58, f1: 26, dur: 0.3, gain: 0.44 * vol, lp: 150, pan, delay });
      noise({
        type: 'bandpass',
        freq: 900,
        q: 0.8,
        gain: 0.3 * vol,
        dur: 1.25,
        atk: 0.05,
        pan,
        delay: delay + 0.05,
      });
      noise({
        type: 'highpass',
        freq: 2200,
        gain: 0.14 * vol,
        dur: 0.85,
        atk: 0.03,
        pan,
        delay: delay + 0.02,
      });
    } else {
      /* pistol */
      noise({
        type: 'highpass',
        freq: 4600,
        gain: 0.42 * vol,
        dur: 0.016,
        atk: 0.0003,
        pan,
        delay,
      });
      noise({
        freq: 1700,
        q: 1.1,
        gain: 0.7 * vol,
        dur: 0.11,
        atk: 0.001,
        sweep: 520,
        pan,
        delay,
        verb: 0.45,
      });
      noise({ type: 'lowpass', freq: 340, gain: 0.4 * vol, dur: 0.075, atk: 0.001, pan, delay });
      tone({ type: 'square', f0: 280, f1: 70, dur: 0.06, gain: 0.24 * vol, lp: 1600, pan, delay });
      tone({ type: 'sine', f0: 96, f1: 44, dur: 0.1, gain: 0.2 * vol, lp: 220, pan, delay });
      noise({
        type: 'highpass',
        freq: 1800,
        gain: 0.07 * vol,
        dur: 0.28,
        atk: 0.02,
        pan,
        delay: delay + 0.02,
      });
    }
  }
  return gunshot;
})();

/* airstrike ordnance: a rising shriek of overpressure, then the ground goes */
SFX.boom = (pan, dist) => {
  if (!SFX._ok()) return;
  dist = dist || 0;
  const far = clamp(1 - dist / 90, 0.15, 1);
  const vol = far * far;
  const delay = dist / 340;
  SFX._noise({
    type: 'lowpass',
    freq: 900,
    gain: 1.2 * vol,
    dur: 0.7,
    atk: 0.002,
    sweep: 90,
    pan,
    delay,
    verb: 0.9,
  });
  SFX._noise({ type: 'highpass', freq: 2400, gain: 0.4 * vol, dur: 0.05, atk: 0.0005, pan, delay });
  SFX._tone({ type: 'sine', f0: 70, f1: 24, dur: 0.9, gain: 0.9 * vol, lp: 160, pan, delay });
};
