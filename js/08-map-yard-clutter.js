'use strict';
/* -------------------------------------------------------------------------
   Yard clutter.

   The difference between "boxes on a plane" and a place someone works is the
   junk nobody bothered to move. None of this is cover — it is silhouette, scale
   reference and evidence of use. Everything merges per material so the whole
   pass costs about a dozen draw calls.
   ------------------------------------------------------------------------- */
{
  const MC = {
    wood: new THREE.MeshStandardMaterial({
      color: sRGB(0x8a7250),
      roughness: 0.95,
      metalness: 0.02,
    }),
    woodDk: new THREE.MeshStandardMaterial({
      color: sRGB(0x5e4c33),
      roughness: 0.96,
      metalness: 0.02,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: sRGB(0x323231),
      roughness: 0.98,
      metalness: 0.0,
    }),
    plastic: new THREE.MeshStandardMaterial({
      color: sRGB(0xc4571f),
      roughness: 0.62,
      metalness: 0.03,
    }),
    card: new THREE.MeshStandardMaterial({
      color: sRGB(0x9b7a52),
      roughness: 0.97,
      metalness: 0.0,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: sRGB(0x767c83),
      roughness: 0.52,
      metalness: 0.18,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: sRGB(0x3d4247),
      roughness: 0.62,
      metalness: 0.16,
    }),
    rusty: new THREE.MeshStandardMaterial({
      color: sRGB(0x6b5040),
      roughness: 0.93,
      metalness: 0.05,
    }),
    yellow: new THREE.MeshStandardMaterial({
      color: sRGB(0xb08a1e),
      roughness: 0.68,
      metalness: 0.1,
    }),
    sack: new THREE.MeshStandardMaterial({
      color: sRGB(0x7d7358),
      roughness: 0.99,
      metalness: 0.0,
    }),
    green: new THREE.MeshStandardMaterial({
      color: sRGB(0x4d5f45),
      roughness: 0.72,
      metalness: 0.08,
    }),
  };
  /* every clutter material is vertex-coloured so merged props still vary:
     one flat tint across forty crates is what makes filler look procedural */
  for (const k in MC) MC[k].vertexColors = true;
  const bucket = new Map(); // material -> geometry list
  const V = new THREE.Vector3(),
    Q = new THREE.Quaternion(),
    E = new THREE.Euler();
  function put(geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.clone();
    E.set(rx || 0, ry || 0, rz || 0);
    Q.setFromEuler(E);
    V.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q, V));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const t = rand(0.74, 1.16),
      warm = rand(0.94, 1.07);
    for (let i = 0; i < n; i++) {
      col[i * 3] = t * warm;
      col[i * 3 + 1] = t;
      col[i * 3 + 2] = t / warm;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(g);
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
  const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 16);
  const TOR = new THREE.TorusGeometry(1, 0.34, 8, 18);
  const CONE = new THREE.ConeGeometry(1, 1, 10);

  /* ---------- pallet: 3 runners, 5 deck boards ---------- */
  function pallet(px, py, pz, ry, tilt) {
    for (let i = 0; i < 3; i++)
      put(BOX, MC.woodDk, px, py + 0.05, pz, 0, ry, 0, 1.18, 0.09, 0.1, 0);
    /* re-place runners with correct offsets */
    bucket.get(MC.woodDk).splice(-3, 3);
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 0.44;
      const c = Math.cos(ry),
        s = Math.sin(ry);
      put(BOX, MC.woodDk, px + s * off, py + 0.05, pz + c * off, 0, ry, 0, 1.18, 0.09, 0.1);
    }
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * 0.24;
      const c = Math.cos(ry),
        s = Math.sin(ry);
      put(BOX, MC.wood, px + s * off, py + 0.13, pz + c * off, tilt || 0, ry, 0, 1.18, 0.045, 0.16);
    }
  }
  const palletSpots = [
    [-5.2, -6.4],
    [-4.4, -5.2],
    [14.2, 7.8],
    [14.4, 6.6],
    [21.6, -16.4],
    [-12.6, 14.2],
    [2.6, -23.4],
    [27.2, 10.4],
    [-22.4, 3.2],
    [9.4, 20.6],
  ];
  /* Clutter is scenery, but scenery you can walk through is the loudest
     "unfinished" signal in the map. Anything that stands high enough to read as
     an object gets an AABB; `blocked` already ignores colliders whose top is
     under the 0.30 step lip, so flat litter stays walk-over for free and these
     calls cost nothing for the boards and bricks. */
  palletSpots.forEach(([px, pz], i) => {
    const n = randI(1, 3),
      ry = rand(0, PI);
    for (let k = 0; k < n; k++)
      pallet(px + rand(-0.05, 0.05), k * 0.18, pz + rand(-0.05, 0.05), ry + rand(-0.12, 0.12));
    extraShadows.push({ x: px, z: pz, hw: 0.65, hd: 0.65, s: 0.5 });
    const top = 0.15 + (n - 1) * 0.18;
    addCollider(px, 0, pz, 1.24, top, 1.24);
    /* Only the stacks that actually stop you belong on the minimap; a single
       pallet tops out under the step lip and is walked straight over. */
    if (top > 0.3) mapRects.push({ x: px, z: pz, w: 1.24, d: 1.24, c: CLUTTER_MAP });
  });
  /* a couple leaning against containers */
  put(BOX, MC.wood, 11.0, 0.62, -14.2, 0, 0.1, 0.42, 1.2, 1.15, 0.11);
  put(BOX, MC.wood, 11.1, 0.6, 4.6, 0, 0.0, -0.38, 1.2, 1.15, 0.11);
  addCollider(11.0, 0, -14.2, 1.2, 1.2, 0.6);
  addCollider(11.1, 0, 4.6, 1.2, 1.2, 0.6);
  mapRects.push({ x: 11.0, z: -14.2, w: 1.2, d: 0.6, c: CLUTTER_MAP });
  mapRects.push({ x: 11.1, z: 4.6, w: 1.2, d: 0.6, c: CLUTTER_MAP });

  /* ---------- tyre stacks ---------- */
  const tyreSpots = [
    [-6.8, 4.2],
    [17.8, -9.6],
    [-18.2, -18.6],
    [24.6, 17.2],
    [6.2, -11.4],
    [-25.4, -11.0],
  ];
  tyreSpots.forEach(([px, pz]) => {
    const n = randI(2, 5);
    for (let k = 0; k < n; k++)
      put(
        TOR,
        MC.rubber,
        px + rand(-0.06, 0.06),
        0.14 + k * 0.24,
        pz + rand(-0.06, 0.06),
        PI / 2,
        rand(0, 3),
        0,
        0.42,
        0.42,
        0.42
      );
    extraShadows.push({ x: px, z: pz, hw: 0.48, hd: 0.48, s: 0.62 });
    addCollider(px, 0, pz, 1.06, 0.28 + (n - 1) * 0.24, 1.06);
    mapRects.push({ x: px, z: pz, w: 1.06, d: 1.06, c: CLUTTER_MAP });
  });
  /* a few tyres lying flat and alone */
  for (const [px, pz] of [
    [1.4, -16.2],
    [-14.8, -2.4],
    [20.2, 3.4],
    [-2.6, 19.4],
  ]) {
    put(TOR, MC.rubber, px, 0.14, pz, PI / 2, rand(0, 3), 0, 0.42, 0.42, 0.42);
    extraShadows.push({ x: px, z: pz, hw: 0.44, hd: 0.44, s: 0.45 });
  }

  /* ---------- traffic cones ---------- */
  const coneSpots = [
    [-1.2, -10.4],
    [0.6, -10.9],
    [2.4, -11.2],
    [15.4, 11.6],
    [16.9, 11.3],
    [-16.2, 7.4],
    [8.8, 24.2],
    [22.4, -20.6],
    [-9.4, -24.2],
    [4.2, 2.6],
  ];
  coneSpots.forEach(([px, pz]) => {
    const tip = Math.random() < 0.18;
    if (tip) {
      put(CONE, MC.plastic, px, 0.16, pz, PI / 2, rand(0, 6), 0, 0.2, 0.62, 0.2);
      put(BOX, MC.dark, px, 0.02, pz, 0, rand(0, 6), 0, 0.4, 0.04, 0.4);
    } else {
      put(BOX, MC.dark, px, 0.02, pz, 0, 0, 0, 0.42, 0.045, 0.42);
      put(CONE, MC.plastic, px, 0.34, pz, 0, 0, 0, 0.19, 0.62, 0.19);
      put(CYL, MC.card, px, 0.4, pz, 0, 0, 0, 0.145, 0.09, 0.145);
    }
    extraShadows.push({ x: px, z: pz, hw: 0.24, hd: 0.24, s: 0.5 });
    /* a knocked-over cone is flat enough to stride over; an upright one isn't */
    if (!tip) addCollider(px, 0, pz, 0.4, 0.66, 0.4);
  });

  /* ---------- cable spools ---------- */
  for (const [px, pz, ry] of [
    [-19.6, 20.4, 0.4],
    [10.6, -25.2, 1.1],
    [28.0, -9.4, 0.0],
  ]) {
    put(CYL16, MC.woodDk, px, 0.92, pz, PI / 2, ry, 0, 0.92, 0.14, 0.92);
    put(CYL16, MC.woodDk, px, 0.92, pz, PI / 2, ry, 0, 0.92, 0.14, 0.92);
    bucket.get(MC.woodDk).splice(-2, 2);
    const c = Math.cos(ry),
      s = Math.sin(ry);
    put(CYL16, MC.woodDk, px + c * 0.3, 0.92, pz - s * 0.3, PI / 2, ry, 0, 0.92, 0.12, 0.92);
    put(CYL16, MC.woodDk, px - c * 0.3, 0.92, pz + s * 0.3, PI / 2, ry, 0, 0.92, 0.12, 0.92);
    put(CYL16, MC.dark, px, 0.92, pz, PI / 2, ry, 0, 0.46, 0.56, 0.46);
    extraShadows.push({ x: px, z: pz, hw: 0.95, hd: 0.95, s: 0.62 });
    addCollider(px, 0, pz, 1.9, 1.84, 1.9);
    mapRects.push({ x: px, z: pz, w: 1.9, d: 1.9, c: '#4e555c' });
  }

  /* ---------- cardboard, planks, bricks ---------- */
  for (let i = 0; i < 26; i++) {
    const px = rand(-27, 27),
      pz = rand(-27, 27);
    if (Math.abs(px) < 3 && Math.abs(pz - 24) < 4) continue; // keep spawn clear
    const w = rand(0.32, 0.62),
      h = rand(0.24, 0.5),
      d = rand(0.32, 0.6);
    const flat = Math.random() < 0.3;
    put(
      BOX,
      MC.card,
      px,
      flat ? h * 0.14 : h / 2,
      pz,
      flat ? (PI / 2) * rand(0.8, 1.0) : 0,
      rand(0, 6),
      flat ? rand(-0.3, 0.3) : 0,
      w,
      flat ? h * 0.28 : h,
      d
    );
    extraShadows.push({ x: px, z: pz, hw: w * 0.6, hd: d * 0.6, s: 0.42 });
    if (!flat) addCollider(px, 0, pz, w * 1.05, h, d * 1.05);
  }
  for (let i = 0; i < 14; i++) {
    const px = rand(-27, 27),
      pz = rand(-27, 27);
    put(BOX, MC.wood, px, 0.035, pz, 0, rand(0, 6), 0, rand(1.2, 2.6), 0.06, rand(0.14, 0.22));
  }
  for (let i = 0; i < 40; i++) {
    const px = rand(-28, 28),
      pz = rand(-28, 28);
    put(
      BOX,
      MC.rusty,
      px,
      0.035,
      pz,
      rand(-0.3, 0.3),
      rand(0, 6),
      rand(-0.3, 0.3),
      rand(0.1, 0.24),
      0.07,
      rand(0.06, 0.12)
    );
  }

  /* ---------- gas cylinder rack ---------- */
  {
    const px = -13.4,
      pz = -11.2,
      ry = 0.2;
    put(BOX, MC.steel, px, 0.06, pz, 0, ry, 0, 1.9, 0.12, 0.6);
    put(BOX, MC.steel, px, 1.3, pz, 0, ry, 0, 1.9, 0.08, 0.08);
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * 0.34,
        c = Math.cos(ry),
        s = Math.sin(ry);
      put(
        CYL,
        i % 2 ? MC.green : MC.rusty,
        px + c * off,
        0.75,
        pz - s * off,
        0,
        0,
        0,
        0.145,
        1.3,
        0.145
      );
      put(CYL, MC.dark, px + c * off, 1.44, pz - s * off, 0, 0, 0, 0.07, 0.14, 0.07);
    }
    addCollider(px, 0, pz, 2.0, 1.5, 0.7);
    extraShadows.push({ x: px, z: pz, hw: 1.0, hd: 0.4, s: 0.6 });
    mapRects.push({ x: px, z: pz, w: 2.0, d: 0.7, c: '#4e555c' });
  }
  /* loose cylinders on their side */
  for (const [px, pz, ry] of [
    [7.2, 13.4, 0.7],
    [-21.2, -16.8, 2.1],
  ]) {
    put(CYL, MC.rusty, px, 0.145, pz, PI / 2, ry, 0, 0.145, 1.25, 0.145);
    extraShadows.push({ x: px, z: pz, hw: 0.6, hd: 0.3, s: 0.45 });
  }

  /* ---------- skip / dumpster ---------- */
  {
    const px = -11.8,
      pz = 17.6,
      ry = 0.16;
    put(BOX, MC.rusty, px, 0.62, pz, 0, ry, 0, 2.9, 1.24, 1.55);
    put(BOX, MC.dark, px, 1.26, pz, 0, ry, 0, 2.98, 0.1, 1.63);
    put(BOX, MC.dark, px, 0.16, pz, 0, ry, 0, 3.0, 0.14, 1.62);
    /* spilling debris */
    for (let i = 0; i < 7; i++)
      put(
        BOX,
        i % 2 ? MC.card : MC.wood,
        px + rand(-1.2, 1.2),
        1.32 + rand(0, 0.2),
        pz + rand(-0.6, 0.6),
        rand(0, 1),
        rand(0, 6),
        rand(0, 1),
        rand(0.2, 0.5),
        rand(0.14, 0.3),
        rand(0.2, 0.4)
      );
    addCollider(px, 0, pz, 3.0, 1.35, 1.65);
    mapRects.push({ x: px, z: pz, w: 3.0, d: 1.65, c: '#4e555c' });
  }

  /* ---------- sandbag positions ---------- */
  for (const [px, pz, ry] of [
    [3.6, -2.2, 0.3],
    [-18.0, -1.0, 1.4],
  ]) {
    for (let row = 0; row < 3; row++) {
      const n = 5 - row;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.46;
        const c = Math.cos(ry),
          s = Math.sin(ry);
        put(
          BOX,
          MC.sack,
          px + c * off,
          0.11 + row * 0.21,
          pz - s * off,
          0,
          ry + rand(-0.1, 0.1),
          0,
          0.44,
          0.21,
          0.3
        );
      }
    }
    addCollider(px, 0, pz, 2.4, 0.66, 0.4);
    extraShadows.push({ x: px, z: pz, hw: 1.2, hd: 0.3, s: 0.6 });
    mapRects.push({ x: px, z: pz, w: 2.4, d: 0.4, c: '#4e555c' });
  }

  /* ---------- yard light masts ---------- */
  for (const [px, pz, ry] of [
    [-9.0, -27.0, 0.0],
    [22.0, -27.5, 0.0],
    [-27.5, 9.0, PI / 2],
    [27.5, 26.0, PI / 2],
    [0.5, 27.5, PI],
  ]) {
    put(CYL, MC.dark, px, 3.6, pz, 0, 0, 0, 0.1, 7.2, 0.1);
    put(BOX, MC.dark, px, 0.09, pz, 0, ry, 0, 0.44, 0.18, 0.44);
    const c = Math.cos(ry),
      s = Math.sin(ry);
    put(BOX, MC.dark, px + c * 0.42, 7.14, pz - s * 0.42, 0, ry, 0, 0.9, 0.07, 0.07);
    for (const side of [-1, 1]) {
      put(
        BOX,
        MC.dark,
        px + c * 0.78,
        7.02,
        pz - s * 0.78 + side * 0.28,
        0.34,
        ry,
        0,
        0.52,
        0.14,
        0.34
      );
    }
    addCollider(px, 0, pz, 0.3, 7.2, 0.3);
    extraShadows.push({ x: px, z: pz, hw: 0.3, hd: 0.3, s: 0.6 });
  }

  /* ---------- forklift, parked by the loading bay ---------- */
  {
    const px = 17.6,
      pz = 1.2,
      ry = -0.5;
    const c = Math.cos(ry),
      s = Math.sin(ry);
    const L = (fx, fz) => [px + c * fx + s * fz, pz - s * fx + c * fz];
    let p;
    p = L(0, 0);
    put(BOX, MC.yellow, p[0], 0.62, p[1], 0, ry, 0, 1.05, 0.7, 1.6); // body
    p = L(0, -0.5);
    put(BOX, MC.dark, p[0], 1.02, p[1], 0, ry, 0, 0.95, 0.22, 0.55); // seat back
    p = L(0, -0.2);
    put(BOX, MC.dark, p[0], 0.99, p[1], 0, ry, 0, 0.8, 0.1, 0.5); // seat
    p = L(0, 0.85);
    put(BOX, MC.dark, p[0], 1.06, p[1], 0, ry, 0, 0.72, 0.06, 0.1); // wheel
    /* mast */
    for (const side of [-0.34, 0.34]) {
      p = L(side, 1.02);
      put(BOX, MC.steel, p[0], 1.3, p[1], 0, ry, 0, 0.11, 2.55, 0.13);
    }
    p = L(0, 1.02);
    put(BOX, MC.steel, p[0], 2.52, p[1], 0, ry, 0, 0.8, 0.12, 0.14);
    /* forks */
    for (const side of [-0.28, 0.28]) {
      p = L(side, 1.42);
      put(BOX, MC.steel, p[0], 0.08, p[1], 0, ry, 0, 0.14, 0.05, 0.95);
      p = L(side, 1.02);
      put(BOX, MC.steel, p[0], 0.28, p[1], 0, ry, 0, 0.14, 0.45, 0.09);
    }
    /* overhead guard */
    for (const [fx, fz] of [
      [-0.44, 0.5],
      [0.44, 0.5],
      [-0.44, -0.6],
      [0.44, -0.6],
    ]) {
      p = L(fx, fz);
      put(BOX, MC.steel, p[0], 1.55, p[1], 0, ry, 0, 0.07, 1.3, 0.07);
    }
    p = L(0, -0.05);
    put(BOX, MC.steel, p[0], 2.22, p[1], 0, ry, 0, 1.0, 0.07, 1.25);
    /* wheels */
    for (const [fx, fz] of [
      [-0.55, 0.62],
      [0.55, 0.62],
      [-0.45, -0.62],
      [0.45, -0.62],
    ]) {
      p = L(fx, fz);
      put(CYL, MC.rubber, p[0], 0.3, p[1], 0, ry, PI / 2, 0.3, 0.2, 0.3);
    }
    addCollider(px, 0, pz, 1.9, 2.5, 2.4);
    mapRects.push({ x: px, z: pz, w: 1.9, d: 2.4, c: '#5a6068' });
    extraShadows.push({ x: px, z: pz, hw: 0.9, hd: 1.2, s: 0.7 });
  }

  /* ---------- pipes, as before but grouped into racks ---------- */
  {
    const rackAt = (px, pz, ry) => {
      const c = Math.cos(ry),
        s = Math.sin(ry);
      for (const side of [-1.6, 1.6]) {
        put(BOX, MC.steel, px + c * side, 0.2, pz - s * side, 0, ry, 0, 0.12, 0.4, 1.0);
      }
      let row = 0;
      for (let lvl = 0; lvl < 3; lvl++) {
        const n = 4 - lvl;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 0.36;
          put(CYL, MC.rusty, px, 0.44 + lvl * 0.32, pz + off, 0, ry, PI / 2, 0.16, 3.4, 0.16);
          row++;
        }
      }
      addCollider(px, 0, pz, 3.6, 1.1, 1.6);
      extraShadows.push({ x: px, z: pz, hw: 1.8, hd: 0.8, s: 0.62 });
      mapRects.push({ x: px, z: pz, w: 3.6, d: 1.6, c: '#4e555c' });
    };
    rackAt(-24.0, 14.0, 0.0);
    rackAt(6.5, -27.0, PI / 2);
  }
  /* loose pipes on the deck */
  for (let i = 0; i < 5; i++) {
    const px = rand(-26, 26),
      pz = rand(-26, 26);
    put(CYL, MC.rusty, px, 0.16, pz, 0, rand(0, 6), PI / 2, 0.16, rand(3, 5.5), 0.16);
    extraShadows.push({ x: px, z: pz, hw: 2.0, hd: 0.3, s: 0.42 });
  }

  /* ---------- merge ---------- */
  for (const [mat, geos] of bucket) {
    const m = new THREE.Mesh(mergeGeoms(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    worldSolid.push(m);
  }
}
