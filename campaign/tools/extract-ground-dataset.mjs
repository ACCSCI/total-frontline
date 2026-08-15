import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const annotationPath = process.argv[2];
if (!annotationPath)
  throw new Error('usage: node tools/extract-ground-dataset.mjs <annotation.json>');

const annotations = JSON.parse(await readFile(annotationPath, 'utf-8'));
const targets = new Map(annotations.adjustments.map((a) => [a.key, a.delta]));
const keys = [...targets.keys()];

const chrome = process.env.P0_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-angle=d3d11', '--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 60000 });
await page.keyboard.down('Escape');
await page.keyboard.up('Escape');
await new Promise((r) => setTimeout(r, 300));

const dataset = await page.evaluate(
  async ({ keys, targets }) => {
    const { debug, level, THREE } = window.__P0_DEBUG;
    level.resnapProps();
    const rows = [];
    const box = new THREE.Box3();

    for (const key of keys) {
      const sel = debug.selectables.find((s) => s.key === key);
      if (!sel?.root) continue;
      const root = sel.root;
      box.setFromObject(root);
      const x = root.position.x;
      const z = root.position.z;
      const ground = level.groundY(x, z);
      const analytic = level.terrainHeight(x, z);
      const halfW = (box.max.x - box.min.x) / 2;
      const halfD = (box.max.z - box.min.z) / 2;
      const footR = Math.max(0.35, halfW, halfD) * 1.35;

      const ring = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ring.push(level.groundY(x + Math.cos(a) * footR, z + Math.sin(a) * footR));
      }
      const ringMin = Math.min(...ring);
      const ringMax = Math.max(...ring);
      const ringMean = ring.reduce((a, b) => a + b, 0) / ring.length;

      rows.push({
        key,
        kind: sel.kind,
        targetDelta: targets[key],
        features: {
          isRock: sel.kind === 'rock' ? 1 : 0,
          isLog: sel.kind === 'log' ? 1 : 0,
          size: Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z),
          halfW,
          halfD,
          height: box.max.y - box.min.y,
          bottomOffset: box.min.y - root.position.y,
          ground,
          rayBias: ground - analytic,
          slope: ringMax - ringMin,
          curv: ground - ringMean,
          ringMean,
          ringMin,
          ringMax,
          currentPenetration: ground - box.min.y,
          castsShadow: root.castShadow ? 1 : 0,
        },
      });
    }
    return rows;
  },
  { keys, targets: Object.fromEntries(targets) }
);

await browser.close();

await mkdir(`${root}data`, { recursive: true });
const out = `${root}data/ground-dataset.json`;
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), rows: dataset, errors }, null, 2)
);
console.log(`wrote ${out} with ${dataset.length} rows`);
if (errors.length) console.log('page errors:', errors);
