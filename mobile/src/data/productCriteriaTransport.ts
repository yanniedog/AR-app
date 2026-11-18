import type { Manifest, ManifestFile, ProductDetail } from '../types';
import { normalizedProductFacts } from './productFactsCore';
import { yieldToUi } from '../lib/yieldToUi';
import { parseBoundedEvidenceJson } from './productEvidenceJson';
import { decodeCriteriaProducts, CRITERIA_TREE_LIMITS } from './productCriteriaWire';

export const CRITERIA_LIMITS = { products: 20_000, shards: 256, compressed: 1024 ** 2,
  index: 8 * 1024 ** 2, shard: 4 * 1024 ** 2, totalCompressed: 16 * 1024 ** 2, totalRaw: 32 * 1024 ** 2 };
type Source = { generation_id: string; contract_digest: string };
export type CriteriaLookup = Record<string, ProductDetail>;
type Index = { schema_version: 1 | 2; scope: 'product-filter-facets-v1'; run_date: string; source: Source; products: Record<string, string>;
  coverage: { productsExpected: number; productsObserved: number; complete: true } };
type Shard = { schema_version: 1 | 2; scope: 'product-filter-facets-v1'; run_date: string; source: Source; products: CriteriaLookup };
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function sameSource(value: unknown, source: Source): boolean {
  return record(value) && Object.keys(value).length === 2 && value.generation_id === source.generation_id && value.contract_digest === source.contract_digest;
}

/** Every shard verifies before a catalogue lookup is exposed. A partial fetch
 * never masquerades as a complete filter inventory. No startup acquisition. */
export function createProductCriteriaReader(manifest: Manifest, options: {
  isCurrent: () => boolean; load?: (file: ManifestFile, maxRaw: number, signal?: AbortSignal) => Promise<string>;
  yieldControl?: () => Promise<void>; productKeys?: readonly string[]; retainDocuments?: boolean;
}) {
  requireValue(manifest.repo === 'yanniedog/AR-local' && manifest.payload_revision
    && /^app-payload-\d{4}-\d{2}-\d{2}-r\d{6,}$/.test(manifest.tag), 'Criteria require immutable payload edition');
  const source = manifest.source_observation;
  requireValue(source && typeof source.generation_id === 'string' && source.generation_id.length > 0
    && /^[a-f0-9]{64}$/.test(source.contract_digest ?? ''), 'Criteria source binding unavailable');
  const binding: Source = { generation_id: source.generation_id, contract_digest: source.contract_digest! };
  const prefix = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/`;
  const files = manifest.files as Record<string, ManifestFile | undefined>;
  const yieldControl = options.yieldControl ?? (() => yieldToUi(0));
  const load = options.load ?? readCriteriaAsset;
  return { async read(signal?: AbortSignal): Promise<CriteriaLookup> {
    let compressed = 0, raw = 0;
    function current() { requireValue(options.isCurrent() && !signal?.aborted, 'Criteria edition changed or cancelled'); }
    async function acquire(key: string, maximum: number): Promise<unknown> {
      current(); const file = files[key];
      requireValue(file && /^[A-Za-z0-9_.-]+$/.test(file.name) && file.url === prefix + file.name
        && /^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes)
        && file.bytes > 0 && file.bytes <= CRITERIA_LIMITS.compressed && !file.enc, 'Invalid criteria descriptor');
      compressed += file.bytes; requireValue(compressed <= CRITERIA_LIMITS.totalCompressed, 'Criteria compressed budget');
      const text = await load(file, maximum, signal); current();
      const bytes = new TextEncoder().encode(text).length;
      raw += bytes; requireValue(bytes <= maximum && raw <= CRITERIA_LIMITS.totalRaw, 'Criteria expanded budget');
      await yieldControl(); current(); return parseBoundedEvidenceJson(text, maximum, CRITERIA_TREE_LIMITS.nodes + CRITERIA_TREE_LIMITS.strings + CRITERIA_TREE_LIMITS.keys + 64);
    }
    const index = await acquire('product_criteria_index', CRITERIA_LIMITS.index) as Index;
    requireValue(record(index) && Object.keys(index).length === 6 && [1, 2].includes(index.schema_version) && index.scope === 'product-filter-facets-v1' && index.run_date === manifest.run_date
      && sameSource(index.source, binding) && record(index.products) && record(index.coverage), 'Invalid criteria index');
    const keys = Object.keys(index.products);
    requireValue(keys.length > 0 && keys.length <= CRITERIA_LIMITS.products && keys.every(key => key.length > 0 && key.length <= 2048 && !['__proto__', 'prototype', 'constructor'].includes(key))
      && Object.keys(index.coverage).length === 3 && index.coverage.complete === true && index.coverage.productsExpected === keys.length
      && index.coverage.productsObserved === keys.length, 'Incomplete criteria catalogue');
    const requested = options.productKeys === undefined ? keys : [...new Set(options.productKeys)];
    requireValue(requested.length > 0 && requested.length <= keys.length && requested.every(key => Object.hasOwn(index.products, key)), 'Missing requested criteria products');
    const targets = new Set(requested);
    const routes = new Set(Object.values(index.products));
    requireValue(routes.size <= CRITERIA_LIMITS.shards && [...routes].every(key => /^product_criteria_shard_\d{3}$/.test(key)), 'Invalid criteria routes');
    const reserved = Object.keys(files).filter(key => key.startsWith('product_criteria_'));
    requireValue(reserved.length === routes.size + 1 && reserved.every(key => key === 'product_criteria_index' || routes.has(key)), 'Extraneous criteria assets');
    const result: CriteriaLookup = Object.create(null), decodeBudget = { nodes: 0 };
    for (const route of new Set(requested.map(key => index.products[key]))) {
      const shard = await acquire(route, CRITERIA_LIMITS.shard) as Shard;
      requireValue(record(shard) && Object.keys(shard).length === (index.schema_version === 2 ? 7 : 5)
        && shard.schema_version === index.schema_version && shard.scope === index.scope && shard.run_date === manifest.run_date
        && sameSource(shard.source, binding) && record(shard.products), 'Invalid criteria shard');
      const products = await decodeCriteriaProducts(shard, decodeBudget, async () => { current(); await yieldControl(); current(); });
      requireValue(Object.keys(products).length === keys.filter(key => index.products[key] === route).length, 'Incomplete criteria shard routes');
      for (const [key, detail] of Object.entries(products)) {
        requireValue(Object.hasOwn(index.products, key) && index.products[key] === route && !Object.hasOwn(result, key)
          && record(detail) && Array.isArray(detail.facts), 'Invalid criteria product route');
        const facts = normalizedProductFacts(detail);
        requireValue(facts.length === detail.facts.length && new Set(facts.map(fact => fact.id)).size === facts.length, 'Invalid or duplicate criteria facts');
        requireValue(detail.sourceDocuments === undefined || Array.isArray(detail.sourceDocuments)
          && detail.sourceDocuments.every(doc => record(doc) && typeof doc.url === 'string'
            && typeof doc.sourcePath === 'string' && typeof doc.relation === 'string'), 'Invalid criteria documents');
        if (targets.has(key)) result[key] = { facts, ...(options.retainDocuments !== false && detail.sourceDocuments ? { sourceDocuments: detail.sourceDocuments } : {}) };
      }
      current(); await yieldControl();
    }
    requireValue(Object.keys(result).length === requested.length, 'Missing criteria products'); current();
    return result;
  } };
}

/** Shared transport primitive; scope and caches never bypass byte admission. */
export async function readCriteriaAsset(file: ManifestFile, maximum: number, signal?: AbortSignal): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { downloadInflate } = require('./payload') as typeof import('./payload');
    return downloadInflate(file.url, file.sha256, { signal, fileName: file.name, expectedBytes: file.bytes,
      requireExactBytes: true, maxCompressedBytes: CRITERIA_LIMITS.compressed, maxInflatedBytes: maximum, allowEncrypted: false });
}
