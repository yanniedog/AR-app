import { router } from 'expo-router';
import { performanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { runStorageCheck, runFileSystemCheck, runLogIoCheck, runJourney } from '../src/components/PerformanceAuditRunner';
import { auditOutcome } from '../src/lib/auditPresentation';
import { PerformanceAuditInactivityWatchdog, ResponsivenessMonitor, type AuditCheck } from '../src/lib/performanceAudit';
import { debugLog } from '../src/lib/debugLog';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-router', () => ({ usePathname: () => '/performance-audit', useNavigationContainerRef: () => null, router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ captureUserRateScenarioForAudit: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: { getState: () => ({ prefs: jest.requireActual('../src/data/storeTypes').DEFAULT_PREFS, source: 'cache' }) } }));
jest.mock('../src/data/ratesSession', () => ({ captureRatesSession: jest.fn(), restoreRatesSession: jest.fn() }));
jest.mock('../src/lib/passiveAudit', () => ({ setPassiveAuditPaused: jest.fn() }));
jest.mock('../src/lib/appUpdate', () => ({ getApkDownloadSnapshot: () => ({ phase: 'idle' }) }));
jest.mock('../src/components/PerformanceAuditOverlay', () => ({ PerformanceAuditOverlay: () => null }));
jest.mock('../src/lib/debugLogSharing', () => ({
  isDebugLogUploadBusy: () => false, subscribeDebugLogUpload: () => () => {}, startDebugLogUpload: jest.fn(),
}));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { getCursor: () => 0, getEntriesAfter: () => [], getEntries: () => [], info: jest.fn(), warn: jest.fn(), error: jest.fn(), storePerformanceAudit: jest.fn(async () => {}), flushToFile: jest.fn(async () => {}) },
  getDebugLogFlushDiagnostics: () => ({ stage: 'idle', stageMs: 0, activeMs: 0, lastFlushMs: 0, lastFailedStage: null,
    nativeAppendAvailable: false, appendAttempts: 0, appendBytes: 0, rewriteAttempts: 0, rewriteBytes: 0, fileBytes: 0, queuedLines: 0 }),
}));


jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file://test/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => {}), readAsStringAsync: jest.fn(async () => 'x'.repeat(128 * 1024)),
  deleteAsync: jest.fn(async () => {}), getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false, size: 100 })) }));

afterEach(() => jest.restoreAllMocks());

test('an unfinished journey and a settle-only miss stay failures', () => {
  const journey = (metrics: AuditCheck['metrics']): AuditCheck => ({
    id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 835, metrics,
  });
  expect(auditOutcome(journey({ actionCompleted: false, nonTimingFailure: false }))).toBe('failure');
  expect(auditOutcome(journey({
    actionCompleted: false, stepLimitExceeded: true, nonTimingFailure: false, backgroundSettleMs: 8_444,
  }))).toBe('failure');
  expect(auditOutcome(journey({
    actionCompleted: true, nonTimingFailure: false, actionMs: 444, forwardMs: 700, backgroundSettleMs: 5_004,
    measurementMode: 'semantic-action',
  }))).toBe('failure');
});

test('actual storage producers distinguish slow completed measurements from validation/runtime errors', async () => {
  const monitor = new ResponsivenessMonitor();
  jest.spyOn(monitor, 'metricsSince').mockReturnValue({ eventLoopSamples: 1, eventLoopP95Ms: 400, maxEventLoopLagMs: 400, stallsOver100Ms: 1,
    frameSamples: 1, frameP95Ms: 20, maxFrameGapMs: 20, framesOver50Ms: 0 });
  const watchdog = new PerformanceAuditInactivityWatchdog();
  const values = new Map<string, string>();
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => { values.set(key, value); });
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => values.get(key) ?? null);
  const storage = await runStorageCheck('classification', monitor, watchdog);
  expect(storage.status).toBe('fail');
  expect(storage.metrics).toMatchObject({ measurementAvailable: true, nonTimingFailure: false, temporaryKeyDeleted: true });
  expect(auditOutcome(storage)).toBe('timing');
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('corrupt');
  const corrupt = await runStorageCheck('classification', monitor, watchdog);
  expect(corrupt.error).toContain('did not match');
  expect(auditOutcome(corrupt)).toBe('failure');
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValueOnce('bad');
  const file = await runFileSystemCheck('classification', monitor, watchdog);
  expect(file.error).toContain('did not match');
  expect(auditOutcome(file)).toBe('failure');
  Object.assign(debugLog, { getLogFileUri: () => 'file://test/log' });
  const log = await runLogIoCheck(monitor, watchdog);
  expect(log.status).toBe('fail');
  expect(auditOutcome(log)).toBe('timing');
  jest.mocked(debugLog.flushToFile).mockRejectedValueOnce(new Error('disk failure'));
  expect(auditOutcome(await runLogIoCheck(monitor, watchdog))).toBe('failure');
});


test.each(['ready', 'error'] as const)('route outcome uses terminal optional model %s after first-ready', async terminal => {
  jest.useFakeTimers();
  let path = '/performance-audit';
  const registry = performanceAuditReadinessRegistry;
  registry.beginCapture(`terminal-${terminal}`);
  const origin = registry.registerSurface({ id: 'audit.progress', probes: [{ id: 'audit.layout', kind: 'layout', status: 'ready' }] });
  let destination: ReturnType<typeof registry.registerSurface>;
  jest.mocked(router.push).mockImplementation(() => {
    path = '/calculator';
    destination = registry.registerSurface({ id: 'projections.lifecycle-chart', probes: [
      { id: 'projections.data', kind: 'data', status: 'ready' },
      { id: 'projections.layout', kind: 'layout', status: 'ready' },
      { id: 'projections.model', kind: 'data', required: false, status: terminal === 'ready' ? 'pending' : 'ready' },
    ] });
    setTimeout(() => registry.updateProbe(destination!, 'projections.model', { status: terminal,
      error: terminal === 'error' ? 'Projection model failed during settle' : null }), 150);
  });
  jest.mocked(router.back).mockImplementation(() => { registry.unregisterSurface(destination!); path = '/performance-audit'; });
  const monitor = new ResponsivenessMonitor();
  jest.spyOn(monitor, 'metricsSince').mockReturnValue({ eventLoopSamples: 1, eventLoopP95Ms: 1, maxEventLoopLagMs: 1, stallsOver100Ms: 0,
    frameSamples: 1, frameP95Ms: 16, maxFrameGapMs: 16, framesOver50Ms: 0 });
  try {
    const promise = runJourney({ id: 'projections', label: 'Projections', href: '/calculator', expectedPath: '/calculator',
      expectedSurface: 'projections.lifecycle-chart', navigationKind: 'stack' }, 'warm', () => path, monitor,
      new PerformanceAuditInactivityWatchdog(), { runDate: null, manifestRunDate: null, coreSha: null, detailsSha: null, publicCatalogue: null });
    void promise.catch(() => {});
    await jest.advanceTimersByTimeAsync(5000);
    const check = await promise;
    expect(check.error).toBeUndefined();
    expect(check.status).toBe(terminal === 'ready' ? 'pass' : 'warn');
    expect(check.diagnostic?.readiness?.surfaces.find(surface => surface.id === 'projections.lifecycle-chart')?.probes
      .find(probe => probe.id === 'projections.model')?.status).toBe(terminal);
    expect(check.metrics.backMs as number).toBeLessThan(1000);
  } finally { registry.unregisterSurface(origin!); registry.endCapture(); jest.useRealTimers(); }
});

test('failed Back retains destination probe evidence separately from return failure', async () => {
  const terminal = String('ready') as 'ready' | 'error';
  jest.useFakeTimers();
  let path = '/performance-audit';
  const registry = performanceAuditReadinessRegistry;
  registry.beginCapture(`terminal-${terminal}`);
  const origin = registry.registerSurface({ id: 'audit.progress', probes: [{ id: 'audit.layout', kind: 'layout', status: 'ready' }] });
  let destination: ReturnType<typeof registry.registerSurface>;
  jest.mocked(router.push).mockImplementation(() => {
    path = '/calculator';
    destination = registry.registerSurface({ id: 'projections.lifecycle-chart', probes: [
      { id: 'projections.data', kind: 'data', status: 'ready' },
      { id: 'projections.layout', kind: 'layout', status: 'ready' },
      { id: 'projections.model', kind: 'data', required: false, status: terminal === 'ready' ? 'pending' : 'ready' },
    ] });
    setTimeout(() => registry.updateProbe(destination!, 'projections.model', { status: terminal,
      error: terminal === 'error' ? 'Projection model failed during settle' : null }), 150);
  });
  jest.mocked(router.back).mockImplementation(() => { registry.unregisterSurface(destination!); path = '/performance-audit'; throw new Error('Back confirmation failed'); });
  const monitor = new ResponsivenessMonitor();
  jest.spyOn(monitor, 'metricsSince').mockReturnValue({ eventLoopSamples: 1, eventLoopP95Ms: 1, maxEventLoopLagMs: 1, stallsOver100Ms: 0,
    frameSamples: 1, frameP95Ms: 16, maxFrameGapMs: 16, framesOver50Ms: 0 });
  try {
    const promise = runJourney({ id: 'projections', label: 'Projections', href: '/calculator', expectedPath: '/calculator',
      expectedSurface: 'projections.lifecycle-chart', navigationKind: 'stack' }, 'warm', () => path, monitor,
      new PerformanceAuditInactivityWatchdog(), { runDate: null, manifestRunDate: null, coreSha: null, detailsSha: null, publicCatalogue: null });
    void promise.catch(() => {});
    await jest.advanceTimersByTimeAsync(5000);
    const check = await promise;
    expect(check.error).toContain('Back confirmation failed');
    expect(check.status).toBe('fail');
    expect(check.diagnostic?.returnStage).toBe('back');
    expect(check.diagnostic?.returnReadiness?.surfaces.some(surface => surface.id === 'audit.progress')).toBe(true);
    expect(check.diagnostic?.readiness?.surfaces.find(surface => surface.id === 'projections.lifecycle-chart')?.probes
      .find(probe => probe.id === 'projections.model')?.status).toBe(terminal);
    expect(check.diagnostic?.readiness?.surfaces.some(surface => surface.id === 'audit.progress')).toBe(true);
  } finally { registry.unregisterSurface(origin!); registry.endCapture(); jest.useRealTimers(); }
});
