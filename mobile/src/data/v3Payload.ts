import type { CorePayload } from '../types';
import type {
  AssetDescriptorV3,
  CapabilityV3,
  GenerationHeadV3,
  ValidatedGenerationV3,
} from '../contracts/v3/types';
import {
  V3_ASSET_LIMITS,
  V3_MANIFEST_LIMIT_BYTES,
  V3_POINTER_LIMIT_BYTES,
  adaptCoreV3ToLegacy,
  validateCorePayloadV3,
  validateGenerationManifestV3,
  validateGenerationPointerV3,
} from '../contracts/v3/validators';
import { parseJsonHeavy } from '../lib/yieldToUi';
import { downloadInflate, type DownloadOpts } from './payload';
import type { V3GenerationCache } from './v3GenerationCache';
import { normalizeCoreWithIntegrity, type CoreIntegrityContext } from './sectionIntegrity';

/**
 * Deliberately dormant until AR-local publishes a reviewed bridge candidate.
 * There is no baked v3 URL and production store code does not enable this.
 */
export const V3_PAYLOAD_BRIDGE_ENABLED = false as const;

export type V3TextDownloader = (
  url: string,
  expectedSha: string | undefined,
  opts: DownloadOpts,
) => Promise<string>;

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function descriptorOptions(asset: AssetDescriptorV3): DownloadOpts {
  const limits = V3_ASSET_LIMITS[asset.capability];
  return {
    fileName: asset.capability,
    expectedBytes: asset.compressed_bytes,
    maxCompressedBytes: limits.compressed,
    maxInflatedBytes: limits.inflated,
    expectedInflatedBytes: asset.uncompressed_bytes,
    requireExactBytes: true,
    expectedEncoding: asset.encoding,
    allowEncrypted: false,
  };
}

function descriptorMatchesBase(asset: AssetDescriptorV3, generationDigest: string): boolean {
  return !asset.base_generation_digest || asset.base_generation_digest === generationDigest;
}

function assetCacheKey(asset: AssetDescriptorV3): string {
  if (asset.cohort) return `${asset.capability}:${asset.cohort}`;
  if (asset.capability === 'details-shard') return `${asset.capability}:${asset.sha256}`;
  return asset.capability;
}

function validateOptionalJson(text: string, descriptor: AssetDescriptorV3): void {
  const parsed = parseJson(text, descriptor.capability);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${descriptor.capability} must contain a JSON object`);
  }
  const schemaId = (parsed as Record<string, unknown>).schema_id;
  if (schemaId !== undefined && schemaId !== descriptor.schema_id) {
    throw new Error(`${descriptor.capability} schema_id does not match its descriptor`);
  }
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
    fileName: 'manifest-v3.json',
    maxCompressedBytes: V3_POINTER_LIMIT_BYTES,
    maxInflatedBytes: V3_POINTER_LIMIT_BYTES,
  });
  const pointer = validateGenerationPointerV3(await parseJsonHeavy<unknown>(pointerText));
  const head: GenerationHeadV3 = pointer[opts.head ?? 'latest_complete'];
  const manifestText = await download(head.manifest_url, head.manifest_sha256, {
    fileName: 'generation-manifest-v3.json',
    expectedBytes: head.manifest_bytes,
    maxCompressedBytes: V3_MANIFEST_LIMIT_BYTES,
    maxInflatedBytes: V3_MANIFEST_LIMIT_BYTES,
    requireExactBytes: true,
  });
  const manifest = validateGenerationManifestV3(await parseJsonHeavy<unknown>(manifestText), head);

  const optionalAssets: Record<string, string> = {};
  const optionalErrors: Record<string, string> = {};
  let coreText: string | null = null;

  for (const asset of manifest.assets) {
    const assetKey = assetCacheKey(asset);
    if (!descriptorMatchesBase(asset, manifest.generation_digest)) {
      const message = `${asset.capability} base generation does not match ${manifest.generation_digest}`;
      if (asset.required) throw new Error(message);
      optionalErrors[assetKey] = message;
      continue;
    }
    try {
      const text = await download(asset.url, asset.sha256, descriptorOptions(asset));
      if (asset.capability === 'core') coreText = text;
      else {
        validateOptionalJson(text, asset);
        optionalAssets[assetKey] = text;
      }
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      if (asset.required) throw new Error(`${asset.capability} validation failed: ${message}`);
      optionalErrors[assetKey] = message;
    }
  }

  if (!coreText) throw new Error('required v3 core asset is unavailable');
  const core = validateCorePayloadV3(await parseJsonHeavy<unknown>(coreText), manifest);
  return { head, manifest, core, coreText, optionalAssets, optionalErrors };
}

export type DualReadResult =
  | { contract: 'v3'; source: 'live' | 'cache'; core: CorePayload; integrity: CoreIntegrityContext; generation: ValidatedGenerationV3; warning: string | null }
  | { contract: 'v1'; source: 'live'; core: CorePayload; integrity: CoreIntegrityContext; warning: string | null };

function migratedV3Core(generation: ValidatedGenerationV3) {
  const core = adaptCoreV3ToLegacy(generation.core);
  const coreDescriptor = generation.manifest.assets.find((asset) => asset.capability === 'core');
  return normalizeCoreWithIntegrity(core, {
    contract: 'v3',
    generationDigest: generation.manifest.generation_digest,
    coreSha256: coreDescriptor?.sha256 ?? null,
    normalizationVersion: generation.manifest.normalization_version,
  });
}

/**
 * Feature-gated migration coordinator. Any v3 failure is fail-closed: a valid
 * current v3 generation is retained, otherwise the caller's legacy v1 loader
 * runs. Neither path mutates the other contract's cache.
 */
export async function loadCoreDualRead(opts: {
  bridgeEnabled?: boolean;
  loadV3?: () => Promise<ValidatedGenerationV3>;
  loadV1: () => Promise<CorePayload>;
  v3Cache: V3GenerationCache;
}): Promise<DualReadResult> {
  if (opts.bridgeEnabled === true && opts.loadV3) {
    try {
      const candidate = await opts.loadV3();
      const installed = await opts.v3Cache.install(candidate);
      const migrated = migratedV3Core(installed.generation);
      return {
        contract: 'v3',
        source: 'live',
        core: migrated.core,
        integrity: migrated.integrity,
        generation: installed.generation,
        warning: installed.persistenceError,
      };
    } catch (error) {
      const cached = await opts.v3Cache.readCurrent();
      if (cached) {
        const migrated = migratedV3Core(cached);
        return {
          contract: 'v3',
          source: 'cache',
          core: migrated.core,
          integrity: migrated.integrity,
          generation: cached,
          warning: String((error as Error)?.message ?? error),
        };
      }
    }
  }
  const legacy = normalizeCoreWithIntegrity(await opts.loadV1());
  return {
    contract: 'v1',
    source: 'live',
    core: legacy.core,
    integrity: legacy.integrity,
    warning: null,
  };
}
