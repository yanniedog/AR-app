import React from 'react';
import { AppState } from 'react-native';
import { gzipSync } from 'node:zlib';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { automaticDataUrl } from '../src/lib/automaticDataAccess';
import { installAppHealthTransportGuard, hasAppHealthFetchGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PerformanceAuditRunner } from '../src/components/PerformanceAuditRunner';
import { getPerformanceAuditState, requestPerformanceAudit, resetPerformanceAuditForTests } from '../src/lib/performanceAudit';
import { beginPublicRateCatalogueAudit, createPublicRateCatalogueClient, ensurePublicRateCatalogueLoaded } from '../src/data/publicRateCatalogue';
import { buildPerformanceAuditSetupPlans, measurePerformanceAuditSetupStage } from '../src/lib/performanceAuditSetup';
import { catalogueFixture } from '../testUtils/publicRates';
import { core } from '../testUtils/publicRateJourney';
import { debugLog } from '../src/lib/debugLog';
import { EMPTY_PROFILE } from '../src/data/profile';

const originalFetch = globalThis.fetch;
jest.mock('../src/data/publicRateCache', () => ({ publicRateAssetCache: { read: jest.fn(async () => null), retain: jest.fn(async () => {}) } }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA256' }, getRandomBytes: (length: number) => new Uint8Array(length), digest: async (_algorithm: string, bytes: Uint8Array) => Uint8Array.from(jest.requireActual('@noble/hashes/sha256').sha256(bytes)).buffer }));
let mockClient: ReturnType<typeof createPublicRateCatalogueClient>;
let mockState: Record<string, any>;
jest.mock('expo-router', () => ({ usePathname: () => '/performance-audit', useNavigationContainerRef: () => null, router: {} }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ captureUserRateScenarioForAudit: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: { getState: () => mockState } }));
jest.mock('../src/data/ratesSession', () => ({ captureRatesSession: jest.fn(), restoreRatesSession: jest.fn() }));
jest.mock('../src/lib/passiveAudit', () => ({ ...jest.requireActual('../src/lib/passiveAudit'), setPassiveAuditPaused: jest.fn() }));
jest.mock('../src/lib/appUpdate', () => ({ getApkDownloadSnapshot: () => ({ phase: 'idle' }) }));
jest.mock('../src/components/PerformanceAuditOverlay', () => ({ PerformanceAuditOverlay: () => null }));
jest.mock('../src/lib/debugLogSharing', () => ({ isDebugLogUploadBusy: () => false, subscribeDebugLogUpload: () => () => {}, startDebugLogUpload: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => {}, parseJsonHeavy: async (text: string) => JSON.parse(text) }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), storePerformanceAudit: jest.fn(async () => {}), flushToFile: jest.fn(async () => {}) },
  getDebugLogFlushDiagnostics: () => ({ stage: 'idle', stageMs: 0, activeMs: 0, lastFlushMs: 0, lastFailedStage: null }),
}));
jest.mock('../src/data/publicRateCatalogue', () => ({
  ...jest.requireActual('../src/data/publicRateCatalogue'),
  getPublicRateCatalogueSnapshot: () => mockClient.snapshot(),
  beginPublicRateCatalogueAudit: jest.fn(() => ({ release: () => undefined, quiesce: () => undefined, prepare: () => {
    const ready = mockClient.snapshot().loadAll().then(() => mockClient.snapshot());
    return { ready, cancelAndDrain: async () => { await ready.catch(() => undefined); }, quiesce: () => undefined, release: () => undefined };
  } })),
}));
jest.mock('../src/lib/performanceAuditSetup', () => {
  const real = jest.requireActual('../src/lib/performanceAuditSetup');
  let plans = 0;
  return { ...real,
    // Isolate input preparation from native rollback and subsequent device checks.
    measurePerformanceAuditSetupStage: jest.fn(async (stage, run, options) => stage.id === 'setup-pinned-inputs'
      ? real.measurePerformanceAuditSetupStage(stage, run, options)
      : ({ value: undefined, check: { ...stage, status: 'pass', durationMs: 0, metrics: {} } })),
    buildPerformanceAuditSetupPlans: jest.fn((...args) => { if (plans++ === 0) return real.buildPerformanceAuditSetupPlans(...args); throw new Error('sampling fixture stop'); }),
  };
});
afterEach(() => { globalThis.fetch = originalFetch; resetPerformanceAuditForTests(); jest.clearAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
test('fresh mounted audit starts and awaits every public shard before sampling without prior screen navigation', async () => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  const fixture = catalogueFixture();
  const shardBytes = gzipSync(JSON.stringify(fixture.shard));
  const shardSha = bytesToHex(sha256(shardBytes));
  const shardName = `public-rate-shard-0000-${fixture.manifest.run_date}-${shardSha.slice(0, 12)}.json.gz`;
  Object.assign(fixture.capability.shards[0], { name: shardName, url: fixture.capability.shards[0].url.replace(/[^/]+$/, shardName), sha256: shardSha, bytes: shardBytes.length, decodedBytes: JSON.stringify(fixture.shard).length });
  Object.assign(fixture.index.shards[0], { name: shardName, sha256: shardSha, bytes: shardBytes.length, decodedBytes: JSON.stringify(fixture.shard).length });
  const indexBytes = gzipSync(JSON.stringify(fixture.index));
  const indexSha = bytesToHex(sha256(indexBytes));
  const indexName = `public-rate-index-${fixture.manifest.run_date}-${indexSha.slice(0, 12)}.json.gz`;
  Object.assign(fixture.capability.index, { name: indexName, url: fixture.capability.index.url.replace(/[^/]+$/, indexName), sha256: indexSha, bytes: indexBytes.length, decodedBytes: JSON.stringify(fixture.index).length });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const acquire = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input), index = url === (automaticDataUrl(fixture.capability.index.url) ?? fixture.capability.index.url);
    if (!index) await pending;
    const bytes = index ? indexBytes : shardBytes;
    return { ok: true, status: 200, url, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
  });
  globalThis.fetch = acquire as unknown as typeof fetch;
  mockClient = createPublicRateCatalogueClient(fixture.manifest);
  mockState = { core: core([]), manifest: fixture.manifest, prefs: { profileFilters: EMPTY_PROFILE, interests: ['Mortgage'], depositRankMetric: 'base', mortgageRateMetric: 'comparison' }, details: null };
  expect(mockClient.snapshot().status).toBe('loading');
  expect(acquire).not.toHaveBeenCalled();
  requestPerformanceAudit({ uploadLog: false, mode: 'live-source' });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<PerformanceAuditRunner />); });
  for (let tick = 0; tick < 100 && !acquire.mock.calls.length; tick++) await act(async () => { await jest.advanceTimersByTimeAsync(16); });
  try {
    expect({ status: getPerformanceAuditState().status, paused: getPerformanceAuditState().paused, stages: jest.mocked(measurePerformanceAuditSetupStage).mock.calls.map(([stage]) => stage.id) }).toMatchObject({ paused: false, stages: expect.arrayContaining(['setup-pinned-inputs']) });
    expect(getPerformanceAuditState().error).toBeNull();
    expect(acquire.mock.calls.some(([input]) => String(input) === (automaticDataUrl(fixture.capability.index.url) ?? fixture.capability.index.url))).toBe(true);
    expect(buildPerformanceAuditSetupPlans).toHaveBeenCalledTimes(1);
    expect(mockClient.snapshot().allLoaded).toBe(false);
    await act(async () => { release(); for (let tick = 0; tick < 200; tick++) await Promise.resolve(); });
    expect(mockClient.snapshot()).toMatchObject({ status: 'ready', allLoaded: true });
    expect(getPerformanceAuditState().error).toContain('sampling fixture stop');
    expect(buildPerformanceAuditSetupPlans).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});

test('a local audit cache miss is unavailable without attempting even one guarded transport', async () => {
  const fixture = catalogueFixture();
  const transport = jest.fn(); globalThis.fetch = transport;
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'local', contract: createV1AppHealthSourceContract() });
  try {
    const client = createPublicRateCatalogueClient(fixture.manifest);
    await expect(client.snapshot().loadAll()).rejects.toThrow('retained offline cache');
    expect(transport).not.toHaveBeenCalled();
    expect(guard.snapshot()).toMatchObject({ authorizationAttempts: 0, transportCalls: 0, blockedAttempts: 0 });
  } finally { guard.restore(); }
});


test.each(['local', 'live-source'] as const)('mounted %s audit rejects a pre-existing normal request before setup or guard installation', async mode => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  const f = catalogueFixture();
  f.manifest.payload_revision = { ...f.manifest.payload_revision!, bundle_sha256: (mode === 'local' ? 'a' : 'b').repeat(64) };
  let reject!: (error: Error) => void;
  const originalXhr = globalThis.XMLHttpRequest;
  class PendingXhr {
    status = 500; onload?: () => void; onloadend?: () => void;
    open() {} setRequestHeader() {} abort() {}
    send() { reject = () => { this.onload?.(); this.onloadend?.(); }; }
  }
  globalThis.XMLHttpRequest = PendingXhr as unknown as typeof XMLHttpRequest;
  const normal = ensurePublicRateCatalogueLoaded(f.manifest).catch(() => undefined);
  for (let turn = 0; turn < 100 && !reject; turn++) await Promise.resolve();
  expect(reject).toBeDefined();
  jest.mocked(beginPublicRateCatalogueAudit).mockImplementationOnce(jest.requireActual('../src/data/publicRateCatalogue').beginPublicRateCatalogueAudit);
  mockState = { manifest: f.manifest };
  requestPerformanceAudit({ uploadLog: false, mode });
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = TestRenderer.create(<PerformanceAuditRunner />); });
    expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', error: expect.stringContaining('work is in progress') });
    expect(hasAppHealthFetchGuard()).toBe(false);
    expect(debugLog.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('catalogueAdmissionRejected'));
    expect(debugLog.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('completedBeforeFailure'));
    expect(debugLog.storePerformanceAudit).not.toHaveBeenCalled();
    expect(measurePerformanceAuditSetupStage).not.toHaveBeenCalled();
    expect(buildPerformanceAuditSetupPlans).not.toHaveBeenCalled();
    // The failed admission releases the run gate, so a new user attempt is
    // checked again rather than remaining queued behind the rejected run.
    const admissions = jest.mocked(beginPublicRateCatalogueAudit).mock.calls.length;
    jest.mocked(beginPublicRateCatalogueAudit).mockImplementationOnce(jest.requireActual('../src/data/publicRateCatalogue').beginPublicRateCatalogueAudit);
    await act(async () => { requestPerformanceAudit({ uploadLog: false, mode }); });
    expect(beginPublicRateCatalogueAudit).toHaveBeenCalledTimes(admissions + 1);
    expect(getPerformanceAuditState().status).toBe('failed');
    expect(hasAppHealthFetchGuard()).toBe(false);
    // A late completion cannot resume this rejected run or pin its result.
    await act(async () => { reject(new Error('normal request fixture finished')); await normal; });
    expect(getPerformanceAuditState().status).toBe('failed');
    expect(measurePerformanceAuditSetupStage).not.toHaveBeenCalled();
  } finally { act(() => tree?.unmount()); globalThis.XMLHttpRequest = originalXhr; }
});
