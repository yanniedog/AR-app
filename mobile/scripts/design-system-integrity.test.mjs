import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const mobileRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

test('all app-owned icons use the local Rate Ledger SVG registry', () => {
  const offenders = [join(mobileRoot, 'app'), join(mobileRoot, 'src')]
    .flatMap(sourceFiles)
    .filter((path) => readFileSync(path, 'utf8').includes('@expo/vector-icons'));
  assert.deepEqual(offenders, []);

  const pkg = JSON.parse(readFileSync(join(mobileRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies?.['@expo/vector-icons'], undefined);
});
