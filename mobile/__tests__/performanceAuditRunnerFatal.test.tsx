import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PerformanceAuditRunner, routeEntryHref } from '../src/components/PerformanceAuditRunner';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { resolveRatesIntent } from '../src/lib/ratesIntent';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { getPerformanceAuditState, requestPerformanceAudit, resetPerformanceAuditForTests, type PerformanceAuditReport } from '../src/lib/performanceAudit';
import { debugLog } from '../src/lib/debugLog';
import { startDebugLogUpload } from '../src/lib/debugLogSharing';
import { captureRatesSession, restoreRatesSession } from '../src/data/ratesSession';
import { clearMortgageComparison, setMortgageComparisonInputs, useMortgageComparison, type MortgageComparisonInputs } from '../src/data/mortgageComparison';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import { AuditEvidenceCapacityError } from '../src/lib/auditEvidenceCapacity';
import { buildPerformanceAuditCompletion } from '../src/lib/performanceAuditCompletion';

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
  debugLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), getEntries: () => [], getCursor: () => 0,
    storePerformanceAudit: jest.fn(async () => {}), flushToFile: jest.fn(async () => {}) },
  subscribeApplicationJournal: () => () => {},
  getDebugLogFlushDiagnostics: () => ({ stage: 'idle', stageMs: 0, activeMs: 0, lastFlushMs: 0, lastFailedStage: null,
    nativeAppendAvailable: false, appendAttempts: 0, appendBytes: 0, rewriteAttempts: 0, rewriteBytes: 0, fileBytes: 0, queuedLines: 0 }),
}));

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { resetPerformanceAuditForTests(); clearMortgageComparison(); jest.clearAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

test('the runner routes both real search passes with a fresh deterministic task intent', () => {
  const requests: string[] = [];
  for (const pass of buildDeepPerformanceAuditPlan(null).passes) {
    const planned = pass.steps.find(step => step.semanticActionId === 'search.open')!;
    const href = routeEntryHref({ ...planned, parameters: { section: 'Mortgage' } }) as {
      pathname: string; params: Record<string, string>;
    };
    expect(href.pathname).toBe('/browse');
    expect(href.params).toMatchObject({ section: 'Mortgage', reset: '1', compare: '0',
      availability: 'listed', query: '', path: '', scope: '' });
    requests.push(href.params.request);
    expect(resolveRatesIntent(href.params, 'Savings', []).patch).toMatchObject({
      sort: 'rate', filters: EMPTY_FILTERS, includeNonStandardOverride: null,
      selectMode: false, selected: [], page: 1,
    });
  }
  expect(new Set(requests).size).toBe(2);
});

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
    expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', report: partial, uploadLog: false, error: expect.stringContaining('runner setup fixture failure') });
    expect(startDebugLogUpload).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('a capacity stop retains a failed position and cannot claim complete evidence', async () => {
  jest.mocked(captureRatesSession).mockImplementation(() => { throw new AuditEvidenceCapacityError(1024); });
  jest.mocked(debugLog.storePerformanceAudit).mockResolvedValue(undefined);
  requestPerformanceAudit({ uploadLog: false });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<PerformanceAuditRunner />);
    for (let turn = 0; turn < 200; turn++) await Promise.resolve();
  });
  try {
    const partial = jest.mocked(debugLog.storePerformanceAudit).mock.calls[0][1] as PerformanceAuditReport;
    expect(partial.checks).toContainEqual(expect.objectContaining({ status: 'fail',
      metrics: expect.objectContaining({ evidenceCapacityExceeded: true, evidenceCapacityLimitBytes: 1024 }) }));
    const completion = buildPerformanceAuditCompletion(partial);
    expect(completion).toMatchObject({ outcome: 'failed', detailsComplete: false, gaps: { evidenceCapacityFailures: 1 } });
    expect(completion.failurePositions).toContainEqual(expect.objectContaining({ source: 'performance', position: 1 }));
  } finally { act(() => tree.unmount()); }
});

test.each<MortgageComparisonInputs>([
  { loanAmount: '654321.98', lvr: '71.234567', lvrMode: 'funds', fundsAvailable: '123456.79', fundsType: 'deposit', propertyValue: '876543.21' },
  { loanAmount: '654321.98', lvr: '71.234567', lvrMode: 'funds', fundsAvailable: '123456.79', fundsType: 'offset', propertyValue: '876543.21' },
  { loanAmount: '654321.98', lvr: '71.234567' },
])('the mounted audit restores the exact private comparison snapshot after interruption: %j', async baseline => {
  setMortgageComparisonInputs(baseline);
  const ratesSnapshot = {} as ReturnType<typeof captureRatesSession>;
  jest.mocked(captureRatesSession).mockImplementation(() => {
    setMortgageComparisonInputs(baseline.lvrMode === 'funds'
      ? { loanAmount: '500000', lvr: '80' }
      : { loanAmount: '500000', lvr: '80', lvrMode: 'funds', fundsAvailable: '200000', fundsType: 'offset', propertyValue: '800000' });
    return ratesSnapshot;
  });
  jest.mocked(activateKeepAwakeAsync).mockRejectedValueOnce(new Error('interrupted audit fixture'));
  jest.mocked(debugLog.storePerformanceAudit).mockResolvedValue(undefined);
  requestPerformanceAudit({ uploadLog: false });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<PerformanceAuditRunner />);
    for (let turn = 0; turn < 300; turn++) await Promise.resolve();
  });
  try {
    expect(getPerformanceAuditState().status).toBe('failed');
    expect(restoreRatesSession).toHaveBeenCalledWith(ratesSnapshot);
    expect(useMortgageComparison.getState()).toEqual(baseline);
    expect(debugLog.storePerformanceAudit).toHaveBeenCalledTimes(1);
    const evidence = JSON.stringify([
      jest.mocked(debugLog.storePerformanceAudit).mock.calls,
      jest.mocked(debugLog.info).mock.calls,
      jest.mocked(debugLog.warn).mock.calls,
      jest.mocked(debugLog.error).mock.calls,
    ]);
    expect(evidence.match(/654321\.98|71\.234567|123456\.79|876543\.21|fundsAvailable|lvrMode|fundsType/)?.[0] ?? null).toBeNull();
  } finally { act(() => tree.unmount()); }
});
