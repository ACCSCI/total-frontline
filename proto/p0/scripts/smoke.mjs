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

console.log(JSON.stringify({ state, fps, errors }, null, 2));
await browser.close();

if (errors.length || !state.badge || !state.asset.includes('程序化')) process.exitCode = 1;
