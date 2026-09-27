import * as Crypto from 'expo-crypto';
import { strFromU8 } from 'fflate';
import type { Manifest, ManifestFile } from '../types';
import { cache } from './cache';
import { downloadInflate, gunzipCooperatively } from './payload';
import { decompressCatalogueAsync } from './historicalBankRateCatalogueCompression';
import { prepareHistoricalBankRateCatalogueAsync } from './historicalBankRateCatalogue';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';
import { DETACHED_HISTORY_MAX_COMPRESSED, DETACHED_HISTORY_MAX_DECODED,
  validateDetachedHistoricalCatalogueDescriptor, validateDetachedHistoricalCatalogueEnvelope } from './detachedHistoricalBankRateCatalogueWire';
import { decodeDetachedHistoryBytes, encodeDetachedHistoryBytes } from './detachedHistoricalCatalogueBytes';
import { parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import { decryptAsset, isEncryptedAsset } from '../lib/payloadCrypto';
import { resolvePayloadKeyHex } from '../lib/keyVault';
import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import { payloadBundleIdentity } from './payloadBundleIdentity';

let preparedAsset: { receipt: string; catalogue: HistoricalBankRateCatalogue } | null = null;
type Consumer = { isCurrent: () => boolean; isAssetCurrent: () => boolean; allowNetwork: boolean };
type PendingAsset = {
  receipt: string;
  consumers: Set<Consumer>;
  superseded: boolean;
  promise: Promise<HistoricalBankRateCatalogue | null>;
};
let pendingAsset: PendingAsset | null = null;

async function consume(load: PendingAsset, consumer: Consumer): Promise<HistoricalBankRateCatalogue | null> {
  try {
    const catalogue = await load.promise;
    return !load.superseded && consumer.isCurrent() && consumer.isAssetCurrent() ? catalogue : null;
  } finally { load.consumers.delete(consumer); }
}

async function authentic(bytes: Uint8Array, file: ManifestFile): Promise<boolean> {
  if (bytes.length !== file.bytes || bytes.length > DETACHED_HISTORY_MAX_COMPRESSED) return false;
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('') === file.sha256;
}

/** Optional lazy asset: the caller owns installation and the bundled fallback. */
export async function loadDetachedHistoricalBankRateCatalogue(manifest: Manifest, options: {
  allowNetwork: boolean;
  isCurrent?: () => boolean;
  /** Keep the same immutable asset alive while a replacement request paints. */
  isAssetCurrent?: () => boolean;
}): Promise<HistoricalBankRateCatalogue | null> {
  const started = Date.now(); let phase = 'descriptor';
  const stage = (name: string) => { phase = name; debugLog.debug('bank-history-detached', `${name} run_date=${manifest.run_date} elapsed_ms=${Date.now() - started}`); };
  const file = validateDetachedHistoricalCatalogueDescriptor(manifest, PAYLOAD_REPO);
  if (!file) {
    if (manifest.bank_rate_history_catalogue !== undefined) debugLog.warn('bank-history-detached', 'Invalid optional history descriptor; using fallback.');
    return null;
  }
  try {
    if (manifest.payload_revision) {
      const bundle = payloadBundleIdentity(manifest);
      if (manifest.payload_revision.bundle_sha256 !== bundle || manifest.payload_revision.generation_id !== `sha256-${bundle}`) {
        throw new Error('Optional history revision identity mismatch');
      }
    }
  } catch {
    debugLog.warn('bank-history-detached', 'Invalid optional history revision identity; using fallback.');
    return null;
  }
  const runDate = manifest.run_date, coreSha = manifest.files.core.sha256;
  const revision = JSON.stringify(manifest.payload_revision);
  const receipt = JSON.stringify([runDate, coreSha, file]);
  const sameManifest = () => manifest.run_date === runDate && manifest.files.core.sha256 === coreSha &&
    JSON.stringify(manifest.payload_revision) === revision &&
    JSON.stringify(validateDetachedHistoricalCatalogueDescriptor(manifest, PAYLOAD_REPO)) === JSON.stringify(file);
  const callerIsCurrent = () => (options.isCurrent?.() ?? true) && sameManifest();
  const assetIsCurrent = () => (options.isAssetCurrent?.() ?? options.isCurrent?.() ?? true) && sameManifest();
  if (!callerIsCurrent() || !assetIsCurrent()) return null;
  if (pendingAsset && pendingAsset.receipt !== receipt) {
    pendingAsset.superseded = true;
    pendingAsset = null;
  }
  if (preparedAsset?.receipt === receipt) { stage('prepared cache hit'); return preparedAsset.catalogue; }
  const consumer: Consumer = { isCurrent: callerIsCurrent, isAssetCurrent: assetIsCurrent, allowNetwork: options.allowNetwork };
  if (pendingAsset?.receipt === receipt) {
    pendingAsset.consumers.add(consumer);
    stage('matching preparation joined');
    return consume(pendingAsset, consumer);
  }
  const load: PendingAsset = { receipt, consumers: new Set([consumer]), superseded: false, promise: Promise.resolve(null) };
  pendingAsset = load;
  const isCurrent = () => !load.superseded && [...load.consumers].some(caller => caller.isAssetCurrent());
  // A superseded caller's mutable manifest must not invalidate a live joiner's
  // identical asset. Its immutable envelope binds only this captured day/core.
  const boundManifest = { ...manifest, files: { ...manifest.files, core: { ...manifest.files.core } } };
  load.promise = Promise.resolve().then(async () => {
    const checkpoint = async () => {
      if (!isCurrent()) throw new Error('Detached history preparation superseded');
      await yieldToUi(0);
      if (!isCurrent()) throw new Error('Detached history preparation superseded');
    };
    const prepare = async (text: string): Promise<HistoricalBankRateCatalogue | null> => {
      if (text.length > DETACHED_HISTORY_MAX_DECODED) {
        debugLog.warn('bank-history-detached', 'Optional history envelope exceeds its byte budget; using fallback.'); return null;
      }
      await checkpoint();
      const inner = validateDetachedHistoricalCatalogueEnvelope(await parseJsonHeavy<unknown>(text), boundManifest);
      if (!inner) { debugLog.warn('bank-history-detached', 'Optional history envelope binding is invalid; using fallback.'); return null; }
      if (!isCurrent()) return null;
      stage('inner decode begin');
      const decoded = await decompressCatalogueAsync(inner, { yieldControl: checkpoint });
      if (!isCurrent()) return null;
      stage('inner decode complete; validation begin');
      const prepared = await prepareHistoricalBankRateCatalogueAsync(decoded, checkpoint);
      const result = isCurrent() && prepared && prepared.catalogue.run_dates.every(day => day <= runDate) ? prepared.catalogue : null;
      if (result) stage('verified catalogue ready');
      else debugLog.warn('bank-history-detached', 'Optional historical catalogue rejected; using fallback.');
      return result;
    };
    try {
      stage('asset cache read');
      const cached = await cache.readDetachedBankRateHistoryAsset(async encoded => {
        await checkpoint();
        const raw = await decodeDetachedHistoryBytes(encoded, checkpoint);
        if (!raw || !await authentic(raw, file) || !isCurrent() || isEncryptedAsset(raw) !== !!file.enc) return null;
        const bytes = file.enc ? decryptAsset(raw, await resolvePayloadKeyHex(file.enc.key_id)) : raw;
        if (!isCurrent() || bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null;
        const length = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true);
        if (!length || length > DETACHED_HISTORY_MAX_DECODED) return null;
        await checkpoint();
        const inflated = await gunzipCooperatively(bytes, undefined, DETACHED_HISTORY_MAX_DECODED);
        if (inflated.length !== length || !isCurrent()) return null;
        return prepare(strFromU8(inflated));
      });
      if (!isCurrent()) return null;
      if (cached) { stage('verified asset cache hit'); preparedAsset = { receipt, catalogue: cached }; return cached; }
      // A local audit may begin while cache validation is yielding.
      if (!isCurrent() || isLocalAppHealthAudit() || ![...load.consumers].some(caller => caller.allowNetwork && caller.isAssetCurrent())) {
        stage('offline asset cache miss'); return null;
      }
      let verified: Uint8Array | null = null;
      stage('asset download begin');
      const text = await downloadInflate(file.url, file.sha256, {
        fileName: file.name, expectedBytes: file.bytes, requireExactBytes: true,
        expectedEncoding: 'gzip', allowEncrypted: !!file.enc,
        maxCompressedBytes: DETACHED_HISTORY_MAX_COMPRESSED, maxInflatedBytes: DETACHED_HISTORY_MAX_DECODED,
        onVerifiedBytes: bytes => { verified = bytes; },
      });
      if (!isCurrent()) return null;
      if (!verified || !await authentic(verified, file) || isEncryptedAsset(verified) !== !!file.enc) {
        debugLog.warn('bank-history-detached', 'Optional history asset verification failed; using fallback.'); return null;
      }
      stage('asset bytes verified');
      const catalogue = await prepare(text);
      if (!catalogue || !isCurrent()) return null;
      const encoded = await encodeDetachedHistoryBytes(verified, checkpoint);
      if (!isCurrent()) return null;
      try { await cache.writeDetachedBankRateHistoryAsset(encoded, isCurrent); }
      catch { debugLog.warn('bank-history-detached', 'History is verified; its original asset bytes could not be cached.'); }
      if (!isCurrent()) return null;
      preparedAsset = { receipt, catalogue };
      return catalogue;
    } catch {
      debugLog.warn('bank-history-detached', `Optional history unavailable during ${phase}; using fallback. elapsed_ms=${Date.now() - started}`);
      return null;
    }
  }).finally(() => { if (pendingAsset === load) pendingAsset = null; });
  return consume(load, consumer);
}
