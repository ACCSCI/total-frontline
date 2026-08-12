'use strict';
/* ---- crates (instanced, some stacked) ---- */
{
  const S = 1.25;
  const g = new THREE.BoxGeometry(S, S, S);
  const list = [];
  const clusters = [
    [-3.5, -3.0],
    [16.0, 4.6],
    [16.0, -5.2],
    [-13.0, 10.0],
    [8.0, -20.0],
    [22.0, 14.0],
    [-20.0, -6.0],
    [3.0, 26.0],
    [-25.5, 24.0],
    [27.0, -24.0],
    [-2.0, 12.0],
    [16.0, -22.0],
  ];
  for (const [cx, cz] of clusters) {
    const n = randI(2, 4);
    for (let i = 0; i < n; i++) {
      const x = cx + rand(-1.3, 1.3),
        z = cz + rand(-1.3, 1.3);
      list.push([x, 0, z, rand(0, PI)]);
      if (Math.random() < 0.45)
        list.push([x + rand(-0.25, 0.25), S, z + rand(-0.25, 0.25), rand(0, PI)]);
    }
  }
  const CRATE_TINTS = [0xd8c39c, 0xc2a679, 0xa98d64, 0xe0cfae];
  const entries = list.map((p, i) => {
    addCollider(p[0], p[1], p[2], S * 1.25, S, S * 1.25);
    if (p[1] === 0) mapRects.push({ x: p[0], z: p[2], w: S, d: S, c: '#4a4238' });
    return {
      x: p[0],
      y: p[1] + S / 2,
      z: p[2],
      rotY: p[3],
      color: CRATE_TINTS[i % CRATE_TINTS.length],
    };
  });
  instancedByColor(g, MAT.crate, entries);
}

/* ---- barrel stacks ---- */
{
  const R = 0.36,
    H = 0.95;
  const g = new THREE.CylinderGeometry(R, R, H, 14, 1);
  const list = [];
  const stacks = [
    [6.5, -12.5],
    [-6.0, 14.0],
    [8.5, 16.5],
    [-10.5, -20.5],
    [24.0, -24.5],
    [2.0, 22.0],
    [-17.0, 2.0],
    [13.5, -2.5],
    [-27.0, 14.0],
    [21.0, 10.0],
  ];
  for (const [cx, cz] of stacks) {
    const n = randI(3, 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 7 + rand(-0.4, 0.4),
        rr = rand(0.3, 0.62);
      list.push([cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr]);
    }
    if (Math.random() < 0.7) list.push([cx + rand(-0.2, 0.2), H, cz + rand(-0.2, 0.2)]);
  }
  const BARREL_TINTS = [0xb8402c, 0x6f7d64, 0x7d8288, 0x8a6a3c];
  const entries = list.map((p) => {
    addCollider(p[0], p[1], p[2], R * 2.1, H, R * 2.1);
    if (p[1] === 0) mapRects.push({ x: p[0], z: p[2], w: R * 2, d: R * 2, c: '#4a4a48' });
    return { x: p[0], y: p[1] + H / 2, z: p[2], rotY: rand(0, 7), color: pick(BARREL_TINTS) };
  });
  instancedByColor(g, MAT.barrel, entries);
}

/* ---- burnt-out flatbed in the open centre ----
   Soot is only on the panels the fire actually touched; the rest is faded
   paint and rust, which keeps the wreck from reading as one black mass. */
{
  const G = new THREE.Group();
  G.position.set(0.5, 0, -1.5);
  G.rotation.y = 0.42;

  const PAINT = new THREE.MeshStandardMaterial({
    color: sRGB(0x6d6a5e),
    roughness: 0.88,
    metalness: 0.1,
  });
  const SOOT = new THREE.MeshStandardMaterial({
    color: sRGB(0x4b4741),
    roughness: 0.97,
    metalness: 0.03,
  });
  const FRAME = new THREE.MeshStandardMaterial({
    color: sRGB(0x574c42),
    roughness: 0.92,
    metalness: 0.08,
  });
  const GLASSX = new THREE.MeshStandardMaterial({
    color: sRGB(0x76837f),
    roughness: 0.32,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });

  const add = (w, h, d, x, y, z, mat, rx, rz, solid) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    m.castShadow = m.receiveShadow = true;
    G.add(m);
    if (solid !== false) {
      worldSolid.push(m);
      groundMesh.push(m);
    }
    return m;
  };

  /* ladder frame + axles */
  add(4.9, 0.16, 0.2, 0, 0.46, 0.72, FRAME, 0, 0.03);
  add(4.9, 0.16, 0.2, 0, 0.46, -0.72, FRAME, 0, 0.03);
  add(0.24, 0.14, 1.7, 1.45, 0.44, 0, FRAME);
  add(0.24, 0.14, 1.7, -1.45, 0.44, 0, FRAME);

  /* flatbed deck — walkable, so it stays in groundMesh */
  add(3.0, 0.14, 2.1, -1.05, 0.62, 0, FRAME, 0, 0.03);
  for (let i = 0; i < 7; i++)
    add(0.3, 0.05, 2.06, -2.4 + i * 0.44, 0.71, 0, MAT.rust, 0, 0.03, false);
  /* side gates, one dropped */
  add(3.0, 0.42, 0.09, -1.05, 0.9, 1.02, PAINT, 0, 0.03);
  add(1.4, 0.42, 0.09, -0.35, 0.72, -1.32, PAINT, 0.62, 0.03, false);
  add(0.09, 0.42, 2.1, -2.52, 0.9, 0, PAINT, 0, 0.03);

  /* cab: roof and near side burnt, far side still holding paint */
  add(1.85, 0.86, 1.95, 1.05, 1.02, 0, PAINT, 0, 0.05);
  add(1.87, 0.3, 1.97, 1.05, 1.52, 0, SOOT, 0, 0.05);
  add(1.6, 0.05, 1.8, 1.02, 1.7, 0, SOOT, 0, 0.05);
  add(0.1, 0.62, 1.86, 1.98, 1.34, 0, SOOT, -0.16, 0);
  add(1.72, 0.06, 0.06, 1.05, 1.66, 0.94, FRAME, 0, 0.05, false);
  const wsc = add(0.06, 0.56, 1.72, 1.99, 1.33, 0, GLASSX, -0.16, 0, false);
  wsc.castShadow = false;

  /* engine bay, hood torn open and folded back */
  add(1.05, 0.62, 1.9, 2.55, 0.86, 0, PAINT, 0, 0.04);
  add(1.1, 0.07, 1.8, 2.3, 1.34, 0, MAT.rust, -0.75, 0, false);
  add(0.95, 0.34, 1.6, 2.62, 1.06, 0, SOOT, 0, 0.02, false);
  add(1.3, 0.16, 0.12, 2.95, 0.52, 0.8, FRAME, 0, 0, false);
  add(1.3, 0.16, 0.12, 2.95, 0.52, -0.8, FRAME, 0, 0, false);

  /* wheels: three mounted, one burnt to the rim, one loose in the dirt */
  const wheel = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 16);
  wheel.rotateZ(PI / 2);
  const rim = new THREE.CylinderGeometry(0.25, 0.25, 0.34, 14);
  rim.rotateZ(PI / 2);
  [
    [1.45, 0.44, 0.98],
    [1.45, 0.44, -0.98],
    [-1.45, 0.44, -0.98],
  ].forEach((p) => {
    const m = new THREE.Mesh(wheel, MAT.rubber);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true;
    G.add(m);
    worldSolid.push(m);
  });
  const burnt = new THREE.Mesh(rim, MAT.metal);
  burnt.position.set(-1.45, 0.26, 0.98);
  burnt.castShadow = true;
  G.add(burnt);
  worldSolid.push(burnt);
  const loose = new THREE.Mesh(wheel, MAT.rubber);
  loose.position.set(-2.9, 0.16, 1.9);
  loose.rotation.z = PI / 2;
  loose.castShadow = true;
  G.add(loose);
  worldSolid.push(loose);

  /* scorch ring under the cab, then scattered panel debris */
  {
    const sg = new THREE.CircleGeometry(3.4, 28);
    sg.rotateX(-PI / 2);
    const sm = new THREE.Mesh(
      sg,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      })
    );
    sm.position.set(1.0, 0.02, 0);
    G.add(sm);
  }
  for (let i = 0; i < 11; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.2, 0.62), rand(0.03, 0.1), rand(0.18, 0.5)),
      Math.random() < 0.45 ? SOOT : MAT.rust
    );
    m.position.set(rand(-3.6, 3.9), rand(0.02, 0.07), rand(-2.9, 2.9));
    m.rotation.set(rand(0, 0.3), rand(0, 7), rand(0, 0.3));
    m.castShadow = true;
    G.add(m);
  }
  /* shattered glass fanning out from the cab */
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.05, 0.13), 0.012, rand(0.05, 0.12)),
      MAT.glassBroke
    );
    m.position.set(rand(1.6, 3.6), 0.014, rand(-1.9, 1.9));
    m.rotation.y = rand(0, 7);
    G.add(m);
  }

  /* one draw per material — the wreck is static, and the raycast lists want a
     single mesh just as happily as sixty */
  {
    G.updateMatrixWorld(true);
    const solid = new Set(worldSolid),
      walk = new Set(groundMesh);
    const buckets = new Map(),
      keepSolid = new Map(),
      keepWalk = new Map();
    G.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g);
      if (solid.has(o)) keepSolid.set(o.material, true);
      if (walk.has(o)) keepWalk.set(o.material, true);
    });
    for (let i = worldSolid.length - 1; i >= 0; i--)
      if (worldSolid[i].parent === G) worldSolid.splice(i, 1);
    for (let i = groundMesh.length - 1; i >= 0; i--)
      if (groundMesh[i].parent === G) groundMesh.splice(i, 1);
    for (const [mat, geos] of buckets) {
      const m = new THREE.Mesh(mergeGeoms(geos), mat);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      if (keepSolid.get(mat)) worldSolid.push(m);
      if (keepWalk.get(mat)) groundMesh.push(m);
    }
  }
  /* The wreck sits at 24 degrees to the grid, but colliders are axis-aligned.
     One box around the whole truck is either three metres of invisible wall off
     the corners or — as it was — small enough to walk into the engine bay and
     stand inside the cab. Three short boxes stepped along the chassis keep the
     error under about 30cm anywhere on the hull. */
  {
    const cy = Math.cos(G.rotation.y),
      sy = Math.sin(G.rotation.y);
    const hull = [
      [-2.6, 0.55, -1.2, 1.2, 1.05], // bed and frame
      [0.1, 2.05, -1.05, 1.05, 1.72], // cab
      [2.0, 3.25, -1.0, 1.0, 1.25],
    ]; // engine bay and bumper
    for (const [x0, x1, z0, z1, h] of hull) {
      let mnx = Infinity,
        mxx = -Infinity,
        mnz = Infinity,
        mxz = -Infinity;
      for (const lx of [x0, x1])
        for (const lz of [z0, z1]) {
          const wx = G.position.x + lx * cy + lz * sy;
          const wz = G.position.z - lx * sy + lz * cy;
          if (wx < mnx) mnx = wx;
          if (wx > mxx) mxx = wx;
          if (wz < mnz) mnz = wz;
          if (wz > mxz) mxz = wz;
        }
      addCollider((mnx + mxx) / 2, 0, (mnz + mxz) / 2, mxx - mnx, h, mxz - mnz);
      /* draw exactly what blocks you: one rect per hull box, so the shape on the
         minimap is the shape you bump into rather than a tidy rectangle that
         misses the engine bay */
      mapRects.push({
        x: (mnx + mxx) / 2,
        z: (mnz + mxz) / 2,
        w: mxx - mnx,
        d: mxz - mnz,
        c: '#4a4038',
      });
    }
  }
}
