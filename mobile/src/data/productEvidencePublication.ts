/** Detached optional references; callers supply the adopter's selected revision head. */
import type { Manifest } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { payloadBundleIdentity } from './payloadBundleIdentity';
import { assertRevisionManifest, validateRevisionHead, type PayloadRevisionHead } from './payloadRevision';
import { parseBoundedEvidenceJson } from './productEvidenceJson';
import { EVIDENCE_SCHEMA, EvidenceError, sameEvidence, validateEvidenceBinding, validateEvidenceCapability,
  type EvidenceBinding, type EvidenceCapability } from './productEvidenceWire';
import { RESPONSE_SCHEMA, responseFields, responseInteger, responseRequire, responseSha, responseUtf8,
  validateResponseBinding, validateResponseCapability, type ResponseCapability } from './productResponseWire';

export const PUBLICATION_REFERENCE_LIMIT = 65536;
export const EVIDENCE_REFERENCE_SCHEMAS = { product_evidence_v1: 'ar-product-evidence-reference-v1',
  product_response_evidence_v1: 'ar-product-response-evidence-reference-v1' } as const;
export type EvidenceLane = keyof typeof EVIDENCE_REFERENCE_SCHEMAS;
export interface EvidenceReferenceSource { generation_id: string; observation_date: string;
  observation_state: 'complete' | 'partial' | 'failed'; contract_digest: string }
export interface EvidenceReferenceAsset { name: string; sha256: string; bytes: number; decoded_bytes: number }
export interface EvidenceReference { schema: string; source: EvidenceReferenceSource;
  core_sha256: string; details_sha256: string; capability: EvidenceReferenceAsset }
export type EvidenceReferenceState = { status: 'absent' | 'unsupported' }
  | { status: 'declared'; reference: EvidenceReference };
export interface EvidencePublication { manifest: Manifest; head: PayloadRevisionHead;
  references: Record<EvidenceLane, EvidenceReferenceState> }
export const evidenceFamily = (lane: EvidenceLane) => lane === 'product_evidence_v1' ? 'product-evidence' : 'product-response';

/** Bound unknown objects before serialization/canonicalization, including hostile deep inputs. */
function boundedManifest(value: unknown): Manifest {
  const pending = [{ value, depth: 0 }];
  let nodes = 0, minimumBytes = 0;
  while (pending.length) {
    const next = pending.pop()!, item = next.value;
    responseRequire(++nodes <= PUBLICATION_REFERENCE_LIMIT && next.depth <= 64, 'Manifest complexity exceeds limit');
    if (item !== null && typeof item === 'object') {
      responseRequire([Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(item)), 'Manifest must be plain JSON');
      minimumBytes += 2;
      if (Array.isArray(item)) responseRequire(item.length <= PUBLICATION_REFERENCE_LIMIT, 'Manifest array exceeds limit');
      const keys = Reflect.ownKeys(item);
      if (Array.isArray(item)) responseRequire(keys.length === item.length + 1, 'Manifest arrays must be dense JSON');
      for (const key of keys) {
        if (Array.isArray(item) && key === 'length') continue;
        const field = Object.getOwnPropertyDescriptor(item, key)!;
        responseRequire(typeof key === 'string' && field.enumerable && Object.hasOwn(field, 'value'), 'Manifest must contain JSON values');
        responseRequire(key.length <= PUBLICATION_REFERENCE_LIMIT, 'Manifest key exceeds limit');
        if (Array.isArray(item)) responseRequire(/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < item.length, 'Manifest arrays must contain only indexes');
        if (!Array.isArray(item)) minimumBytes += responseUtf8(key).length;
        pending.push({ value: field.value, depth: next.depth + 1 });
      }
    } else if (typeof item === 'string') {
      responseRequire(item.length <= PUBLICATION_REFERENCE_LIMIT, 'Manifest string exceeds limit');
      minimumBytes += responseUtf8(item).length + 2;
    }
    else { responseRequire(item === null || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item), 'Manifest must contain finite JSON'); minimumBytes++; }
    responseRequire(minimumBytes <= PUBLICATION_REFERENCE_LIMIT, 'Manifest exceeds 64 KiB');
  }
  const text = JSON.stringify(value);
  responseRequire(responseUtf8(text).length <= PUBLICATION_REFERENCE_LIMIT, 'Manifest exceeds 64 KiB');
  return parseBoundedEvidenceJson(text, PUBLICATION_REFERENCE_LIMIT) as Manifest;
}

function reference(value: unknown, lane: EvidenceLane, manifest: Manifest): EvidenceReferenceState {
  if (value === undefined) return { status: 'absent' };
  if (value && typeof value === 'object' && 'schema' in value && typeof value.schema === 'string'
      && value.schema !== EVIDENCE_REFERENCE_SCHEMAS[lane]) return { status: 'unsupported' };
  const ref = responseFields(value, ['schema', 'source', 'core_sha256', 'details_sha256', 'capability']);
  responseRequire(ref.schema === EVIDENCE_REFERENCE_SCHEMAS[lane], 'Invalid evidence reference schema');
  const source = responseFields(ref.source, ['generation_id', 'observation_date', 'observation_state', 'contract_digest']);
  responseRequire(typeof source.observation_date === 'string' && isValidCalendarDate(source.observation_date)
    && source.observation_date === manifest.run_date && typeof source.generation_id === 'string'
    && new RegExp(`^obs-${source.observation_date}-[a-f0-9]{16}$`).test(source.generation_id)
    && typeof source.observation_state === 'string' && ['complete', 'partial', 'failed'].includes(source.observation_state)
    && responseSha(source.contract_digest), 'Invalid evidence source reference');
  responseRequire(Object.entries(source).every(([key, field]) => manifest.source_observation?.[key] === field), 'Evidence selected source mismatch');
  responseRequire(responseSha(ref.core_sha256) && ref.core_sha256 === manifest.files.core.sha256
    && responseSha(ref.details_sha256) && ref.details_sha256 === manifest.files.details.sha256, 'Evidence selected asset mismatch');
  const asset = responseFields(ref.capability, ['name', 'sha256', 'bytes', 'decoded_bytes']);
  responseRequire(responseSha(asset.sha256) && asset.name === `${evidenceFamily(lane)}-capability-${asset.sha256}.json.gz`
    && responseInteger(asset.bytes, 1, PUBLICATION_REFERENCE_LIMIT)
    && responseInteger(asset.decoded_bytes, 1, PUBLICATION_REFERENCE_LIMIT), 'Invalid detached capability descriptor');
  return { status: 'declared', reference: ref as unknown as EvidenceReference };
}

export function validateEvidencePublication(raw: Manifest, selected: PayloadRevisionHead): EvidencePublication {
  const manifest = boundedManifest(raw);
  const head = validateRevisionHead(selected, manifest.run_date, 'yanniedog/AR-local');
  responseRequire(head.revision <= 999999, 'Evidence immutable delivery revision exceeds route limit');
  assertRevisionManifest(manifest, head, manifest.run_date, 'yanniedog/AR-local');
  const bundle = payloadBundleIdentity(manifest);
  responseRequire(head.bundle_sha256 === bundle && head.generation_id === `sha256-${bundle}`, 'Evidence selected bundle mismatch');
  const root = manifest as unknown as Record<string, unknown>;
  const references = Object.fromEntries(Object.keys(EVIDENCE_REFERENCE_SCHEMAS).map(key =>
    [key, reference(root[key], key as EvidenceLane, manifest)])) as EvidencePublication['references'];
  const names = new Set<string>();
  for (const [key, asset] of Object.entries(manifest.files)) {
    responseRequire(!key.startsWith('product_evidence') && !key.startsWith('product_response')
      && !/^product-(?:evidence|response)-/.test(asset.name) && !names.has(asset.name), 'Misplaced or aliased evidence descriptor');
    names.add(asset.name);
  }
  for (const state of Object.values(references)) if (state.status === 'declared') {
    responseRequire(!names.has(state.reference.capability.name), 'Aliased evidence capability');
    names.add(state.reference.capability.name);
  }
  return { manifest, head: { ...head }, references };
}

function verifyBinding(binding: EvidenceBinding, ref: EvidenceReference) {
  responseRequire(Object.entries(ref.source).every(([key, value]) => binding.source[key as keyof typeof binding.source] === value)
    && binding.core_sha256 === ref.core_sha256 && binding.details_sha256 === ref.details_sha256,
  'Detached capability selected binding mismatch');
}

export function validateDetachedCapability(value: unknown, lane: EvidenceLane, ref: EvidenceReference): EvidenceCapability | ResponseCapability {
  if (value && typeof value === 'object' && 'schema' in value && typeof value.schema === 'string'
      && value.schema !== (lane === 'product_evidence_v1' ? EVIDENCE_SCHEMA : RESPONSE_SCHEMA)) {
    throw new EvidenceError('unsupported', 'Detached capability version unsupported');
  }
  responseRequire(value !== null && typeof value === 'object' && 'binding' in value, 'Capability binding missing');
  if (lane === 'product_evidence_v1') {
    const binding = validateEvidenceBinding(value.binding);
    verifyBinding(binding, ref);
    return validateEvidenceCapability(value, binding);
  }
  const binding = validateResponseBinding(value.binding);
  verifyBinding(binding.facts, ref);
  return validateResponseCapability(value, binding);
}

export function checkCommonEvidenceBinding(a: EvidenceCapability | ResponseCapability, b: EvidenceCapability | ResponseCapability): void {
  const facts = (item: typeof a) => 'facts' in item.binding ? item.binding.facts : item.binding;
  if (!sameEvidence(facts(a), facts(b))) throw new EvidenceError('invalid', 'Evidence lanes have different source snapshots');
}
