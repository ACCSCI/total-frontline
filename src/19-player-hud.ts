'use strict';
/* =========================================================================
   11. PLAYER + GAME STATE
   ========================================================================= */
const STAND_H = SHARED_MOVEMENT.stance.standHeight,
  CROUCH_H = SHARED_MOVEMENT.stance.crouchHeight,
  P_RADIUS = SHARED_MOVEMENT.stance.radius;
const SPAWN = { x: 0, z: 24 };
const GRACE_TIME = 3.0;
const player: any = {
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
  prone: false, proneEdge: false,
  sprint: false,
  sprintFireRaise: 0,
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
  reloadDuration: 0,
  reloadEmpty: false,
  reloadPhase: 0,
  reloadRounds: 0,
  meleeT: 0,
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
  scoped: false,
  breath: 0,
  breathHeld: false,
  breathLock: false,
  swayT: 0,
  swayAmp: 1,
  scopeSwayX: 0,
  scopeSwayY: 0,
  jumpsLeft: 0,
  spaceEdge: false,
  mantleT: 0,
  mantleDur: 0,
  mantleFrom: new THREE.Vector3(),
  mantleTo: new THREE.Vector3(),
  dead: false,
  lastHurt: 0,
};
const G: any = {
  running: false, over: false, paused: false, started: false,
  mode: 'skirmish', mission: null,
  time: 600, kills: 0, deaths: 0, respawnT: 0, protect: 0,
  streak: 0, uavT: 0, empT: 0, airstrike: null, streaksReady: [],
  heli: null, gunship: null, jug: false,
  headshots: 0, shots: 0, hits: 0, elapsed: 0,
  dmgFlash: 0, lowPulse: 0, hbTimer: 0, killFlash: 0,
  grace: GRACE_TIME, // hostiles hold fire while you get your bearings
};

/* =========================================================================
   12. HUD
   ========================================================================= */
const $ = (id: string): any => document.getElementById(id);
const UI: Record<string, any> = {
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
  throwTac: $('throwTac'),
  throwLethal: $('throwLethal'),
  timer: $('timer'),
  killCount: $('killCount'),
  missionObj: $('missionObj'),
  streakPop: $('streakPop'),
  streakLine: $('streakLine'),
  streakDock: $('streakDock'),
  gunshipHud: $('gunshipHud'),
  gunshipTime: $('gunshipTime'),
  gunshipWeapons: [...document.querySelectorAll('.ghWeapon')],
  gunshipTargets: $('gunshipTargets'), gunshipSelf: $('gunshipSelf'), slots: [...document.querySelectorAll('.slot')],
  gunshipTargetEls: [],
  jugFrame: $('jugFrame'),
  jugStatus: $('jugStatus'),
  lowhp: $('lowhp'),
  edgeGlow: $('edgeGlow'),
  minimap: $('minimap'),
  mctx: $('minimap').getContext('2d'),
  cross: $('cross'),
  scope: $('scope'),
  retWrap: $('retWrap'),
  breathTag: $('breathTag'),
  comms: $('comms'),
  lootPrompt: $('lootPrompt'),
  _scopeK: -1,
  _crossHidden: false,
  _breathTip: null,
  startScreen: $('startScreen'),
  endScreen: $('endScreen'),
  pause: $('pause'),
  respawn: $('respawn'),
  respawnNum: $('respawnNum'),
  boot: $('boot'),
};

function setJuggernautUI(on) {
  UI.hud.classList.toggle('jug', on);
  if (!on) {
    UI.jugFrame.classList.remove('damage1', 'damage2', 'damage3');
    UI.jugStatus.textContent = '装甲完整';
  }
}

function setGunshipUI(on) {
  UI.hud.classList.toggle('gunship', on);
  if (!on) {
    for (const el of UI.gunshipTargetEls) el.style.display = 'none';
    UI.gunshipSelf.style.display = 'none';
    return;
  }
  while (UI.gunshipTargetEls.length < Math.max(10, enemies.length)) {
    const marker = document.createElement('div');
    marker.className = 'ghTarget';
    marker.innerHTML = '<span>敌军</span>';
    UI.gunshipTargets.appendChild(marker);
    UI.gunshipTargetEls.push(marker);
  }
  UI.scope.style.opacity = 0;
  compMat.uniforms.scope.value = 0;
}

function updateGunshipUI(s) {
  UI.gunshipTime.textContent = `${Math.max(0, s.t).toFixed(1)} 秒`;
  UI.gunshipWeapons.forEach((el, i) => {
    el.classList.toggle('on', i === s.weapon);
    const cd = Math.max(0, s.cooldowns[i]);
    el.querySelector('b').textContent = cd > 0.04 ? cd.toFixed(1) : '就绪';
  });
}

function updateVitalsUI() {
  UI.hpNum.textContent = Math.max(0, Math.round(player.hp));
  UI.apNum.textContent = Math.max(0, Math.round(player.armor));
  UI.hpFill.style.transform = `scaleX(${clamp(player.hp / 100, 0, 1)})`;
  UI.apFill.style.transform = `scaleX(${clamp(player.armor / (player.armorMax || 50), 0, 1)})`;
  UI.hpFill.classList.toggle('low', player.hp <= 30);
  if (G.jug) {
    const integrity = clamp(
      (player.armor + Math.max(0, player.hp)) / (player.armorMax + 100),
      0,
      1
    );
    UI.jugFrame.classList.toggle('damage1', integrity < 0.82);
    UI.jugFrame.classList.toggle('damage2', integrity < 0.55);
    UI.jugFrame.classList.toggle('damage3', integrity < 0.28);
    UI.jugStatus.textContent =
      integrity < 0.28
        ? '装甲危急'
        : integrity < 0.55
          ? '装甲严重破损'
          : integrity < 0.82
            ? '装甲受损'
            : '装甲完整';
  }
}
function updateAmmoUI() {
  const w = WEAPONS[player.weapon];
  UI.magNum.textContent = w.infiniteAmmo ? '∞' : w.mag;
  UI.resNum.textContent = w.infiniteAmmo ? '无限弹药' : '/ ' + w.res;
  UI.magNum.classList.toggle('empty', !w.infiniteAmmo && w.mag === 0);
  UI.wname.textContent = w.name;
  UI.wmode.textContent =
    w.id === 'shotgun'
      ? '泵动式'
      : w.id === 'sniper'
        ? '栓动式'
        : w.auto && !w.semi
          ? w.infiniteAmmo
            ? '全自动 // 持续供弹'
            : '全自动'
          : '半自动';
  if (UI._icon !== player.weapon) {
    UI._icon = player.weapon;
    UI.wicon.innerHTML = WICONS[player.weapon];
  }
  const need = !w.infiniteAmmo && (w.mag === 0 || (w.mag <= w.magSize * 0.25 && w.res > 0));
  UI.reloadHint.textContent = w.infiniteAmmo
    ? ''
    : w.mag === 0 && w.res === 0
      ? '弹药耗尽'
      : need && player.reloadT <= 0
        ? '按 R 装填'
        : '';
  UI.reloadHint.classList.toggle('blink', !w.infiniteAmmo && w.mag === 0 && w.res > 0);
  UI.slots.forEach((s, i) => {
    s.classList.toggle('act', i === player.weapon);
  });
}
function showHitmark(kill) {
  syncHitmarkToAim();
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
/* killstreaks waiting on the player's call — docked on the left, keys F1–F6 */
function updateStreakDock() {
  const keys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
  let html = '';
  if (killstreaksEnabled()) {
    G.streaksReady.forEach((s, i) => {
      html += `<div class="sk"><b>${keys[i]}</b><span>${s.name}</span></div>`;
    });
  }
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
  const rel = Gameplay.damageBearing(
    worldPos.x,
    worldPos.z,
    camera.position.x,
    camera.position.z,
    player.yaw
  );
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
const XH: any = Object.assign(
  { dpr: 1, cx: 0, cy: 0, _last: -1, size: Gameplay.crosshairCanvasSize() },
  Gameplay.CROSSHAIR
);

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

function drawCrosshair(iA) {
  Gameplay.drawCrosshair(
    UI.cctx,
    {
      dpr: XH.dpr,
      cx: XH.cx,
      cy: XH.cy,
      width: UI.cross.width,
      height: UI.cross.height,
    },
    iA
  );
}

function updateCrosshair(dt) {
  syncHitmarkToAim();
  const w = WEAPONS[player.weapon];
  const speed = Math.hypot(player.vel.x, player.vel.z);
  crossFireT = Math.max(0, crossFireT - dt);
  if (G.shots !== crossShots) {
    if (G.shots > crossShots) crossFireT = XH.fireHold;
    crossShots = G.shots;
  }
  const target = Gameplay.crosshairTarget({
    baseSpread: w.spreadBase,
    moveSpread: w.moveSpread,
    speed,
    airSpread: player.onGround ? 0 : w.airSpread,
    stanceSpread: stanceSpreadMultiplier(w),
    adsEase: player.adsEase,
    reloading: player.reloadT > 0,
    firing: crossFireT > 0,
    spread: w.spread,
  });
  crossSpread = Gameplay.stepCrosshairSpread(crossSpread, target, dt);

  const iA = Math.round((XH.inGap + crossSpread) * XH.dpr);
  if (iA !== XH._last) {
    XH._last = iA;
    drawCrosshair(iA);
  }

  /* scope overlay owns the screen centre once it's up */
  const scopeK = Gameplay.scopeBlend(player.adsEase, !!w.scope);
  if (scopeK !== UI._scopeK) {
    UI._scopeK = scopeK;
    UI.scope.style.opacity = scopeK;
    compMat.uniforms.scope.value = scopeK;
    /* the gun would otherwise render straight through the lens */
    vmRoot.visible = scopeK < 0.92;
  }
  /* The Juggernaut braces a sightless minigun; its hip reticle stays visible. */
  const crossHidden =
    Gameplay.adsHidesCrosshair(player.adsEase, !!w.bracedAim) || !!G.gunship?.controlled;
  if (crossHidden !== UI._crossHidden) {
    UI._crossHidden = crossHidden;
    UI.cross.classList.toggle('hidden', crossHidden);
  }
  const showBreath = Gameplay.showBreathHint(
    scopeK,
    player.breathLock,
    player.breath,
    player.breathHeld
  );
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
