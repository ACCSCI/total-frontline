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

console.log(JSON.stringify({ state, rules, fps, errors, failures }, null, 2));
await browser.close();

if (errors.length || failures.length || !state.badge || !state.asset.includes('程序化')) process.exitCode = 1;
