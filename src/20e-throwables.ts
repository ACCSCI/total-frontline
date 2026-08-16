'use strict';
/* Shared throwable inventory + flight. Visuals stay on the host. */
const throwInv = Gameplay.createThrowInventory();
const flyingThrows = [];
const _throwDir = new THREE.Vector3();
const _throwNadeGeo = new THREE.SphereGeometry(0.08, 10, 8);
const _throwMats = {
  lethal: new THREE.MeshStandardMaterial({
    color: 0x2b3320,
    emissive: 0x5a1f10,
    emissiveIntensity: 0.8,
  }),
  tactical: new THREE.MeshStandardMaterial({
    color: 0xb9c6d0,
    emissive: 0x8096a4,
    emissiveIntensity: 0.8,
  }),
};

function updateThrowHud() {
  if (UI.throwTac) {
    UI.throwTac.textContent = `Q 闪光 ×${throwInv.tacticals}`;
    UI.throwTac.classList.toggle('empty', throwInv.tacticals === 0);
  }
  if (UI.throwLethal) {
    UI.throwLethal.textContent = `G 手雷 ×${throwInv.lethals}`;
    UI.throwLethal.classList.toggle('empty', throwInv.lethals === 0);
  }
}

function throwGrenade(kind) {
  if (!G.running || player.dead) return false;
  if (!Gameplay.consumeThrow(throwInv, kind)) return false;
  camera.getWorldDirection(_throwDir);
  const body = Gameplay.spawnThrow(
    kind,
    camera.position.x,
    camera.position.y,
    camera.position.z,
    _throwDir.x,
    _throwDir.y,
    _throwDir.z
  );
  const mesh = new THREE.Mesh(_throwNadeGeo, _throwMats[kind]);
  mesh.position.set(body.x, body.y, body.z);
  scene.add(mesh);
  flyingThrows.push({ mesh, body });
  updateThrowHud();
  return true;
}

function detonateThrow(entry) {
  const { mesh, body } = entry;
  scene.remove(mesh);
  if (body.kind === 'lethal') {
    explodeAt(body.x, body.z);
  } else {
    G.dmgFlash = Math.min(1, G.dmgFlash + 0.85);
    if (SFX.boom) SFX.boom(0, 0);
  }
}

function updateThrowables(dt) {
  for (let i = flyingThrows.length - 1; i >= 0; i--) {
    const entry = flyingThrows[i];
    const gy = groundAt(entry.body.x, entry.body.z, entry.body.y + 2);
    const floor = gy === null ? 0 : gy;
    if (Gameplay.stepThrow(entry.body, dt, floor) === 'detonate') {
      flyingThrows.splice(i, 1);
      detonateThrow(entry);
    } else {
      entry.mesh.position.set(entry.body.x, entry.body.y, entry.body.z);
    }
  }
}
