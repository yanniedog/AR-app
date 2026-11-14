import { sameEvidence, type EvidenceIdentity } from './productEvidenceWire';
import {
  RESPONSE_LIMITS, RESPONSE_PROJECTIONS, RESPONSE_SCHEMA, responseFields as fields, responseInteger as integer,
  responseRequire as requireValue, responseSha as sha, responseText as text, validateResponseEvent,
  type ResponseBody, type ResponseCapability, type ResponseIndex, type ResponseProduct,
} from './productResponseWire';

const IDENTITY = ['dataset', 'provider', 'product_id', 'product_key', 'product_name'];
function identity(raw: unknown): EvidenceIdentity {
  const value = fields(raw, IDENTITY);
  requireValue(IDENTITY.every(key => typeof value[key] === 'string' && value[key].length > 0), 'Invalid response product identity');
  return value as EvidenceIdentity;
}
function validateBody(raw: unknown, capability: ResponseCapability, positions: Set<string>, sequences: Set<number>, digests: Set<string>): ResponseBody {
  const value = fields(raw, ['sha256', 'bytes', 'chunks', 'events']);
  requireValue(sha(value.sha256) && integer(value.bytes, 1, RESPONSE_LIMITS.body), 'Invalid original response body');
  requireValue(Array.isArray(value.chunks) && value.chunks.length > 0 && value.chunks.length <= 256, 'Invalid response chunks');
  const declared = new Set(capability.shards.map(item => item.sha256));
  let offset = 0;
  for (const rawChunk of value.chunks) {
    const chunk = fields(rawChunk, ['shard', 'page', 'offset', 'bytes']);
    requireValue(typeof chunk.shard === 'string' && declared.has(chunk.shard) && integer(chunk.page, 0, 19999)
      && integer(chunk.bytes, 1, RESPONSE_LIMITS.chunk) && chunk.offset === offset, 'Invalid/noncontiguous response chunk');
    const position = `${chunk.shard}:${chunk.page}`;
    requireValue(!positions.has(position), 'Duplicate response chunk route');
    positions.add(position); offset += chunk.bytes;
  }
  requireValue(offset === value.bytes, 'Original response byte count differs');
  const selected = new Set(value.chunks.map(chunk => (chunk as { shard: string }).shard));
  const descriptors = capability.shards.filter(item => selected.has(item.sha256));
  requireValue(descriptors.reduce((n, item) => n + item.bytes, 0) <= RESPONSE_LIMITS.productCompressed
    && descriptors.reduce((n, item) => n + item.decoded_bytes, 0) <= RESPONSE_LIMITS.productRaw, 'Original body cumulative budget exceeded');
  requireValue(Array.isArray(value.events) && value.events.length > 0 && value.events.length <= 100000, 'Missing original response event');
  for (const rawEvent of value.events) {
    const event = validateResponseEvent(rawEvent);
    requireValue(!sequences.has(event.sequence) && !digests.has(event.event_digest), 'Duplicate journal response event');
    sequences.add(event.sequence); digests.add(event.event_digest);
  }
  return value as unknown as ResponseBody;
}
function bodyFor(rawSha: unknown, bodies: Map<string, ResponseBody>, product: ResponseProduct, index: boolean): ResponseBody {
  requireValue(typeof rawSha === 'string' && bodies.has(rawSha), 'Undeclared original body');
  const body = bodies.get(rawSha)!;
  requireValue(body.events.some(event => event.provider === product.identity.provider && event.provider_uid === product.provider_uid
    && (index ? event.phase === 'products_index' && event.product_id === null
      : event.phase !== 'products_index' && event.product_id === product.identity.product_id)), 'Response event/product identity mismatch');
  return body;
}
function product(raw: unknown, bodies: Map<string, ResponseBody>, used: Set<string>): ResponseProduct {
  const value = fields(raw, ['identity', 'provider_uid', 'state', 'current_body_sha256', 'details', 'indexes', 'reasons', 'projection']);
  identity(value.identity); requireValue(text(value.provider_uid), 'Invalid response provider UID');
  requireValue(value.projection === 'known-exact-projections' || value.projection === 'unsupported', 'Unsupported response projection');
  requireValue(Array.isArray(value.details) && value.details.length <= 40000 && Array.isArray(value.indexes) && value.indexes.length <= 40000, 'Invalid response versions');
  requireValue(Array.isArray(value.reasons) && value.reasons.length <= 32 && value.reasons.every(reason => text(reason, 128))
    && new Set(value.reasons).size === value.reasons.length, 'Invalid response uncertainty reasons');
  const route = value as unknown as ResponseProduct;
  const matched: string[] = [], local = new Set<string>();
  for (const rawDetail of value.details) {
    const detail = fields(rawDetail, ['sha256', 'matches_export', 'projection_variants']);
    requireValue(typeof detail.matches_export === 'boolean' && Array.isArray(detail.projection_variants)
      && detail.projection_variants.length <= RESPONSE_PROJECTIONS.length
      && detail.projection_variants.every(item => typeof item === 'string' && RESPONSE_PROJECTIONS.includes(item as typeof RESPONSE_PROJECTIONS[number]))
      && new Set(detail.projection_variants).size === detail.projection_variants.length
      && detail.matches_export === (detail.projection_variants.length > 0), 'Invalid response projection match');
    const body = bodyFor(detail.sha256, bodies, route, false);
    requireValue(!local.has(body.sha256), 'Duplicate detail body'); local.add(body.sha256); used.add(body.sha256);
    if (detail.matches_export) matched.push(body.sha256);
  }
  local.clear();
  for (const bodySha of value.indexes) {
    const body = bodyFor(bodySha, bodies, route, true);
    requireValue(!local.has(body.sha256), 'Duplicate index body'); local.add(body.sha256); used.add(body.sha256);
  }
  const state = matched.length === 1 ? 'matched' : matched.length > 1 ? 'ambiguous' : value.details.length
    ? 'projection_unverified' : value.indexes.length ? 'index_only' : 'missing';
  requireValue(value.state === state && value.current_body_sha256 === (state === 'matched' ? matched[0] : null), 'False current response selection');
  requireValue(value.projection !== 'unsupported' || matched.length === 0, 'Unsupported projection claimed current');
  return route;
}
export function validateResponseIndex(raw: unknown, capability: ResponseCapability): ResponseIndex {
  const value = fields(raw, ['schema', 'binding', 'products', 'bodies']);
  requireValue(value.schema === RESPONSE_SCHEMA && sameEvidence(value.binding, capability.binding), 'Detached response index');
  requireValue(Array.isArray(value.bodies) && value.bodies.length === capability.bodies
    && Array.isArray(value.products) && value.products.length === capability.products, 'Response index count differs');
  const positions = new Set<string>(), sequences = new Set<number>(), digests = new Set<string>(), bodies = new Map<string, ResponseBody>();
  for (const rawBody of value.bodies) {
    const body = validateBody(rawBody, capability, positions, sequences, digests);
    requireValue(!bodies.has(body.sha256), 'Duplicate original response body'); bodies.set(body.sha256, body);
  }
  const keys = new Set<string>(), used = new Set<string>();
  for (const rawProduct of value.products) {
    const route = product(rawProduct, bodies, used);
    requireValue(!keys.has(route.identity.product_key), 'Duplicate response product'); keys.add(route.identity.product_key);
  }
  const shardSet = new Set([...positions].map(position => position.split(':')[0]));
  requireValue(used.size === bodies.size && shardSet.size === capability.shards.length, 'Unrouted original response evidence');
  return value as unknown as ResponseIndex;
}
