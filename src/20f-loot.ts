'use strict';
/* Ground loot uses shared/gameplay/loot.ts. This file only builds meshes. */
const worldLoot = [];
const _lootBox = new THREE.BoxGeometry(0.55, 0.18, 0.18);

function spawnWorldLoot(kind, weaponId, x, z, label) {
  const color = kind === 'ammo' ? 0x7f9a6a : 0xc88a3a;
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    _lootBox,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      roughness: 0.5,
    })
  );
  body.position.y = 0.18;
  root.add(body);
  const gy = groundAt(x, z, 200);
  root.position.set(x, (gy === null ? 0 : gy) + 0.02, z);
  scene.add(root);
  worldLoot.push({
    root,
    kind,
    weaponId,
    label,
    coolUntil: -1,
    bobT: Math.random() * 6,
  });
}

function dropLootFromEnemy(e) {
  const drops = Gameplay.rollEnemyDrops();
  const x = e.obj.position.x;
  const z = e.obj.position.z;
  if (drops.ammo) spawnWorldLoot('ammo', null, x, z, Gameplay.ammoLootLabel(true));
  if (!drops.weaponId) return;
  const fam = Gameplay.weaponFamily(drops.weaponId);
  const w = WEAPONS.find((item) => item.id === fam);
  if (w) spawnWorldLoot('lootWeapon', w.id, x + 0.8, z, Gameplay.weaponLootLabel(w.name, false));
}

function lootQueries() {
  return worldLoot.map((p) => ({
    kind: p.kind,
    x: p.root.position.x,
    z: p.root.position.z,
    coolUntil: p.coolUntil,
    weaponId: p.weaponId,
  }));
}

function restockWeapon(id) {
  const idx = WEAPONS.findIndex((item) => item.id === id);
  if (idx < 0) return false;
  if (player.reloadT > 0) interruptReload();
  setADS(false);
  WEAPONS[player.weapon].vm.group.visible = false;
  player.weapon = idx;
  player.switchTo = -1;
  player.switching = 0;
  const w = WEAPONS[idx];
  w.mag = w.magSize;
  w.res = w.maxReserve || w.reserve || w.res;
  w.vm.group.visible = true;
  updateAmmoUI();
  SFX.weaponSwap(!!w.heavy);
  return true;
}

function tryInteractWeapon() {
  if (!G.running || player.dead) return false;
  const i = Gameplay.nearestWeaponLootIndex(
    lootQueries(),
    player.pos.x,
    player.pos.z,
    perfNow
  );
  if (i < 0) return false;
  const p = worldLoot[i];
  const swap = Gameplay.interactGroundWeapon(p.weaponId, WEAPONS[player.weapon].id);
  if (!restockWeapon(swap.take)) return false;
  if (swap.leave) {
    const left = WEAPONS.find((item) => item.id === swap.leave);
    p.weaponId = swap.leave;
    p.label = Gameplay.weaponLootLabel(left ? left.name : swap.leave, true);
  } else {
    p.root.visible = false;
    p.coolUntil = perfNow + 1e12;
  }
  return true;
}

function grantLootAmmo() {
  for (const w of WEAPONS) {
    if (w.infiniteAmmo) continue;
    const cap = w.maxReserve || w.reserve || 0;
    w.res = Math.min(cap, (w.res || 0) + Gameplay.AMMO_PICKUP_AMOUNT);
  }
  if (typeof throwInv !== 'undefined' && Gameplay.addThrowables) Gameplay.addThrowables(throwInv);
  updateAmmoUI();
  if (typeof updateThrowHud === 'function') updateThrowHud();
}

function updateLoot(dt) {
  const now = perfNow;
  if (UI.lootPrompt) {
    const i = Gameplay.nearestWeaponLootIndex(
      lootQueries(),
      player.pos.x,
      player.pos.z,
      now
    );
    const near = i < 0 ? null : worldLoot[i];
    UI.lootPrompt.textContent = near && near.root.visible ? near.label : '';
    UI.lootPrompt.classList.toggle('on', !!(near && near.root.visible));
  }
  for (const p of worldLoot) {
    if (!p.root.visible) continue;
    p.bobT += dt * 2.2;
    const gy = groundAt(p.root.position.x, p.root.position.z, 200);
    p.root.position.y = (gy === null ? 0 : gy) + 0.04 + Math.sin(p.bobT) * 0.07;
    p.root.rotation.y += dt * 0.8;
    if (p.kind !== 'ammo') continue;
    const d = Math.hypot(p.root.position.x - player.pos.x, p.root.position.z - player.pos.z);
    if (!Gameplay.shouldAutoPickupAmmo(d, p.coolUntil, now)) continue;
    grantLootAmmo();
    p.coolUntil = Gameplay.nextAmmoCooldown(now);
    p.root.visible = false;
    setTimeout(() => {
      p.root.visible = true;
    }, Gameplay.AMMO_PICKUP_COOLDOWN_MS);
  }
}
