// @ts-nocheck -- procedural viewmodel builders share the legacy part() helper.
'use strict';

/* Compact SMGs are deliberately built as their own silhouettes rather than
   shortened rifle reskins. Both expose detachable magazines, grip anchors and
   real muzzle/ejection transforms to the shared firing/reload animation code. */
function smgHands(G, leftPos, rightPos) {
  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.copy(rightPos);
  rh.rotation.set(0.26, 0.02, 0.1);
  hands.add(rh);
  const lh = makeHand(true);
  lh.position.copy(leftPos);
  lh.rotation.set(0.08, 0.03, -0.18);
  hands.add(lh);
  return { hands, leftHand: lh, rightHand: rh };
}

function smgWeaponPivot(G, hands, looseA, looseB) {
  const pivot = new THREE.Group();
  for (const child of [...G.children])
    if (child !== hands && child !== looseA && child !== looseB) pivot.add(child);
  G.add(pivot);
  return pivot;
}

function buildVector() {
  const G = new THREE.Group();
  /* KRISS-style split receiver: slim upper, deep Super-V lower and the
     characteristic forward magazine well. */
  part(G, B(0.082, 0.072, 0.35), GUNMETAL, 0, 0.035, -0.1);
  part(G, B(0.086, 0.024, 0.37), POLYMER, 0, 0.086, -0.09);
  for (let i = 0; i < 14; i++)
    part(G, B(0.062, 0.01, 0.011), STEEL, 0, 0.103, -0.25 + i * 0.025);
  part(G, B(0.09, 0.185, 0.16), POLYMER, 0, -0.065, -0.12, -0.08, 0, 0);
  part(G, B(0.084, 0.055, 0.16), GUNMETAL, 0, -0.015, -0.245);
  for (let i = 0; i < 4; i++)
    part(G, B(0.092, 0.013, 0.026), GLOVEPAD, 0, -0.055 + i * 0.036, -0.245);
  /* Short barrel, squared shroud and two-port compensator. */
  part(G, B(0.075, 0.068, 0.19), POLYMER, 0, 0.018, -0.36);
  part(G, CYLZ(0.017, 0.017, 0.25, 10), STEEL, 0, 0.02, -0.49);
  part(G, CYLZ(0.025, 0.025, 0.07, 10), GUNMETAL, 0, 0.02, -0.645);
  part(G, B(0.057, 0.012, 0.016), POLYMER, 0, 0.038, -0.636);
  /* Pistol grip behind the magazine well. */
  const grip = new THREE.Group();
  grip.position.set(0, -0.105, 0.01);
  grip.rotation.x = -0.25;
  G.add(grip);
  part(grip, B(0.052, 0.15, 0.068), POLYMER, 0, -0.065, 0);
  for (let i = 0; i < 5; i++)
    part(grip, B(0.055, 0.01, 0.07), GLOVEPAD, 0, -0.02 - i * 0.024, 0);
  const mag = new THREE.Group();
  mag.position.set(0, -0.172, -0.155);
  mag.rotation.x = 0.035;
  G.add(mag);
  part(mag, B(0.044, 0.205, 0.061), GUNMETAL, 0, -0.055, 0);
  part(mag, B(0.05, 0.018, 0.068), POLYMER, 0, -0.164, 0);
  for (let i = 0; i < 5; i++)
    part(mag, B(0.047, 0.008, 0.064), GLOVEPAD, 0, -0.08 - i * 0.028, 0);
  const mags = makeReloadMagazineSet(mag, G);
  /* Skeleton stock and padded shoulder plate. */
  part(G, B(0.07, 0.055, 0.24), POLYMER, 0, 0.025, 0.19);
  part(G, B(0.045, 0.018, 0.27), GUNMETAL, -0.025, 0.035, 0.37, 0.05, 0, 0);
  part(G, B(0.045, 0.018, 0.27), GUNMETAL, 0.025, 0.035, 0.37, -0.05, 0, 0);
  part(G, B(0.075, 0.13, 0.035), GLOVEPAD, 0, 0.005, 0.515);
  /* Hooded iron sights leave an open sight picture. */
  part(G, B(0.012, 0.045, 0.012), STEEL, -0.029, 0.13, 0.025);
  part(G, B(0.012, 0.045, 0.012), STEEL, 0.029, 0.13, 0.025);
  part(G, B(0.008, 0.034, 0.008), ACCENT_R, 0, 0.126, -0.405);
  const chargeHandle = new THREE.Group();
  chargeHandle.position.set(-0.063, 0.05, -0.105);
  G.add(chargeHandle);
  part(chargeHandle, B(0.045, 0.023, 0.04), GUNMETAL, -0.012, 0, 0);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.685);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.065, 0.055, -0.08);
  G.add(eject);
  const rightGrip = new THREE.Object3D();
  rightGrip.position.set(0.01, -0.17, 0.025);
  G.add(rightGrip);
  const h = smgHands(
    G,
    new THREE.Vector3(-0.012, -0.15, -0.285),
    new THREE.Vector3(0.01, -0.17, 0.025)
  );
  const weaponPivot = smgWeaponPivot(G, h.hands, mags.newMag, mags.ejectedMag);
  return {
    group: G,
    weaponPivot,
    muzzle,
    eject,
    mag,
    ...mags,
    chargeHandle,
    rightGrip,
    ...h,
    basePos: new THREE.Vector3(0.205, -0.25, -0.86),
    baseRot: new THREE.Vector3(-0.025, 0.08, 0.052),
    adsPos: new THREE.Vector3(0.0005, -0.127, -0.82),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.94,
  };
}

function buildP90() {
  const G = new THREE.Group();
  /* The P90 silhouette comes from its broad bullpup shell, thumbhole and
     long translucent horizontal magazine, not from a conventional rifle box. */
  part(G, B(0.145, 0.115, 0.5), POLYMER, 0, -0.008, -0.08);
  part(G, B(0.13, 0.065, 0.24), GLOVEPAD, 0, -0.065, 0.245);
  part(G, B(0.125, 0.035, 0.2), POLYMER, 0, 0.055, 0.255);
  /* Thumbhole is suggested by separated upper/lower stock spars. */
  part(G, B(0.035, 0.17, 0.05), POLYMER, -0.052, -0.12, 0.2, -0.28, 0, 0);
  part(G, B(0.035, 0.17, 0.05), POLYMER, 0.052, -0.12, 0.2, -0.28, 0, 0);
  part(G, B(0.13, 0.065, 0.07), GLOVEPAD, 0, -0.045, 0.405);
  /* Distinctive foregrip arch and forward control pad. */
  part(G, B(0.135, 0.04, 0.16), GUNMETAL, 0, -0.082, -0.28);
  part(G, B(0.04, 0.16, 0.07), POLYMER, -0.048, -0.12, -0.265, -0.2, 0, 0);
  part(G, B(0.04, 0.16, 0.07), POLYMER, 0.048, -0.12, -0.265, -0.2, 0, 0);
  part(G, CYLZ(0.016, 0.016, 0.27, 10), STEEL, 0, 0.004, -0.46);
  part(G, CYLZ(0.024, 0.024, 0.06, 10), GUNMETAL, 0, 0.004, -0.625);
  const mag = new THREE.Group();
  mag.position.set(0, 0.092, -0.04);
  G.add(mag);
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x7a876f,
    roughness: 0.32,
    metalness: 0.08,
    transparent: true,
    opacity: 0.82,
  });
  part(mag, B(0.082, 0.038, 0.47), magMat, 0, 0, 0);
  part(mag, B(0.09, 0.014, 0.475), GUNMETAL, 0, -0.024, 0);
  part(mag, CYLZ(0.026, 0.026, 0.018, 12), STEEL, 0, 0.012, 0.188);
  for (let i = 0; i < 10; i++)
    part(mag, B(0.071, 0.006, 0.012), GLOVEPAD, 0, 0.021, -0.19 + i * 0.041);
  const mags = makeReloadMagazineSet(mag, G);
  /* Open integrated sight bridge. The centre is real empty space. */
  part(G, B(0.018, 0.065, 0.19), GUNMETAL, -0.055, 0.09, -0.15);
  part(G, B(0.018, 0.065, 0.19), GUNMETAL, 0.055, 0.09, -0.15);
  part(G, B(0.12, 0.018, 0.07), GUNMETAL, 0, 0.128, -0.08);
  part(G, B(0.01, 0.034, 0.01), ACCENT_R, 0, 0.13, -0.39);
  const chargeHandle = new THREE.Group();
  chargeHandle.position.set(-0.085, 0.02, -0.24);
  G.add(chargeHandle);
  part(chargeHandle, B(0.04, 0.022, 0.045), GUNMETAL, -0.012, 0, 0);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.004, -0.665);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.018, -0.095, -0.04);
  G.add(eject);
  const rightGrip = new THREE.Object3D();
  rightGrip.position.set(0.02, -0.13, 0.18);
  G.add(rightGrip);
  const h = smgHands(
    G,
    new THREE.Vector3(-0.025, -0.14, -0.29),
    new THREE.Vector3(0.02, -0.13, 0.18)
  );
  const weaponPivot = smgWeaponPivot(G, h.hands, mags.newMag, mags.ejectedMag);
  return {
    group: G,
    weaponPivot,
    muzzle,
    eject,
    mag,
    ...mags,
    chargeHandle,
    rightGrip,
    ...h,
    basePos: new THREE.Vector3(0.2, -0.25, -0.86),
    baseRot: new THREE.Vector3(-0.024, 0.08, 0.052),
    adsPos: new THREE.Vector3(0.0005, -0.128, -0.83),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.95,
  };
}
