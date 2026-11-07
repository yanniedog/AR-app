import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { appDataOrigin, compareCompiler, pinnedCompilerSha, readyAssetName, readyCompilerSha } from './verify-live-history-compiler.mjs';

const A = 'a'.repeat(64), B = 'b'.repeat(64);
const gz = (value) => zlib.gzipSync(Buffer.from(JSON.stringify(value)));
const asset = (compiler) => gz({ schema_version: 1, run_date: '2026-11-07', core_sha256: A,
  catalogue: { sha256: B, bytes: 10, gzip_base64: gz({ compiler_sha256: compiler, run_dates: [] }).toString('base64') } });

test('reads the pinned compiler and delivery origin from checked-in sources', () => {
  assert.match(pinnedCompilerSha(fs.readFileSync(new URL('../contracts/history-ready/compiler-manifest.json', import.meta.url), 'utf8')), /^[a-f0-9]{64}$/);
  assert.match(appDataOrigin(fs.readFileSync(new URL('../src/lib/automaticDataAccess.ts', import.meta.url), 'utf8')), /^https:\/\//);
});

test('extracts the live asset name and its compiler digest', () => {
  const name = `bank-rate-history-ready-2026-11-07-${B.slice(0, 12)}.json.gz`;
  assert.deepEqual(readyAssetName(gz({ run_date: '2026-11-07', bank_rate_history_ready: { schema_version: 1, file: { name } } })),
    { runDate: '2026-11-07', name });
  assert.deepEqual(readyAssetName(gz({ run_date: '2026-11-07' })), { runDate: '2026-11-07', name: null });
  assert.throws(() => readyAssetName(gz({ run_date: '2026-11-07', bank_rate_history_ready: { file: { name: '../x' } } })));
  assert.equal(readyCompilerSha(asset(A)), A);
  assert.throws(() => readyCompilerSha(asset('nope')));
});

test('fails only when the live compiler differs from the pin', () => {
  assert.equal(compareCompiler({ pinned: A, live: A, runDate: 'd' }).ok, true);
  assert.equal(compareCompiler({ pinned: A, live: null, runDate: 'd' }).ok, true);
  const mismatch = compareCompiler({ pinned: A, live: B, runDate: 'd' });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /bbbbbbbbbbbb.*aaaaaaaaaaaa/);
});
