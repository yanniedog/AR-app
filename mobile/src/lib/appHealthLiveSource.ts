import * as Crypto from 'expo-crypto';
import { strFromU8 } from 'fflate';

import { parseDatesIndex } from '../data/historyDaily';
import { gunzipCooperatively } from '../data/payload';
import { normalizeCoreWithIntegrity } from '../data/sectionIntegrity';
import { parseJsonHeavy, yieldToUi } from './yieldToUi';
import type { CorePayload, DetailsPayload, Manifest, ManifestFile } from '../types';
import type { AppHealthDataSnapshot, AppHealthSourceContract } from './appHealth';
import type { AppHealthTransportGuard } from './appHealthTransportGuard';
import { assertRevisionManifest } from '../data/payloadRevision';

const MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_INFLATED_BYTES = 192 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

export type AppHealthLiveProgress = (stage: string) => void | Promise<void>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function manifestFile(value: unknown, label: string): ManifestFile {
  const file = object(value, label);
  if (
    typeof file.name !== 'string' || !file.name ||
    typeof file.url !== 'string' || !file.url ||
    !Number.isSafeInteger(file.bytes) || Number(file.bytes) <= 0 || Number(file.bytes) > MAX_COMPRESSED_BYTES ||
    typeof file.sha256 !== 'string' || !SHA256.test(file.sha256)
  ) {
    throw new Error(`${label} descriptor is invalid`);
  }
  if (file.enc != null) throw new Error(`${label} is encrypted and cannot be checked as a public live source`);
  return file as unknown as ManifestFile;
}

async function fetchJson(url: string, label: string, signal?: AbortSignal): Promise<unknown> {
  const response = await globalThis.fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchVerifiedAsset<T>(
  file: ManifestFile,
  label: string,
  onProgress?: AppHealthLiveProgress,
  signal?: AbortSignal,
): Promise<T> {
  const response = await globalThis.fetch(file.url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const raw = new Uint8Array(await response.arrayBuffer());
  await onProgress?.(`${label}:downloaded`);
  if (raw.byteLength !== file.bytes) {
    throw new Error(`${label} size mismatch (expected ${file.bytes}, got ${raw.byteLength})`);
  }
  await yieldToUi();
  const digest = toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, raw));
  if (digest !== file.sha256) throw new Error(`${label} sha256 mismatch`);
  await onProgress?.(`${label}:hash-verified`);
  const gzipped = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  const inflated = gzipped
    ? await gunzipCooperatively(raw, 64 * 1024, MAX_INFLATED_BYTES)
    : raw;
  if (inflated.byteLength > MAX_INFLATED_BYTES) throw new Error(`${label} exceeds its decoded size limit`);
  const parsed = await parseJsonHeavy<T>(strFromU8(inflated));
  await onProgress?.(`${label}:decoded`);
  return parsed;
}

/**
 * Read the current public publication without mutating the app cache. Every
 * request still passes through the active app-health transport guard.
 */
export async function readLiveAppHealthSnapshot(options: {
  guard: AppHealthTransportGuard;
  contract: AppHealthSourceContract;
  appVersion: string;
  onProgress?: AppHealthLiveProgress;
  signal?: AbortSignal;
}): Promise<AppHealthDataSnapshot> {
  const { guard, contract, appVersion, onProgress, signal } = options;
  let manifestRaw = await fetchJson(contract.manifestUrl, 'Live manifest', signal);
  await onProgress?.('manifest:fetched');
  const manifestObject = object(manifestRaw, 'Live manifest');
  let files = object(manifestObject.files, 'Live manifest files');
  let coreFile = manifestFile(files.core, 'Core asset');
  let detailsFile = manifestFile(files.details, 'Details asset');
  const declaredUrls = Object.values(files)
    .flatMap((value) => {
      try { return [manifestFile(value, 'Manifest asset').url]; } catch { return []; }
    });
  guard.allowManifestAssets(declaredUrls);

  const datesRaw = await fetchJson(contract.datesIndexUrl, 'Dates index', signal);
  await onProgress?.('dates-index:fetched');
  const dates = parseDatesIndex(datesRaw, contract.repo);
  if (!dates) throw new Error('Dates index payload is invalid');
  if (dates.revision_protocol === 1) {
    const head = dates.revision_heads![dates.latest_date];
    guard.allowManifestAssets([head.manifest_url]);
    const response = await globalThis.fetch(head.manifest_url, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Revision manifest returned HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('Revision manifest exceeds byte limit');
    if (toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)) !== head.manifest_sha256) {
      throw new Error('Selected manifest sha256 mismatch');
    }
    const selected = JSON.parse(strFromU8(bytes)) as Manifest;
    assertRevisionManifest(selected, head, dates.latest_date, contract.repo);
    manifestRaw = selected;
    files = selected.files as unknown as Record<string, unknown>;
    coreFile = manifestFile(files.core, 'Core asset');
    detailsFile = manifestFile(files.details, 'Details asset');
    guard.allowManifestAssets(Object.values(selected.files).map((file) => file.url));
    await onProgress?.('revision:verified');
  }

  const coreRaw = await fetchVerifiedAsset<CorePayload>(coreFile, 'Core asset', onProgress, signal);
  const coreResult = normalizeCoreWithIntegrity(coreRaw, { coreSha256: coreFile.sha256 });
  await onProgress?.('core:normalized');
  const details = await fetchVerifiedAsset<DetailsPayload>(
    detailsFile,
    'Details asset',
    onProgress,
    signal,
  );
  const coreKeys = new Set(
    Object.values(coreResult.core.sections ?? {})
      .flatMap((section) => section.rates)
      .map((row) => row.product_key),
  );
  const detailKeys = Object.keys(details.products ?? {});
  const manifest = manifestRaw as Manifest;
  const optionalAssets = Object.fromEntries(
    contract.optionalAssets.map((key) => [key, {
      state: files[key] ? 'not-requested' as const : 'missing' as const,
      runDate: null,
      itemCount: null,
    }]),
  );

  return {
    source: 'remote',
    manifest,
    core: coreResult.core,
    appVersion,
    datesIndex: { dates: dates.dates, latestRunDate: dates.latest_date },
    details: {
      runDate: details.run_date,
      productCount: detailKeys.length,
      matchedProductCount: detailKeys.filter((key) => coreKeys.has(key)).length,
      orphanProductCount: detailKeys.filter((key) => !coreKeys.has(key)).length,
    },
    assets: {
      ...optionalAssets,
      core: { state: 'ready', runDate: coreResult.core.run_date, itemCount: coreKeys.size },
      details: { state: 'ready', runDate: details.run_date, itemCount: detailKeys.length },
    },
    quarantine: {
      rowsByReason: coreResult.integrity.quarantines.rowsByReason,
      bankHistoryPairs: coreResult.integrity.quarantines.bankHistoryPairs.size,
      countImpacts: coreResult.integrity.quarantines.countImpacts,
    },
  };
}
