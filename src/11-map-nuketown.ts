// @ts-nocheck -- procedural scene builder; tighten after shared builder overloads are typed.
'use strict';
/* -------------------------------------------------------------------------
   NUKETOWN — a 1950s cul-de-sac on a test site. Two pastel tract houses face
   each other across the street, a bus and a moving van stalled between them,
   wooden fences all around, desert and mesas past the picket line.

   This file holds the map's textures, materials and piece builders;
   12-map-nuketown-build.js assembles them in buildNuketown().
   ------------------------------------------------------------------------- */
const NUKE_SUN = new THREE.Vector3(0.55, 0.78, -0.42).normalize();

function makeGrassTex() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#4e7032';
  x.fillRect(0, 0, S, S);
  splotches(x, S, 90, ['86,120,58', '66,94,44', '100,128,70', '58,80,38'], 16, 90, 0.35);
  /* mowing stripes */
  for (let i = 0; i < 4; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    x.fillRect(0, (i * S) / 4, S, S / 4);
  }
  grain(x, S, 30);
  return finishTex(c, [22, 22]);
}
function makeWoodTex() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#7d6547';
  x.fillRect(0, 0, S, S);
  const PW = 64;
  for (let p = 0; p < S / PW; p++) {
    const sh = rand(-16, 16) | 0;
    x.fillStyle = `rgb(${125 + sh},${101 + sh},${71 + sh})`;
    x.fillRect(p * PW, 0, PW, S);
    x.strokeStyle = 'rgba(60,44,28,.35)';
    for (let i = 0; i < 5; i++) {
      x.lineWidth = rand(0.6, 1.6);
      const gx = p * PW + rand(4, PW - 4);
      x.beginPath();
      x.moveTo(gx, 0);
      x.bezierCurveTo(gx + rand(-6, 6), S * 0.33, gx + rand(-6, 6), S * 0.66, gx + rand(-4, 4), S);
      x.stroke();
    }
    x.fillStyle = 'rgba(30,22,14,.8)';
    x.fillRect(p * PW - 1, 0, 2, S);
    x.fillStyle = 'rgba(255,255,255,.06)';
    x.fillRect(p * PW + 1, 0, 1, S);
  }
  grain(x, S, 24);
  return finishTex(c);
}
function makeSidingTex(base) {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  /* clapboard: a shadow line under each board, a highlight on its top edge */
  for (let y = 0; y < S; y += 32) {
    x.fillStyle = 'rgba(0,0,0,.20)';
    x.fillRect(0, y, S, 3);
    x.fillStyle = 'rgba(255,255,255,.10)';
    x.fillRect(0, y + 3, S, 2);
  }
  splotches(x, S, 24, ['60,50,40', '255,255,255'], 10, 60, 0.06);
  grain(x, S, 18);
  return finishTex(c);
}
function makeFlagTex() {
  const S = 256,
    [c, x] = cvs(S);
  x.fillStyle = '#b53a32';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) {
    x.fillStyle = '#e8e2d4';
    x.fillRect(0, ((i * 2 + 1) * S) / 13, S, S / 13);
  }
  x.fillStyle = '#2e3f6e';
  x.fillRect(0, 0, 104, (S * 7) / 13);
  x.fillStyle = '#e8e2d4';
  for (let r = 0; r < 5; r++)
    for (let s = 0; s < 6; s++) {
      x.beginPath();
      x.arc(9 + s * 17 + (r % 2) * 8, 10 + r * 24, 3, 0, 7);
      x.fill();
    }
  return finishTex(c);
}
function makeSignTex() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 164;
  const x = c.getContext('2d');
  x.fillStyle = '#2f4a38';
  x.fillRect(0, 0, 1024, 164);
  x.strokeStyle = '#d8d2b8';
  x.lineWidth = 6;
  x.strokeRect(10, 10, 1004, 144);
  x.fillStyle = '#e8e2cc';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 92px "Arial Narrow", Arial, sans-serif';
  x.fillText('NUKETOWN', 512, 70);
  x.font = 'bold 30px "Arial Narrow", Arial, sans-serif';
  x.fillText('EST. 1955 — A SWELL PLACE TO LIVE', 512, 132);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = MAXANISO;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

const NUKE_CYL = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 10);
const NMAT = {
  grass: new THREE.MeshStandardMaterial({ map: makeGrassTex(), roughness: 0.96, metalness: 0 }),
  wood: new THREE.MeshStandardMaterial({ map: makeWoodTex(), roughness: 0.85, metalness: 0.02 }),
  woodDk: new THREE.MeshStandardMaterial({ color: 0x5d4a36, roughness: 0.9, metalness: 0.02 }),
  sidY: new THREE.MeshStandardMaterial({
    map: makeSidingTex('#b59c5a'),
    roughness: 0.82,
    metalness: 0.02,
  }),
  sidB: new THREE.MeshStandardMaterial({
    map: makeSidingTex('#7fa3b8'),
    roughness: 0.82,
    metalness: 0.02,
  }),
  trim: new THREE.MeshStandardMaterial({ color: 0xd2cec2, roughness: 0.7, metalness: 0.02 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x6b5044, roughness: 0.94, metalness: 0.02 }),
  brick: new THREE.MeshStandardMaterial({ color: 0x8a5040, roughness: 0.9, metalness: 0.02 }),
  intFloor: new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.8, metalness: 0.02 }),
  ceil: new THREE.MeshStandardMaterial({ color: 0xc4c0b2, roughness: 0.9, metalness: 0 }),
  glassDk: new THREE.MeshStandardMaterial({ color: 0x33414a, roughness: 0.25, metalness: 0.1 }),
  busGrn: new THREE.MeshStandardMaterial({ color: 0x7d8f4c, roughness: 0.55, metalness: 0.08 }),
  truckWh: new THREE.MeshStandardMaterial({ color: 0xc9c5b7, roughness: 0.6, metalness: 0.06 }),
  truckTl: new THREE.MeshStandardMaterial({ color: 0x4f7d7a, roughness: 0.55, metalness: 0.08 }),
  carPink: new THREE.MeshStandardMaterial({ color: 0xc98d8d, roughness: 0.45, metalness: 0.12 }),
  carTeal: new THREE.MeshStandardMaterial({ color: 0x6f9a9d, roughness: 0.45, metalness: 0.12 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb43a2e, roughness: 0.6, metalness: 0.05 }),
  leaf: new THREE.MeshStandardMaterial({
    color: 0x4d6e2f,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  }),
  leaf2: new THREE.MeshStandardMaterial({
    color: 0x5d7d38,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5d4a38, roughness: 0.95, metalness: 0 }),
};
linearizeMats(NMAT);

const NUKE_WHEEL_BUS = NUKE_CYL(0.42, 0.42, 0.3, 12);
NUKE_WHEEL_BUS.rotateZ(PI / 2);
const NUKE_WHEEL_CAR = NUKE_CYL(0.33, 0.33, 0.24, 12);
NUKE_WHEEL_CAR.rotateZ(PI / 2);

/* a tract house with an enterable ground floor. facing: +1 faces +X (the
   west house, door on its east wall), -1 mirrors it across the street */
function nukeHouse(cx, cz, facing, siding) {
  const W = 10,
    D = 8,
    H = 3.0,
    T = 0.18;
  const X0 = cx - W / 2,
    X1 = cx + W / 2,
    Z0 = cz - D / 2,
    Z1 = cz + D / 2;
  const emit = (alongX, fixed, a, b, y0, y1) => {
    const len = b - a,
      hh = y1 - y0;
    if (len < 0.04 || hh < 0.04) return;
    if (alongX) box(len, hh, T, (a + b) / 2, y0, fixed, siding, { uvScale: [len * 0.5, hh * 0.5] });
    else box(T, hh, len, fixed, y0, (a + b) / 2, siding, { uvScale: [len * 0.5, hh * 0.5] });
  };
  /* a wall run with gaps: each gap gets a sill below and a header above.
     yBase/hTop let the upstairs reuse the same builder. */
  const wall = (alongX, fixed, from, to, gaps, yBase, hTop) => {
    let cur = from;
    for (const g of gaps.slice().sort((p, q) => p.a - q.a)) {
      if (g.a > cur) emit(alongX, fixed, cur, g.a, yBase, hTop);
      if (g.y0 > 0.02) emit(alongX, fixed, g.a, g.b, yBase, yBase + g.y0);
      if (yBase + g.y1 < hTop - 0.02) emit(alongX, fixed, g.a, g.b, yBase + g.y1, hTop);
      cur = g.b;
    }
    if (cur < to) emit(alongX, fixed, cur, to, yBase, hTop);
  };
  const door = { a: cz - 0.65, b: cz + 0.65, y0: 0, y1: 2.1 };
  const winZ0 = { a: Z0 + 0.8, b: Z0 + 2.4, y0: 1.0, y1: 2.0 },
    winZ1 = { a: Z1 - 2.4, b: Z1 - 0.8, y0: 1.0, y1: 2.0 };
  const winX0 = { a: cx - 2.6, b: cx - 1.2, y0: 1.0, y1: 2.0 },
    winX1 = { a: cx + 1.2, b: cx + 2.6, y0: 1.0, y1: 2.0 };
  wall(false, facing > 0 ? X1 : X0, Z0, Z1, [winZ0, door, winZ1], 0, H); /* street face */
  wall(false, facing > 0 ? X0 : X1, Z0, Z1, [winZ0, door, winZ1], 0, H); /* rear face  */
  wall(true, Z0, X0, X1, [winX0, winX1], 0, H);
  wall(true, Z1, X0, X1, [winX0, winX1], 0, H);

  /* interior floor */
  box(W - 0.15, 0.08, D - 0.15, cx, 0.005, cz, NMAT.intFloor, {
    collide: false,
    solid: false,
    ground: true,
    cast: false,
    uvScale: [3, 2.4],
  });

  /* stairs hug the north wall: foot at the high-x end, top overlapping the
     floor slab edge so there is no crack to fall through */
  const stB = X1 - 0.9,
    stT = X1 - 6.4;
  {
    const L = stB - stT;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(L, 0);
    sh.lineTo(0, H);
    sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false });
    rg.computeVertexNormals();
    const uv = rg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
    const ramp = new THREE.Mesh(rg, NMAT.intFloor);
    ramp.position.set(stT, 0, Z0 + 0.1);
    ramp.castShadow = ramp.receiveShadow = true;
    scene.add(ramp);
    worldSolid.push(ramp);
    groundMesh.push(ramp);
    /* Solid wedge under the slope. Slice heights stay below the walking
       surface so a climber's capsule is never inside a box; the west-most
       slice is the missing back face. */
    const stairZ = Z0 + 0.65,
      slices = 6;
    for (let i = 0; i < slices; i++) {
      const x0 = stT + (L * i) / slices,
        x1 = stT + (L * (i + 1)) / slices;
      const h = H * (1 - (x1 - stT) / L) - 0.12;
      if (h >= 0.35) addCollider((x0 + x1) / 2, 0, stairZ, x1 - x0, h, 1.1);
    }
    const rail = new THREE.Mesh(rg.clone(), NMAT.woodDk);
    rail.scale.z = 0.08;
    rail.position.set(stT, 0, Z0 + 1.21);
    rail.castShadow = true;
    scene.add(rail);
  }

  /* upstairs floor: three slabs around the stair well — a floor, not a wall */
  const wellX0 = X1 - 6.2,
    wellX1 = X1 - 0.5,
    wellZ1 = Z0 + 1.65;
  const slab = (x0, x1, z0, z1) =>
    box(x1 - x0, 0.15, z1 - z0, (x0 + x1) / 2, H, (z0 + z1) / 2, NMAT.ceil, {
      collide: false,
      ground: true,
      ceiling: true,
      cast: false,
    });
  slab(X0, wellX0, Z0, Z1);
  slab(wellX0, wellX1, wellZ1, Z1);
  slab(wellX1, X1, Z0, Z1);

  /* upper walls with real openings — the street below is a shooting gallery */
  const H2T = H + 0.15 + 2.75;
  const uw0 = { a: cz - 2.7, b: cz - 1.3, y0: 0.95, y1: 2.15 },
    uw1 = { a: cz + 1.3, b: cz + 2.7, y0: 0.95, y1: 2.15 };
  const us = { a: cx - 0.7, b: cx + 0.7, y0: 0.95, y1: 2.15 };
  wall(false, X1, Z0, Z1, [uw0, uw1], H + 0.15, H2T);
  wall(false, X0, Z0, Z1, [uw0, uw1], H + 0.15, H2T);
  wall(true, Z0, X0, X1, [us], H + 0.15, H2T);
  wall(true, Z1, X0, X1, [us], H + 0.15, H2T);
  /* the ceiling rides 3cm low so its face never z-fights the roof's base */
  box(W, 0.15, D, cx, H2T - 0.03, cz, NMAT.ceil, {
    collide: false,
    ground: false,
    ceiling: true,
    cast: false,
  });

  /* gable roof: triangular prism, extrude UVs are world units — plain colour */
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2 - 0.55, 0);
  sh.lineTo(W / 2 + 0.55, 0);
  sh.lineTo(0, 2.1);
  sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: D + 1.1, bevelEnabled: false });
  rg.computeVertexNormals();
  const roof = new THREE.Mesh(rg, NMAT.roof);
  roof.position.set(cx, H2T, cz - (D + 1.1) / 2);
  roof.castShadow = roof.receiveShadow = true;
  scene.add(roof);
  worldSolid.push(roof);
  box(0.7, 2.6, 0.7, cx - facing * 2.0, H2T - 0.6, cz + 1.4, NMAT.brick, { collide: false });

  /* porch: a step, a roof you can mantle onto, two posts */
  const px = facing > 0 ? X1 + 1.15 : X0 - 1.15;
  box(2.3, 0.14, 3.2, px, 0, cz, NMAT.wood, { uvScale: [1.6, 2.2] });
  box(2.5, 0.1, 3.4, px, 2.32, cz, NMAT.roof, { collide: false, ground: true });
  for (const dz of [-1.5, 1.5]) box(0.14, 2.32, 0.14, px + facing * 1.05, 0, cz + dz, NMAT.trim);

  /* The sofa sits against the rear wall, facing into the room. Mirroring it
     with the house keeps both layouts correct and leaves the stairs clear. */
  {
    const sx = cx - facing * 4.32,
      sz = cz + 1.55;
    box(0.78, 0.34, 1.9, sx, 0.08, sz, NMAT.red);
    box(0.18, 0.58, 1.9, sx - facing * 0.38, 0.31, sz, NMAT.red, { collide: false });
    for (const dz of [-0.86, 0.86])
      box(0.82, 0.48, 0.18, sx, 0.08, sz + dz, NMAT.woodDk, { collide: false });
    box(0.62, 0.12, 1.58, sx + facing * 0.04, 0.42, sz, NMAT.trim, { collide: false });
  }
  box(1.3, 0.5, 0.75, cx, 0.08, cz + 0.6, NMAT.woodDk); /* table  */
  box(0.9, 1.4, 0.4, cx + facing * 3.6, 0.08, cz + 2.9, NMAT.woodDk); /* cabinet*/
  box(2.0, 0.5, 1.5, cx + facing * 2.6, H + 0.15, Z1 - 1.5, NMAT.trim); /* bed    */
  box(1.9, 0.25, 1.4, cx + facing * 2.6, H + 0.65, Z1 - 1.5, NMAT.red); /* blanket*/
  box(1.4, 0.9, 0.5, cx - facing * 3.2, H + 0.15, Z1 - 0.7, NMAT.woodDk); /* dresser */

  mapRects.push({ x: cx, z: cz, w: W + 0.15, d: D + 0.15, c: '#57503f' });
}

/* a pastel 50s sedan; alongZ parks it nose-first against the kerb */
function nukeSedan(cx, cz, alongZ, mat) {
  const bw = alongZ ? 1.85 : 4.4,
    bd = alongZ ? 4.4 : 1.85;
  box(bw, 0.62, bd, cx, 0.3, cz, mat);
  box(alongZ ? 1.7 : 2.3, 0.55, alongZ ? 2.3 : 1.7, cx, 0.92, cz, mat);
  box(alongZ ? 1.74 : 2.34, 0.4, alongZ ? 2.34 : 1.74, cx, 1.0, cz, NMAT.glassDk, {
    collide: false,
    solid: false,
  });
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const w = new THREE.Mesh(NUKE_WHEEL_CAR, MAT.rubber);
    if (alongZ) {
      w.position.set(cx + sx * 0.82, 0.33, cz + sz * 1.45);
    } else {
      /* The geometry's axle starts on X. A car running along X needs its
         axle on Z; a car running along Z already has the correct X axle. */
      w.rotation.y = PI / 2;
      w.position.set(cx + sx * 1.45, 0.33, cz + sz * 0.82);
    }
    w.userData.vehicleWheel = true;
    w.userData.vehicleAlongZ = alongZ;
    w.castShadow = true;
    scene.add(w);
  }
  mapRects.push({ x: cx, z: cz, w: bw, d: bd, c: CLUTTER_MAP });
}

/* one run of picket fencing, segmented so the texture repeats cleanly */
function nukeFenceRun(alongX, fixed, from, to) {
  const FH = 1.9;
  for (let a = from; a < to; a += 5.84) {
    const b = Math.min(a + 5.84, to),
      len = b - a;
    if (alongX)
      box(len, FH, 0.1, (a + b) / 2, 0, fixed, NMAT.wood, {
        uvScale: [len / 1.2, 1],
        map: CLUTTER_MAP,
      });
    else
      box(0.1, FH, len, fixed, 0, (a + b) / 2, NMAT.wood, {
        uvScale: [len / 1.2, 1],
        map: CLUTTER_MAP,
      });
  }
}

function nukeTree(x, z, s) {
  const trunk = new THREE.Mesh(NUKE_CYL(0.22 * s, 0.3 * s, 3.4 * s, 8), NMAT.bark);
  trunk.position.set(x, 1.7 * s, z);
  trunk.castShadow = true;
  scene.add(trunk);
  worldSolid.push(trunk);
  addCollider(x, 0, z, 0.5 * s, 3.4 * s, 0.5 * s);
  const blobs = [
    [0, 4.0, 0, 2.0],
    [0.9, 3.4, 0.5, 1.4],
    [-0.8, 3.6, -0.4, 1.5],
    [0.1, 4.9, -0.2, 1.3],
  ];
  for (const [dx, dy, dz, r] of blobs) {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 7, 5),
      Math.random() < 0.5 ? NMAT.leaf : NMAT.leaf2
    );
    f.position.set(x + dx * s, dy * s, z + dz * s);
    f.castShadow = true;
    scene.add(f);
  }
  extraShadows.push({ x, z, hw: 1.9 * s, hd: 1.9 * s, s: 0.5 });
}
function nukeBush(x, z, r) {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(r, 7, 5),
    Math.random() < 0.5 ? NMAT.leaf : NMAT.leaf2
  );
  b.position.set(x, r * 0.55, z);
  b.scale.y = 0.62;
  b.castShadow = true;
  scene.add(b);
  extraShadows.push({ x, z, hw: r * 0.9, hd: r * 0.9, s: 0.45 });
}

/* mailboxes, hydrant, flagpole, the town sign, telephone poles, and the
   backyard furniture — everything on the street that is not a vehicle */
function nukeStreetFurniture() {
  const mailbox = (x, z) => {
    box(0.08, 1.0, 0.08, x, 0, z, NMAT.woodDk, { collide: false });
    box(0.26, 0.2, 0.44, x, 1.0, z, NMAT.trim, { collide: false, cast: false });
  };
  mailbox(-4.1, -8.9);
  mailbox(4.1, 5.2);
  {
    /* fire hydrant */
    const h = new THREE.Mesh(NUKE_CYL(0.14, 0.16, 0.6, 10), NMAT.red);
    h.position.set(3.9, 0.3, -12);
    h.castShadow = true;
    scene.add(h);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), NMAT.red);
    cap.position.set(3.9, 0.62, -12);
    scene.add(cap);
  }
  {
    /* flagpole on the west lawn */
    const pole = new THREE.Mesh(NUKE_CYL(0.05, 0.06, 7, 8), MAT.metal);
    pole.position.set(-6.3, 3.5, -1.8);
    pole.castShadow = true;
    scene.add(pole);
    worldSolid.push(pole);
    addCollider(-6.3, 0, -1.8, 0.16, 7, 0.16);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.95),
      new THREE.MeshStandardMaterial({
        map: makeFlagTex(),
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0,
      })
    );
    flag.material.color.convertSRGBToLinear();
    flag.position.set(-5.53, 6.3, -1.8);
    flag.rotation.z = -0.06;
    flag.castShadow = true;
    scene.add(flag);
  }
  {
    /* the sign straddling the north end of the street */
    box(0.28, 4.3, 0.28, -4.2, 0, -26.5, NMAT.woodDk);
    box(0.28, 4.3, 0.28, 4.2, 0, -26.5, NMAT.woodDk);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(9.4, 1.5, 0.16),
      new THREE.MeshStandardMaterial({ map: makeSignTex(), roughness: 0.8, metalness: 0.02 })
    );
    sign.material.color.convertSRGBToLinear();
    sign.position.set(0, 3.75, -26.5);
    sign.castShadow = true;
    scene.add(sign);
    worldSolid.push(sign);
  }
  for (const pz of [-22, -6, 13, 26]) {
    /* telephone poles down the east verge */
    const pole = new THREE.Mesh(NUKE_CYL(0.14, 0.18, 7.2, 8), NMAT.bark);
    pole.position.set(5.6, 3.6, pz);
    pole.castShadow = true;
    scene.add(pole);
    worldSolid.push(pole);
    addCollider(5.6, 0, pz, 0.36, 7.2, 0.36);
    box(1.8, 0.12, 0.12, 5.6, 6.5, pz, NMAT.woodDk, { collide: false, cast: false });
  }
  {
    /* picnic table + grill, west backyard */
    box(1.8, 0.08, 0.9, -22, 0.72, -20, NMAT.wood);
    box(1.8, 0.06, 0.3, -22, 0.44, -19.2, NMAT.wood, { collide: false });
    box(1.8, 0.06, 0.3, -22, 0.44, -20.8, NMAT.wood, { collide: false });
    for (const [dx, dz] of [
      [-0.7, -0.3],
      [0.7, -0.3],
      [-0.7, 0.3],
      [0.7, 0.3],
    ])
      box(0.1, 0.72, 0.1, -22 + dx, 0, -20 + dz, NMAT.woodDk, { collide: false, cast: false });
    const grill = new THREE.Mesh(NUKE_CYL(0.3, 0.24, 0.55, 10), MAT.darkMetal);
    grill.position.set(-19.5, 0.6, -23);
    grill.castShadow = true;
    scene.add(grill);
    worldSolid.push(grill);
    addCollider(-19.5, 0, -23, 0.6, 1.15, 0.6);
  }
  /* swing set, east backyard */
  box(0.12, 2.4, 0.12, 21, 0, 18, NMAT.woodDk);
  box(0.12, 2.4, 0.12, 24.2, 0, 18, NMAT.woodDk);
  box(3.4, 0.1, 0.1, 22.6, 2.4, 18, NMAT.woodDk, { collide: false, cast: false });
  for (const sx of [21.9, 23.3]) {
    box(0.03, 1.4, 0.03, sx - 0.22, 0.62, 18, NMAT.trim, {
      collide: false,
      solid: false,
      cast: false,
    });
    box(0.03, 1.4, 0.03, sx + 0.22, 0.62, 18, NMAT.trim, {
      collide: false,
      solid: false,
      cast: false,
    });
    box(0.5, 0.06, 0.25, sx, 0.56, 18, NMAT.woodDk, { collide: false, cast: false });
  }
}
