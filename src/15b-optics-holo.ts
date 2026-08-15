'use strict';
/* A 1x holographic sight has a broad, rectangular viewing window rather than
   the circular tube silhouette used by the red dot and prism. The reticle is
   rendered independently of depth so it reads as a collimated projection. */
function buildHoloSight(parent, sightY, z) {
  const sight = new THREE.Group();
  sight.position.set(0, sightY, z);
  parent.add(sight);

  /* Picatinny clamp and raised bridge. */
  part(sight, B(0.108, 0.014, 0.112), GUNMETAL, 0, -0.063, 0.008);
  for (const x of [-0.036, 0.036]) part(sight, B(0.016, 0.028, 0.076), GUNMETAL, x, -0.047, 0.004);
  part(sight, B(0.094, 0.014, 0.082), POLYMER, 0, -0.034, 0);

  /* Thick square hood. Keeping the four sides as separate solids leaves a
     genuinely open aperture instead of hiding a capped primitive in it. */
  part(sight, B(0.112, 0.017, 0.086), GLOVEPAD, 0, 0.052, 0);
  part(sight, B(0.112, 0.017, 0.086), GUNMETAL, 0, -0.032, 0);
  for (const x of [-0.048, 0.048]) part(sight, B(0.017, 0.09, 0.086), GUNMETAL, x, 0.01, 0);
  /* Front bevel and adjustment controls make the housing readable at hip. */
  part(sight, B(0.102, 0.006, 0.092), GUNMETAL, 0, 0.047, -0.004);
  part(sight, B(0.006, 0.078, 0.092), GUNMETAL, -0.043, 0.01, -0.004);
  part(sight, B(0.006, 0.078, 0.092), GUNMETAL, 0.043, 0.01, -0.004);
  part(sight, CYLZ(0.01, 0.01, 0.016, 14), GUNMETAL, 0.058, 0.006, 0.012, 0, PI / 2, 0);

  const glassMat = OPTIC_GLASS.clone();
  glassMat.color.setHex(0x527f8b);
  glassMat.emissive.setHex(0x0b2025);
  glassMat.opacity = 0.11;
  glassMat.depthWrite = false;
  glassMat.side = THREE.DoubleSide;
  const glass = part(sight, new THREE.PlaneGeometry(0.078, 0.064), glassMat, 0, 0.01, -0.038);
  glass.renderOrder = 10;

  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xff3b24,
    transparent: true,
    opacity: 0.58,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = part(sight, new THREE.RingGeometry(0.0085, 0.0096, 32), reticleMat, 0, 0.01, -0.04);
  const dot = part(sight, new THREE.CircleGeometry(0.00145, 16), reticleMat, 0, 0.01, -0.0402);
  ring.renderOrder = dot.renderOrder = 22;
  sight.userData.kind = 'holographic';
  sight.userData.aimY = 0.01;
  sight.userData.window = { width: 0.078, height: 0.064 };
  sight.userData.reticle = { ring, dot };
  return { group: sight, glass, ring, dot };
}
