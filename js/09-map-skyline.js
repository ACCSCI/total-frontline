'use strict';
/* -------------------------------------------------------------------------
   Contact shadows / ground grime.

   Without any GI, props read as stickers laid on the concrete. Each footprint
   gets a soft dark skirt on the floor: a 4x4 vertex grid where the inner rect
   is opaque and the outer ring fades, which keeps the falloff a constant width
   in world units no matter how long the box is (a stretched radial gradient
   does not). Everything merges into one buffer, so this is a single draw call.
   ------------------------------------------------------------------------- */
function makeContactShadows() {
  const pos = [],
    alp = [],
    idx = [];
  let base = 0;
  const FEATHER = 0.62;

  function skirt(cx, cz, hw, hd, strength, y) {
    const xs = [cx - hw - FEATHER, cx - hw, cx + hw, cx + hw + FEATHER];
    const zs = [cz - hd - FEATHER, cz - hd, cz + hd, cz + hd + FEATHER];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        pos.push(xs[j], y, zs[i]);
        const edge = i === 0 || i === 3 || j === 0 || j === 3 ? 0 : 1;
        alp.push(edge * strength);
      }
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const a = base + i * 4 + j;
        idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
      }
    base += 16;
  }

  return {
    add(cx, cz, hw, hd, strength, y) {
      skirt(cx, cz, hw, hd, strength, y === undefined ? 0.014 : y);
    },
    build() {
      if (!idx.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alp, 1));
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: {
          fogColor: { value: scene.fog.color.clone() },
          fogDensity: { value: scene.fog.density },
        },
        vertexShader: `
          attribute float aAlpha; varying float vA; varying float vD;
          void main(){
            vA = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vD = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying float vA; varying float vD; uniform float fogDensity;
          void main(){
            float f = 1.0 - exp(-fogDensity*fogDensity*vD*vD);
            gl_FragColor = vec4(0.030, 0.034, 0.042, vA * (1.0-f));
          }`,
      });
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      m.renderOrder = 1;
      scene.add(m);
    },
  };
}
const contactShadows = makeContactShadows();
/* -------------------------------------------------------------------------
   The district beyond the fence. None of this is collidable or shootable — it
   exists so the play space reads as a cut-out of somewhere larger instead of a
   60m island. It parallaxes properly, which a painted backdrop cannot.
   ------------------------------------------------------------------------- */
{
  /* the play area's textured slab stops at 38m; this carries the ground out to
     the horizon so distant structures have something to stand on */
  const gp = new THREE.PlaneGeometry(460, 460);
  gp.rotateX(-PI / 2);
  const far = new THREE.Mesh(gp, new THREE.MeshBasicMaterial({ color: sRGB(0x5d5c57), fog: true }));
  far.position.y = -0.06;
  scene.add(far);

  const distant = new THREE.Group();
  /* deliberately dark albedos: these are read entirely through haze, and any
     surface that out-radiates the fog colour turns into a white cut-out */
  const dm = (c) => new THREE.MeshLambertMaterial({ color: sRGB(c) });
  const MD = {
    hull: dm(0x3c3b37),
    dark: dm(0x2e2e2c),
    rust: dm(0x3f3128),
    pale: dm(0x46453f),
    steel: dm(0x35383c),
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
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);

  /* long warehouse sheds with sawtooth roofs, ringing the yard. Nothing sits
     closer than ~85m: inside that the haze is too thin to sell them as
     background and they start competing with the playable geometry. */
  const sheds = [
    [-104, -8, 46, 13, 30, 0.1],
    [-74, 92, 52, 11, 26, 1.62],
    [112, 30, 40, 15, 28, 1.55],
    [26, -108, 66, 12, 24, 0.04],
    [-24, 118, 58, 10, 28, 3.1],
    [118, -78, 44, 14, 30, 0.72],
    [-138, 26, 50, 17, 34, 1.5],
    [78, 118, 60, 13, 26, 2.9],
    [-46, -124, 54, 12, 26, 0.2],
    [152, 84, 48, 16, 30, 2.2],
  ];
  for (const [x, z, w, h, d, ry] of sheds) {
    put(BOX, Math.random() < 0.5 ? MD.hull : MD.pale, x, h / 2, z, ry, w, h, d);
    /* roof teeth */
    const teeth = Math.max(3, Math.round(w / 7));
    for (let i = 0; i < teeth; i++) {
      const off = (i / (teeth - 1) - 0.5) * (w * 0.86);
      const m = put(BOX, MD.dark, 0, h + 1.4, 0, 0, (w / teeth) * 0.7, 2.8, d * 0.94);
      m.position.set(x + Math.cos(ry) * off, h + 1.4, z - Math.sin(ry) * off);
      m.rotation.y = ry;
    }
    /* loading-bay stripe */
    const s = put(BOX, MD.dark, x, h * 0.22, z, ry, w * 0.99, h * 0.3, d * 1.005);
    s.material = MD.dark;
  }

  /* storage tanks */
  for (const [x, z, r, h] of [
    [-128, -64, 9, 11],
    [-108, -80, 7, 9],
    [132, 76, 11, 13],
    [150, 14, 8, 10],
    [-58, -136, 10, 12],
  ]) {
    put(CYL, MD.pale, x, h / 2, z, 0, r, h, r);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2), MD.pale);
    cap.position.set(x, h, z);
    cap.scale.set(r, r * 0.42, r);
    distant.add(cap);
    put(BOX, MD.dark, x, h * 0.5, z, 0, r * 2.02, 0.5, r * 2.02);
  }

  /* gantry cranes over the far container rows */
  for (const [x, z, ry, s] of [
    [-118, -30, 0.2, 1.0],
    [96, -62, 1.5, 0.9],
    [34, 142, 0.05, 1.2],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const leg = (dx) => {
      const l = new THREE.Mesh(BOX, MD.steel);
      l.position.set(dx, 11 * s, 0);
      l.scale.set(1.5 * s, 22 * s, 1.5 * s);
      g.add(l);
      const f = new THREE.Mesh(BOX, MD.steel);
      f.position.set(dx, 1.2 * s, 0);
      f.scale.set(4 * s, 2.4 * s, 7 * s);
      g.add(f);
    };
    leg(-13 * s);
    leg(13 * s);
    const beam = new THREE.Mesh(BOX, MD.steel);
    beam.position.set(0, 23 * s, 0);
    beam.scale.set(44 * s, 2.4 * s, 2.6 * s);
    g.add(beam);
    const cab = new THREE.Mesh(BOX, MD.rust);
    cab.position.set(-4 * s, 20.4 * s, 1.6 * s);
    cab.scale.set(3 * s, 3 * s, 3 * s);
    g.add(cab);
    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    distant.add(g);
  }

  /* water tower */
  {
    const g = new THREE.Group();
    g.position.set(-92, 0, -112);
    for (const [dx, dz] of [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ]) {
      const l = new THREE.Mesh(BOX, MD.steel);
      l.position.set(dx, 9, dz);
      l.scale.set(0.7, 18, 0.7);
      l.rotation.set(dz * 0.02, 0, -dx * 0.02);
      g.add(l);
    }
    const tank = new THREE.Mesh(CYL, MD.pale);
    tank.position.set(0, 21, 0);
    tank.scale.set(6, 8, 6);
    g.add(tank);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14), MD.dark);
    cone.position.set(0, 26.6, 0);
    cone.scale.set(6.2, 3, 6.2);
    g.add(cone);
    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    distant.add(g);
  }

  /* chimney stacks */
  for (const [x, z, r, h] of [
    [-146, -132, 3.2, 44],
    [-130, -142, 2.6, 36],
    [168, -104, 3.0, 40],
  ]) {
    put(CYL, MD.rust, x, h / 2, z, 0, r, h, r);
    put(CYL, MD.dark, x, h * 0.86, z, 0, r * 1.12, 2, r * 1.12);
  }

  /* transmission pylons marching off toward the horizon */
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const px = -170 + t * 330,
      pz = 176 - t * 40;
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    const mast = new THREE.Mesh(BOX, MD.steel);
    mast.position.y = 13;
    mast.scale.set(1.1, 26, 1.1);
    g.add(mast);
    for (const [y, w] of [
      [16, 11],
      [20, 9],
      [24, 6],
    ]) {
      const arm = new THREE.Mesh(BOX, MD.steel);
      arm.position.y = y;
      arm.scale.set(w, 0.6, 0.6);
      g.add(arm);
    }
    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    distant.add(g);
  }

  /* stacks of far-off containers to echo the yard's own silhouette */
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * PI * 2,
      r = rand(78, 150);
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x) < 58 && Math.abs(z) < 58) continue;
    const lvl = randI(1, 3);
    for (let k = 0; k < lvl; k++) {
      put(
        BOX,
        [MD.rust, MD.hull, MD.dark, MD.pale][randI(0, 3)],
        x,
        1.42 + k * 2.85,
        z,
        a,
        rand(9, 13),
        2.8,
        2.5
      );
    }
  }

  /* the skyline never moves and never animates, so collapse ~220 meshes into
     one draw per material before it reaches the scene */
  {
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
}

/* every footprint that actually meets the concrete gets a skirt; stacked boxes
   sit on their neighbour and are skipped */
for (const c of colliders) {
  if (c.minY > 0.22) continue;
  const hw = (c.maxX - c.minX) / 2,
    hd = (c.maxZ - c.minZ) / 2;
  if (hw < 0.12 || hd < 0.12) continue;
  const cx = (c.minX + c.maxX) / 2,
    cz = (c.minZ + c.maxZ) / 2;
  contactShadows.add(cx, cz, hw * 0.98, hd * 0.98, 0.62);
  contactShadows.add(cx, cz, hw + 0.55, hd + 0.55, 0.17); // wider grime halo
}
for (const e of extraShadows) contactShadows.add(e.x, e.z, e.hw, e.hd, e.s);
contactShadows.build();

/* -------------------------------------------------------------------------
   Airborne dust.

   A field of motes that lives in a box around the camera and wraps as you
   move, so a few thousand points cover the whole map. They brighten sharply
   when you look toward the sun, which is what makes air feel like a medium
   rather than empty space.
   ------------------------------------------------------------------------- */
function makeDustField(sunVec) {
  const N = 2600,
    EXT = 26;
  const pos = new Float32Array(N * 3),
    seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-EXT, EXT);
    pos[i * 3 + 1] = rand(-1.0, 11.0);
    pos[i * 3 + 2] = rand(-EXT, EXT);
    seed[i] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      camPos: { value: new THREE.Vector3() },
      sunDir: { value: sunVec.clone() },
      ext: { value: EXT },
      pxScale: { value: innerHeight * 0.5 },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float time, ext, pxScale;
      uniform vec3 camPos, sunDir;
      varying float vA;
      void main(){
        vec3 p = position;
        /* slow convection */
        p.x += sin(time*0.14 + aSeed*2.1) * 1.5;
        p.y += sin(time*0.09 + aSeed*3.7) * 0.9 + mod(time*0.10 + aSeed, 2.0) - 1.0;
        p.z += cos(time*0.12 + aSeed*1.7) * 1.5;
        /* wrap into a box that follows the camera */
        vec3 d = p - camPos;
        d = mod(d + ext, 2.0*ext) - ext;
        p = camPos + d;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        float dist = -mv.z;
        /* fade in the near field and at the box edge so nothing pops */
        float edge = 1.0 - smoothstep(ext*0.62, ext*0.98, length(d));
        float near = smoothstep(0.6, 3.0, dist);
        /* motes catch the light when you face into the sun */
        vec3 vd = normalize(p - camPos);
        float halo = pow(max(dot(vd, normalize(sunDir)), 0.0), 3.0);
        vA = edge * near * (0.05 + halo*0.55) * (0.6 + 0.4*sin(aSeed*9.1 + time*1.3));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(pxScale * 0.016 / max(dist,0.4), 1.0, 4.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.06, length(d)) * vA;
        if (a < 0.002) discard;
        gl_FragColor = vec4(1.0, 0.94, 0.84, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  scene.add(pts);
  return mat.uniforms;
}
dustField = makeDustField(SUN_DIR);

/* -------------------------------------------------------------------------
   Sun shafts. Additive slabs angled along the sun vector, wedged into the
   gaps the containers leave. Real volumetrics are out of budget; oriented
   quads with a soft falloff read the same from inside the yard.
   ------------------------------------------------------------------------- */
let sunShafts = [];
const shaftAxis = new THREE.Vector3();
const _sfT = new THREE.Vector3(),
  _sfX = new THREE.Vector3(),
  _sfM = new THREE.Matrix4();
{
  const shaftGeo = new THREE.PlaneGeometry(1, 1, 1, 6);
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { opacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vD;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z;
                   gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      varying vec2 vUv; varying float vD; uniform float opacity;
      void main(){
        float across = smoothstep(0.0,0.28,vUv.x) * smoothstep(1.0,0.72,vUv.x);
        float along  = smoothstep(0.0,0.30,vUv.y) * smoothstep(1.0,0.55,vUv.y);
        float near   = smoothstep(1.5, 7.0, vD) * (1.0 - smoothstep(28.0, 60.0, vD));
        gl_FragColor = vec4(1.0,0.86,0.66, across*along*near*0.030*opacity);
      }`,
  });
  const dir = SUN_DIR.clone().negate(); // travel direction of light
  const spots = [
    [8.6, -14.2, 5.2, 11],
    [8.6, 4.8, 5.2, 11],
    [16.0, -4.6, 4.2, 10],
    [-13.6, 10.6, 6.0, 12],
    [0.6, -6.0, 6.6, 12],
    [22.4, 12.0, 5.0, 10],
    [-19.0, -8.0, 5.6, 11],
    [4.0, 20.0, 5.4, 11],
  ];
  for (const [sx, sz, w, len] of spots) {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    const top = new THREE.Vector3(sx, 0, sz).addScaledVector(dir, -len * 0.5);
    m.position.copy(top).addScaledVector(dir, len * 0.5);
    m.scale.set(w, len, 1);
    m.renderOrder = 4;
    m.frustumCulled = false;
    scene.add(m);
    sunShafts.push(m);
  }
  shaftAxis.copy(dir);
}

/* A fixed quad turns into a hard bright line the moment you see it edge-on,
   which is the opposite of volume. Spinning each slab about the light ray so it
   keeps its face to the camera costs eight quaternions a frame and always shows
   the soft cross-section instead. */
function updateSunShafts() {
  if (!sunShafts.length) return;
  for (const m of sunShafts) {
    _sfT.copy(camera.position).sub(m.position);
    _sfT.addScaledVector(shaftAxis, -_sfT.dot(shaftAxis));
    if (_sfT.lengthSq() < 1e-6) continue;
    _sfT.normalize();
    _sfX.crossVectors(shaftAxis, _sfT).normalize();
    _sfM.makeBasis(_sfX, shaftAxis, _sfT);
    m.quaternion.setFromRotationMatrix(_sfM);
  }
}
