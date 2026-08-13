// @ts-nocheck -- procedural viewmodel builder.
'use strict';
function buildModernAK() {
  const G = new THREE.Group();
  part(G, B(0.078, 0.096, 0.34), GUNMETAL, 0, 0, -0.02);
  part(G, B(0.072, 0.034, 0.31), POLYMER, 0, 0.061, -0.035);
  part(G, B(0.086, 0.066, 0.1), GUNMETAL, 0, -0.006, -0.205);
  part(G, B(0.01, 0.038, 0.1), STEEL, 0.044, 0.006, 0.05);
  /* Continuous 1913 top rail: receiver and handguard share the same plane. */
  for (let i = 0; i < 15; i++)
    part(G, B(0.058, 0.009, 0.012), POLYMER, 0, 0.083, -0.19 + i * 0.025);
  part(G, B(0.082, 0.084, 0.33), POLYMER, 0, 0, -0.36);
  part(G, B(0.058, 0.014, 0.34), GUNMETAL, 0, 0.056, -0.36);
  for (let i = 0; i < 12; i++)
    part(G, B(0.062, 0.009, 0.012), GUNMETAL, 0, 0.068, -0.51 + i * 0.027);
  for (const x of [-0.043, 0.043])
    for (let i = 0; i < 5; i++)
      part(G, B(0.008, 0.025, 0.034), GLOVEPAD, x, -0.004, -0.48 + i * 0.064);
  part(G, CYLZ(0.018, 0.018, 0.42, 12), STEEL, 0, 0.008, -0.66);
  part(G, CYLZ(0.014, 0.014, 0.32, 10), GUNMETAL, 0, 0.064, -0.54);
  part(G, B(0.05, 0.07, 0.055), GUNMETAL, 0, 0.036, -0.55);

  const compensator = new THREE.Group();
  compensator.position.set(0, 0.008, -0.89);
  G.add(compensator);
  part(compensator, CYLZ(0.026, 0.022, 0.09, 12), GUNMETAL, 0, 0, 0);
  for (let i = 0; i < 3; i++)
    part(compensator, B(0.058, 0.007, 0.018), GUNMETAL, 0, 0.008, -0.026 + i * 0.026);
  const suppressor = new THREE.Group();
  suppressor.position.set(0, 0.008, -0.97);
  suppressor.visible = false;
  G.add(suppressor);
  part(suppressor, CYLZ(0.034, 0.031, 0.25, 16), GUNMETAL, 0, 0, 0);
  for (let i = 0; i < 5; i++)
    part(suppressor, TUBEZ(0.035, 0.008, 16), POLYMER, 0, 0, i * 0.04 - 0.08);

  const makeMag = () => {
    const m = new THREE.Group();
    m.position.set(0, -0.145, -0.055);
    m.rotation.x = 0.23;
    G.add(m);
    part(m, B(0.052, 0.1, 0.09), POLYTAN, 0, 0.005, 0);
    part(m, B(0.054, 0.09, 0.082), POLYTAN, 0, -0.078, 0.018, -0.16, 0, 0);
    for (let i = 0; i < 4; i++)
      part(m, B(0.056, 0.012, 0.01), GLOVEPAD, 0, -0.02 - i * 0.033, 0.025);
    part(m, B(0.058, 0.014, 0.09), POLYMER, 0, -0.13, 0.03);
    return m;
  };
  const mag = makeMag(),
    newMag = makeMag(),
    ejectedMag = makeMag();
  newMag.visible = ejectedMag.visible = false;

  const grip = new THREE.Group();
  grip.position.set(0, -0.09, 0.09);
  grip.rotation.x = -0.3;
  G.add(grip);
  part(grip, B(0.052, 0.13, 0.065), POLYMER, 0, -0.055, 0);
  for (let i = 0; i < 4; i++) part(grip, B(0.054, 0.01, 0.068), GLOVEPAD, 0, -0.035 - i * 0.025, 0);
  part(G, B(0.014, 0.034, 0.01), STEEL, 0, -0.057, 0.005);
  part(G, B(0.052, 0.012, 0.064), POLYMER, 0, -0.075, 0);
  part(G, B(0.026, 0.012, 0.13), STEEL, 0.045, 0.006, 0.03, 0, 0, -0.2);
  const stock = new THREE.Group();
  stock.position.set(0, 0, 0.25);
  G.add(stock);
  part(stock, B(0.055, 0.055, 0.22), POLYMER, 0, 0, 0.08);
  part(stock, B(0.07, 0.12, 0.035), GLOVEPAD, 0, -0.012, 0.2);
  part(stock, B(0.055, 0.032, 0.12), POLYTAN, 0, 0.057, 0.08);

  const optic = buildMicroDot(G, 0.067, -0.07);
  const prism = buildPrismScope(G, 0.132, -0.07);
  const holo = buildHoloSight(G, 0.117, -0.07);
  prism.group.visible = false;
  holo.group.visible = false;
  const verticalGrip = new THREE.Group();
  verticalGrip.position.set(0, -0.075, -0.39);
  verticalGrip.visible = false;
  G.add(verticalGrip);
  part(verticalGrip, B(0.044, 0.14, 0.06), POLYMER, 0, -0.06, 0, -0.12, 0, 0);
  const angledGrip = new THREE.Group();
  angledGrip.position.set(0, -0.07, -0.39);
  G.add(angledGrip);
  part(angledGrip, B(0.052, 0.045, 0.14), POLYMER, 0, -0.018, 0, -0.2, 0, 0);

  const chargeHandle = new THREE.Object3D();
  chargeHandle.position.set(0.052, 0.034, 0.055);
  G.add(chargeHandle);
  part(chargeHandle, CYLZ(0.009, 0.009, 0.055, 8), STEEL, 0.025, 0, 0, 0, PI / 2, 0);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.008, -1.02);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.055, 0.025, 0.02);
  G.add(eject);
  const rightGrip = new THREE.Object3D();
  rightGrip.position.set(0.008, -0.145, 0.11);
  G.add(rightGrip);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false),
    lh = makeHand(true);
  rh.position.set(0.008, -0.145, 0.11);
  rh.rotation.set(0.3, 0, 0.1);
  lh.position.set(-0.012, -0.08, -0.39);
  lh.rotation.set(0.05, 0, -0.18);
  hands.add(rh, lh);
  const weaponPivot = new THREE.Group();
  for (const child of [...G.children])
    if (child !== hands && child !== ejectedMag) weaponPivot.add(child);
  G.add(weaponPivot);

  return {
    group: G,
    weaponPivot,
    muzzle,
    eject,
    mag,
    newMag,
    ejectedMag,
    chargeHandle,
    rightGrip,
    hands,
    leftHand: lh,
    rightHand: rh,
    dot: optic.dot,
    dotGlow: optic.dotGlow,
    opticGlass: optic.glass,
    prism,
    holo,
    picatinnyCount: 27,
    attachmentNodes: {
      optic: { micro_dot: optic.group, holo: holo.group, prism_2_5: prism.group },
      muzzle: { compensator, suppressor },
      underbarrel: { angled_grip: angledGrip, vertical_grip: verticalGrip },
    },
    basePos: new THREE.Vector3(0.21, -0.25, -1.0),
    baseRot: new THREE.Vector3(-0.026, 0.085, 0.055),
    adsPos: new THREE.Vector3(0.0006, -0.132, -0.78),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.9,
  };
}
