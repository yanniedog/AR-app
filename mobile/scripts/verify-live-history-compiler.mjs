#!/usr/bin/env node
// Release gate: the app accepts producer-prepared history only from its exact
// pinned compiler. If the Pi still publishes with an older compiler, every
// installed APK silently falls back to the bundled history (charts stop at the
// APK build date). Block the release until the live publication matches.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHA = /^[a-f0-9]{64}$/;
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

/** Name of the live prepared-history asset, or null when none is published. */
export function readyAssetName(manifestBytes) {
  const manifest = JSON.parse(gunzipIfNeeded(manifestBytes, MAX_MANIFEST).toString('utf8'));
  const name = manifest?.bank_rate_history_ready?.file?.name;
  if (name === undefined) return { runDate: manifest?.run_date ?? null, name: null };
  if (typeof name !== 'string' || !/^bank-rate-history-ready-\d{4}-\d{2}-\d{2}-[a-f0-9]{12}\.json\.gz$/.test(name)) {
    throw new Error('Live manifest has an invalid prepared-history asset name');
  }
  return { runDate: manifest.run_date, name };
}

/** Compiler digest recorded inside the live prepared-history asset. */
export function readyCompilerSha(assetBytes) {
  const envelope = JSON.parse(gunzipIfNeeded(assetBytes, MAX_ENVELOPE).toString('utf8'));
  const encoded = envelope?.catalogue?.gzip_base64;
  if (typeof encoded !== 'string' || !encoded.length) throw new Error('Prepared-history envelope has no archive');
  const inner = JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64'), { maxOutputLength: MAX_INNER }).toString('utf8'));
  const sha = inner?.compiler_sha256;
  if (!SHA.test(sha ?? '')) throw new Error('Prepared-history archive has no valid compiler_sha256');
  return sha;
}

export function compareCompiler({ pinned, live, runDate }) {
  if (live === null) return { ok: true, message: `No prepared history published for ${runDate}; nothing to compare.` };
  if (live === pinned) return { ok: true, message: `Live prepared history (${runDate}) matches pinned compiler ${pinned.slice(0, 12)}.` };
  return {
    ok: false,
    message: `Live prepared history (${runDate}) was compiled by ${live.slice(0, 12)}, but this app pins ${pinned.slice(0, 12)}. ` +
      'Installed apps will reject it and fall back to bundled history. Deploy the matching AR-local compiler to the Pi ' +
      '(contracts/history_ready) and let it republish before releasing this APK.',
  };
}

async function fetchBytes(url, limit) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error(`Response exceeds ${limit} bytes: ${url}`);
  return bytes;
}

async function main() {
  const pinned = pinnedCompilerSha(fs.readFileSync(path.join(root, 'contracts/history-ready/compiler-manifest.json'), 'utf8'));
  const origin = appDataOrigin(fs.readFileSync(path.join(root, 'src/lib/automaticDataAccess.ts'), 'utf8'));
  const base = `${origin}/v1/release/app-payload-latest`;
  const { runDate, name } = readyAssetName(await fetchBytes(`${base}/manifest.json`, MAX_MANIFEST));
  const live = name ? readyCompilerSha(await fetchBytes(`${base}/${name}`, MAX_ASSET)) : null;
  const result = compareCompiler({ pinned, live, runDate });
  console[result.ok ? 'log' : 'error'](result.message);
  if (!result.ok) {
    if (process.env.ALLOW_HISTORY_COMPILER_MISMATCH === 'true') console.warn('Mismatch override set; continuing.');
    else process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
