import { strFromU8 } from 'fflate';

import type { ValidatedGenerationV3 } from '../contracts/v3/types';
import {
  bytesFromHex,
  sha256Bytes,
  utf8Bytes,
} from '../contracts/v3/contractPrimitives';
import {
  canonicalJsonForContract,
  V3ContractError,
  validateCorePayloadTextV3,
  validateGenerationHeadV3,
  validateGenerationManifestTextV3,
} from '../contracts/v3/validators';
import { gunzipCooperatively } from './payload';
import { HEAVY_JSON_BYTES, parseJsonHeavy } from '../lib/yieldToUi';

export interface GenerationCacheStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
}

interface GenerationCacheHeadV1 {
  schema_version: 1;
  current: string;
  previous: string | null;
}

interface GenerationCacheHeadV2 {
  schema_version: 2;
  current: string;
  previous: string | null;
  current_observation_date: string;
  current_generation_revision: number;
  current_ledger_event_digest: string;
}

interface GenerationCacheHeadV3 {
  schema_version: 3;
  transaction_sequence: number;
  current: string;
  previous: string | null;
  current_observation_date: string;
  current_generation_revision: number;
  current_prior_ledger_digest: string | null;
  current_ledger_event_digest: string;
}

type GenerationCacheHead = GenerationCacheHeadV1 | GenerationCacheHeadV2 | GenerationCacheHeadV3;

interface VerifiedGenerationCacheHead {
  head: GenerationCacheHead;
  current: CachedGenerationV3 | null;
  previous: CachedGenerationV3 | null;
  source: 'primary' | 'temporary';
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
    const value = JSON.parse(raw) as Partial<Omit<GenerationCacheHeadV3, 'schema_version'>> & {
      schema_version?: 1 | 2 | 3;
    };
    if (
      (value.schema_version !== 1 && value.schema_version !== 2 && value.schema_version !== 3) ||
      typeof value.current !== 'string' ||
      !SHA256.test(value.current) ||
      !(value.previous === null || (typeof value.previous === 'string' && SHA256.test(value.previous)))
    ) return null;
    if (value.schema_version !== 1 && (
      typeof value.current_observation_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.current_observation_date) ||
      !Number.isSafeInteger(value.current_generation_revision) ||
      (value.current_generation_revision as number) < 1 ||
      typeof value.current_ledger_event_digest !== 'string' ||
      !SHA256.test(value.current_ledger_event_digest)
    )) return null;
    if (value.schema_version === 3 && (
      !Number.isSafeInteger(value.transaction_sequence) ||
      (value.transaction_sequence as number) < 0 ||
      !(value.current_prior_ledger_digest === null || (
        typeof value.current_prior_ledger_digest === 'string' &&
        SHA256.test(value.current_prior_ledger_digest)
      ))
    )) return null;
    return value as GenerationCacheHead;
  } catch {
    return null;
  }
}

function serializeCandidate(candidate: ValidatedGenerationV3, savedAt: string): string {
  return JSON.stringify({
    schema_version: 5,
    saved_at: savedAt,
    head: candidate.head,
    manifest: candidate.manifest,
    manifest_text: candidate.manifestText,
    core_text: candidate.coreText,
    core_asset_bytes_hex: candidate.coreAssetBytesHex,
  });
}

function equivalent(left: unknown, right: unknown): boolean {
  return canonicalJsonForContract(left) === canonicalJsonForContract(right);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function verifyCoreAssetBytes(
  candidate: Pick<ValidatedGenerationV3, 'manifest' | 'coreText' | 'coreAssetBytesHex'>,
): Promise<void> {
  const descriptor = candidate.manifest.capabilities.core;
  const raw = bytesFromHex(candidate.coreAssetBytesHex, 'cache.core_asset_bytes_hex');
  if (raw.byteLength !== descriptor.compressed_bytes) {
    throw new V3ContractError('cached core asset byte count does not match the authenticated descriptor');
  }
  if (sha256Bytes(raw) !== descriptor.sha256) {
    throw new V3ContractError('cached core asset SHA-256 does not match the authenticated descriptor');
  }
  const looksGzipped = raw.byteLength > 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  if (descriptor.encoding === 'gzip' && !looksGzipped) {
    throw new V3ContractError('cached core asset encoding does not match the authenticated descriptor');
  }
  if (descriptor.encoding === 'identity' && looksGzipped) {
    throw new V3ContractError('cached core asset encoding does not match the authenticated descriptor');
  }
  let inflated: Uint8Array;
  try {
    inflated = descriptor.encoding === 'gzip'
      ? await gunzipCooperatively(raw, 256 * 1024, descriptor.uncompressed_bytes)
      : raw;
  } catch {
    throw new V3ContractError('cached core asset cannot be inflated');
  }
  if (inflated.byteLength !== descriptor.uncompressed_bytes) {
    throw new V3ContractError('cached core inflated byte count does not match the authenticated descriptor');
  }
  const inflatedText = strFromU8(inflated);
  if (!sameBytes(utf8Bytes(inflatedText), inflated) || inflatedText !== candidate.coreText) {
    throw new V3ContractError('cached core text is not the exact authenticated asset content');
  }
}

async function parseCandidate(raw: string | null): Promise<CachedGenerationV3 | null> {
  if (!raw) return null;
  try {
    const obj = raw.length >= HEAVY_JSON_BYTES
      ? await parseJsonHeavy<Record<string, unknown>>(raw)
      : JSON.parse(raw) as Record<string, unknown>;
    if (
      obj.schema_version !== 5 ||
      typeof obj.saved_at !== 'string' ||
      !Number.isFinite(Date.parse(obj.saved_at)) ||
      typeof obj.manifest_text !== 'string' ||
      typeof obj.core_text !== 'string' ||
      typeof obj.core_asset_bytes_hex !== 'string'
    ) return null;
    const head = validateGenerationHeadV3(obj.head, 'cache.head');
    const manifest = validateGenerationManifestTextV3(obj.manifest_text, head);
    if (!equivalent(obj.manifest, manifest) || manifest.observation_state !== 'complete') return null;
    await verifyCoreAssetBytes({
      manifest,
      coreText: obj.core_text,
      coreAssetBytesHex: obj.core_asset_bytes_hex,
    });
    const core = validateCorePayloadTextV3(obj.core_text, manifest);
    return {
      head,
      manifest,
      manifestText: obj.manifest_text,
      core,
      coreText: obj.core_text,
      coreAssetBytesHex: obj.core_asset_bytes_hex,
      savedAt: obj.saved_at,
    };
  } catch {
    return null;
  }
}

function generationOrder(generation: ValidatedGenerationV3): [string, number] {
  return [generation.manifest.observation_date, generation.manifest.generation_revision];
}

function compareOrder(left: ValidatedGenerationV3, right: ValidatedGenerationV3): number {
  const leftOrder = generationOrder(left);
  const rightOrder = generationOrder(right);
  return leftOrder[0].localeCompare(rightOrder[0]) || leftOrder[1] - rightOrder[1];
}

async function verifyCandidate(candidate: ValidatedGenerationV3): Promise<ValidatedGenerationV3> {
  const head = validateGenerationHeadV3(candidate.head, 'candidate.head');
  const manifest = validateGenerationManifestTextV3(candidate.manifestText, head);
  if (!equivalent(candidate.manifest, manifest)) {
    throw new V3ContractError('candidate manifest does not match its authenticated manifest bytes');
  }
  if (manifest.observation_state !== 'complete') {
    throw new V3ContractError('only complete observations can enter the settled generation cache');
  }
  await verifyCoreAssetBytes({ manifest, coreText: candidate.coreText, coreAssetBytesHex: candidate.coreAssetBytesHex });
  const core = validateCorePayloadTextV3(candidate.coreText, manifest);
  if (!equivalent(candidate.core, core)) throw new V3ContractError('candidate core object does not match its authenticated core text');
  return {
    head,
    manifest,
    manifestText: candidate.manifestText,
    core,
    coreText: candidate.coreText,
    coreAssetBytesHex: candidate.coreAssetBytesHex,
  };
}

export function createV3GenerationCache(storage: GenerationCacheStorage, root = 'payload/v3') {
  let installChain: Promise<void> = Promise.resolve();
  const headPath = `${root}/head.json`;
  const headTmpPath = `${headPath}.tmp`;
  const generationPath = (digest: string) => `${root}/generations/${safeDigest(digest)}.json`;
  const generationTmpPath = (digest: string) => `${generationPath(digest)}.tmp`;

  async function replaceWithTemporary(temporaryPath: string, destinationPath: string): Promise<void> {
    // Expo's legacy Android adapter delegates to File.renameTo, which cannot
    // replace an existing destination. Remove explicitly on every platform;
    // an interrupted move leaves the authenticated temporary file for the
    // primary-then-temporary readers below to recover.
    await storage.remove(destinationPath);
    await storage.move(temporaryPath, destinationPath);
  }

  async function readDigest(digest: string | null): Promise<CachedGenerationV3 | null> {
    if (!digest) return null;
    const generation =
      await parseCandidate(await storage.read(generationPath(digest))) ??
      await parseCandidate(await storage.read(generationTmpPath(digest)));
    return generation?.manifest.generation_digest === digest ? generation : null;
  }

  async function verifyHead(
    head: GenerationCacheHead | null,
    source: VerifiedGenerationCacheHead['source'],
  ): Promise<VerifiedGenerationCacheHead | null> {
    if (!head) return null;
    const current = await readDigest(head.current);
    const previous = await readDigest(head.previous);
    if (!current) {
      // A verified predecessor remains a safe read fallback. Install still
      // rejects a v1 head because it lacks the unavailable current's lineage
      // metadata, while v2/v3 can authenticate a direct successor.
      return { head, current: null, previous, source };
    }
    if (head.schema_version !== 1 && (
      head.current_observation_date !== current.manifest.observation_date ||
      head.current_generation_revision !== current.manifest.generation_revision ||
      head.current_ledger_event_digest !== current.manifest.ledger_event_digest
    )) return null;
    if (head.schema_version === 3 &&
      head.current_prior_ledger_digest !== current.manifest.prior_ledger_digest) return null;
    if (head.previous !== null && !previous) return null;
    return { head, current, previous, source };
  }

  async function readHeadState(): Promise<VerifiedGenerationCacheHead | null> {
    const [primary, temporary] = await Promise.all([
      verifyHead(parseHead(await storage.read(headPath)), 'primary'),
      verifyHead(parseHead(await storage.read(headTmpPath)), 'temporary'),
    ]);
    if (!primary) return temporary;
    if (!temporary) return primary;
    if (equivalent(primary.head, temporary.head)) return primary;

    if (primary.head.schema_version === 3 && temporary.head.schema_version === 3) {
      if (primary.head.transaction_sequence === temporary.head.transaction_sequence) return null;
      return primary.head.transaction_sequence > temporary.head.transaction_sequence ? primary : temporary;
    }
    if (primary.head.schema_version === 3) return primary;
    if (temporary.head.schema_version === 3) return temporary;

    // Legacy heads have no transaction sequence. Prefer a direct successor;
    // otherwise two different parseable heads are ambiguous and unavailable.
    if (
      primary.current && temporary.current &&
      primary.head.previous === temporary.head.current &&
      primary.current.manifest.prior_ledger_digest === temporary.current.manifest.ledger_event_digest
    ) return primary;
    if (
      primary.current && temporary.current &&
      temporary.head.previous === primary.head.current &&
      temporary.current.manifest.prior_ledger_digest === primary.current.manifest.ledger_event_digest
    ) return temporary;
    if (!primary.current && primary.head.previous === temporary.head.current) return temporary;
    if (!temporary.current && temporary.head.previous === primary.head.current) return primary;
    return null;
  }

  async function readHead(): Promise<GenerationCacheHead | null> {
    return (await readHeadState())?.head ?? null;
  }

  async function readCurrent(): Promise<CachedGenerationV3 | null> {
    const state = await readHeadState();
    return state?.current ?? state?.previous ?? null;
  }

  async function readPrevious(): Promise<CachedGenerationV3 | null> {
    return (await readHeadState())?.previous ?? null;
  }

  async function installUnserialized(candidate: ValidatedGenerationV3): Promise<GenerationInstallResultV3> {
    const verified = await verifyCandidate(candidate);
    const savedAt = new Date().toISOString();
    const digest = verified.manifest.generation_digest;
    const recordPath = generationPath(digest);
    const recordTmpPath = generationTmpPath(digest);

    try {
      const previousHead = await readHead();
      const current = previousHead ? await readDigest(previousHead.current) : null;
      const previous = previousHead ? await readDigest(previousHead.previous) : null;
      if (previousHead && !current && previousHead.current !== digest) {
        if (!previous || previousHead.schema_version === 1) {
          throw new V3ContractError('current cache lineage is unavailable or invalid');
        }
        const cachedCurrentOrder: [string, number] = [
          previousHead.current_observation_date,
          previousHead.current_generation_revision,
        ];
        const candidateOrder = generationOrder(verified);
        const order = candidateOrder[0].localeCompare(cachedCurrentOrder[0]) || candidateOrder[1] - cachedCurrentOrder[1];
        if (order <= 0) {
          throw new V3ContractError('replacement generation does not advance the unavailable current generation');
        }
        if (verified.manifest.prior_ledger_digest !== previousHead.current_ledger_event_digest) {
          throw new V3ContractError('replacement generation is not a direct ledger descendant of unavailable current');
        }
      }
      if (current && current.manifest.generation_digest !== digest) {
        const order = compareOrder(verified, current);
        if (order < 0) throw new V3ContractError(`rollback generation ${digest} predates current ${current.manifest.generation_digest}`);
        if (order === 0) throw new V3ContractError('an equal observation/revision coordinate is immutable');
        if (verified.manifest.prior_ledger_digest !== current.manifest.ledger_event_digest) {
          throw new V3ContractError(`generation ${digest} is not a direct ledger descendant of current ${current.manifest.generation_digest}`);
        }
      }

      const existingPrimary = await storage.read(recordPath);
      const existingTemporary = await storage.read(recordTmpPath);
      const parsed =
        await parseCandidate(existingPrimary) ??
        await parseCandidate(existingTemporary);
      if (existingPrimary || existingTemporary) {
        if (
          (parsed && (
            parsed.manifestText !== verified.manifestText ||
            parsed.coreText !== verified.coreText ||
            parsed.coreAssetBytesHex !== verified.coreAssetBytesHex ||
            !equivalent(parsed.head, verified.head) ||
            !equivalent(parsed.manifest, verified.manifest)
          )) ||
          (!parsed && previousHead?.current !== digest)
        ) {
          throw new V3ContractError(`content-addressed cache collision for ${digest}`);
        }
      }
      if (!parsed) {
        await storage.write(recordTmpPath, serializeCandidate(verified, savedAt));
        await replaceWithTemporary(recordTmpPath, recordPath);
      }

      const retainedPrevious = current?.manifest.generation_digest ?? previous?.manifest.generation_digest ?? null;
      const nextHead: GenerationCacheHeadV3 = {
        schema_version: 3,
        transaction_sequence: previousHead?.schema_version === 3 &&
          previousHead.transaction_sequence < Number.MAX_SAFE_INTEGER
          ? previousHead.transaction_sequence + 1
          : 0,
        current: digest,
        previous: retainedPrevious && retainedPrevious !== digest ? retainedPrevious : previousHead?.previous ?? null,
        current_observation_date: verified.manifest.observation_date,
        current_generation_revision: verified.manifest.generation_revision,
        current_prior_ledger_digest: verified.manifest.prior_ledger_digest,
        current_ledger_event_digest: verified.manifest.ledger_event_digest,
      };
      if (!previousHead || !equivalent(previousHead, nextHead)) {
        await storage.write(headTmpPath, JSON.stringify(nextHead));
        await replaceWithTemporary(headTmpPath, headPath);
      }

      let cleanupError: string | null = null;
      const displaced = new Set([previousHead?.current, previousHead?.previous].filter(
        (candidate): candidate is string => !!candidate && candidate !== nextHead.current && candidate !== nextHead.previous,
      ));
      for (const candidate of displaced) {
        try {
          await storage.remove(generationPath(candidate));
          await storage.remove(generationTmpPath(candidate));
        } catch (error) {
          cleanupError = `cache cleanup failed: ${String((error as Error)?.message ?? error)}`;
          break;
        }
      }
      return {
        generation: { ...verified, savedAt },
        persisted: true,
        persistenceError: cleanupError,
      };
    } catch (error) {
      // Keep completed temporary records. Expo's legacy iOS move adapter can
      // delete the destination before a crash; readers authenticate primary
      // first and then the tmp so that crash window remains recoverable.
      if (error instanceof V3ContractError) throw error;
      return {
        generation: { ...verified, savedAt },
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
    installChain = run.then(() => undefined, () => undefined);
    return run;
  }

  return { install, readCurrent, readPrevious };
}

export type V3GenerationCache = ReturnType<typeof createV3GenerationCache>;
