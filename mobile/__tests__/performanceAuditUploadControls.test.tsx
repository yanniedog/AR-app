import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PerformanceAuditScreen from '../app/performance-audit';
import { getPerformanceAuditState, completePerformanceAudit, failPerformanceAudit, markPerformanceAuditCancelled, clearCompletedPerformanceAuditState, resetPerformanceAuditForTests, PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY } from '../src/lib/performanceAudit';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { restorePerformanceAuditUpload, uploadCompletedPerformanceAudit } from '../src/lib/performanceAuditSharing';
import { loadCompletedPerformanceAudit } from '../src/lib/performanceAuditReportStorage';
import type { DebugLogUploadSnapshot } from '../src/lib/debugLogSharing';
import { performanceAuditReference } from '../src/lib/performanceAuditCompletion';
import { finalizeAppHealthReport } from '../src/lib/appHealth';
import { combineAppHealthPerformanceSummary } from '../src/lib/performanceAuditHealth';
import { BackgroundWorkDiagnosis } from '../src/components/BackgroundWorkDiagnosis';
import { AuditCatalogueCoverage } from '../src/components/AuditCatalogueCoverage';
import { captureAuditPayloadWork } from '../src/lib/performanceAuditPayloadWork';

type Node = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node;
  findAllByType: (type: unknown) => Node[]; findAllByProps: (props: Record<string, unknown>) => Node[] };
type Renderer = ReactTestRenderer & { root: Node };
const mockHydratedDownload = jest.fn();
const mockDownload = { phase: 'idle' };
let mockUpload: Partial<DebugLogUploadSnapshot> & Pick<DebugLogUploadSnapshot, 'sessionId' | 'phase'> = { sessionId: null, phase: 'idle' };
const mockRetry = jest.fn(async (_options: unknown) => {});
const mockPassive = { completed: 0, total: 0, linksCompleted: 0, linksTotal: 0, nativeStatus: 'unavailable' };
let mockUploadBusy = false;
let mockMountedDisclosure = false;
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));
jest.mock('../src/lib/appUpdate', () => ({
  getApkDownloadSnapshot: () => mockDownload, getHydratedApkDownloadSnapshot: () => mockHydratedDownload(), subscribeApkDownload: () => () => undefined,
}));
jest.mock('../src/lib/debugLogSharing', () => ({
  getDebugLogUploadSnapshot: () => mockUpload, isDebugLogUploadBusy: () => mockUploadBusy, subscribeDebugLogUpload: () => () => undefined,
  retryDebugLogUpload: (options: unknown) => mockRetry(options),
}));
jest.mock('../src/lib/performanceAuditSharing', () => ({
  restorePerformanceAuditUpload: jest.fn(async () => {}), uploadCompletedPerformanceAudit: jest.fn(async () => {}),
}));
jest.mock('../src/lib/performanceAuditReportStorage', () => ({ loadCompletedPerformanceAudit: jest.fn(async () => null) }));
jest.mock('../src/lib/passiveAudit', () => ({ getPassiveAuditStatus: () => mockPassive, subscribePassiveAudit: () => () => undefined, configurePassiveAuditState: jest.fn() }));
// Request controls use the real audit lifecycle; catalogue hydration has its
// own tests and must not start asynchronous persistence in this UI fixture.
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: { details: null }) => unknown) => selector({ details: null }) }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Row: 'Row',
  Disclosure: (props: Record<string, unknown>) => jest.requireActual('react').createElement(
    mockMountedDisclosure ? jest.requireActual('../src/components/ui').Disclosure : 'Disclosure', props),
}));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow', ToggleRow: 'ToggleRow' }));

let tree: Renderer | undefined;
const toggle = () => tree!.root.findByProps({ label: 'Public upload' });
async function mount() { await act(async () => { tree = TestRenderer.create(<PerformanceAuditScreen />) as Renderer; }); }
async function press(title: string) { await act(async () => { tree!.root.findByProps({ title }).props.onPress(); }); }
beforeEach(() => { resetPerformanceAuditForTests(); jest.clearAllMocks(); mockUpload = { sessionId: null, phase: 'idle' }; mockUploadBusy = false; mockMountedDisclosure = false; mockHydratedDownload.mockResolvedValue(mockDownload); });
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; resetPerformanceAuditForTests(); });

test.each([['Run audit', 'local'], ['Live audit', 'live-source']] as const)('%s automatically publishes the sanitized report by default', async (title, mode) => {
  await mount(); expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(false);
  expect(tree!.root.findByProps({ label: 'Next audit upload' }).props.value).toBe('Public');
  expect(tree!.root.findByProps({ label: 'Next destination' }).props.value).toBe('Public hosting');
  await press(title);
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', auditMode: mode, uploadLog: true });
  expect(toggle().props.disabled).toBe(true); expect(toggle().props.value).toBe(true);
});

test('the current publication choice remains visible after cancellation', async () => {
  await mount(); act(() => toggle().props.onChange(true));
  expect(tree!.root.findByProps({ label: 'Next audit upload' }).props.value).toBe('Public');
  expect(tree!.root.findByProps({ label: 'Next destination' }).props.value).toBe('Public hosting');
  await press('Run audit');
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', uploadLog: true });
  expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(true);
  act(() => markPerformanceAuditCancelled());
  expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(false);
  act(() => toggle().props.onChange(false));
  await press('Live audit');
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', auditMode: 'live-source', uploadLog: false });
  expect(jest.mocked(AsyncStorage.setItem).mock.calls.every(([key]) => key === PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY)).toBe(true);
});

test('preflight disables publication controls and retains the choice captured by the pressed run', async () => {
  await mount(); act(() => toggle().props.onChange(true));
  let finish!: (value: typeof mockDownload) => void;
  mockHydratedDownload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => tree!.root.findByProps({ title: 'Run audit' }).props.onPress());
  expect(toggle().props.disabled).toBe(true); expect(getPerformanceAuditState().status).toBe('idle');
  await act(async () => { finish(mockDownload); });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', uploadLog: true });
});

test('an in-flight public upload blocks new measurements and the publication toggle', async () => {
  mockUploadBusy = true; await mount();
  expect(toggle().props.disabled).toBe(true);
  expect(tree!.root.findByProps({ title: 'Run audit' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ title: 'Live audit' }).props.disabled).toBe(true);
  expect(mockHydratedDownload).not.toHaveBeenCalled(); expect(getPerformanceAuditState().status).toBe('idle');
});

test('a confirmed active update blocks the new local request without queuing it', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    await mount(); mockHydratedDownload.mockResolvedValueOnce({ phase: 'downloading' });
    await press('Run audit');
    expect(getPerformanceAuditState().status).toBe('idle');
    expect(alert).toHaveBeenCalledWith('Report unavailable', 'App update active');
  } finally { alert.mockRestore(); }
});


test.each([['Run audit', 'Live audit', 'local'], ['Live audit', 'Run audit', 'live-source']] as const)('two synchronous presses queue only the first %s intent after deferred hydration', async (first, second, mode) => {
  await mount(); act(() => toggle().props.onChange(true));
  let finish!: (value: typeof mockDownload) => void;
  mockHydratedDownload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const firstPress = tree!.root.findByProps({ title: first }).props.onPress;
  const secondPress = tree!.root.findByProps({ title: second }).props.onPress;
  act(() => { firstPress(); secondPress(); });
  expect(mockHydratedDownload).toHaveBeenCalledTimes(1);
  expect(getPerformanceAuditState().status).toBe('idle');
  act(() => toggle().props.onChange(false));
  await act(async () => { finish(mockDownload); });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', auditMode: mode, uploadLog: true });
  expect(tree!.root.findByProps({ label: 'Audit upload' }).props.value).toBe('Public');
  expect(tree!.root.findByProps({ label: 'Destination' }).props.value).toBe('Public hosting');
});

test('a terminal public audit with its upload still running labels the next choice separately', async () => {
  await mount(); act(() => toggle().props.onChange(true)); await press('Run audit');
  const sessionId = getPerformanceAuditState().sessionId;
  mockUploadBusy = true; mockUpload = { sessionId, phase: 'uploading' };
  act(() => failPerformanceAudit('Test terminal failure'));
  expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', uploadLog: true });
  expect(tree!.root.findByProps({ label: 'Next audit upload' }).props.value).toBe('Public');
  expect(tree!.root.findByProps({ label: 'Next destination' }).props.value).toBe('Public hosting');
  expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(true);
  expect(tree!.root.findByProps({ children: 'Uploading' })).toBeDefined();
  expect(tree!.root.findByProps({ title: 'Run audit' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ title: 'Live audit' }).props.disabled).toBe(true);
});

test('failed hydration releases the synchronous preflight lock for the next intent', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    await mount(); mockHydratedDownload.mockRejectedValueOnce(new Error('Hydration failed'));
    await press('Run audit'); expect(getPerformanceAuditState().status).toBe('idle');
    expect(toggle().props.disabled).toBe(false);
    await press('Live audit');
    expect(mockHydratedDownload).toHaveBeenCalledTimes(2);
    expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', auditMode: 'live-source', uploadLog: true });
  } finally { alert.mockRestore(); }
});

test('preselection off still offers upload after completion and retains the report across Back, retry and a cancelled new audit', async () => {
  await mount(); act(() => toggle().props.onChange(false)); await press('Run audit');
  expect(getPerformanceAuditState().uploadLog).toBe(false);
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  act(() => completePerformanceAudit(report));
  await press('Upload report');
  expect(uploadCompletedPerformanceAudit).toHaveBeenCalledWith(report);
  act(() => tree!.unmount()); tree = undefined;
  await mount();
  expect(getPerformanceAuditState().report).toBe(report);
  expect(tree!.root.findByProps({ title: 'Upload report' })).toBeDefined();
  await press('Run audit');
  expect(getPerformanceAuditState().report).toBe(report);
  act(() => markPerformanceAuditCancelled());
  expect(getPerformanceAuditState().report).toBe(report);
  expect(tree!.root.findByProps({ title: 'Upload report' })).toBeDefined();
});

test('a later failed audit shows its own upload status while keeping the earlier completed diagnosis', async () => {
  await mount(); await press('Run audit');
  const prior = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  act(() => completePerformanceAudit(prior));
  await press('Run audit');
  const sessionId = getPerformanceAuditState().sessionId;
  mockUploadBusy = true; mockUpload = { sessionId, phase: 'uploading' };
  act(() => failPerformanceAudit('later failure'));
  expect(getPerformanceAuditState().report).toBe(prior);
  expect(tree!.root.findByProps({ label: 'Report', value: 'Saved' })).toBeDefined();
  expect(tree!.root.findByProps({ children: 'Uploading' })).toBeDefined();
  expect(tree!.root.findByProps({ title: 'Upload report' }).props.disabled).toBe(true);
});

test('Back during deferred preflight does not queue an audit or upload after the screen closes', async () => {
  await mount();
  let finish!: (value: typeof mockDownload) => void;
  mockHydratedDownload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => tree!.root.findByProps({ title: 'Run audit' }).props.onPress());
  act(() => tree!.unmount()); tree = undefined;
  await act(async () => { finish(mockDownload); });
  expect(getPerformanceAuditState().status).toBe('idle');
  expect(uploadCompletedPerformanceAudit).not.toHaveBeenCalled();
});

test('rendered failure and success controls retain the diagnosis while retrying or copying a known link', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  mockUpload = { sessionId: report.sessionId, phase: 'failed', verified: false, mayHaveUploaded: false };
  act(() => completePerformanceAudit(report));
  await press('Retry upload');
  expect(mockRetry).toHaveBeenCalledWith({ acceptDuplicateRisk: false });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report });
  mockUpload = { ...mockUpload, phase: 'copied', verified: true, url: 'https://paste.c-net.org/fixture' };
  act(() => completePerformanceAudit(report));
  expect(tree!.root.findByProps({ children: 'https://paste.c-net.org/fixture' })).toBeDefined();
  await press('Copy link');
  expect(getPerformanceAuditState().report).toBe(report);
});

test('a cold screen restores the completed report and offers upload without publishing it on mount', async () => {
  const report = makePerformanceAuditReport('completed-before-restart');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(report);
  expect(getPerformanceAuditState().status).toBe('idle');
  await mount();
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report });
  expect(tree!.root.findByProps({ title: 'Upload report' }).props.disabled).toBe(false);
  expect(restorePerformanceAuditUpload).toHaveBeenCalledWith(report);
  expect(uploadCompletedPerformanceAudit).not.toHaveBeenCalled();
  await press('Upload report');
  expect(uploadCompletedPerformanceAudit).toHaveBeenCalledTimes(1);
  expect(uploadCompletedPerformanceAudit).toHaveBeenCalledWith(report);
});

test('a cold screen shows a restored verified URL and only copies it on explicit action', async () => {
  const report = makePerformanceAuditReport('verified-before-restart');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(report);
  mockUpload = { sessionId: report.sessionId, phase: 'failed', verified: true,
    error: null, url: 'https://paste.c-net.org/retained-fixture' };
  await mount();
  expect(tree!.root.findByProps({ children: 'Uploaded' })).toBeDefined();
  expect(tree!.root.findByProps({ children: 'https://paste.c-net.org/retained-fixture' })).toBeDefined();
  expect(mockRetry).not.toHaveBeenCalled();
  expect(uploadCompletedPerformanceAudit).not.toHaveBeenCalled();
  await press('Copy link');
  expect(mockRetry).toHaveBeenCalledTimes(1);
  expect(getPerformanceAuditState().report).toBe(report);
});

test('an uncertain upload restored after restart requires the explicit duplicate-risk action', async () => {
  const report = makePerformanceAuditReport('uncertain-before-restart');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(report);
  mockUpload = { sessionId: report.sessionId, phase: 'failed', verified: false, mayHaveUploaded: true };
  await mount();
  expect(mockRetry).not.toHaveBeenCalled();
  expect(uploadCompletedPerformanceAudit).not.toHaveBeenCalled();
  await press('Upload another copy');
  expect(mockRetry).toHaveBeenCalledWith({ acceptDuplicateRisk: true });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report });
});

test('Back and remount retain an in-flight report upload and block duplicate controls', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  mockUpload = { sessionId: report.sessionId, phase: 'uploading' }; mockUploadBusy = true;
  act(() => completePerformanceAudit(report));
  act(() => tree!.unmount()); tree = undefined;
  await mount();
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report });
  expect(tree!.root.findByProps({ children: 'Uploading' })).toBeDefined();
  expect(tree!.root.findByProps({ title: 'Upload report' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ title: 'Run audit' }).props.disabled).toBe(true);
  expect(uploadCompletedPerformanceAudit).not.toHaveBeenCalled();
  expect(mockRetry).not.toHaveBeenCalled();
});

test('an unsaved deletion receipt exposes its recovery route and blocks another upload retry', async () => {
  const report = makePerformanceAuditReport('deletion-recovery');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(report);
  mockUpload = { sessionId: report.sessionId, phase: 'failed', verified: false,
    recoveryReceipt: { schemaVersion: 1, provider: 'paste.c-net.org',
      url: 'https://paste.c-net.org/recovery-fixture', deleteKey: 'fixture-only', createdAt: '2026-10-15T19:00:00Z' } };
  await mount();
  expect(tree!.root.findByProps({ title: 'Retry upload' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ title: 'Debug log' }).props.disabled).not.toBe(true);
  expect(mockRetry).not.toHaveBeenCalled();
  expect(getPerformanceAuditState().report).toBe(report);
  const open = jest.spyOn(router, 'push').mockImplementation(() => {});
  try {
    await press('Debug log');
    expect(open).toHaveBeenCalledWith('/debug-log');
    expect(getPerformanceAuditState().report).toBe(report);
  } finally { open.mockRestore(); }
});

test.each(['cancelled', 'failed'] as const)('a diagnosis loaded after a new run starts remains available after %s', async terminal => {
  const saved = makePerformanceAuditReport('previous-diagnosis');
  let finish!: (value: typeof saved) => void;
  jest.mocked(loadCompletedPerformanceAudit).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount(); await press('Run audit');
  const active = getPerformanceAuditState();
  await act(async () => { finish(saved); await Promise.resolve(); });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', sessionId: active.sessionId, startedAt: active.startedAt, report: saved });
  act(() => terminal === 'failed' ? failPerformanceAudit('new-run-error') : markPerformanceAuditCancelled());
  expect(getPerformanceAuditState()).toMatchObject({ status: terminal, sessionId: active.sessionId, report: saved });
  expect(tree!.root.findByProps({ title: 'Upload report' })).toBeDefined();
  await press('Upload report');
  expect(uploadCompletedPerformanceAudit).toHaveBeenCalledWith(saved);
});

test('late disk recovery cannot replace a newer completed diagnosis', async () => {
  const saved = makePerformanceAuditReport('previous-diagnosis');
  let finish!: (value: typeof saved) => void;
  jest.mocked(loadCompletedPerformanceAudit).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount(); await press('Run audit');
  const current = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  act(() => completePerformanceAudit(current));
  await act(async () => { finish(saved); await Promise.resolve(); });
  expect(getPerformanceAuditState().report).toBe(current);
});

test('successful diagnostic Clear removes the displayed diagnosis and upload action', async () => {
  const saved = makePerformanceAuditReport('clear-diagnosis');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(saved);
  await mount();
  expect(tree!.root.findByProps({ title: 'Upload report' })).toBeDefined();
  act(() => clearCompletedPerformanceAuditState());
  expect(getPerformanceAuditState()).toMatchObject({ status: 'idle', report: null });
  expect(() => tree!.root.findByProps({ title: 'Upload report' })).toThrow();
});

test('diagnostic Clear retains the active run identity and progress', async () => {
  const saved = makePerformanceAuditReport('clear-previous-diagnosis');
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(saved);
  await mount(); await press('Run audit');
  const active = getPerformanceAuditState();
  act(() => clearCompletedPerformanceAuditState());
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', sessionId: active.sessionId,
    startedAt: active.startedAt, progress: active.progress, report: null });
});

test('the completed result ties its finish instant and audit reference to its verified link', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  mockUpload = { sessionId: report.sessionId, phase: 'copied', verified: true, url: 'https://paste.c-net.org/current-audit' };
  act(() => completePerformanceAudit(report));
  expect(tree!.root.findByProps({ label: 'Finished' }).props.value).toBe('2026-10-15T18:01:00.000Z');
  expect(tree!.root.findByProps({ label: 'Audit ID' }).props.value).toBe(performanceAuditReference(report.sessionId));
  expect(tree!.root.findByProps({ children: 'https://paste.c-net.org/current-audit' })).toBeDefined();
  expect(tree!.root.findByProps({ title: 'Audit details' }).props.open).toBe(false);
  expect(tree!.root.findByProps({ title: 'Run another audit' }).props.open).toBe(false);
});

test('a completed audit cannot present the verified link of a different report', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!);
  mockUpload = { sessionId: 'earlier-audit', phase: 'copied', verified: true, url: 'https://paste.c-net.org/earlier-audit' };
  act(() => completePerformanceAudit(report));
  expect(() => tree!.root.findByProps({ children: 'https://paste.c-net.org/earlier-audit' })).toThrow();
  expect(tree!.root.findByProps({ title: 'Upload report' }).props.disabled).toBe(false);
  expect(tree!.root.findByProps({ label: 'Finished' }).props.value).toBe('2026-10-15T18:01:00.000Z');
});

test('failed checks expose numbered positions without expanding the verbose audit results', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!, [
    { id: 'first-check', label: 'First check', kind: 'runtime', status: 'pass', durationMs: 1, metrics: {} },
    { id: 'failed-check', label: 'Failed check', kind: 'runtime', status: 'fail', durationMs: null, metrics: { nonTimingFailure: true } },
  ]);
  act(() => completePerformanceAudit(report));
  expect(tree!.root.findByProps({ label: 'Failures' }).props.value).toBe('1');
  expect(tree!.root.findByProps({ label: 'First failure' }).props.value).toBe('Check results · 2 · failed-check');
  expect(tree!.root.findByProps({ label: 'Position' }).props.value).toBe('2');
  expect(tree!.root.findByProps({ title: 'Failure positions' }).props.open).toBe(false);
  await act(async () => { tree!.root.findByProps({ title: 'Failure positions' }).props.onToggle(); });
  expect(tree!.root.findByProps({ title: 'Failure positions' }).props.open).toBe(true);
  expect(tree!.root.findByProps({ title: 'Audit details' }).props.open).toBe(false);
});

test('deidentified sharing discloses audit timestamps and reference before opening the share sheet', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    await mount(); await press('Run audit');
    act(() => completePerformanceAudit(makePerformanceAuditReport(getPerformanceAuditState().sessionId!)));
    await press('Share deidentified report');
    expect(alert).toHaveBeenCalledWith('Share deidentified report?',
      expect.stringContaining('Included: App / publication / aggregate counts / timing / fixed checks / Audit timestamps / Audit ID'),
      expect.any(Array));
    const message = alert.mock.calls[0][1]!;
    expect(message).toContain('Excluded: Raw logs / tracebacks / routes / product keys / device IDs');
    expect(message.split('Excluded:')[1]).not.toContain('timestamps');
  } finally { alert.mockRestore(); }
});

test('combined health totals use the complete denominator without counting warnings twice', async () => {
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!, [
    { id: 'runtime', label: 'Runtime', kind: 'runtime', status: 'pass', durationMs: 1, metrics: { executionAttempted: true } },
  ]);
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt,
    checks: [{ id: 'core-schema', code: 'core-schema', label: 'Core schema', domain: 'data-integrity', status: 'warn', metrics: {} }],
    plannedCheckIds: ['core-schema'] });
  report.summary = combineAppHealthPerformanceSummary(report.summary, report.appHealth, report.checks.length);
  act(() => completePerformanceAudit(report));
  const allPlanned = report.checks.length + report.appHealth.coverage.plannedChecks;
  expect(tree!.root.findByProps({ label: 'Executed', value: `${report.summary.executed} / ${allPlanned}` })).toBeDefined();
  expect(tree!.root.findByProps({ label: 'Warnings' }).props.value).toBe(String(report.summary.warn));
});

test('an older saved report with malformed optional coverage remains reviewable as incomplete', async () => {
  const report = makePerformanceAuditReport('older-diagnosis');
  report.coverage = {} as never;
  report.appHealth = {} as never;
  jest.mocked(loadCompletedPerformanceAudit).mockResolvedValueOnce(report);
  await mount();
  expect(tree!.root.findByProps({ label: 'Details', value: 'Incomplete' })).toBeDefined();
  expect(tree!.root.findByProps({ label: 'Coverage', value: 'Incomplete' })).toBeDefined();
  expect(tree!.root.findByProps({ title: 'Upload report' })).toBeDefined();
  expect(report.coverage).toEqual({});
  expect(report.appHealth).toEqual({});
});

test('the real disclosure mounts every diagnostic section only while audit details are open', async () => {
  mockMountedDisclosure = true;
  await mount(); await press('Run audit');
  const report = makePerformanceAuditReport(getPerformanceAuditState().sessionId!, [
    { id: 'runtime-detail', label: 'Runtime', kind: 'runtime', status: 'pass', durationMs: 1, metrics: { executionAttempted: true } },
  ]);
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: ['core-schema'],
    checks: [{ id: 'core-schema', code: 'core-schema', label: 'Core schema', domain: 'data-integrity', status: 'pass', metrics: {} }] });
  report.backgroundWorkWait = { startedAt: report.startedAt, capturedAt: report.startedAt, elapsedMs: 1,
    status: 'settled', jobs: [], payloadWork: captureAuditPayloadWork({ core: null, manifest: null,
      refreshing: false, postRefreshWarming: false, bankRateHistoryLoading: false, detailsLoading: false }) };
  report.routeAggregates = [{ journeyId: 'rates', label: 'Rates', coldStatus: 'pass', warmStatus: 'pass',
    coldForwardMs: 1, warmForwardMs: 1, coldBackMs: 1, warmBackMs: 1, forwardChangeMs: 0, backChangeMs: 0 }];
  act(() => completePerformanceAudit(report));
  const expectDiagnostics = (mounted: boolean) => {
    expect(tree!.root.findAllByType(BackgroundWorkDiagnosis)).toHaveLength(mounted ? 1 : 0);
    expect(tree!.root.findAllByType(AuditCatalogueCoverage)).toHaveLength(mounted ? 1 : 0);
    for (const heading of ['Data and display health', 'First / repeat', 'Check results', 'runtime-detail']) {
      expect(tree!.root.findAllByProps({ children: heading }).length > 0).toBe(mounted);
    }
    expect(tree!.root.findByProps({ label: 'Finished' }).props.value).toBe('2026-10-15T18:01:00.000Z');
  };
  expectDiagnostics(false);
  act(() => tree!.root.findByProps({ title: 'Audit details' }).props.onToggle());
  expectDiagnostics(true);
  act(() => tree!.root.findByProps({ title: 'Audit details' }).props.onToggle());
  expectDiagnostics(false);
});
