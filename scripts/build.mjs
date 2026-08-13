import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/', import.meta.url);
const root = new URL('../', import.meta.url);
const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));

await rm(output, { recursive: true, force: true });
await mkdir(new URL('js/', output), { recursive: true });

execFileSync(process.execPath, [compiler, '--project', 'tsconfig.json'], {
  cwd: fileURLToPath(root),
  stdio: 'inherit',
});

for (const file of ['index.html', 'cover-total-frontline.png']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, output));
}

for (const directory of ['screenshots', 'assets']) {
  await cp(new URL(`../${directory}/`, import.meta.url), new URL(`${directory}/`, output), {
    recursive: true,
  });
}

console.log('Built static game into dist/');
