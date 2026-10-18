import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { strFromU8 } from 'fflate';
import type { Manifest } from '../types';
import { canonical, hashText } from '../lib/productTermsEngine/validation';
import { parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
import { downloadInflate, gunzipCooperatively } from './payload';
import { publicRateAssetCache } from './publicRateCache';
import type { PublicCoverage, PublicEvidence, PublicFeeSet, PublicProduct, PublicProgramme, PublicRateAsset, PublicRateIndex, PublicRateShard, PublicReferenceRate } from './publicRateModel';
import { PUBLIC_RATE_INDEX_COMPRESSED, PUBLIC_RATE_INDEX_DECODED, PUBLIC_RATE_SHARD_COMPRESSED, PUBLIC_RATE_SHARD_DECODED, validatePublicRateCapability, validatePublicRateDiscovery, validatePublicRateIndex, validatePublicRateShard } from './publicRateWire';

export interface PublicRateCatalogueState {
  status: 'unavailable' | 'loading' | 'ready' | 'error';
  products: PublicProduct[];
  coverage: PublicCoverage[];
  references: PublicReferenceRate[];
  evidence: PublicEvidence[];
  allLoaded: boolean;
  error: string | null;
  generationId: string | null;
  getProduct(productKey: string): PublicProduct | undefined;
  getProgrammes(productId: string): PublicProgramme[];
  loadProduct(productId: string): Promise<void>;
  loadAll(): Promise<void>;
}
interface CatalogueClient { snapshot(): PublicRateCatalogueState; subscribe(listener: () => void): () => void; start(): Promise<void> }
const clients = new Map<string, CatalogueClient>();
let mostRecent: PublicRateCatalogueState | undefined;
let activeClient: CatalogueClient | undefined;
const unavailable: PublicRateCatalogueState = { status: 'unavailable', products: [], coverage: [], references: [], evidence: [], allLoaded: false, error: null, generationId: null,
  getProduct: () => undefined, getProgrammes: () => [], loadProduct: async () => undefined, loadAll: async () => undefined };

async function acquire(edition: string, asset: PublicRateAsset, isIndex: boolean): Promise<unknown> {
  const maximum = isIndex ? PUBLIC_RATE_INDEX_DECODED : PUBLIC_RATE_SHARD_DECODED;
  const retained = await publicRateAssetCache.read(edition, asset).catch(() => null);
  if (retained) {
    const decoded = await gunzipCooperatively(retained, 64 * 1024, maximum);
    if (decoded.length !== asset.decodedBytes || bytesToHex(sha256(retained)) !== asset.sha256) throw new Error('Retained public rate bytes mismatch');
    return parseJsonHeavy(strFromU8(decoded));
  }
  let compressed: Uint8Array | undefined;
  const text = await downloadInflate(asset.url, asset.sha256, { fileName: asset.name, expectedBytes: asset.bytes,
    expectedInflatedBytes: asset.decodedBytes, requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false,
    maxCompressedBytes: isIndex ? PUBLIC_RATE_INDEX_COMPRESSED : PUBLIC_RATE_SHARD_COMPRESSED, maxInflatedBytes: maximum,
    onVerifiedBytes: value => { compressed = value; } });
  const result = await parseJsonHeavy<unknown>(text);
  if (compressed) await publicRateAssetCache.retain(edition, asset, compressed).catch(() => undefined);
  return result;
}

export function createPublicRateCatalogueClient(manifest: Manifest,
  acquisition: (asset: PublicRateAsset, isIndex: boolean) => Promise<unknown> = (asset, isIndex) => acquire(hashText(canonical(manifest.public_rate_catalogue)), asset, isIndex)): CatalogueClient {
  const capability = validatePublicRateCapability(manifest);
  if (!capability) return { snapshot: () => unavailable, subscribe: () => () => undefined, start: async () => undefined };
  const listeners = new Set<() => void>(), loaded = new Map<string, PublicRateShard>(), pending = new Map<string, Promise<void>>();
  const productsByKey = new Map<string, PublicProduct>(), programmesByProduct = new Map<string, PublicProgramme[]>();
  const feeSets = new Map<string, PublicFeeSet>();
  let index: PublicRateIndex | undefined, startPromise: Promise<void> | undefined, discoveryComplete = false;
  const getProduct = (key: string) => productsByKey.get(key);
  const getProgrammes = (productId: string) => programmesByProduct.get(productId) ?? [];
  let state: PublicRateCatalogueState;
  const publish = (error: string | null = null) => {
    const programmes = [...loaded.values()].flatMap(shard => shard.programmes);
    const programmeIds = new Set(programmes.map(programme => programme.programmeId));
    const products = [...productsByKey.values()];
    const complete = discoveryComplete && loaded.size === capability.shards.length;
    const absent = complete && products.some(product => product.programmeIds.some(id => !programmeIds.has(id)));
    const missingFees = complete && programmes.some(programme => programme.feeSetId && !feeSets.has(programme.feeSetId));
    programmesByProduct.clear();
    for (const programme of programmes) {
      const fees = programme.feeSetId ? feeSets.get(programme.feeSetId) : undefined;
      const hydrated = fees ? { ...programme, fees: fees.fees, feeCoverage: fees.feeCoverage } : programme;
      const prior = programmesByProduct.get(programme.productId) ?? [];
      if (!prior.some(item => item.programmeId === programme.programmeId)) programmesByProduct.set(programme.productId, [...prior, hydrated]);
    }
    const references = [...loaded.values()].flatMap(shard => shard.referenceRates);
    state = { ...state, status: error || absent || missingFees ? 'error' : discoveryComplete ? 'ready' : 'loading', products, coverage: index?.coverage ?? [],
      references: [...new Map(references.map(reference => [canonical(reference), reference])).values()],
      evidence: [...new Map([...products.flatMap(product => product.sourceEvidence ? [product.sourceEvidence] : []), ...[...loaded.values()].flatMap(shard => shard.evidence)].map(item => [item.evidenceId, item])).values()],
      allLoaded: complete && !absent && !missingFees && !error, error: error ?? (absent ? 'Declared public pricing programme is missing' : missingFees ? 'Declared public pricing fees are missing' : null) };
    if (activeClient?.snapshot() === state) mostRecent = state;
    listeners.forEach(listener => listener());
  };
  const start = () => {
    if (!startPromise) startPromise = acquisition(capability.index, true).then(async raw => {
      index = validatePublicRateIndex(raw, manifest); index.products.forEach(product => productsByKey.set(product.productKey, product)); publish();
      const discovery = capability.shards.filter(asset => index!.routes?.some(route => route.name === asset.name && route.kind === 'discovery'));
      let cursor = 0;
      const worker = async () => { while (cursor < discovery.length) { await loadShard(discovery[cursor++]); await yieldToUi(0); } };
      await Promise.all([worker(), worker()]);
      validatePublicRateDiscovery(index, [...productsByKey.values()]);
      discoveryComplete = true; publish();
    }).catch((error: unknown) => {
      publish(error instanceof Error ? error.message : 'Public rate catalogue unavailable'); startPromise = undefined; throw error;
    });
    return startPromise;
  };
  const loadShard = (asset: PublicRateAsset): Promise<void> => {
    if (loaded.has(asset.name)) return Promise.resolve();
    const prior = pending.get(asset.name); if (prior) return prior;
    const task = acquisition(asset, false).then(raw => {
      const shard = validatePublicRateShard(raw, manifest, index!, asset, [...productsByKey.values()]);
      const existing = [...loaded.values()];
      const nextProducts = new Map(productsByKey);
      const productIds = new Set([...productsByKey.values()].map(product => product.productId));
      for (const product of shard.products ?? []) {
        if (nextProducts.has(product.productKey) || productIds.has(product.productId)) throw new Error('Conflicting public product identity');
        nextProducts.set(product.productKey, product); productIds.add(product.productId);
      }
      if (nextProducts.size > 20000) throw new Error('Public product discovery exceeds its identity bound');
      for (const programme of shard.programmes) if (existing.some(other => other.programmes.some(item => item.programmeId === programme.programmeId && canonical(item) !== canonical(programme)))) throw new Error('Conflicting public programme identity');
      for (const evidence of shard.evidence) if (existing.some(other => other.evidence.some(item => item.evidenceId === evidence.evidenceId && canonical(item) !== canonical(evidence)))) throw new Error('Conflicting public evidence identity');
      const nextFees = new Map(feeSets);
      for (const fees of shard.feeSets ?? []) {
        const prior = nextFees.get(fees.feeSetId);
        if (prior && canonical(prior) !== canonical(fees)) throw new Error('Conflicting public fee set identity');
        nextFees.set(fees.feeSetId, fees);
      }
      for (const programme of [...existing.flatMap(item => item.programmes), ...shard.programmes]) if (programme.feeSetId && nextFees.has(programme.feeSetId) && nextFees.get(programme.feeSetId)!.productId !== programme.productId) throw new Error('Fee set belongs to another product');
      nextFees.forEach((fees, id) => feeSets.set(id, fees));
      nextProducts.forEach((product, key) => productsByKey.set(key, product));
      loaded.set(asset.name, shard);
      publish();
    }).catch((error: unknown) => { publish(error instanceof Error ? error.message : 'Public pricing shard unavailable'); throw error; }).finally(() => { pending.delete(asset.name); });
    pending.set(asset.name, task); return task;
  };
  const loadProduct = async (productId: string) => {
    await start();
    const routes = index!.shards.filter(shard => shard.productIds.includes(productId));
    for (const route of routes) await loadShard(capability.shards.find(asset => asset.name === route.name)!);
  };
  const loadAll = async () => {
    await start();
    let cursor = 0;
    const worker = async () => { while (cursor < capability.shards.length) { const asset = capability.shards[cursor++]; await loadShard(asset); await yieldToUi(0); } };
    await Promise.all([worker(), worker()]); publish();
  };
  state = { ...unavailable, status: 'loading', generationId: capability.generationId, getProduct, getProgrammes, loadProduct, loadAll };
  return { snapshot: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, start };
}

function clientFor(manifest: Manifest | null): CatalogueClient {
  if (!manifest?.public_rate_catalogue) return { snapshot: () => unavailable, subscribe: () => () => undefined, start: async () => undefined };
  const key = `${manifest.payload_revision?.bundle_sha256 ?? ''}:${hashText(canonical(manifest.public_rate_catalogue))}`;
  const cached = clients.get(key); if (cached) return cached;
  let client: CatalogueClient;
  try { client = createPublicRateCatalogueClient(manifest); }
  catch (error) {
    const failed = { ...unavailable, status: 'error' as const, error: error instanceof Error ? error.message : 'Invalid public rate catalogue' };
    client = { snapshot: () => failed, subscribe: () => () => undefined, start: async () => undefined };
  }
  while (clients.size >= 2) clients.delete(clients.keys().next().value!);
  clients.set(key, client); return client;
}

/** Index discovery is lazy after render; evidence and programme shards load only when needed. */
export function usePublicRateCatalogue(manifest: Manifest | null): PublicRateCatalogueState {
  const client = useMemo(() => clientFor(manifest), [manifest]);
  const snapshot = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot);
  useEffect(() => { activeClient = client; mostRecent = client.snapshot(); void client.start().catch(() => undefined); }, [client]);
  return snapshot;
}

/** Only currently adopted public metadata, for local stable-selection persistence. */
export function getPublicRateCatalogueSnapshot(manifest?: Manifest | null): PublicRateCatalogueState {
  return manifest ? clientFor(manifest).snapshot() : mostRecent ?? unavailable;
}

/** Uses the existing refresh lifecycle; never schedules or starts background work itself. */
export async function ensurePublicRateCatalogueLoaded(manifest: Manifest | null, all = true): Promise<PublicRateCatalogueState> {
  const client = clientFor(manifest);
  await client.start();
  if (all) await client.snapshot().loadAll();
  return client.snapshot();
}
