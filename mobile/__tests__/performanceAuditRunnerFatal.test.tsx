import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PerformanceAuditRunner } from '../src/components/PerformanceAuditRunner';
import { getPerformanceAuditState, requestPerformanceAudit, resetPerformanceAuditForTests, type PerformanceAuditReport } from '../src/lib/performanceAudit';
import { debugLog } from '../src/lib/debugLog';
import { startDebugLogUpload } from '../src/lib/debugLogSharing';
import { captureRatesSession } from '../src/data/ratesSession';
import * as Clipboard from 'expo-clipboard';

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

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { resetPerformanceAuditForTests(); jest.clearAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

test('the mounted runner persists its actual fatal partial report before exposing failure for a local audit', async () => {
  jest.mocked(captureRatesSession).mockImplementation(() => { throw new Error('runner setup fixture failure'); });
  let finishPersistence!: () => void;
  jest.mocked(debugLog.storePerformanceAudit).mockImplementation(() => new Promise<void>(resolve => { finishPersistence = resolve; }));
  requestPerformanceAudit({ uploadLog: false });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<PerformanceAuditRunner />);
    for (let turn = 0; turn < 100 && !finishPersistence; turn++) await Promise.resolve();
  });
  try {
    expect(captureRatesSession).toHaveBeenCalledTimes(1);
    expect(debugLog.storePerformanceAudit).toHaveBeenCalledTimes(1);
    expect(getPerformanceAuditState().status).not.toBe('failed');
    await act(async () => {
      finishPersistence();
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
    });
    const [marker, report] = jest.mocked(debugLog.storePerformanceAudit).mock.calls[0];
    const partial = report as PerformanceAuditReport;
    expect(marker).toContain('partial=true');
    expect(partial.summary.unexpectedSkipped).toBeGreaterThan(0);
    expect(partial.checks).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'fail', error: expect.stringContaining('runner setup fixture failure') })]));
    expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', report: null, uploadLog: false, error: expect.stringContaining('runner setup fixture failure') });
    expect(startDebugLogUpload).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
