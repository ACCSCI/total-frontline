'use strict';
/* =========================================================================
   11. PLAYER + GAME STATE
   ========================================================================= */
const STAND_H = 1.72,
  CROUCH_H = 1.08,
  P_RADIUS = 0.36;
const SPAWN = { x: 0, z: 24 };
const GRACE_TIME = 3.0;
const player = {
  pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), // FEET
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  hp: 100,
  armor: 50,
  armorMax: 50,
  height: STAND_H,
  eye: STAND_H,
  onGround: true,
  crouch: false,
  sprint: false,
  bob: 0,
  bobAmp: 0,
  stepPhase: 0,
  landShake: 0,
  shake: 0,
  shakeSeed: rand(0, 100),
  recoilPitch: 0,
  recoilYaw: 0,
  recoilVelP: 0,
  recoilVelY: 0,
  burstCount: 0,
  burstIdle: 0,
  fovKick: 0,
  weapon: 0,
  switching: 0,
  switchTo: -1,
  reloadT: 0,
  pumpT: 0,
  boltT: 0,
  boltPhase: 0,
  fireCooldown: 0,
  triggerHeld: false,
  triggerReleased: true,
  clickBuf: 0,
  ads: false,
  adsK: 0,
  adsEase: 0,
  breath: 0,
  breathHeld: false,
  breathLock: false,
  swayT: 0,
  jumpsLeft: 0,
  spaceEdge: false,
  mantleT: 0,
  mantleDur: 0,
  mantleFrom: new THREE.Vector3(),
  mantleTo: new THREE.Vector3(),
  dead: false,
  lastHurt: 0,
};
const G = {
  running: false,
  over: false,
  paused: false,
  started: false,
  time: 600,
  kills: 0,
  deaths: 0,
  respawnT: 0,
  protect: 0,
  streak: 0,
  uavT: 0,
  empT: 0,
  airstrike: null,
  streaksReady: [],
  heli: null,
  gunship: null,
  jug: false,
  headshots: 0,
  shots: 0,
  hits: 0,
  elapsed: 0,
  dmgFlash: 0,
  lowPulse: 0,
  hbTimer: 0,
  killFlash: 0,
  grace: GRACE_TIME, // hostiles hold fire while you get your bearings
};

/* =========================================================================
   12. HUD
   ========================================================================= */
const $ = (id) => document.getElementById(id);
const UI = {
  hud: $('hud'),
  cctx: $('cross').getContext('2d'),
  hitmark: $('hitmark'),
  feed: $('feed'),
  dmgDirs: $('dmgDirs'),
  hpNum: $('hpNum'),
  hpFill: $('hpFill'),
  apNum: $('apNum'),
  apFill: $('apFill'),
  magNum: $('magNum'),
  resNum: $('resNum'),
  wname: $('wname'),
  wmode: $('wmode'),
  wicon: $('wicon'),
  reloadHint: $('reloadHint'),
  timer: $('timer'),
  killCount: $('killCount'),
  streakPop: $('streakPop'),
  streakLine: $('streakLine'),
  streakDock: $('streakDock'),
  lowhp: $('lowhp'),
  edgeGlow: $('edgeGlow'),
  minimap: $('minimap'),
  mctx: $('minimap').getContext('2d'),
  slots: [...document.querySelectorAll('.slot')],
  cross: $('cross'),
  scope: $('scope'),
  retWrap: $('retWrap'),
  breathTag: $('breathTag'),
  comms: $('comms'),
  _scopeK: -1,
  _breathTip: null,
  startScreen: $('startScreen'),
  endScreen: $('endScreen'),
  pause: $('pause'),
  respawn: $('respawn'),
  respawnNum: $('respawnNum'),
  boot: $('boot'),
};

function updateVitalsUI() {
  UI.hpNum.textContent = Math.max(0, Math.round(player.hp));
  UI.apNum.textContent = Math.max(0, Math.round(player.armor));
  UI.hpFill.style.transform = `scaleX(${clamp(player.hp / 100, 0, 1)})`;
  UI.apFill.style.transform = `scaleX(${clamp(player.armor / (player.armorMax || 50), 0, 1)})`;
  UI.hpFill.classList.toggle('low', player.hp <= 30);
}
function updateAmmoUI() {
  const w = WEAPONS[player.weapon];
  UI.magNum.textContent = w.mag;
  UI.resNum.textContent = '/ ' + w.res;
  UI.magNum.classList.toggle('empty', w.mag === 0);
  UI.wname.textContent = w.name;
  UI.wmode.textContent =
    w.id === 'shotgun'
      ? '泵动式'
      : w.id === 'sniper'
        ? '栓动式'
        : w.auto && !w.semi
          ? '全自动'
          : '半自动';
  if (UI._icon !== player.weapon) {
    UI._icon = player.weapon;
    UI.wicon.innerHTML = WICONS[player.weapon];
  }
  const need = w.mag === 0 || (w.mag <= w.magSize * 0.25 && w.res > 0);
  UI.reloadHint.textContent =
    w.mag === 0 && w.res === 0 ? '弹药耗尽' : need && player.reloadT <= 0 ? '按 R 装填' : '';
  UI.reloadHint.classList.toggle('blink', w.mag === 0 && w.res > 0);
  UI.slots.forEach((s, i) => {
    s.classList.toggle('act', i === player.weapon);
  });
}
function showHitmark(kill) {
  UI.hitmark.classList.remove('show', 'kill');
  void UI.hitmark.offsetWidth;
  if (kill) UI.hitmark.classList.add('kill');
  UI.hitmark.classList.add('show');
}
const HEADSHOT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.5" stroke="#ffb340" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#ffb340"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="#ffb340" stroke-width="2"/></svg>`;
const SKULL_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#dfe6ec" opacity=".8"><path d="M12 2C7 2 3.5 5.4 3.5 10c0 2.6 1.2 4.6 3 5.9V19a2 2 0 002 2h1v-3h1.2v3h2.6v-3H14.5v3h1a2 2 0 002-2v-3.1c1.8-1.3 3-3.3 3-5.9C20.5 5.4 17 2 12 2zM8.6 12.2a1.9 1.9 0 110-3.8 1.9 1.9 0 010 3.8zm6.8 0a1.9 1.9 0 110-3.8 1.9 1.9 0 010 3.8z"/></svg>`;
/* killer defaults to the player; squadmates and killstreaks pass a name */
function killFeed(victim, head, killer) {
  const el = document.createElement('div');
  el.className = 'kf';
  el.innerHTML = `<span class="${killer ? 'al' : 'me'}">${killer || '你'}</span><span class="ic">${head ? HEADSHOT_ICON : SKULL_ICON}</span><span class="vic">${victim}</span>`;
  UI.feed.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 4200);
  while (UI.feed.children.length > 5) UI.feed.firstChild.remove();
}
/* killstreaks waiting on the player's call — docked on the left, keys 6–0 */
function updateStreakDock() {
  const keys = ['6', '7', '8', '9', '0'];
  let html = '';
  G.streaksReady.forEach((s, i) => {
    html += `<div class="sk"><b>${keys[i]}</b><span>${s.name}</span></div>`;
  });
  UI.streakDock.innerHTML = html;
}
function pushComms(who, text) {
  const el = document.createElement('div');
  el.className = 'cm';
  el.innerHTML = `<i>&gt;&gt;</i> <b>${who}</b> — ${text}`;
  UI.comms.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 520);
  }, 3400);
  while (UI.comms.children.length > 4) UI.comms.firstChild.remove();
}
/* mil-dot ticks, built here so the spacing stays uniform without 24 CSS rules */
{
  const rw = $('retWrap');
  const add = (cls, x, y) => {
    const i = document.createElement('i');
    i.className = 'mil ' + cls;
    i.style.left = x + 'vmin';
    i.style.top = y + 'vmin';
    rw.appendChild(i);
  };
  for (let n = 1; n <= 5; n++) {
    const off = 1.8 + n * 3.35;
    add('d', 0, off); // holdover dots below centre
    add('t', -off, 0);
    add('t', off, 0); // windage ticks either side
    if (n <= 3) add('tv', 0, -off);
  }
}

const DMG_ARCS = [];
for (let i = 0; i < 5; i++) {
  const d = document.createElement('div');
  d.className = 'dmgArc';
  UI.dmgDirs.appendChild(d);
  DMG_ARCS.push({ el: d, t: 0 });
}
let dmgHead = 0;
function damageIndicator(worldPos) {
  const dx = worldPos.x - camera.position.x,
    dz = worldPos.z - camera.position.z;
  const angToSrc = Math.atan2(dx, dz); // world bearing
  const rel = angToSrc - (player.yaw + PI); // relative to view forward
  const a = DMG_ARCS[dmgHead];
  dmgHead = (dmgHead + 1) % DMG_ARCS.length;
  a.el.style.transform = `rotate(${-rel}rad)`;
  a.t = 1.35;
}
function updateDmgArcs(dt) {
  for (const a of DMG_ARCS) {
    if (a.t <= 0) continue;
    a.t -= dt;
    a.el.style.opacity = clamp(a.t / 1.35, 0, 1) * 0.95;
  }
}

/* =========================================================================
   Crosshair — four inner marks that carry the spread, four outer marks that
   never move. All dimensions below are CSS pixels; drawCrosshair converts them
   to whole device pixels so nothing ever straddles half a pixel.
   ========================================================================= */
const XH = {
  inGap: 1,
  inLen: 4,
  inThick: 2, // inner marks, measured out from centre
  outGap: 2,
  outLen: 3,
  outThick: 2, // outer marks, measured on from the inner marks at rest
  outline: 1, // black keyline
  maxSpread: 12, // ceiling on the dynamic part
  /* Movement error is deliberately small. There are only 2px of clear air
     between the inner and outer marks, so anything past about 1.5px of bloom
     runs the two together into one long tick. Walking should still read as two
     marks; sprinting, jumping and firing are the states allowed to fuse. */
  moveErr: 0.26, // px per m/s
  airErr: 3.0,
  reloadErr: 2.0,
  crouchMult: 0.7,
  fireScale: 240, // px per radian of accumulated weapon spread
  fireHold: 0.11, // firing term stays on this long past a round —
  // just over the 0.086s between rifle rounds
  fallRate: 20, // e-fold rate; 3/20 puts the return at the 0.15s asked for
  dpr: 1,
  cx: 0,
  cy: 0,
  _last: -1,
};
/* Sized off the furthest the inner marks can travel, so the cap and the canvas
   can never disagree and clip an arm at full bloom. */
XH.size = 2 * Math.ceil(XH.inGap + XH.maxSpread + XH.inLen + XH.outline) + 8;

let crossSpread = 0,
  crossShots = 0,
  crossFireT = 0;

function layoutCrosshair() {
  const cv = UI.cross,
    d = Math.max(1, devicePixelRatio || 1);
  cv.width = cv.height = Math.round(XH.size * d);
  cv.style.width = cv.style.height = XH.size + 'px';
  /* Snap the placement to the device grid, not the CSS grid. Half of an odd
     viewport is a half CSS pixel and left at that the whole canvas — and
     everything drawn in it — renders soft. Rounding in device pixels keeps it
     hard-edged while landing dead centre wherever the display can express it:
     at 2x an odd viewport still has a whole device pixel at the middle. */
  const snap = (v) => Math.round(v * d) / d + 'px';
  cv.style.left = snap(innerWidth / 2 - XH.size / 2);
  cv.style.top = snap(innerHeight / 2 - XH.size / 2);
  XH.dpr = d;
  XH.cx = Math.round(cv.width / 2);
  XH.cy = Math.round(cv.height / 2);
  /* Resizing the backing store wipes it, so put the reticle back now rather
     than leaving a hole until the next update — the HUD stays up while paused,
     which is exactly when someone is most likely to be dragging the window. */
  XH._last = Math.round((XH.inGap + crossSpread) * d);
  drawCrosshair(XH._last);
}

/** @param iA inner gap in whole device pixels, already quantised by the caller */
function drawCrosshair(iA) {
  const cv = UI.cross,
    ctx = UI.cctx,
    d = XH.dpr,
    cx = XH.cx,
    cy = XH.cy;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const u = (v) => Math.max(1, Math.round(v * d));
  const o = Math.max(1, Math.round(XH.outline * d));
  /* The outer marks are pinned to where the inner marks sit at rest, so they
     answer to neither fire nor movement however far the inner ones travel. */
  const oA = Math.round((XH.inGap + XH.inLen + XH.outGap) * d);

  /* gap, length, thickness, and whether the keyline closes on the inward end.
     The inner marks leave that end open deliberately: across a 1px centre gap
     a closed keyline meets itself in the middle and reads as exactly the centre
     dot this crosshair is specified not to have. */
  const arms = [
    [iA, u(XH.inLen), u(XH.inThick), 0],
    [oA, u(XH.outLen), u(XH.outThick), 1],
  ];

  /* Every keyline first, then every white mark. Done arm by arm, the next
     arm's outline would bite into white already laid down. */
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? 'rgba(255,255,255,.97)' : 'rgba(0,0,0,.88)';
    const kf = pass ? 0 : o; // grow past the far end
    for (const [a, len, t, near] of arms) {
      const kn = pass ? 0 : o * near; // ...and past the near end
      const thin = t + (pass ? 0 : 2 * o); // across the mark
      const long = len + kf + kn; // along it
      const off = (t >> 1) + (pass ? 0 : o);
      ctx.fillRect(cx - off, cy - a - len - kf, thin, long);
      ctx.fillRect(cx - off, cy + a - kn, thin, long);
      ctx.fillRect(cx - a - len - kf, cy - off, long, thin);
      ctx.fillRect(cx + a - kn, cy - off, long, thin);
    }
  }
}

function updateCrosshair(dt) {
  const w = WEAPONS[player.weapon];
  const speed = Math.hypot(player.vel.x, player.vel.z);
  let target = speed * XH.moveErr + (player.onGround ? 0 : XH.airErr);
  if (player.crouch) target *= XH.crouchMult;
  if (player.reloadT > 0) target += XH.reloadErr;

  /* While rounds are still going out, follow the weapon's real accumulated
     spread: that is what the bullets are doing, and it climbs through a spray
     exactly the way the reticle should. The term is dropped the moment firing
     stops rather than tracking the weapon's own recovery, which runs most of a
     second and would leave the crosshair hanging open long after the player let
     go. A restart rewinds the shot counter, which must not read as a shot. */
  crossFireT = Math.max(0, crossFireT - dt);
  if (G.shots !== crossShots) {
    if (G.shots > crossShots) crossFireT = XH.fireHold;
    crossShots = G.shots;
  }
  if (crossFireT > 0) target += (w.spread - w.spreadBase) * XH.fireScale;

  target *= lerp(1, 0.45, player.adsEase);
  target = clamp(target, 0, XH.maxSpread);
  /* Straight out to the floor, and back to it over 0.15s. */
  crossSpread = target > crossSpread ? target : damp(crossSpread, target, XH.fallRate, dt);

  const iA = Math.round((XH.inGap + crossSpread) * XH.dpr);
  if (iA !== XH._last) {
    XH._last = iA;
    drawCrosshair(iA);
  }

  /* scope overlay owns the screen centre once it's up */
  const scopeK = w.scope ? clamp((player.adsEase - 0.45) / 0.4, 0, 1) : 0;
  if (scopeK !== UI._scopeK) {
    UI._scopeK = scopeK;
    UI.scope.style.opacity = scopeK;
    compMat.uniforms.scope.value = scopeK;
    UI.cross.classList.toggle('hidden', scopeK > 0.02);
    /* the gun would otherwise render straight through the lens */
    vmRoot.visible = scopeK < 0.92;
  }
  const showBreath = scopeK > 0.5 && !player.breathLock && player.breath <= 0 && !player.breathHeld;
  if (showBreath !== UI._breathTip) {
    UI._breathTip = showBreath;
    UI.breathTag.classList.toggle('on', showBreath);
  }
}

/* minimap */
function drawMinimap() {
  const ctx = UI.mctx,
    S = 172,
    cx = S / 2,
    cy = S / 2,
    scale = 2.35;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, cx - 2, 0, 7);
  ctx.clip();
  ctx.fillStyle = 'rgba(8,12,16,.82)';
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.yaw);
  ctx.scale(scale, scale);
  ctx.translate(-player.pos.x, -player.pos.z);

  /* perimeter */
  ctx.strokeStyle = 'rgba(255,179,64,.35)';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(-HALF, -HALF, HALF * 2, HALF * 2);
  /* grid */
  ctx.strokeStyle = 'rgba(120,140,160,.10)';
  ctx.lineWidth = 0.3;
  for (let i = -HALF; i <= HALF; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -HALF);
    ctx.lineTo(i, HALF);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-HALF, i);
    ctx.lineTo(HALF, i);
    ctx.stroke();
  }
  /* footprints */
  for (const r of mapRects) {
    ctx.fillStyle = r.c;
    ctx.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
  }
  /* enemies */
  for (const e of enemies) {
    const p = e.obj.position;
    if (e.dead) {
      ctx.strokeStyle = 'rgba(120,130,140,.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 0.8, p.z - 0.8);
      ctx.lineTo(p.x + 0.8, p.z + 0.8);
      ctx.moveTo(p.x + 0.8, p.z - 0.8);
      ctx.lineTo(p.x - 0.8, p.z + 0.8);
      ctx.stroke();
      continue;
    }
    const spotted = e.canSee || e.alerted || G.uavT > 0;
    ctx.fillStyle = spotted ? '#ff3b30' : 'rgba(255,120,90,.42)';
    ctx.beginPath();
    ctx.arc(p.x, p.z, spotted ? 1.5 : 1.1, 0, 7);
    ctx.fill();
    if (spotted) {
      ctx.strokeStyle = 'rgba(255,59,48,.5)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.z, 2.6, 0, 7);
      ctx.stroke();
    }
  }
  /* allies — blue, so a friendly never reads as a contact */
  for (const a of allies) {
    const p = a.obj.position;
    if (a.dead) {
      ctx.strokeStyle = 'rgba(120,130,140,.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 0.8, p.z - 0.8);
      ctx.lineTo(p.x + 0.8, p.z + 0.8);
      ctx.moveTo(p.x + 0.8, p.z - 0.8);
      ctx.lineTo(p.x - 0.8, p.z + 0.8);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath();
    ctx.arc(p.x, p.z, 1.3, 0, 7);
    ctx.fill();
  }
  ctx.restore();

  /* view cone + player */
  ctx.fillStyle = 'rgba(255,179,64,.13)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 44, -PI / 2 - 0.62, -PI / 2 + 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx + 4.6, cy + 5);
  ctx.lineTo(cx, cy + 2.6);
  ctx.lineTo(cx - 4.6, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(223,230,236,.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, cx - 2, 0, 7);
  ctx.stroke();
}
