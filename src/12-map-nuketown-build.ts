// @ts-nocheck -- procedural scene builder; tighten after shared builder overloads are typed.
'use strict';
/* -------------------------------------------------------------------------
   NUKETOWN assembly — the ground, the backdrop, and buildNuketown() itself.
   Piece builders and materials live in 11-map-nuketown.js.
   ------------------------------------------------------------------------- */

/* lawn floor plus the painted overlay: road, sidewalks, driveways, dirt */
function nukeGround() {
  {
    const g = new THREE.PlaneGeometry(HALF * 2 + 16, HALF * 2 + 16);
    g.rotateX(-PI / 2);
    const floor = new THREE.Mesh(g, NMAT.grass);
    floor.receiveShadow = true;
    scene.add(floor);
    worldSolid.push(floor);
    groundMesh.push(floor);
  }
  {
    const SPAN = HALF * 2 + 16,
      S = 2048,
      PPM = S / SPAN;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const WX = (wx) => (wx + SPAN / 2) * PPM;
    const WZ = (wz) => (wz + SPAN / 2) * PPM;
    const M = (m) => m * PPM;

    /* lawn tone variation so the green reads as yards, not a carpet */
    for (let i = 0; i < 140; i++) {
      const px = Math.random() * S,
        py = Math.random() * S,
        r = rand(50, 300);
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      const dark = Math.random() < 0.6;
      const col = dark ? '30,48,20' : '150,170,100';
      g2.addColorStop(0, `rgba(${col},${dark ? rand(0.06, 0.16) : rand(0.04, 0.1)})`);
      g2.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g2;
      x.beginPath();
      x.arc(px, py, r, 0, 7);
      x.fill();
    }

    /* fade the lawn back before anything is painted over it, so later layers
       stay crisp and only the grass looks weathered */
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 300; i++) {
      const px = Math.random() * S,
        py = Math.random() * S,
        r = rand(6, 60);
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, `rgba(0,0,0,${rand(0.15, 0.5)})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(px, py, r, 0, 7);
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';

    /* the street: asphalt strip the full length of the map */
    x.fillStyle = '#3b3b3e';
    x.fillRect(WX(-3.4), WZ(-HALF), M(6.8), M(HALF * 2));
    for (let i = 0; i < 900; i++) {
      const px = rand(-3.4, 3.4),
        pz = rand(-HALF, HALF);
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '18,18,20' : '120,120,124'},${rand(0.05, 0.16)})`;
      x.fillRect(WX(px), WZ(pz), M(rand(0.05, 0.3)), M(rand(0.05, 0.3)));
    }
    for (let i = 0; i < 10; i++) {
      /* tar patches and cracks */
      x.strokeStyle = `rgba(20,20,22,${rand(0.3, 0.6)})`;
      x.lineWidth = M(rand(0.04, 0.12));
      x.beginPath();
      let px = rand(-3, 3),
        pz = rand(-HALF, HALF);
      x.moveTo(WX(px), WZ(pz));
      for (let s2 = 0; s2 < 5; s2++) {
        px += rand(-1.5, 1.5);
        pz += rand(-2.5, 2.5);
        x.lineTo(WX(px), WZ(pz));
      }
      x.stroke();
    }
    /* dashed centre line, worn */
    x.fillStyle = 'rgba(212,206,188,.5)';
    for (let z = -HALF; z < HALF; z += 3.2) x.fillRect(WX(-0.09), WZ(z), M(0.18), M(1.6));

    /* sidewalks with kerb shadow and expansion joints */
    for (const sx of [-4.6, 3.4]) {
      x.fillStyle = '#8f918c';
      x.fillRect(WX(sx), WZ(-HALF), M(1.2), M(HALF * 2));
      x.fillStyle = 'rgba(40,40,42,.5)';
      x.fillRect(WX(sx === -4.6 ? -3.5 : 3.4), WZ(-HALF), M(0.1), M(HALF * 2));
      x.fillStyle = 'rgba(50,50,52,.4)';
      for (let z = -HALF; z < HALF; z += 1.55) x.fillRect(WX(sx), WZ(z), M(1.2), M(0.05));
    }

    /* driveways */
    x.fillStyle = '#7f8078';
    x.fillRect(WX(-8.0), WZ(-10.0), M(4.6), M(2.2)); /* west, car parked on it */
    x.fillRect(WX(3.4), WZ(7.6), M(4.6), M(2.2)); /* east */

    /* worn dirt: paths from the front doors to the kerb, backyard patches */
    const dirt = (wx, wz, r, a) => {
      const g2 = x.createRadialGradient(WX(wx), WZ(wz), 0, WX(wx), WZ(wz), M(r));
      g2.addColorStop(0, `rgba(122,100,70,${a})`);
      g2.addColorStop(1, 'rgba(122,100,70,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(WX(wx), WZ(wz), M(r), 0, 7);
      x.fill();
    };
    dirt(-6.0, -6.0, 1.6, 0.5);
    dirt(-4.2, -6.0, 1.2, 0.4);
    dirt(6.0, 4.0, 1.6, 0.5);
    dirt(4.2, 4.0, 1.2, 0.4);
    dirt(-22, -20, 3.5, 0.35);
    dirt(-19, -24, 2.5, 0.3);
    dirt(22, 18, 3.0, 0.35);
    dirt(25, 24, 2.5, 0.3);
    dirt(0, -26, 2.0, 0.25); /* under the sign, feet wear the lawn away */

    /* a gentle second wear pass — it greys the paint but never punches
       through to the lawn underneath */
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 220; i++) {
      const px = Math.random() * S,
        py = Math.random() * S,
        r = rand(6, 48);
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, `rgba(0,0,0,${rand(0.06, 0.22)})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(px, py, r, 0, 7);
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = MAXANISO;
    tex.encoding = THREE.sRGBEncoding;
    const og = new THREE.PlaneGeometry(SPAN, SPAN);
    og.rotateX(-PI / 2);
    const overlay = new THREE.Mesh(
      og,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    overlay.position.y = 0.008;
    overlay.renderOrder = 0;
    scene.add(overlay);
  }
}

/* the world past the picket line: desert, mesas, the test site. None of it
   is collidable or shootable — it parallaxes, which a backdrop cannot. */
function nukeBackdrop() {
  const gp = new THREE.PlaneGeometry(460, 460);
  gp.rotateX(-PI / 2);
  const far = new THREE.Mesh(gp, new THREE.MeshBasicMaterial({ color: sRGB(0xa5906c), fog: true }));
  far.position.y = -0.06;
  scene.add(far);

  const distant = new THREE.Group();
  const dm = (c) => new THREE.MeshLambertMaterial({ color: sRGB(c) });
  const MD = {
    mesa: dm(0x8f6f55),
    mesaD: dm(0x7d5f48),
    sand: dm(0xa5906c),
    h1: dm(0xb8a988),
    h2: dm(0x9db0b8),
    h3: dm(0xb89d9d),
    roofD: dm(0x6b5a4c),
    pale: dm(0x9a9788),
    dark: dm(0x4a4540),
  };
  const put = (geo, mat, x, y, z, ry, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    if (sx !== undefined) m.scale.set(sx, sy, sz);
    m.castShadow = false;
    m.receiveShadow = false;
    distant.add(m);
    return m;
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYLU = new THREE.CylinderGeometry(1, 1, 1, 14);

  /* flat-topped mesas ringing the site */
  for (const [x, z, w, h, d, ry] of [
    [-120, -90, 60, 14, 40, 0.3],
    [130, -60, 55, 18, 35, 1.2],
    [40, -140, 80, 12, 50, 0.1],
    [-90, 120, 70, 16, 44, 2.2],
    [150, 90, 60, 13, 38, 2.9],
  ]) {
    put(BOX, MD.mesa, x, h / 2, z, ry, w, h, d);
    put(BOX, MD.mesaD, x, h + 1.2, z, ry, w * 0.7, 2.4, d * 0.7);
  }
  /* the suburb that was never finished: bare house silhouettes */
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * PI * 2 + 0.35,
      r = rand(52, 88);
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
    put(BOX, pick([MD.h1, MD.h2, MD.h3]), x, 2.2, z, a, 9, 4.4, 7);
    put(BOX, MD.roofD, x, 5.0, z, a, 9.6, 1.6, 7.6);
  }
  /* water tower */
  {
    const g = new THREE.Group();
    g.position.set(75, 0, -85);
    for (const [dx, dz] of [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ]) {
      const l = new THREE.Mesh(BOX, MD.dark);
      l.position.set(dx, 9, dz);
      l.scale.set(0.7, 18, 0.7);
      l.rotation.set(dz * 0.02, 0, -dx * 0.02);
      g.add(l);
    }
    const tank = new THREE.Mesh(CYLU, MD.pale);
    tank.position.set(0, 21, 0);
    tank.scale.set(6, 8, 6);
    g.add(tank);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14), MD.roofD);
    cone.position.set(0, 26.6, 0);
    cone.scale.set(6.2, 3, 6.2);
    g.add(cone);
    distant.add(g);
  }
  /* the test tower itself, thin and far away */
  {
    const g = new THREE.Group();
    g.position.set(-100, 0, 55);
    for (const [dx, dz] of [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ]) {
      const l = new THREE.Mesh(BOX, MD.dark);
      l.position.set(dx * 0.8, 16, dz * 0.8);
      l.scale.set(0.5, 32, 0.5);
      l.rotation.set(dz * 0.03, 0, -dx * 0.03);
      g.add(l);
    }
    const cab = new THREE.Mesh(BOX, MD.dark);
    cab.position.set(0, 33, 0);
    cab.scale.set(4, 3, 4);
    g.add(cab);
    distant.add(g);
  }
  /* telephone poles marching out along the road both ways */
  for (const pz of [-58, -46, -36, 36, 46, 58])
    put(CYLU, MD.dark, 5.6, 3.6, pz, 0, 0.16, 7.2, 0.16);

  /* collapse the backdrop into one draw per material */
  const buckets = new Map();
  distant.updateMatrixWorld(true);
  distant.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  for (const [mat, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeoms(geos), mat);
    m.castShadow = m.receiveShadow = false;
    m.frustumCulled = false;
    scene.add(m);
  }
}

function buildNuketown() {
  nukeGround();

  /* the two tract houses */
  nukeHouse(-13, -6, 1, NMAT.sidY);
  nukeHouse(13, 4, -1, NMAT.sidB);

  /* ---- vehicles ---- */
  {
    /* the bus, mid-street, half up on the west kerb */
    const bx = -2.0,
      bz = -3;
    box(2.5, 2.3, 8.2, bx, 0.42, bz, NMAT.busGrn, { uvScale: [3, 1], map: CLUTTER_MAP });
    box(2.56, 0.62, 8.26, bx, 2.1, bz, NMAT.trim, { collide: false, solid: false });
    box(2.58, 0.75, 7.5, bx, 1.15, bz, NMAT.glassDk, { collide: false, solid: false });
    box(2.4, 0.34, 0.5, bx, 0.5, bz - 4.25, MAT.darkMetal, { collide: false, solid: false });
    box(2.4, 0.34, 0.5, bx, 0.5, bz + 4.25, MAT.darkMetal, { collide: false, solid: false });
    for (const dz of [-2.7, 0, 2.7])
      for (const dx of [-1.05, 1.05]) {
        const w = new THREE.Mesh(NUKE_WHEEL_BUS, MAT.rubber);
        w.position.set(bx + dx, 0.42, bz + dz);
        w.castShadow = true;
        scene.add(w);
      }
  }
  {
    /* the moving van, angled at the kerb opposite */
    const tx = 1.9,
      tz = 8.2;
    box(2.5, 2.6, 5.6, tx, 0.55, tz + 0.9, NMAT.truckWh, { map: CLUTTER_MAP });
    box(2.3, 1.7, 2.0, tx, 0.42, tz - 3.2, NMAT.truckTl);
    box(2.34, 0.55, 0.7, tx, 1.15, tz - 4.05, NMAT.glassDk, { collide: false, solid: false });
    box(2.56, 0.4, 5.66, tx, 1.75, tz + 0.9, NMAT.red, { collide: false, solid: false });
    for (const dz of [-4.0, -2.6])
      for (const dx of [-0.95, 0.95]) {
        const w = new THREE.Mesh(NUKE_WHEEL_BUS, MAT.rubber);
        w.position.set(tx + dx, 0.42, tz + dz);
        w.castShadow = true;
        scene.add(w);
      }
    for (const dz of [0.0, 2.4])
      for (const dx of [-1.05, 1.05]) {
        const w = new THREE.Mesh(NUKE_WHEEL_BUS, MAT.rubber);
        w.position.set(tx + dx, 0.42, tz + dz);
        w.castShadow = true;
        scene.add(w);
      }
  }
  nukeSedan(-5.4, -8.9, false, NMAT.carPink);
  nukeSedan(5.9, 8.7, true, NMAT.carTeal);

  /* ---- wooden fences: the perimeter, and the backyard dividers ---- */
  const F = 29.2;
  nukeFenceRun(true, -F, -F, F);
  nukeFenceRun(true, F, -F, F);
  nukeFenceRun(false, -F, -F, F);
  nukeFenceRun(false, F, -F, F);
  for (const [px, pz] of [
    [-F, -F],
    [F, -F],
    [-F, F],
    [F, F],
  ])
    box(0.24, 2.15, 0.24, px, 0, pz, NMAT.woodDk);
  /* backyard dividers, each with a gate gap so the AI can circulate */
  nukeFenceRun(true, -14, -F, -24.8);
  nukeFenceRun(true, -14, -23.5, -18.1); /* west  */
  nukeFenceRun(true, 12, 18.1, 23.4);
  nukeFenceRun(true, 12, 24.7, F); /* east  */

  /* ---- greenery ---- */
  nukeTree(-24, -20, 1.0);
  nukeTree(24, 20, 1.1);
  nukeTree(-15, 17, 0.9);
  nukeBush(-7.5, -2.7, 0.8);
  nukeBush(-16.5, -1.4, 0.7);
  nukeBush(7.5, 0.6, 0.8);
  nukeBush(7.5, 7.4, 0.7);
  nukeBush(-27.5, 10, 0.9);
  nukeBush(27, -10, 0.9);

  nukeStreetFurniture();

  /* ---- invisible hard walls so nobody escapes ---- */
  {
    const invis = new THREE.MeshBasicMaterial({ visible: false });
    const t = 1.2;
    [
      [0, -HALF - t / 2, HALF * 2 + t * 2, t],
      [0, HALF + t / 2, HALF * 2 + t * 2, t],
    ].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 12, d), invis);
      m.position.set(x, 6, z);
      scene.add(m);
      worldSolid.push(m);
      addCollider(x, 0, z, w, 12, d);
    });
    [
      [-HALF - t / 2, 0, t, HALF * 2 + t * 2],
      [HALF + t / 2, 0, t, HALF * 2 + t * 2],
    ].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 12, d), invis);
      m.position.set(x, 6, z);
      scene.add(m);
      worldSolid.push(m);
      addCollider(x, 0, z, w, 12, d);
    });
  }

  nukeBackdrop();

  /* contact shadows under everything that meets the lawn */
  const contactShadows = makeContactShadows();
  for (const c of colliders) {
    if (c.minY > 0.22) continue;
    const hw = (c.maxX - c.minX) / 2,
      hd = (c.maxZ - c.minZ) / 2;
    if (hw < 0.12 || hd < 0.12) continue;
    const cx = (c.minX + c.maxX) / 2,
      cz = (c.minZ + c.maxZ) / 2;
    contactShadows.add(cx, cz, hw * 0.98, hd * 0.98, 0.62);
    contactShadows.add(cx, cz, hw + 0.55, hd + 0.55, 0.17);
  }
  for (const e of extraShadows) contactShadows.add(e.x, e.z, e.hw, e.hd, e.s);
  contactShadows.build();

  /* this map's air and its idea of where the sun is */
  dustField = makeDustField(NUKE_SUN);
  shaftAxis.copy(NUKE_SUN).negate();
}

const _preNukeScene = new Set(scene.children);
{
  /* the fog has to be in place before the contact shadows bake its colour */
  scene.fog.color.set(0xc2cfd8);
  scene.fog.density = 0.0052;
  buildNuketown();
}
const MAP_NUKE = captureMap(_preNukeScene, {
  id: 'nuke',
  title: '核弹小镇',
  tag: '核弹小镇',
  sub: '核弹小镇 — 内华达试验场',
  /* like the original: you come in behind your house, the squad behind theirs */
  spawn: { x: -24, z: -6 },
  spawnYaw: -PI / 2, // facing east: the rear door is six metres dead ahead
  enemyZone: { x0: 19.5, x1: 27.5, z0: -9, z1: 10 }, // behind the east house
  routes: [
    [
      [1, -22],
      [2, -12],
      [-1, -12],
      [1, 2],
      [-1, 12],
      [1, 20],
    ], // street north/south
    [
      [9.5, 1.5],
      [13, 2],
      [16.5, 3],
      [13, 4.5],
      [15.5, 6.3],
      [9.5, 5.5],
    ], // east house, UPSTAIRS (north lane — the upper floor only spans z 1..7)
    [
      [10, 4],
      [16, 5],
      [10, 2],
      [16.5, 7],
    ], // east house, UPSTAIRS
    [
      [-24, -19],
      [-14, -18],
      [-10, -24],
      [-20, -25],
    ], // west backyard / north lawn
    [
      [24, 15],
      [14, 16],
      [10, 22],
      [20, 24],
    ], // east backyard / south lawn
    [
      [-5, -11],
      [4, -3],
      [5, 4],
      [-4, 3],
    ], // around the bus and van
    [
      [-16, -24],
      [-6, -20],
      [6, -22],
      [14, -20],
    ], // north yards
    [
      [-14, 20],
      [-6, 24],
      [6, 22],
      [16, 20],
    ], // south yards
    [
      [-25, 2],
      [-22, -4],
      [-25, -10],
      [-27, -2],
    ], // west flank
    [
      [25, -6],
      [22, 0],
      [25, 6],
      [27, -2],
    ], // east flank
  ],
  upper: new Set([1, 2]),
  upperY: 3.15,
  menuCam: menuCamNuke,
  env: {
    sunDir: NUKE_SUN.clone(),
    sunColor: 0xfff3dc,
    sunInt: 2.1,
    hemiSky: 0x9dbfe0,
    hemiGround: 0x77854f,
    hemiInt: 0.74,
    bounce: 0xbfa67e,
    skyFill: 0xa3bdd9,
    fog: 0xc2cfd8,
    fogDensity: 0.0052,
    bloomT: 1.3,
    expo: 0.88,
    sky: {
      uZen: '#24529e',
      uHigh: '#4178c0',
      uMid: '#7fa9d4',
      uLow: '#b9cedd',
      uHaze: '#c2c8c4',
      uGround: '#b09b72',
      uCloudD: '#93a0ac',
      uCloudL: '#e0ddd4',
    },
  },
});
MAPS.push(MAP_NUKE);
