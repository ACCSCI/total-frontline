import * as THREE from 'three';
import type { P0Combat } from './combat';
import type { P0Level } from './level';

/** Per-frame outro animation: convoy dash, APC pursuit, and the unknown
 * drone locking the convoy. */
export function createOutroAnimation(
  exfil: THREE.Group,
  exfilStartZ: number,
  level: P0Level,
  combat: P0Combat | null
) {
  return (_time: number, dt: number, u: number) => {
    exfil.position.z = exfilStartZ - u * 185;
    exfil.position.y = level.groundY(exfil.position.x, exfil.position.z) + 0.02;
    exfil.rotation.y = Math.PI + Math.sin(u * Math.PI * 2) * 0.045;
    for (const wheel of exfil.children) {
      if (wheel.name === 'exfilWheel') wheel.rotation.x -= dt * 12;
    }
    const apc = combat?.mission.apc;
    if (apc && combat?.mission.state.apc.spawned) {
      apc.visible = true;
      apc.position.z = -760 - u * 100;
      apc.position.y = level.groundY(apc.position.x, apc.position.z) + 0.02;
    }
    const drone = combat?.mission.drone;
    const beam = drone?.getObjectByName('droneLaser') as THREE.Mesh | null;
    const dot = drone?.getObjectByName('droneLaserDot') as THREE.Mesh | null;
    if (drone && u > 0.35) {
      drone.visible = true;
      drone.position.set(Math.sin(_time * 0.9) * 14, 42 + Math.sin(_time * 0.7) * 3, -1160 - u * 30);
      drone.rotation.y = _time * 0.6;
      for (const child of drone.children) {
        if (child.name === 'droneRotor') child.rotation.y += dt * 42;
      }
      if (beam && dot && u > 0.6) {
        beam.visible = true;
        dot.visible = true;
        const start = drone.position;
        const end = exfil.position.clone();
        end.y += 1.4;
        const dir = end.clone().sub(start);
        const len = dir.length() || 1;
        beam.position.copy(start).addScaledVector(dir, 0.5);
        beam.scale.set(1, len, 1);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        dot.position.copy(end);
      } else if (beam && dot) {
        beam.visible = false;
        dot.visible = false;
      }
    } else if (drone) {
      drone.visible = false;
      if (beam) beam.visible = false;
      if (dot) dot.visible = false;
    }
  };
}
