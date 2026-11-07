#!/usr/bin/env node
// Release gate: the app accepts producer-prepared history only from its exact
// pinned compiler. If the Pi still publishes with an older compiler, every
// installed APK silently falls back to the bundled history (charts stop at the
// APK build date). Block the release until the live publication is usable.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHA = /^[a-f0-9]{64}$/;
// Same budgets as the app's ready-history loader.
const MAX_MANIFEST = 1024 * 1024;
const MAX_ASSET = 1024 * 1024;
const MAX_ENVELOPE = 2 * 1024 * 1024;
const MAX_INNER = 4 * 1024 * 1024;

export function pinnedCompilerSha(manifestText) {
  const sha = JSON.parse(manifestText)?.sha256;
  if (!SHA.test(sha ?? '')) throw new Error('Pinned history compiler manifest has no valid sha256');
  return sha;
}

export function appDataOrigin(sourceText) {
  const match = /export const APP_DATA_ORIGIN = '(https:\/\/[A-Za-z0-9.-]+)';/.exec(sourceText);
  if (!match) throw new Error('APP_DATA_ORIGIN not found');
  return match[1];
}

function gunzipIfNeeded(bytes, maxOutputLength) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes, { maxOutputLength }) : bytes;
}

/** Live manifest facts the app binds prepared history to. A missing or
 * incomplete descriptor is a release blocker: the app has no usable history. */
export function readyDescriptor(manifestBytes) {
  const manifest = JSON.parse(gunzipIfNeeded(manifestBytes, MAX_MANIFEST).toString('utf8'));
  const runDate = manifest?.run_date;
  const coreSha = manifest?.files?.core?.sha256;
  const file = manifest?.bank_rate_history_ready?.file;
  if (typeof runDate !== 'string' || !SHA.test(coreSha ?? '')) throw new Error('Live manifest has no run date or core digest');
  if (!file) throw new Error(`Live manifest (${runDate}) publishes no prepared history`);
  if (file.enc !== undefined || /\.enc$/.test(file.name ?? '')) {
    throw new Error(`Live prepared history (${runDate}) is inner-encrypted; this gate cannot verify it`);
  }
  if (!SHA.test(file.sha256 ?? '') || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_ASSET ||
      file.name !== `bank-rate-history-ready-${runDate}-${file.sha256.slice(0, 12)}.json.gz`) {
    throw new Error(`Live prepared history descriptor (${runDate}) is invalid`);
  }
  return { runDate, coreSha, name: file.name, bytes: file.bytes, sha256: file.sha256 };
}

/** Compiler digest inside the live asset, after the app's byte and envelope bindings. */
export function readyCompilerSha(assetBytes, descriptor) {
  if (assetBytes.length !== descriptor.bytes ||
      crypto.createHash('sha256').update(assetBytes).digest('hex') !== descriptor.sha256) {
    throw new Error('Live prepared-history bytes do not match the manifest');
  }
  const envelope = JSON.parse(zlib.gunzipSync(assetBytes, { maxOutputLength: MAX_ENVELOPE }).toString('utf8'));
  const archive = envelope?.catalogue;
  if (envelope?.schema_version !== 1 || envelope.run_date !== descriptor.runDate || envelope.core_sha256 !== descriptor.coreSha ||
      typeof archive?.gzip_base64 !== 'string' || !archive.gzip_base64.length || !SHA.test(archive.sha256 ?? '')) {
    throw new Error('Live prepared-history envelope is not bound to the live manifest');
  }
  const inner = JSON.parse(zlib.gunzipSync(Buffer.from(archive.gzip_base64, 'base64'), { maxOutputLength: MAX_INNER }).toString('utf8'));
  const sha = inner?.compiler_sha256;
  if (!SHA.test(sha ?? '')) throw new Error('Prepared-history archive has no valid compiler_sha256');
  return sha;
}

export function compareCompiler({ pinned, live, runDate }) {
  if (live === pinned) return { ok: true, message: `Live prepared history (${runDate}) matches pinned compiler ${pinned.slice(0, 12)}.` };
  return {
    ok: false,
    message: `Live prepared history (${runDate}) was compiled by ${live.slice(0, 12)}, but this app pins ${pinned.slice(0, 12)}. ` +
      'Installed apps will reject it and fall back to bundled history. Deploy the matching AR-local compiler to the Pi ' +
      '(contracts/history_ready) and let it republish before releasing this APK.',
  };
}

/** Stream with a hard byte ceiling; never buffer an oversized body. */
export async function readBounded(body, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > limit) throw new Error(`Response exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchBytes(url, limit) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) { await response.body?.cancel?.().catch(() => {}); throw new Error(`HTTP ${response.status}: ${url}`); }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) { await response.body.cancel().catch(() => {}); throw new Error(`Response exceeds ${limit} bytes: ${url}`); }
  return readBounded(response.body, limit);
}

export async function verifyLiveHistoryCompiler({ pinned, origin, get = fetchBytes }) {
  const base = `${origin}/v1/release/app-payload-latest`;
  const descriptor = readyDescriptor(await get(`${base}/manifest.json`, MAX_MANIFEST));
  const live = readyCompilerSha(await get(`${base}/${descriptor.name}`, MAX_ASSET), descriptor);
  return compareCompiler({ pinned, live, runDate: descriptor.runDate });
}

async function main() {
  const pinned = pinnedCompilerSha(fs.readFileSync(path.join(root, 'contracts/history-ready/compiler-manifest.json'), 'utf8'));
  const origin = appDataOrigin(fs.readFileSync(path.join(root, 'src/lib/automaticDataAccess.ts'), 'utf8'));
  let result;
  try { result = await verifyLiveHistoryCompiler({ pinned, origin }); }
  catch (error) { result = { ok: false, message: String(error?.message ?? error) }; }
  console[result.ok ? 'log' : 'error'](result.message);
  if (!result.ok) {
    if (process.env.ALLOW_HISTORY_COMPILER_MISMATCH === 'true') console.warn('Prepared-history override set; continuing.');
    else process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
