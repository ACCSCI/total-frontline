'use strict';
/* =========================================================================
   4. LIGHTING + SKY
   ========================================================================= */
/* ~31° elevation. Low enough that a 2.85m container throws a 4.7m shadow, which
   is what gives the yard its shape, and high enough that the warehouse doesn't
   drop a single black wedge across half the play area. */
const SUN_DIR = new THREE.Vector3(-0.62, 0.47, 0.46).normalize();

/* Sun against total fill is roughly 2.3 : 1.4. Closing that gap further does
   crush the shadow sides, and opening it flattens the containers into the sky —
   the yard is open enough that most of the frame is directly lit either way, so
   the contrast has to come from the vertical faces rather than cast shadows. */
const hemi = new THREE.HemisphereLight(0xa6bacd, 0x6f6450, 0.74);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdcae, 2.35);
sun.position.copy(SUN_DIR).multiplyScalar(92);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 24;
sun.shadow.camera.far = 230;
sun.shadow.camera.left = -52;
sun.shadow.camera.right = 52;
sun.shadow.camera.top = 52;
sun.shadow.camera.bottom = -52;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.026;
scene.add(sun);
scene.add(sun.target);

/* fake ground bounce so shadowed faces read as warm grey instead of black */
const bounce = new THREE.DirectionalLight(0xb0916a, 0.36);
bounce.position.set(0.45, -0.85, -0.55);
scene.add(bounce);
/* cool counter-fill from the open sky opposite the sun */
const skyFill = new THREE.DirectionalLight(0x8fa8c4, 0.28);
skyFill.position.set(0.75, 0.55, -0.62);
scene.add(skyFill);

/* -------------------------------------------------------------------------
   SKY

   This was a 4096x2048 equirectangular canvas until it wasn't good enough.
   The arithmetic is what killed it: 4096 texels spread over 360 degrees is
   11 texels per degree, and the sniper's 15 degree field of view puts about
   170 of them across a 1920 pixel screen. Eleven screen pixels per texel.
   No canvas size fixes that -- doubling it again buys one stop and costs
   64 MB -- and on top of the blur an equirect sheet collapses every column
   onto the zenith, so whatever is painted up there smears into a pinwheel.

   So the sky is evaluated per fragment instead. It is resolution independent
   by construction: the scope magnifies the ray directions, not a bitmap.
   ------------------------------------------------------------------------- */
const SKY_HAZE = '#b0a99c';

/* Authored in sRGB because every other colour in this project is, and the
   grade downstream was tuned against those numbers. The shader converts once
   at the end. */
const SKY_C = (hex) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

const skyUniforms = {
  uTime: { value: 0 },
  uSun: { value: SUN_DIR.clone() },
  uSunXZ: { value: new THREE.Vector2(SUN_DIR.x, SUN_DIR.z).normalize() },
  uZen: { value: SKY_C('#2f4055') },
  uHigh: { value: SKY_C('#5c6d7c') },
  uMid: { value: SKY_C('#8b9196') },
  uLow: { value: SKY_C('#a8a79f') },
  uHaze: { value: SKY_C(SKY_HAZE) },
  uGround: { value: SKY_C('#8a8378') },
  /* the deck is dirty weather over a working yard, not a fair weather cumulus
     field: the two tones stay close together so the sky reads as one heavy
     ceiling rather than a set of separate bright clouds */
  uCloudD: { value: SKY_C('#71757c') },
  uCloudL: { value: SKY_C('#c6c1b6') },
};

const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  extensions: { derivatives: true },
  vertexShader: `
  varying vec3 vDir;
  void main(){
    /* the dome is pinned to the camera, so object space is view direction */
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }`,
  fragmentShader: `
  precision highp float;
  varying vec3 vDir;
  uniform float uTime;
  uniform vec3  uSun, uZen, uHigh, uMid, uLow, uHaze, uGround, uCloudD, uCloudL;
  uniform vec2  uSunXZ;

  float hash21(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),             hash21(i+vec2(1.0,0.0)), f.x),
               mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)), f.x), f.y);
  }
  /* Band limited: fw is the width of this fragment's footprint in noise units,
     and any octave finer than the footprint is dropped rather than sampled.
     Without this the deck aliases into a shimmering mess towards the horizon,
     where the slab projection stretches a whole degree of sky across hundreds
     of noise cells. Renormalising by the surviving weight keeps the mean at
     0.5 so coverage does not drift as octaves fall away. */
  float fbm5(vec2 p, float fw){
    /* persistence under a half. Textbook 0.5 leaves so much energy in the fine
       octaves that the deck breaks up into speckle; weighting the base octave
       harder gives big soft masses with detail on them. */
    float s=0.0, n=0.0, a=0.5, f=1.0;
    for (int i=0;i<5;i++){
      float w = a * (1.0 - smoothstep(0.30, 0.90, fw*f));
      s += w*vnoise(p*f); n += w; f *= 2.03; a *= 0.44;
    }
    return n > 1e-4 ? s/n : 0.5;
  }
  float fbm3(vec2 p, float fw){
    float s=0.0, n=0.0, a=0.5, f=1.0;
    for (int i=0;i<3;i++){
      float w = a * (1.0 - smoothstep(0.30, 0.90, fw*f));
      s += w*vnoise(p*f); n += w; f *= 2.03; a *= 0.5;
    }
    return n > 1e-4 ? s/n : 0.5;
  }
  float fbm2(vec2 p, float fw){
    float s=0.0, n=0.0, a=0.5, f=1.0;
    for (int i=0;i<2;i++){
      float w = a * (1.0 - smoothstep(0.30, 0.90, fw*f));
      s += w*vnoise(p*f); n += w; f *= 2.03; a *= 0.5;
    }
    return n > 1e-4 ? s/n : 0.5;
  }

  void main(){
    vec3 d = normalize(vDir);
    float sd = max(dot(d, uSun), 0.0);

    /* elevation as a fraction of the quarter turn, which is how the original
       gradient was laid out -- linear in angle, not in sin(angle) */
    float t = clamp(asin(clamp(d.y,-1.0,1.0)) * 0.63661977, 0.0, 1.0);
    vec3 col = mix(uHaze, uLow,  smoothstep(0.00, 0.11, t));
    col = mix(col, uMid,  smoothstep(0.11, 0.36, t));
    col = mix(col, uHigh, smoothstep(0.36, 0.68, t));
    col = mix(col, uZen,  smoothstep(0.68, 1.00, t));
    col += vec3(0.30,0.21,0.11) * pow(sd, 2.2) * 0.62;

    if (d.y > -0.02){
      /* Project onto a flat slab overhead. Clouds bunch towards the horizon on
         their own and the zenith is an ordinary point of the plane, so there is
         no pole to smear -- the failure mode of the equirect sheet is designed
         out rather than papered over. */
      vec2  cp = d.xz / max(d.y, 0.055);
      float fw = max(length(dFdx(cp)), length(dFdy(cp)));
      vec2  wind = vec2(uTime*0.0040, uTime*0.0016);
      const float K = 2.35;

      float n  = fbm5(cp*K + wind, fw*K);
      /* wide threshold on purpose. A tight one turns every octave into a hard
         edged blob and the sky reads as a mackerel pattern; letting the ramp
         span most of the field's range keeps the deck continuous and puts the
         detail in its shading instead of its outline. */
      float cov = smoothstep(0.30, 0.80, n);

      /* one sample displaced towards the sun stands in for a light march:
         where the deck is thickening in that direction the fragment is in
         its own shadow, where it is thinning it catches the crown */
      float n2 = fbm2((cp + uSunXZ*0.30)*K + wind, fw*K);
      vec3 cc = mix(uCloudD, uCloudL, clamp((n-n2)*2.6 + 0.50, 0.0, 1.0));

      /* cirrus: the same field squashed hard on one axis, which is all a
         wind sheared streak is. Kept faint -- it is texture on the ceiling,
         not a second layer competing with it. */
      vec2 sp = vec2(cp.x*0.22, cp.y*1.35)*(K*1.9) + wind*2.4;
      float cir = smoothstep(0.52, 0.86, fbm3(sp, fw*K*2.6)) * 0.10;

      float fade = smoothstep(0.008, 0.075, d.y);
      col = mix(col, vec3(0.80,0.81,0.82), cir*fade);
      col = mix(col, cc, cov*fade*0.94);
      col += vec3(0.40,0.30,0.17) * pow(sd, 55.0) * (1.0 - cov*0.55);
    }

    /* The haze band has to reach a good twenty degrees up. It is the only
       thing that puts air between the yard and the backdrop, and without it
       the cloud deck runs straight down behind the containers and the whole
       scene flattens onto one plane. */
    float hz = 1.0 - smoothstep(0.0, 0.42, d.y);
    col = mix(col, uHaze, pow(hz, 1.5)*0.85);
    col = mix(col, uGround, smoothstep(0.0, -0.055, d.y));

    /* a shade under one 8 bit level, which is enough to scatter the contour
       lines the tone map would otherwise pull out of a gradient this broad */
    col += (hash21(gl_FragCoord.xy) - 0.5) * 0.0045;
    gl_FragColor = vec4(pow(max(col,0.0), vec3(2.2)), 1.0);
  }`,
});

/* 64x32 is plenty now that nothing is sampled from a sheet -- the segments
   only have to keep the sphere from looking faceted against its own gradient. */
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), skyMat);
skyDome.frustumCulled = false;
/* Drawn last of the opaque queue rather than first: the dome writes no depth,
   so every sky fragment hidden behind a wall is killed by early-z instead of
   running the noise. In a yard this enclosed that is most of the screen. */
skyDome.renderOrder = 1000;
/* Pinned to the eye so the sky is at infinity. Left at the origin the 300m
   dome shows real parallax across a 90m map and the sun drifts as you walk. */
skyDome.matrixAutoUpdate = false;
skyDome.updateMatrixWorld = function () {
  this.matrixWorld.setPosition(camera.position);
};
scene.add(skyDome);

/* ---- distant skyline ------------------------------------------------------
   Silhouettes, not paint. On the old sheet these were thirty texels tall and
   were the first thing to dissolve when the scope came up. As geometry they
   hold an edge at any magnification for about six hundred triangles, and the
   haze is baked into the vertex colours so they sit in the air rather than in
   front of it -- scene fog at 270m would erase them entirely.
   ------------------------------------------------------------------------- */
{
  const pos = [],
    col = [],
    idx = [];
  const DARK = new THREE.Color('#56565b');
  const HAZE = new THREE.Color(SKY_HAZE);
  const D2R = Math.PI / 180;

  /* az/width in degrees of azimuth, y0/y1 in degrees of elevation: the
     silhouette is authored in the angles it subtends, then projected out to
     whatever radius the rank sits at */
  const push = (R, az, wDeg, y0Deg, y1Deg, blend) => {
    const hw = R * Math.tan(wDeg * 0.5 * D2R);
    const s = Math.sin(az * D2R),
      c = Math.cos(az * D2R);
    const cx = R * s,
      cz = R * c,
      tx = c,
      tz = -s;
    const y0 = y0Deg * D2R * R,
      y1 = y1Deg * D2R * R;
    const k = DARK.clone().lerp(HAZE, blend).convertSRGBToLinear();
    const b = pos.length / 3;
    pos.push(
      cx - tx * hw,
      y0,
      cz - tz * hw,
      cx + tx * hw,
      y0,
      cz + tz * hw,
      cx + tx * hw,
      y1,
      cz + tz * hw,
      cx - tx * hw,
      y1,
      cz - tz * hw
    );
    for (let i = 0; i < 4; i++) col.push(k.r, k.g, k.b);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };

  const rank = (R, scale, blend) => {
    let az = rand(0, 40);
    while (az < 360) {
      const k = Math.random();
      if (k < 0.16) {
        // chimney stack
        const w = rand(0.3, 0.62) * scale,
          h = rand(1.9, 3.2) * scale;
        push(R, az + w * 0.5, w, -0.4, h, blend);
        az += w + rand(0.9, 3.6) * scale;
      } else if (k < 0.32) {
        // gantry crane
        const w = rand(3.2, 5.6) * scale,
          h = rand(1.2, 1.9) * scale,
          leg = 0.26 * scale;
        push(R, az + leg * 0.5, leg, -0.4, h, blend);
        push(R, az + w - leg * 0.5, leg, -0.4, h, blend);
        push(R, az + w * 0.5, w + 1.6 * scale, h, h + 0.3 * scale, blend);
        az += w + rand(1.6, 5.4) * scale;
      } else if (k < 0.46) {
        // storage tank
        const w = rand(1.4, 2.7) * scale,
          h = w * 0.62;
        push(R, az + w * 0.5, w, -0.4, h, blend);
        push(R, az + w * 0.5, w * 0.78, h, h + w * 0.22, blend); // domed top, squared off
        az += w + rand(1.1, 3.9) * scale;
      } else if (k < 0.62) {
        // lattice pylon
        const w = rand(0.75, 1.1) * scale,
          h = rand(1.5, 2.5) * scale;
        push(R, az + w * 0.5, 0.17 * scale, -0.4, h, blend);
        for (let j = 0; j < 3; j++)
          push(
            R,
            az + w * 0.5,
            w,
            h * (0.3 + j * 0.235),
            h * (0.3 + j * 0.235) + 0.13 * scale,
            blend
          );
        az += w + rand(4.0, 11.5) * scale;
      } else {
        // warehouse block
        const w = rand(3.8, 15.0) * scale,
          h = rand(0.5, 1.3) * scale;
        push(R, az + w * 0.5, w, -0.4, h, blend);
        if (Math.random() < 0.45) push(R, az + w * 0.3, w * 0.22, h, h + 0.3 * scale, blend);
        az += w + rand(1.1, 5.0) * scale;
      }
    }
  };
  rank(292, 1.0, 0.62); // far rank sits deeper in the haze
  rank(258, 0.74, 0.4);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const sl = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })
  );
  sl.frustumCulled = false;
  scene.add(sl);
}
