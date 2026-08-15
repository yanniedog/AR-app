import { V3_CONTRACT_SCHEMA_SET_SHA256 } from './contractLock';
import { validateCorePayloadV3 } from './canonicalCore';
import type {
  AssetDescriptorV3,
  CoverageV2,
  GenerationHeadV3,
  GenerationManifestV3,
  GenerationPointerV3,
} from './types';
import {
  booleanValue,
  canonicalSha256,
  dateValue,
  deepFreeze,
  digest,
  enumValue,
  exactKeys,
  httpsUrl,
  instant,
  integer,
  record,
  reject,
  releaseUrl,
  sameCanonicalValue,
  sha1Commit,
  sha256Utf8,
  stableStringify,
  text,
  utf8ByteLength,
  V3ContractError,
} from './contractPrimitives';

export { V3ContractError, sha256Utf8, utf8ByteLength };
export {
  adaptCoreV3ToLegacy,
  canonicalEvidenceUid,
  canonicalFeeUid,
  canonicalProductUid,
  canonicalRateUid,
  validateCorePayloadV3,
} from './canonicalCore';

const GENERATION_ID = /^gen-(\d{4}-\d{2}-\d{2})-r(\d{4})-([0-9a-f]{12})$/;
const PROVIDER_ID = /^provider(?:-fallback)?:v1:[0-9a-f]{64}$/;
const MIB = 1024 * 1024;

export const V3_POINTER_LIMIT_BYTES = 64 * 1024;
export const V3_MANIFEST_LIMIT_BYTES = 64 * 1024;
export const V3_ASSET_LIMITS = Object.freeze({
  core: { compressed: 2 * MIB, inflated: 16 * MIB },
});

function parseString(raw: string, cursor: { value: number }, label: string): string {
  const start = cursor.value;
  if (raw[cursor.value] !== '"') reject(`${label} JSON string is malformed`);
  cursor.value += 1;
  while (cursor.value < raw.length) {
    const character = raw[cursor.value];
    if (character === '"') {
      cursor.value += 1;
      try {
        return JSON.parse(raw.slice(start, cursor.value)) as string;
      } catch {
        return reject(`${label} JSON string is malformed`);
      }
    }
    if (character === '\\') cursor.value += 1;
    cursor.value += 1;
  }
  return reject(`${label} JSON string is unterminated`);
}

function skipWhitespace(raw: string, cursor: { value: number }): void {
  while (/\s/.test(raw[cursor.value] ?? '')) cursor.value += 1;
}

function parseStrictValue(raw: string, cursor: { value: number }, label: string): void {
  skipWhitespace(raw, cursor);
  const character = raw[cursor.value];
  if (character === '"') {
    parseString(raw, cursor, label);
    return;
  }
  if (character === '{') {
    parseStrictObject(raw, cursor, label);
    return;
  }
  if (character === '[') {
    cursor.value += 1;
    skipWhitespace(raw, cursor);
    if (raw[cursor.value] === ']') {
      cursor.value += 1;
      return;
    }
    while (cursor.value < raw.length) {
      parseStrictValue(raw, cursor, label);
      skipWhitespace(raw, cursor);
      if (raw[cursor.value] === ']') {
        cursor.value += 1;
        return;
      }
      if (raw[cursor.value] !== ',') reject(`${label} JSON array is malformed`);
      cursor.value += 1;
    }
    reject(`${label} JSON array is unterminated`);
  }
  const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(cursor.value));
  if (!token) reject(`${label} JSON value is malformed`);
  cursor.value += token[0].length;
}

function parseStrictObject(raw: string, cursor: { value: number }, label: string): void {
  cursor.value += 1;
  const keys = new Set<string>();
  skipWhitespace(raw, cursor);
  if (raw[cursor.value] === '}') {
    cursor.value += 1;
    return;
  }
  while (cursor.value < raw.length) {
    skipWhitespace(raw, cursor);
    const key = parseString(raw, cursor, label);
    if (keys.has(key)) reject(`${label} contains duplicate JSON object key ${key}`);
    keys.add(key);
    skipWhitespace(raw, cursor);
    if (raw[cursor.value] !== ':') reject(`${label} JSON object is malformed`);
    cursor.value += 1;
    parseStrictValue(raw, cursor, label);
    skipWhitespace(raw, cursor);
    if (raw[cursor.value] === '}') {
      cursor.value += 1;
      return;
    }
    if (raw[cursor.value] !== ',') reject(`${label} JSON object is malformed`);
    cursor.value += 1;
  }
  reject(`${label} JSON object is unterminated`);
}

function strictJson(raw: string, label: string): unknown {
  const cursor = { value: 0 };
  parseStrictValue(raw, cursor, label);
  skipWhitespace(raw, cursor);
  if (cursor.value !== raw.length) reject(`${label} contains trailing JSON data`);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return reject(`${label} is not valid UTF-8 JSON text`);
  }
}

function generationParts(generationId: string, path: string): { date: string; revision: number; prefix: string } {
  const match = GENERATION_ID.exec(generationId);
  if (!match) reject(`${path} is not a canonical generation ID`);
  return {
    date: dateValue(match[1], `${path}.date`),
    revision: Number(match[2]),
    prefix: match[3],
  };
}

export function validateGenerationHeadV3(value: unknown, path = 'generation_head'): GenerationHeadV3 {
  const obj = record(value, path);
  exactKeys(obj, [
    'generation_id',
    'generation_revision',
    'generation_digest',
    'manifest_sha256',
    'observation_date',
    'observation_state',
    'manifest_url',
  ], [], path);
  const generationId = text(obj.generation_id, `${path}.generation_id`);
  const generationRevision = integer(obj.generation_revision, `${path}.generation_revision`, 1, 9999);
  const generationDigest = digest(obj.generation_digest, `${path}.generation_digest`);
  const observationDate = dateValue(obj.observation_date, `${path}.observation_date`);
  const manifestSha = digest(obj.manifest_sha256, `${path}.manifest_sha256`);
  const parts = generationParts(generationId, `${path}.generation_id`);
  if (parts.date !== observationDate || parts.revision !== generationRevision || parts.prefix !== generationDigest.slice(0, 12)) {
    reject(`${path} identity fields do not reconcile`);
  }
  return deepFreeze({
    generation_id: generationId,
    generation_revision: generationRevision,
    generation_digest: generationDigest,
    manifest_sha256: manifestSha,
    observation_date: observationDate,
    observation_state: enumValue(obj.observation_state, ['complete', 'partial'], `${path}.observation_state`),
    manifest_url: releaseUrl(
      obj.manifest_url,
      manifestSha,
      `${path}.manifest_url`,
      [
        `/yanniedog/AR-local/releases/download/app-payload-gen/${manifestSha}.json`,
        `/yanniedog/AR-local/releases/download/app-payload-v3-candidate-${generationId}/${manifestSha}.json`,
      ],
    ),
  });
}

function headCoordinate(head: GenerationHeadV3): [string, number] {
  return [head.observation_date, head.generation_revision];
}

function compareCoordinate(left: GenerationHeadV3, right: GenerationHeadV3): number {
  const leftCoordinate = headCoordinate(left);
  const rightCoordinate = headCoordinate(right);
  return leftCoordinate[0].localeCompare(rightCoordinate[0]) || leftCoordinate[1] - rightCoordinate[1];
}

export function validateGenerationPointerV3(value: unknown): GenerationPointerV3 {
  const obj = record(value, 'pointer');
  exactKeys(obj, ['schema_version', 'generated_at', 'contract_sha256', 'latest_observation', 'latest_complete'], [], 'pointer');
  if (obj.schema_version !== 3) reject('pointer.schema_version must be 3');
  const contractSha = digest(obj.contract_sha256, 'pointer.contract_sha256');
  if (contractSha !== V3_CONTRACT_SCHEMA_SET_SHA256) reject('pointer.contract_sha256 does not match the vendored AR-local contract set');
  const latestObservation = validateGenerationHeadV3(obj.latest_observation, 'pointer.latest_observation');
  const latestComplete = validateGenerationHeadV3(obj.latest_complete, 'pointer.latest_complete');
  if (latestComplete.observation_state !== 'complete') reject('pointer.latest_complete must reference a complete observation');
  const coordinateOrder = compareCoordinate(latestObservation, latestComplete);
  if (coordinateOrder < 0) reject('pointer.latest_observation cannot predate latest_complete');
  if (coordinateOrder === 0 && !sameCanonicalValue(latestObservation, latestComplete)) {
    reject('pointer equal-coordinate generation heads must be byte-equivalent');
  }
  return deepFreeze({
    schema_version: 3,
    generated_at: instant(obj.generated_at, 'pointer.generated_at'),
    contract_sha256: contractSha,
    latest_observation: latestObservation,
    latest_complete: latestComplete as GenerationPointerV3['latest_complete'],
  });
}

export function validateGenerationPointerTextV3(raw: string): GenerationPointerV3 {
  if (utf8ByteLength(raw) > V3_POINTER_LIMIT_BYTES) reject('pointer exceeds the 64 KiB contract cap');
  return validateGenerationPointerV3(strictJson(raw, 'pointer'));
}

function countMap(value: unknown, path: string, options: { providerKeys?: boolean; minimum?: number } = {}): Record<string, number> {
  const obj = record(value, path);
  const result = Object.create(null) as Record<string, number>;
  for (const [key, rawCount] of Object.entries(obj)) {
    if (options.providerKeys && !PROVIDER_ID.test(key)) reject(`${path}.${key} is not a canonical provider identity`);
    result[key] = integer(rawCount, `${path}.${key}`, options.minimum ?? 0);
  }
  return result;
}

export function validateCoverageV2(value: unknown): CoverageV2 {
  const obj = record(value, 'manifest.coverage');
  const countKeys = [
    'products_discovered',
    'products_priced',
    'products_consumer_eligible',
    'rate_tiers_eligible',
    'providers_registered',
    'providers_attempted',
    'providers_responded',
    'providers_complete',
    'providers_empty',
    'providers_partial',
    'providers_failed',
    'providers_not_attempted',
    'register_sources_attempted',
    'register_sources_complete',
    'failure_records',
    'corrupt_failure_records',
  ] as const;
  exactKeys(obj, [
    ...countKeys,
    'register_provenance_complete',
    'failure_records_by_provider',
    'exclusions_by_reason',
    'failure_provenance_complete',
    'reconciliation_status',
  ], [], 'manifest.coverage');
  const counts = Object.fromEntries(countKeys.map((key) => [
    key,
    integer(obj[key], `manifest.coverage.${key}`, key === 'register_sources_attempted' ? 1 : 0),
  ])) as unknown as Pick<CoverageV2, typeof countKeys[number]>;
  const failureRecordsByProvider = countMap(
    obj.failure_records_by_provider,
    'manifest.coverage.failure_records_by_provider',
    { providerKeys: true, minimum: 1 },
  );
  const exclusions = countMap(obj.exclusions_by_reason, 'manifest.coverage.exclusions_by_reason');
  const coverage: CoverageV2 = {
    ...counts,
    register_provenance_complete: booleanValue(obj.register_provenance_complete, 'manifest.coverage.register_provenance_complete'),
    failure_records_by_provider: failureRecordsByProvider,
    exclusions_by_reason: exclusions,
    failure_provenance_complete: booleanValue(obj.failure_provenance_complete, 'manifest.coverage.failure_provenance_complete'),
    reconciliation_status: enumValue(obj.reconciliation_status, ['reconciled', 'partial', 'failed'], 'manifest.coverage.reconciliation_status'),
  };
  const responded = coverage.providers_complete + coverage.providers_empty + coverage.providers_partial;
  const attempted = responded + coverage.providers_failed;
  const registered = attempted + coverage.providers_not_attempted;
  if (coverage.providers_responded !== responded || coverage.providers_attempted !== attempted || coverage.providers_registered !== registered) {
    reject('manifest.coverage provider populations do not reconcile');
  }
  if (!(coverage.products_consumer_eligible <= coverage.products_priced && coverage.products_priced <= coverage.products_discovered)) {
    reject('manifest.coverage requires consumer-eligible <= priced <= discovered');
  }
  const excluded = Object.values(exclusions).reduce((sum, count) => sum + count, 0);
  if (coverage.products_consumer_eligible + excluded !== coverage.products_discovered) {
    reject('manifest.coverage eligible products plus exclusions must equal discovered products');
  }
  if (Object.keys(failureRecordsByProvider).length !== coverage.providers_failed) {
    reject('manifest.coverage requires attributable evidence for every failed provider');
  }
  if (Object.values(failureRecordsByProvider).reduce((sum, count) => sum + count, 0) !== coverage.failure_records) {
    reject('manifest.coverage provider failure evidence does not reconcile to failure_records');
  }
  if (coverage.register_sources_complete > coverage.register_sources_attempted) {
    reject('manifest.coverage complete register sources exceed attempted sources');
  }
  if (coverage.register_provenance_complete && coverage.register_sources_complete !== coverage.register_sources_attempted) {
    reject('manifest.coverage complete register provenance requires every configured source');
  }
  if (coverage.reconciliation_status === 'reconciled' && (!coverage.failure_provenance_complete || coverage.corrupt_failure_records > 0)) {
    reject('manifest.coverage reconciled status requires complete, uncorrupted failure provenance');
  }
  return deepFreeze(coverage);
}

export function validateAssetDescriptorV3(value: unknown, generationId: string): AssetDescriptorV3 {
  const obj = record(value, 'manifest.capabilities.core');
  exactKeys(obj, [
    'schema_id',
    'media_type',
    'encoding',
    'compressed_bytes',
    'uncompressed_bytes',
    'sha256',
    'url',
    'cohort',
    'capability',
  ], [], 'manifest.capabilities.core');
  if (obj.schema_id !== 'https://australianrates.app/contracts/v3/canonical-core-v3.schema.json') {
    reject('manifest.capabilities.core.schema_id is unsupported');
  }
  if (obj.media_type !== 'application/json' || obj.cohort !== 'confirmed-consumer-products' || obj.capability !== 'core') {
    reject('manifest.capabilities.core media type, cohort, and capability are fixed');
  }
  const compressedBytes = integer(obj.compressed_bytes, 'manifest.capabilities.core.compressed_bytes', 1, V3_ASSET_LIMITS.core.compressed);
  const uncompressedBytes = integer(obj.uncompressed_bytes, 'manifest.capabilities.core.uncompressed_bytes', 1, V3_ASSET_LIMITS.core.inflated);
  const encoding = enumValue(obj.encoding, ['gzip', 'identity'], 'manifest.capabilities.core.encoding');
  if (encoding === 'identity' && compressedBytes !== uncompressedBytes) {
    reject('manifest.capabilities.core identity byte counts must match');
  }
  const sha = digest(obj.sha256, 'manifest.capabilities.core.sha256');
  return deepFreeze({
    schema_id: 'https://australianrates.app/contracts/v3/canonical-core-v3.schema.json',
    media_type: 'application/json',
    encoding,
    compressed_bytes: compressedBytes,
    uncompressed_bytes: uncompressedBytes,
    sha256: sha,
    url: releaseUrl(
      obj.url,
      sha,
      'manifest.capabilities.core.url',
      [
        `/yanniedog/AR-local/releases/download/app-payload-gen/${sha}.${encoding === 'gzip' ? 'json.gz' : 'json'}`,
        `/yanniedog/AR-local/releases/download/app-payload-v3-candidate-${generationId}/${sha}.${encoding === 'gzip' ? 'json.gz' : 'json'}`,
      ],
    ),
    cohort: 'confirmed-consumer-products',
    capability: 'core',
  });
}

function manifestDigest(manifest: GenerationManifestV3): string {
  const material = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'generation_id' && key !== 'generation_digest'),
  );
  return canonicalSha256(material);
}

export function validateGenerationManifestV3(value: unknown, expectedHead?: GenerationHeadV3): GenerationManifestV3 {
  const obj = record(value, 'manifest');
  exactKeys(obj, [
    'schema_version',
    'generation_id',
    'generation_revision',
    'generation_digest',
    'observation_date',
    'observed_at',
    'observation_state',
    'ledger_state',
    'normalization_version',
    'producer_commit',
    'coverage',
    'prior_ledger_digest',
    'ledger_event_digest',
    'capabilities',
  ], [], 'manifest');
  if (obj.schema_version !== 3 || obj.ledger_state !== 'finalized') reject('manifest must be schema v3 and finalized');
  const capabilities = record(obj.capabilities, 'manifest.capabilities');
  exactKeys(capabilities, ['core'], [], 'manifest.capabilities');
  const generationId = text(obj.generation_id, 'manifest.generation_id');
  const manifest: GenerationManifestV3 = {
    schema_version: 3,
    generation_id: generationId,
    generation_revision: integer(obj.generation_revision, 'manifest.generation_revision', 1, 9999),
    generation_digest: digest(obj.generation_digest, 'manifest.generation_digest'),
    observation_date: dateValue(obj.observation_date, 'manifest.observation_date'),
    observed_at: instant(obj.observed_at, 'manifest.observed_at'),
    observation_state: enumValue(obj.observation_state, ['complete', 'partial'], 'manifest.observation_state'),
    ledger_state: 'finalized',
    normalization_version: text(obj.normalization_version, 'manifest.normalization_version'),
    producer_commit: sha1Commit(obj.producer_commit, 'manifest.producer_commit'),
    coverage: validateCoverageV2(obj.coverage),
    prior_ledger_digest: obj.prior_ledger_digest === null ? null : digest(obj.prior_ledger_digest, 'manifest.prior_ledger_digest'),
    ledger_event_digest: digest(obj.ledger_event_digest, 'manifest.ledger_event_digest'),
    capabilities: { core: validateAssetDescriptorV3(capabilities.core, generationId) },
  };
  const parts = generationParts(manifest.generation_id, 'manifest.generation_id');
  const expectedDigest = manifestDigest(manifest);
  if (
    parts.date !== manifest.observation_date ||
    parts.revision !== manifest.generation_revision ||
    parts.prefix !== expectedDigest.slice(0, 12) ||
    manifest.generation_digest !== expectedDigest
  ) {
    reject('manifest generation identity does not match its canonical content');
  }
  if (manifest.observation_state === 'complete') {
    const coverage = manifest.coverage;
    if (
      coverage.providers_partial ||
      coverage.providers_failed ||
      coverage.providers_not_attempted ||
      coverage.corrupt_failure_records ||
      !coverage.register_provenance_complete
    ) {
      reject('manifest complete observation contains incomplete coverage');
    }
  }
  if (manifest.coverage.reconciliation_status !== 'reconciled') {
    reject('manifest publication requires reconciled coverage');
  }
  if (expectedHead) {
    for (const key of ['generation_id', 'generation_revision', 'generation_digest', 'observation_date', 'observation_state'] as const) {
      if (manifest[key] !== expectedHead[key]) reject(`manifest.${key} disagrees with its pointer head`);
    }
  }
  return deepFreeze(manifest);
}

export function validateGenerationManifestTextV3(raw: string, expectedHead: GenerationHeadV3): GenerationManifestV3 {
  const byteLength = utf8ByteLength(raw);
  if (byteLength < 1 || byteLength > V3_MANIFEST_LIMIT_BYTES) reject('generation manifest exceeds the 64 KiB contract cap');
  if (sha256Utf8(raw) !== expectedHead.manifest_sha256) reject('generation manifest byte SHA-256 does not match its pointer head');
  return validateGenerationManifestV3(strictJson(raw, 'generation manifest'), expectedHead);
}

export function validateCorePayloadTextV3(raw: string, manifest: GenerationManifestV3) {
  if (utf8ByteLength(raw) !== manifest.capabilities.core.uncompressed_bytes) {
    reject('core capability inflated byte count does not match its manifest descriptor');
  }
  return validateCorePayloadV3(strictJson(raw, 'core capability'), manifest);
}

export function canonicalSchemaSetSha256(schemas: Record<string, unknown>): string {
  return canonicalSha256(schemas);
}

export function canonicalGenerationManifestDigest(manifest: GenerationManifestV3): string {
  return manifestDigest(manifest);
}

export function canonicalJsonForContract(value: unknown): string {
  return stableStringify(value);
}

export function validateEvidenceUrlForDisplay(value: unknown): string {
  return httpsUrl(value, 'evidence URL');
}
