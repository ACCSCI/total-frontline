import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../..', import.meta.url));
const url = process.env.P0_PERF_URL || 'http://127.0.0.1:8126/campaign/';
const chrome = process.env.P0_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const THRESHOLD_AVG = Number(process.env.P0_PERF_AVG || 34);
const THRESHOLD_P95 = Number(process.env.P0_PERF_P95 || 60);
const THRESHOLD_MAX = Number(process.env.P0_PERF_MAX || 400);

if (!existsSync(`${root}/dist/campaign/index.html`)) {
  console.error('dist/campaign not built. Run: npm --prefix campaign run build && npm run build:legacy');
  process.exit(1);
}

const server = spawn('python', ['-m', 'http.server', '8126', '--bind', '127.0.0.1', '--directory', 'dist'], {
  cwd: root,
  stdio: 'ignore',
  shell: process.platform === 'win32',
});
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => document.getElementById('loading')?.hidden, { timeout: 90000 });
await page.keyboard.press('Escape');
await new Promise((resolve) => setTimeout(resolve, 3500));
await page.evaluate(async () => { for (let i = 0; i < 120; i++) await new Promise((r) => requestAnimationFrame(r)); });

async function statsFor(setupCode, triggerCode, frames = 160, triggerAt = 24) {
  await page.evaluate((code) => {
    const d = window.__P0_DEBUG;
    return eval(code);
  }, setupCode);
  await new Promise((resolve) => setTimeout(resolve, 350));
  return page.evaluate(async (code, at, n) => {
    const d = window.__P0_DEBUG;
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = performance.now();
      if (i === at && code) eval(code);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      a.push(performance.now() - t);
    }
    const sorted = [...a].sort((x, y) => x - y);
    return {
      avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1),
      p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
      max: +Math.max(...a).toFixed(1),
      over50: a.filter((x) => x > 50).length,
      over100: a.filter((x) => x > 100).length,
    };
  }, triggerCode, triggerAt, frames);
}

const probes = [
  ['baseline-spawn', `d.player.restorePose(0, 1000, 0, d.level)`, ''],
  ['crash-site-arrival', `d.player.restorePose(0, 330, 0, d.level)`, ''],
  ['valley-reinforcement', `d.player.restorePose(0, -215, 0, d.level)`, ''],
  ['fuel-blast', `d.player.restorePose(0, -228, 0, d.level)`, `d.combat.tryInteractWeapon(d.player.position)`],
  ['bridge-apc', `d.player.restorePose(0, -800, 0, d.level)`, ''],
  ['burst-fire', `d.player.restorePose(0, 1000, 0, d.level)`, `(() => { const m = new d.THREE.Vector3(); for (let i = 0; i < 12; i++) d.combat.shoot(d.player.camera, d.viewmodel.placeWorldMuzzle(d.player.camera, m)); })()`],
  ['exfil-cg-masked', `d.combat.mission.state.vegaRescued = true; d.combat.mission.state.moduleTaken = true; d.player.restorePose(0, -981, 0, d.level)`, `d.combat.tryInteractWeapon(d.player.position)`],
];

const report = [];
let failed = false;
for (const [name, setup, trigger] of probes) {
  const s = await statsFor(setup, trigger);
  const masked = name.includes('masked');
  const maxLimit = masked ? 4000 : THRESHOLD_MAX;
  const okAvg = s.avg <= THRESHOLD_AVG;
  const okP95 = s.p95 <= THRESHOLD_P95;
  const okMax = s.max <= maxLimit;
  const ok = (masked || okAvg) && (masked || okP95) && okMax;
  if (!ok) failed = true;
  report.push({ probe: name, ...s, masked, ok });
  console.log(
    `${ok ? '  ok  ' : '  BAD '} ${name.padEnd(22)} avg=${String(s.avg).padStart(6)}ms p95=${String(s.p95).padStart(6)}ms max=${String(s.max).padStart(7)}ms >50ms:${s.over50} >100ms:${s.over100}${masked ? ' (masked transition)' : ''}`
  );
}

console.log('page errors:', pageErrors.length ? pageErrors.join(' | ') : 'none');
await browser.close();
server.kill();

if (failed) {
  console.error(`\nPERF PROBE FAILED — thresholds avg<=${THRESHOLD_AVG}ms p95<=${THRESHOLD_P95}ms max<=${THRESHOLD_MAX}ms`);
  process.exit(1);
}
console.log('\nPERF PROBE OK');
