import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Gunzip, gunzipSync, strFromU8 } from 'fflate';

import { resolvePayloadKeyHex } from '../lib/keyVault';
import { decryptAsset, isEncryptedAsset } from '../lib/payloadCrypto';

import { MANIFEST_URL, SUPPORTED_SCHEMA } from '../config';
import { debugLog } from '../lib/debugLog';
import { logFetchHttpError } from '../lib/degradationLog';
import { versionLt } from '../lib/versionCompare';
import { HEAVY_JSON_BYTES, parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
import type { CorePayload, DetailsPayload, Manifest } from '../types';
import { normalizeBankInsightsPayload } from './bankInsights';
import { normalizeHistoryBanksPayload } from './historyPayload';
import { normalizeRbaCalendar } from './rbaCalendar';
import {
  fileNameFromUrl,
  type PayloadProgressHandler,
  type PayloadProgressPhase,
  type PayloadProgressSnapshot,
} from './downloadProgress';

/** Yield before sync inflate/parse when the payload is large enough to jank the UI. */
const YIELD_BEFORE_HEAVY_BYTES = HEAVY_JSON_BYTES;
const INFLATE_CHUNK_BYTES = 64 * 1024;

/**
 * Decompress a large gzip without monopolising the JS thread for the entire
 * payload. Fflate's async worker API is unavailable in React Native, so feed
 * its streaming inflater bounded compressed chunks and yield between pushes.
 */
export async function gunzipCooperatively(
  bytes: Uint8Array,
  chunkBytes: number = INFLATE_CHUNK_BYTES,
): Promise<Uint8Array> {
  const safeChunkBytes = Math.max(1, Math.floor(chunkBytes));
  const outputs: Uint8Array[] = [];
  let outputBytes = 0;
  const stream = new Gunzip((chunk) => {
    outputs.push(chunk);
    outputBytes += chunk.length;
  });
  for (let offset = 0; offset < bytes.length; offset += safeChunkBytes) {
    const end = Math.min(bytes.length, offset + safeChunkBytes);
    stream.push(bytes.subarray(offset, end), end === bytes.length);
    if (end < bytes.length) await yieldToUi();
  }
  const result = new Uint8Array(outputBytes);
  let writeOffset = 0;
  for (const chunk of outputs) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return result;
}

export interface DownloadOpts {
  fileName?: string;
  expectedBytes?: number;
  onProgress?: PayloadProgressHandler;
}

function emit(
  onProgress: PayloadProgressHandler | undefined,
  snapshot: PayloadProgressSnapshot,
): void {
  onProgress?.(snapshot);
}

/**
 * Download raw bytes with XMLHttpRequest progress events (works on iOS/Android).
 * Falls back to `expectedBytes` when Content-Length is missing.
 */

function manifestFetchUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
}

async function downloadBytes(
  url: string,
  opts: DownloadOpts & { phase?: PayloadProgressPhase } = {},
): Promise<ArrayBuffer> {
  const fileName = opts.fileName ?? fileNameFromUrl(url);
  const phase = opts.phase ?? 'download';
  const startedAt = Date.now();
  emit(opts.onProgress, {
    phase,
    fileName,
    bytesReceived: 0,
    totalBytes: opts.expectedBytes ?? null,
    startedAt,
  });

  return new Promise((resolve, reject) => {
    let lastEmitAt = 0;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 30000;
    xhr.responseType = 'arraybuffer';
    xhr.ontimeout = () => reject(new Error('network timeout'));
    xhr.onprogress = (event) => {
      const now = Date.now();
      const totalBytes = event.lengthComputable
        ? event.total
        : (opts.expectedBytes ?? null);
      const isFinal = totalBytes !== null && event.loaded >= totalBytes;
      if (!isFinal && now - lastEmitAt < 150) {
        return;
      }
      lastEmitAt = now;
      emit(opts.onProgress, {
        phase,
        fileName,
        bytesReceived: event.loaded,
        totalBytes,
        startedAt,
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const buf = xhr.response as ArrayBuffer;
        if (!buf) {
          reject(new Error('empty response'));
          return;
        }
        emit(opts.onProgress, {
          phase,
          fileName,
          bytesReceived: buf.byteLength,
          totalBytes: buf.byteLength,
          startedAt,
        });
        resolve(buf);
        return;
      }
      logFetchHttpError(url, xhr.status, phase);
      reject(new Error(`asset HTTP ${xhr.status}`));
    };
    xhr.onerror = () => {
      debugLog.error('payload', `download failed url=${url}`);
      logFetchHttpError(url, 0, `${phase}:network_error`);
      reject(new Error('network error'));
    };
    xhr.send();
  });
}

/**
 * Fetch and parse the rolling manifest. Throws on network/HTTP errors, and on a
 * payload that needs a newer app build — so an out-of-date client never replaces
 * its compatible offline cache with an incompatible payload.
 */
export async function fetchManifest(
  url: string = MANIFEST_URL,
  onProgress?: PayloadProgressHandler,
): Promise<Manifest> {
  const buf = await downloadBytes(manifestFetchUrl(url), {
    fileName: 'manifest.json',
    onProgress,
    phase: 'manifest',
  });
  // Stay on the manifest phase — never jump to "parse json" at 100% for this
  // tiny catalog while later finalize/download work is still outstanding.
  emit(onProgress, {
    phase: 'manifest',
    fileName: 'manifest.json',
    bytesReceived: buf.byteLength,
    totalBytes: buf.byteLength,
    startedAt: Date.now(),
    phaseComplete: true,
  });
  const text = strFromU8(new Uint8Array(buf));
  const m = await parseJsonHeavy<Manifest>(text);
  if (typeof m.schema_version === 'number' && m.schema_version > SUPPORTED_SCHEMA) {
    throw new Error(`payload schema v${m.schema_version} unsupported (app supports v${SUPPORTED_SCHEMA}); update the app`);
  }
  const appVersion = Application.nativeApplicationVersion;
  if (m.app_min_version && appVersion && versionLt(appVersion, m.app_min_version)) {
    throw new Error(`payload requires app >= ${m.app_min_version} (have ${appVersion}); update the app`);
  }
  debugLog.info('payload', `manifest ok run_date=${m.run_date} schema=${m.schema_version ?? 'n/a'}`);
  return m;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Download a gzipped JSON asset and inflate it to a UTF-8 string (no TextDecoder dep).
 * When `expectedSha` is given, the raw bytes are verified against it before inflating —
 * so a stale asset served during a same-URL clobber can't be cached under a new hash.
 */
export async function downloadInflate(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<string> {
  const fileName = opts.fileName ?? fileNameFromUrl(url);
  const buf = await downloadBytes(url, { ...opts, fileName, phase: 'download' });
  const byteLen = buf.byteLength;

  const verifyStarted = Date.now();
  emit(opts.onProgress, {
    phase: 'verify',
    fileName,
    bytesReceived: byteLen,
    totalBytes: byteLen,
    startedAt: verifyStarted,
    phaseComplete: false,
  });
  if (expectedSha) {
    // expo-crypto on Android bridges Uint8Array → Kotlin ByteArray; raw ArrayBuffer fails.
    await yieldToUi();
    const digest = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      new Uint8Array(buf),
    );
    const actual = toHex(digest);
    if (actual !== expectedSha) {
      throw new Error(`asset sha256 mismatch (expected ${expectedSha.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`);
    }
  }
  emit(opts.onProgress, {
    phase: 'verify',
    fileName,
    bytesReceived: byteLen,
    totalBytes: byteLen,
    startedAt: verifyStarted,
    phaseComplete: true,
  });

  const inflateStarted = Date.now();
  emit(opts.onProgress, {
    phase: 'inflate',
    fileName,
    bytesReceived: byteLen,
    totalBytes: byteLen,
    startedAt: inflateStarted,
    phaseComplete: false,
  });
  // Always yield before inflate/decrypt/gunzip — compressed byteLen can be well
  // under the parse threshold while the expanded JSON is multi-MB on the JS thread.
  await yieldToUi();
  let bytes: Uint8Array = new Uint8Array(buf);
  // Encrypted assets (ARE1 magic) are decrypted to the gzip layer first; the
  // sha256 above was computed over the ciphertext, matching the manifest.
  if (isEncryptedAsset(bytes)) {
    bytes = decryptAsset(bytes, await resolvePayloadKeyHex());
  }
  // GitHub release assets are served raw; the bytes are our gzip. If a proxy
  // already decoded gzip transport, the bytes are plain JSON — handle both.
  const looksGzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!looksGzipped) {
    emit(opts.onProgress, {
      phase: 'inflate',
      fileName,
      bytesReceived: byteLen,
      totalBytes: byteLen,
      startedAt: inflateStarted,
      phaseComplete: true,
    });
    return strFromU8(bytes);
  }
  const inflated = bytes.length >= YIELD_BEFORE_HEAVY_BYTES
    ? await gunzipCooperatively(bytes)
    : gunzipSync(bytes);
  emit(opts.onProgress, {
    phase: 'inflate',
    fileName,
    bytesReceived: byteLen,
    totalBytes: byteLen,
    startedAt: inflateStarted,
    phaseComplete: true,
  });
  return strFromU8(inflated);
}

export interface CoreResult {
  text: string;
  core: CorePayload;
}

export async function downloadCore(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<CoreResult> {
  const fileName = opts.fileName ?? fileNameFromUrl(url);
  const text = await downloadInflate(url, expectedSha, opts);
  const parseStarted = Date.now();
  emit(opts.onProgress, {
    phase: 'parse',
    fileName,
    bytesReceived: 0,
    totalBytes: text.length,
    startedAt: parseStarted,
    phaseComplete: false,
  });
  const core = await parseJsonHeavy<CorePayload>(text);
  // Leave parse incomplete until the caller finishes cache install — otherwise
  // the bar hits 100% while writeBundle is still flushing multi-MB JSON.
  emit(opts.onProgress, {
    phase: 'install',
    fileName,
    bytesReceived: 0,
    totalBytes: text.length,
    startedAt: Date.now(),
    phaseComplete: false,
  });
  return { text, core };
}

export interface DetailsResult {
  text: string;
  details: DetailsPayload;
}

export async function downloadDetails(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<DetailsResult> {
  const fileName = opts.fileName ?? fileNameFromUrl(url);
  const text = await downloadInflate(url, expectedSha, opts);
  const parseStarted = Date.now();
  emit(opts.onProgress, {
    phase: 'parse',
    fileName,
    bytesReceived: 0,
    totalBytes: text.length,
    startedAt: parseStarted,
    phaseComplete: false,
  });
  const details = await parseJsonHeavy<DetailsPayload>(text);
  emit(opts.onProgress, {
    phase: 'parse',
    fileName,
    bytesReceived: text.length,
    totalBytes: text.length,
    startedAt: parseStarted,
    phaseComplete: true,
  });
  return { text, details };
}

export interface SearchIndexResult {
  text: string;
  searchIndex: import('./detailSearch').SearchIndexPayload;
}

export async function downloadSearchIndex(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<SearchIndexResult> {
  const text = await downloadInflate(url, expectedSha, opts);
  const searchIndex = await parseJsonHeavy<SearchIndexResult['searchIndex']>(text);
  return { text, searchIndex };
}

export interface BankInsightsResult {
  text: string;
  bankInsights: import('./bankInsights').BankInsightsPayload;
}

export async function downloadBankInsights(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<BankInsightsResult> {
  const text = await downloadInflate(url, expectedSha, opts);
  const parsed = await parseJsonHeavy<unknown>(text);
  const bankInsights = normalizeBankInsightsPayload(parsed);
  if (!bankInsights) {
    throw new Error('bank_history payload failed validation');
  }
  return { text, bankInsights };
}

export interface HistoryBanksResult {
  text: string;
  historyBanks: import('./historyPayload').HistoryBanksPayload;
}

export async function downloadHistoryBanks(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<HistoryBanksResult> {
  const text = await downloadInflate(url, expectedSha, opts);
  const parsed = await parseJsonHeavy<unknown>(text);
  const historyBanks = normalizeHistoryBanksPayload(parsed);
  if (!historyBanks) {
    throw new Error('history_banks payload failed validation');
  }
  return { text, historyBanks };
}

export interface RbaCalendarResult {
  text: string;
  rbaCalendar: import('./rbaCalendar').RbaCalendar;
}

export async function downloadRbaCalendar(
  url: string,
  expectedSha?: string,
  opts: DownloadOpts = {},
): Promise<RbaCalendarResult> {
  const text = await downloadInflate(url, expectedSha, opts);
  const parsed = await parseJsonHeavy<unknown>(text);
  const rbaCalendar = normalizeRbaCalendar(parsed);
  if (!rbaCalendar) {
    throw new Error('rba_calendar payload failed validation');
  }
  return { text, rbaCalendar };
}
