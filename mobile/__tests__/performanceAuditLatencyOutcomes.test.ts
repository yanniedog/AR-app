import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { runStorageCheck, runFileSystemCheck, runLogIoCheck } from '../src/components/PerformanceAuditRunner';
import { auditOutcome } from '../src/lib/auditPresentation';
import { PerformanceAuditInactivityWatchdog, ResponsivenessMonitor } from '../src/lib/performanceAudit';
import { debugLog } from '../src/lib/debugLog';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-router', () => ({ usePathname: () => '/performance-audit', useNavigationContainerRef: () => null, router: {} }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ captureUserRateScenarioForAudit: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: { getState: () => ({}) } }));
jest.mock('../src/data/ratesSession', () => ({ captureRatesSession: jest.fn(), restoreRatesSession: jest.fn() }));
jest.mock('../src/lib/passiveAudit', () => ({ setPassiveAuditPaused: jest.fn() }));
jest.mock('../src/lib/appUpdate', () => ({ getApkDownloadSnapshot: () => ({ phase: 'idle' }) }));
jest.mock('../src/components/PerformanceAuditOverlay', () => ({ PerformanceAuditOverlay: () => null }));
jest.mock('../src/lib/debugLogSharing', () => ({
  isDebugLogUploadBusy: () => false, subscribeDebugLogUpload: () => () => {}, startDebugLogUpload: jest.fn(),
}));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), storePerformanceAudit: jest.fn(async () => {}), flushToFile: jest.fn(async () => {}) },
  getDebugLogFlushDiagnostics: () => ({ stage: 'idle', stageMs: 0, activeMs: 0, lastFlushMs: 0, lastFailedStage: null,
    nativeAppendAvailable: false, appendAttempts: 0, appendBytes: 0, rewriteAttempts: 0, rewriteBytes: 0, fileBytes: 0, queuedLines: 0 }),
}));


jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file://test/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => {}), readAsStringAsync: jest.fn(async () => 'x'.repeat(128 * 1024)),
  deleteAsync: jest.fn(async () => {}), getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false, size: 100 })) }));

afterEach(() => jest.restoreAllMocks());

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
