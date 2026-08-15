import * as THREE from 'three';

/** Same world-space hand grab as the single-player `poseReloadHand`. */
export function poseReloadHand(
  group: THREE.Group,
  target: THREE.Object3D,
  offset: THREE.Vector3,
  rotation: THREE.Euler,
  blend: number,
  hand: THREE.Object3D,
  hideForearm = true
) {
  if (!hand || blend <= 0) return;
  group.updateMatrixWorld(true);
  const grab = new THREE.Vector3();
  grab.copy(offset);
  target.localToWorld(grab);
  hand.parent?.worldToLocal(grab);
  hand.position.lerp(grab, blend);
  hand.rotation.x = THREE.MathUtils.lerp(hand.rotation.x, rotation.x, blend);
  hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, rotation.y, blend);
  hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, rotation.z, blend);
  if (hideForearm) {
    const fore = (hand as THREE.Object3D & { fore?: THREE.Object3D }).fore;
    if (fore) fore.visible = blend < 0.002;
  }
}
