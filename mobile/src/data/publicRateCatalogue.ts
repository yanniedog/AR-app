import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
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
  /** Audit-only limitation; never installed in the normal catalogue client. */
  auditUnavailableReason?: 'cache-miss';
  getProduct(productKey: string): PublicProduct | undefined;
  getProgrammes(productId: string): PublicProgramme[];
  loadProduct(productId: string): Promise<void>;
  loadAll(): Promise<void>;
}
interface CatalogueClient { snapshot(): PublicRateCatalogueState; subscribe(listener: () => void): () => void; start(): Promise<void> }
const clients = new Map<string, CatalogueClient>();
// Includes clients evicted from the small cache while their workers still run.
const normalCatalogueWork = new Set<object>();
let mostRecent: PublicRateCatalogueState | undefined;
let activeClient: CatalogueClient | undefined;
let activeManifestKey: string | undefined;
const auditListeners = new Set<() => void>();
let auditReservation: { owner: object; released: Promise<void>; resume: () => void;
  snapshots: WeakMap<CatalogueClient, { original: PublicRateCatalogueState; reserved: PublicRateCatalogueState }> } | undefined;
function reservedSnapshot(client: CatalogueClient): PublicRateCatalogueState {
  const state = client.snapshot(), lease = auditReservation;
  if (!lease) return state;
  const previous = lease.snapshots.get(client);
  if (previous?.original === state) return previous.reserved;
  const reserved = { ...state,
    loadProduct: async (id: string) => { await lease.released; await client.snapshot().loadProduct(id); },
    loadAll: async () => { await lease.released; await client.snapshot().loadAll(); },
  };
  lease.snapshots.set(client, { original: state, reserved });
  return reserved;
}
let auditOverlay: { owner: object; key: string; state: PublicRateCatalogueState } | undefined;
const malformedManifestKeys = new WeakMap<Manifest, string>();
let malformedManifestSequence = 0;
function manifestKey(manifest: Manifest): string | undefined {
  // Legacy publications have no catalogue capability and require no key.
  if (!manifest.public_rate_catalogue) return undefined;
  try {
    return `${manifest.payload_revision?.bundle_sha256 ?? ''}:${hashText(canonical(manifest.public_rate_catalogue))}`;
  } catch {
    // Non-JSON capability data must reach the normal failed-client validation
    // view, rather than throwing while a React hook derives its cache identity.
    let key = malformedManifestKeys.get(manifest);
    if (!key) { key = `invalid-public-rate-capability:${++malformedManifestSequence}`; malformedManifestKeys.set(manifest, key); }
    return key;
  }
}
class LocalCatalogueCacheMiss extends Error {}
function assertCatalogueActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Public pricing catalogue loading cancelled');
}
const unavailable: PublicRateCatalogueState = { status: 'unavailable', products: [], coverage: [], references: [], evidence: [], allLoaded: false, error: null, generationId: null,
  getProduct: () => undefined, getProgrammes: () => [], loadProduct: async () => undefined, loadAll: async () => undefined };
// A legacy manifest has one immutable absence snapshot. Audit reservations cache
// wrappers by client identity, so recreating this client makes unchanged absence
// look like a new catalogue revision on every read.
const unavailableClient: CatalogueClient = { snapshot: () => unavailable,
  subscribe: () => () => undefined, start: async () => undefined };

async function acquire(edition: string, asset: PublicRateAsset, isIndex: boolean, signal?: AbortSignal, localOnly = false): Promise<unknown> {
  assertCatalogueActive(signal);
  const maximum = isIndex ? PUBLIC_RATE_INDEX_DECODED : PUBLIC_RATE_SHARD_DECODED;
  const retained = await publicRateAssetCache.read(edition, asset, { strict: localOnly || isLocalAppHealthAudit() });
  assertCatalogueActive(signal);
  if (retained) {
    const decoded = await gunzipCooperatively(retained, 64 * 1024, maximum);
    assertCatalogueActive(signal);
    if (decoded.length !== asset.decodedBytes || bytesToHex(sha256(retained)) !== asset.sha256) throw new Error('Retained public rate bytes mismatch');
    return parseJsonHeavy(strFromU8(decoded));
  }
  if (localOnly || isLocalAppHealthAudit()) throw new LocalCatalogueCacheMiss('Public pricing is unavailable in the retained offline cache.');
  let compressed: Uint8Array | undefined;
  const text = await downloadInflate(asset.url, asset.sha256, { signal, fileName: asset.name, expectedBytes: asset.bytes,
    expectedInflatedBytes: asset.decodedBytes, requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false,
    maxCompressedBytes: isIndex ? PUBLIC_RATE_INDEX_COMPRESSED : PUBLIC_RATE_SHARD_COMPRESSED, maxInflatedBytes: maximum,
    onVerifiedBytes: value => { compressed = value; } });
  assertCatalogueActive(signal);
  const result = await parseJsonHeavy<unknown>(text);
  assertCatalogueActive(signal);
  if (compressed) await publicRateAssetCache.retain(edition, asset, compressed).catch(() => undefined);
  return result;
}

export function createPublicRateCatalogueClient(manifest: Manifest,
  acquisition: (asset: PublicRateAsset, isIndex: boolean) => Promise<unknown> = (asset, isIndex) => acquire(hashText(canonical(manifest.public_rate_catalogue)), asset, isIndex),
  lifecycle: { signal?: AbortSignal; abort?: () => void; normalOwner?: object } = {}): CatalogueClient {
  let workCount = 0;
  const tracked = <T,>(work: () => Promise<T>): Promise<T> => {
    // Gate the original methods too: callers can retain a pre-audit snapshot.
    if (lifecycle.normalOwner && auditReservation) return auditReservation.released.then(() => tracked(work));
    if (lifecycle.normalOwner && workCount++ === 0) normalCatalogueWork.add(lifecycle.normalOwner);
    return (async () => { try { return await work(); } finally {
      if (lifecycle.normalOwner && --workCount === 0) normalCatalogueWork.delete(lifecycle.normalOwner);
    } })();
  };
  const active = () => assertCatalogueActive(lifecycle.signal);
  const workers = async (work: () => Promise<void>) => {
    let firstFailure: unknown;
    const guarded = async () => { try { await work(); } catch (error) { firstFailure ??= error; lifecycle.abort?.(); throw error; } };
    const results = await Promise.allSettled([guarded(), guarded()]);
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw firstFailure ?? failure.reason;
    active();
  };
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
  const start = () => tracked(async () => {
    active();
    if (!startPromise) startPromise = acquisition(capability.index, true).then(async raw => {
      active();
      index = validatePublicRateIndex(raw, manifest); index.products.forEach(product => productsByKey.set(product.productKey, product)); publish();
      const discovery = capability.shards.filter(asset => index!.routes?.some(route => route.name === asset.name && route.kind === 'discovery'));
      let cursor = 0;
      const worker = async () => { while (cursor < discovery.length) { active(); await loadShard(discovery[cursor++]); await yieldToUi(0); } };
      await workers(worker);
      validatePublicRateDiscovery(index, [...productsByKey.values()]);
      discoveryComplete = true; publish();
    }).catch((error: unknown) => {
      if (!(error instanceof LocalCatalogueCacheMiss)) publish(error instanceof Error ? error.message : 'Public rate catalogue unavailable'); startPromise = undefined; throw error;
    });
    return startPromise;
  });
  const loadShard = (asset: PublicRateAsset): Promise<void> => {
    active();
    if (loaded.has(asset.name)) return Promise.resolve();
    const prior = pending.get(asset.name); if (prior) return prior;
    const task = acquisition(asset, false).then(raw => {
      active();
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
    }).catch((error: unknown) => { if (!(error instanceof LocalCatalogueCacheMiss)) publish(error instanceof Error ? error.message : 'Public pricing shard unavailable'); throw error; }).finally(() => { pending.delete(asset.name); });
    pending.set(asset.name, task); return task;
  };
  const loadProduct = (productId: string) => tracked(async () => {
    await start();
    const routes = index!.shards.filter(shard => shard.productIds.includes(productId));
    for (const route of routes) await loadShard(capability.shards.find(asset => asset.name === route.name)!);
  });
  const loadAll = () => tracked(async () => {
    await start();
    let cursor = 0;
    const worker = async () => { while (cursor < capability.shards.length) { active(); const asset = capability.shards[cursor++]; await loadShard(asset); await yieldToUi(0); } };
    await workers(worker); publish();
  });
  state = { ...unavailable, status: 'loading', generationId: capability.generationId, getProduct, getProgrammes, loadProduct, loadAll };
  return { snapshot: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, start };
}

function clientFor(manifest: Manifest | null): CatalogueClient {
  if (!manifest?.public_rate_catalogue) return unavailableClient;
  const key = manifestKey(manifest)!;
  const cached = clients.get(key); if (cached) return cached;
  let client: CatalogueClient;
  try { client = createPublicRateCatalogueClient(manifest, undefined, { normalOwner: {} }); }
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
  const key = manifest ? manifestKey(manifest) : undefined;
  const read = useCallback(() => auditOverlay && auditOverlay.key === key ? auditOverlay.state : reservedSnapshot(client), [client, key]);
  const subscribe = useCallback((listener: () => void) => {
    auditListeners.add(listener);
    const unsubscribe = client.subscribe(listener);
    return () => { auditListeners.delete(listener); unsubscribe(); };
  }, [client]);
  const snapshot = useSyncExternalStore(subscribe, read, read);
  const auditOwner = auditReservation?.owner;
  useEffect(() => {
    activeClient = client; activeManifestKey = key; mostRecent = read();
    if (!auditReservation) void client.start().catch(() => undefined);
  }, [client, key, read, auditOwner]);
  return snapshot;
}

/** Only currently adopted public metadata, for local stable-selection persistence. */
export function getPublicRateCatalogueSnapshot(manifest?: Manifest | null): PublicRateCatalogueState {
  const key = manifest ? manifestKey(manifest) : activeManifestKey;
  if (auditOverlay && auditOverlay.key === key) return auditOverlay.state;
  return manifest ? reservedSnapshot(clientFor(manifest)) : activeClient ? reservedSnapshot(activeClient) : mostRecent ?? unavailable;
}

/** Uses the existing refresh lifecycle; never schedules or starts background work itself. */
export async function ensurePublicRateCatalogueLoaded(manifest: Manifest | null, all = true): Promise<PublicRateCatalogueState> {
  const client = clientFor(manifest);
  await client.start();
  if (all) await client.snapshot().loadAll();
  return client.snapshot();
}


export interface AuditPublicRateCatalogueLoad {
  ready: Promise<PublicRateCatalogueState>;
  /** Abort owned transport and wait for every issued worker, even if transport ignores abort. */
  cancelAndDrain(): Promise<void>;
  /** Restore original data with UI loads still reserved until release. */
  quiesce(): void;
  /** Call after transport guard restoration, so normal UI effects use normal policy. */
  release(): void;
}

/** Reserve synchronously before installing an audit guard or awaiting setup. */
export function beginPublicRateCatalogueAudit() {
  if (normalCatalogueWork.size) throw new Error('Public pricing catalogue work is in progress. Retry the audit after it finishes.');
  if (auditReservation) throw new Error('Public pricing catalogue preparation already belongs to an audit');
  const controller = new AbortController(), owner = {};
  let resume!: () => void;
  const released = new Promise<void>(resolve => { resume = resolve; });
  auditReservation = { owner, released, resume, snapshots: new WeakMap() };
  let quiescePrepared = () => undefined as void;
  const release = () => {
    controller.abort();
    if (auditReservation?.owner !== owner) return;
    if (auditOverlay?.owner === owner) auditOverlay = undefined;
    const lease = auditReservation;
    auditReservation = undefined;
    lease.resume();
    auditListeners.forEach(listener => listener());
  };
  const prepare = (manifest: Manifest): AuditPublicRateCatalogueLoad => {
    if (auditReservation?.owner !== owner || controller.signal.aborted) throw new Error('Public pricing catalogue audit reservation has ended');
    const normalClient = clientFor(manifest), existing = normalClient.snapshot();
    const key = manifestKey(manifest);
    if (!key) return { ready: Promise.resolve(existing), cancelAndDrain: async () => undefined, quiesce: () => undefined, release };
    const quiesce = quiescePrepared = () => {
      controller.abort();
      if (auditOverlay?.owner !== owner) return;
      auditOverlay = { owner, key, state: reservedSnapshot(normalClient) };
      auditListeners.forEach(listener => listener());
    };
    // The warm path keeps its validated snapshot and does no acquisition, while
    // still reserving different-generation UI requests until audit teardown.
    if (existing.status === 'ready' && existing.allLoaded) {
      auditOverlay = { owner, key, state: existing };
      auditListeners.forEach(listener => listener());
      return { ready: Promise.resolve(existing), cancelAndDrain: async () => { controller.abort(); }, quiesce, release };
    }
    const localOnly = isLocalAppHealthAudit();
    const retainedValues = new Map<string, unknown>();
    let client: CatalogueClient;
    try {
      client = createPublicRateCatalogueClient(manifest,
        (asset, isIndex) => localOnly ? Promise.resolve(retainedValues.get(asset.name))
          : acquire(hashText(canonical(manifest.public_rate_catalogue)), asset, isIndex, controller.signal),
        { signal: controller.signal, abort: () => controller.abort() });
    } catch (error) { release(); throw error; }
    // While preparing, mounted hooks retain usable metadata but route their
    // load requests to this lease instead of starting shared-client requests.
    let ready!: Promise<PublicRateCatalogueState>;
    const pendingState = { ...existing, loadProduct: async () => { await ready; }, loadAll: async () => { await ready; } };
    auditOverlay = { owner, key, state: pendingState };
    let cancelled = false;
    ready = (async () => {
      try {
        if (localOnly) {
          // Inspect every retained asset before choosing the absence fallback.
          // Missing entries never cancel sibling validation, and hard failures
          // take priority. Keep decoded results for the client's schema checks.
          const capability = validatePublicRateCapability(manifest)!;
          const assets = [capability.index, ...capability.shards];
          const edition = hashText(canonical(manifest.public_rate_catalogue));
          let cursor = 0, missing: LocalCatalogueCacheMiss | undefined;
          const inspect = async () => {
            while (cursor < assets.length) {
              const asset = assets[cursor++];
              try {
                retainedValues.set(asset.name, await acquire(edition, asset, asset === capability.index, controller.signal, true));
              } catch (error) {
                if (!(error instanceof LocalCatalogueCacheMiss)) throw error;
                missing ??= error;
              }
              await yieldToUi(0);
            }
          };
          const outcomes = await Promise.allSettled([inspect(), inspect()]);
          const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
          if (failure) throw failure.reason;
          assertCatalogueActive(controller.signal);
          const index = retainedValues.has(capability.index.name)
            ? validatePublicRateIndex(retainedValues.get(capability.index.name), manifest) : null;
          const discoveries = capability.shards.filter(asset => index?.routes?.some(route => route.name === asset.name && route.kind === 'discovery'));
          const products = [...(index?.products ?? [])];
          for (const asset of discoveries) {
            if (retainedValues.has(asset.name)) products.push(...validatePublicRateShard(retainedValues.get(asset.name), manifest, index, asset).products!);
          }
          const discoveryComplete = discoveries.every(asset => retainedValues.has(asset.name));
          for (const asset of capability.shards) {
            if (retainedValues.has(asset.name)) validatePublicRateShard(retainedValues.get(asset.name), manifest,
              discoveryComplete ? index : null, asset, products);
            await yieldToUi(0);
            assertCatalogueActive(controller.signal);
          }
          if (index && discoveryComplete) validatePublicRateDiscovery(index, products);
          if (missing) throw missing;
        }
        await client.snapshot().loadAll();
      } catch (error) {
        retainedValues.clear();
        // Workers have drained before loadAll rejects. A missing optional local
        // cache must not prevent auditing the core payload and its screens.
        // Corruption, live-source failures and cancellation remain fatal.
        if (!localOnly || !(error instanceof LocalCatalogueCacheMiss) || cancelled || auditReservation?.owner !== owner) throw error;
        const state: PublicRateCatalogueState = { ...unavailable, auditUnavailableReason: 'cache-miss' };
        auditOverlay = { owner, key, state };
        auditListeners.forEach(listener => listener());
        return state;
      }
      retainedValues.clear();
      assertCatalogueActive(controller.signal);
      const state = client.snapshot();
      if (state.status !== 'ready' || !state.allLoaded) throw new Error('Public pricing catalogue is not fully available');
      auditOverlay = { owner, key, state };
      auditListeners.forEach(listener => listener());
      return state;
    })();
    auditListeners.forEach(listener => listener());
    return { ready, async cancelAndDrain() { cancelled = true; controller.abort(); await ready.catch(() => undefined); }, quiesce, release };
  };
  auditListeners.forEach(listener => listener());
  return { prepare, release, quiesce: () => quiescePrepared() };
}

/** Audit probing cannot publish expected cache misses into the normal UI client. */
export function preparePublicRateCatalogueForAudit(manifest: Manifest): AuditPublicRateCatalogueLoad {
  const session = beginPublicRateCatalogueAudit();
  try { return session.prepare(manifest); } catch (error) { session.release(); throw error; }
}
