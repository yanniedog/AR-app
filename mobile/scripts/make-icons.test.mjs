import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./make-icons.mjs', import.meta.url));
const asset = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const names = ['icon.png', 'favicon.png', 'adaptive-icon.png', 'splash.png'];
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('Rate Ledger artwork regenerates deterministically with Node only', () => {
  const before = Object.fromEntries(names.map((name) => [name, digest(asset(name))]));
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = Object.fromEntries(names.map((name) => [name, digest(asset(name))]));
  assert.deepEqual(after, before);
});
