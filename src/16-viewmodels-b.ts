// @ts-nocheck -- procedural viewmodel builder; tighten after part() overloads are typed.
'use strict';
function buildPistol() {
  const G = new THREE.Group();
  /* slide */
  const slide = new THREE.Group();
  G.add(slide);
  part(slide, B(0.046, 0.054, 0.215), GUNMETAL, 0, 0.012, -0.055);
  part(slide, B(0.048, 0.014, 0.215), POLYMER, 0, 0.036, -0.055);
  for (let i = 0; i < 7; i++)
    part(slide, B(0.049, 0.03, 0.007), GLOVEPAD, 0, 0.01, 0.01 + i * 0.014);
  part(slide, B(0.009, 0.013, 0.01), STEEL, 0, 0.045, -0.15); // front post
  part(slide, B(0.006, 0.008, 0.011), ACCENT_R, 0, 0.047, -0.15); // front bead
  /* rear sight is split so the notch actually shows the target */
  part(slide, B(0.01, 0.013, 0.012), STEEL, -0.01, 0.045, 0.036);
  part(slide, B(0.01, 0.013, 0.012), STEEL, 0.01, 0.045, 0.036);
  part(slide, B(0.005, 0.006, 0.013), ACCENT_R, -0.011, 0.046, 0.036);
  part(slide, B(0.005, 0.006, 0.013), ACCENT_R, 0.011, 0.046, 0.036);
  part(slide, B(0.014, 0.03, 0.062), GUNMETAL, 0.026, 0.014, -0.03); // ejection port
  part(slide, CYLZ(0.0135, 0.0135, 0.03, 10), STEEL, 0, 0.008, -0.16);
  part(slide, CYLZ(0.01, 0.01, 0.012, 10), POLYMER, 0, 0.008, -0.17);
  /* frame */
  part(G, B(0.04, 0.032, 0.185), POLYMER, 0, -0.024, -0.045);
  part(G, B(0.044, 0.012, 0.1), POLYMER, 0, -0.04, -0.1); // accessory rail
  for (let i = 0; i < 3; i++) part(G, B(0.046, 0.014, 0.01), GLOVEPAD, 0, -0.04, -0.07 - i * 0.024);
  /* grip + magwell */
  const grip = new THREE.Group();
  grip.position.set(0, -0.04, 0.03);
  grip.rotation.x = -0.28;
  G.add(grip);
  part(grip, B(0.042, 0.135, 0.058), POLYMER, 0, -0.066, 0);
  for (let i = 0; i < 5; i++)
    part(grip, B(0.044, 0.009, 0.062), GLOVEPAD, 0, -0.028 - i * 0.021, 0);
  part(grip, B(0.046, 0.014, 0.062), GUNMETAL, 0, -0.136, 0);
  /* trigger guard */
  part(G, B(0.04, 0.009, 0.052), POLYMER, 0, -0.056, -0.018);
  part(G, B(0.04, 0.03, 0.009), POLYMER, 0, -0.043, -0.041);
  part(G, B(0.011, 0.026, 0.009), STEEL, 0, -0.038, -0.014);
  /* hammer / beavertail */
  part(G, B(0.02, 0.02, 0.026), GUNMETAL, 0, 0.006, 0.062);
  part(G, B(0.034, 0.01, 0.04), POLYMER, 0, -0.01, 0.058);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.008, -0.185);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.04, 0.02, -0.03);
  G.add(eject);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.set(0.01, -0.108, 0.052);
  rh.rotation.set(0.28, 0, 0.12);
  hands.add(rh);
  const lh = makeHand(true);
  lh.position.set(-0.046, -0.1, 0.036);
  lh.rotation.set(0.34, 0.22, -0.3);
  hands.add(lh);

  return {
    group: G,
    muzzle,
    eject,
    slide,
    hands,
    basePos: new THREE.Vector3(0.175, -0.232, -0.754),
    baseRot: new THREE.Vector3(-0.022, 0.072, 0.05),
    adsPos: new THREE.Vector3(0.0006, -0.0448, -0.4935),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.6235,
  }; // front post
}

function buildSniper() {
  const G = new THREE.Group();
  /* receiver + rail */
  part(G, B(0.07, 0.082, 0.4), GUNMETAL, 0, 0, -0.02);
  part(G, B(0.056, 0.022, 0.44), GUNMETAL, 0, 0.05, -0.03);
  for (let i = 0; i < 16; i++) part(G, B(0.048, 0.009, 0.01), POLYMER, 0, 0.064, -0.22 + i * 0.026);
  /* fluted heavy barrel + brake */
  part(G, CYLZ(0.0215, 0.0195, 0.62, 12), STEEL, 0, 0.004, -0.55);
  for (let i = 0; i < 8; i++) part(G, B(0.046, 0.007, 0.03), GUNMETAL, 0, 0.004, -0.34 - i * 0.062);
  part(G, CYLZ(0.03, 0.028, 0.09, 12), GUNMETAL, 0, 0.004, -0.9);
  for (let i = 0; i < 4; i++)
    part(G, B(0.064, 0.008, 0.012), GUNMETAL, 0, 0.004, -0.875 - i * 0.02);
  part(G, CYLZ(0.023, 0.023, 0.014, 12), POLYMER, 0, 0.004, -0.946); // bore
  /* chassis fore-end with M-LOK slots */
  part(G, B(0.076, 0.062, 0.34), POLYTAN, 0, -0.02, -0.36);
  for (let i = 0; i < 5; i++) part(G, B(0.08, 0.014, 0.024), POLYMER, 0, -0.03, -0.48 + i * 0.058);
  part(G, B(0.05, 0.014, 0.3), POLYTAN, 0, 0.014, -0.36);
  /* folded bipod tucked under the fore-end */
  const bp = new THREE.Group();
  bp.position.set(0, -0.056, -0.47);
  G.add(bp);
  part(bp, B(0.026, 0.02, 0.07), GUNMETAL, 0, 0, 0);
  part(bp, CYLZ(0.0075, 0.0075, 0.17, 8), STEEL, -0.02, -0.01, 0.055, 0.3, 0, 0);
  part(bp, CYLZ(0.0075, 0.0075, 0.17, 8), STEEL, 0.02, -0.01, 0.055, 0.3, 0, 0);
  /* scope: tube, bells, turrets, rings */
  const sc = new THREE.Group();
  sc.position.set(0, 0.118, -0.1);
  G.add(sc);
  part(sc, CYLZ(0.0225, 0.0225, 0.3, 16), GUNMETAL, 0, 0, 0);
  part(sc, CYLZ(0.0335, 0.0335, 0.075, 16), GUNMETAL, 0, 0, -0.185); // objective bell
  part(sc, CYLZ(0.029, 0.029, 0.06, 16), GUNMETAL, 0, 0, 0.17); // ocular bell
  part(sc, CYLZ(0.03, 0.03, 0.008, 16), OPTIC_GLASS, 0, 0, -0.221);
  part(sc, CYLZ(0.0255, 0.0255, 0.008, 16), OPTIC_GLASS, 0, 0, 0.199);
  part(sc, CYL(0.017, 0.017, 0.03, 12), GUNMETAL, 0, 0.03, -0.02); // elevation turret
  part(sc, B(0.03, 0.006, 0.03), POLYMER, 0, 0.046, -0.02);
  part(sc, CYLZ(0.016, 0.016, 0.03, 12), GUNMETAL, 0.03, 0, -0.02, 0, PI / 2, 0); // windage turret
  part(sc, CYLZ(0.0155, 0.0155, 0.028, 12), GUNMETAL, 0, 0, 0.075); // magnification ring
  for (let i = 0; i < 8; i++)
    part(sc, B(0.005, 0.034, 0.026), POLYMER, 0, 0, 0.075, 0, 0, (i * PI) / 4);
  part(G, B(0.036, 0.052, 0.03), GUNMETAL, 0, 0.086, -0.2); // rings
  part(G, B(0.036, 0.052, 0.03), GUNMETAL, 0, 0.086, 0.0);
  /* bolt assembly — pulls back and rotates up during the cycle */
  const bolt = new THREE.Group();
  bolt.position.set(0.038, 0.026, 0.1);
  G.add(bolt);
  part(bolt, CYLZ(0.012, 0.012, 0.11, 10), STEEL, 0, 0, 0);
  const knob = new THREE.Group();
  knob.position.set(0, 0, 0.05);
  bolt.add(knob);
  part(knob, CYLZ(0.0095, 0.0095, 0.062, 8), STEEL, 0.026, 0, 0, 0, PI / 2, 0);
  part(knob, new THREE.SphereGeometry(0.0185, 10, 8), GUNMETAL, 0.058, 0, 0);
  /* detachable box mag */
  const mag = new THREE.Group();
  mag.position.set(0, -0.098, -0.055);
  G.add(mag);
  part(mag, B(0.044, 0.11, 0.095), POLYMER, 0, 0, 0);
  part(mag, B(0.048, 0.014, 0.099), GLOVEPAD, 0, -0.058, 0);
  /* trigger group + guard */
  part(G, B(0.013, 0.03, 0.01), STEEL, 0, -0.052, 0.02);
  part(G, B(0.046, 0.01, 0.062), POLYMER, 0, -0.07, 0.014);
  part(G, B(0.046, 0.032, 0.01), POLYMER, 0, -0.056, -0.014);
  /* thumbhole grip */
  const grip = new THREE.Group();
  grip.position.set(0, -0.08, 0.105);
  grip.rotation.x = -0.22;
  G.add(grip);
  part(grip, B(0.046, 0.13, 0.06), POLYTAN, 0, -0.058, 0);
  part(grip, B(0.048, 0.03, 0.064), GLOVEPAD, 0, -0.112, 0);
  /* skeleton stock with adjustable cheek riser */
  const st = new THREE.Group();
  st.position.set(0, -0.006, 0.235);
  G.add(st);
  part(st, B(0.058, 0.07, 0.1), POLYTAN, 0, 0, 0);
  part(st, B(0.05, 0.028, 0.15), POLYTAN, 0, 0.052, 0.075); // cheek riser
  part(st, CYLZ(0.008, 0.008, 0.05, 8), STEEL, -0.018, 0.026, 0.075, 1.57, 0, 0);
  part(st, CYLZ(0.008, 0.008, 0.05, 8), STEEL, 0.018, 0.026, 0.075, 1.57, 0, 0);
  part(st, B(0.052, 0.02, 0.16), POLYTAN, 0, -0.028, 0.08);
  part(st, B(0.058, 0.11, 0.026), GLOVEPAD, 0, 0.006, 0.168); // butt pad
  part(st, B(0.03, 0.04, 0.05), GUNMETAL, 0, -0.052, 0.15); // monopod spur

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.004, -0.96);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.055, 0.02, 0.06);
  G.add(eject);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.set(0.01, -0.136, 0.128);
  rh.rotation.set(0.26, 0, 0.1);
  hands.add(rh);
  const lh = makeHand(true);
  lh.position.set(-0.012, -0.078, -0.38);
  lh.rotation.set(0.04, 0, -0.16);
  hands.add(lh);

  return {
    group: G,
    muzzle,
    eject,
    bolt,
    knob,
    hands,
    basePos: new THREE.Vector3(0.224, -0.262, -1.16),
    baseRot: new THREE.Vector3(-0.022, 0.084, 0.055),
    /* the scope tube sits at y 0.118, so the eye line drops by that much */
    adsPos: new THREE.Vector3(0.0006, -0.1185, -0.6205),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.7105,
  }; // scope centre
}

/* SAW-250: a belt-fed brick. Boxy receiver, ammo can hanging off the left,
   heat-shielded barrel, folded bipod, aperture rear + post front irons. */
function buildLMG() {
  const G = new THREE.Group();
  /* receiver — taller and longer than the rifle's */
  part(G, B(0.082, 0.104, 0.4), GUNMETAL, 0, 0, -0.02);
  part(G, B(0.086, 0.02, 0.34), GUNMETAL, 0, 0.062, -0.02); // top cover
  part(G, B(0.03, 0.026, 0.12), POLYMER, 0, 0.086, -0.2); // carrying handle base
  part(G, B(0.018, 0.02, 0.1), POLYMER, 0, 0.108, -0.2); // handle
  /* feed tray + the belt can slung under the left side */
  part(G, B(0.07, 0.03, 0.12), GUNMETAL, -0.01, -0.062, -0.06);
  part(G, B(0.056, 0.13, 0.15), POLYTAN, -0.062, -0.128, -0.05);
  part(G, B(0.06, 0.014, 0.154), POLYMER, -0.062, -0.2, -0.05);
  /* belt link strip disappearing into the feed tray */
  part(G, B(0.05, 0.012, 0.06), STEEL, -0.032, -0.058, -0.05);
  /* heat shield with vent slots, barrel, muzzle brake */
  part(G, B(0.076, 0.08, 0.26), GUNMETAL, 0, 0.002, -0.36);
  for (let i = 0; i < 4; i++) part(G, B(0.08, 0.014, 0.024), POLYMER, 0, -0.02, -0.46 + i * 0.06);
  part(G, CYLZ(0.019, 0.019, 0.34, 10), STEEL, 0, 0.008, -0.62);
  part(G, CYLZ(0.027, 0.024, 0.07, 10), GUNMETAL, 0, 0.008, -0.79);
  for (let i = 0; i < 3; i++)
    part(G, B(0.056, 0.007, 0.02), GUNMETAL, 0, 0.008, -0.776 + i * 0.022);
  /* folded bipod legs under the barrel */
  part(G, B(0.012, 0.012, 0.16), STEEL, 0.03, -0.05, -0.58);
  part(G, B(0.012, 0.012, 0.16), STEEL, -0.03, -0.05, -0.58);
  /* irons: aperture ring rear, post front, both on the 0.115 sight line */
  part(G, TUBEZ(0.017, 0.012, 14), TUBE_MAT, 0, 0.115, 0.1);
  part(G, B(0.03, 0.05, 0.012), GUNMETAL, 0, 0.088, 0.1);
  part(G, B(0.04, 0.05, 0.05), GUNMETAL, 0, 0.03, -0.66);
  part(G, B(0.014, 0.075, 0.012), GUNMETAL, 0, 0.0775, -0.66);
  /* charging handle + ejection port */
  part(G, B(0.03, 0.016, 0.05), GUNMETAL, 0.046, 0.02, 0.08);
  part(G, B(0.01, 0.032, 0.08), GUNMETAL, 0.044, 0.01, -0.04);
  /* grip + trigger */
  const grip = new THREE.Group();
  grip.position.set(0, -0.09, 0.06);
  grip.rotation.x = -0.28;
  G.add(grip);
  part(grip, B(0.05, 0.125, 0.064), POLYMER, 0, -0.055, 0);
  part(grip, B(0.052, 0.03, 0.068), GLOVEPAD, 0, -0.108, 0);
  part(G, B(0.014, 0.03, 0.01), STEEL, 0, -0.056, -0.005);
  part(G, B(0.05, 0.01, 0.06), POLYMER, 0, -0.076, -0.01);
  /* skeleton stock + butt pad */
  part(G, B(0.04, 0.05, 0.12), GUNMETAL, 0, 0.01, 0.16);
  part(G, B(0.058, 0.09, 0.15), POLYMER, 0, -0.02, 0.26);
  part(G, B(0.062, 0.106, 0.026), GLOVEPAD, 0, -0.02, 0.34);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.008, -0.83);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.055, 0.02, -0.03);
  G.add(eject);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.set(0.008, -0.145, 0.085);
  rh.rotation.set(0.3, 0, 0.1);
  hands.add(rh);
  const lh = makeHand(true);
  lh.position.set(-0.01, -0.08, -0.38);
  lh.rotation.set(0.05, 0, -0.18);
  hands.add(lh);

  return {
    group: G,
    muzzle,
    eject,
    hands,
    /* carried lower than the rifle — it is a lump of a gun */
    basePos: new THREE.Vector3(0.215, -0.262, -0.96),
    baseRot: new THREE.Vector3(-0.026, 0.082, 0.055),
    /* aperture/post at y 0.115 in model space */
    adsPos: new THREE.Vector3(0.0006, -0.115, -0.88),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.995,
  };
}

/* JUG-M134: six barrels around a powered spindle, with a rear motor, carry
   cage, oversized ammunition box and armoured sleeves. The barrel cluster is
   a separate group so the viewmodel animator can give it real spin-up/down. */
function buildJugGatling() {
  const G = new THREE.Group();
  const barrels = new THREE.Group();
  barrels.position.set(0, 0.015, -0.48);
  G.add(barrels);
  for (let i = 0; i < 6; i++) {
    const a = (i * PI) / 3;
    const x = Math.cos(a) * 0.052;
    const y = Math.sin(a) * 0.052;
    part(barrels, CYLZ(0.012, 0.011, 0.72, 8), STEEL, x, y, -0.25);
  }
  part(barrels, CYLZ(0.078, 0.078, 0.045, 16), GUNMETAL, 0, 0, 0.08);
  part(barrels, CYLZ(0.072, 0.072, 0.04, 16), GUNMETAL, 0, 0, -0.55);
  part(barrels, CYLZ(0.028, 0.028, 0.78, 12), GUNMETAL, 0, 0, -0.24);
  /* motor, receiver cage and rear shoulder block */
  part(G, CYLZ(0.13, 0.13, 0.28, 16), GUNMETAL, 0, 0.015, -0.02);
  part(G, B(0.25, 0.2, 0.28), POLYMER, 0, -0.01, 0.17);
  part(G, B(0.29, 0.035, 0.48), GUNMETAL, 0, 0.13, -0.03);
  part(G, B(0.035, 0.22, 0.48), GUNMETAL, -0.13, 0.02, -0.03);
  part(G, B(0.035, 0.22, 0.48), GUNMETAL, 0.13, 0.02, -0.03);
  part(G, B(0.18, 0.13, 0.24), GLOVEPAD, 0, -0.01, 0.39);
  /* feed chute and deep ammunition drum */
  part(G, B(0.12, 0.06, 0.2), STEEL, -0.15, -0.06, 0.06, 0, 0, -0.24);
  part(G, B(0.2, 0.29, 0.28), POLYTAN, -0.19, -0.2, 0.19);
  part(G, B(0.21, 0.025, 0.29), GUNMETAL, -0.19, -0.355, 0.19);
  /* grips and armoured forearms */
  part(G, B(0.045, 0.16, 0.06), POLYMER, 0.105, -0.15, 0.25, -0.3, 0, 0);
  part(G, B(0.045, 0.15, 0.06), POLYMER, -0.105, -0.12, -0.05, -0.18, 0, 0);
  part(G, B(0.17, 0.115, 0.15), POLYMER, 0.2, -0.22, 0.25, 0.06, -0.1, -0.25);
  part(G, B(0.17, 0.115, 0.15), POLYMER, -0.2, -0.18, -0.12, 0.08, 0.12, 0.2);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.015, -1.1);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(-0.14, -0.05, 0.04);
  G.add(eject);
  return {
    group: G,
    muzzle,
    eject,
    barrels,
    barrelSpin: 0,
    hands: new THREE.Group(),
    basePos: new THREE.Vector3(0.25, -0.34, -1.08),
    baseRot: new THREE.Vector3(-0.045, 0.095, 0.075),
    adsPos: new THREE.Vector3(0.028, -0.18, -0.98),
    adsRot: new THREE.Vector3(-0.015, 0.018, 0.01),
    adsRef: 1.12,
  };
}
