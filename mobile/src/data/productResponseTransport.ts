/** Acquire only an explicitly selected original body from an immutable response namespace. */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { EvidenceError } from './productEvidenceWire';
import { reserveEvidence } from './productEvidenceBudget';
import type { EvidenceEdition } from './productEvidenceTransport';
import { validateResponseIndex } from './productResponseIndex';
import { RESPONSE_LIMITS, parseResponseJson, responseRequire, responseUtf8, validateResponseCapability, validateResponseShard,
  type ResponseAsset, type ResponseBinding, type ResponseBody, type ResponseProduct } from './productResponseWire';

export type ResponseLoader = (url: string, asset: ResponseAsset, signal?: AbortSignal) => Promise<string>;
export type ResponseResult = {
  status: 'unknown'; reason: 'product_not_observed' | 'no_unique_current_body'; route: ResponseProduct | null; absenceIsWithdrawal: false;
} | {
  status: 'observed'; route: ResponseProduct; body: ResponseBody; text: string; role: 'detail' | 'index'; currentMatchesExport: boolean;
  binding: ResponseBinding; edition: EvidenceEdition; renderedCoverageVerified: false; wireBytesIncluded: false; populationCompletenessVerified: false;
};
async function acquire(url: string, asset: ResponseAsset, signal?: AbortSignal): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { downloadInflate } = require('./payload') as typeof import('./payload');
  return downloadInflate(url, asset.sha256, { signal, fileName: asset.name, expectedBytes: asset.bytes,
    expectedInflatedBytes: asset.decoded_bytes, maxCompressedBytes: RESPONSE_LIMITS.compressed,
    maxInflatedBytes: asset.name.startsWith('product-response-index-') ? RESPONSE_LIMITS.index : RESPONSE_LIMITS.asset,
    requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false });
}
export function createProductResponseReader(options: {
  capability: unknown; binding: ResponseBinding; edition: EvidenceEdition; isCurrent: () => boolean; load?: ResponseLoader;
}) {
  const accepted = validateResponseCapability(options.capability, options.binding);
  const capability = JSON.parse(JSON.stringify(accepted)) as typeof accepted, edition = { ...options.edition };
  const date = capability.binding.facts.source.observation_date;
  if (edition.repo !== 'yanniedog/AR-local' || !/^[a-f0-9]{64}$/.test(edition.bundle_sha256)
      || !new RegExp(`^app-payload-${date}-r[0-9]{6,}$`).test(edition.tag)
      || !Number.isSafeInteger(Number(edition.tag.split('-r').pop())) || Number(edition.tag.split('-r').pop()) < 1) {
    throw new EvidenceError('invalid', 'Responses require an immutable selected edition');
  }
  const load = options.load ?? acquire, prefix = `https://github.com/${edition.repo}/releases/download/${edition.tag}/`;
  function current(signal?: AbortSignal) {
    if (signal?.aborted) throw new EvidenceError('cancelled', 'Response request cancelled');
    if (!options.isCurrent()) throw new EvidenceError('unavailable', 'Selected response edition changed');
  }
  async function asset(descriptor: ResponseAsset, signal?: AbortSignal): Promise<unknown> {
    current(signal);
    const text = await load(prefix + descriptor.name, descriptor, signal);
    current(signal);
    responseRequire(text.length <= descriptor.decoded_bytes && responseUtf8(text).length === descriptor.decoded_bytes, 'Response decoded size mismatch');
    await new Promise<void>(resolve => setTimeout(resolve, 0)); current(signal);
    return parseResponseJson(text, descriptor.decoded_bytes);
  }
  async function read(productKey: string, request: { bodySha?: string; signal?: AbortSignal }): Promise<ResponseResult> {
    const { signal } = request;
    const index = validateResponseIndex(await asset(capability.index, signal), capability);
    const route = index.products.find(item => item.identity.product_key === productKey);
    current(signal);
    if (!route) return { status: 'unknown', reason: 'product_not_observed', route: null, absenceIsWithdrawal: false };
    const selected = request.bodySha === undefined ? route.current_body_sha256 : request.bodySha;
    if (selected === null) return { status: 'unknown', reason: 'no_unique_current_body', route, absenceIsWithdrawal: false };
    const detail = route.details.find(item => item.sha256 === selected), isIndex = route.indexes.includes(selected);
    responseRequire(detail || isIndex, 'Requested original body is not declared for this product');
    const body = index.bodies.find(item => item.sha256 === selected)!;
    const byShard = new Map<string, typeof body.chunks>();
    for (const chunk of body.chunks) { const list = byShard.get(chunk.shard) ?? []; list.push(chunk); byShard.set(chunk.shard, list); }
    const pieces = new Map<number, string>();
    let compressed = capability.index.bytes, inflated = capability.index.decoded_bytes;
    for (const [sha, selectedChunks] of byShard) {
      const descriptor = capability.shards.find(item => item.sha256 === sha)!;
      compressed += descriptor.bytes; inflated += descriptor.decoded_bytes;
      responseRequire(compressed <= RESPONSE_LIMITS.productCompressed + RESPONSE_LIMITS.compressed
        && inflated <= RESPONSE_LIMITS.productRaw + RESPONSE_LIMITS.index, 'Response cumulative acquisition budget exceeded');
      const shard = validateResponseShard(await asset(descriptor, signal), capability, index, sha);
      for (const chunk of selectedChunks) pieces.set(chunk.offset, shard.pages[chunk.page].text);
      current(signal);
    }
    const digest = sha256.create(), ordered: string[] = [];
    let offset = 0;
    for (const chunk of body.chunks) {
      current(signal); const text = pieces.get(chunk.offset);
      responseRequire(text !== undefined && chunk.offset === offset, 'Incomplete original response body');
      const raw = responseUtf8(text); digest.update(raw); offset += raw.length; ordered.push(text);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    current(signal);
    responseRequire(offset === body.bytes && bytesToHex(digest.digest()) === body.sha256, 'Original response hash/size mismatch');
    return { status: 'observed', route, body, text: ordered.join(''), role: detail ? 'detail' : 'index',
      currentMatchesExport: route.state === 'matched' && selected === route.current_body_sha256,
      binding: JSON.parse(JSON.stringify(capability.binding)) as ResponseBinding, edition: { ...edition },
      renderedCoverageVerified: false, wireBytesIncluded: false, populationCompletenessVerified: false };
  }
  async function readProduct(productKey: string, request: { bodySha?: string; signal?: AbortSignal } = {}): Promise<ResponseResult> {
    current(request.signal); const release = await reserveEvidence(request.signal);
    try { return await read(productKey, request); } finally { release(); }
  }
  return { readProduct };
}
