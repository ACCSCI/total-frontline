// @ts-nocheck -- procedural viewmodel builder; tighten after part() overloads are typed.
'use strict';
/* =========================================================================
   8. VIEWMODELS — built from primitives, with gloved hands
   ========================================================================= */
/* Surface break-up for the gun. It fills a quarter of the screen at all times,
   so a flat albedo there is the most expensive flat albedo in the game: a
   little wear and roughness variation is what stops it reading as grey blocks. */
function makeWearTex(base, dark, light, speckle) {
  const S = 256,
    [c, x] = cvs(S);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  /* broad mottling so large flats aren't one value */
  for (let i = 0; i < 90; i++) {
    const cx = rand(0, S),
      cy = rand(0, S),
      r = rand(10, 54);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, Math.random() < 0.5 ? dark : light);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = rand(0.05, 0.16);
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, 7);
    x.fill();
  }
  /* micro scratches, mostly along the long axis of a machined part */
  x.globalAlpha = 1;
  for (let i = 0; i < 220; i++) {
    const x0 = rand(0, S),
      y0 = rand(0, S),
      len = rand(6, 70);
    x.strokeStyle = Math.random() < 0.55 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.085)';
    x.lineWidth = Math.random() < 0.85 ? 1 : 2;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x0 + len, y0 + rand(-2.5, 2.5));
    x.stroke();
  }
  /* edge-wear speckle: bare metal coming through the coating */
  if (speckle) {
    for (let i = 0; i < 170; i++) {
      x.fillStyle = 'rgba(255,255,255,' + rand(0.18, 0.46).toFixed(2) + ')';
      x.fillRect(rand(0, S), rand(0, S), rand(1, 3), rand(1, 2));
    }
  }
  grain(x, S, 11);
  return finishTex(c, [1, 1]);
}
/* Kept near white on purpose: this is a detail map that modulates the material
   colour, not the albedo itself. A mid-grey base would darken every tint by
   more than half. */
const TEX_GUNMETAL = makeWearTex('#e2e2e0', '#a6a6a4', '#ffffff', true);
const TEX_POLYMER = makeWearTex('#e0dfdc', '#a3a29e', '#ffffff', false);

/* Ripstop for the sleeves. A flat colour on a smooth cylinder is what makes an
   arm read as a plastic tube instead of a limb, so this leans on a visible weave
   plus soft blotching to break the silhouette up under any light. */
const TEX_SLEEVE = (() => {
  const S = 256,
    [c, x] = cvs(S);
  x.fillStyle = '#dedbd4';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const cx = rand(0, S),
      cy = rand(0, S),
      r = rand(14, 52);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, Math.random() < 0.5 ? '#9d9a92' : '#ffffff');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = rand(0.06, 0.2);
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, 7);
    x.fill();
  }
  x.globalAlpha = 1;
  x.strokeStyle = 'rgba(0,0,0,0.055)';
  x.lineWidth = 1;
  for (let i = 0; i < S; i += 6) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, S);
    x.stroke();
    x.beginPath();
    x.moveTo(0, i);
    x.lineTo(S, i);
    x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 3; i < S; i += 6) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, S);
    x.stroke();
  }
  grain(x, S, 9);
  return finishTex(c, [1, 1]);
})();

/* Same story as the soldier camo: primitive UVs run 0..1 regardless of size, so
   a shared map stretches wildly between a barrel and a stock. Run over the
   finished model once and rescale by actual dimensions instead of touching a
   hundred construction call sites. */
const GUN_PER_M = 5.5;
function texelize(root, perM) {
  root.traverse((o) => {
    const g = o.isMesh && o.material && o.material.map ? o.geometry : null;
    if (!g || !g.attributes.uv || g.userData.uvScaled) return;
    g.userData.uvScaled = true;
    const uv = g.attributes.uv;
    g.computeBoundingBox();
    const s = g.boundingBox.getSize(new THREE.Vector3());
    if (uv.count === 24) {
      // BoxGeometry: px nx py ny pz nz
      const face = [
        [s.z, s.y],
        [s.z, s.y],
        [s.x, s.z],
        [s.x, s.z],
        [s.x, s.y],
        [s.x, s.y],
      ];
      for (let f = 0; f < 6; f++) {
        const su = face[f][0] * perM,
          sv = face[f][1] * perM;
        for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      }
    } else {
      // cylinders, spheres, cones
      const k = Math.max(s.x, s.y, s.z) * perM;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    }
    uv.needsUpdate = true;
  });
}

/* the viewmodel sits against a bright outdoor scene, so the gun palette runs
   lighter than it looks on paper — anything darker reads as a black slab */
const GUNMETAL = new THREE.MeshStandardMaterial({
  map: TEX_GUNMETAL,
  color: 0x585855,
  metalness: 0.22,
  roughness: 0.46,
});
const POLYMER = new THREE.MeshStandardMaterial({
  map: TEX_POLYMER,
  color: 0x444340,
  metalness: 0.05,
  roughness: 0.76,
});
const POLYTAN = new THREE.MeshStandardMaterial({
  map: TEX_POLYMER,
  color: 0x685c47,
  metalness: 0.05,
  roughness: 0.78,
});
const STEEL = new THREE.MeshStandardMaterial({
  map: TEX_GUNMETAL,
  color: 0x9a9c9b,
  metalness: 0.28,
  roughness: 0.32,
});
const GLOVE = new THREE.MeshStandardMaterial({
  map: TEX_POLYMER,
  color: 0x474645,
  metalness: 0.04,
  roughness: 0.88,
});
const GLOVEPAD = new THREE.MeshStandardMaterial({
  color: 0x2b2b2a,
  metalness: 0.1,
  roughness: 0.6,
});
const SKIN = new THREE.MeshStandardMaterial({ color: 0xb08560, metalness: 0.0, roughness: 0.85 });
const SLEEVE = new THREE.MeshStandardMaterial({
  map: TEX_SLEEVE,
  color: 0x5d6350,
  metalness: 0.02,
  roughness: 0.92,
});
const SLEEVE_D = new THREE.MeshStandardMaterial({
  map: TEX_SLEEVE,
  color: 0x474c3d,
  metalness: 0.02,
  roughness: 0.94,
});
const ACCENT_R = new THREE.MeshStandardMaterial({
  color: 0xff2a1a,
  emissive: 0xff2a1a,
  emissiveIntensity: 1.4,
  roughness: 0.5,
});
/* Actual glass. This used to be an opaque disc, which put a dark plate across
   the sight line at exactly the moment you aimed at something — the target sat
   behind its own optic. Tinted and mostly clear reads like a coated lens, keeps
   enough cast for the dot to sit against, and lets you see what you are
   shooting. depthWrite off so it blends with the world instead of masking it. */
const OPTIC_GLASS = new THREE.MeshStandardMaterial({
  color: 0x9aa8ae,
  metalness: 0.08,
  roughness: 0.04,
  transparent: true,
  opacity: 0.045,
  depthWrite: false,
  side: THREE.DoubleSide,
});
/* optic bodies are open tubes, so their inner wall has to render too */
const TUBE_MAT = new THREE.MeshStandardMaterial({
  color: 0x33383e,
  metalness: 0.18,
  roughness: 0.55,
  side: THREE.DoubleSide,
});
linearizeMats({
  GUNMETAL,
  POLYMER,
  POLYTAN,
  STEEL,
  GLOVE,
  GLOVEPAD,
  SKIN,
  SLEEVE,
  ACCENT_R,
  OPTIC_GLASS,
  TUBE_MAT,
});

function part(parent, geo, mat, x, y, z, rx?, ry?, rz?, sx?, sy?, sz?) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.rotation.set(rx || 0, ry || 0, rz || 0);
  if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  parent.add(m);
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 10);
const CYLZ = (r1, r2, h, s) => {
  const g = CYL(r1, r2, h, s);
  g.rotateX(PI / 2);
  return g;
};
/** open-ended tube along Z — used for optics you have to see through */
const TUBEZ = (r, h, s) => {
  const g = new THREE.CylinderGeometry(r, r, h, s || 16, 1, true);
  g.rotateX(PI / 2);
  return g;
};

/** tactical glove — palm, fingers wrapped, thumb */
function makeHand(flip) {
  const g = new THREE.Group();
  const s = flip ? -1 : 1;
  part(g, B(0.072, 0.048, 0.1), GLOVE, 0, 0, 0);
  part(g, B(0.074, 0.024, 0.052), GLOVEPAD, 0, 0.014, -0.012);
  /* fingers curl forward+down around the grip */
  for (let i = 0; i < 4; i++) {
    const fg = new THREE.Group();
    fg.position.set(s * (0.026 - i * 0.0175), -0.016, 0.046);
    fg.rotation.x = -1.15 - i * 0.06;
    g.add(fg);
    part(fg, B(0.016, 0.014, 0.044), GLOVE, 0, 0, 0.02);
    const tip = new THREE.Group();
    tip.position.set(0, 0, 0.042);
    tip.rotation.x = -0.95;
    fg.add(tip);
    part(tip, B(0.016, 0.013, 0.034), GLOVE, 0, 0, 0.016);
  }
  /* thumb */
  const th = new THREE.Group();
  th.position.set(s * -0.032, 0.004, 0.024);
  th.rotation.set(-0.5, s * 0.55, 0);
  g.add(th);
  part(th, B(0.019, 0.018, 0.05), GLOVE, 0, 0, 0.024);
  /* wrist, then a forearm raked steeply down/back. It runs long on purpose:
     an arm that stops in mid-air makes the whole weapon read as a floating
     prop, so this one leaves the bottom of the frame instead of ending. */
  part(g, CYLZ(0.03, 0.034, 0.046, 10), GLOVEPAD, 0, 0, -0.052);
  const fore = new THREE.Group();
  fore.rotation.set(1.3, 0, s * 0.16);
  g.add(fore);
  /* Expose the long sleeve separately. During a reload the palm moves to the
     magazine, but dragging this entire first-person arm through the same grab
     point would put the sleeve in front of the camera. */
  g.forearm = fore;
  part(fore, CYLZ(0.04, 0.04, 0.022, 12), GLOVEPAD, 0, 0, 0.026); // glove cuff
  part(fore, CYLZ(0.038, 0.049, 0.2, 12), SLEEVE, 0, 0, 0.14); // forearm
  part(fore, CYLZ(0.049, 0.056, 0.3, 12), SLEEVE_D, 0, 0, 0.38); // upper sleeve, into frame edge
  /* elbow pad reads as kit rather than skin at the frame edge */
  part(fore, B(0.084, 0.03, 0.1), GLOVEPAD, 0, -0.03, 0.3);
  return g;
}

function buildMicroDot(parent, y, z) {
  const opt = new THREE.Group();
  opt.position.set(0, y, z);
  parent.add(opt);
  /* A raised skeleton mount, exposed adjustment turrets and a larger 24 mm
     window make this read as a modern duty optic instead of a black toy tube. */
  part(opt, B(0.064, 0.012, 0.086), GUNMETAL, 0, -0.021, 0);
  for (const x of [-0.024, 0.024]) part(opt, B(0.012, 0.034, 0.058), GUNMETAL, x, -0.003, 0);
  part(opt, B(0.043, 0.011, 0.064), POLYMER, 0, 0.017, 0);
  /* 30 mm clear window inside a visibly stout protective body. The cap rings
     deliberately overhang the tube, so their thickness is legible in ADS. */
  part(opt, TUBEZ(0.034, 0.086, 32), TUBE_MAT, 0, 0.05, 0);
  part(opt, TUBEZ(0.0395, 0.009, 32), GUNMETAL, 0, 0.05, -0.047);
  part(opt, TUBEZ(0.0395, 0.009, 32), GUNMETAL, 0, 0.05, 0.047);
  const glass = part(opt, CYLZ(0.0305, 0.0305, 0.0008, 32), OPTIC_GLASS, 0, 0.05, -0.038);
  glass.material = OPTIC_GLASS.clone();
  glass.material.opacity = 0.04;
  const rearGlass = part(opt, CYLZ(0.0305, 0.0305, 0.0008, 32), OPTIC_GLASS, 0, 0.05, 0.038);
  rearGlass.material = OPTIC_GLASS.clone();
  rearGlass.material.opacity = 0.03;
  /* Thin inner lip so the window reads as an opening, not a tinted disc. */
  part(opt, TUBEZ(0.0308, 0.0035, 28), GUNMETAL, 0, 0.05, -0.043);
  part(opt, B(0.02, 0.014, 0.024), POLYMER, 0, 0.093, 0.002);
  part(opt, CYLZ(0.011, 0.011, 0.014, 16), GUNMETAL, 0.043, 0.05, 0, 0, PI / 2, 0);
  part(opt, CYLZ(0.007, 0.007, 0.014, 12), GUNMETAL, -0.042, 0.05, 0.014, 0, PI / 2, 0);
  const dot = part(opt, new THREE.SphereGeometry(0.0017, 12, 10), ACCENT_R, 0, 0.05, -0.035);
  dot.material = ACCENT_R.clone();
  dot.material.emissiveIntensity = 3.4;
  dot.material.depthTest = false;
  dot.renderOrder = 20;
  const dotGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: TEX.glow,
      color: 0xff2b18,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      opacity: 0.62,
    })
  );
  dotGlow.scale.set(0.0068, 0.0068, 1);
  dotGlow.position.set(0, 0.05, -0.0345);
  dotGlow.renderOrder = 21;
  opt.add(dotGlow);
  /* User-facing red-dot option is intentionally chunky: the 1.3 scale is
     accounted for by the mount offsets, so the optical axis does not move. */
  opt.scale.setScalar(1.3);
  opt.userData.windowRadius = 0.031 * 1.3;
  opt.userData.frameRadius = 0.0395 * 1.3;
  opt.userData.aimY = 0.05;
  return { group: opt, dot, dotGlow, glass };
}

function buildRifle() {
  const G = new THREE.Group();
  /* upper receiver */
  part(G, B(0.076, 0.088, 0.3), GUNMETAL, 0, 0, -0.05);
  part(G, B(0.06, 0.028, 0.34), GUNMETAL, 0, 0.052, -0.06); // flat top
  /* picatinny teeth */
  for (let i = 0; i < 14; i++) part(G, B(0.052, 0.01, 0.01), POLYMER, 0, 0.07, -0.2 + i * 0.024);
  /* lower receiver + mag well */
  part(G, B(0.056, 0.072, 0.13), POLYMER, 0, -0.062, -0.06);
  const makeRifleMag = () => {
    const m = new THREE.Group();
    m.position.set(0, -0.135, -0.045);
    m.rotation.x = 0.18;
    G.add(m);
    part(m, B(0.048, 0.15, 0.082), POLYTAN, 0, 0, 0);
    part(m, B(0.052, 0.016, 0.086), POLYMER, 0, -0.08, 0);
    return m;
  };
  /* The old magazine and the incoming fresh one must coexist during the
     throw-and-catch overlap. Reusing one mesh made the old mag disappear and
     teleport back into the support hand. */
  const mag = makeRifleMag();
  const newMag = makeRifleMag();
  newMag.visible = false;
  const ejectedMag = makeRifleMag();
  ejectedMag.visible = false;
  /* handguard with vents */
  part(G, B(0.07, 0.074, 0.26), POLYMER, 0, -0.004, -0.3);
  for (let i = 0; i < 5; i++) {
    part(G, B(0.074, 0.016, 0.02), GUNMETAL, 0, -0.024, -0.4 + i * 0.045);
  }
  part(G, B(0.05, 0.014, 0.24), POLYMER, 0, 0.048, -0.3);
  /* barrel + flash hider */
  part(G, CYLZ(0.0165, 0.0165, 0.34, 10), STEEL, 0, 0.006, -0.5);
  const compensator = new THREE.Group();
  G.add(compensator);
  part(compensator, CYLZ(0.024, 0.021, 0.062, 10), GUNMETAL, 0, 0.006, -0.685);
  for (let i = 0; i < 3; i++)
    part(compensator, B(0.052, 0.006, 0.018), GUNMETAL, 0, 0.006, -0.672 + i * 0.02);
  part(compensator, CYLZ(0.02, 0.02, 0.014, 10), POLYMER, 0, 0.006, -0.716); // bore
  const suppressor = new THREE.Group();
  suppressor.visible = false;
  G.add(suppressor);
  part(suppressor, CYLZ(0.032, 0.029, 0.25, 16), GUNMETAL, 0, 0.006, -0.79);
  /* gas block + front sight */
  part(G, B(0.04, 0.052, 0.05), GUNMETAL, 0, 0.02, -0.44);
  part(G, B(0.014, 0.052, 0.012), GUNMETAL, 0, 0.062, -0.44);
  const optic = buildMicroDot(G, 0.054, -0.1);
  const prism = buildPrismScope(G, 0.119, -0.1);
  const holo = buildHoloSight(G, 0.104, -0.1);
  prism.group.visible = false;
  holo.group.visible = false;
  const angledGrip = new THREE.Group(),
    verticalGrip = new THREE.Group();
  verticalGrip.visible = false;
  G.add(angledGrip, verticalGrip);
  part(angledGrip, B(0.05, 0.045, 0.13), POLYMER, 0, -0.065, -0.33, -0.2, 0, 0);
  part(verticalGrip, B(0.042, 0.14, 0.055), POLYMER, 0, -0.12, -0.33, -0.1, 0, 0);
  /* charging handle + ejection port + brass deflector */
  part(G, B(0.03, 0.014, 0.05), GUNMETAL, 0, 0.038, 0.1);
  part(G, B(0.01, 0.03, 0.075), GUNMETAL, 0.04, 0.014, -0.045);
  part(G, B(0.016, 0.034, 0.03), GUNMETAL, 0.042, 0.03, 0.03);
  /* forward assist */
  part(G, CYLZ(0.011, 0.011, 0.03, 8), GUNMETAL, -0.042, 0.008, 0.03);
  /* pistol grip */
  const grip = new THREE.Group();
  grip.position.set(0, -0.086, 0.048);
  grip.rotation.x = -0.3;
  G.add(grip);
  part(grip, B(0.048, 0.125, 0.062), POLYMER, 0, -0.055, 0);
  part(grip, B(0.05, 0.03, 0.066), GLOVEPAD, 0, -0.108, 0);
  /* trigger + guard */
  part(G, B(0.014, 0.03, 0.01), STEEL, 0, -0.052, -0.015);
  part(G, B(0.048, 0.01, 0.056), POLYMER, 0, -0.072, -0.02);
  part(G, B(0.048, 0.036, 0.01), POLYMER, 0, -0.056, -0.046);
  /* stock */
  part(G, CYLZ(0.021, 0.021, 0.14, 10), GUNMETAL, 0, -0.006, 0.18);
  const st = new THREE.Group();
  st.position.set(0, -0.01, 0.235);
  G.add(st);
  part(st, B(0.062, 0.088, 0.13), POLYMER, 0, 0, 0);
  part(st, B(0.066, 0.104, 0.024), GLOVEPAD, 0, -0.006, 0.072);
  part(st, B(0.048, 0.03, 0.1), POLYMER, 0, 0.052, -0.01);
  /* sling swivel */
  part(G, B(0.008, 0.026, 0.008), STEEL, 0.036, -0.036, 0.16);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.006, -0.73);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.055, 0.02, -0.03);
  G.add(eject);
  const reloadSlap = new THREE.Object3D();
  reloadSlap.position.set(-0.052, -0.025, -0.015);
  G.add(reloadSlap);
  const rightGrip = new THREE.Object3D();
  rightGrip.position.set(0.008, -0.14, 0.075);
  G.add(rightGrip);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.set(0.008, -0.14, 0.075);
  rh.rotation.set(0.3, 0, 0.1);
  hands.add(rh);
  const lh = makeHand(true);
  lh.position.set(-0.01, -0.072, -0.315);
  lh.rotation.set(0.05, 0.0, -0.18);
  hands.add(lh);

  /* Weapon geometry and hands need different animation spaces. A reload may
     roll the receiver almost ninety degrees, while wrists and forearms only
     follow the controls with a much smaller anatomical turn. */
  const weaponPivot = new THREE.Group();
  for (const child of [...G.children]) {
    if (child !== hands && child !== ejectedMag) weaponPivot.add(child);
  }
  G.add(weaponPivot);

  return {
    group: G,
    weaponPivot,
    muzzle,
    eject,
    dot: optic.dot,
    dotGlow: optic.dotGlow,
    opticGlass: optic.glass,
    prism,
    holo,
    attachmentNodes: {
      optic: { micro_dot: optic.group, holo: holo.group, prism_2_5: prism.group },
      muzzle: { compensator, suppressor },
      underbarrel: { angled_grip: angledGrip, vertical_grip: verticalGrip },
    },
    mag,
    newMag,
    ejectedMag,
    reloadSlap,
    rightGrip,
    hands,
    leftHand: lh,
    rightHand: rh,
    /* held low and canted, so the buttstock falls past the bottom of the
              frame the way it does over a real shoulder instead of parking a
              slab of polymer in the middle of the screen */
    basePos: new THREE.Vector3(0.205, -0.243, -0.928),
    baseRot: new THREE.Vector3(-0.028, 0.082, 0.055),
    /* ADS poses put the sight on the vm camera's -Z axis: x=0 and
              y = -(sight height in model space), neither of which depends on how
              far out the weapon sits. adsRef is how far that sight ends up from
              the eye, which is what the dolly compensates for. */
    adsPos: new THREE.Vector3(0.0006, -0.118, -0.866),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 0.986,
  };
}

function buildShotgun() {
  const G = new THREE.Group();
  /* receiver */
  part(G, B(0.082, 0.098, 0.26), GUNMETAL, 0, 0, -0.02);
  part(G, B(0.086, 0.02, 0.2), POLYMER, 0, 0.052, -0.03);
  part(G, B(0.014, 0.04, 0.075), GUNMETAL, 0.044, 0.006, -0.03); // ejection port
  /* barrel + heat shield */
  part(G, CYLZ(0.0235, 0.0235, 0.6, 12), GUNMETAL, 0, 0.02, -0.44);
  for (let i = 0; i < 7; i++) part(G, B(0.056, 0.01, 0.014), STEEL, 0, 0.05, -0.3 - i * 0.055);
  part(G, B(0.01, 0.016, 0.3), STEEL, 0.03, 0.038, -0.42);
  part(G, B(0.01, 0.016, 0.3), STEEL, -0.03, 0.038, -0.42);
  part(G, CYLZ(0.028, 0.026, 0.05, 12), GUNMETAL, 0, 0.02, -0.735);
  part(G, CYLZ(0.021, 0.021, 0.012, 12), POLYMER, 0, 0.02, -0.756);
  /* front bead, raised on a post so the sight line clears the heat shield */
  part(G, B(0.008, 0.02, 0.01), STEEL, 0, 0.052, -0.72);
  part(G, new THREE.SphereGeometry(0.0065, 8, 6), ACCENT_R, 0, 0.065, -0.72);
  /* tube magazine */
  part(G, CYLZ(0.0195, 0.0195, 0.52, 10), GUNMETAL, 0, -0.03, -0.4);
  part(G, CYLZ(0.022, 0.022, 0.03, 10), STEEL, 0, -0.03, -0.665);
  part(G, B(0.012, 0.03, 0.014), STEEL, 0, -0.052, -0.34);
  /* pump forend (animated) */
  const forend = new THREE.Group();
  forend.position.set(0, -0.014, -0.34);
  G.add(forend);
  part(forend, B(0.078, 0.07, 0.185), POLYMER, 0, 0, 0);
  for (let i = 0; i < 6; i++)
    part(forend, B(0.082, 0.011, 0.013), GLOVEPAD, 0, -0.016, -0.07 + i * 0.028);
  part(forend, B(0.07, 0.02, 0.19), POLYMER, 0, 0.034, 0);
  /* stock */
  const st = new THREE.Group();
  st.position.set(0, -0.028, 0.19);
  st.rotation.x = 0.1;
  G.add(st);
  part(st, B(0.066, 0.1, 0.2), POLYMER, 0, -0.008, 0.06);
  part(st, B(0.07, 0.118, 0.026), GLOVEPAD, 0, -0.02, 0.164);
  part(st, B(0.05, 0.036, 0.14), POLYMER, 0, 0.056, 0.03);
  /* grip area */
  const grip = new THREE.Group();
  grip.position.set(0, -0.062, 0.075);
  grip.rotation.x = -0.38;
  G.add(grip);
  part(grip, B(0.05, 0.115, 0.062), POLYMER, 0, -0.052, 0);
  part(G, B(0.014, 0.028, 0.01), STEEL, 0, -0.048, -0.012);
  part(G, B(0.046, 0.01, 0.056), GUNMETAL, 0, -0.068, -0.016);
  /* shell carrier hint */
  part(G, B(0.052, 0.014, 0.08), GLOVEPAD, 0, -0.052, -0.06);
  /* One visible shell sells the loading-port action. It is hidden outside a
     reload and animated by the shared viewmodel rig. */
  const reloadShell = new THREE.Group();
  reloadShell.position.set(-0.015, -0.075, -0.075);
  reloadShell.visible = false;
  G.add(reloadShell);
  part(reloadShell, CYLZ(0.012, 0.012, 0.06, 10), ACCENT_R, 0, 0, 0);
  part(reloadShell, CYLZ(0.013, 0.013, 0.009, 10), STEEL, 0, 0, 0.034);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.77);
  G.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.06, 0.01, -0.02);
  G.add(eject);

  const hands = new THREE.Group();
  G.add(hands);
  const rh = makeHand(false);
  rh.position.set(0.006, -0.118, 0.1);
  rh.rotation.set(0.38, 0, 0.1);
  hands.add(rh);
  const lh = makeHand(true);
  lh.rotation.set(0.06, 0, -0.15);
  forend.add(lh);
  lh.position.set(-0.006, -0.064, -0.005); // rides the pump

  return {
    group: G,
    muzzle,
    eject,
    forend,
    reloadShell,
    hands,
    leftHand: lh,
    basePos: new THREE.Vector3(0.222, -0.255, -0.986),
    baseRot: new THREE.Vector3(-0.023, 0.086, 0.055),
    adsPos: new THREE.Vector3(0.0006, -0.065, -1.033),
    adsRot: new THREE.Vector3(0, 0, 0),
    adsRef: 1.653,
  }; // front bead
}
