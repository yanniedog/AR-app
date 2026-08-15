import type { CorePayload } from '../types';
import type { AssetDescriptorV3, GenerationHeadV3, ValidatedGenerationV3 } from '../contracts/v3/types';
import {
  V3_ASSET_LIMITS,
  V3_MANIFEST_LIMIT_BYTES,
  V3_POINTER_LIMIT_BYTES,
  adaptCoreV3ToLegacy,
  legacyProductAliasMap,
  type LegacyProductAliasMap,
  validateCorePayloadTextV3,
  validateGenerationManifestTextV3,
  validateGenerationPointerTextV3,
} from '../contracts/v3/validators';
import { bytesToHex } from '../contracts/v3/contractPrimitives';
import { downloadInflate, type DownloadOpts } from './payload';
import type { V3GenerationCache } from './v3GenerationCache';
import { normalizeCoreWithIntegrity, type CoreIntegrityContext } from './sectionIntegrity';
import {
  assetStateForV3Coverage,
  liveAssetStateForProviderCoverage,
  type AssetState,
} from './assetState';

/**
 * Deliberately dormant until AR-local publishes and separately approves a v3
 * bridge pointer. There is no baked v3 URL and production store code cannot
 * enable this constant.
 */
export const V3_PAYLOAD_BRIDGE_ENABLED = false as const;

export type V3TextDownloader = (
  url: string,
  expectedSha: string | undefined,
  opts: DownloadOpts,
) => Promise<string>;

function descriptorOptions(asset: AssetDescriptorV3, onVerifiedBytes: (bytes: Uint8Array) => void): DownloadOpts {
  return {
    fileName: asset.capability,
    expectedBytes: asset.compressed_bytes,
    maxCompressedBytes: V3_ASSET_LIMITS.core.compressed,
    maxInflatedBytes: V3_ASSET_LIMITS.core.inflated,
    expectedInflatedBytes: asset.uncompressed_bytes,
    requireExactBytes: true,
    expectedEncoding: asset.encoding,
    allowEncrypted: false,
    onVerifiedBytes,
  };
}

export async function loadValidatedV3Generation(
  pointerUrl: string,
  opts: {
    head?: 'latest_complete' | 'latest_observation';
    download?: V3TextDownloader;
  } = {},
): Promise<ValidatedGenerationV3> {
  const download = opts.download ?? downloadInflate;
  const pointerText = await download(pointerUrl, undefined, {
    fileName: 'generation-pointer-v3.json',
    maxCompressedBytes: V3_POINTER_LIMIT_BYTES,
    maxInflatedBytes: V3_POINTER_LIMIT_BYTES,
    allowEncrypted: false,
  });
  const pointer = validateGenerationPointerTextV3(pointerText);
  const head: GenerationHeadV3 = pointer[opts.head ?? 'latest_complete'];
  const manifestText = await download(head.manifest_url, head.manifest_sha256, {
    fileName: 'generation-manifest-v3.json',
    maxCompressedBytes: V3_MANIFEST_LIMIT_BYTES,
    maxInflatedBytes: V3_MANIFEST_LIMIT_BYTES,
    allowEncrypted: false,
  });
  const manifest = validateGenerationManifestTextV3(manifestText, head);
  const descriptor = manifest.capabilities.core;
  let coreAssetBytesHex: string | null = null;
  const coreText = await download(descriptor.url, descriptor.sha256, descriptorOptions(
    descriptor,
    (bytes) => { coreAssetBytesHex = bytesToHex(bytes); },
  ));
  if (coreAssetBytesHex === null) {
    throw new Error('v3 downloader did not return authenticated core asset bytes');
  }
  const core = validateCorePayloadTextV3(coreText, manifest);
  return { head, manifest, manifestText, core, coreText, coreAssetBytesHex };
}

export type DualReadResult =
  | {
      contract: 'v3';
      source: 'live' | 'cache';
      core: CorePayload;
      assetState: AssetState<CorePayload>;
      integrity: CoreIntegrityContext;
      generation: ValidatedGenerationV3;
      warning: string | null;
    }
  | {
      contract: 'v1';
      source: 'live';
      core: CorePayload;
      assetState: AssetState<CorePayload>;
      integrity: CoreIntegrityContext;
      warning: string | null;
    };

function migratedV3Core(generation: ValidatedGenerationV3, trustedLegacy: CorePayload) {
  const core = adaptCoreV3ToLegacy(generation.core, trustedLegacy);
  return normalizeCoreWithIntegrity(core, {
    contract: 'v3',
    generationDigest: generation.manifest.generation_digest,
    coreSha256: generation.manifest.capabilities.core.sha256,
    normalizationVersion: generation.manifest.normalization_version,
  });
}

/**
 * Feature-gated migration coordinator. Any v3 failure is fail-closed: a valid
 * current complete v3 generation is retained, otherwise the caller's legacy v1
 * loader runs. Neither path mutates the other contract's cache.
 */
export async function loadCoreDualRead(opts: {
  bridgeEnabled?: boolean;
  loadV3?: () => Promise<ValidatedGenerationV3>;
  loadV1: () => Promise<CorePayload>;
  /** Required before any v3 core can surface, so persisted v1 identities move atomically with the bridge. */
  migrateLegacyProductAliases?: (aliases: LegacyProductAliasMap) => void | Promise<void>;
  v3Cache: V3GenerationCache;
}): Promise<DualReadResult> {
  let trustedLegacyPromise: Promise<ReturnType<typeof normalizeCoreWithIntegrity>> | null = null;
  const loadTrustedLegacy = () => {
    trustedLegacyPromise ??= opts.loadV1().then((core) => normalizeCoreWithIntegrity(core));
    return trustedLegacyPromise;
  };
  const migrate = async (generation: ValidatedGenerationV3) => {
    const legacy = await loadTrustedLegacy();
    const migrated = migratedV3Core(generation, legacy.core);
    if (!opts.migrateLegacyProductAliases) {
      throw new Error('v3 bridge requires a persisted legacy product-alias migration');
    }
    await opts.migrateLegacyProductAliases(legacyProductAliasMap(generation.core));
    return migrated;
  };
  if (opts.bridgeEnabled === true && opts.loadV3) {
    try {
      const candidate = await opts.loadV3();
      if (candidate.manifest.observation_state !== 'complete') {
        throw new Error('partial v3 observations cannot replace the settled app core');
      }
      const installed = await opts.v3Cache.install(candidate);
      const migrated = await migrate(installed.generation);
      return {
        contract: 'v3',
        source: 'live',
        core: migrated.core,
        assetState: assetStateForV3Coverage(
          migrated.core,
          installed.generation.manifest.coverage,
          installed.generation.manifest.observation_state,
          'live',
        ),
        integrity: migrated.integrity,
        generation: installed.generation,
        warning: installed.persistenceError,
      };
    } catch (error) {
      try {
        const cached = await opts.v3Cache.readCurrent();
        if (cached?.manifest.observation_state === 'complete') {
          const migrated = await migrate(cached);
          return {
            contract: 'v3',
            source: 'cache',
            core: migrated.core,
            assetState: assetStateForV3Coverage(
              migrated.core,
              cached.manifest.coverage,
              cached.manifest.observation_state,
              'cache',
            ),
            integrity: migrated.integrity,
            generation: cached,
            warning: String((error as Error)?.message ?? error),
          };
        }
      } catch {
        // A cached v3 generation must meet the same ledger and migration gates.
      }
    }
  }
  const legacy = await loadTrustedLegacy();
  return {
    contract: 'v1',
    source: 'live',
    core: legacy.core,
    assetState: liveAssetStateForProviderCoverage(legacy.core, legacy.core.coverage),
    integrity: legacy.integrity,
    warning: null,
  };
}
