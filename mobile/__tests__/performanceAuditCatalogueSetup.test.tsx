import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PerformanceAuditRunner } from '../src/components/PerformanceAuditRunner';
import { getPerformanceAuditState, requestPerformanceAudit, resetPerformanceAuditForTests } from '../src/lib/performanceAudit';
import { createPublicRateCatalogueClient } from '../src/data/publicRateCatalogue';
import { buildPerformanceAuditSetupPlans, measurePerformanceAuditSetupStage } from '../src/lib/performanceAuditSetup';
import { catalogueFixture } from '../testUtils/publicRates';
import { core } from '../testUtils/publicRateJourney';
import { EMPTY_PROFILE } from '../src/data/profile';

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
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => {} }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), storePerformanceAudit: jest.fn(async () => {}), flushToFile: jest.fn(async () => {}) },
  getDebugLogFlushDiagnostics: () => ({ stage: 'idle', stageMs: 0, activeMs: 0, lastFlushMs: 0, lastFailedStage: null }),
}));
jest.mock('../src/data/publicRateCatalogue', () => ({
  ...jest.requireActual('../src/data/publicRateCatalogue'),
  getPublicRateCatalogueSnapshot: () => mockClient.snapshot(),
  ensurePublicRateCatalogueLoaded: jest.fn(async () => { await mockClient.snapshot().loadAll(); return mockClient.snapshot(); }),
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
afterEach(() => { resetPerformanceAuditForTests(); jest.clearAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
test('fresh mounted audit starts and awaits every public shard before sampling without prior screen navigation', async () => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  const fixture = catalogueFixture();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const acquire = jest.fn(async (_asset, isIndex: boolean) => { if (isIndex) return fixture.index; await pending; return fixture.shard; });
  mockClient = createPublicRateCatalogueClient(fixture.manifest, acquire);
  mockState = { core: core([]), manifest: fixture.manifest, prefs: { profileFilters: EMPTY_PROFILE, interests: ['Mortgage'], depositRankMetric: 'base', mortgageRateMetric: 'comparison' }, details: null };
  expect(mockClient.snapshot().status).toBe('loading');
  expect(acquire).not.toHaveBeenCalled();
  requestPerformanceAudit({ uploadLog: false });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<PerformanceAuditRunner />); });
  for (let tick = 0; tick < 100 && !acquire.mock.calls.length; tick++) await act(async () => { await jest.advanceTimersByTimeAsync(16); });
  try {
    expect({ status: getPerformanceAuditState().status, paused: getPerformanceAuditState().paused, stages: jest.mocked(measurePerformanceAuditSetupStage).mock.calls.map(([stage]) => stage.id) }).toMatchObject({ paused: false, stages: expect.arrayContaining(['setup-pinned-inputs']) });
    expect(getPerformanceAuditState().error).toBeNull();
    expect(acquire).toHaveBeenCalledWith(fixture.capability.index, true);
    expect(buildPerformanceAuditSetupPlans).toHaveBeenCalledTimes(1);
    expect(mockClient.snapshot().allLoaded).toBe(false);
    await act(async () => { release(); for (let tick = 0; tick < 200; tick++) await Promise.resolve(); });
    expect(mockClient.snapshot()).toMatchObject({ status: 'ready', allLoaded: true });
    expect(getPerformanceAuditState().error).toContain('sampling fixture stop');
    expect(buildPerformanceAuditSetupPlans).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});
