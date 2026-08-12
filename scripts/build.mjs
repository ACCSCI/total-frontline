import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ['index.html', 'cover-total-frontline.png']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, output));
}

for (const directory of ['js', 'screenshots']) {
  await cp(new URL(`../${directory}/`, import.meta.url), new URL(`${directory}/`, output), {
    recursive: true,
  });
}

console.log('Built static game into dist/');
