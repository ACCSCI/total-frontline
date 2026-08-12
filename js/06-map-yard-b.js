'use strict';
/* ---- two-story warehouse building (west) — sniper deck ---- */
{
  const X0 = -29,
    X1 = -15,
    Z0 = -14,
    Z1 = 6;
  const cx = (X0 + X1) / 2,
    cz = (Z0 + Z1) / 2,
    W = X1 - X0,
    D = Z1 - Z0;
  const DECK = 4.42;

  /* west + north solid walls */
  box(0.6, 9.5, D + 0.6, X0, 0, cz, MAT.wall, { uvScale: [5.2, 2.4], map: '#3b4147' });
  box(W + 0.6, 9.5, 0.6, cx, 0, Z0, MAT.wall, { uvScale: [3.7, 2.4], map: '#3b4147' });
  /* partial south wall (leaves the ramp landing open) */
  box(6.2, 9.5, 0.6, X0 + 3.4, 0, Z1, MAT.wall, { uvScale: [1.6, 2.4], map: '#3b4147' });

  /* ground floor pillars along the open east face */
  for (let z = Z0 + 2.4; z <= Z1 - 1.4; z += 4.4)
    box(0.7, 4.0, 0.7, X1 - 0.5, 0, z, MAT.concrete, { uvScale: [0.2, 1], map: '#3b4147' });
  box(0.7, 4.0, 0.7, X0 + 3.5, 0, Z1 - 0.6, MAT.concrete, { uvScale: [0.2, 1] });

  /* second floor slab — walkable on top, ceiling underneath, NOT a wall */
  box(W, 0.42, D, cx, 4.0, cz, MAT.concrete, {
    uvScale: [3.5, 5.0],
    collide: false,
    ground: true,
    ceiling: true,
    map: '#4a525a',
  });

  /* railings — south edge is split to leave the ramp landing open */
  box(7.5, 1.05, 0.24, -25.25, DECK, Z1 - 0.15, MAT.darkMetal);
  box(1.7, 1.05, 0.24, -15.85, DECK, Z1 - 0.15, MAT.darkMetal);
  box(0.24, 1.05, 12.0, X1 - 0.15, DECK, Z0 + 6.4, MAT.darkMetal);
  box(0.24, 1.05, 4.4, X1 - 0.15, DECK, Z1 - 2.4, MAT.darkMetal);
  /* sandbag-ish sniper cover on the deck */
  box(2.6, 0.95, 0.5, X1 - 2.2, DECK, Z0 + 3.0, MAT.rust);
  box(0.5, 0.95, 2.4, X1 - 4.6, DECK, Z0 + 7.4, MAT.rust);

  /* upper walls + roof over half the deck */
  box(0.6, 5.0, D + 0.6, X0, DECK, cz, MAT.wall, { uvScale: [5.2, 1.25] });
  box(W + 0.6, 5.0, 0.6, cx, DECK, Z0, MAT.wall, { uvScale: [3.7, 1.25] });
  for (let z = Z0 + 2; z <= Z1 - 2; z += 4.2)
    box(0.5, 3.4, 0.5, X0 + 7.2, DECK, z, MAT.concrete, { uvScale: [0.15, 0.85] });
  box(8.0, 0.4, D + 0.4, X0 + 3.9, 7.82, cz, MAT.concrete, {
    uvScale: [2, 5.1],
    collide: false,
    ground: true,
  });

  /* window slits punched in the upper west wall for silhouette interest */
  for (let z = Z0 + 3; z < Z1 - 1; z += 4.0)
    box(0.9, 1.5, 1.7, X0 + 0.35, 5.6, z, MAT.glassBroke, {
      collide: false,
      solid: false,
      cast: false,
    });

  /* ---- access ramp: triangular prism rising toward -Z ---- */
  const rampLen = 9.5,
    rampW = 4.2;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(rampLen, 0);
  sh.lineTo(rampLen, DECK);
  sh.lineTo(0, 0);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: rampW, bevelEnabled: false });
  rg.rotateY(PI); // slope rises toward -X
  rg.rotateY(-PI / 2); // ...then toward -Z
  rg.computeVertexNormals();
  {
    // extrude UVs are world units
    const uv = rg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
  }
  const RX = -21.2,
    RZ = 15.2; // overlaps the slab edge by 0.3
  const ramp = new THREE.Mesh(rg, MAT.concrete);
  ramp.position.set(RX, 0, RZ);
  ramp.castShadow = ramp.receiveShadow = true;
  scene.add(ramp);
  worldSolid.push(ramp);
  groundMesh.push(ramp);
  mapRects.push({ x: RX + rampW / 2, z: RZ - rampLen / 2, w: rampW, d: rampLen, c: '#5d666e' });
  /* walls down both sides so you can only mount it from the bottom */
  addCollider(RX - 0.12, 0, RZ - rampLen / 2, 0.26, DECK + 0.3, rampLen);
  addCollider(RX + rampW + 0.12, 0, RZ - rampLen / 2, 0.26, DECK + 0.3, rampLen);
  /* Those side walls seal the flanks for the full run, but the tall north end
     was left open: from the building's ground floor you walked straight into the
     wedge and out the far side of it. Cap that end. It only has to beat head
     height, and stopping short of the deck matters — a climber's 0.36 radius
     reaches over the cap while their feet are still below the top of the slope,
     so a full-height 4.42 block would fence them off their own ramp. 4.2 leaves
     20cm of clearance on the climb and is still four metres of concrete to
     anyone standing on the yard. */
  addCollider(RX + rampW / 2, 0, RZ - rampLen + 0.15, rampW, DECK - 0.22, 0.3);
  /* sloped hand rails */
  const rampAng = Math.atan2(DECK, rampLen),
    hyp = Math.hypot(rampLen, DECK);
  for (const sx of [RX - 0.1, RX + rampW + 0.1]) {
    for (const rise of [0.5, 0.98]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, hyp), MAT.darkMetal);
      r.position.set(sx, DECK / 2 + rise, RZ - rampLen / 2);
      r.rotation.x = rampAng;
      r.castShadow = true;
      scene.add(r);
    }
  }

  /* -----------------------------------------------------------------------
     Building fit-out. The shell is a landmark you fight around for a whole
     round, so it earns hardware: shutter, services, signage, roof plant.
     Purely decorative — nothing here changes collision.
     ----------------------------------------------------------------------- */
  const deco = [];
  const decoMats = new Map();
  const dput = (geo, mat, mtx) => {
    const g = geo.clone();
    g.applyMatrix4(mtx);
    if (!decoMats.has(mat)) decoMats.set(mat, []);
    decoMats.get(mat).push(g);
  };
  const T3 = (x, y, z, sx, sy, sz, ry) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)),
      new THREE.Vector3(sx, sy, sz)
    );
  const B = new THREE.BoxGeometry(1, 1, 1);
  const C = new THREE.CylinderGeometry(1, 1, 1, 10);
  const MSHUT = new THREE.MeshStandardMaterial({
    color: sRGB(0x7c7f7f),
    roughness: 0.62,
    metalness: 0.2,
  });
  const MPIPE = new THREE.MeshStandardMaterial({
    color: sRGB(0x4d5257),
    roughness: 0.66,
    metalness: 0.16,
  });
  const MTRIM = new THREE.MeshStandardMaterial({
    color: sRGB(0x3a3f44),
    roughness: 0.7,
    metalness: 0.14,
  });
  const MVENT = new THREE.MeshStandardMaterial({
    color: sRGB(0x8b8d8a),
    roughness: 0.58,
    metalness: 0.2,
  });

  /* roller shutter, north wall, facing the yard */
  {
    const sx = cx + 1.6,
      sy = 0,
      sz = Z0 - 0.32;
    dput(B, MTRIM, T3(sx, 1.7, sz - 0.06, 5.0, 3.4, 0.14));
    for (let i = 0; i < 17; i++)
      dput(B, MSHUT, T3(sx, 0.24 + i * 0.19, sz - 0.14, 4.7, 0.155, 0.09));
    dput(B, MTRIM, T3(sx, 3.44, sz - 0.16, 5.2, 0.3, 0.24));
    /* bay number plate */
    dput(B, MTRIM, T3(sx - 3.1, 3.0, sz - 0.1, 0.9, 0.6, 0.06));
  }

  /* service runs: conduit down the north and east faces, plus junction boxes */
  for (const [px, pz, ry] of [
    [X0 + 2.2, Z0 - 0.34, 0],
    [X0 + 10.6, Z0 - 0.34, 0],
    [X1 + 0.34, Z0 + 4.0, PI / 2],
  ]) {
    dput(C, MPIPE, T3(px, 4.4, pz, 0.055, 8.8, 0.055, ry));
    dput(B, MPIPE, T3(px, 2.1, pz + (ry ? 0.0 : -0.02), 0.26, 0.34, 0.18, ry));
    dput(B, MPIPE, T3(px, 6.2, pz + (ry ? 0.0 : -0.02), 0.22, 0.28, 0.16, ry));
    for (let y = 1.0; y < 9.0; y += 1.6) dput(B, MTRIM, T3(px, y, pz, 0.13, 0.06, 0.13, ry));
  }
  /* downpipe with a hopper head at roof level */
  {
    const px = X0 + 13.2,
      pz = Z0 - 0.36;
    dput(C, MPIPE, T3(px, 4.6, pz, 0.08, 9.2, 0.08));
    dput(B, MPIPE, T3(px, 9.35, pz, 0.34, 0.36, 0.28));
    dput(C, MPIPE, T3(px, 0.24, pz + 0.16, 0.08, 0.5, 0.08));
  }

  /* wall-mounted flood lights aimed into the yard */
  for (const [px, py, pz] of [
    [X0 + 3.0, 8.4, Z0 - 0.4],
    [X0 + 11.0, 8.4, Z0 - 0.4],
  ]) {
    dput(B, MTRIM, T3(px, py, pz, 0.14, 0.14, 0.5));
    dput(B, MVENT, T3(px, py - 0.28, pz - 0.34, 0.62, 0.44, 0.3));
  }

  /* extractor fans and vents high on the north wall */
  for (let i = 0; i < 3; i++) {
    const px = X0 + 3.4 + i * 3.8;
    dput(C, MVENT, T3(px, 7.6, Z0 - 0.36, 0.52, 0.24, 0.52));
    dput(C, MVENT, T3(px, 7.6, Z0 - 0.36, 0.52, 0.24, 0.52));
    decoMats.get(MVENT).pop();
    const fan = new THREE.CylinderGeometry(0.52, 0.52, 0.24, 12);
    fan.rotateX(PI / 2);
    dput(fan, MVENT, T3(px, 7.6, Z0 - 0.4, 1, 1, 1));
    for (let b = 0; b < 4; b++) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(px, 7.6, Z0 - 0.52),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (b * PI) / 4 + 0.3)),
        new THREE.Vector3(0.86, 0.09, 0.06)
      );
      dput(B, MTRIM, m);
    }
  }

  /* corrugated roof deck with ribs and a parapet */
  {
    const rx = X0 + 3.9,
      ry0 = 8.04,
      rz = cz,
      rw = 8.0,
      rd = D + 0.4;
    for (let i = 0; i < Math.floor(rw / 0.42); i++)
      dput(B, MVENT, T3(rx - rw / 2 + 0.21 + i * 0.42, ry0, rz, 0.16, 0.09, rd));
    dput(B, MTRIM, T3(rx, ry0 + 0.16, rz - rd / 2 + 0.1, rw, 0.42, 0.2));
    dput(B, MTRIM, T3(rx, ry0 + 0.16, rz + rd / 2 - 0.1, rw, 0.42, 0.2));
    dput(B, MTRIM, T3(rx - rw / 2 + 0.1, ry0 + 0.16, rz, 0.2, 0.42, rd));
    /* roof plant */
    dput(B, MVENT, T3(rx - 1.6, ry0 + 0.55, rz - 3.2, 1.5, 1.0, 1.5));
    dput(C, MVENT, T3(rx - 1.6, ry0 + 1.15, rz - 3.2, 0.55, 0.22, 0.55));
    dput(B, MVENT, T3(rx + 1.4, ry0 + 0.4, rz + 2.4, 1.0, 0.7, 1.8));
    dput(C, MPIPE, T3(rx + 2.6, ry0 + 0.9, rz - 1.0, 0.16, 1.7, 0.16));
  }

  for (const [mat, geos] of decoMats) {
    const m = new THREE.Mesh(mergeGeoms(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    worldSolid.push(m);
  }

  /* painted wall sign — the one piece of large typography in the map */
  {
    const SW = 1024,
      SH = 256;
    const sc = document.createElement('canvas');
    sc.width = SW;
    sc.height = SH;
    const sx2 = sc.getContext('2d');
    sx2.fillStyle = 'rgba(212,206,192,0.90)';
    sx2.font = 'bold 118px "Arial Narrow", Arial, sans-serif';
    sx2.textAlign = 'center';
    sx2.textBaseline = 'middle';
    sx2.fillText('IRONHOLD', SW / 2, 84);
    sx2.font = 'bold 52px "Arial Narrow", Arial, sans-serif';
    sx2.fillStyle = 'rgba(206,166,60,0.85)';
    sx2.fillText('LOGISTICS   ·   TERMINAL 7', SW / 2, 168);
    sx2.strokeStyle = 'rgba(206,166,60,0.5)';
    sx2.lineWidth = 5;
    sx2.beginPath();
    sx2.moveTo(180, 212);
    sx2.lineTo(SW - 180, 212);
    sx2.stroke();
    /* weather it hard — fresh paint on a derelict wall is a tell */
    sx2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 300; i++) {
      const px = rand(0, SW),
        py = rand(0, SH),
        r = rand(6, 54);
      const g2 = sx2.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, `rgba(0,0,0,${rand(0.2, 0.95)})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      sx2.fillStyle = g2;
      sx2.beginPath();
      sx2.arc(px, py, r, 0, 7);
      sx2.fill();
    }
    const st = new THREE.CanvasTexture(sc);
    st.anisotropy = MAXANISO;
    st.encoding = THREE.sRGBEncoding;
    const sg = new THREE.PlaneGeometry(11.5, 2.9);
    const sm = new THREE.Mesh(
      sg,
      new THREE.MeshStandardMaterial({
        map: st,
        transparent: true,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    );
    sm.position.set(cx + 0.4, 6.4, Z0 - 0.33);
    sm.rotation.y = PI;
    scene.add(sm);
  }
}

/* ---- shipping containers ---- */
/* pulled toward grey: a full-saturation container yard looks like a toy box */
/* these tint a mid-grey corrugation map, so the sRGB value here lands roughly
   40% darker on screen — read them as paint chips, not final pixels */
const CONTAINER_COLORS = [0xa85748, 0x53718c, 0x707f56, 0xab8a3f, 0x8b9096, 0x7e5243, 0x4f6f69];
{
  const CW = 2.7,
    CH = 2.85,
    CL = 9.0; // width(X) height(Y) length(Z)
  const geo = new THREE.BoxGeometry(CW, CH, CL);
  {
    const uv = geo.attributes.uv; // stretch corrugation along length
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 1.0);
  }
  const list = [
    /* east corridor — two rows running north/south */
    [12.6, 0, -19],
    [12.6, 0, -9.4],
    [12.6, 0, 0.2],
    [12.6, 0, 9.8],
    [12.6, 0, 19.4],
    [19.4, 0, -19],
    [19.4, 0, -9.4],
    [19.4, 0, 0.2],
    [19.4, 0, 9.8],
    [19.4, 0, 19.4],
    /* stacked second layer to break sightlines down the corridor */
    [19.4, CH, -9.4],
    [19.4, CH, 9.8],
    [12.6, CH, 0.2],
    /* scattered cover elsewhere */
    [-4.5, 0, -21.5],
    [2.0, 0, -25.0],
    [-11.0, 0, -4.0],
    [26.0, 0, -3.0],
    [26.0, 0, 6.5],
    [4.5, 0, 17.0],
    [-8.5, 0, 22.0],
    [24.5, 0, 22.5],
  ];
  const entries = list.map((p, i) => {
    const rotY = i >= 13 ? (i % 2 === 0 ? PI / 2 : 0) : 0;
    const w = rotY === 0 ? CW : CL,
      l = rotY === 0 ? CL : CW;
    addCollider(p[0], p[1], p[2], w, CH, l);
    mapRects.push({ x: p[0], z: p[2], w, d: l, c: '#5a6068' });
    return {
      x: p[0],
      y: p[1] + CH / 2,
      z: p[2],
      rotY,
      color: CONTAINER_COLORS[i % CONTAINER_COLORS.length],
    };
  });
  instancedByColor(geo, MAT.container, entries);

  /* ---- unique markings, one decal per long face ----
     A 4-cell atlas gives every container its own serial without a texture per
     box, and the whole set merges into a single alpha-tested draw. */
  {
    const COLS = 4,
      ROWS = 6,
      CELLS = COLS * ROWS,
      CW2 = 512,
      CH2 = 256;
    const AW = COLS * CW2,
      AH = ROWS * CH2;
    const ac = document.createElement('canvas');
    ac.width = AW;
    ac.height = AH;
    const ax = ac.getContext('2d');
    const owners = [
      'MAEU',
      'TGHU',
      'CSQU',
      'HLXU',
      'MSCU',
      'OOLU',
      'TCNU',
      'GESU',
      'APZU',
      'DFSU',
      'FCIU',
      'TRLU',
      'SEGU',
      'CAIU',
      'BEAU',
      'WHLU',
    ];
    for (let cell = 0; cell < CELLS; cell++) {
      const ox = (cell % COLS) * CW2,
        oy = ((cell / COLS) | 0) * CH2;
      ax.save();
      ax.translate(ox, oy);
      ax.fillStyle = 'rgba(228,228,224,0.74)';
      ax.font = 'bold 52px "Arial Narrow", Arial, sans-serif';
      ax.textAlign = 'left';
      ax.textBaseline = 'alphabetic';
      ax.fillText(
        pick(owners) + ' ' + randI(100, 999) + ' ' + randI(100, 999) + '-' + randI(0, 9),
        22,
        58
      );
      ax.font = 'bold 28px "Arial Narrow", Arial, sans-serif';
      ax.fillStyle = 'rgba(232,232,228,0.60)';
      ax.fillText(pick(['45 G1', '22 G1', '42 G1', '45 R1', '22 U1']), 22, 94);
      ax.font = 'bold 19px "Arial Narrow", Arial, sans-serif';
      ax.fillStyle = 'rgba(228,228,224,0.38)';
      ax.fillText('MAX GROSS  ' + randI(28, 32) + ',480 KG', 22, 124);
      ax.fillText('TARE        ' + randI(3, 4) + ',' + randI(100, 990) + ' KG', 22, 148);
      ax.fillText('CU CAP      ' + randI(60, 86) + '.' + randI(1, 9) + ' CU M', 22, 172);
      /* CSC plate */
      ax.strokeStyle = 'rgba(228,228,224,0.40)';
      ax.lineWidth = 3;
      ax.strokeRect(CW2 - 176, 34, 150, 96);
      ax.fillStyle = 'rgba(228,228,224,0.32)';
      ax.font = 'bold 18px monospace';
      ax.fillText('CSC SAFETY', CW2 - 166, 62);
      ax.fillText('APPROVAL', CW2 - 166, 86);
      ax.fillText('GB/' + randI(1000, 9999), CW2 - 166, 112);
      /* weather the paint */
      ax.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 70; i++) {
        const px = rand(0, CW2),
          py = rand(0, CH2),
          r = rand(4, 26);
        const g2 = ax.createRadialGradient(px, py, 0, px, py, r);
        g2.addColorStop(0, `rgba(0,0,0,${rand(0.2, 0.9)})`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ax.fillStyle = g2;
        ax.beginPath();
        ax.arc(px, py, r, 0, 7);
        ax.fill();
      }
      ax.globalCompositeOperation = 'source-over';
      ax.restore();
    }
    const atlas = new THREE.CanvasTexture(ac);
    atlas.anisotropy = MAXANISO;
    atlas.encoding = THREE.sRGBEncoding;

    /* real owner-code blocks are ~2.4m wide with 0.3m glyphs, sat high and
       toward one end — anything larger reads as a billboard */
    const DW = 2.7,
      DH = 1.35;
    const parts = [];
    const order = entries.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = randI(0, i);
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    entries.forEach((e, i) => {
      const cell = order[i] % CELLS;
      const u0 = (cell % COLS) / COLS,
        v0 = 1 - (((cell / COLS) | 0) + 1) / ROWS;
      for (const s of [1, -1]) {
        const q = new THREE.PlaneGeometry(DW, DH);
        const uv = q.attributes.uv;
        for (let k = 0; k < uv.count; k++)
          uv.setXY(k, u0 + uv.getX(k) / COLS, v0 + uv.getY(k) / ROWS);
        const mtx = new THREE.Matrix4();
        const rot = new THREE.Matrix4().makeRotationY(e.rotY + (s * PI) / 2);
        const local = new THREE.Vector3(s * (CW / 2 + 0.012), 0.6, s * -2.55);
        local.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.rotY);
        mtx.multiplyMatrices(
          new THREE.Matrix4().makeTranslation(e.x + local.x, e.y + local.y, e.z + local.z),
          rot
        );
        q.applyMatrix4(mtx);
        parts.push(q);
      }
    });
    const dec = new THREE.Mesh(
      mergeGeoms(parts),
      new THREE.MeshStandardMaterial({
        map: atlas,
        transparent: true,
        alphaTest: 0.06,
        roughness: 0.85,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide,
      })
    );
    dec.castShadow = false;
    dec.receiveShadow = true;
    scene.add(dec);
  }
}

/* ---- guard shack (north-east) ---- */
{
  const x = 25.0,
    z = -14.0;
  box(6.4, 0.25, 6.4, x, 0, z, MAT.concrete, { uvScale: [2, 2], collide: false, ground: true });
  box(6.4, 3.2, 0.35, x, 0.25, z - 3.0, MAT.wall, { uvScale: [2, 1], map: '#3b4147' });
  box(0.35, 3.2, 6.4, x - 3.0, 0.25, z, MAT.wall, { uvScale: [2, 1], map: '#3b4147' });
  box(0.35, 3.2, 6.4, x + 3.0, 0.25, z, MAT.wall, { uvScale: [2, 1], map: '#3b4147' });
  box(2.0, 3.2, 0.35, x - 2.2, 0.25, z + 3.0, MAT.wall, { uvScale: [0.8, 1], map: '#3b4147' });
  box(6.6, 0.3, 6.6, x, 3.45, z, MAT.darkMetal, { collide: false, ground: true, ceiling: true });
  box(2.4, 1.4, 0.2, x + 1.2, 1.5, z + 3.0, MAT.glassBroke, {
    collide: false,
    solid: false,
    cast: false,
  });
}

/* ---- concrete jersey barriers ---- */
{
  const g = new THREE.BoxGeometry(2.5, 1.05, 0.55);
  const list = [
    [-2, 0, -8, 0],
    [1.2, 0, -8, 0],
    [6.5, 0, 4.5, PI / 2],
    [6.5, 0, 7.4, PI / 2],
    [-16, 0, 18, 0],
    [-13, 0, 18, 0],
    [9.5, 0, -15, PI / 2],
    [9.5, 0, -12.2, PI / 2],
    [-24, 0, -22, 0],
    [-21, 0, -22, 0],
    [17, 0, -26, 0],
    [20, 0, -26, 0],
  ];
  const im = new THREE.InstancedMesh(g, MAT.concrete, list.length);
  im.castShadow = im.receiveShadow = true;
  const d = new THREE.Object3D();
  list.forEach((p, i) => {
    d.position.set(p[0], 0.525, p[2]);
    d.rotation.set(0, p[3], 0);
    d.scale.setScalar(1);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    const w = p[3] === 0 ? 2.5 : 0.55,
      l = p[3] === 0 ? 0.55 : 2.5;
    addCollider(p[0], 0, p[2], w, 1.05, l);
    mapRects.push({ x: p[0], z: p[2], w, d: l, c: '#4e555c' });
  });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
  worldSolid.push(im);
  groundMesh.push(im);
}

/* ---- long dividing wall with a breach gap ---- */
{
  box(0.6, 3.6, 9.0, -8.0, 0, -20.0, MAT.wall, { uvScale: [3, 1.5], map: '#3b4147' });
  box(0.6, 3.6, 6.0, -8.0, 0, -8.0, MAT.wall, { uvScale: [2, 1.5], map: '#3b4147' });
  box(0.6, 1.1, 3.2, -8.0, 0, -14.0, MAT.concrete, { uvScale: [1, 0.5], map: '#3b4147' });
}
