/** Lazy immutable evidence acquisition. No speculative prefetch or stale fallback. */
import {
  EVIDENCE_LIMITS, EvidenceError, parseEvidenceJson, sameEvidence, validateEvidenceCapability,
  validateEvidenceIndex, validateEvidenceShard, type EvidenceAsset, type EvidenceBinding,
  type EvidenceFact, type EvidenceIdentity, type EvidenceIndex,
} from './productEvidenceWire';
import { evidenceIndex, forgetEvidenceIndex, reserveEvidence } from './productEvidenceBudget';

export interface EvidenceEdition { repo: 'yanniedog/AR-local'; tag: string; bundle_sha256: string }
export type EvidenceLoader = (url: string, asset: EvidenceAsset, signal?: AbortSignal) => Promise<string>;
export type ProductEvidenceResult = { status: 'unknown'; reason: 'product_not_observed'; absenceIsWithdrawal: false }
  | { status: 'observed'; identity: EvidenceIdentity; facts: EvidenceFact[]; binding: EvidenceBinding;
    edition: EvidenceEdition; renderedCoverageVerified: false; originalBodyIncluded: false };

async function acquire(url: string, asset: EvidenceAsset, signal?: AbortSignal): Promise<string> {
  // Keep the pure validator/import usable in headless audits; load real native IO only on acquisition.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { downloadInflate } = require('./payload') as typeof import('./payload');
  return downloadInflate(url, asset.sha256, { signal, fileName: asset.name, expectedBytes: asset.bytes,
    expectedInflatedBytes: asset.decoded_bytes, maxCompressedBytes: EVIDENCE_LIMITS.compressed,
    maxInflatedBytes: EVIDENCE_LIMITS.shard, requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false });
}

export function createProductEvidenceReader(options: {
  capability: unknown; binding: EvidenceBinding; edition: EvidenceEdition;
  isCurrent: () => boolean; load?: EvidenceLoader;
}) {
  // Defensive copies prevent callers changing a pinned edition while its asynchronous request runs.
  const accepted = validateEvidenceCapability(options.capability, options.binding);
  const capability = JSON.parse(JSON.stringify(accepted)) as typeof accepted;
  const edition = { ...options.edition }, binding = capability.binding;
  if (edition.repo !== 'yanniedog/AR-local' || !/^[a-f0-9]{64}$/.test(edition.bundle_sha256)
      || !new RegExp(`^app-payload-${binding.source.observation_date}-r[0-9]{6,}$`).test(edition.tag)
      || !Number.isSafeInteger(Number(edition.tag.split('-r').pop())) || Number(edition.tag.split('-r').pop()) < 1) {
    throw new EvidenceError('invalid', 'Evidence requires an immutable selected edition');
  }
  const prefix = `https://github.com/${edition.repo}/releases/download/${edition.tag}/`;
  const load = options.load ?? acquire;
  const descriptors = new Map(capability.shards.map(item => [item.sha256, item]));
  const cacheKey = {};

  function current(signal?: AbortSignal) {
    if (signal?.aborted) throw new EvidenceError('cancelled', 'Evidence request cancelled');
    if (!options.isCurrent()) {
      forgetEvidenceIndex(cacheKey);
      throw new EvidenceError('unavailable', 'Selected evidence edition changed');
    }
  }
  async function asset(item: EvidenceAsset, signal?: AbortSignal): Promise<unknown> {
    current(signal);
    const text = await load(prefix + item.name, item, signal);
    current(signal);
    if (new TextEncoder().encode(text).length !== item.decoded_bytes) throw new EvidenceError('invalid', 'Evidence decoded size mismatch');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    current(signal);
    const value = parseEvidenceJson(text, item.decoded_bytes);
    current(signal);
    return value;
  }
  async function index(signal?: AbortSignal): Promise<EvidenceIndex> {
    current(signal);
    const cached = evidenceIndex(cacheKey);
    if (cached) return cached;
    // Failure/abort is never cached; another attempt may retry the same immutable source.
    const parsed = validateEvidenceIndex(await asset(capability.index, signal), capability);
    current(signal);
    evidenceIndex(cacheKey, parsed);
    return parsed;
  }
  async function read(productKey: string, signal?: AbortSignal): Promise<ProductEvidenceResult> {
    const routing = await index(signal);
    const route = routing.products.find(product => product.identity.product_key === productKey);
    current(signal);
    if (!route) return { status: 'unknown', reason: 'product_not_observed', absenceIsWithdrawal: false };
    const byShard = new Map<string, { position: number; sequence: number; facts: number }[]>();
    route.pages.forEach((page, sequence) => {
      const selected = byShard.get(page.shard) ?? [];
      selected.push({ position: page.page, sequence, facts: page.facts });
      byShard.set(page.shard, selected);
    });
    const pages = new Map<number, EvidenceFact[]>(), ids = new Set<string>();
    let readBytes = capability.index.bytes, inflatedBytes = capability.index.decoded_bytes;
    for (const [sha, selected] of byShard) {
      const descriptor = descriptors.get(sha)!;
      readBytes += descriptor.bytes; inflatedBytes += descriptor.decoded_bytes;
      if (readBytes > EVIDENCE_LIMITS.productCompressed + EVIDENCE_LIMITS.compressed
          || inflatedBytes > EVIDENCE_LIMITS.productRaw + EVIDENCE_LIMITS.index) {
        throw new EvidenceError('invalid', 'Product cumulative acquisition budget exceeded');
      }
      const shard = validateEvidenceShard(await asset(descriptor, signal), capability);
      for (const selectedPage of selected) {
        current(signal);
        const page = shard.pages[selectedPage.position];
        if (!page || page.sequence !== selectedPage.sequence || !sameEvidence(page.identity, route.identity)
            || page.facts.length !== selectedPage.facts) throw new EvidenceError('invalid', 'Evidence page identity/count mismatch');
        for (const fact of page.facts) {
          if (ids.has(fact.fact_id)) throw new EvidenceError('invalid', 'Duplicate product fact');
          ids.add(fact.fact_id);
        }
        pages.set(selectedPage.sequence, page.facts);
      }
    }
    current(signal);
    if (ids.size !== route.facts || pages.size !== route.pages.length) throw new EvidenceError('invalid', 'Incomplete product evidence');
    const facts = route.pages.flatMap((_, sequence) => pages.get(sequence)!);
    return { status: 'observed', identity: { ...route.identity }, facts, binding: JSON.parse(JSON.stringify(binding)) as EvidenceBinding,
      edition: { ...edition }, renderedCoverageVerified: false, originalBodyIncluded: false };
  }
  async function readProduct(productKey: string, signal?: AbortSignal): Promise<ProductEvidenceResult> {
    current(signal);
    const release = await reserveEvidence(signal);
    try { return await read(productKey, signal); }
    finally { release(); }
  }
  return { readProduct };
}
