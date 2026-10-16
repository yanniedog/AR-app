import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, 'contracts/history-ready/compiler.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'contracts/history-ready/compiler-manifest.json'), 'utf8'));
const compiler = createRequire(import.meta.url)(filename);
const day = '2026-09-13', sha = 'a'.repeat(64);
const fixture = { schema_version: 2, run_dates: [day], sources: { [day]: { kind: 'retained_legacy_export', banks_sha256: sha, bytes: 100 } },
  unavailable_dates: {}, evidence: [{ status: 'unknown' }], sections: { Mortgage: [], TD: [], Savings: [
    { row: { provider: 'Bank', product_key: 'saving', product_name: 'Savings', ribbon_normalized: true }, spans: [[0, 1, [0, 2, 2], 0]] },
  ] } };
test('standalone artifact has the pinned digest and preserves one-day terminal count multiplicity', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), manifest.sha256);
  assert.equal(manifest.sha256, manifest.compiler_sha256);
  const ready = compiler.compile(fixture, manifest.sha256);
  assert.deepEqual(ready.sections.Savings, [['Bank', [null], false, false, 0, [[0, [[0, 1], [2, 2]]], [1, [[0, -1], [2, -2]]]]]]);
  assert.deepEqual(ready.products.Savings, [['saving', [[0, 1, 2]]]]);
  assert.equal(compiler.validateReady(ready, manifest.sha256), true);
});
test('standalone CLI binds compilation and validation to its actual file receipt', () => {
  const compiled = spawnSync(process.execPath, [filename], { input: JSON.stringify(fixture), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
  const ready = JSON.parse(compiled.stdout);
  assert.equal(ready.compiler_sha256, manifest.sha256);
  const validated = spawnSync(process.execPath, [filename, '--validate'], { input: compiled.stdout, encoding: 'utf8' });
  assert.equal(validated.status, 0, validated.stderr);
  assert.deepEqual(JSON.parse(validated.stdout), { valid: true });
  ready.compiler_sha256 = 'f'.repeat(64);
  const rejected = spawnSync(process.execPath, [filename, '--validate'], { input: JSON.stringify(ready), encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
});

test('standalone producer excludes UI modules and runs from an isolated directory without npm', () => {
  for (const source of Object.keys(manifest.source_files)) {
    assert.doesNotMatch(source, /^(?:\.\.(?:\/|$)|[A-Za-z]:|\/)|\\/, source);
    assert.doesNotMatch(source, /^(?:src\/(?:components|content)\/|src\/lib\/(?:uiCopy|productUiFacts)\.ts$|node_modules\/(?:react|react-native)(?:\/|$))/, source);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-history-ready-standalone-'));
  try {
    const isolatedCompiler = path.join(directory, 'compiler.cjs');
    fs.copyFileSync(filename, isolatedCompiler);
    assert.deepEqual(fs.readdirSync(directory), ['compiler.cjs']);
    const options = { cwd: directory, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } };
    const compiled = spawnSync(process.execPath, [isolatedCompiler], { ...options, input: JSON.stringify(fixture) });
    assert.equal(compiled.status, 0, compiled.stderr);
    assert.deepEqual(JSON.parse(compiled.stdout), compiler.compile(fixture, manifest.sha256));
    const validated = spawnSync(process.execPath, [isolatedCompiler, '--validate'], { ...options, input: compiled.stdout });
    assert.equal(validated.status, 0, validated.stderr);
    assert.deepEqual(JSON.parse(validated.stdout), { valid: true });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
