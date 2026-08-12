'use strict';
/* =========================================================================
   3. PROCEDURAL TEXTURES
   ========================================================================= */
function cvs(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function finishTex(c, rep, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  t.anisotropy = MAXANISO;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
}
function grain(ctx, size, amt, alpha) {
  const img = ctx.getImageData(0, 0, size, size),
    d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    if (alpha !== undefined) d[i + 3] = d[i + 3];
  }
  ctx.putImageData(img, 0, 0);
}
function splotches(ctx, size, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size,
      y = Math.random() * size,
      r = rand(rMin, rMax);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = pick(colors);
    g.addColorStop(0, `rgba(${col},${alpha})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }
}

/* concrete floor: slab grid + stains + cracks */
function makeConcrete() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#5f6164';
  x.fillRect(0, 0, S, S);
  splotches(x, S, 70, ['82,84,87', '70,71,74', '92,93,95', '52,54,56'], 20, 110, 0.35);
  grain(x, S, 42);
  /* slab joints */
  x.strokeStyle = 'rgba(30,32,34,.85)';
  x.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    const p = (S / 2) * i;
    x.beginPath();
    x.moveTo(p, 0);
    x.lineTo(p, S);
    x.stroke();
    x.beginPath();
    x.moveTo(0, p);
    x.lineTo(S, p);
    x.stroke();
  }
  x.strokeStyle = 'rgba(160,163,166,.28)';
  x.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const p = (S / 2) * i + 2;
    x.beginPath();
    x.moveTo(p, 0);
    x.lineTo(p, S);
    x.stroke();
    x.beginPath();
    x.moveTo(0, p);
    x.lineTo(S, p);
    x.stroke();
  }
  /* cracks */
  x.strokeStyle = 'rgba(38,40,42,.6)';
  for (let i = 0; i < 16; i++) {
    x.lineWidth = rand(0.6, 1.8);
    x.beginPath();
    let px = Math.random() * S,
      py = Math.random() * S;
    x.moveTo(px, py);
    for (let s = 0; s < 7; s++) {
      px += rand(-34, 34);
      py += rand(-34, 34);
      x.lineTo(px, py);
    }
    x.stroke();
  }
  /* oil */
  splotches(x, S, 10, ['22,20,18', '30,26,20'], 14, 50, 0.5);
  return finishTex(c, [18, 18]);
}
/* corrugated shipping container panel */
function makeContainerTex() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#b0b0b0';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 26) {
    const g = x.createLinearGradient(i, 0, i + 26, 0);
    g.addColorStop(0, 'rgba(0,0,0,.30)');
    g.addColorStop(0.32, 'rgba(255,255,255,.20)');
    g.addColorStop(0.62, 'rgba(255,255,255,.06)');
    g.addColorStop(1, 'rgba(0,0,0,.34)');
    x.fillStyle = g;
    x.fillRect(i, 0, 26, S);
  }
  /* top and bottom rails */
  x.fillStyle = 'rgba(0,0,0,.34)';
  x.fillRect(0, 0, S, 18);
  x.fillRect(0, S - 20, S, 20);
  x.fillStyle = 'rgba(255,255,255,.07)';
  x.fillRect(0, 17, S, 2);
  x.fillRect(0, S - 21, S, 2);

  /* markings live on a decal layer, not here — this tile repeats 2.4x along a
     container and duplicated serial numbers are an instant tell */

  /* rust blooms and streaks running down from the top rail */
  splotches(x, S, 54, ['92,54,26', '120,66,30', '60,40,26', '40,38,36'], 8, 50, 0.42);
  for (let i = 0; i < 34; i++) {
    const rx = Math.random() * S,
      ry = rand(12, S * 0.5),
      h = rand(30, 180),
      w = rand(2, 9);
    const g = x.createLinearGradient(0, ry, 0, ry + h);
    g.addColorStop(0, 'rgba(96,52,24,.42)');
    g.addColorStop(1, 'rgba(96,52,24,0)');
    x.fillStyle = g;
    x.fillRect(rx, ry, w, h);
  }
  /* grime settling along the bottom */
  const gb = x.createLinearGradient(0, S * 0.76, 0, S);
  gb.addColorStop(0, 'rgba(28,26,24,0)');
  gb.addColorStop(1, 'rgba(26,24,22,.5)');
  x.fillStyle = gb;
  x.fillRect(0, S * 0.76, S, S * 0.24);
  grain(x, S, 24);
  return finishTex(c, [1, 1]);
}
/* rusty painted metal (barrels) */
function makeBarrelTex() {
  const S = 256,
    [c, x] = cvs(S);
  x.fillStyle = '#8f8d88';
  x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.fillRect(0, S * 0.2, S, 10);
  x.fillRect(0, S * 0.72, S, 10);
  x.fillStyle = 'rgba(255,255,255,.14)';
  x.fillRect(0, S * 0.2 - 4, S, 4);
  x.fillRect(0, S * 0.72 - 4, S, 4);
  splotches(x, S, 70, ['110,54,20', '138,70,28', '70,44,24', '48,44,40'], 5, 32, 0.55);
  grain(x, S, 30);
  for (let i = 0; i < S; i += 6) {
    x.fillStyle = i % 12 === 0 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    x.fillRect(i, 0, 3, S);
  }
  return finishTex(c, [1, 1]);
}
/* plywood shipping crate: planks, battens, nails, small stencils */
function makeCrateTex() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#82653f';
  x.fillRect(0, 0, S, S);

  /* horizontal boards with visible seams */
  const boards = 6,
    bh = S / boards;
  for (let b = 0; b < boards; b++) {
    const v = randI(-14, 14);
    x.fillStyle = `rgb(${clamp(134 + v, 0, 255)},${clamp(104 + v, 0, 255)},${clamp(64 + v, 0, 255)})`;
    x.fillRect(0, b * bh, S, bh - 2);
    x.fillStyle = 'rgba(44,30,16,.55)';
    x.fillRect(0, b * bh + bh - 2, S, 2);
    x.fillStyle = 'rgba(210,180,140,.10)';
    x.fillRect(0, b * bh, S, 1.5);
    /* grain within the board */
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = `rgba(${randI(70, 120)},${randI(48, 84)},${randI(22, 48)},.30)`;
      x.lineWidth = rand(0.5, 1.8);
      x.beginPath();
      const y = b * bh + rand(2, bh - 4);
      x.moveTo(0, y);
      x.bezierCurveTo(S * 0.33, y + rand(-4, 4), S * 0.66, y + rand(-4, 4), S, y + rand(-3, 3));
      x.stroke();
    }
    /* knot */
    if (Math.random() < 0.45) {
      const kx = rand(20, S - 20),
        ky = b * bh + bh / 2,
        kr = rand(4, 9);
      const g = x.createRadialGradient(kx, ky, 0, kx, ky, kr);
      g.addColorStop(0, 'rgba(52,34,16,.85)');
      g.addColorStop(0.6, 'rgba(84,58,30,.55)');
      g.addColorStop(1, 'rgba(84,58,30,0)');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(kx, ky, kr, kr * 0.7, 0, 0, 7);
      x.fill();
    }
  }

  /* corner battens */
  x.fillStyle = 'rgba(72,50,26,.85)';
  x.fillRect(0, 0, 26, S);
  x.fillRect(S - 26, 0, 26, S);
  x.fillRect(0, 0, S, 22);
  x.fillRect(0, S - 22, S, 22);
  x.fillStyle = 'rgba(196,164,120,.12)';
  x.fillRect(0, 0, 26, 3);
  x.fillRect(S - 26, 0, 26, 3);
  /* diagonal brace */
  x.save();
  x.strokeStyle = 'rgba(74,52,28,.7)';
  x.lineWidth = 20;
  x.beginPath();
  x.moveTo(26, S - 22);
  x.lineTo(S - 26, 22);
  x.stroke();
  x.restore();

  /* nail heads along the battens */
  x.fillStyle = 'rgba(38,34,30,.75)';
  for (let i = 30; i < S - 20; i += 44) {
    for (const px of [13, S - 13]) {
      x.beginPath();
      x.arc(px, i, 2.2, 0, 7);
      x.fill();
    }
    for (const py of [11, S - 11]) {
      x.beginPath();
      x.arc(i, py, 2.2, 0, 7);
      x.fill();
    }
  }

  /* small stencil block — real crates have a modest mark, not a banner */
  x.save();
  x.translate(S * 0.3, S * 0.4);
  x.fillStyle = 'rgba(38,26,12,.62)';
  x.font = 'bold 20px monospace';
  x.textAlign = 'left';
  x.fillText('FRAGILE', 0, 0);
  x.font = 'bold 13px monospace';
  x.fillText('LOT 44-' + randI(100, 999), 0, 17);
  /* up arrows */
  x.strokeStyle = 'rgba(38,26,12,.55)';
  x.lineWidth = 2.4;
  for (const ax of [0, 20]) {
    x.beginPath();
    x.moveTo(ax + 2, 44);
    x.lineTo(ax + 2, 28);
    x.moveTo(ax - 4, 34);
    x.lineTo(ax + 2, 28);
    x.lineTo(ax + 8, 34);
    x.stroke();
  }
  x.restore();

  /* scuffs and water staining near the base */
  splotches(x, S, 26, ['58,42,22', '44,34,20', '96,76,48'], 10, 52, 0.28);
  const wet = x.createLinearGradient(0, S * 0.72, 0, S);
  wet.addColorStop(0, 'rgba(46,32,16,0)');
  wet.addColorStop(1, 'rgba(42,30,15,.45)');
  x.fillStyle = wet;
  x.fillRect(0, S * 0.72, S, S * 0.28);
  grain(x, S, 20);
  return finishTex(c, [1, 1]);
}
/* chain link — alpha texture */
function makeFenceTex() {
  const S = 256,
    [c, x] = cvs(S);
  x.clearRect(0, 0, S, S);
  /* 14px lattice over a tile that covers ~1.7m gives ~9cm diamonds — coarser
     than that and it stops reading as chain link and starts reading as netting */
  const step = 14;
  x.strokeStyle = 'rgba(150,156,162,1)';
  x.lineWidth = 1.55;
  x.lineCap = 'square';
  for (let i = -S; i < S * 2; i += step) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + S, S);
    x.stroke();
    x.beginPath();
    x.moveTo(i, S);
    x.lineTo(i + S, 0);
    x.stroke();
  }
  x.globalAlpha = 0.45;
  x.strokeStyle = 'rgba(34,38,42,1)';
  x.lineWidth = 0.9;
  for (let i = -S; i < S * 2; i += step) {
    x.beginPath();
    x.moveTo(i + 1.4, 0);
    x.lineTo(i + S + 1.4, S);
    x.stroke();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAXANISO;
  t.encoding = THREE.sRGBEncoding;
  return t;
}
/* painted brick / warehouse wall */
function makeWallTex() {
  const S = 512,
    [c, x] = cvs(S);
  x.fillStyle = '#7a7168';
  x.fillRect(0, 0, S, S);
  const bw = 64,
    bh = 26;
  for (let r = 0, y = 0; y < S; y += bh, r++) {
    for (let xx = r % 2 ? -bw / 2 : 0; xx < S; xx += bw) {
      const v = randI(-16, 16);
      x.fillStyle = `rgb(${clamp(126 + v, 0, 255)},${clamp(114 + v, 0, 255)},${clamp(102 + v, 0, 255)})`;
      x.fillRect(xx + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }
  splotches(x, S, 50, ['64,58,50', '92,84,74', '48,46,44', '110,60,26'], 14, 80, 0.4);
  grain(x, S, 26);
  return finishTex(c, [1, 1]);
}
/* bullet hole decal */
function makeHoleTex() {
  const S = 64,
    [c, x] = cvs(S);
  x.clearRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(6,6,7,1)');
  g.addColorStop(0.32, 'rgba(16,15,14,.95)');
  g.addColorStop(0.55, 'rgba(60,56,50,.55)');
  g.addColorStop(1, 'rgba(90,86,80,0)');
  x.fillStyle = g;
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(150,146,138,.35)';
  x.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * 7,
      r0 = S * 0.16,
      r1 = S * rand(0.22, 0.42);
    x.beginPath();
    x.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0);
    x.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
/* soft round sprite (muzzle flash core / smoke) */
function makeGlowTex() {
  const S = 128,
    [c, x] = cvs(S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,236,180,.95)');
  g.addColorStop(0.5, 'rgba(255,150,40,.45)');
  g.addColorStop(1, 'rgba(255,90,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
/* star-shaped flash */
function makeFlashTex() {
  const S = 128,
    [c, x] = cvs(S);
  x.translate(S / 2, S / 2);
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * 7,
      len = rand(S * 0.22, S * 0.5),
      w = rand(4, 13);
    const g = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, 'rgba(255,248,222,.95)');
    g.addColorStop(1, 'rgba(255,140,20,0)');
    x.fillStyle = g;
    x.save();
    x.rotate(a);
    x.beginPath();
    x.moveTo(0, -w / 2);
    x.lineTo(len, 0);
    x.lineTo(0, w / 2);
    x.closePath();
    x.fill();
    x.restore();
  }
  const g2 = x.createRadialGradient(0, 0, 0, 0, 0, S * 0.28);
  g2.addColorStop(0, 'rgba(255,255,255,1)');
  g2.addColorStop(0.4, 'rgba(255,225,150,.8)');
  g2.addColorStop(1, 'rgba(255,140,20,0)');
  x.fillStyle = g2;
  x.beginPath();
  x.arc(0, 0, S * 0.28, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

const TEX = {
  concrete: makeConcrete(),
  container: makeContainerTex(),
  barrel: makeBarrelTex(),
  crate: makeCrateTex(),
  fence: makeFenceTex(),
  wall: makeWallTex(),
  hole: makeHoleTex(),
  glow: makeGlowTex(),
  flash: makeFlashTex(),
};
