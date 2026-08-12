/**
 * Type bridge for the behavior-preserving TypeScript migration.
 *
 * three.js is still loaded as a browser global at runtime. The declaration is
 * backed by the matching r128 type package without changing how the game boots.
 */
declare const THREE: typeof import('three');

interface Window {
  _ue?: typeof updateEnemy;
}
