'use strict';
function buildPrismScope(parent, sightY, z) {
  const scope = new THREE.Group();
  scope.position.set(0, sightY, z);
  parent.add(scope);
  /* Wide cantilever base, reinforced body and rubberized ocular ring. */
  /* Keep every support below the ocular cone. The previous twin uprights rose
     into the lower half of the lens when the eye moved close in ADS. */
  part(scope, B(0.078, 0.012, 0.15), GUNMETAL, 0, -0.061, 0.018);
  const mount = new THREE.Group();
  mount.position.set(0, -0.048, 0.018);
  scope.add(mount);
  for (const x of [-0.031, 0.031])
    part(mount, B(0.011, 0.026, 0.09), GUNMETAL, x, 0, 0, -0.12, 0, 0);
  part(mount, B(0.068, 0.012, 0.085), GUNMETAL, 0, -0.014, 0);
  /* CylinderGeometry is capped by default, which put an opaque metal disc
     directly across the sight picture once the optic moved close to the eye.
     The body must be an open, double-sided tube; the rings below provide the
     visible wall thickness without ever covering the optical path. */
  part(scope, TUBEZ(0.043, 0.18, 32), TUBE_MAT, 0, 0, 0);
  part(scope, TUBEZ(0.048, 0.018, 32), GUNMETAL, 0, 0, 0.098);
  part(scope, TUBEZ(0.047, 0.016, 32), GUNMETAL, 0, 0, -0.098);
  part(scope, TUBEZ(0.041, 0.022, 32), GLOVEPAD, 0, 0, 0.107);
  /* Turrets and illumination dial keep the silhouette distinct from the dot. */
  part(scope, CYL(0.013, 0.013, 0.018, 16), GUNMETAL, 0, 0.047, -0.012);
  part(scope, CYLZ(0.013, 0.013, 0.018, 16), GUNMETAL, 0.05, 0, -0.012, 0, PI / 2, 0);
  /* Sample the world-only frame at the lens's screen coordinates. This is not
     another camera or another zoom: it simply prevents viewmodel rail/mount
     geometry behind the transparent lens from leaking into the aperture. */
  const lensMat = new THREE.ShaderMaterial({
    uniforms: {
      tWorld: { value: worldRT.texture },
      resolution: { value: new THREE.Vector2(RTW, RTH) },
    },
    vertexShader: `void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tWorld;
      uniform vec2 resolution;
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        vec3 world=texture2D(tWorld,uv).rgb;
        gl_FragColor=vec4(world*vec3(.94,1.01,1.04),1.0);
      }`,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    toneMapped: false,
  });
  /* Slightly overlap the tube's inner radius so no sub-pixel annulus can leak
     viewmodel geometry around the world-only aperture. The metal ocular ring
     renders in front and hides the overlap. */
  const lens = part(scope, new THREE.CircleGeometry(0.0425, 48), lensMat, 0, 0, 0.102);
  lens.renderOrder = 16;
  const glassMat = OPTIC_GLASS.clone();
  glassMat.opacity = 0.09;
  glassMat.depthWrite = false;
  part(scope, new THREE.CircleGeometry(0.042, 48), glassMat, 0, 0, 0.103);
  /* Draw a front-facing ocular bezel after the sampled world so the metal
     frame cannot disappear into a similarly dark background. */
  const bezelMat = new THREE.MeshBasicMaterial({
    color: 0x090c0f,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bezel = part(scope, new THREE.RingGeometry(0.0415, 0.052, 48), bezelMat, 0, 0, 0.104);
  bezel.renderOrder = 24;
  /* Etched illuminated cross: visible over the magnified world, but fine
     enough not to conceal a distant head. */
  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xff442e,
    transparent: true,
    opacity: 0.42,
    depthTest: false,
    depthWrite: false,
  });
  const h = part(scope, B(0.012, 0.0007, 0.0005), reticleMat, 0, 0, 0.105);
  const v = part(scope, B(0.0007, 0.012, 0.0005), reticleMat, 0, 0, 0.105);
  h.renderOrder = v.renderOrder = 25;
  scope.scale.setScalar(1.45);
  scope.userData.mount = mount;
  scope.userData.aimY = 0;
  scope.userData.clearApertureRadius = 0.042;
  scope.userData.magnification = PRISM_MAGNIFICATION;
  scope.userData.bezel = bezel;
  scope.userData.reticle = { h, v };
  (allocTargets as any).onPrismResize ||= [];
  (allocTargets as any).onPrismResize.push(() => {
    lensMat.uniforms.tWorld.value = worldRT.texture;
    lensMat.uniforms.resolution.value.set(RTW, RTH);
  });
  return { group: scope, lens, lensMat };
}
