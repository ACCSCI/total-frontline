'use strict';
/* =========================================================================
   5. WORLD / MAP  —  abandoned warehouse district, 60x60
   ========================================================================= */
const HALF = 30;
/* These stay module-level `let`s on purpose: every query below (collision, LOS,
   ground, minimap) closes over the names, so swapping maps is a matter of
   pointing the names at the active map's arrays — see the map registry. */
let colliders = []; // AABBs for movement
let worldSolid = []; // raycast targets for bullets / LOS
let groundMesh = []; // downward raycast (walkable surfaces)
let ceilMesh = []; // upward raycast (head bonk)
let mapRects = []; // minimap footprint {x,z,w,d,c}
let dustField = null; // active map's airborne-dust uniforms
let CUR = null; // active map record
/* Loose junk reads darker than structure so the minimap still separates cover
   you can hide behind from clutter that merely stops your feet. */
const CLUTTER_MAP = '#3f464d';
const extraShadows = []; // {x,z,hw,hd,s} for props with no collider of their own

/* the floor uses a heavily tiled instance; boxes get a 1:1 copy driven by uvScale */
const TEX_CONCRETE_1 = TEX.concrete.clone();
TEX_CONCRETE_1.repeat.set(1, 1);
TEX_CONCRETE_1.needsUpdate = true;

const MAT: Record<string, any> = {
  floor: new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: 0.96, metalness: 0.02 }),
  concrete: new THREE.MeshStandardMaterial({
    map: TEX_CONCRETE_1,
    roughness: 0.95,
    metalness: 0.02,
  }),
  wall: new THREE.MeshStandardMaterial({ map: TEX.wall, roughness: 0.94, metalness: 0.03 }),
  /* there is no environment map, so a metal has nothing to reflect and any
     face turned away from the sun collapses to black. everything here stays
     near-dielectric and fakes "metal" through colour and roughness instead. */
  container: new THREE.MeshStandardMaterial({
    map: TEX.container,
    roughness: 0.62,
    metalness: 0.1,
  }),
  crate: new THREE.MeshStandardMaterial({ map: TEX.crate, roughness: 0.92, metalness: 0.02 }),
  barrel: new THREE.MeshStandardMaterial({ map: TEX.barrel, roughness: 0.56, metalness: 0.12 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.48, metalness: 0.16 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.58, metalness: 0.14 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x7d4c2e, roughness: 0.9, metalness: 0.06 }),
  /* soot and rubber are genuinely dark, but at these light levels a true
     albedo reads as a hole punched in the frame — lift both off the floor */
  charred: new THREE.MeshStandardMaterial({ color: 0x44403b, roughness: 0.94, metalness: 0.05 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x31312f, roughness: 0.98, metalness: 0.0 }),
  glassBroke: new THREE.MeshStandardMaterial({
    color: 0x4a5c66,
    roughness: 0.2,
    metalness: 0.12,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  }),
  /* a low alphaTest keeps the wire alive in the distant mips, where averaging
     otherwise drops it under the cutoff and the fence vanishes entirely */
  fence: new THREE.MeshStandardMaterial({
    map: TEX.fence,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.1,
    color: 0x71777d,
  }),
};
linearizeMats(MAT);

function addCollider(x, y, z, w, h, d) {
  colliders.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y,
    maxY: y + h,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  });
}
/**
 * One InstancedMesh per tint. r128 declares vColor for USE_INSTANCING_COLOR but
 * only multiplies it into diffuse under USE_COLOR, so setColorAt() alone is a
 * no-op here — bucketing by material colour is the reliable route and still
 * keeps this to a handful of draw calls.
 */
function instancedByColor(geo, baseMat, entries) {
  const buckets = new Map();
  for (const e of entries) {
    if (!buckets.has(e.color)) buckets.set(e.color, []);
    buckets.get(e.color).push(e);
  }
  const dummy = new THREE.Object3D();
  for (const [color, list] of buckets) {
    const mat = baseMat.clone();
    mat.color = sRGB(color);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.castShadow = im.receiveShadow = true;
    list.forEach((e, i) => {
      dummy.position.set(e.x, e.y, e.z);
      dummy.rotation.set(0, e.rotY || 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    worldSolid.push(im);
    groundMesh.push(im);
  }
}
function box(w, h, d, x, y, z, mat, opt) {
  opt = opt || {};
  const g = new THREE.BoxGeometry(w, h, d);
  if (opt.uvScale) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * opt.uvScale[0], uv.getY(i) * opt.uvScale[1]);
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y + h / 2, z);
  if (opt.rotY) m.rotation.y = opt.rotY;
  m.castShadow = opt.cast !== false;
  m.receiveShadow = true;
  scene.add(m);
  if (opt.collide !== false) addCollider(x, y, z, w, h, d);
  if (opt.solid !== false) worldSolid.push(m);
  /* Anything solid is stand-on-able: groundAt only ever considers surfaces at or
     below the probe, so this costs nothing when you're beside a crate. That is a
     default, though, and an explicit ground flag has to beat it — the upper floor
     is deliberately collide:false because it is a floor and not a wall, and
     requiring collide here quietly dropped it. The whole sniper deck, the roof
     above it and the walkway over the container stack had nothing to stand on:
     you rode the ramp up and fell straight through to the yard. */
  const walkable = opt.ground !== undefined ? !!opt.ground : opt.collide !== false;
  if (walkable) groundMesh.push(m);
  if (opt.ceiling) ceilMesh.push(m);
  if (opt.map) mapRects.push({ x, z, w, d, c: opt.map });
  return m;
}

/* ---- floor ---- */
/* everything the yard build adds to the scene from here on is captured into
   its own Group by the map registry at the end of this section */
const _preYardScene = new Set(scene.children);
{
  const g = new THREE.PlaneGeometry(HALF * 2 + 16, HALF * 2 + 16);
  g.rotateX(-PI / 2);
  const floor = new THREE.Mesh(g, MAT.floor);
  floor.receiveShadow = true;
  scene.add(floor);
  worldSolid.push(floor);
  groundMesh.push(floor);
}

/* -------------------------------------------------------------------------
   Yard overlay.

   The concrete texture tiles 18x18, and no amount of detail in the tile hides
   that. One unrepeated layer painted across the whole slab does two jobs: it
   breaks the repeat with low-frequency grime, and it carries the yard markings
   — bay numbers, hazard hatching, walkways, tyre tracks, oil — that separate a
   working dock from a grey plane. Costs one transparent draw call.
   ------------------------------------------------------------------------- */
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

  /* --- low frequency grime, the tiling breaker --- */
  for (let i = 0; i < 120; i++) {
    const px = Math.random() * S,
      py = Math.random() * S,
      r = rand(60, 420);
    const g2 = x.createRadialGradient(px, py, 0, px, py, r);
    const dark = Math.random() < 0.72;
    const col = dark ? '26,25,23' : '150,148,142';
    g2.addColorStop(0, `rgba(${col},${dark ? rand(0.05, 0.2) : rand(0.03, 0.09)})`);
    g2.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g2;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  }

  /* --- painted markings --- */
  const paint = 'rgba(196,164,58,'; // faded yellow
  const paintW = 'rgba(206,206,198,'; // faded white

  /* hazard hatching in front of the warehouse roller door */
  x.save();
  x.beginPath();
  x.rect(WX(-15), WZ(-9), M(5.5), M(12));
  x.clip();
  x.strokeStyle = paint + '0.75)';
  x.lineWidth = M(0.42);
  for (let i = -14; i < 20; i++) {
    x.beginPath();
    x.moveTo(WX(-15) + M(i * 0.9), WZ(-9));
    x.lineTo(WX(-15) + M(i * 0.9 + 5.5), WZ(3));
    x.stroke();
  }
  x.restore();

  /* loading bay box, east yard */
  x.strokeStyle = paint + '0.7)';
  x.lineWidth = M(0.22);
  x.strokeRect(WX(3), WZ(-9), M(16), M(17));
  x.lineWidth = M(0.14);
  for (let i = 1; i < 4; i++) {
    x.beginPath();
    x.moveTo(WX(3 + i * 4), WZ(-9));
    x.lineTo(WX(3 + i * 4), WZ(8));
    x.stroke();
  }
  /* bay numbers */
  x.fillStyle = paint + '0.60)';
  x.font = `bold ${M(2.0)}px "Arial Narrow", Arial, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) x.fillText('B' + (i + 1), WX(5 + i * 4), WZ(6.2));

  /* pedestrian walkway running north-south */
  x.strokeStyle = paintW + '0.30)';
  x.lineWidth = M(0.16);
  x.beginPath();
  x.moveTo(WX(-8.4), WZ(-26));
  x.lineTo(WX(-8.4), WZ(26));
  x.stroke();
  x.beginPath();
  x.moveTo(WX(-6.0), WZ(-26));
  x.lineTo(WX(-6.0), WZ(26));
  x.stroke();

  /* crossing bars */
  for (let z = -20; z <= -12; z += 1.6) {
    x.fillStyle = paintW + '0.24)';
    x.fillRect(WX(-9.6), WZ(z), M(5.0), M(0.7));
  }

  /* stencilled floor text */
  const stencil = (t, wx, wz, size, rot, al) => {
    x.save();
    x.translate(WX(wx), WZ(wz));
    x.rotate(rot);
    x.fillStyle = paintW + al + ')';
    x.font = `bold ${M(size)}px "Arial Narrow", Arial, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(t, 0, 0);
    x.restore();
  };
  stencil('NO PARKING', 12, 16, 1.6, 0, 0.34);
  stencil('KEEP CLEAR', -2, -20, 1.8, PI / 2, 0.3);
  stencil('SECTOR 7', 20, -18, 2.4, 0.0, 0.26);
  stencil('DANGER — MOVING PLANT', 6, 22, 1.2, 0, 0.22);

  /* large directional arrow */
  x.save();
  x.translate(WX(16), WZ(4));
  x.rotate(-PI / 2);
  x.fillStyle = paint + '0.40)';
  x.beginPath();
  x.moveTo(0, -M(2.4));
  x.lineTo(M(1.5), -M(0.4));
  x.lineTo(M(0.6), -M(0.4));
  x.lineTo(M(0.6), M(2.4));
  x.lineTo(-M(0.6), M(2.4));
  x.lineTo(-M(0.6), -M(0.4));
  x.lineTo(-M(1.5), -M(0.4));
  x.closePath();
  x.fill();
  x.restore();

  /* --- wear the paint away so it doesn't look freshly applied --- */
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 420; i++) {
    const px = Math.random() * S,
      py = Math.random() * S,
      r = rand(6, 64);
    const g2 = x.createRadialGradient(px, py, 0, px, py, r);
    g2.addColorStop(0, `rgba(0,0,0,${rand(0.25, 0.95)})`);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g2;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  }
  x.globalCompositeOperation = 'source-over';

  /* --- tyre tracks: pairs of dark bands sweeping through the yard --- */
  for (let t = 0; t < 7; t++) {
    const ax = rand(-30, 30),
      az = rand(-30, 30);
    const bx = ax + rand(-34, 34),
      bz = az + rand(-34, 34);
    const cx1 = (ax + bx) / 2 + rand(-16, 16),
      cz1 = (az + bz) / 2 + rand(-16, 16);
    for (const off of [-0.9, 0.9]) {
      const nx = -(bz - az),
        nz = bx - ax;
      const l = Math.hypot(nx, nz) || 1;
      x.strokeStyle = `rgba(30,28,26,${rand(0.1, 0.24)})`;
      x.lineWidth = M(rand(0.16, 0.3));
      x.beginPath();
      x.moveTo(WX(ax + (nx / l) * off), WZ(az + (nz / l) * off));
      x.quadraticCurveTo(
        WX(cx1 + (nx / l) * off),
        WZ(cz1 + (nz / l) * off),
        WX(bx + (nx / l) * off),
        WZ(bz + (nz / l) * off)
      );
      x.stroke();
    }
  }

  /* --- oil stains, darkest at the core --- */
  for (let i = 0; i < 26; i++) {
    const px = Math.random() * S,
      py = Math.random() * S,
      r = rand(14, 70);
    const g2 = x.createRadialGradient(px, py, 0, px, py, r);
    g2.addColorStop(0, `rgba(12,11,10,${rand(0.35, 0.66)})`);
    g2.addColorStop(0.45, `rgba(18,17,15,${rand(0.18, 0.34)})`);
    g2.addColorStop(1, 'rgba(20,18,16,0)');
    x.fillStyle = g2;
    x.save();
    x.translate(px, py);
    x.rotate(Math.random() * 7);
    x.scale(1, rand(0.5, 1.0));
    x.beginPath();
    x.arc(0, 0, r, 0, 7);
    x.fill();
    x.restore();
    /* drip trail */
    if (Math.random() < 0.5) {
      x.strokeStyle = `rgba(14,13,12,${rand(0.15, 0.3)})`;
      x.lineWidth = rand(2, 6);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + rand(-60, 60), py + rand(-60, 60));
      x.stroke();
    }
  }

  /* --- standing water: dark, slightly blue, soft edged --- */
  for (let i = 0; i < 16; i++) {
    const px = Math.random() * S,
      py = Math.random() * S,
      r = rand(30, 120);
    const g2 = x.createRadialGradient(px, py, r * 0.3, px, py, r);
    g2.addColorStop(0, `rgba(30,38,46,${rand(0.22, 0.4)})`);
    g2.addColorStop(0.8, `rgba(34,42,50,${rand(0.1, 0.2)})`);
    g2.addColorStop(1, 'rgba(34,42,50,0)');
    x.fillStyle = g2;
    x.save();
    x.translate(px, py);
    x.rotate(Math.random() * 7);
    x.scale(rand(0.7, 1.5), rand(0.5, 1.0));
    x.beginPath();
    x.arc(0, 0, r, 0, 7);
    x.fill();
    x.restore();
  }

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

/* ---- perimeter: solid collision + chain link visuals ---- */
{
  const H = 3.3;
  const fenceGeos = [];
  for (const side of [0, 1, 2, 3]) {
    for (let i = -HALF; i < HALF; i += 5) {
      const g = new THREE.PlaneGeometry(5, H);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 3.0, uv.getY(k) * 2.0);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      if (side === 0) {
        pos.set(i + 2.5, H / 2, -HALF);
      } else if (side === 1) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2);
        pos.set(HALF, H / 2, i + 2.5);
      } else if (side === 2) {
        pos.set(i + 2.5, H / 2, HALF);
      } else {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2);
        pos.set(-HALF, H / 2, i + 2.5);
      }
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      fenceGeos.push(g);
    }
  }
  const fence = new THREE.Mesh(mergeGeoms(fenceGeos), MAT.fence);
  fence.castShadow = false;
  fence.receiveShadow = false;
  scene.add(fence);
  worldSolid.push(fence);

  /* posts */
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, H + 0.35, 7);
  const posts = [];
  for (let i = -HALF; i <= HALF; i += 5) {
    posts.push([i, -HALF], [i, HALF], [-HALF, i], [HALF, i]);
  }
  const pm = new THREE.InstancedMesh(postGeo, MAT.darkMetal, posts.length);
  const dm = new THREE.Object3D();
  posts.forEach((p, i) => {
    dm.position.set(p[0], (H + 0.35) / 2, p[1]);
    dm.rotation.set(0, 0, 0);
    dm.scale.setScalar(1);
    dm.updateMatrix();
    pm.setMatrixAt(i, dm.matrix);
  });
  pm.castShadow = true;
  pm.instanceMatrix.needsUpdate = true;
  scene.add(pm);

  /* top rail, canted barb arms and three strands of wire. A bare mesh panel
     reads as a net; the hardware on top is what makes it a perimeter. */
  {
    const rails = [],
      arms = [],
      wires = [];
    const railGeo = new THREE.CylinderGeometry(0.055, 0.055, HALF * 2, 6);
    railGeo.rotateZ(PI / 2);
    const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5);
    for (const side of [0, 1, 2, 3]) {
      const along = side === 0 || side === 2;
      const fixed = side === 0 || side === 3 ? -HALF : HALF;
      const r = railGeo.clone();
      const mm = new THREE.Matrix4();
      if (along) mm.makeTranslation(0, H + 0.1, side === 0 ? -HALF : HALF);
      else {
        mm.makeRotationY(PI / 2);
        mm.setPosition(side === 3 ? -HALF : HALF, H + 0.1, 0);
      }
      r.applyMatrix4(mm);
      rails.push(r);

      /* barb arm every 5m, leaning inward */
      for (let i = -HALF; i <= HALF; i += 5) {
        const a = armGeo.clone();
        const inward = side === 0 || side === 3 ? 1 : -1;
        const rot = new THREE.Matrix4().makeRotationX(inward * 0.62);
        if (!along)
          rot.multiplyMatrices(
            new THREE.Matrix4().makeRotationY(PI / 2),
            new THREE.Matrix4().makeRotationX(inward * 0.62)
          );
        a.applyMatrix4(rot);
        const t = new THREE.Matrix4().makeTranslation(
          along ? i : fixed,
          H + 0.36,
          along ? (side === 0 ? -HALF : HALF) : i
        );
        a.applyMatrix4(t);
        arms.push(a);
      }
      /* strands at the top of the arms */
      for (let k = 0; k < 3; k++) {
        const yOff = 0.3 + k * 0.13,
          zOff = (0.1 + k * 0.14) * (side === 0 || side === 3 ? 1 : -1);
        const w = new THREE.CylinderGeometry(0.018, 0.018, HALF * 2, 4);
        w.rotateZ(PI / 2);
        const mw = new THREE.Matrix4();
        if (along) mw.makeTranslation(0, H + 0.3 + yOff, (side === 0 ? -HALF : HALF) + zOff);
        else {
          mw.makeRotationY(PI / 2);
          mw.setPosition((side === 3 ? -HALF : HALF) + zOff, H + 0.3 + yOff, 0);
        }
        w.applyMatrix4(mw);
        wires.push(w);
      }
    }
    const railMesh = new THREE.Mesh(mergeGeoms(rails.concat(arms)), MAT.darkMetal);
    railMesh.castShadow = true;
    scene.add(railMesh);
    const wireMesh = new THREE.Mesh(mergeGeoms(wires), MAT.metal);
    wireMesh.castShadow = false;
    scene.add(wireMesh);
  }

  /* invisible hard walls so nobody escapes */
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
