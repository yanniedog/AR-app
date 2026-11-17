import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { appDataOrigin, compareCompiler, compatibleCompilerShas, pinnedCompilerSha, readBounded, readyCompilerSha, readyDescriptor,
  verifyLiveHistoryCompiler, fetchBytes } from './verify-live-history-compiler.mjs';

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

function transport(fetchImpl) {
  let clock = 0;
  const waits = [], requests = [];
  return { waits, requests, advance: ms => { clock += ms; }, options: {
    now: () => clock,
    sleep: async (ms, signal) => { waits.push(ms); assert.equal(signal.aborted, false); clock += ms; },
    fetchImpl: async (url, options) => { requests.push({ url, ...options }); return fetchImpl(requests.length, options); },
  } };
}

for (const status of [429, 502, 503, 504]) test(`transient HTTP ${status} retries with cache busting and the same strict deadline`, async () => {
  const cancelled = [];
  const state = transport(async attempt => attempt < 3 ? { ok: false, status, body: { cancel: async () => cancelled.push(attempt) } }
    : new Response('verified bytes'));
  assert.equal((await fetchBytes('https://x.test/v1/manifest.json', 1024, state.options)).toString(), 'verified bytes');
  assert.deepEqual(state.waits, [250, 1000]);
  assert.deepEqual(cancelled, [1, 2]);
  assert.equal(state.requests.length, 3);
  assert.equal(new Set(state.requests.map(request => request.signal)).size, 1);
  assert.equal(new Set(state.requests.map(request => new URL(request.url).searchParams.get('_'))).size, 3);
  for (const request of state.requests) {
    assert.equal(new URL(request.url).pathname, '/v1/manifest.json');
    assert.equal(request.redirect, 'error');
    assert.equal(request.cache, 'no-store');
  }
});

test('network failure retries are bounded and a dropped response body is not appended to the next attempt', async () => {
  const failure = Object.assign(new Error('socket closed'), { code: 'ECONNRESET' });
  const state = transport(async attempt => {
    if (attempt === 1) throw new TypeError('fetch failed', { cause: failure });
    if (attempt === 2) return { ok: true, headers: new Headers(), body: (async function* () { yield Buffer.from('partial'); throw failure; })() };
    return new Response('complete');
  });
  assert.equal((await fetchBytes('https://x.test/asset', 1024, state.options)).toString(), 'complete');
  assert.equal(state.requests.length, 3);
  const unavailable = transport(async () => { throw new TypeError('fetch failed', { cause: failure }); });
  await assert.rejects(fetchBytes('https://x.test/asset', 1024, unavailable.options), /fetch failed/);
  assert.equal(unavailable.requests.length, 3);
  assert.deepEqual(unavailable.waits, [250, 1000]);
  const badGateway = transport(async () => new Response('upstream unavailable', { status: 502 }));
  await assert.rejects(fetchBytes('https://x.test/asset', 1024, badGateway.options), /HTTP 502/);
  assert.equal(badGateway.requests.length, 3);
});

test('Worker Retry-After is respected only inside the original request budget', async () => {
  for (const status of [429, 503]) {
    const state = transport(async attempt => attempt === 1
      ? new Response(null, { status, headers: { 'retry-after': '2' } }) : new Response('ready'));
    assert.equal((await fetchBytes('https://x.test/manifest.json', 1024, state.options)).toString(), 'ready');
    assert.deepEqual(state.waits, [2000]);
  }
  const held = transport(async () => new Response(null, { status: 429, headers: { 'retry-after': '60' } }));
  await assert.rejects(fetchBytes('https://x.test/manifest.json', 1024, held.options), /HTTP 429/);
  assert.equal(held.requests.length, 1);
  assert.deepEqual(held.waits, []);
});

test('redirect refusal, TLS failures, other HTTP statuses and oversized responses never retry', async () => {
  const cases = [
    async () => { throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') }); },
    async () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('certificate'), { code: 'CERT_HAS_EXPIRED' }) }); },
    ...[301, 401, 403, 404, 500].map(status => async () => new Response(null, { status })),
    async () => new Response('small', { headers: { 'content-length': '1025' } }),
    async () => new Response(Buffer.alloc(1025)),
  ];
  for (const fetchImpl of cases) {
    const state = transport(fetchImpl);
    await assert.rejects(fetchBytes('https://x.test/asset', 1024, state.options));
    assert.equal(state.requests.length, 1);
    assert.deepEqual(state.waits, []);
  }
});

test('backoff and retries cannot extend the original sixty-second request budget', async () => {
  const state = transport(async () => { state.advance(59_900); return new Response(null, { status: 502 }); });
  await assert.rejects(fetchBytes('https://x.test/asset', 1024, state.options), /HTTP 502/);
  assert.equal(state.requests.length, 1);
  assert.deepEqual(state.waits, []);
  const late = transport(async attempt => {
    late.advance(attempt === 1 ? 59_000 : 1_000);
    return attempt === 1 ? new Response(null, { status: 503 }) : new Response('too late');
  });
  await assert.rejects(fetchBytes('https://x.test/asset', 1024, late.options), /timed out/);
  assert.equal(late.requests.length, 2);
  assert.deepEqual(late.waits, [250]);
});

test('invalid JSON and asset identity mismatches remain immediate release failures', async () => {
  const invalid = transport(async () => new Response('{invalid'));
  await assert.rejects(verifyLiveHistoryCompiler({ pinned: A, origin: 'https://x.test',
    get: (url, limit) => fetchBytes(url, limit, invalid.options) }), SyntaxError);
  assert.equal(invalid.requests.length, 1);
  const bytes = asset(A), wrong = asset(B);
  const corrupt = transport(async attempt => new Response(attempt === 1 ? manifest(bytes) : wrong));
  await assert.rejects(verifyLiveHistoryCompiler({ pinned: A, origin: 'https://x.test',
    get: (url, limit) => fetchBytes(url, limit, corrupt.options) }), /do not match/);
  assert.equal(corrupt.requests.length, 2);
  assert.deepEqual(corrupt.waits, []);
});
