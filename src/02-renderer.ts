'use strict';
/* =========================================================================
   2. RENDERER / SCENE / POST FX
   ========================================================================= */
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const isGL2 = renderer.capabilities.isWebGL2;
const MAXANISO = renderer.capabilities.getMaxAnisotropy();

/* a shade under the painted horizon haze: geometry still dissolves into the
   sky, but ground haze sits darker than air haze the way it does outdoors,
   which is what keeps the far district from bleaching into the backdrop */
const FOG_COLOR = 0xa39b8d;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0074);

let BASE_FOV = clamp(Number(localStorage.getItem('tf.baseFov')) || 75, 65, 95);
/* Near at 0.06 against a 400 far gives a 6700:1 depth range and the far side of
   the yard starts to shimmer where two surfaces nearly meet. Nothing solid ever
   gets within the player's 0.36 collision radius and the gun renders in its own
   scene, so 0.14 costs nothing visible and halves the depth range. */
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.14, 400);
camera.rotation.order = 'YXZ';

/* separate scene for the viewmodel so the gun never clips into walls */
const vmScene = new THREE.Scene();
/* 42 rather than the world's 75. A weapon held at arm's length under a wide
   lens has a stock three and a half times nearer the eye than its muzzle, and
   that gradient — near end ballooning, far end shrinking to nothing — is the
   thing that makes an amateur viewmodel look like a pile of boxes. Everything
   below is positioned proportionally further out to hold its screen size, so
   the gun is the same size it always was and simply stops fanning out. */
const VM_FOV = 41.9;
/* how far the viewmodel camera dollies back at full ADS. The FOV narrows to
   match, so the sight holds its size while everything nearer to the eye — the
   receiver, the stock, the shooter's hands — stops looming. It is the same
   telephoto compression a real sight picture has, and it is most of why aiming
   in a shipped shooter feels calm and this used to feel like a wall of gun. */
const VM_ADS_DOLLY = 0.58;
const vmCamera = new THREE.PerspectiveCamera(VM_FOV, innerWidth / innerHeight, 0.008, 12);
/* Hip-fire sits a touch under the world's exposure, which is where a weapon
   held against your own chest belongs — lit to match the sky it reads as a prop
   pasted over the scene. Aiming is the exception: down the sights you are
   looking at the rear of the receiver, the one face no key light reaches, so the
   fill and ambient lift with adsEase rather than being cranked all the time. */
const vmAmb = new THREE.AmbientLight(0x9b9a96, 0.4);
vmScene.add(vmAmb);
const vmKey = new THREE.DirectionalLight(0xffeed6, 1.52);
vmKey.position.set(-0.6, 1.1, 0.9);
vmScene.add(vmKey);
const vmFill = new THREE.DirectionalLight(0x7f8894, 0.38);
vmFill.position.set(1.0, -0.3, 0.4);
vmScene.add(vmFill);
const vmRim = new THREE.DirectionalLight(0xe2e4e6, 0.42);
vmRim.position.set(0.2, 0.4, -1.0);
vmScene.add(vmRim);
const VM_LIGHT_BASE = { amb: 0.4, key: 1.52, fill: 0.38, rim: 0.42 };

/* No IBL: with no environment map, metalness ~1 renders almost black except for
   narrow blown-out specular streaks, so metals here stay in the 0.6-0.8 range
   and lean on roughness for their highlights instead. */

/* ---- render targets ---- */
const rtType = isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
function makeRT(w, h, depth) {
  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: rtType,
    depthBuffer: !!depth,
    stencilBuffer: false,
  };
  if (depth && isGL2 && THREE.WebGLMultisampleRenderTarget) {
    const rt = new THREE.WebGLMultisampleRenderTarget(w, h, opts);
    rt.samples = 4;
    return rt;
  }
  return new THREE.WebGLRenderTarget(w, h, opts);
}
let sceneRT: ReturnType<typeof makeRT> | null = null;
let worldRT: ReturnType<typeof makeRT> | null = null;
let bloomA: ReturnType<typeof makeRT> | null = null;
let bloomB: ReturnType<typeof makeRT> | null = null;
let RTW = 0;
let RTH = 0;
/* The whole frame lands in an offscreen target that the composite pass
   upscales, so render resolution can float independently of the canvas. */
let renderScale = 1.0;
const SCALE_STEPS = [1.0, 0.88, 0.76, 0.64, 0.55];
let scaleIdx = 0;
function allocTargets() {
  RTW = Math.max(2, Math.floor(innerWidth * DPR * renderScale));
  RTH = Math.max(2, Math.floor(innerHeight * DPR * renderScale));
  if (sceneRT) {
    sceneRT.dispose();
    worldRT.dispose();
    bloomA.dispose();
    bloomB.dispose();
  }
  sceneRT = makeRT(RTW, RTH, true);
  worldRT = makeRT(RTW, RTH, true);
  const bw = Math.max(2, RTW >> 2),
    bh = Math.max(2, RTH >> 2);
  bloomA = makeRT(bw, bh, false);
  bloomB = makeRT(bw, bh, false);
  /* the post chain and particle pools are built further down the file, so the
     boot call has nothing to notify yet */
  if ((allocTargets as any).onResize) (allocTargets as any).onResize();
}
allocTargets();

/* Dynamic resolution. Judged on a median of recent frame times so one hitch
   (shader compile, GC) can't drop the whole session a step.

   Dropping resolution only buys anything when we're fill-bound. On a CPU-bound
   machine it would happily walk down to the blurriest step and gain nothing, so
   each downscale is checked against the frame time it was supposed to fix; if it
   didn't pay for itself we give the pixels back and stop trying. */
const adaptive = (() => {
  const N = 48,
    ring = new Float32Array(N).fill(16),
    sorted = new Float32Array(N);
  let head = 0,
    filled = 0,
    hold = 1.5;
  let pending = 0,
    floorIdx = SCALE_STEPS.length - 1;
  return (dt) => {
    ring[head] = dt * 1000;
    head = (head + 1) % N;
    if (filled < N) {
      filled++;
      return;
    }
    hold -= dt;
    if (hold > 0) return;
    sorted.set(ring);
    Array.prototype.sort.call(sorted, (a, b) => a - b);
    const med = sorted[N >> 1];
    if (pending) {
      /* a downscale should buy back at least 6% of the frame; if it didn't,
         this machine is CPU-bound and blurring it further is pure loss */
      if (med > pending * 0.94) {
        floorIdx = Math.max(0, scaleIdx - 1);
        scaleIdx = floorIdx;
        renderScale = SCALE_STEPS[scaleIdx];
        allocTargets();
      }
      pending = 0;
      hold = 3.0;
      return;
    }
    if (med > 20.5 && scaleIdx < floorIdx) {
      pending = med;
      scaleIdx++;
      renderScale = SCALE_STEPS[scaleIdx];
      allocTargets();
      hold = 2.5;
    } else if (med < 11.5 && scaleIdx > 0) {
      scaleIdx--;
      renderScale = SCALE_STEPS[scaleIdx];
      allocTargets();
      hold = 4.0;
    } else hold = 1.0;
  };
})();

/* ---- fullscreen quad plumbing ---- */
const fsScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
fsQuad.frustumCulled = false;
fsScene.add(fsQuad);
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }`;
function postMat(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  });
}
function blit(mat, target) {
  fsQuad.material = mat;
  renderer.setRenderTarget(target || null);
  renderer.render(fsScene, fsCam);
}

const brightMat = postMat(
  `
  uniform sampler2D tDiffuse; uniform float threshold; uniform float knee;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float s = smoothstep(threshold, threshold + knee, l);
    gl_FragColor = vec4(c * s, 1.0);
  }`,
  { tDiffuse: { value: null }, threshold: { value: 0.95 }, knee: { value: 0.55 } }
);

const copyMat = postMat(
  `uniform sampler2D tDiffuse; varying vec2 vUv;
   void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,
  { tDiffuse: { value: null } }
);

const blurMat = postMat(
  `
  uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec3 c = vec3(0.0);
    c += texture2D(tDiffuse, vUv + dir * -4.0).rgb * 0.0162;
    c += texture2D(tDiffuse, vUv + dir * -3.0).rgb * 0.0540;
    c += texture2D(tDiffuse, vUv + dir * -2.0).rgb * 0.1216;
    c += texture2D(tDiffuse, vUv + dir * -1.0).rgb * 0.1946;
    c += texture2D(tDiffuse, vUv                ).rgb * 0.2270;
    c += texture2D(tDiffuse, vUv + dir *  1.0).rgb * 0.1946;
    c += texture2D(tDiffuse, vUv + dir *  2.0).rgb * 0.1216;
    c += texture2D(tDiffuse, vUv + dir *  3.0).rgb * 0.0540;
    c += texture2D(tDiffuse, vUv + dir *  4.0).rgb * 0.0162;
    gl_FragColor = vec4(c, 1.0);
  }`,
  { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } }
);

const compMat = postMat(
  `
  uniform sampler2D tScene, tBloom;
  uniform vec2  res;
  uniform float time, bloom, vig, dmg, low, ab, flash, scope, gunship, expo;
  varying vec2 vUv;
  vec3 aces(vec3 x){
    const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
  }
  float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 d  = uv - 0.5;
    float r2 = dot(d,d);
    /* ab is in "screen widths"; 0.02 puts the base fringe at ~2px and a hit at ~15px */
    float chroma = (ab + dmg * 0.9) * 0.02;
    vec3 col;
    col.r = texture2D(tScene, uv - d*chroma*r2).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv + d*chroma*r2).b;
    col += texture2D(tBloom, uv).rgb * bloom;
    col += flash;

    /* grade: desaturate, cool the shadows, warm the highs.
       the shadow tint must be multiplicative — an additive lift in linear space
       swamps near-black pixels and turns the whole frame blue. */
    float lum = dot(col, vec3(0.2126,0.7152,0.0722));
    col = mix(vec3(lum), col, 0.78);
    float sh = 1.0 - smoothstep(0.0, 0.34, lum);
    float hi = smoothstep(0.30, 0.95, lum);
    col *= mix(vec3(1.0), vec3(0.945, 0.985, 1.095), sh);
    col *= mix(vec3(1.0), vec3(1.075, 1.012, 0.925), hi);
    col = aces(col * 1.14 * expo);
    /* Filmic S-curve to pull the milk out of the midtones, then a small cool
       lift. Without the lift the curve plus the contrast stretch drives any
       surface facing away from the sun to a solid black hole. */
    col = col*col*(3.0-2.0*col)*0.34 + col*0.66;
    col = (col - 0.5) * 1.07 + 0.5;
    col = col * 0.955 + vec3(0.0155, 0.0180, 0.0225);

    /* glass. A scope image is not just a cropped viewport: it has its own
       contrast, cooler cast, edge falloff and a colour fringe near the rim. */
    if (scope > 0.001){
      float rr = length(d * vec2(res.x/res.y, 1.0)) / 0.36;
      vec3 g = col;
      /* glass veils rather than crushes: a touch of contrast, then a lift, so
         shadowed ground stays readable instead of going to a black disc */
      g = (g - 0.5) * 1.05 + 0.5;
      g += vec3(0.013, 0.014, 0.018);
      g *= 1.06;                                          // objective gathers light
      float glum = dot(g, vec3(0.2126,0.7152,0.0722));
      g = mix(vec3(glum), g, 1.06);
      g *= vec3(0.975, 0.995, 1.035);
      g *= 1.0 - 0.20 * smoothstep(0.58, 1.0, rr);        // edge falloff
      g += vec3(0.06,0.02,-0.04) * smoothstep(0.80, 1.0, rr) * 0.5;
      col = mix(col, g, scope);
    }

    /* AC-130-style optical fire control: hard monochrome contrast with a
       slight phosphor cast. The DOM HUD supplies crisp scan lines and labels. */
    if (gunship > 0.001){
      float gl = dot(col, vec3(0.2126,0.7152,0.0722));
      gl = smoothstep(0.045, 0.92, gl);
      gl = pow(gl, 0.78);
      vec3 optic = vec3(gl) * vec3(0.94, 1.0, 0.92);
      col = mix(col, optic, gunship);
    }

    col = mix(col, vec3(0.52,0.02,0.02), dmg*0.42);
    float edge = smoothstep(0.05, 0.30, r2);
    col = mix(col, mix(col, vec3(0.42,0.0,0.0), 0.8), low*edge);

    float vg = 1.0 - smoothstep(0.09, 0.52, r2*1.5);
    col *= mix(1.0, 0.40 + 0.60*vg, vig * (1.0 - scope));

    col += (hash(uv*res + fract(time)*vec2(37.0,17.0)) - 0.5) * 0.030;
    gl_FragColor = vec4(pow(max(col,0.0), vec3(0.4545)), 1.0);
  }`,
  {
    tScene: { value: null },
    tBloom: { value: null },
    res: { value: new THREE.Vector2() },
    time: { value: 0 },
    bloom: { value: 0.6 },
    vig: { value: 1.0 },
    dmg: { value: 0 },
    low: { value: 0 },
    ab: { value: 0.5 },
    flash: { value: 0 },
    scope: { value: 0 },
    gunship: { value: 0 },
    expo: { value: 1.0 },
  }
);
