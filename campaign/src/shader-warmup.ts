import * as THREE from 'three';
import type { GameRenderer } from './renderer';
import { makeOutroCutscene, Sequencer } from './sequencer';

/** Render every gameplay and outro angle once while the loading screen is
 * still up. WebGPU compiles shaders lazily, so this prevents the first view
 * of a zone (or the exfil CG) from hitching. */
export function warmupZoneShaders(renderer: GameRenderer, scene: THREE.Scene) {
  const warmCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.14, 1600);
  const points: Array<[number, number, number, number, number]> = [
    [0, 16, 650, 0, 500],
    [0, 14, 330, 0, 220],
    [0, 14, -230, 0, -330],
    [0, 14, -520, 0, -620],
    [0, 14, -720, 0, -770],
    [0, 16, -860, 0, -960],
  ];
  for (const [wx, wy, wz, lx, lz] of points) {
    warmCam.position.set(wx, wy, wz);
    warmCam.lookAt(lx, 0, lz);
    renderer.instance.render(scene, warmCam);
  }
  const outro = makeOutroCutscene();
  const seq = new Sequencer(outro);
  for (let i = 0; i < 24; i++) {
    seq.update(0.06, warmCam);
    renderer.instance.render(scene, warmCam);
  }
}
