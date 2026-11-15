import * as Crypto from 'expo-crypto';
import { strFromU8 } from 'fflate';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import { backgroundPayloadWork, type BackgroundWorkHandle } from '../lib/backgroundPayloadWork';
import { debugLog } from '../lib/debugLog';
import { resolvePayloadKeyHex } from '../lib/keyVault';
import { decryptAsset, isEncryptedAsset } from '../lib/payloadCrypto';
import { parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
import type { Manifest, ManifestFile } from '../types';
import { cache } from './cache';
import { validateDetachedHistoricalCatalogueEnvelope } from './detachedHistoricalBankRateCatalogueWire';
import { decodeDetachedHistoryBytes, encodeDetachedHistoryBytes } from './detachedHistoricalCatalogueBytes';
import { downloadInflate, gunzipCooperatively } from './payload';
import { payloadBundleIdentity } from './payloadBundleIdentity';

type Consumer = { isCurrent: () => boolean; isAssetCurrent: () => boolean; allowNetwork: boolean };
type DetachedEnvelope = NonNullable<ReturnType<typeof validateDetachedHistoricalCatalogueEnvelope>>;

interface PendingAsset<TResult> {
  work: BackgroundWorkHandle;
  receipt: string;
  consumers: Set<Consumer>;
  superseded: boolean;
  promise: Promise<TResult | null>;
}

export interface DetachedHistoryLoaderConfig<TFile extends ManifestFile, TResult> {
  logScope: string;
  workTitle: 'Detached historical catalogue' | 'Prepared bank history';
  maxCompressedBytes: number;
  maxDecodedBytes: number;
  hasDescriptor: (manifest: Manifest) => boolean;
  resolveDescriptor: (manifest: Manifest) => TFile | null;
  tryFastCacheDecode?: (encoded: string, file: TFile) => Promise<string | null>;
  decodeInner: (params: {
    inner: DetachedEnvelope;
    manifest: Manifest;
    runDate: string;
    file: TFile;
    checkpoint: () => Promise<void>;
    isCurrent: () => boolean;
    stage: (name: string) => void;
    work: BackgroundWorkHandle;
  }) => Promise<TResult | null>;
}

export function createDetachedHistoryLoader<TFile extends ManifestFile, TResult>(
  config: DetachedHistoryLoaderConfig<TFile, TResult>,
) {
  let preparedAsset: { receipt: string; catalogue: TResult } | null = null;
  let pendingAsset: PendingAsset<TResult> | null = null;

  function retireUnusedPendingAsset(): void {
    if (pendingAsset && ![...pendingAsset.consumers].some(caller => caller.isAssetCurrent())) {
      pendingAsset.superseded = true;
      pendingAsset.work.finish('superseded');
      pendingAsset = null;
    }
  }

  async function consume(load: PendingAsset<TResult>, consumer: Consumer): Promise<TResult | null> {
    try {
      const catalogue = await load.promise;
      return !load.superseded && consumer.isCurrent() && consumer.isAssetCurrent() ? catalogue : null;
    } finally {
      load.consumers.delete(consumer);
    }
  }

  async function authentic(bytes: Uint8Array, file: ManifestFile): Promise<boolean> {
    if (bytes.length !== file.bytes || bytes.length > config.maxCompressedBytes) return false;
    const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('') === file.sha256;
  }

  return async function loadDetachedHistory(
    manifest: Manifest,
    options: {
      allowNetwork: boolean;
      isCurrent?: () => boolean;
      isAssetCurrent?: () => boolean;
    },
  ): Promise<TResult | null> {
    const started = Date.now();
    let phase = 'descriptor';
    const stage = (name: string) => {
      phase = name;
      debugLog.debug(config.logScope, `${name} run_date=${manifest.run_date} elapsed_ms=${Date.now() - started}`);
    };
    const file = config.resolveDescriptor(manifest);
    if (!file || file.bytes > config.maxCompressedBytes) {
      retireUnusedPendingAsset();
      if (config.hasDescriptor(manifest)) {
        debugLog.warn(config.logScope, 'Invalid optional history descriptor; using fallback.');
      }
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
      retireUnusedPendingAsset();
      debugLog.warn(config.logScope, 'Invalid optional history revision identity; using fallback.');
      return null;
    }

    const runDate = manifest.run_date;
    const coreSha = manifest.files.core.sha256;
    const revision = JSON.stringify(manifest.payload_revision);
    const receipt = JSON.stringify([runDate, coreSha, file]);
    const sameManifest = () =>
      manifest.run_date === runDate &&
      manifest.files.core.sha256 === coreSha &&
      JSON.stringify(manifest.payload_revision) === revision &&
      JSON.stringify(config.resolveDescriptor(manifest)) === JSON.stringify(file);
    const callerIsCurrent = () => (options.isCurrent?.() ?? true) && sameManifest();
    const assetIsCurrent = () => (options.isAssetCurrent?.() ?? options.isCurrent?.() ?? true) && sameManifest();
    if (!callerIsCurrent() || !assetIsCurrent()) {
      retireUnusedPendingAsset();
      return null;
    }
    if (pendingAsset && pendingAsset.receipt !== receipt) {
      pendingAsset.superseded = true;
      pendingAsset.work.finish('superseded');
      pendingAsset = null;
    }
    if (preparedAsset?.receipt === receipt) {
      stage('prepared cache hit');
      return preparedAsset.catalogue;
    }

    const consumer: Consumer = { isCurrent: callerIsCurrent, isAssetCurrent: assetIsCurrent, allowNetwork: options.allowNetwork };
    if (pendingAsset?.receipt === receipt) {
      pendingAsset.consumers.add(consumer);
      stage('matching preparation joined');
      return consume(pendingAsset, consumer);
    }

    const work = backgroundPayloadWork.begin(config.workTitle, runDate, 'Reading asset cache', () => {
      if (!load.superseded && [...load.consumers].some(caller => caller.isAssetCurrent())) return true;
      load.superseded = true;
      if (pendingAsset === load) pendingAsset = null;
      return false;
    });
    const load: PendingAsset<TResult> = { work, receipt, consumers: new Set([consumer]), superseded: false, promise: Promise.resolve(null) };
    pendingAsset = load;
    const isCurrent = () => !load.superseded && [...load.consumers].some(caller => caller.isAssetCurrent());
    // A superseded caller's mutable manifest must not invalidate a live joiner's
    // identical asset. Its immutable envelope binds only this captured day/core.
    const boundManifest = { ...manifest, files: { ...manifest.files, core: { ...manifest.files.core } } };

    load.promise = Promise.resolve()
      .then(async () => {
        const checkpoint = async () => {
          if (!isCurrent()) throw new Error('Detached history preparation superseded');
          await yieldToUi(0);
          if (!isCurrent()) throw new Error('Detached history preparation superseded');
          work.checkpoint();
        };
        const prepare = async (text: string): Promise<TResult | null> => {
          if (text.length > config.maxDecodedBytes) {
            debugLog.warn(config.logScope, 'Optional history envelope exceeds its byte budget; using fallback.');
            return null;
          }
          await checkpoint();
          work.stage('Parsing and validating history envelope');
          const inner = validateDetachedHistoricalCatalogueEnvelope(await parseJsonHeavy<unknown>(text), boundManifest);
          if (!inner) {
            debugLog.warn(config.logScope, 'Optional history envelope binding is invalid; using fallback.');
            return null;
          }
          return config.decodeInner({ inner, manifest: boundManifest, runDate, file, checkpoint, isCurrent, stage, work });
        };

        try {
          stage('asset cache read');
          const cached = await cache.readDetachedBankRateHistoryAsset(async encoded => {
            await checkpoint();
            work.stage('Decoding and verifying cached asset bytes');
            if (!file.enc && config.tryFastCacheDecode) {
              const text = await config.tryFastCacheDecode(encoded, file);
              if (text !== null) return isCurrent() ? prepare(text) : null;
            }
            const raw = await decodeDetachedHistoryBytes(encoded, checkpoint);
            if (!raw || !(await authentic(raw, file)) || !isCurrent() || isEncryptedAsset(raw) !== !!file.enc) return null;
            const bytes = file.enc ? decryptAsset(raw, await resolvePayloadKeyHex(file.enc.key_id)) : raw;
            if (!isCurrent() || bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null;
            const length = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true);
            if (!length || length > config.maxDecodedBytes) return null;
            await checkpoint();
            work.stage('Inflating cached history asset');
            const inflated = await gunzipCooperatively(bytes, undefined, config.maxDecodedBytes);
            if (inflated.length !== length || !isCurrent()) return null;
            return prepare(strFromU8(inflated));
          });
          if (!isCurrent()) return null;
          if (cached) {
            stage('verified asset cache hit');
            preparedAsset = { receipt, catalogue: cached };
            return cached;
          }
          if (!isCurrent() || isLocalAppHealthAudit() || ![...load.consumers].some(caller => caller.allowNetwork && caller.isAssetCurrent())) {
            stage('offline asset cache miss');
            return null;
          }
          let verified: Uint8Array | null = null;
          work.stage('Downloading, verifying and inflating history asset');
          stage('asset download begin');
          const text = await downloadInflate(file.url, file.sha256, {
            fileName: file.name,
            expectedBytes: file.bytes,
            requireExactBytes: true,
            expectedEncoding: 'gzip',
            allowEncrypted: !!file.enc,
            maxCompressedBytes: config.maxCompressedBytes,
            maxInflatedBytes: config.maxDecodedBytes,
            onVerifiedBytes: bytes => {
              verified = bytes;
            },
          });
          if (!isCurrent()) return null;
          if (!verified || !(await authentic(verified, file)) || isEncryptedAsset(verified) !== !!file.enc) {
            debugLog.warn(config.logScope, 'Optional history asset verification failed; using fallback.');
            return null;
          }
          stage('asset bytes verified');
          const catalogue = await prepare(text);
          if (!catalogue || !isCurrent()) return null;
          work.stage('Encoding verified asset for cache');
          const encoded = await encodeDetachedHistoryBytes(verified, checkpoint);
          if (!isCurrent()) return null;
          work.stage('Saving verified asset cache');
          try {
            await cache.writeDetachedBankRateHistoryAsset(encoded, isCurrent);
          } catch {
            debugLog.warn(config.logScope, 'History is verified; its original asset bytes could not be cached.');
          }
          if (!isCurrent()) return null;
          preparedAsset = { receipt, catalogue };
          return catalogue;
        } catch {
          debugLog.warn(config.logScope, `Optional history unavailable during ${phase}; using fallback. elapsed_ms=${Date.now() - started}`);
          return null;
        }
      })
      .then(
        result => {
          work.finish(!isCurrent() ? 'superseded' : result ? 'completed' : 'fallback');
          return result;
        },
        error => {
          work.finish('failed');
          throw error;
        },
      )
      .finally(() => {
        if (pendingAsset === load) pendingAsset = null;
      });
    return consume(load, consumer);
  };
}
