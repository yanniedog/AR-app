import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';

import { SECTION_KEYS, type CorePayload, type Ribbon, type SectionKey } from '../../types';
import type {
  AssetDescriptorV3,
  CapabilityV3,
  CanonicalRateRowV3,
  CorePayloadV3,
  GenerationHeadV3,
  GenerationManifestV3,
  GenerationPointerV3,
} from './types';

const HEX_256 = /^[0-9a-f]{64}$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const CAPABILITIES = new Set<CapabilityV3>([
  'core',
  'facets',
  'search',
  'details-index',
  'details-shard',
  'history-summary',
  'bank-response',
  'spread',
  'rba',
  'product-history',
  'economy',
]);

const MIB = 1024 * 1024;
export const V3_POINTER_LIMIT_BYTES = 64 * 1024;
export const V3_MANIFEST_LIMIT_BYTES = 64 * 1024;
export const V3_ASSET_LIMITS: Readonly<Record<CapabilityV3, {
  compressed: number;
  inflated: number;
}>> = {
  core: { compressed: 2 * MIB, inflated: 16 * MIB },
  facets: { compressed: 4 * MIB, inflated: 32 * MIB },
  search: { compressed: 8 * MIB, inflated: 64 * MIB },
  'details-index': { compressed: 2 * MIB, inflated: 16 * MIB },
  'details-shard': { compressed: 4 * MIB, inflated: 32 * MIB },
  'history-summary': { compressed: 8 * MIB, inflated: 64 * MIB },
  'bank-response': { compressed: 16 * MIB, inflated: 128 * MIB },
  spread: { compressed: 8 * MIB, inflated: 64 * MIB },
  rba: { compressed: 1 * MIB, inflated: 4 * MIB },
  'product-history': { compressed: 32 * MIB, inflated: 256 * MIB },
  economy: { compressed: 2 * MIB, inflated: 16 * MIB },
};

export const V3_CAPABILITY_SCHEMA_IDS: Readonly<Record<CapabilityV3, string>> = {
  core: 'https://australianrates.app/schemas/core-v3.json',
  facets: 'https://australianrates.app/schemas/facets-v3.json',
  search: 'https://australianrates.app/schemas/search-v3.json',
  'details-index': 'https://australianrates.app/schemas/details-index-v3.json',
  'details-shard': 'https://australianrates.app/schemas/details-shard-v3.json',
  'history-summary': 'https://australianrates.app/schemas/history-summary-v3.json',
  'bank-response': 'https://australianrates.app/schemas/bank-response-v3.json',
  spread: 'https://australianrates.app/schemas/spread-v3.json',
  rba: 'https://australianrates.app/schemas/rba-v3.json',
  'product-history': 'https://australianrates.app/schemas/product-history-v3.json',
  economy: 'https://australianrates.app/schemas/economy-v3.json',
};

export class V3ContractError extends Error {
  constructor(message: string) {
    super(`v3 contract rejected: ${message}`);
    this.name = 'V3ContractError';
  }
}

export type OptionalAssetValidatorV3 = (
  value: Readonly<Record<string, unknown>>,
  descriptor: AssetDescriptorV3,
  manifest: GenerationManifestV3,
) => void;

export type OptionalAssetValidatorsV3 = Partial<
  Record<Exclude<CapabilityV3, 'core'>, OptionalAssetValidatorV3>
>;

function reject(message: string): never {
  throw new V3ContractError(message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) if (!(key in value)) reject(`${path}.${key} is required`);
  for (const key of Object.keys(value)) if (!allowed.has(key)) reject(`${path}.${key} is not allowed`);
}

function text(value: unknown, path: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) reject(`${path} must be a non-empty string`);
  return value;
}

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) reject(`${path} must be a non-negative safe integer`);
  return value as number;
}

function digest(value: unknown, path: string): string {
  if (typeof value !== 'string' || !HEX_256.test(value)) reject(`${path} must be a lowercase SHA-256`);
  return value;
}

export function sha256Utf8(value: string): string {
  return Array.from(sha256(utf8ToBytes(value)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function utf8ByteLength(value: string): number {
  return utf8ToBytes(value).byteLength;
}

function date(value: unknown, path: string): string {
  if (typeof value !== 'string' || !YMD.test(value)) reject(`${path} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) reject(`${path} is not a calendar date`);
  return value;
}

function instant(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/T/.test(value) || !Number.isFinite(Date.parse(value))) reject(`${path} must be an ISO date-time`);
  return value;
}

function httpsUrl(value: unknown, path: string): string {
  const raw = text(value, path, 2048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return reject(`${path} must be an absolute URL`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
    reject(`${path} must be credential-free HTTPS`);
  }
  return parsed.toString();
}

function enumValue<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    reject(`${path} must be one of ${values.join(', ')}`);
  }
  return value as T;
}

export function v3AssetCacheKey(asset: AssetDescriptorV3): string {
  return asset.capability === 'details-shard'
    ? `${asset.capability}:${asset.cohort}`
    : asset.capability;
}

export function validateOptionalAssetTextV3(
  raw: string,
  descriptor: AssetDescriptorV3,
  manifest: GenerationManifestV3,
  validator: OptionalAssetValidatorV3,
): Readonly<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return reject(`${descriptor.capability} is not valid JSON`);
  }
  const obj = record(value, descriptor.capability);
  if (obj.schema_id !== descriptor.schema_id) {
    reject(`${descriptor.capability} schema_id does not match its descriptor`);
  }
  if (obj.schema_version !== 3) {
    reject(`${descriptor.capability} schema_version must be 3`);
  }
  if (obj.generation_digest !== manifest.generation_digest) {
    reject(`${descriptor.capability} generation_digest does not match its manifest`);
  }
  validator(obj, descriptor, manifest);
  return obj;
}

export function validateGenerationHeadV3(
  value: unknown,
  path = 'generation_head',
): GenerationHeadV3 {
  const obj = record(value, path);
  exactKeys(
    obj,
    ['generation_id', 'generation_digest', 'run_date', 'observation_state', 'manifest_url', 'manifest_sha256', 'manifest_bytes'],
    [],
    path,
  );
  const manifestBytes = integer(obj.manifest_bytes, `${path}.manifest_bytes`);
  if (manifestBytes < 1 || manifestBytes > V3_MANIFEST_LIMIT_BYTES) reject(`${path}.manifest_bytes exceeds the manifest cap`);
  return {
    generation_id: text(obj.generation_id, `${path}.generation_id`, 160),
    generation_digest: digest(obj.generation_digest, `${path}.generation_digest`),
    run_date: date(obj.run_date, `${path}.run_date`),
    observation_state: enumValue(obj.observation_state, ['complete', 'partial', 'failed'], `${path}.observation_state`),
    manifest_url: httpsUrl(obj.manifest_url, `${path}.manifest_url`),
    manifest_sha256: digest(obj.manifest_sha256, `${path}.manifest_sha256`),
    manifest_bytes: manifestBytes,
  };
}

export function validateGenerationPointerV3(value: unknown): GenerationPointerV3 {
  const obj = record(value, 'pointer');
  exactKeys(obj, ['schema_id', 'schema_version', 'generated_at', 'latest_observation', 'latest_complete'], [], 'pointer');
  if (obj.schema_id !== 'https://australianrates.app/schemas/manifest-v3.json') reject('pointer.schema_id is unsupported');
  if (obj.schema_version !== 3) reject('pointer.schema_version must be 3');
  const latestObservation = validateGenerationHeadV3(obj.latest_observation, 'pointer.latest_observation');
  const latestComplete = validateGenerationHeadV3(obj.latest_complete, 'pointer.latest_complete');
  if (latestComplete.observation_state !== 'complete') reject('latest_complete must reference a complete observation');
  if (latestComplete.run_date > latestObservation.run_date) reject('latest_complete cannot be newer than latest_observation');
  return {
    schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
    schema_version: 3,
    generated_at: instant(obj.generated_at, 'pointer.generated_at'),
    latest_observation: latestObservation,
    latest_complete: latestComplete,
  };
}

function validateCoverage(value: unknown): GenerationManifestV3['coverage'] {
  const obj = record(value, 'manifest.coverage');
  const numeric = [
    'discovered_products', 'priced_products', 'consumer_eligible_products', 'eligible_rate_tiers',
    'providers_registered', 'providers_attempted', 'providers_complete', 'providers_partial', 'providers_failed',
  ] as const;
  exactKeys(obj, ['reconciliation_status', ...numeric, 'exclusions_by_reason'], [], 'manifest.coverage');
  const counts = Object.fromEntries(numeric.map((key) => [key, integer(obj[key], `manifest.coverage.${key}`)])) as unknown as Omit<GenerationManifestV3['coverage'], 'reconciliation_status' | 'exclusions_by_reason'>;
  const exclusionsRaw = record(obj.exclusions_by_reason, 'manifest.coverage.exclusions_by_reason');
  const exclusions: Record<string, number> = {};
  for (const [key, count] of Object.entries(exclusionsRaw)) exclusions[text(key, 'exclusion reason', 160)] = integer(count, `manifest.coverage.exclusions_by_reason.${key}`);
  const reconciliation = enumValue(obj.reconciliation_status, ['reconciled', 'unreconciled'], 'manifest.coverage.reconciliation_status');
  if (counts.priced_products > counts.discovered_products) reject('priced_products cannot exceed discovered_products');
  if (counts.consumer_eligible_products > counts.priced_products) reject('consumer_eligible_products cannot exceed priced_products');
  if (counts.providers_attempted > counts.providers_registered) reject('providers_attempted cannot exceed providers_registered');
  if (reconciliation === 'reconciled' && counts.providers_complete + counts.providers_partial + counts.providers_failed !== counts.providers_attempted) {
    reject('provider outcome populations do not reconcile to providers_attempted');
  }
  return { reconciliation_status: reconciliation, ...counts, exclusions_by_reason: exclusions };
}

function assetDescriptor(value: unknown, index: number): AssetDescriptorV3 {
  const path = `manifest.assets[${index}]`;
  const obj = record(value, path);
  exactKeys(obj, ['capability', 'schema_id', 'media_type', 'encoding', 'compressed_bytes', 'uncompressed_bytes', 'sha256', 'url', 'required'], ['cohort', 'base_generation_digest'], path);
  const capability = enumValue(obj.capability, [...CAPABILITIES], `${path}.capability`);
  const limits = V3_ASSET_LIMITS[capability];
  const compressed = integer(obj.compressed_bytes, `${path}.compressed_bytes`);
  const inflated = integer(obj.uncompressed_bytes, `${path}.uncompressed_bytes`);
  if (compressed < 1 || compressed > limits.compressed) reject(`${path}.compressed_bytes exceeds ${capability} cap`);
  if (inflated < 1 || inflated > limits.inflated) reject(`${path}.uncompressed_bytes exceeds ${capability} cap`);
  if (obj.media_type !== 'application/json') reject(`${path}.media_type must be application/json`);
  if (typeof obj.required !== 'boolean') reject(`${path}.required must be boolean`);
  const schemaId = httpsUrl(obj.schema_id, `${path}.schema_id`);
  if (schemaId !== V3_CAPABILITY_SCHEMA_IDS[capability]) {
    reject(`${path}.schema_id is unsupported for ${capability}`);
  }
  const cohort = obj.cohort === undefined ? undefined : text(obj.cohort, `${path}.cohort`, 160);
  if (capability === 'details-shard' && !cohort) reject(`${path}.cohort is required for details-shard`);
  if (capability !== 'details-shard' && cohort !== undefined) reject(`${path}.cohort is valid only for details-shard`);
  return {
    capability,
    schema_id: schemaId,
    media_type: 'application/json',
    encoding: enumValue(obj.encoding, ['gzip', 'identity'], `${path}.encoding`),
    compressed_bytes: compressed,
    uncompressed_bytes: inflated,
    sha256: digest(obj.sha256, `${path}.sha256`),
    url: httpsUrl(obj.url, `${path}.url`),
    required: obj.required,
    ...(cohort === undefined ? {} : { cohort }),
    ...(obj.base_generation_digest === undefined ? {} : { base_generation_digest: digest(obj.base_generation_digest, `${path}.base_generation_digest`) }),
  };
}

export function validateGenerationManifestV3(
  value: unknown,
  expectedHead?: GenerationHeadV3,
): GenerationManifestV3 {
  const obj = record(value, 'manifest');
  exactKeys(obj, ['schema_id', 'schema_version', 'generation_id', 'generation_digest', 'ledger_digest', 'run_date', 'ledger_state', 'observation_state', 'normalization_version', 'prior_ledger_digest', 'coverage', 'assets'], [], 'manifest');
  if (obj.schema_id !== 'https://australianrates.app/schemas/generation-manifest-v3.json') reject('manifest.schema_id is unsupported');
  if (obj.schema_version !== 3) reject('manifest.schema_version must be 3');
  const generationId = text(obj.generation_id, 'manifest.generation_id', 160);
  const generationDigest = digest(obj.generation_digest, 'manifest.generation_digest');
  const ledgerDigest = digest(obj.ledger_digest, 'manifest.ledger_digest');
  const runDate = date(obj.run_date, 'manifest.run_date');
  const observationState = enumValue(obj.observation_state, ['complete', 'partial', 'failed'], 'manifest.observation_state');
  const ledgerState = enumValue(obj.ledger_state, ['provisional', 'finalized'], 'manifest.ledger_state');
  const coverage = validateCoverage(obj.coverage);
  if (ledgerState !== 'finalized') reject('only finalized generations can be installed');
  if (observationState === 'complete' && coverage.reconciliation_status !== 'reconciled') reject('complete observations require reconciled coverage');
  if (!Array.isArray(obj.assets)) reject('manifest.assets must be an array');
  const assets = obj.assets.map(assetDescriptor);
  const cores = assets.filter((asset) => asset.capability === 'core');
  if (cores.length !== 1 || !cores[0].required) reject('manifest must contain exactly one required core asset');
  if (cores[0].schema_id !== 'https://australianrates.app/schemas/core-v3.json') reject('core asset schema_id is unsupported');
  const identities = new Set<string>();
  const singletonCapabilities = new Set<CapabilityV3>();
  for (const asset of assets) {
    const identity = `${asset.capability}\u0000${asset.cohort ?? ''}`;
    if (identities.has(identity)) reject(`duplicate asset descriptor for ${asset.capability}`);
    identities.add(identity);
    if (asset.capability !== 'details-shard') {
      if (singletonCapabilities.has(asset.capability)) reject(`manifest contains multiple ${asset.capability} assets`);
      singletonCapabilities.add(asset.capability);
    }
  }
  if (expectedHead) {
    if (generationId !== expectedHead.generation_id || generationDigest !== expectedHead.generation_digest || runDate !== expectedHead.run_date || observationState !== expectedHead.observation_state) {
      reject('manifest identity does not match pointer head');
    }
  }
  return {
    schema_id: 'https://australianrates.app/schemas/generation-manifest-v3.json',
    schema_version: 3,
    generation_id: generationId,
    generation_digest: generationDigest,
    ledger_digest: ledgerDigest,
    run_date: runDate,
    ledger_state: ledgerState,
    observation_state: observationState,
    normalization_version: text(obj.normalization_version, 'manifest.normalization_version', 120),
    prior_ledger_digest: obj.prior_ledger_digest === null ? null : digest(obj.prior_ledger_digest, 'manifest.prior_ledger_digest'),
    coverage,
    assets,
  };
}

export function validateGenerationManifestTextV3(
  raw: string,
  expectedHead: GenerationHeadV3,
): GenerationManifestV3 {
  if (utf8ByteLength(raw) !== expectedHead.manifest_bytes) {
    reject('generation manifest UTF-8 byte length does not match pointer head');
  }
  if (sha256Utf8(raw) !== expectedHead.manifest_sha256) {
    reject('generation manifest SHA-256 does not match pointer head');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return reject('generation manifest is not valid JSON');
  }
  return validateGenerationManifestV3(value, expectedHead);
}

function finiteFraction(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1) reject(`${path} must be a finite fraction_per_annum between 0 and 1`);
  return value;
}

function legacyRateIndex(rateUid: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < rateUid.length; index += 1) {
    hash ^= rateUid.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function validateCanonicalRate(value: unknown, section: SectionKey, index: number): CanonicalRateRowV3 {
  const path = `core.sections.${section}.rates[${index}]`;
  const obj = record(value, path);
  exactKeys(
    obj,
    ['provider', 'provider_uid', 'product_uid', 'rate_uid', 'product_name', 'classification', 'typed_rate', 'evidence'],
    ['legacy_product_key', 'comparison_rate', 'mortgage_rate_type', 'fixed_term_months'],
    path,
  );
  const classification = record(obj.classification, `${path}.classification`);
  exactKeys(classification, ['product_kind', 'consumer_section', 'status', 'basis', 'version'], [], `${path}.classification`);
  const expectedKind = section === 'Mortgage' ? 'mortgage' : section === 'Savings' ? 'savings' : 'term_deposit';
  if (classification.consumer_section !== section || classification.product_kind !== expectedKind || classification.status !== 'confirmed') {
    reject(`${path}.classification conflicts with its section`);
  }
  const typedRate = record(obj.typed_rate, `${path}.typed_rate`);
  exactKeys(typedRate, ['value', 'unit', 'metric', 'evidence_status'], [], `${path}.typed_rate`);
  if (typedRate.unit !== 'fraction_per_annum' || typedRate.evidence_status !== 'published') reject(`${path}.typed_rate has unsupported unit or evidence status`);
  const metric = enumValue(
    typedRate.metric,
    ['advertised', 'base', 'conditional', 'introductory', 'reversion'],
    `${path}.typed_rate.metric`,
  );
  if (section === 'Mortgage' && metric !== 'advertised') reject(`${path}.typed_rate must be advertised for a mortgage`);
  if (section !== 'Mortgage' && metric === 'advertised') reject(`${path}.typed_rate must declare deposit rate semantics`);
  let mortgageRateType: CanonicalRateRowV3['mortgage_rate_type'];
  let fixedTermMonths: number | undefined;
  if (section === 'Mortgage') {
    mortgageRateType = enumValue(obj.mortgage_rate_type, ['fixed', 'variable'] as const, `${path}.mortgage_rate_type`);
    if (mortgageRateType === 'fixed') {
      fixedTermMonths = integer(obj.fixed_term_months, `${path}.fixed_term_months`);
      if (fixedTermMonths < 1 || fixedTermMonths > 360) reject(`${path}.fixed_term_months must be between 1 and 360`);
    } else if (obj.fixed_term_months !== undefined) {
      reject(`${path}.fixed_term_months is valid only for fixed mortgages`);
    }
  } else if (obj.mortgage_rate_type !== undefined || obj.fixed_term_months !== undefined) {
    reject(`${path} deposit rows must not carry mortgage rate semantics`);
  }
  let comparisonRate: CanonicalRateRowV3['comparison_rate'];
  if (obj.comparison_rate !== undefined) {
    if (section !== 'Mortgage') reject(`${path}.comparison_rate is valid only for mortgages`);
    const comparison = record(obj.comparison_rate, `${path}.comparison_rate`);
    exactKeys(comparison, ['value', 'unit', 'metric', 'evidence_status'], [], `${path}.comparison_rate`);
    if (
      comparison.unit !== 'fraction_per_annum' ||
      comparison.metric !== 'comparison' ||
      comparison.evidence_status !== 'published'
    ) reject(`${path}.comparison_rate has unsupported semantics`);
    comparisonRate = {
      value: finiteFraction(comparison.value, `${path}.comparison_rate.value`),
      unit: 'fraction_per_annum',
      metric: 'comparison',
      evidence_status: 'published',
    };
  }
  const evidence = record(obj.evidence, `${path}.evidence`);
  exactKeys(evidence, ['availability', 'broadly_applicable', 'pricing_status', 'fee_disclosure_status', 'eligibility_disclosure_status', 'source_url', 'observed_at', 'effective_date'], [], `${path}.evidence`);
  if (typeof evidence.broadly_applicable !== 'boolean') reject(`${path}.evidence.broadly_applicable must be boolean`);
  return {
    provider: text(obj.provider, `${path}.provider`, 300),
    provider_uid: text(obj.provider_uid, `${path}.provider_uid`, 300),
    product_uid: text(obj.product_uid, `${path}.product_uid`, 500),
    rate_uid: text(obj.rate_uid, `${path}.rate_uid`, 500),
    product_name: text(obj.product_name, `${path}.product_name`, 500),
    ...(obj.legacy_product_key === undefined ? {} : { legacy_product_key: text(obj.legacy_product_key, `${path}.legacy_product_key`, 500) }),
    classification: {
      product_kind: expectedKind,
      consumer_section: section,
      status: 'confirmed',
      basis: text(classification.basis, `${path}.classification.basis`, 1000),
      version: text(classification.version, `${path}.classification.version`, 120),
    },
    typed_rate: {
      value: finiteFraction(typedRate.value, `${path}.typed_rate.value`),
      unit: 'fraction_per_annum',
      metric,
      evidence_status: 'published',
    },
    ...(comparisonRate ? { comparison_rate: comparisonRate } : {}),
    ...(mortgageRateType ? { mortgage_rate_type: mortgageRateType } : {}),
    ...(fixedTermMonths === undefined ? {} : { fixed_term_months: fixedTermMonths }),
    evidence: {
      availability: enumValue(evidence.availability, ['public', 'restricted', 'unknown'], `${path}.evidence.availability`),
      broadly_applicable: evidence.broadly_applicable,
      pricing_status: enumValue(evidence.pricing_status, ['published', 'partial', 'unknown'], `${path}.evidence.pricing_status`),
      fee_disclosure_status: enumValue(evidence.fee_disclosure_status, ['complete', 'partial', 'unknown'], `${path}.evidence.fee_disclosure_status`),
      eligibility_disclosure_status: enumValue(evidence.eligibility_disclosure_status, ['complete', 'partial', 'unknown'], `${path}.evidence.eligibility_disclosure_status`),
      source_url: httpsUrl(evidence.source_url, `${path}.evidence.source_url`),
      observed_at: instant(evidence.observed_at, `${path}.evidence.observed_at`),
      effective_date: evidence.effective_date === null ? null : date(evidence.effective_date, `${path}.evidence.effective_date`),
    },
  };
}

function expectedStats(values: readonly number[]) {
  if (!values.length) return { min: null, max: null, mean: null, median: null };
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return {
    min: sorted[0],
    max: sorted.at(-1)!,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
  };
}

function validateStats(
  value: unknown,
  expected: ReturnType<typeof expectedStats>,
  path: string,
): Ribbon['range'] {
  const obj = record(value, path);
  exactKeys(obj, ['min', 'max', 'mean', 'median'], [], path);
  for (const key of ['min', 'max', 'mean', 'median'] as const) {
    const actual = obj[key];
    const wanted = expected[key];
    if (wanted === null) {
      if (actual !== null) reject(`${path}.${key} must be null for an empty population`);
    } else if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - wanted) > 1e-12) {
      reject(`${path}.${key} does not reconcile to core rows`);
    }
  }
  return expected;
}

function validateRibbon(value: unknown, rows: readonly CanonicalRateRowV3[], path: string): Ribbon {
  const obj = record(value, path);
  exactKeys(obj, ['counts', 'range', 'providers'], [], path);
  const counts = record(obj.counts, `${path}.counts`);
  exactKeys(counts, ['rates', 'products', 'providers'], [], `${path}.counts`);
  if (!Array.isArray(obj.providers)) reject(`${path}.providers must be an array`);
  const rates = rows.map((row) => row.typed_rate.value);
  const products = new Set(rows.map((row) => row.product_uid));
  const providerUids = new Set(rows.map((row) => row.provider_uid));
  if (
    integer(counts.rates, `${path}.counts.rates`) !== rates.length ||
    integer(counts.products, `${path}.counts.products`) !== products.size ||
    integer(counts.providers, `${path}.counts.providers`) !== providerUids.size
  ) reject(`${path}.counts do not reconcile to core rows`);
  const range = validateStats(obj.range, expectedStats(rates), `${path}.range`);

  const byProvider = new Map<string, CanonicalRateRowV3[]>();
  for (const row of rows) {
    const grouped = byProvider.get(row.provider);
    if (grouped) grouped.push(row);
    else byProvider.set(row.provider, [row]);
  }
  if (byProvider.size !== providerUids.size) reject(`${path} has ambiguous provider display identities`);
  if (obj.providers.length !== byProvider.size) reject(`${path}.providers does not reconcile to core rows`);
  const seen = new Set<string>();
  const providers = obj.providers.map((raw, index) => {
    const providerPath = `${path}.providers[${index}]`;
    const provider = record(raw, providerPath);
    exactKeys(provider, ['provider', 'rates', 'products', 'min', 'max', 'mean', 'median'], [], providerPath);
    const providerName = text(provider.provider, `${providerPath}.provider`, 300);
    if (seen.has(providerName)) reject(`${providerPath}.provider is duplicated`);
    seen.add(providerName);
    const providerRows = byProvider.get(providerName);
    if (!providerRows) reject(`${providerPath}.provider is not present in core rows`);
    if (
      integer(provider.rates, `${providerPath}.rates`) !== providerRows.length ||
      integer(provider.products, `${providerPath}.products`) !== new Set(providerRows.map((row) => row.product_uid)).size
    ) reject(`${providerPath} counts do not reconcile to core rows`);
    const stats = validateStats(
      {
        min: provider.min,
        max: provider.max,
        mean: provider.mean,
        median: provider.median,
      },
      expectedStats(providerRows.map((row) => row.typed_rate.value)),
      providerPath,
    );
    return {
      provider: providerName,
      rates: providerRows.length,
      products: new Set(providerRows.map((row) => row.product_uid)).size,
      ...stats,
    };
  });
  if (seen.size !== byProvider.size) {
    reject(`${path}.providers is incomplete`);
  }
  return {
    counts: { rates: rates.length, products: products.size, providers: providerUids.size },
    range,
    providers,
  };
}

export function validateCorePayloadV3(value: unknown, manifest: GenerationManifestV3): CorePayloadV3 {
  const obj = record(value, 'core');
  exactKeys(obj, ['schema_id', 'schema_version', 'generation_id', 'generation_digest', 'run_date', 'sections', 'brands', 'rba'], ['rba_holds', 'coverage'], 'core');
  if (obj.schema_id !== 'https://australianrates.app/schemas/core-v3.json' || obj.schema_version !== 3) reject('core schema is unsupported');
  if (obj.generation_id !== manifest.generation_id || obj.generation_digest !== manifest.generation_digest || obj.run_date !== manifest.run_date) reject('core identity does not match generation manifest');
  const sectionsRaw = record(obj.sections, 'core.sections');
  exactKeys(sectionsRaw, SECTION_KEYS, [], 'core.sections');
  const sections = {} as CorePayloadV3['sections'];
  const rateIds = new Set<string>();
  const productOwners = new Map<string, string>();
  const productSections = new Map<string, SectionKey>();
  const productFactsByUid = new Map<string, string>();
  const effectiveProductOwners = new Map<string, string>();
  const legacyKeyByProduct = new Map<string, string | null>();
  const legacyIndexesByProduct = new Map<string, Map<number, string>>();
  const providerNamesByUid = new Map<string, string>();
  const providerUidsByName = new Map<string, string>();
  for (const section of SECTION_KEYS) {
    const sectionRaw = record(sectionsRaw[section], `core.sections.${section}`);
    exactKeys(sectionRaw, ['rates', 'ribbon'], [], `core.sections.${section}`);
    if (!Array.isArray(sectionRaw.rates)) reject(`core.sections.${section}.rates must be an array`);
    const rates = sectionRaw.rates.map((row, index) => validateCanonicalRate(row, section, index));
    for (const row of rates) {
      if (rateIds.has(row.rate_uid)) reject(`duplicate rate_uid ${row.rate_uid}`);
      rateIds.add(row.rate_uid);
      const owner = productOwners.get(row.product_uid);
      if (owner && owner !== row.provider_uid) reject(`product_uid ${row.product_uid} changes provider identity`);
      productOwners.set(row.product_uid, row.provider_uid);
      const productSection = productSections.get(row.product_uid);
      if (productSection && productSection !== section) {
        reject(`product_uid ${row.product_uid} is reused across consumer sections`);
      }
      productSections.set(row.product_uid, section);
      const productFacts = JSON.stringify([
        row.provider_uid,
        row.product_name,
        row.classification.product_kind,
        row.classification.consumer_section,
        row.classification.status,
        row.classification.basis,
        row.classification.version,
      ]);
      const existingProductFacts = productFactsByUid.get(row.product_uid);
      if (existingProductFacts && existingProductFacts !== productFacts) {
        reject(`product_uid ${row.product_uid} has conflicting product-level facts`);
      }
      productFactsByUid.set(row.product_uid, productFacts);
      const legacyKey = row.legacy_product_key ?? null;
      if (legacyKeyByProduct.has(row.product_uid) && legacyKeyByProduct.get(row.product_uid) !== legacyKey) {
        reject(`product_uid ${row.product_uid} has inconsistent legacy_product_key tiers`);
      }
      legacyKeyByProduct.set(row.product_uid, legacyKey);
      const effectiveProductKey = row.legacy_product_key ?? row.product_uid;
      const effectiveOwner = effectiveProductOwners.get(effectiveProductKey);
      if (effectiveOwner && effectiveOwner !== row.product_uid) {
        reject(`adapted product_key ${effectiveProductKey} is ambiguous`);
      }
      effectiveProductOwners.set(effectiveProductKey, row.product_uid);
      const legacyIndex = legacyRateIndex(row.rate_uid);
      const productIndexes = legacyIndexesByProduct.get(row.product_uid) ?? new Map<number, string>();
      const existingRateUid = productIndexes.get(legacyIndex);
      if (existingRateUid && existingRateUid !== row.rate_uid) reject(`rate_uid legacy index collision for product_uid ${row.product_uid}`);
      productIndexes.set(legacyIndex, row.rate_uid);
      legacyIndexesByProduct.set(row.product_uid, productIndexes);
      const providerName = providerNamesByUid.get(row.provider_uid);
      if (providerName && providerName !== row.provider) reject(`provider_uid ${row.provider_uid} has conflicting display names`);
      providerNamesByUid.set(row.provider_uid, row.provider);
      const providerUid = providerUidsByName.get(row.provider);
      if (providerUid && providerUid !== row.provider_uid) reject(`provider display name ${row.provider} is ambiguous`);
      providerUidsByName.set(row.provider, row.provider_uid);
    }
    sections[section] = { rates, ribbon: validateRibbon(sectionRaw.ribbon, rates, `core.sections.${section}.ribbon`) };
  }
  const brandsRaw = record(obj.brands, 'core.brands');
  const brands: CorePayloadV3['brands'] = {};
  for (const [uid, raw] of Object.entries(brandsRaw)) {
    const brand = record(raw, `core.brands.${uid}`);
    exactKeys(brand, ['short', 'color'], ['logo', 'logo_uri', 'logo_svg_uri'], `core.brands.${uid}`);
    if (
      typeof brand.short !== 'string' ||
      typeof brand.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(brand.color) ||
      ['logo', 'logo_uri', 'logo_svg_uri'].some((key) => brand[key] !== undefined && typeof brand[key] !== 'string')
    ) reject(`core.brands.${uid} is invalid`);
    brands[uid] = brand as unknown as CorePayloadV3['brands'][string];
  }
  for (const providerUid of providerNamesByUid.keys()) {
    if (!brands[providerUid]) reject(`core.brands is missing provider_uid ${providerUid}`);
  }
  const adaptedBrandOwners = new Map<string, string>();
  for (const providerUid of Object.keys(brands)) {
    const adaptedKey = providerNamesByUid.get(providerUid) ?? providerUid;
    const adaptedOwner = adaptedBrandOwners.get(adaptedKey);
    if (adaptedOwner && adaptedOwner !== providerUid) {
      reject(`adapted brand key ${adaptedKey} is ambiguous`);
    }
    adaptedBrandOwners.set(adaptedKey, providerUid);
  }
  if (!Array.isArray(obj.rba)) reject('core.rba must be an array');
  let previousRbaDate: string | null = null;
  const rba = obj.rba.map((raw, index) => {
    const entry = record(raw, `core.rba[${index}]`);
    exactKeys(entry, ['date', 'rate'], [], `core.rba[${index}]`);
    const rate = entry.rate;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) reject(`core.rba[${index}].rate must be percentage points`);
    const stepDate = date(entry.date, `core.rba[${index}].date`);
    if (previousRbaDate !== null && stepDate <= previousRbaDate) {
      reject('core.rba must contain unique dates in ascending order');
    }
    previousRbaDate = stepDate;
    return { date: stepDate, rate };
  });
  const holds = obj.rba_holds === undefined
    ? undefined
    : Array.isArray(obj.rba_holds)
      ? obj.rba_holds.map((entry, index) => date(entry, `core.rba_holds[${index}]`))
      : reject('core.rba_holds must be an array');
  return {
    schema_id: 'https://australianrates.app/schemas/core-v3.json',
    schema_version: 3,
    generation_id: manifest.generation_id,
    generation_digest: manifest.generation_digest,
    run_date: manifest.run_date,
    sections,
    brands,
    rba,
    ...(holds ? { rba_holds: holds } : {}),
    ...(obj.coverage && typeof obj.coverage === 'object' ? { coverage: obj.coverage as CorePayloadV3['coverage'] } : {}),
  };
}

export function adaptCoreV3ToLegacy(core: CorePayloadV3): CorePayload {
  const roots: Record<SectionKey, string> = {
    Mortgage: 'HOME_LOAN',
    Savings: 'TRANS_AND_SAVINGS_ACCOUNTS',
    TD: 'TERM_DEPOSIT',
  };
  const providerNamesByUid = new Map<string, string>();
  for (const section of SECTION_KEYS) {
    for (const row of core.sections[section].rates) providerNamesByUid.set(row.provider_uid, row.provider);
  }
  return {
    schema_version: 1,
    run_date: core.run_date,
    sections: Object.fromEntries(SECTION_KEYS.map((section) => [
      section,
      {
        ribbon: core.sections[section].ribbon,
        rates: core.sections[section].rates.map((row) => ({
          provider: row.provider,
          product_id: row.product_uid,
          product_key: row.legacy_product_key ?? row.product_uid,
          product_name: row.product_name,
          rate: String(row.typed_rate.value),
          rate_index: legacyRateIndex(row.rate_uid),
          ...(row.comparison_rate ? { comparison_rate: String(row.comparison_rate.value) } : {}),
          rate_type: (row.mortgage_rate_type ?? row.typed_rate.metric).toUpperCase(),
          ...(row.mortgage_rate_type
            ? { ribbon_rate_structure: row.mortgage_rate_type.toUpperCase() }
            : {}),
          ...(row.fixed_term_months === undefined
            ? {}
            : { ribbon_fixed_term: row.fixed_term_months / 12, term_months: row.fixed_term_months }),
          account_class:
            row.evidence.availability === 'public' &&
            row.evidence.broadly_applicable &&
            row.evidence.pricing_status === 'published'
              ? 'standard'
              : 'non_standard',
          ...(row.typed_rate.metric === 'conditional'
            ? section === 'TD'
              ? { ribbon_rate_structure: 'bonus' }
              : { ribbon_deposit_kind: 'bonus' }
            : row.typed_rate.metric === 'introductory'
              ? section === 'TD'
                ? { ribbon_rate_structure: 'introductory' }
                : { ribbon_deposit_kind: 'intro' }
              : {}),
          taxonomy_path: roots[section],
        })),
      },
    ])) as CorePayload['sections'],
    brands: Object.fromEntries(
      Object.entries(core.brands).map(([providerUid, brand]) => [
        providerNamesByUid.get(providerUid) ?? providerUid,
        brand,
      ]),
    ),
    rba: core.rba,
    ...(core.rba_holds ? { rba_holds: core.rba_holds } : {}),
    ...(core.coverage ? { coverage: core.coverage } : {}),
  };
}
