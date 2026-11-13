import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { appDataOrigin, compareCompiler, compatibleCompilerShas, pinnedCompilerSha, readBounded, readyCompilerSha, readyDescriptor,
  verifyLiveHistoryCompiler } from './verify-live-history-compiler.mjs';

const A = 'a'.repeat(64), B = 'b'.repeat(64), CORE = 'c'.repeat(64), DAY = '2026-11-07';
const gz = (value) => zlib.gzipSync(Buffer.from(JSON.stringify(value)));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const archive = (compiler) => {
  const inner = Buffer.from(JSON.stringify({ compiler_sha256: compiler, run_dates: [] }));
  return { sha256: sha(inner), bytes: inner.length, gzip_base64: zlib.gzipSync(inner).toString('base64') };
};
const asset = (compiler, overrides = {}) => gz({ schema_version: 1, run_date: DAY, core_sha256: CORE,
  catalogue: archive(compiler), ...overrides });
const manifest = (bytes, extra = {}) => gz({ run_date: DAY, files: { core: { sha256: CORE } },
  bank_rate_history_ready: { schema_version: 1, file: { name: `bank-rate-history-ready-${DAY}-${sha(bytes).slice(0, 12)}.json.gz`,
    bytes: bytes.length, sha256: sha(bytes), ...extra } } });

test('reads the pinned compiler and delivery origin from checked-in sources', () => {
  assert.match(pinnedCompilerSha(fs.readFileSync(new URL('../contracts/history-ready/compiler-manifest.json', import.meta.url), 'utf8')), /^[a-f0-9]{64}$/);
  assert.match(appDataOrigin(fs.readFileSync(new URL('../src/lib/automaticDataAccess.ts', import.meta.url), 'utf8')), /^https:\/\//);
});

test('a missing, encrypted or malformed prepared-history descriptor blocks the release', () => {
  assert.throws(() => readyDescriptor(gz({ run_date: DAY, files: { core: { sha256: CORE } } })), /no prepared history/);
  const bytes = asset(A);
  assert.throws(() => readyDescriptor(manifest(bytes, { enc: { alg: 'aes-256-gcm', key_id: 'abcd1234' } })), /inner-encrypted/);
  assert.throws(() => readyDescriptor(manifest(bytes, { name: '../x' })), /invalid/);
  assert.equal(readyDescriptor(manifest(bytes)).sha256, sha(bytes));
});

test('asset bytes and envelope must bind to the live manifest before the compiler is read', () => {
  const bytes = asset(A);
  const descriptor = readyDescriptor(manifest(bytes));
  assert.equal(readyCompilerSha(bytes, descriptor), A);
  assert.throws(() => readyCompilerSha(asset(B), descriptor), /do not match/);
  const unbound = asset(A, { core_sha256: B });
  assert.throws(() => readyCompilerSha(unbound, readyDescriptor(manifest(unbound))), /not bound/);
  for (const corrupt of [{ ...archive(A), sha256: B }, { ...archive(A), bytes: 5 }]) {
    const bytes = asset(A, { catalogue: corrupt });
    assert.throws(() => readyCompilerSha(bytes, readyDescriptor(manifest(bytes))), /declared size and digest/);
  }
});

test('fails only when the live compiler differs from the pin', async () => {
  assert.equal(compareCompiler({ pinned: A, live: A, runDate: 'd' }).ok, true);
  const mismatch = compareCompiler({ pinned: A, live: B, runDate: 'd' });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /bbbbbbbbbbbb.*aaaaaaaaaaaa/);
  const bytes = asset(B);
  const get = async (url) => url.endsWith('/manifest.json') ? manifest(bytes) : bytes;
  assert.equal((await verifyLiveHistoryCompiler({ pinned: A, origin: 'https://x.test', get })).ok, false);
  assert.equal((await verifyLiveHistoryCompiler({ pinned: B, origin: 'https://x.test', get })).ok, true);
});

test('bounded reads stop at the byte ceiling', async () => {
  assert.equal((await readBounded(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), 8)).length, 8);
  await assert.rejects(readBounded(Readable.from([Buffer.alloc(6), Buffer.alloc(6)]), 8), /exceeds 8 bytes/);
});

test('listed compatible compilers pass; unlisted ones still fail', () => {
  assert.equal(compareCompiler({ pinned: A, compatible: [B], live: B, runDate: 'd' }).ok, true);
  assert.equal(compareCompiler({ pinned: A, compatible: [B], live: 'c'.repeat(64), runDate: 'd' }).ok, false);
  const listed = compatibleCompilerShas(fs.readFileSync(new URL('../contracts/history-ready/compatible-compilers.json', import.meta.url), 'utf8'));
  assert.ok(listed.every(sha => /^[a-f0-9]{64}$/.test(sha)) && listed.length > 0);
  assert.deepEqual(compatibleCompilerShas(JSON.stringify({ semantic_revision: 'other', compatible: [{ sha256: A }] })), []);
});
