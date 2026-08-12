#!/usr/bin/env bun
/* File-size gate: no tracked source file may exceed 600 lines.
   Keeps the game navigable one-screenful-of-context at a time. */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LIMIT = 600;
const TEXT = /\.(js|mjs|cjs|ts|json|html|css|md|yml|yaml|toml|txt)$/i;
const SKIP = /(^|\/)(bun\.lock|package-lock\.json|LICENSE)$/;

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => f && TEXT.test(f) && !SKIP.test(f));

let failed = false;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n').length;
  if (lines > LIMIT) {
    console.error(`OVER ${LIMIT}: ${f} has ${lines} lines`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`line gate ok — ${files.length} files, all <= ${LIMIT} lines`);
