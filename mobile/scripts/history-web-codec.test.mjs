import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/data/historicalBankRateCatalogueWeb.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const codec = exports.getWebHistoryCodec();
const receipt = bytes => ({ base64: gzipSync(bytes).toString('base64'), length: bytes.length,
  digest: createHash('sha256').update(bytes).digest('hex') });

test('browser streams round-trip Unicode, hash and gzip bytes without the JS inflater', async () => {
  assert.ok(codec);
  const json = JSON.stringify({ text: '日本語 😀 café'.repeat(50_000), rates: [0, 5.2] });
  const encoded = await codec.compressAsync(json);
  assert.equal(encoded.bytes, Buffer.byteLength(json));
  assert.equal(encoded.sha256, createHash('sha256').update(json).digest('hex'));
  assert.equal(await codec.decompressAsync(encoded.gzip_base64, encoded.bytes, encoded.sha256), json);
  const parts = await codec.decompressChunksAsync(encoded.gzip_base64, encoded.bytes, encoded.sha256);
  assert.equal(parts.join(''), json);
  assert.ok(parts.length > 1);
  assert.ok(parts.every(part => part.length > 0 && part.length <= 65_536));
});

test('configured browser codec retains stream verification through the application decode path', async () => {
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/data/historicalBankRateCatalogueCompression.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', 'module', compiled)(module.exports, createRequire(import.meta.url), module);
  let calls = 0;
  const configured = { ...codec, async decompressChunksAsync(...args) {
    calls++;
    return codec.decompressChunksAsync(...args);
  } };
  module.exports.configureHistoricalCatalogueCodec(configured);
  const value = { text: 'x'.repeat(65_535) + '\ud83e\uddea', rate: 5.94 };
  const encoded = await codec.compressAsync(JSON.stringify(value));
  const options = { yieldControl: async () => undefined };
  assert.deepEqual(await module.exports.decompressCatalogueAsync(encoded, options), value);
  assert.equal(calls, 1);
  assert.equal(await module.exports.decompressCatalogueAsync({ ...encoded, sha256: '0'.repeat(64) }, options), null);
  assert.equal(calls, 2);
});

test('browser streams reject corrupt bytes, noncanonical base64, receipts and inflation overrun', async () => {
  const { base64, length, digest } = receipt(Buffer.from('{"value":"test"}'));
  for (const input of [
    [base64, length, '0'.repeat(64)], [base64, length + 1, digest],
    [base64, 128 * 1024 * 1024 + 1, digest], [base64 + '\n', length, digest],
    [base64.slice(0, -4), length, digest], ['!' + base64.slice(1), length, digest],
  ]) await assert.rejects(() => codec.decompressAsync(...input));
  const forged = Buffer.from(receipt(Buffer.from('x'.repeat(500_000))).base64, 'base64');
  forged.writeUInt32LE(8, forged.length - 4);
  await assert.rejects(() => codec.decompressAsync(forged.toString('base64'), 8, digest));
});

test('browser decoder rejects invalid UTF-8 even with a matching hash', async () => {
  const { base64, length, digest } = receipt(Buffer.from([0xc3, 0x28]));
  await assert.rejects(() => codec.decompressAsync(base64, length, digest));
});

test('missing browser capabilities leave the portable decoder available', () => {
  const original = globalThis.DecompressionStream;
  try {
    globalThis.DecompressionStream = undefined;
    assert.equal(exports.getWebHistoryCodec(), null);
  } finally { globalThis.DecompressionStream = original; }
});
