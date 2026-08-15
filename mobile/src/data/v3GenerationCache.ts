import type { ValidatedGenerationV3 } from '../contracts/v3/types';
import {
  sha256Utf8,
  V3ContractError,
  validateCorePayloadV3,
  validateGenerationHeadV3,
  validateGenerationManifestV3,
  validateGenerationManifestTextV3,
  validateOptionalAssetTextV3,
  v3AssetCacheKey,
  type OptionalAssetValidatorsV3,
} from '../contracts/v3/validators';

export interface GenerationCacheStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
}

interface GenerationCacheHead {
  schema_version: 1;
  current: string;
  previous: string | null;
}

export interface CachedGenerationV3 extends ValidatedGenerationV3 {
  savedAt: string;
}

export interface GenerationInstallResultV3 {
  generation: CachedGenerationV3;
  persisted: boolean;
  persistenceError: string | null;
}

const SHA256 = /^[0-9a-f]{64}$/;

function safeDigest(value: string): string {
  if (!SHA256.test(value)) throw new V3ContractError('cache generation digest is invalid');
  return value;
}

function parseHead(raw: string | null): GenerationCacheHead | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GenerationCacheHead>;
    if (
      value.schema_version !== 1 ||
      typeof value.current !== 'string' ||
      !SHA256.test(value.current) ||
      !(value.previous === null || (typeof value.previous === 'string' && SHA256.test(value.previous)))
    ) return null;
    return value as GenerationCacheHead;
  } catch {
    return null;
  }
}

function contentHashes(candidate: ValidatedGenerationV3) {
  return {
    core_sha256: sha256Utf8(candidate.coreText),
    optional_assets: Object.fromEntries(
      Object.entries(candidate.optionalAssets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, sha256Utf8(value)]),
    ),
  };
}

function serializeCandidate(candidate: ValidatedGenerationV3, savedAt: string): string {
  return JSON.stringify({
    schema_version: 3,
    saved_at: savedAt,
    head: candidate.head,
    manifest: candidate.manifest,
    manifest_text: candidate.manifestText,
    core_text: candidate.coreText,
    optional_assets: candidate.optionalAssets,
    optional_errors: candidate.optionalErrors,
    content_hashes: contentHashes(candidate),
  });
}

function validatedOptionalAssets(
  rawAssets: unknown,
  rawErrors: unknown,
  manifest: ValidatedGenerationV3['manifest'],
  validators: OptionalAssetValidatorsV3,
): Pick<ValidatedGenerationV3, 'optionalAssets' | 'optionalErrors'> {
  if (!rawAssets || typeof rawAssets !== 'object' || Array.isArray(rawAssets)) {
    throw new V3ContractError('cache optional_assets must be an object');
  }
  if (!rawErrors || typeof rawErrors !== 'object' || Array.isArray(rawErrors)) {
    throw new V3ContractError('cache optional_errors must be an object');
  }
  const descriptors = new Map(
    manifest.assets
      .filter((asset) => asset.capability !== 'core')
      .map((asset) => [v3AssetCacheKey(asset), asset]),
  );
  const optionalAssets: ValidatedGenerationV3['optionalAssets'] = {};
  for (const [key, value] of Object.entries(rawAssets as Record<string, unknown>)) {
    if (typeof value !== 'string') throw new V3ContractError(`cache optional asset ${key} must be text`);
    const descriptor = descriptors.get(key);
    if (!descriptor) throw new V3ContractError(`cache optional asset ${key} has no manifest descriptor`);
    const validator = validators[descriptor.capability as Exclude<typeof descriptor.capability, 'core'>];
    if (!validator) throw new V3ContractError(`cache optional asset ${key} has no registered capability validator`);
    validateOptionalAssetTextV3(value, descriptor, manifest, validator);
    optionalAssets[key] = value;
  }
  const optionalErrors: ValidatedGenerationV3['optionalErrors'] = {};
  for (const [key, value] of Object.entries(rawErrors as Record<string, unknown>)) {
    if (typeof value !== 'string') throw new V3ContractError(`cache optional error ${key} must be text`);
    if (!descriptors.has(key)) throw new V3ContractError(`cache optional error ${key} has no manifest descriptor`);
    optionalErrors[key] = value;
  }
  for (const descriptor of descriptors.values()) {
    const key = v3AssetCacheKey(descriptor);
    if (descriptor.required && optionalAssets[key] === undefined) {
      throw new V3ContractError(`required cache capability ${key} is unavailable`);
    }
  }
  return { optionalAssets, optionalErrors };
}

function parseCandidate(
  raw: string | null,
  validators: OptionalAssetValidatorsV3,
): CachedGenerationV3 | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      obj.schema_version !== 3 ||
      typeof obj.saved_at !== 'string' ||
      typeof obj.manifest_text !== 'string' ||
      typeof obj.core_text !== 'string'
    ) return null;
    if (!obj.content_hashes || typeof obj.content_hashes !== 'object' || Array.isArray(obj.content_hashes)) return null;
    const hashes = obj.content_hashes as Record<string, unknown>;
    if (typeof hashes.core_sha256 !== 'string' || hashes.core_sha256 !== sha256Utf8(obj.core_text)) return null;
    if (!hashes.optional_assets || typeof hashes.optional_assets !== 'object' || Array.isArray(hashes.optional_assets)) return null;
    const head = validateGenerationHeadV3(obj.head, 'cache.head');
    const manifest = validateGenerationManifestTextV3(obj.manifest_text, head);
    const persistedManifest = validateGenerationManifestV3(obj.manifest, head);
    if (JSON.stringify(manifest) !== JSON.stringify(persistedManifest)) return null;
    if (manifest.observation_state !== 'complete') return null;
    const core = validateCorePayloadV3(JSON.parse(obj.core_text), manifest);
    const { optionalAssets, optionalErrors } = validatedOptionalAssets(
      obj.optional_assets,
      obj.optional_errors,
      manifest,
      validators,
    );
    const optionalHashes = hashes.optional_assets as Record<string, unknown>;
    const assetKeys = Object.keys(optionalAssets).sort();
    if (Object.keys(optionalHashes).sort().join('\0') !== assetKeys.join('\0')) return null;
    for (const [key, value] of Object.entries(optionalAssets)) {
      if (typeof optionalHashes[key] !== 'string' || optionalHashes[key] !== sha256Utf8(value)) return null;
    }
    return {
      head,
      manifest,
      manifestText: obj.manifest_text,
      core,
      coreText: obj.core_text,
      optionalAssets,
      optionalErrors,
      savedAt: obj.saved_at,
    };
  } catch {
    return null;
  }
}

export function createV3GenerationCache(
  storage: GenerationCacheStorage,
  root = 'payload/v3',
  optionalValidators: OptionalAssetValidatorsV3 = {},
) {
  let installChain: Promise<void> = Promise.resolve();
  const headPath = `${root}/head.json`;
  const headTmpPath = `${headPath}.tmp`;
  const generationPath = (digest: string) => `${root}/generations/${safeDigest(digest)}.json`;
  const generationTmpPath = (digest: string) => `${generationPath(digest)}.tmp`;

  async function readHead(): Promise<GenerationCacheHead | null> {
    return parseHead(await storage.read(headPath)) ?? parseHead(await storage.read(headTmpPath));
  }

  async function readDigest(digest: string | null): Promise<CachedGenerationV3 | null> {
    if (!digest) return null;
    const generation = parseCandidate(await storage.read(generationPath(digest)), optionalValidators);
    return generation?.manifest.generation_digest === digest ? generation : null;
  }

  async function readCurrent(): Promise<CachedGenerationV3 | null> {
    const head = await readHead();
    if (!head) return null;
    return (await readDigest(head.current)) ?? readDigest(head.previous);
  }

  async function readPrevious(): Promise<CachedGenerationV3 | null> {
    return readDigest((await readHead())?.previous ?? null);
  }

  async function installUnserialized(
    candidate: ValidatedGenerationV3,
  ): Promise<GenerationInstallResultV3> {
    // Re-validate typed input at the trust boundary. Types do not make values
    // received over the network trustworthy at runtime.
    const head = validateGenerationHeadV3(candidate.head, 'candidate.head');
    const manifest = validateGenerationManifestTextV3(candidate.manifestText, head);
    const candidateManifest = validateGenerationManifestV3(candidate.manifest, head);
    if (JSON.stringify(manifest) !== JSON.stringify(candidateManifest)) {
      throw new V3ContractError('candidate manifest does not match its authenticated manifest bytes');
    }
    if (manifest.observation_state !== 'complete') {
      throw new V3ContractError('only complete observations can enter the settled generation cache');
    }
    const core = validateCorePayloadV3(JSON.parse(candidate.coreText), manifest);
    const { optionalAssets, optionalErrors } = validatedOptionalAssets(
      candidate.optionalAssets,
      candidate.optionalErrors,
      manifest,
      optionalValidators,
    );
    const verified: ValidatedGenerationV3 = {
      ...candidate,
      head,
      manifest,
      manifestText: candidate.manifestText,
      core,
      optionalAssets,
      optionalErrors,
    };
    const savedAt = new Date().toISOString();
    const digest = manifest.generation_digest;
    const recordPath = generationPath(digest);
    const recordTmpPath = generationTmpPath(digest);
    let installed = verified;

    try {
      const previousHead = await readHead();
      const current = previousHead ? await readDigest(previousHead.current) : null;
      if (previousHead && !current && previousHead.current !== digest) {
        throw new V3ContractError('current cache generation is unavailable or invalid');
      }
      if (current && current.manifest.generation_digest !== digest) {
        if (manifest.run_date < current.manifest.run_date) {
          throw new V3ContractError(`rollback generation ${digest} predates current ${current.manifest.generation_digest}`);
        }
        if (manifest.prior_ledger_digest !== current.manifest.ledger_digest) {
          throw new V3ContractError(`generation ${digest} is not a direct descendant of current ${current.manifest.generation_digest}`);
        }
      }

      const existing = await storage.read(recordPath);
      if (existing) {
        const parsed = parseCandidate(existing, optionalValidators);
        if (
          parsed && (
          parsed.manifest.generation_digest !== digest ||
          parsed.manifestText !== verified.manifestText ||
          parsed.coreText !== verified.coreText ||
          JSON.stringify(parsed.head) !== JSON.stringify(verified.head) ||
          JSON.stringify(parsed.manifest) !== JSON.stringify(verified.manifest)
          )
        ) {
          throw new V3ContractError(`content-addressed cache collision for ${digest}`);
        }

        if (!parsed && previousHead?.current !== digest) {
          throw new V3ContractError(`content-addressed cache collision for ${digest}`);
        }

        if (parsed) {
          for (const [key, value] of Object.entries(verified.optionalAssets)) {
            const cachedValue = parsed.optionalAssets[key];
            if (cachedValue !== undefined && cachedValue !== value) {
              throw new V3ContractError(`content-addressed optional asset collision for ${digest}:${key}`);
            }
          }

          const mergedAssets = { ...parsed.optionalAssets, ...verified.optionalAssets };
          const mergedErrors = { ...parsed.optionalErrors, ...verified.optionalErrors };
          for (const key of Object.keys(mergedAssets)) delete mergedErrors[key];
          installed = { ...verified, optionalAssets: mergedAssets, optionalErrors: mergedErrors };
        }
        await storage.write(recordTmpPath, serializeCandidate(installed, savedAt));
        await storage.move(recordTmpPath, recordPath);
      } else {
        await storage.write(recordTmpPath, serializeCandidate(installed, savedAt));
        await storage.move(recordTmpPath, recordPath);
      }

      const nextHead: GenerationCacheHead = {
        schema_version: 1,
        current: digest,
        previous: previousHead?.current && previousHead.current !== digest
          ? previousHead.current
          : previousHead?.previous ?? null,
      };
      await storage.write(headTmpPath, JSON.stringify(nextHead));
      await storage.remove(headPath);
      await storage.move(headTmpPath, headPath);
      let cleanupError: string | null = null;
      const displaced = previousHead?.previous;
      if (displaced && displaced !== nextHead.current && displaced !== nextHead.previous) {
        try {
          await storage.remove(generationPath(displaced));
        } catch (error) {
          cleanupError = `cache cleanup failed: ${String((error as Error)?.message ?? error)}`;
        }
      }
      return {
        generation: { ...installed, savedAt },
        persisted: true,
        persistenceError: cleanupError,
      };
    } catch (error) {
      try {
        await storage.remove(recordTmpPath);
      } catch {
        // Best-effort cleanup only; the committed record remains authoritative.
      }
      if (error instanceof V3ContractError) throw error;
      return {
        generation: { ...installed, savedAt },
        persisted: false,
        persistenceError: String((error as Error)?.message ?? error),
      };
    }
  }

  function install(candidate: ValidatedGenerationV3): Promise<GenerationInstallResultV3> {
    const run = installChain.then(
      () => installUnserialized(candidate),
      () => installUnserialized(candidate),
    );
    installChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return { install, readCurrent, readPrevious };
}

export type V3GenerationCache = ReturnType<typeof createV3GenerationCache>;
