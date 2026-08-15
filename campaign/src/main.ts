import * as THREE from 'three';
import { CampaignRules } from './campaign';
import { P0Combat } from './combat';
import { Crosshair } from './crosshair';
import { PropDebugger } from './debug-mode';
import { gridFootprint } from './grid';
import { predictGroundDelta } from './ground-model';
import { typeMissionBriefing } from './intro-typing';
import { buildP0Level, buildSupplyCrate, type P0Level } from './level';
import { FirstPersonPlayer } from './player';
import { createRenderer, type GameRenderer } from './renderer';
import { ScreenRain } from './screen-rain';
import { makeIntroCutscene, makeOutroCutscene, Sequencer } from './sequencer';
import { SFX } from './sfx';
import { snapObjectToTerrain, windAt } from './terrain';
import { ViewmodelRig } from './viewmodel';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const loading = document.getElementById('loading') as HTMLDivElement;
const loadingText = document.getElementById('loadingText') as HTMLDivElement;
const loadingSub = document.getElementById('loadingSub') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const hint = document.getElementById('hint') as HTMLDivElement;
const cutsceneBars = document.getElementById('cutsceneBars') as HTMLDivElement;
const objectiveText = document.getElementById('objectiveText') as HTMLDivElement;
const completePanel = document.getElementById('complete') as HTMLDivElement;
const crossCanvas = document.getElementById('cross') as HTMLCanvasElement;
const introOverlay = document.getElementById('introOverlay') as HTMLDivElement;
const introTyped = document.getElementById('introTyped') as HTMLSpanElement;
const beaconLayer = document.getElementById('beaconLayer') as HTMLDivElement;
const stanceText = document.getElementById('p0Stance') as HTMLDivElement;

const scene = new THREE.Scene();
let renderer: GameRenderer;
let level: P0Level;
let player: FirstPersonPlayer;
let cutscene: Sequencer | null = null;
let controlsEnabled = false;
let reachedExit = false;
let completed = false;
let firing = false;
let pointerLocked = false;
let lightningOn = false;
let introState: 'waiting' | 'typing' | 'flying' | 'done' = 'waiting';
let introToken = 0;
let debug: PropDebugger | null = null;
let screenRain: ScreenRain | null = null;
let campaign: CampaignRules | null = null;
let combat: P0Combat | null = null;
let viewmodel: ViewmodelRig | null = null;
let crosshair: Crosshair | null = null;
const beacons = new Map<string, { el: HTMLDivElement; label: string; z: number }>();
const _beaconWorld = new THREE.Vector3();
const _beaconCam = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();

const keys = new Set<string>();
const objectiveState = new Map<string, boolean>();
let lastFrameMs = performance.now();

const setLoading = (text: string) => (loadingText.textContent = text);

function updateObjective() {
  const active = level.objectives.find((obj) => !objectiveState.get(obj.id));
  if (!active) {
    objectiveText.textContent = '抵达公路桥接应点';
    return;
  }
  objectiveText.textContent = active.label;
}

/* Objective beacons are pure screen-space projections. They live on the HUD,
   ignore depth, have no collision, and can never be hidden by terrain/props. */
function updateBeaconProjections() {
  for (const [id, beacon] of beacons) {
    if (objectiveState.get(id) || hud.hidden) {
      beacon.el.style.display = 'none';
      continue;
    }
    const worldY = level.groundY(0, beacon.z) + 2.7;
    _beaconWorld.set(0, worldY, beacon.z);
    _beaconCam.copy(_beaconWorld).applyMatrix4(player.camera.matrixWorldInverse);
    if (_beaconCam.z > -0.3) {
      beacon.el.style.display = 'none';
      continue;
    }
    const projected = _beaconWorld.clone().project(player.camera);
    const sx = (projected.x * 0.5 + 0.5) * innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * innerHeight;
    beacon.el.style.display = 'block';
    beacon.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    const fade = THREE.MathUtils.clamp(1.35 - -_beaconCam.z / 95, 0.35, 1);
    beacon.el.style.opacity = fade.toFixed(2);
  }
}

function markObjective(id: string) {
  if (objectiveState.get(id)) return;
  objectiveState.set(id, true);
  level.setObjectivePassed(id);
  const obj = level.objectives.find((o) => o.id === id);
  if (obj) objectiveText.textContent = obj.doneLabel;
  updateObjective();
}

function startControls() {
  controlsEnabled = true;
  hint.classList.add('on');
}

function stopControls() {
  controlsEnabled = false;
  hint.classList.remove('on');
}

function finishIntro() {
  introState = 'done';
  introToken++;
  introOverlay.hidden = true;
  introOverlay.classList.remove('typing', 'fading', 'flying');
  cutscene = null;
  cutsceneBars.hidden = true;
  hud.hidden = false;
  updateObjective();
  player.resetPose(level);
  startControls();
}

function startIntroFlight() {
  if (introState === 'done') return;
  introState = 'flying';
  introOverlay.classList.remove('typing');
  introOverlay.classList.add('flying', 'fading');
  cutscene = new Sequencer(makeIntroCutscene());
  cutscene.onFinished = () => {
    finishIntro();
  };
  setTimeout(() => {
    if (introState === 'flying') introOverlay.hidden = true;
  }, 1400);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function startTyping() {
  if (introState !== 'waiting') return;
  introState = 'typing';
  introOverlay.classList.add('typing');
  const token = ++introToken;
  const finished = await typeMissionBriefing(introTyped, () => token !== introToken);
  if (!finished || token !== introToken) return;
  SFX.revealHit();
  await wait(750);
  if (token !== introToken) return;
  startIntroFlight();
}

function skipIntro() {
  introToken++;
  if (introState === 'waiting' || introState === 'typing') {
    finishIntro();
    return;
  }
  if (introState === 'flying') {
    finishIntro();
  }
}

function playOutro() {
  stopControls();
  cutscene = new Sequencer(makeOutroCutscene());
  cutsceneBars.hidden = false;
  cutscene.onFinished = () => {
    cutscene = null;
    cutsceneBars.hidden = true;
    completed = true;
    completePanel.hidden = false;
  };
}

function handleKeys() {
  player.input.forward = keys.has('KeyW') || keys.has('ArrowUp');
  player.input.back = keys.has('KeyS') || keys.has('ArrowDown');
  player.input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  player.input.right = keys.has('KeyD') || keys.has('ArrowRight');
  player.input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.input.crouch = keys.has('AltLeft') || keys.has('AltRight');
}

async function boot() {
  try {
    loadingSub.textContent = '战役「鹰落」 · 9 步目标 · 30 名敌军 · 即时演算 CG';
    setLoading('正在启动 WebGPU 渲染器…');
    renderer = await createRenderer(canvas);
    screenRain = new ScreenRain(document.getElementById('screenRain') as HTMLCanvasElement);

    setLoading('正在生成全新灰盒线性地图：黑森林河谷…');
    level = buildP0Level(scene);
    player = new FirstPersonPlayer(level);
    await wait(0);

    setLoading('正在生成关卡道具（纯程序化几何）…');
    const crate = buildSupplyCrate();
    crate.scale.setScalar(0.8);
    crate.userData.debugId = 'crate:0';
    crate.userData.debugKind = 'crate';
    scene.add(crate);
    const crateSnap = () =>
      snapObjectToTerrain(crate, 4.7, 36, {
        points: gridFootprint(4.7, 36, 0.52, 0.32, 5),
        sink: 0.05,
        groundAt: (px, pz) => level.groundY(px, pz),
        mode: 'center',
      });
    crateSnap();
    level.registerPropSnap(crateSnap);
    for (const dx of [-0.4, 0, 0.4]) level.addObstacle(4.7 + dx, 36, 0.32);

    const clone = crate.clone(true);
    clone.scale.setScalar(0.65);
    clone.userData.debugId = 'crate:1';
    clone.userData.debugKind = 'crate';
    scene.add(clone);
    const cloneSnap = () =>
      snapObjectToTerrain(clone, -4.5, -62, {
        points: gridFootprint(-4.5, -62, 0.42, 0.26, 5),
        sink: 0.05,
        groundAt: (px, pz) => level.groundY(px, pz),
        mode: 'center',
      });
    cloneSnap();
    level.registerPropSnap(cloneSnap);
    for (const dx of [-0.32, 0, 0.32]) level.addObstacle(-4.5 + dx, -62, 0.26);
    await wait(0);

    /* Build the debugger AFTER the crates exist so raycast selection can see them. */
    setLoading('正在装配战役规则与战术系统…');
    debug = new PropDebugger(level, scene, player.camera);
    campaign = new CampaignRules();
    combat = new P0Combat(scene, level, campaign, player);
    viewmodel = new ViewmodelRig(campaign);
    crosshair = new Crosshair(crossCanvas);
    crosshair.setHidden(true);
    await wait(0);
    (window as unknown as { __P0_DEBUG?: unknown }).__P0_DEBUG = {
      level,
      scene,
      player,
      snapObjectToTerrain,
      THREE,
      debug,
      predictGroundDelta,
      campaign,
      combat,
      viewmodel,
      crosshair,
    };

    for (const obj of level.objectives) {
      const el = document.createElement('div');
      el.className = 'objectiveBeacon';
      el.innerHTML =
        '<div class="beaconStem"></div><div class="beaconMark"></div><div class="beaconLabel"></div>';
      (el.querySelector('.beaconLabel') as HTMLDivElement).textContent = obj.label;
      beaconLayer.appendChild(el);
      beacons.set(obj.id, { el, label: obj.label, z: obj.z });
    }

    const assetStatus = document.getElementById('assetStatus');
    if (assetStatus) assetStatus.textContent = '资产流：纯程序化几何 · 音频：程序化雨/风/雷/脚步';

    setLoading('初始化完成，准备进入任务简报');
    loadingSub.textContent = '单击进入任务简报 · ESC 可跳过开场';

    loading.hidden = true;
    hud.hidden = true;
    introOverlay.hidden = false;
    introState = 'waiting';
    introOverlay.classList.remove('typing', 'fading', 'flying');
    await wait(0);

    /* Soldier construction is the heaviest remaining work; let the loading
       screen disappear first, then deploy before the player reaches controls. */
    setTimeout(() => combat?.ensureEnemiesSpawned(), 0);

    renderer.setAnimationLoop((timeMs) => {
      const dt = Math.min(Math.max((timeMs - lastFrameMs) / 1000, 0), 0.05);
      lastFrameMs = timeMs;
      const time = timeMs / 1000;

      if (cutscene) {
        cutscene.update(dt, player.camera);
      } else if (controlsEnabled && !completed) {
        handleKeys();
        player.aimEase = campaign?.adsEase ?? 0;
        const aimFov = campaign?.activeWeapon?.def.adsFov ?? 75;
        const zoomRatio = Math.tan((aimFov * Math.PI) / 360) / Math.tan((75 * Math.PI) / 360);
        player.setLookScale(
          THREE.MathUtils.lerp(1, THREE.MathUtils.clamp(zoomRatio, 0.18, 1), player.aimEase)
        );
        player.adsFov = aimFov;
        player.scoped = campaign?.activeWeapon?.def.id === 'sr7' && (campaign?.adsEase ?? 0) > 0.55;
        player.canSprint = !campaign?.ads && !campaign?.reloading;
        player.reloadMoveScale = campaign?.reloading ? 0.86 : 1;
        player.update(dt, level);
        campaign?.update(dt, player.spreadRecoveryMultiplier);
        stanceText.textContent = player.prone ? '卧倒' : player.crouch ? '蹲伏' : '站立';
        stanceText.classList.toggle('prone', player.prone);

        if (
          firing &&
          combat?.shoot(player.camera, viewmodel?.getMuzzleWorld(_muzzleWorld) || undefined)
        ) {
          viewmodel?.punch();
          crosshair?.onFire();
        }

        /* objective progression along the linear corridor */
        for (const obj of level.objectives) {
          if (!objectiveState.get(obj.id) && player.position.z <= obj.trigger) {
            markObjective(obj.id);
          }
        }
        if (!reachedExit && player.position.z <= -84) {
          reachedExit = true;
          playOutro();
        }
        combat?.update(dt, player.position, player.camera);
      }

      level.updateRain(time, dt, player.camera.position);
      const wind = windAt(time);
      screenRain?.update(dt, wind);
      screenRain?.draw();
      const lightning = level.updateLightning(time, dt);
      if (lightning && !lightningOn) SFX.thunder(1.35);
      lightningOn = lightning;
      SFX.update(dt);
      if (crosshair && controlsEnabled && introState === 'done' && !completed) {
        const w = campaign?.activeWeapon;
        if (w) {
          const stanceSpread = player.prone
            ? Math.max(0.28, w.def.crouchMult * 0.55)
            : player.crouch
              ? w.def.crouchMult
              : 1;
          crosshair.update(dt, {
            baseSpread: w.def.spreadBase,
            moveSpread: w.def.moveSpread,
            speed: player.horizontalSpeed,
            airSpread: player.grounded ? 0 : w.def.airSpread,
            stanceSpread,
            adsEase: campaign?.adsEase ?? 0,
            reloading: campaign?.reloading ?? false,
            spread: w.spread,
          });
        }
      }
      const scoped =
        controlsEnabled &&
        !completed &&
        campaign?.activeWeapon?.def.id === 'sr7' &&
        campaign.adsEase > 0.55;
      crosshair?.setHidden(!pointerLocked || !controlsEnabled || !!debug?.active || scoped);
      renderer.render(scene, player.camera);
      if (viewmodel) {
        viewmodel.root.visible =
          controlsEnabled && !completed && !cutscene && introState === 'done' && !scoped;
        if (viewmodel.root.visible) viewmodel.update(dt, player);
        if (viewmodel.root.visible) {
          renderer.instance.autoClear = false;
          renderer.instance.clearDepth();
          renderer.render(viewmodel.scene, viewmodel.camera);
          renderer.instance.autoClear = true;
        }
      }
      updateBeaconProjections();
    });
  } catch (error) {
    console.error(error);
    setLoading(`P0 启动失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

/* --- pointer lock & input --- */
canvas.addEventListener('click', (event) => {
  SFX.init();
  if (debug?.active) {
    debug.trySelect(event.clientX, event.clientY);
    return;
  }
  if (cutscene || completed || introState !== 'done') return;
  canvas.requestPointerLock();
});

introOverlay.addEventListener('click', () => {
  SFX.init();
  if (introState === 'waiting') void startTyping();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  crosshair?.setHidden(!pointerLocked || !controlsEnabled || !!debug?.active);
  if (pointerLocked) {
    hint.classList.remove('on');
  } else if (controlsEnabled && !cutscene && !completed && !debug?.active) {
    hint.classList.add('on');
  }
});

document.addEventListener('mousemove', (event) => {
  if (debug?.active) return;
  if (!cutscene && document.pointerLockElement === canvas && !completed) {
    player?.addYaw(event.movementX * 0.0022);
    player?.addPitch(event.movementY * 0.0022);
  }
});

document.addEventListener('mousedown', (event) => {
  if (event.button === 2 && controlsEnabled && !debug?.active && !cutscene && !completed) {
    event.preventDefault();
    campaign?.toggleAim();
    return;
  }
  if (event.button !== 0) return;
  if (debug?.active || cutscene || completed || !controlsEnabled) return;
  if (document.pointerLockElement !== canvas) return;
  firing = true;
  if (campaign) campaign.triggerReleased = true;
  if (combat?.shoot(player.camera, viewmodel?.getMuzzleWorld(_muzzleWorld) || undefined)) {
    viewmodel?.punch();
    crosshair?.onFire();
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    firing = false;
    if (campaign) campaign.triggerReleased = true;
  }
});

addEventListener(
  'wheel',
  (event) => {
    if (!debug?.active || !debug.selected) return;
    event.preventDefault();
    debug.nudge(event.deltaY > 0 ? -0.05 : 0.05);
  },
  { passive: false }
);

addEventListener('contextmenu', (event) => {
  if (debug?.active) {
    event.preventDefault();
    debug.clearSelection();
    return;
  }
  if (controlsEnabled && !cutscene && !completed) event.preventDefault();
});

addEventListener('keydown', (event) => {
  SFX.init();
  keys.add(event.code);
  if (
    (event.code === 'ShiftLeft' || event.code === 'ShiftRight') &&
    keys.has('KeyW') &&
    introState === 'done' &&
    controlsEnabled &&
    !cutscene
  ) {
    campaign?.cancelReload();
  }
  if (event.code === 'Space') player.input.jump = true;
  if (
    event.code === 'KeyZ' &&
    introState === 'done' &&
    controlsEnabled &&
    !cutscene &&
    !event.repeat
  ) {
    player.proneRequested = true;
  }
  if (event.code === 'F2' && introState === 'done') {
    event.preventDefault();
    debug?.toggle();
  }
  if (event.code === 'PageUp' && debug?.active) {
    event.preventDefault();
    debug.nudge(0.05);
  }
  if (event.code === 'PageDown' && debug?.active) {
    event.preventDefault();
    debug.nudge(-0.05);
  }
  if (event.code === 'KeyL' && debug?.active) {
    event.preventDefault();
    debug.writeLog();
  }
  if (event.code === 'KeyG' && level && introState === 'done') {
    if (debug?.active) {
      const count = level.resnapProps();
      const fixed = debug.autoFix();
      const assetStatus = document.getElementById('assetStatus');
      if (assetStatus)
        assetStatus.textContent = `一键贴地完成 · 重采样 ${count} 组 · 自动修正 ${fixed} 处`;
    } else if (!event.repeat && controlsEnabled && !cutscene && combat) {
      combat.throwGrenade('lethal', player.camera);
    }
  }
  if (
    event.code === 'KeyQ' &&
    introState === 'done' &&
    !event.repeat &&
    controlsEnabled &&
    !cutscene &&
    !debug?.active
  ) {
    combat?.throwGrenade('tactical', player.camera);
  }
  if (
    event.code === 'KeyF' &&
    introState === 'done' &&
    !event.repeat &&
    controlsEnabled &&
    !cutscene &&
    !debug?.active
  ) {
    combat?.tryInteractWeapon(player.position);
  }
  if (event.code === 'KeyR' && introState === 'done' && !event.repeat && controlsEnabled) {
    campaign?.startReload();
  }
  if (event.code === 'KeyB' && introState === 'done' && !event.repeat && controlsEnabled) {
    const w = campaign?.activeWeapon;
    if (w?.def.semiToggle) {
      w.semi = !w.semi;
      SFX.boltClick();
      campaign?.updateHud();
    }
  }
  if ((event.code === 'Digit1' || event.code === 'Digit2') && introState === 'done') {
    campaign?.switchSlot(event.code === 'Digit1' ? 0 : 1);
  }
  if (event.code === 'Escape') {
    firing = false;
    if (introState !== 'done') {
      skipIntro();
      return;
    }
    if (cutscene) {
      const done = cutscene.finished;
      cutscene.skip();
      if (!done) {
        /* skip() marks it finished synchronously on next update; force cleanup */
        cutscene = null;
        cutsceneBars.hidden = true;
        if (completed) completePanel.hidden = false;
        else {
          player.resetPose(level);
          startControls();
        }
      }
    }
  }
});

addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'Space') player.input.jump = false;
});

addEventListener('blur', () => {
  keys.clear();
  player.input.jump = false;
  firing = false;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    player.input.jump = false;
    firing = false;
  }
});

addEventListener('resize', () => {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  player?.resize();
  screenRain?.resize();
  viewmodel?.resize();
  crosshair?.layout();
});

document.getElementById('restartBtn')?.addEventListener('click', () => location.reload());

void boot();
