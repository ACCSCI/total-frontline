import * as THREE from 'three';
import { adsHidesCrosshair, scopeBlend, showBreathHint } from '../../shared/gameplay';
import { CampaignRules } from './campaign';
import { P0Combat } from './combat';
import { Crosshair } from './crosshair';
import { PropDebugger } from './debug-mode';
import { spawnExplosion, updateCombatFx } from './fx';
import { gridFootprint } from './grid';
import { predictGroundDelta } from './ground-model';
import { bindCampaignInput } from './input';
import { typeMissionBriefing } from './intro-typing';
import { buildP0Level, buildSupplyCrate, type P0Level } from './level';
import { closePause, openPause } from './pause-menu';
import { FirstPersonPlayer } from './player';
import { createRenderer, type GameRenderer } from './renderer';
import { ScreenRain } from './screen-rain';
import { createOutroAnimation } from './outro-animation';
import { makeIntroCutscene, makeOutroCutscene, Sequencer } from './sequencer';
import { warmupZoneShaders } from './shader-warmup';
import { SETTINGS } from './settings';
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
const pauseEl = document.getElementById('pause') as HTMLDivElement;

const scene = new THREE.Scene();
let renderer: GameRenderer;
let level: P0Level;
let player: FirstPersonPlayer;
let cutscene: Sequencer | null = null;
let controlsEnabled = false;
let completed = false;
let firing = false;
let paused = false;
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
  const pp = player.position;
  for (const [id, beacon] of beacons) {
    if (objectiveState.get(id) || hud.hidden) {
      beacon.el.style.display = 'none';
      continue;
    }
    if (Math.hypot(pp.x, pp.z - beacon.z) < 2.8) {
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
  SFX.setMusic(true);
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
  document.getElementById('studioCredit')?.classList.remove('in');
  cutscene = null;
  cutsceneBars.hidden = true;
  hud.hidden = false;
  const fog = scene.fog as THREE.FogExp2 | null;
  if (fog) {
    fog.color.setHex(0x0b141f);
    fog.density = 0.0105;
  } else {
    scene.fog = new THREE.FogExp2(0x0b141f, 0.0105);
  }
  player.camera.far = 520;
  player.camera.updateProjectionMatrix();
  level.setCinematicLighting(false);
  updateObjective();
  player.resetPose(level);
  startControls();
}

function startIntroFlight() {
  if (introState === 'done') return;
  introState = 'flying';
  introOverlay.classList.remove('typing');
  introOverlay.classList.add('flying', 'fading');
  level.setCinematicLighting(true);
  const fog = scene.fog as THREE.FogExp2 | null;
  if (fog) {
    fog.color.setHex(0x0b141f);
    fog.density = 0.0072;
  } else {
    scene.fog = new THREE.FogExp2(0x0b141f, 0.0072);
  }
  player.camera.far = 850;
  player.camera.updateProjectionMatrix();
  const introDef = makeIntroCutscene();
  introDef.events.push({
    at: 0.3,
    callback: () => level.setCinematicLighting(false),
  });
  cutscene = new Sequencer(introDef);
  cutscene.onFinished = () => {
    finishIntro();
  };
  const credit = document.getElementById('studioCredit');
  window.setTimeout(() => credit?.classList.add('in'), 600);
  window.setTimeout(() => credit?.classList.remove('in'), 4600);
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
  hidePause();
  const pickupPrompt = document.getElementById('p0PickupPrompt') as HTMLDivElement | null;
  if (pickupPrompt) {
    pickupPrompt.textContent = '';
    pickupPrompt.hidden = true;
  }
  const pickupToast = document.getElementById('p0Toast') as HTMLDivElement | null;
  if (pickupToast) pickupToast.hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
  cutscene = new Sequencer(makeOutroCutscene());
  cutsceneBars.hidden = false;
  const exfil = combat?.mission.exfil;
  const exfilStartZ = exfil?.position.z ?? -985;
  cutscene.onUpdate = exfil ? createOutroAnimation(exfil, exfilStartZ, level, combat) : null;
  cutscene.onFinished = () => {
    cutscene = null;
    cutsceneBars.hidden = true;
    completed = true;
    completePanel.hidden = false;
  };
}

function showPause() {
  if (paused || completed || cutscene || introState !== 'done') return;
  if (
    !openPause(pauseEl, true, () => {
      firing = false;
      player?.setAds(false);
      hint.classList.remove('on');
    })
  )
    return;
  paused = true;
}

function hidePause() {
  closePause(pauseEl);
  paused = false;
}

function requestPlayLock() {
  SFX.init();
  SFX.resume();
  canvas.requestPointerLock();
}

function handleKeys() {
  player.input.forward = keys.has('KeyW');
  player.input.back = keys.has('KeyS');
  player.input.left = keys.has('KeyA');
  player.input.right = keys.has('KeyD');
  player.input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.input.jump = keys.has('Space');
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
    combat = new P0Combat(scene, level, campaign, player, () => {
      if (completed) return;
      markObjective('o8');
      markObjective('o9');
      const fade = document.getElementById('cgFade');
      fade?.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => { playOutro(); setTimeout(() => fade?.classList.remove('on'), 900); }));
    });
    viewmodel = new ViewmodelRig(campaign);
    // Pre-warm the viewmodel pass so the first frame after the intro hand-off
    // doesn't compile weapon shaders and hitch.
    viewmodel.root.visible = true;
    viewmodel.update(0, player);
    renderer.instance.autoClear = false;
    renderer.instance.clearDepth();
    renderer.instance.render(viewmodel.scene, viewmodel.camera);
    renderer.instance.autoClear = true;
    viewmodel.root.visible = false;
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
      SFX,
      spawnExplosion,
      renderer,
      playOutro,
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
    if (assetStatus)
      assetStatus.textContent = '资产流：程序化地图 · 音频：与单人共用采样（枪声/换弹/脚步）';

    setLoading('正在预热战区渲染管线…'); warmupZoneShaders(renderer, scene);

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
    setTimeout(() => {
      combat?.ensureEnemiesSpawned();
      const soldierCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.14, 1600);
      soldierCam.position.set(4, 12, 650);
      soldierCam.lookAt(0, 0, 600);
      renderer.instance.render(scene, soldierCam);
      soldierCam.position.set(-4, 12, 330);
      soldierCam.lookAt(0, 0, 280);
      renderer.instance.render(scene, soldierCam);
    }, 0);

    renderer.setAnimationLoop((timeMs) => {
      const dt = Math.min(Math.max((timeMs - lastFrameMs) / 1000, 0), 0.05);
      lastFrameMs = timeMs;
      const time = timeMs / 1000;

      if (cutscene) {
        cutscene.update(dt, player.camera);
      } else if (controlsEnabled && !completed && !paused) {
        handleKeys();
        const gun = campaign?.activeWeapon?.def;
        player.update(
          dt,
          level,
          {
            adsTime: gun?.adsTime || 0.2,
            adsFov: gun?.adsFov || SETTINGS.baseFov,
            scope: !!gun?.scope,
            bracedAim: !!gun?.bracedAim,
          },
          { reloading: !!campaign?.reloading, switching: !!campaign?.switching }
        );
        if (campaign) {
          campaign.ads = player.ads;
          campaign.adsEase = player.adsEase;
          campaign.adsK = player.adsK;
        }
        campaign?.update(dt, player.spreadRecoveryMultiplier);
        campaign?.updateHud();
        stanceText.textContent = player.prone ? '卧倒 · 潜行' : player.crouch ? '蹲伏 · 潜行' : '站立';
        stanceText.classList.toggle('prone', player.prone);

        /* objective progression along the linear corridor */
        for (const obj of level.objectives) {
          const p = player.position;
          if (
            !objectiveState.get(obj.id) &&
            (p.z <= obj.trigger || Math.hypot(p.x, p.z - obj.z) < 3)
          ) {
            markObjective(obj.id);
          }
        }
        combat?.update(dt, player.position, player.camera);
        combat?.damageHud.update(dt, campaign?.playerHealth ?? 100, timeMs);
        updateCombatFx(scene, dt);
      }

      level.updateRain(time, dt, player.camera.position);
      const wind = windAt(time);
      screenRain?.update(dt, wind);
      screenRain?.draw();
      const lightning = level.updateLightning(time, dt);
      if (lightning && !lightningOn) SFX.thunder(1.35);
      lightningOn = lightning;
      SFX.update(dt);
      if (crosshair && controlsEnabled && introState === 'done' && !completed && !paused) {
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
      const adsEase = campaign?.adsEase ?? 0;
      const hasScope = !!campaign?.activeWeapon?.def.scope;
      const scopeK = scopeBlend(adsEase, hasScope);
      const scoped = controlsEnabled && !completed && !paused && scopeK > 0.55;
      const scopeEl = document.getElementById('scope');
      scopeEl?.classList.toggle('on', !!scoped);
      document
        .getElementById('breathTag')
        ?.classList.toggle(
          'on',
          showBreathHint(scopeK, player.breathLock, player.breath, player.holdingBreath)
        );
      const adsHide = adsHidesCrosshair(adsEase, !!campaign?.activeWeapon?.def.bracedAim);
      crosshair?.setHidden(
        !pointerLocked || !controlsEnabled || !!debug?.active || scoped || adsHide || paused
      );
      renderer.render(scene, player.camera);
      if (viewmodel) {
        viewmodel.root.visible =
          controlsEnabled && !completed && !cutscene && introState === 'done' && !scoped && !paused;
        if (viewmodel.root.visible) viewmodel.update(dt, player);
        if (
          controlsEnabled &&
          !completed &&
          !paused &&
          firing &&
          combat?.shoot(player.camera, viewmodel.placeWorldMuzzle(player.camera, _muzzleWorld))
        ) {
          viewmodel.punch();
          crosshair?.onFire();
        }
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

bindCampaignInput({
  canvas,
  pauseEl,
  hint,
  introOverlay,
  cutsceneBars,
  completePanel,
  keys,
  muzzle: _muzzleWorld,
  showPause,
  hidePause,
  requestPlayLock,
  skipIntro,
  startControls,
  startTyping,
  get paused() {
    return paused;
  },
  set paused(value) {
    paused = value;
  },
  get firing() {
    return firing;
  },
  set firing(value) {
    firing = value;
  },
  get pointerLocked() {
    return pointerLocked;
  },
  set pointerLocked(value) {
    pointerLocked = value;
  },
  get controlsEnabled() {
    return controlsEnabled;
  },
  get completed() {
    return completed;
  },
  get introState() {
    return introState;
  },
  get cutscene() {
    return cutscene;
  },
  set cutscene(value) {
    cutscene = value;
  },
  get debug() {
    return debug;
  },
  get player() {
    return player;
  },
  get campaign() {
    return campaign;
  },
  get combat() {
    return combat;
  },
  get viewmodel() {
    return viewmodel;
  },
  get level() {
    return level;
  },
  get renderer() {
    return renderer;
  },
  get screenRain() {
    return screenRain;
  },
  get crosshair() {
    return crosshair;
  },
});

void boot();
