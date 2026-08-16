function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const SETTINGS = {
  mouseSensitivity: clamp(Number(localStorage.getItem('tf.mouseSensitivity')) || 1, 0.5, 2),
  sprintCancelsReload: localStorage.getItem('tf.sprintCancelsReload') !== 'false',
  baseFov: clamp(Number(localStorage.getItem('tf.baseFov')) || 75, 65, 95),
  masterVolume: clamp(
    localStorage.getItem('tf.masterVolume') === null
      ? 0.82
      : Number(localStorage.getItem('tf.masterVolume')),
    0,
    1
  ),
};

export const LOOK_SENS = 0.0022;
