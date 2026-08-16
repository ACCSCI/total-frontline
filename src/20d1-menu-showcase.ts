'use strict';
/* MENU WEAPON SHOWCASE — the three.js plate behind the main menu.
   Smoke and dust drift; sparks are sparse and short-lived. */
const MENU_SHOWCASE: any = {
  active: false,
  scene: null,
  camera: null,
  weapon: null,
  weaponIndex: 0,
  weaponTimer: 0,
  time: 0,
  smoke: null,
  dust: null,
  smokeV: null,
  dustV: null,
  smokeSprites: [] as any[],
  sparkSprites: [] as any[],
};

const MENU_CAM_DEBUG: any = {
  x: 2.0, y: 5.0, z: 0.4, lookX: 2.0, lookY: 0.72, lookZ: 1.2, view: 1.15, auto: true,
};

function makeGlowTexture(tight = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(tight ? 0.16 : 0.22, 'rgba(255,255,255,0.72)');
  g.addColorStop(tight ? 0.4 : 0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  if (tight) {
    ctx.globalCompositeOperation = 'lighter';
    const h = ctx.createLinearGradient(0, 64, 128, 64);
    h.addColorStop(0, 'rgba(255,255,255,0)');
    h.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = h;
    ctx.fillRect(14, 62.6, 100, 2.8);
    const v = ctx.createLinearGradient(64, 0, 64, 128);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = v;
    ctx.fillRect(62.6, 14, 2.8, 100);
  }
  return new THREE.CanvasTexture(c);
}

function makeTableTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#12151a';
  ctx.fillRect(0, 0, 256, 256);
  const warm = ctx.createRadialGradient(150, 90, 10, 150, 90, 220);
  warm.addColorStop(0, 'rgba(255,176,82,0.07)');
  warm.addColorStop(0.45, 'rgba(255,176,82,0.02)');
  warm.addColorStop(1, 'rgba(255,176,82,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 12 + Math.random() * 95;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.038)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = Math.random() < 0.82 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 256);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 64);
    ctx.lineTo(256, i * 64);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.66)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function makeWornMetalTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d2d2d2';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = 8 + Math.random() * 42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.65;
    g.addColorStop(0, dark ? 'rgba(34,25,12,0.28)' : 'rgba(255,248,228,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 950; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const len = 6 + Math.random() * 42;
    const horizontal = Math.random() < 0.68;
    ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(18,12,5,0.16)' : 'rgba(255,250,235,0.10)';
    ctx.lineWidth = Math.random() < 0.85 ? 1 : 1.6;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x, y);
      ctx.lineTo(Math.min(256, x + len), y + (Math.random() - 0.5) * 2);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 2, Math.min(128, y + len));
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeBullet() {
  const group = new THREE.Group();
  const wear = makeWornMetalTexture();
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd9a23a,
    metalness: 0.66,
    roughness: 0.35,
    map: wear,
    side: THREE.DoubleSide,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: 0xbf6f38,
    metalness: 0.68,
    roughness: 0.38,
    map: wear,
    side: THREE.DoubleSide,
  });
  const primer = new THREE.MeshStandardMaterial({
    color: 0x63421f,
    metalness: 0.88,
    roughness: 0.44,
    side: THREE.DoubleSide,
  });

  const caseGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.000, -0.170),
    new THREE.Vector2(0.026, -0.170),
    new THREE.Vector2(0.0315, -0.164),
    new THREE.Vector2(0.0315, -0.158),
    new THREE.Vector2(0.024, -0.155),
    new THREE.Vector2(0.024, -0.145),
    new THREE.Vector2(0.0285, -0.140),
    new THREE.Vector2(0.0285, -0.052),
    new THREE.Vector2(0.0262, -0.034),
    new THREE.Vector2(0.0212, -0.018),
    new THREE.Vector2(0.0206, 0.000),
  ], 26);
  const caseMesh = new THREE.Mesh(caseGeo, brass);
  group.add(caseMesh);

  const bulletGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.000, 0.148),
    new THREE.Vector2(0.0045, 0.124),
    new THREE.Vector2(0.009, 0.102),
    new THREE.Vector2(0.013, 0.080),
    new THREE.Vector2(0.0165, 0.058),
    new THREE.Vector2(0.0192, 0.036),
    new THREE.Vector2(0.0206, 0.016),
    new THREE.Vector2(0.0208, 0.002),
    new THREE.Vector2(0.0198, -0.012),
  ], 26);
  const bulletMesh = new THREE.Mesh(bulletGeo, copper);
  group.add(bulletMesh);

  const primerCup = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.005, 18), primer);
  primerCup.position.y = -0.1665;
  group.add(primerCup);

  return group;
}

function initMenuShowcase() {
  if (MENU_SHOWCASE.scene) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.FogExp2(0x05070a, 0.04);

  const aspect = innerWidth / innerHeight;
  const view = MENU_CAM_DEBUG.view;
  const camera = new THREE.OrthographicCamera(
    -view * aspect, view * aspect, view, -view, 0.1, 20
  );
  camera.up.set(0, 0, -1);
  camera.position.set(MENU_CAM_DEBUG.x, MENU_CAM_DEBUG.y, MENU_CAM_DEBUG.z);
  camera.lookAt(MENU_CAM_DEBUG.lookX, MENU_CAM_DEBUG.lookY, MENU_CAM_DEBUG.lookZ);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({
    color: 0x080a0d,
    roughness: 0.94,
    metalness: 0.05,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.AmbientLight(0x88929c, 0.3));
  scene.add(new THREE.HemisphereLight(0x9fb4cc, 0x0a0b0d, 0.22));
  const key = new THREE.DirectionalLight(0xffdfb2, 0.85);
  key.position.set(3.2, 3.8, 1.6);
  key.target.position.set(2.4, 0.77, 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.6;
  key.shadow.camera.right = 3.6;
  key.shadow.camera.top = 3.6;
  key.shadow.camera.bottom = -3.6;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0002;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6fa0d8, 0.5);
  rim.position.set(-3, 2.4, -3);
  scene.add(rim);
  const spot = new THREE.SpotLight(0xffd2a0, 0.55, 14, Math.PI / 5.5, 0.7, 1.1);
  spot.position.set(2.7, 3.0, 1.7); spot.target.position.set(2.5, 0.77, 0.9);
  scene.add(spot, spot.target);
  const glint = new THREE.PointLight(0xffe2b0, 0.12, 5.0, 1.4);
  glint.position.set(2.2, 1.45, 1.05); scene.add(glint);

  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x39414a,
    map: makeTableTexture(),
    roughness: 0.46,
    metalness: 0.26,
  });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 1.5), tableMat);
  tableTop.position.set(2.4, 0.72, 0.8);
  tableTop.receiveShadow = true;
  scene.add(tableTop);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.72, metalness: 0.25 });
  for (const [lx, lz] of [[-1.15, -0.6], [1.15, -0.6], [-1.15, 0.6], [1.15, 0.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), legMat);
    leg.position.set(2.4 + lx, 0.36, 0.8 + lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  }

  const bulletSpots = [
    { x: 2.16, z: 0.44, yaw: 0.5, roll: 0.12, lie: true, flip: false },
    { x: 2.38, z: 0.38, yaw: -0.35, roll: -0.2, lie: true, flip: true },
    { x: 2.60, z: 0.45, yaw: 0.15, roll: 0.18, lie: true, flip: false },
    { x: 2.78, z: 0.52, yaw: -0.55, roll: -0.12, lie: true, flip: true },
    { x: 2.46, z: 1.28, yaw: 0.8, roll: 0.26, lie: true, flip: false },
    { x: 2.68, z: 1.38, yaw: -0.15, roll: -0.3, lie: true, flip: true },
    { x: 2.90, z: 1.30, yaw: 0.28, roll: 0.1, lie: true, flip: false },
    { x: 3.02, z: 1.55, yaw: 0.65, roll: 0.08, lie: false, flip: false },
  ];
  const tableSurface = 0.775;
  const shadowTex = makeShadowTexture();
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  for (const spot of bulletSpots) {
    const bullet = makeBullet();
    const holder = new THREE.Group();
    holder.position.set(spot.x, spot.lie ? tableSurface + 0.033 : tableSurface + 0.155, spot.z);
    holder.rotation.y = spot.yaw;
    if (spot.lie) {
      bullet.rotation.x = spot.flip ? -Math.PI / 2 : Math.PI / 2;
      bullet.rotation.z = spot.roll;
    } else {
      bullet.rotation.z = spot.roll * 0.5;
    }
    bullet.traverse((o: any) => {
      if (o.isMesh) o.castShadow = true;
    });
    holder.add(bullet);
    scene.add(holder);

    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), contactShadowMat);
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(spot.x, tableSurface + 0.004, spot.z);
    contact.scale.set(spot.lie ? 1.5 : 0.55, 1, spot.lie ? 0.62 : 0.55);
    contact.renderOrder = 2;
    scene.add(contact);
  }

  const weaponContact = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), contactShadowMat);
  weaponContact.rotation.x = -Math.PI / 2;
  weaponContact.position.set(2.4, tableSurface + 0.003, 0.8);
  weaponContact.scale.set(1.55, 1, 0.85);
  weaponContact.renderOrder = 1;
  scene.add(weaponContact);

  const glowTex = makeGlowTexture();
  const softTex = makeGlowTexture();
  const sparkTex = makeGlowTexture(true);

  const smokeSprites: any[] = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.SpriteMaterial({
      map: softTex,
      color: 0x788694,
      transparent: true,
      opacity: 0.025 + Math.random() * 0.022,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    const sc = 0.55 + Math.random() * 0.5;
    sp.scale.set(sc, sc * 0.72, 1);
    sp.position.set(
      1.7 + Math.random() * 1.9,
      0.78 + Math.random() * 0.32,
      0.25 + Math.random() * 1.2
    );
    sp.userData.base = sc;
    sp.userData.baseOpacity = mat.opacity;
    sp.userData.vy = 0.025 + Math.random() * 0.045;
    sp.userData.vx = (Math.random() - 0.5) * 0.055;
    scene.add(sp);
    smokeSprites.push(sp);
  }
  MENU_SHOWCASE.smokeSprites = smokeSprites;

  const smokeN = 36;
  const smokePos = new Float32Array(smokeN * 3);
  const smokeV = new Float32Array(smokeN * 3);
  for (let i = 0; i < smokeN; i++) {
    smokePos[i * 3] = 1.5 + Math.random() * 2.0;
    smokePos[i * 3 + 1] = 0.8 + Math.random() * 1.15;
    smokePos[i * 3 + 2] = 0.0 + Math.random() * 1.6;
    smokeV[i * 3] = (Math.random() - 0.5) * 0.07;
    smokeV[i * 3 + 1] = 0.055 + Math.random() * 0.075;
    smokeV[i * 3 + 2] = (Math.random() - 0.5) * 0.07;
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smoke = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({
      color: 0x8e9aa6,
      map: softTex,
      size: 0.85,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    })
  );
  scene.add(smoke);

  const dustN = 60;
  const dustPos = new Float32Array(dustN * 3);
  const dustV = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = 1.4 + Math.random() * 2.0;
    dustPos[i * 3 + 1] = 0.78 + Math.random() * 0.95;
    dustPos[i * 3 + 2] = 0.05 + Math.random() * 1.6;
    dustV[i * 3] = 0.04 + Math.random() * 0.13;
    dustV[i * 3 + 1] = -0.01 + Math.random() * 0.055;
    dustV[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xc2ced8,
      map: softTex,
      size: 0.08,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })
  );
  scene.add(dust);

  const sparkSprites: any[] = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: sparkTex,
      color: Math.random() < 0.7 ? 0xffcfa4 : 0xfff2d2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.001, 0.001, 1);
    sp.userData = {
      delay: 0.15 + i * 0.19 + Math.random() * 0.18,
      life: 0,
      maxLife: 0,
      base: 0.03,
      vx: 0,
      vy: 0,
      vz: 0,
    };
    scene.add(sp);
    sparkSprites.push(sp);
  }
  MENU_SHOWCASE.sparkSprites = sparkSprites;

  MENU_SHOWCASE.scene = scene;
  MENU_SHOWCASE.camera = camera;
  MENU_SHOWCASE.smoke = smoke;
  MENU_SHOWCASE.dust = dust;
  MENU_SHOWCASE.smokeV = smokeV;
  MENU_SHOWCASE.dustV = dustV;

  const menuGpu = document.getElementById('menuGpu');
  if (menuGpu) menuGpu.style.display = 'none';

  setShowcaseWeapon(3);
  MENU_SHOWCASE.active = true;
}

function setShowcaseWeapon(index: number) {
  const scene = MENU_SHOWCASE.scene;
  if (!scene) return;
  const count = WEAPONS.length;
  if (!count) return;
  MENU_SHOWCASE.weaponIndex = ((index % count) + count) % count;
  if (MENU_SHOWCASE.weapon) {
    scene.remove(MENU_SHOWCASE.weapon);
    MENU_SHOWCASE.weapon = null;
  }
  const weaponDef = WEAPONS[MENU_SHOWCASE.weaponIndex];
  if (!weaponDef?.build) return;
  const vm = weaponDef.build();
  if (vm.hands) vm.group.remove(vm.hands);
  texelize(vm.group, GUN_PER_M);
  vm.group.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.material = Array.isArray(o.material) ? o.material.map((m: any) => m.clone()) : o.material.clone();
      if (o.material.isMeshStandardMaterial) {
        o.material.color.multiplyScalar(0.9);
        o.material.roughness = Math.min(0.78, o.material.roughness + 0.03);
        o.material.metalness = Math.min(0.66, o.material.metalness + 0.08);
      }
    }
  });
  vm.group.position.set(0, 0.9, 0);
  vm.group.rotation.set(0, Math.PI / 2, Math.PI / 2);
  vm.group.scale.setScalar(1.6);
  scene.add(vm.group);
  const box = new THREE.Box3().setFromObject(vm.group);
  const center = box.getCenter(new THREE.Vector3());
  vm.group.position.x -= center.x;
  vm.group.position.y += 1.05 - center.y;
  vm.group.position.z -= center.z;
  vm.group.position.x += 2.4;
  vm.group.position.z += 0.8;
  const resting = new THREE.Box3().setFromObject(vm.group);
  vm.group.position.y += 0.775 - resting.min.y;
  MENU_SHOWCASE.weapon = vm.group;
  MENU_SHOWCASE.weaponTimer = 0;
}

function updateMenuShowcase(dt: number) {
  if (!MENU_SHOWCASE.active || !MENU_SHOWCASE.scene) return;
  MENU_SHOWCASE.time += dt;
  const cam = MENU_SHOWCASE.camera;
  const t = MENU_SHOWCASE.time;
  const amp = MENU_CAM_DEBUG.auto ? 0.15 : 0;
  const camX = MENU_CAM_DEBUG.x + Math.sin(t * 0.12) * amp;
  const camY = MENU_CAM_DEBUG.y;
  const camZ = MENU_CAM_DEBUG.z + Math.sin(t * 0.08) * amp * 0.8;
  cam.position.set(camX, camY, camZ);
  cam.up.set(0, 0, -1);
  cam.lookAt(MENU_CAM_DEBUG.lookX, MENU_CAM_DEBUG.lookY, MENU_CAM_DEBUG.lookZ);
  const aspect = innerWidth / innerHeight;
  const v = MENU_CAM_DEBUG.view;
  cam.left = -v * aspect;
  cam.right = v * aspect;
  cam.top = v;
  cam.bottom = -v;
  cam.updateProjectionMatrix();

  for (let i = 0; i < MENU_SHOWCASE.smokeSprites.length; i++) {
    const sp = MENU_SHOWCASE.smokeSprites[i];
    sp.position.y += sp.userData.vy * dt;
    sp.position.x += sp.userData.vx * dt + Math.sin(t * 0.18 + i * 0.9) * dt * 0.04;
    const pulse = 0.82 + 0.18 * Math.sin(t * 0.24 + i * 1.3);
    sp.material.opacity = sp.userData.baseOpacity * pulse;
    sp.scale.set(
      sp.userData.base * (0.94 + 0.06 * Math.sin(t * 0.17 + i)),
      sp.userData.base * 0.78 * (0.94 + 0.06 * Math.sin(t * 0.17 + i)),
      1
    );
    if (sp.position.y > 2.1 || sp.position.x < 1.2 || sp.position.x > 3.8 || sp.position.z < -0.4 || sp.position.z > 2.1) {
      sp.position.set(
        1.7 + Math.random() * 1.9,
        0.78,
        0.1 + Math.random() * 1.5
      );
    }
  }

  const smokePos = MENU_SHOWCASE.smoke.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < smokePos.length / 3; i++) {
    smokePos[i * 3] += MENU_SHOWCASE.smokeV[i * 3] * dt;
    smokePos[i * 3 + 1] += MENU_SHOWCASE.smokeV[i * 3 + 1] * dt;
    smokePos[i * 3 + 2] += MENU_SHOWCASE.smokeV[i * 3 + 2] * dt;
    if (smokePos[i * 3 + 1] > 2.1 || smokePos[i * 3] < 1.3 || smokePos[i * 3] > 3.6 || smokePos[i * 3 + 2] < -0.3 || smokePos[i * 3 + 2] > 1.9) {
      smokePos[i * 3] = 1.5 + Math.random() * 2.0;
      smokePos[i * 3 + 1] = 0.78;
      smokePos[i * 3 + 2] = 0.0 + Math.random() * 1.6;
    }
  }
  MENU_SHOWCASE.smoke.geometry.attributes.position.needsUpdate = true;

  const dustPos = MENU_SHOWCASE.dust.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < dustPos.length / 3; i++) {
    dustPos[i * 3] += MENU_SHOWCASE.dustV[i * 3] * dt;
    dustPos[i * 3 + 1] += MENU_SHOWCASE.dustV[i * 3 + 1] * dt;
    dustPos[i * 3 + 2] += MENU_SHOWCASE.dustV[i * 3 + 2] * dt;
    if (dustPos[i * 3] > 3.5 || dustPos[i * 3] < 1.3 || dustPos[i * 3 + 1] > 1.8 || dustPos[i * 3 + 1] < 0.75 || dustPos[i * 3 + 2] < -0.1 || dustPos[i * 3 + 2] > 1.8) {
      dustPos[i * 3] = 1.4 + Math.random() * 0.4;
      dustPos[i * 3 + 1] = 0.78 + Math.random() * 0.95;
      dustPos[i * 3 + 2] = 0.05 + Math.random() * 1.6;
    }
  }
  MENU_SHOWCASE.dust.geometry.attributes.position.needsUpdate = true;

  for (let i = 0; i < MENU_SHOWCASE.sparkSprites.length; i++) {
    const sp = MENU_SHOWCASE.sparkSprites[i];
    const s = sp.userData;
    if (s.life <= 0) {
      s.delay -= dt;
      if (s.delay > 0) continue;
      s.life = s.maxLife = 0.18 + Math.random() * 0.22;
      s.base = 0.016 + Math.random() * 0.028;
      sp.position.set(
        1.9 + Math.random() * 1.5,
        0.79 + Math.random() * 0.42,
        0.2 + Math.random() * 1.45
      );
      s.vx = (Math.random() - 0.5) * 0.16;
      s.vy = 0.3 + Math.random() * 0.55;
      s.vz = (Math.random() - 0.5) * 0.16;
      sp.material.color.setHex(Math.random() < 0.7 ? 0xffcfa4 : 0xfff2d2);
    } else {
      s.life -= dt;
      const k = Math.max(0, s.life / s.maxLife);
      sp.position.x += s.vx * dt;
      sp.position.y += s.vy * dt;
      sp.position.z += s.vz * dt;
      sp.material.opacity = Math.min(1, (1 - k) * 6) * Math.min(1, k * 4);
      const size = s.base * (0.5 + 0.8 * (1 - k));
      sp.scale.set(size, size, 1);
      if (s.life <= 0) {
        sp.material.opacity = 0;
        sp.scale.set(0.001, 0.001, 1);
        s.delay = 1.3 + Math.random() * 1.7;
      }
    }
  }
}

initMenuShowcase();
