import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = `${root}.smoke`;
await mkdir(outDir, { recursive: true });

const chrome = process.env.P0_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=d3d11',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1280,720',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

const errors = [];
page.on('console', (msg) => {
  if ((msg.type() === 'error' || msg.type() === 'warning') && !msg.text().includes('favicon')) {
    errors.push(`console.${msg.type()}: ${msg.text()}`);
  }
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

const rendererParam = process.env.P0_RENDERER === 'webgl2' ? '?renderer=webgl2' : '';
await page.goto(`http://127.0.0.1:4173/${rendererParam}`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => !document.getElementById('loading') || document.getElementById('loading').hidden, { timeout: 30000 });

/* Skip the real-time intro so the smoke test can observe player mode quickly. */
await page.keyboard.down('Escape');
await page.keyboard.up('Escape');

await new Promise((resolve) => setTimeout(resolve, 6000));

const state = await page.evaluate(() => {
  const badge = document.getElementById('rendererBadge')?.textContent || '';
  const objective = document.getElementById('objectiveText')?.textContent || '';
  const asset = document.getElementById('assetStatus')?.textContent || '';
  const canvas = document.getElementById('scene');
  return {
    badge,
    objective,
    asset,
    width: canvas?.width || 0,
    height: canvas?.height || 0,
    gpu: typeof navigator.gpu !== 'undefined',
  };
});

/* Stage 5 movement acceptance: walk/sprint/crouch/prone use the shared
   movement data and match the single-player speed/height curve. */
const movement = await page.evaluate(() => {
  const d = window.__P0_DEBUG;
  const player = d.player;
  const level = d.level;
  const saved = {
    pos: player.pos.clone(),
    vel: player.vel.clone(),
    height: player.height,
    yaw: player.yaw,
    pitch: player.pitch,
    fov: player.camera.fov,
    onGround: player.onGround,
    jumpHeld: player.jumpHeld,
    proneRequested: player.proneRequested,
    crouch: player.crouch,
    prone: player.prone,
    bobT: player.bobT,
    stepPhase: player.stepPhase,
    input: { ...player.input },
  };

  const reset = () => {
    player.pos.set(0, 0, 82);
    player.vel.set(0, 0, 0);
    player.onGround = true;
    player.jumpHeld = false;
    player.proneRequested = false;
    player.crouch = false;
    player.prone = false;
    player.height = 1.72;
    player.camera.fov = 75;
    player.input.forward = false;
    player.input.back = false;
    player.input.left = false;
    player.input.right = false;
    player.input.sprint = false;
    player.input.jump = false;
    player.input.crouch = false;
    player.update(1 / 60, level);
  };
  const settle = (frames) => {
    for (let i = 0; i < frames; i++) player.update(1 / 60, level);
  };
  const hspeed = () => Math.hypot(player.vel.x, player.vel.z);

  reset();
  player.input.forward = true;
  settle(120);
  const walkSpeed = hspeed();

  reset();
  player.input.forward = true;
  player.input.sprint = true;
  settle(120);
  const sprintSpeed = hspeed();
  const sprintFov = player.camera.fov;

  reset();
  player.input.forward = true;
  player.input.crouch = true;
  settle(90);
  const crouchSpeed = hspeed();
  const crouchHeight = player.height;

  reset();
  player.input.forward = true;
  player.proneRequested = true;
  settle(90);
  const proneSpeed = hspeed();
  const proneHeight = player.height;

  player.input.forward = false;
  player.vel.x = 0;
  player.vel.z = 0;
  player.onGround = true;
  player.vel.y = 0;
  player.pos.y = level.terrainHeight(player.pos.x, player.pos.z) + player.height * 0.5;
  player.jumpHeld = false;
  player.input.jump = true;
  settle(1);
  player.input.jump = false;
  const proneBlocksJump = player.onGround && player.vel.y === 0;

  player.input.forward = true;
  player.input.sprint = true;
  settle(30);
  const proneBlocksSprint = hspeed() <= 1.2;
  player.input.sprint = false;

  player.input.crouch = true;
  settle(60);
  const crouchFromProne = player.crouch && !player.prone;
  player.input.crouch = false;

  player.proneRequested = true;
  settle(1);
  const toggledProne = player.prone;
  player.proneRequested = true;
  settle(1);
  const exitedProne = !player.prone;

  player.pos.copy(saved.pos);
  player.vel.copy(saved.vel);
  player.height = saved.height;
  player.yaw = saved.yaw;
  player.pitch = saved.pitch;
  player.camera.fov = saved.fov;
  player.onGround = saved.onGround;
  player.jumpHeld = saved.jumpHeld;
  player.proneRequested = saved.proneRequested;
  player.crouch = saved.crouch;
  player.prone = saved.prone;
  player.bobT = saved.bobT;
  player.stepPhase = saved.stepPhase;
  Object.assign(player.input, saved.input);

  return {
    walkSpeed,
    sprintSpeed,
    sprintFov,
    crouchSpeed,
    crouchHeight,
    proneSpeed,
    proneHeight,
    proneBlocksJump,
    proneBlocksSprint,
    crouchFromProne,
    toggledProne,
    exitedProne,
  };
});

/* Let the main loop repaint the stance HUD from the restored state. */
const stanceHud = await page.evaluate(async () => {
  const d = window.__P0_DEBUG;
  const player = d.player;
  player.prone = true;
  player.crouch = false;
  await new Promise((resolve) => setTimeout(resolve, 120));
  const el = document.getElementById('p0Stance');
  return {
    text: el?.textContent || '',
    proneClass: el?.classList.contains('prone') || false,
  };
});
await page.evaluate(() => {
  const player = window.__P0_DEBUG.player;
  player.prone = false;
  player.crouch = false;
});

const rules = await page.evaluate(() => {
  const d = window.__P0_DEBUG;
  const campaign = d.campaign;
  const combat = d.combat;
  const player = d.player;
  const before = campaign.slots.map((s) => s?.def.id || null);
  player.position.set(5.5, 0, 36);
  combat.update(0.1, player.position, player.camera);
  const swapped = combat.tryInteractWeapon(player.position);
  const after = campaign.slots.map((s) => s?.def.id || null);
  const throwBefore = [campaign.tacticals, campaign.lethals];
  combat.throwGrenade('tactical', player.camera);
  combat.throwGrenade('lethal', player.camera);
  const throwAfter = [campaign.tacticals, campaign.lethals];
  return {
    slotCount: campaign.slots.length,
    before,
    swapped,
    after,
    throwMax: campaign.maxThrowables,
    throwBefore,
    throwAfter,
    pickups: combat.pickups.length,
    enemies: combat.enemies.length,
    hasViewmodel: !!d.viewmodel,
    hasCrosshair: !!d.crosshair,
    hasKillstreakUi: !!document.getElementById('streakDock'),
  };
});

/* Rough fps probe. */
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 >= 4000) resolve(Math.round((frames * 1000) / (performance.now() - t0)));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
);

await page.screenshot({ path: `${outDir}/p0-smoke.png` });

const failures = [];
if (rules.slotCount !== 2) failures.push('campaign must have exactly two weapon slots');
if (!rules.swapped || rules.after[0] !== 'ks12') failures.push('F weapon swap failed');
if (rules.throwMax !== 3) failures.push('throwable cap is not 3');
if (rules.throwBefore[0] !== 1 || rules.throwBefore[1] !== 1) failures.push('starting throwables are not 1/1');
if (rules.throwAfter[0] !== 0 || rules.throwAfter[1] !== 0) failures.push('Q/G did not consume throwables');
if (rules.pickups < 9) failures.push('mission pickups missing');
if (rules.enemies < 6) failures.push('enemies missing');
if (!rules.hasViewmodel || !rules.hasCrosshair) failures.push('viewmodel/crosshair missing');
if (rules.hasKillstreakUi) failures.push('campaign exposes killstreak UI');
if (movement.walkSpeed < 4.6 || movement.walkSpeed > 5.1) failures.push('walk speed does not match shared movement data');
if (movement.sprintSpeed < 7.5 || movement.sprintSpeed > 8.2) failures.push('sprint speed does not match shared movement data');
if (movement.sprintFov < 80) failures.push('sprint FOV push is missing');
if (movement.crouchSpeed < 2.1 || movement.crouchSpeed > 2.6) failures.push('crouch speed does not match shared movement data');
if (Math.abs(movement.crouchHeight - 1.08) > 0.03) failures.push('crouch height does not reach shared stance height');
if (movement.proneSpeed < 0.95 || movement.proneSpeed > 1.35) failures.push('prone speed does not match shared movement data');
if (Math.abs(movement.proneHeight - 0.58) > 0.03) failures.push('prone height does not reach shared stance height');
if (!movement.proneBlocksJump) failures.push('prone does not block jumping');
if (!movement.proneBlocksSprint) failures.push('prone does not block sprinting');
if (!movement.crouchFromProne) failures.push('crouch input does not rise out of prone');
if (!movement.toggledProne || !movement.exitedProne) failures.push('Z prone toggle failed');
if (stanceHud.text !== '卧倒' || !stanceHud.proneClass) failures.push('stance HUD does not report prone state');

console.log(JSON.stringify({ state, rules, movement, stanceHud, fps, errors, failures }, null, 2));
await browser.close();

if (errors.length || failures.length || !state.badge || !state.asset.includes('程序化')) process.exitCode = 1;
