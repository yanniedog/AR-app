/** Optional capability acquisition only; no UI, prefetch, adoption or pricing authority. */
import type { Manifest } from '../types';
import type { PayloadRevisionHead } from './payloadRevision';
import { reserveEvidence } from './productEvidenceBudget';
import { createProductEvidenceReader, type EvidenceLoader, type ProductEvidenceResult } from './productEvidenceTransport';
import { EvidenceError, type EvidenceCapability } from './productEvidenceWire';
import { createProductResponseReader, type ResponseLoader, type ResponseResult } from './productResponseTransport';
import { parseResponseJson, responseRequire, responseUtf8, type ResponseCapability } from './productResponseWire';
import { PUBLICATION_REFERENCE_LIMIT, checkCommonEvidenceBinding, validateDetachedCapability, validateEvidencePublication,
  type EvidenceLane, type EvidenceReferenceAsset } from './productEvidencePublication';

type Capability = EvidenceCapability | ResponseCapability;
export type CapabilityLoader = (url: string, asset: EvidenceReferenceAsset, signal?: AbortSignal) => Promise<string>;
export type MissingEvidence = { status: 'disabled' | 'pending' | 'failed' | 'unavailable' | 'unsupported';
  reason?: string; absenceIsWithdrawal: false };
async function acquire(url: string, asset: EvidenceReferenceAsset, signal?: AbortSignal): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { downloadInflate } = require('./payload') as typeof import('./payload');
  return downloadInflate(url, asset.sha256, { signal, fileName: asset.name, expectedBytes: asset.bytes,
    expectedInflatedBytes: asset.decoded_bytes, maxCompressedBytes: PUBLICATION_REFERENCE_LIMIT,
    maxInflatedBytes: PUBLICATION_REFERENCE_LIMIT, requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false });
}
// Only small validated capabilities persist. Body/index budgets remain in the held readers.
const capabilities = new Map<string, Capability>();
function retain(key: string, value: Capability): void {
  capabilities.delete(key); capabilities.set(key, value);
  while (capabilities.size > 2) capabilities.delete(capabilities.keys().next().value!);
}

export function createPublishedProductEvidence(options: {
  manifest: Manifest; selected: PayloadRevisionHead; isCurrent: () => boolean;
  loadCapability?: CapabilityLoader; loadFacts?: EvidenceLoader; loadResponse?: ResponseLoader;
}) {
  const publication = validateEvidencePublication(options.manifest, options.selected);
  const manifest = publication.manifest, edition = { repo: 'yanniedog/AR-local' as const,
    tag: manifest.tag, bundle_sha256: publication.head.bundle_sha256 };
  const load = options.loadCapability ?? acquire;
  const accepted = new Map<EvidenceLane, Capability>();
  function current(signal?: AbortSignal) {
    if (signal?.aborted) throw new EvidenceError('cancelled', 'Evidence request cancelled');
    if (!options.isCurrent()) throw new EvidenceError('unavailable', 'Selected evidence edition changed');
  }
  async function capability(lane: EvidenceLane, signal?: AbortSignal): Promise<Capability | MissingEvidence> {
    current(signal);
    const availability = publication.availability[lane];
    if (availability.state !== 'available' && availability.state !== 'unreported') {
      return { status: availability.state, reason: availability.reason, absenceIsWithdrawal: false };
    }
    const state = publication.references[lane];
    if (state.status !== 'declared') return { status: state.status === 'absent' ? 'unavailable' : 'unsupported', absenceIsWithdrawal: false };
    const descriptor = state.reference.capability, key = `${edition.bundle_sha256}:${lane}:${descriptor.sha256}`;
    // Waiting callers recheck the cache under the shared slot. No nested lease and
    // no shared AbortController: cancelling one caller never cancels another.
    const release = await reserveEvidence(signal);
    try {
      current(signal);
      let value = capabilities.get(key);
      if (!value) {
        const text = await load(`https://github.com/${edition.repo}/releases/download/${edition.tag}/${descriptor.name}`, descriptor, signal);
        current(signal);
        responseRequire(text.length <= descriptor.decoded_bytes && responseUtf8(text).length === descriptor.decoded_bytes, 'Detached capability decoded size mismatch');
        value = validateDetachedCapability(parseResponseJson(text, PUBLICATION_REFERENCE_LIMIT), lane, state.reference);
      } else value = validateDetachedCapability(value, lane, state.reference);
      current(signal);
      for (const prior of accepted.values()) checkCommonEvidenceBinding(prior, value);
      accepted.set(lane, value); retain(key, value);
      return value;
    } finally { release(); }
  }
  return {
    references: JSON.parse(JSON.stringify(publication.references)) as typeof publication.references,
    availability: JSON.parse(JSON.stringify(publication.availability)) as typeof publication.availability,
    async readFacts(productKey: string, signal?: AbortSignal): Promise<ProductEvidenceResult | MissingEvidence> {
      const value = await capability('product_evidence_v1', signal);
      if ('status' in value) return value;
      current(signal); const facts = value as EvidenceCapability;
      return createProductEvidenceReader({ capability: facts, binding: facts.binding, edition,
        isCurrent: options.isCurrent, load: options.loadFacts }).readProduct(productKey, signal);
    },
    async readResponse(productKey: string, request: { bodySha?: string; signal?: AbortSignal } = {}): Promise<ResponseResult | MissingEvidence> {
      const value = await capability('product_response_evidence_v1', request.signal);
      if ('status' in value) return value;
      current(request.signal); const responses = value as ResponseCapability;
      return createProductResponseReader({ capability: responses, binding: responses.binding, edition,
        isCurrent: options.isCurrent, load: options.loadResponse }).readProduct(productKey, request);
    },
  };
}
