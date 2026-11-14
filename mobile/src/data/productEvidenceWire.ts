/** Descriptive normalized facts only. This contract grants no pricing/eligibility authority. */
import { isValidCalendarDate } from '../lib/calendarDate';
import { canonicalTermsJson } from './productTerms';

export const EVIDENCE_SCHEMA = 'ar-product-evidence-delivery-v1';
export const EVIDENCE_SCOPE = 'normalized_facts_only; raw_null_empty_and_transport_envelope_not_inventoried';
export const EVIDENCE_LIMITS = Object.freeze({ namespace: 65536, index: 4 * 1024 ** 2, compressed: 1024 ** 2,
  shard: 4 * 1024 ** 2, totalRaw: 1024 ** 3, totalCompressed: 128 * 1024 ** 2,
  productRaw: 64 * 1024 ** 2, productCompressed: 16 * 1024 ** 2 });
const SHA = /^[a-f0-9]{64}$/;
const IDENTITY = ['dataset', 'provider', 'product_id', 'product_key', 'product_name'];
const FACT_TEXT = ['fact_id', 'kind', 'canonical_key', 'value_type', 'unit', 'mapping', 'source_path', 'source_pattern'];
const JSON_FIELDS = ['value_json', 'source_value_json', 'qualifiers_json', 'min_value_json', 'max_value_json'];
type ObjectValue = Record<string, unknown>;
export type EvidenceIdentity = Record<(typeof IDENTITY)[number], string>;
export type EvidenceFact = Record<string, string>;
export interface EvidenceSource {
  generation_id: string; observation_date: string; observation_state: 'complete' | 'partial' | 'failed';
  contract_digest: string; source_generation_digest: string; contract_file_sha256: string;
  contract_normalization: string; fact_normalization: 'cdr-product-facts-2'; database: { path: 'local-cdr.sqlite'; bytes: number; sha256: string };
}
export interface EvidenceBinding { source: EvidenceSource; snapshot_sha256: string; core_sha256: string; details_sha256: string; scope: typeof EVIDENCE_SCOPE }
export interface EvidenceAsset { name: string; sha256: string; bytes: number; decoded_bytes: number }
export interface EvidenceCapability { schema: typeof EVIDENCE_SCHEMA; binding: EvidenceBinding; index: EvidenceAsset; shards: EvidenceAsset[]; products: number; facts: number }
export interface EvidenceRoute { identity: EvidenceIdentity; facts: number; pages: { shard: string; page: number; facts: number }[] }
export interface EvidenceIndex { schema: typeof EVIDENCE_SCHEMA; binding: EvidenceBinding; products: EvidenceRoute[] }
export interface EvidencePage { identity: EvidenceIdentity; sequence: number; facts: EvidenceFact[] }
export interface EvidenceShard { schema: typeof EVIDENCE_SCHEMA; binding: EvidenceBinding; pages: EvidencePage[] }

export class EvidenceError extends Error {
  constructor(public readonly code: 'invalid' | 'unsupported' | 'cancelled' | 'unavailable', message: string) { super(message); }
}
function requireEvidence(value: unknown, message: string): asserts value {
  if (!value) throw new EvidenceError('invalid', message);
}
function fields(raw: unknown, names: readonly string[]): ObjectValue {
  requireEvidence(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'Evidence object required');
  const value = raw as ObjectValue;
  requireEvidence(Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key)), 'Unexpected evidence fields');
  return value;
}
function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function sha(value: unknown): value is string { return typeof value === 'string' && SHA.test(value); }
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
export function sameEvidence(a: unknown, b: unknown): boolean { return canonicalTermsJson(a) === canonicalTermsJson(b); }
function identity(raw: unknown): EvidenceIdentity {
  const value = fields(raw, IDENTITY);
  requireEvidence(IDENTITY.every(key => text(value[key])), 'Evidence identity missing');
  return value as EvidenceIdentity;
}
export function validateEvidenceBinding(raw: unknown): EvidenceBinding {
  const binding = fields(raw, ['source', 'snapshot_sha256', 'core_sha256', 'details_sha256', 'scope']);
  requireEvidence(['snapshot_sha256', 'core_sha256', 'details_sha256'].every(key => sha(binding[key])) && binding.scope === EVIDENCE_SCOPE, 'Evidence binding invalid');
  const source = fields(binding.source, ['generation_id', 'observation_date', 'observation_state', 'contract_digest',
    'source_generation_digest', 'contract_file_sha256', 'contract_normalization', 'fact_normalization', 'database']);
  requireEvidence(typeof source.observation_date === 'string' && isValidCalendarDate(source.observation_date)
    && typeof source.generation_id === 'string' && new RegExp(`^obs-${source.observation_date}-[a-f0-9]{16}$`).test(source.generation_id), 'Evidence date/generation invalid');
  requireEvidence(['complete', 'partial', 'failed'].includes(String(source.observation_state))
    && ['contract_digest', 'source_generation_digest', 'contract_file_sha256'].every(key => sha(source[key]))
    && text(source.contract_normalization) && source.fact_normalization === 'cdr-product-facts-2', 'Unsupported source normalization');
  const database = fields(source.database, ['path', 'bytes', 'sha256']);
  requireEvidence(database.path === 'local-cdr.sqlite' && integer(database.bytes, 1, 4 * 1024 ** 3) && sha(database.sha256), 'Evidence database invalid');
  return binding as unknown as EvidenceBinding;
}
function asset(raw: unknown, kind: 'index' | 'shard'): EvidenceAsset {
  const value = fields(raw, ['name', 'sha256', 'bytes', 'decoded_bytes']);
  requireEvidence(sha(value.sha256) && value.name === `product-evidence-${kind}-${value.sha256}.json.gz`
    && integer(value.bytes, 1, EVIDENCE_LIMITS.compressed) && integer(value.decoded_bytes, 1, EVIDENCE_LIMITS[kind]), 'Evidence asset invalid');
  return value as unknown as EvidenceAsset;
}
export function validateEvidenceCapability(raw: unknown, expected: EvidenceBinding): EvidenceCapability {
  if (raw && typeof raw === 'object' && 'schema' in raw && typeof raw.schema === 'string' && raw.schema !== EVIDENCE_SCHEMA) {
    throw new EvidenceError('unsupported', 'Evidence version unsupported');
  }
  const value = fields(raw, ['schema', 'binding', 'index', 'shards', 'products', 'facts']);
  if (value.schema !== EVIDENCE_SCHEMA) throw new EvidenceError('unsupported', 'Evidence version unsupported');
  validateEvidenceBinding(value.binding);
  validateEvidenceBinding(expected);
  requireEvidence(sameEvidence(value.binding, expected), 'Evidence source/core/details mismatch');
  requireEvidence(integer(value.products, 1, 20000) && integer(value.facts, 1, 3000000), 'Evidence counts invalid');
  const index = asset(value.index, 'index');
  requireEvidence(Array.isArray(value.shards) && value.shards.length > 0 && value.shards.length <= 256, 'Evidence shards invalid');
  const shards = value.shards.map(item => asset(item, 'shard'));
  requireEvidence(new Set(shards.map(item => item.sha256)).size === shards.length, 'Duplicate evidence shard');
  requireEvidence([index, ...shards].reduce((sum, item) => sum + item.bytes, 0) <= EVIDENCE_LIMITS.totalCompressed
    && [index, ...shards].reduce((sum, item) => sum + item.decoded_bytes, 0) <= EVIDENCE_LIMITS.totalRaw, 'Evidence aggregate budget exceeded');
  requireEvidence(new TextEncoder().encode(canonicalTermsJson(value)).length <= EVIDENCE_LIMITS.namespace, 'Evidence namespace exceeds budget');
  return value as unknown as EvidenceCapability;
}
export function validateEvidenceIndex(raw: unknown, capability: EvidenceCapability): EvidenceIndex {
  const value = fields(raw, ['schema', 'binding', 'products']);
  requireEvidence(value.schema === EVIDENCE_SCHEMA && sameEvidence(value.binding, capability.binding), 'Detached evidence index');
  requireEvidence(Array.isArray(value.products) && value.products.length === capability.products, 'Evidence index count mismatch');
  const shards = new Map(capability.shards.map(item => [item.sha256, item]));
  const keys = new Set<string>(), positions = new Set<string>(), used = new Set<string>();
  let facts = 0;
  for (const rawProduct of value.products) {
    const product = fields(rawProduct, ['identity', 'facts', 'pages']), bound = identity(product.identity);
    requireEvidence(!keys.has(bound.product_key) && integer(product.facts, 1, 50000), 'Duplicate/invalid product route');
    keys.add(bound.product_key);
    requireEvidence(Array.isArray(product.pages) && product.pages.length > 0 && product.pages.length <= 20000, 'Evidence page routes invalid');
    let count = 0;
    const selected = new Set<string>();
    for (const rawPage of product.pages) {
      const page = fields(rawPage, ['shard', 'page', 'facts']);
      requireEvidence(typeof page.shard === 'string' && shards.has(page.shard) && integer(page.page, 0, 19999)
        && integer(page.facts, 1, 1024), 'Undeclared/invalid evidence page');
      const position = `${page.shard}:${page.page}`;
      requireEvidence(!positions.has(position), 'Duplicate evidence page route');
      positions.add(position); selected.add(page.shard); used.add(page.shard); count += page.facts;
    }
    requireEvidence(count === product.facts, 'Product evidence count mismatch');
    requireEvidence([...selected].reduce((sum, key) => sum + shards.get(key)!.bytes, 0) <= EVIDENCE_LIMITS.productCompressed
      && [...selected].reduce((sum, key) => sum + shards.get(key)!.decoded_bytes, 0) <= EVIDENCE_LIMITS.productRaw, 'Product cumulative evidence budget exceeded');
    facts += count;
  }
  requireEvidence(facts === capability.facts && used.size === shards.size, 'Unrouted evidence/count mismatch');
  return value as unknown as EvidenceIndex;
}
function fact(raw: unknown): EvidenceFact {
  const value = fields(raw, [...FACT_TEXT, ...JSON_FIELDS]);
  requireEvidence(FACT_TEXT.every(key => text(value[key])) && JSON_FIELDS.every(key => typeof value[key] === 'string'), 'Evidence fact fields invalid');
  requireEvidence(['canonical', 'canonical_text', 'preserved'].includes(String(value.mapping)), 'Evidence mapping unsupported');
  const decoded = Object.fromEntries(JSON_FIELDS.map(key => [key, JSON.parse(value[key] as string) as unknown]));
  const scalar = decoded.value_json, kind = value.value_type;
  requireEvidence((kind === 'boolean' && typeof scalar === 'boolean')
    || (['number', 'rate', 'money'].includes(String(kind)) && typeof scalar === 'number' && Number.isFinite(scalar))
    || (['text', 'duration', 'enum'].includes(String(kind)) && typeof scalar === 'string') || (kind === 'range' && scalar === null), 'Evidence fact type mismatch');
  const minimum = decoded.min_value_json, maximum = decoded.max_value_json;
  requireEvidence([minimum, maximum].every(v => v === null || typeof v === 'number' && Number.isFinite(v))
    && ((minimum !== null || maximum !== null) === (kind === 'range')), 'Evidence bounds invalid');
  requireEvidence(decoded.qualifiers_json !== null && typeof decoded.qualifiers_json === 'object' && !Array.isArray(decoded.qualifiers_json), 'Evidence qualifiers invalid');
  // Keep authoritative JSON text: parsing a source number can round it in JavaScript.
  return value as EvidenceFact;
}
export function validateEvidenceShard(raw: unknown, capability: EvidenceCapability): EvidenceShard {
  const value = fields(raw, ['schema', 'binding', 'pages']);
  requireEvidence(value.schema === EVIDENCE_SCHEMA && sameEvidence(value.binding, capability.binding), 'Detached evidence shard');
  requireEvidence(Array.isArray(value.pages) && value.pages.length > 0 && value.pages.length <= 20000, 'Evidence pages invalid');
  for (const rawPage of value.pages) {
    const page = fields(rawPage, ['identity', 'sequence', 'facts']);
    identity(page.identity);
    requireEvidence(integer(page.sequence, 0, 19999) && Array.isArray(page.facts) && page.facts.length > 0 && page.facts.length <= 1024, 'Evidence page invalid');
    page.facts.forEach(fact);
  }
  return value as unknown as EvidenceShard;
}
export function parseEvidenceJson(text: string, maximum: number): unknown {
  requireEvidence(new TextEncoder().encode(text).length <= maximum, 'Inflated evidence exceeds byte budget');
  const value: unknown = JSON.parse(text);
  requireEvidence(canonicalTermsJson(value) === text, 'Evidence JSON is not canonical');
  return value;
}
