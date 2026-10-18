import { downloadInflate } from '../src/data/payload';
import { PerformanceAuditStepTimeoutError } from '../src/lib/performanceAuditTiming';
import { awaitAuditCatalogueLoad } from '../src/components/PerformanceAuditRunner';
import { resetPerformanceAuditForTests, requestPerformanceAudit, cancelPerformanceAudit } from '../src/lib/performanceAudit';
import { measurePerformanceAuditSetupStage, PERFORMANCE_AUDIT_SETUP_STAGES } from '../src/lib/performanceAuditSetup';
import type { AuditCheck } from '../src/lib/performanceAudit';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { gzipSync, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { catalogueFixture } from '../testUtils/publicRates';
import { ensurePublicRateCatalogueLoaded, getPublicRateCatalogueSnapshot, preparePublicRateCatalogueForAudit, usePublicRateCatalogue } from '../src/data/publicRateCatalogue';
import { installAppHealthTransportGuard, hasAppHealthFetchGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { automaticDataUrl } from '../src/lib/automaticDataAccess';
import { publicRateAssetCache } from '../src/data/publicRateCache';
import type { PublicRateAsset } from '../src/data/publicRateModel';
import type { Manifest } from '../src/types';

const mockCache = new Map<string, Uint8Array>();
jest.mock('../src/data/publicRateCache', () => ({ publicRateAssetCache: {
  read: jest.fn(async (_edition: string, asset: PublicRateAsset) => mockCache.get(asset.name) ?? null),
  retain: jest.fn(async (_edition: string, asset: PublicRateAsset, bytes: Uint8Array) => { mockCache.set(asset.name, bytes); }),
} }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => {}, parseJsonHeavy: async (text: string) => JSON.parse(text) }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  getRandomBytes: (length: number) => new Uint8Array(length),
  digest: async (_algorithm: string, bytes: Uint8Array) => Uint8Array.from(jest.requireActual('@noble/hashes/sha256').sha256(bytes)).buffer }));

const originalFetch = globalThis.fetch;
let sequence = 0;
function fixture() {
  const source = catalogueFixture(), generation = `audit-lifecycle-${++sequence}`;
  source.manifest.source_observation = { generation_id: generation };
  source.capability.generationId = generation; source.index.generationId = generation;
  const values = new Map<string, Uint8Array>(), assets: PublicRateAsset[] = [];
  const products = Array.from({ length: 4 }, (_, n) => ({ ...source.index.products[0], productId: `product-${n}`,
    productKey: `bank::product-${n}`, programmeIds: [`programme-${n}`] }));
  for (let n = 0; n < 4; n++) {
    const offer = `offer-${n}`, programme = { ...source.shard.programmes[0], generationId: undefined,
      programmeId: `programme-${n}`, productId: `product-${n}`, offerId: offer,
      components: source.shard.programmes[0].components.map(component => ({ ...component, scopeId: offer })) };
    delete programme.generationId;
    const raw = { ...source.shard, generationId: generation, programmes: [programme] };
    const json = JSON.stringify(raw), bytes = gzipSync(strToU8(json)), hash = bytesToHex(sha256(bytes));
    const name = `public-rate-shard-${String(n).padStart(4, '0')}-${source.manifest.run_date}-${hash.slice(0, 12)}.json.gz`;
    const asset = { ...source.capability.shards[0], name, url: source.capability.shards[0].url.replace(/[^/]+$/, name),
      bytes: bytes.length, decodedBytes: json.length, sha256: hash };
    assets.push(asset); values.set(asset.url, bytes); values.set(automaticDataUrl(asset.url) ?? asset.url, bytes);
  }
  source.capability.shards = assets; source.index.products = products;
  source.index.shards = assets.map(({ url: _url, ...asset }, n) => ({ ...asset, productIds: [`product-${n}`] }));
  const json = JSON.stringify(source.index), bytes = gzipSync(strToU8(json)), hash = bytesToHex(sha256(bytes));
  const name = `public-rate-index-${source.manifest.run_date}-${hash.slice(0, 12)}.json.gz`;
  Object.assign(source.capability.index, { name, url: source.capability.index.url.replace(/[^/]+$/, name),
    bytes: bytes.length, decodedBytes: json.length, sha256: hash });
  values.set(source.capability.index.url, bytes); values.set(automaticDataUrl(source.capability.index.url) ?? source.capability.index.url, bytes);
  return { ...source, values };
}
function cache(f: ReturnType<typeof fixture>, assets: PublicRateAsset[]) {
  assets.forEach(asset => mockCache.set(asset.name, f.values.get(asset.url)!));
}
function response(url: string, bytes: Uint8Array) {
  return { ok: true, status: 200, url, arrayBuffer: async () => Uint8Array.from(bytes).buffer } as Response;
}
function guard(f: ReturnType<typeof fixture>, mode: 'local' | 'live-source') {
  const result = installAppHealthTransportGuard({ target: globalThis, mode, contract: createV1AppHealthSourceContract() });
  result.allowManifestAssets([f.capability.index.url, ...f.capability.shards.map(asset => asset.url)]);
  return result;
}
async function until(predicate: () => boolean) {
  for (let turn = 0; turn < 1000 && !predicate(); turn++) await Promise.resolve();
  expect(predicate()).toBe(true);
}
beforeEach(() => { mockCache.clear(); jest.clearAllMocks(); });
afterEach(() => { globalThis.fetch = originalFetch; resetPerformanceAuditForTests(); jest.useRealTimers(); });

test('local probing leaves the ready partial UI client usable and normal loads recover after guard release', async () => {
  const f = fixture(); cache(f, [f.capability.index, f.capability.shards[0]]);
  await ensurePublicRateCatalogueLoaded(f.manifest, false);
  await getPublicRateCatalogueSnapshot(f.manifest).loadProduct('product-0');
  const baseline = getPublicRateCatalogueSnapshot(f.manifest);
  expect(baseline).toMatchObject({ status: 'ready', allLoaded: false, error: null });
  let shown = baseline;
  function Probe({ manifest }: { manifest: Manifest }) { shown = usePublicRateCatalogue(manifest); return null; }
  let tree!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { tree = TestRenderer.create(<Probe manifest={f.manifest} />); });
  const wire = jest.fn(async (input: RequestInfo | URL) => response(String(input), f.values.get(String(input))!));
  globalThis.fetch = wire as typeof fetch;
  const local = guard(f, 'local');
  let load!: ReturnType<typeof preparePublicRateCatalogueForAudit>;
  act(() => { load = preparePublicRateCatalogueForAudit(f.manifest); });
  try {
    await expect(load.ready).rejects.toThrow('retained offline cache');
    await load.cancelAndDrain();
    expect(wire).not.toHaveBeenCalled();
    expect(shown.status).toBe('ready'); expect(shown.error).toBeNull();
    expect(local.snapshot()).toMatchObject({ authorizationAttempts: 0, transportCalls: 0 });
  } finally { local.restore(); act(() => load.release()); }
  expect(getPublicRateCatalogueSnapshot(f.manifest)).toBe(baseline);
  expect(shown).toBe(baseline); expect(baseline.getProgrammes('product-0')).toHaveLength(1);
  const live = guard(f, 'live-source');
  try {
    await act(async () => { await baseline.loadProduct('product-1'); });
    expect(getPublicRateCatalogueSnapshot(f.manifest).getProgrammes('product-1')).toHaveLength(1);
    await act(async () => { await getPublicRateCatalogueSnapshot(f.manifest).loadAll(); });
    expect(shown).toMatchObject({ status: 'ready', allLoaded: true, error: null });
  } finally { live.restore(); act(() => tree.unmount()); }
});

test('warm complete validated clients are reused without cache reads, acquisition or overlay replacement', async () => {
  const f = fixture(); cache(f, [f.capability.index, ...f.capability.shards]);
  const baseline = await ensurePublicRateCatalogueLoaded(f.manifest);
  const reads = jest.mocked(publicRateAssetCache.read).mock.calls.length;
  const wire = jest.fn(); globalThis.fetch = wire;
  const local = guard(f, 'local'), load = preparePublicRateCatalogueForAudit(f.manifest);
  try {
    expect(await load.ready).toBe(baseline);
    expect(getPublicRateCatalogueSnapshot(f.manifest)).toBe(baseline);
    expect(jest.mocked(publicRateAssetCache.read)).toHaveBeenCalledTimes(reads);
    expect(wire).not.toHaveBeenCalled();
  } finally { local.restore(); load.release(); }
});

test('both issued workers abort and drain before restoration; an abort-ignoring transport cannot issue later shards', async () => {
  const f = fixture(); cache(f, [f.capability.index]);
  const finish: (() => void)[] = [], signals: AbortSignal[] = [];
  const wire = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    signals.push(init!.signal!);
    await new Promise<void>(resolve => { finish.push(resolve); });
    return response(String(input), f.values.get(String(input))!);
  });
  globalThis.fetch = wire as typeof fetch;
  const live = guard(f, 'live-source'), load = preparePublicRateCatalogueForAudit(f.manifest);
  const rejected = load.ready.catch(error => error);
  try {
    await until(() => wire.mock.calls.length === 2);
    let drained = false;
    const drain = load.cancelAndDrain().then(() => { drained = true; });
    await until(() => signals.every(signal => signal.aborted));
    expect(drained).toBe(false); expect(hasAppHealthFetchGuard()).toBe(true);
    expect(wire).toHaveBeenCalledTimes(2);
    finish.forEach(resolve => resolve());
    await drain;
    expect(await rejected).toBeInstanceOf(Error);
    expect(live.snapshot()).toMatchObject({ transportCalls: 2 });
    live.restore(); load.release();
    for (let turn = 0; turn < 100; turn++) await Promise.resolve();
    expect(wire).toHaveBeenCalledTimes(2);
    expect(hasAppHealthFetchGuard()).toBe(false);
  } finally { finish.forEach(resolve => resolve()); await load.cancelAndDrain(); live.restore(); load.release(); }
});

test('quiescence restores baseline data while reserving UI work until the guard is restored', async () => {
  const f = fixture(); cache(f, [f.capability.index]);
  const baseline = await ensurePublicRateCatalogueLoaded(f.manifest, false);
  cache(f, f.capability.shards);
  const wire = jest.fn(); globalThis.fetch = wire;
  const local = guard(f, 'local'), load = preparePublicRateCatalogueForAudit(f.manifest);
  await load.ready;
  expect(getPublicRateCatalogueSnapshot(f.manifest).allLoaded).toBe(true);
  load.quiesce();
  const restored = getPublicRateCatalogueSnapshot(f.manifest);
  expect(restored.allLoaded).toBe(false); expect(restored.products).toBe(baseline.products);
  const pending = restored.loadAll();
  for (let turn = 0; turn < 50; turn++) await Promise.resolve();
  expect(wire).not.toHaveBeenCalled(); expect(hasAppHealthFetchGuard()).toBe(true);
  local.restore(); load.release();
  expect(getPublicRateCatalogueSnapshot(f.manifest)).toBe(baseline);
  await pending;
  expect(getPublicRateCatalogueSnapshot(f.manifest).allLoaded).toBe(true);
});


test.each([false, true])('a different manifest waits for release and recovers with warm-complete audit = %s', async warm => {
  const f = fixture(), other = fixture(); cache(f, [f.capability.index]);
  if (warm) cache(f, f.capability.shards);
  await ensurePublicRateCatalogueLoaded(f.manifest, warm);
  const wire = jest.fn(async (input: RequestInfo | URL) => response(String(input), other.values.get(String(input))!));
  globalThis.fetch = wire as typeof fetch;
  const local = guard(f, 'local'), load = preparePublicRateCatalogueForAudit(f.manifest);
  const rejected = load.ready.catch(error => error);
  let shown = getPublicRateCatalogueSnapshot(other.manifest);
  function Probe() { shown = usePublicRateCatalogue(other.manifest); return null; }
  let tree!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { tree = TestRenderer.create(<Probe />); });
  try {
    await rejected; await load.cancelAndDrain();
    expect(shown).toMatchObject({ status: 'loading', error: null, generationId: other.capability.generationId });
    expect(wire).not.toHaveBeenCalled();
    local.restore();
    const live = guard(other, 'live-source');
    try {
      act(() => load.release());
      await act(async () => { await until(() => getPublicRateCatalogueSnapshot(other.manifest).status === 'ready'); });
      expect(wire).toHaveBeenCalledTimes(1);
      expect(shown.generationId).toBe(other.capability.generationId);
    } finally { live.restore(); }
  } finally { await load.cancelAndDrain(); local.restore(); act(() => { load.release(); tree.unmount(); }); }
});


test.each(['cancel', 'deadline'] as const)('actual runner await path aborts owned fetches and preserves %s failure within the setup budget', async reason => {
  jest.useFakeTimers();
  requestPerformanceAudit({ uploadLog: false, mode: 'live-source' });
  const f = fixture(); cache(f, [f.capability.index]);
  const signals: AbortSignal[] = [];
  const wire = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init!.signal!; signals.push(signal);
    return new Promise((_resolve, reject) => {
      const abort = () => reject(new Error('owned fetch aborted'));
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
  });
  globalThis.fetch = wire as typeof fetch;
  const live = guard(f, 'live-source'), load = preparePublicRateCatalogueForAudit(f.manifest);
  let failed: AuditCheck | undefined;
  const run = measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.inputs,
    watchdog => awaitAuditCatalogueLoad(load, watchdog), { assertActive: () => undefined, onFailure: check => { failed = check; } })
    .catch(error => error);
  try {
    await until(() => wire.mock.calls.length === 2);
    if (reason === 'cancel') cancelPerformanceAudit();
    await jest.advanceTimersByTimeAsync(reason === 'cancel' ? 50 : 10001);
    const error = await run;
    expect(error).toBeInstanceOf(Error);
    if (reason === 'deadline') {
      expect(error).toBeInstanceOf(PerformanceAuditStepTimeoutError);
      expect(failed).toMatchObject({ status: 'fail', metrics: { stepLimitExceeded: true } });
    } else expect(failed?.status).toBe('fail');
    expect(signals).toHaveLength(2); expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(hasAppHealthFetchGuard()).toBe(true);
    live.restore(); load.release();
    await jest.advanceTimersByTimeAsync(30000);
    expect(wire).toHaveBeenCalledTimes(2);
  } finally { await load.cancelAndDrain(); live.restore(); load.release(); }
});


test('outer measured deadline records failure at 10s but waits for ignored-abort workers before restoration', async () => {
  jest.useFakeTimers();
  requestPerformanceAudit({ uploadLog: false, mode: 'live-source' });
  const f = fixture(); cache(f, [f.capability.index]);
  const finish: (() => void)[] = [], signals: AbortSignal[] = [];
  const wire = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    signals.push(init!.signal!);
    await new Promise<void>(resolve => { finish.push(resolve); });
    return response(String(input), f.values.get(String(input))!);
  });
  globalThis.fetch = wire as typeof fetch;
  const live = guard(f, 'live-source'), load = preparePublicRateCatalogueForAudit(f.manifest);
  let failed: AuditCheck | undefined, restored = false;
  const terminal = measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.inputs,
    watchdog => awaitAuditCatalogueLoad(load, watchdog), { assertActive: () => undefined, onFailure: check => { failed = check; },
      drainOnFailure: load.cancelAndDrain })
    .catch(error => {
      live.restore(); load.release(); restored = true;
      return error;
    });
  try {
    await until(() => wire.mock.calls.length === 2);
    await jest.advanceTimersByTimeAsync(10001);
    expect(failed).toMatchObject({ status: 'fail', metrics: { stepLimitExceeded: true } });
    expect(failed!.durationMs).toBeGreaterThanOrEqual(10000);
    expect(restored).toBe(false); expect(hasAppHealthFetchGuard()).toBe(true);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    finish.forEach(resolve => resolve());
    expect(await terminal).toBeInstanceOf(Error);
    expect(restored).toBe(true);
    await jest.advanceTimersByTimeAsync(30000);
    expect(wire).toHaveBeenCalledTimes(2);
  } finally { finish.forEach(resolve => resolve()); await load.cancelAndDrain(); live.restore(); load.release(); }
});


test('the optional download signal also aborts XHR and removes its listener outside an audit guard', async () => {
  const originalXhr = globalThis.XMLHttpRequest;
  const controller = new AbortController(), removed = jest.spyOn(controller.signal, 'removeEventListener');
  const xhr = { open: jest.fn(), send: jest.fn(), onloadend: undefined as undefined | (() => void),
    abort: jest.fn((): void => { xhr.onloadend?.(); }) };
  const create = jest.fn(() => xhr);
  globalThis.XMLHttpRequest = create as unknown as typeof XMLHttpRequest;
  try {
    const request = downloadInflate('https://example.test/source.json.gz', undefined, { signal: controller.signal });
    await until(() => xhr.send.mock.calls.length === 1);
    controller.abort();
    await expect(request).rejects.toThrow('Payload download cancelled');
    expect(xhr.abort).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    create.mockClear();
    await expect(downloadInflate('https://example.test/source.json.gz', undefined, { signal: controller.signal }))
      .rejects.toThrow('Payload download cancelled');
    expect(create).not.toHaveBeenCalled();
  } finally { globalThis.XMLHttpRequest = originalXhr; removed.mockRestore(); }
});
