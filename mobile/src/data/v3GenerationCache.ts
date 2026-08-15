import type { ValidatedGenerationV3 } from '../contracts/v3/types';
import {
  V3ContractError,
  validateCorePayloadV3,
  validateGenerationHeadV3,
  validateGenerationManifestV3,
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

function serializeCandidate(candidate: ValidatedGenerationV3, savedAt: string): string {
  return JSON.stringify({
    schema_version: 1,
    saved_at: savedAt,
    head: candidate.head,
    manifest: candidate.manifest,
    core_text: candidate.coreText,
    optional_assets: candidate.optionalAssets,
    optional_errors: candidate.optionalErrors,
  });
}

function parseCandidate(raw: string | null): CachedGenerationV3 | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj.schema_version !== 1 || typeof obj.saved_at !== 'string' || typeof obj.core_text !== 'string') return null;
    const head = validateGenerationHeadV3(obj.head, 'cache.head');
    const manifest = validateGenerationManifestV3(obj.manifest, head);
    const core = validateCorePayloadV3(JSON.parse(obj.core_text), manifest);
    const optionalAssets = obj.optional_assets && typeof obj.optional_assets === 'object'
      ? obj.optional_assets as ValidatedGenerationV3['optionalAssets']
      : {};
    const optionalErrors = obj.optional_errors && typeof obj.optional_errors === 'object'
      ? obj.optional_errors as ValidatedGenerationV3['optionalErrors']
      : {};
    return {
      head,
      manifest,
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
) {
  let installChain: Promise<void> = Promise.resolve();
  const headPath = `${root}/head.json`;
  const headTmpPath = `${headPath}.tmp`;
  const generationPath = (digest: string) => `${root}/generations/${safeDigest(digest)}.json`;

  async function readHead(): Promise<GenerationCacheHead | null> {
    return parseHead(await storage.read(headPath)) ?? parseHead(await storage.read(headTmpPath));
  }

  async function readDigest(digest: string | null): Promise<CachedGenerationV3 | null> {
    if (!digest) return null;
    const generation = parseCandidate(await storage.read(generationPath(digest)));
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
    const manifest = validateGenerationManifestV3(candidate.manifest, head);
    const core = validateCorePayloadV3(JSON.parse(candidate.coreText), manifest);
    const verified: ValidatedGenerationV3 = { ...candidate, head, manifest, core };
    const savedAt = new Date().toISOString();
    const digest = manifest.generation_digest;
    const recordPath = generationPath(digest);
    let installed = verified;

    try {
      const existing = await storage.read(recordPath);
      if (existing) {
        const parsed = parseCandidate(existing);
        if (
          !parsed ||
          parsed.manifest.generation_digest !== digest ||
          parsed.coreText !== verified.coreText ||
          JSON.stringify(parsed.head) !== JSON.stringify(verified.head) ||
          JSON.stringify(parsed.manifest) !== JSON.stringify(verified.manifest)
        ) {
          throw new V3ContractError(`content-addressed cache collision for ${digest}`);
        }

        for (const [key, value] of Object.entries(verified.optionalAssets)) {
          const cachedValue = parsed.optionalAssets[key];
          if (cachedValue !== undefined && cachedValue !== value) {
            throw new V3ContractError(`content-addressed optional asset collision for ${digest}:${key}`);
          }
        }

        const optionalAssets = { ...parsed.optionalAssets, ...verified.optionalAssets };
        const optionalErrors = { ...parsed.optionalErrors, ...verified.optionalErrors };
        for (const key of Object.keys(optionalAssets)) delete optionalErrors[key];
        installed = { ...verified, optionalAssets, optionalErrors };
        await storage.write(recordPath, serializeCandidate(installed, savedAt));
      } else {
        await storage.write(recordPath, serializeCandidate(installed, savedAt));
      }

      const previousHead = await readHead();
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
      return {
        generation: { ...installed, savedAt },
        persisted: true,
        persistenceError: null,
      };
    } catch (error) {
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
