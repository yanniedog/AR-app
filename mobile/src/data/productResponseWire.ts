/** Original decoded response evidence; no pricing or population-completeness authority. */
import { utf8ToBytes } from '@noble/hashes/utils';
import { isValidCalendarDate } from '../lib/calendarDate';
import { canonicalTermsJson } from './productTerms';
import { EvidenceError, sameEvidence, validateEvidenceBinding, type EvidenceBinding, type EvidenceIdentity } from './productEvidenceWire';
import { parseBoundedEvidenceJson } from './productEvidenceJson';

export const RESPONSE_SCHEMA = 'ar-product-response-evidence-v1';
export const RESPONSE_SCOPE = 'original_http_decoded_utf8_body; not_wire_bytes_or_population_completeness';
export const RESPONSE_LIMITS = Object.freeze({ namespace: 65536, index: 8 * 1024 ** 2, asset: 4 * 1024 ** 2, compressed: 1024 ** 2,
  totalRaw: 1024 ** 3, totalCompressed: 128 * 1024 ** 2, productRaw: 64 * 1024 ** 2,
  productCompressed: 16 * 1024 ** 2, body: 32 * 1024 ** 2, chunk: 256 * 1024 });
export const RESPONSE_PROJECTIONS = ['legacy-v1-clean-value-with-official-links', 'legacy-v1-detail-json-with-source-documents'] as const;
export interface ResponseBinding { facts: EvidenceBinding; journal: { session_id: string; head_digest: string; promotion_manifest_sha256: string }; scope: typeof RESPONSE_SCOPE }
export interface ResponseAsset { name: string; sha256: string; bytes: number; decoded_bytes: number }
export interface ResponseCapability { schema: typeof RESPONSE_SCHEMA; binding: ResponseBinding; index: ResponseAsset; shards: ResponseAsset[]; products: number; bodies: number }
export interface ResponseEvent { sequence: number; event_digest: string; phase: 'products_index' | 'product_detail' | 'classification_detail';
  completed_at: string; request_version: number | null; response_version: number | null; provider: string; provider_uid: string; product_id: string | null }
export interface ResponseChunk { shard: string; page: number; offset: number; bytes: number }
export interface ResponseBody { sha256: string; bytes: number; chunks: ResponseChunk[]; events: ResponseEvent[] }
export type ResponseState = 'matched' | 'ambiguous' | 'projection_unverified' | 'index_only' | 'missing';
export interface ResponseProduct { identity: EvidenceIdentity; provider_uid: string; state: ResponseState; current_body_sha256: string | null;
  details: { sha256: string; matches_export: boolean; projection_variants: string[] }[]; indexes: string[]; reasons: string[];
  projection: 'known-exact-projections' | 'unsupported' }
export interface ResponseIndex { schema: typeof RESPONSE_SCHEMA; binding: ResponseBinding; products: ResponseProduct[]; bodies: ResponseBody[] }
export interface ResponsePage { sha256: string; offset: number; bytes: number; text: string }
export interface ResponseShard { schema: typeof RESPONSE_SCHEMA; binding: ResponseBinding; pages: ResponsePage[] }

export function responseRequire(value: unknown, message: string): asserts value {
  if (!value) throw new EvidenceError('invalid', message);
}
export function responseFields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  responseRequire(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'Response object required');
  const value = raw as Record<string, unknown>;
  responseRequire(Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key)), 'Unexpected response fields');
  return value;
}
export function responseInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
export function responseText(value: unknown, maximum = 512): value is string { return typeof value === 'string' && value.length > 0 && value.length <= maximum; }
export function responseSha(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
export function responseUtf8(text: string): Uint8Array {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      responseRequire(next >= 0xdc00 && next <= 0xdfff, 'Response text has an unpaired surrogate');
    } else responseRequire(code < 0xdc00 || code > 0xdfff, 'Response text has an unpaired surrogate');
  }
  return utf8ToBytes(text);
}
export function parseResponseJson(text: string, maximum: number): unknown {
  try {
    const value = parseBoundedEvidenceJson(text, maximum, 1000000);
    responseRequire(canonicalTermsJson(value) === text, 'Response asset JSON is not canonical');
    return value;
  } catch (error) { throw new EvidenceError('invalid', error instanceof Error ? error.message : 'Invalid response JSON'); }
}
export function validateResponseBinding(raw: unknown): ResponseBinding {
  const value = responseFields(raw, ['facts', 'journal', 'scope']);
  validateEvidenceBinding(value.facts);
  responseRequire(value.scope === RESPONSE_SCOPE, 'Unsupported original response scope');
  const journal = responseFields(value.journal, ['session_id', 'head_digest', 'promotion_manifest_sha256']);
  responseRequire(responseText(journal.session_id, 128) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(journal.session_id)
    && responseSha(journal.head_digest) && responseSha(journal.promotion_manifest_sha256), 'Invalid journal binding');
  return value as unknown as ResponseBinding;
}
function asset(raw: unknown, kind: 'index' | 'shard'): ResponseAsset {
  const value = responseFields(raw, ['name', 'sha256', 'bytes', 'decoded_bytes']);
  responseRequire(responseSha(value.sha256) && value.name === `product-response-${kind}-${value.sha256}.json.gz`
    && responseInteger(value.bytes, 1, RESPONSE_LIMITS.compressed)
    && responseInteger(value.decoded_bytes, 1, kind === 'index' ? RESPONSE_LIMITS.index : RESPONSE_LIMITS.asset), 'Invalid response asset');
  return value as unknown as ResponseAsset;
}
export function validateResponseCapability(raw: unknown, expected: ResponseBinding): ResponseCapability {
  if (raw && typeof raw === 'object' && 'schema' in raw && typeof raw.schema === 'string' && raw.schema !== RESPONSE_SCHEMA) {
    throw new EvidenceError('unsupported', 'Response evidence version unsupported');
  }
  const value = responseFields(raw, ['schema', 'binding', 'index', 'shards', 'products', 'bodies']);
  if (value.schema !== RESPONSE_SCHEMA) throw new EvidenceError('unsupported', 'Response evidence version unsupported');
  validateResponseBinding(value.binding); validateResponseBinding(expected);
  responseRequire(sameEvidence(value.binding, expected), 'Response source/facts/core/details mismatch');
  responseRequire(responseInteger(value.products, 1, 20000) && responseInteger(value.bodies, 0, 40000), 'Invalid response counts');
  const index = asset(value.index, 'index');
  responseRequire(Array.isArray(value.shards) && value.shards.length <= 256, 'Invalid response shard count');
  const shards = value.shards.map(item => asset(item, 'shard'));
  responseRequire(new Set(shards.map(item => item.sha256)).size === shards.length && (value.bodies === 0) === (shards.length === 0), 'Duplicate or missing response shards');
  responseRequire([index, ...shards].reduce((n, item) => n + item.bytes, 0) <= RESPONSE_LIMITS.totalCompressed
    && [index, ...shards].reduce((n, item) => n + item.decoded_bytes, 0) <= RESPONSE_LIMITS.totalRaw, 'Response aggregate budget exceeded');
  responseRequire(responseUtf8(canonicalTermsJson(value)).length <= RESPONSE_LIMITS.namespace, 'Response namespace exceeds budget');
  return value as unknown as ResponseCapability;
}
export function validateResponseEvent(raw: unknown): ResponseEvent {
  const value = responseFields(raw, ['sequence', 'event_digest', 'phase', 'completed_at', 'request_version', 'response_version', 'provider', 'provider_uid', 'product_id']);
  responseRequire(responseInteger(value.sequence, 1, 100000) && responseSha(value.event_digest)
    && responseText(value.provider) && responseText(value.provider_uid), 'Invalid response event identity');
  responseRequire(value.phase === 'products_index' || value.phase === 'product_detail' || value.phase === 'classification_detail', 'Invalid response event phase');
  responseRequire(value.phase === 'products_index' ? value.product_id === null : responseText(value.product_id), 'Invalid response event product');
  for (const key of ['request_version', 'response_version']) responseRequire(value[key] === null || responseInteger(value[key], 1, 2147483647), 'Invalid CDR version evidence');
  responseRequire(typeof value.completed_at === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value.completed_at)
    && isValidCalendarDate(value.completed_at.slice(0, 10)) && Number.isFinite(Date.parse(value.completed_at)), 'Invalid response completion instant');
  return value as unknown as ResponseEvent;
}
export function validateResponseShard(raw: unknown, capability: ResponseCapability, index: ResponseIndex, sha: string): ResponseShard {
  const value = responseFields(raw, ['schema', 'binding', 'pages']);
  responseRequire(value.schema === RESPONSE_SCHEMA && sameEvidence(value.binding, capability.binding), 'Detached response shard');
  const wanted = new Map<number, { body: string; chunk: ResponseChunk }>();
  for (const body of index.bodies) for (const chunk of body.chunks) if (chunk.shard === sha) wanted.set(chunk.page, { body: body.sha256, chunk });
  responseRequire(Array.isArray(value.pages) && value.pages.length > 0 && value.pages.length <= 20000 && value.pages.length === wanted.size, 'Response shard page count differs');
  value.pages.forEach((rawPage, position) => {
    const page = responseFields(rawPage, ['sha256', 'offset', 'bytes', 'text']), bound = wanted.get(position);
    responseRequire(bound && page.sha256 === bound.body && page.offset === bound.chunk.offset && page.bytes === bound.chunk.bytes, 'Detached response chunk');
    responseRequire(typeof page.text === 'string' && page.text.length <= RESPONSE_LIMITS.chunk
      && responseUtf8(page.text).length === page.bytes, 'Response chunk UTF8 size differs');
  });
  return value as unknown as ResponseShard;
}
