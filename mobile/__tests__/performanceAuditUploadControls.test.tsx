import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PerformanceAuditScreen from '../app/performance-audit';
import { getPerformanceAuditState, completePerformanceAudit, failPerformanceAudit, markPerformanceAuditCancelled, resetPerformanceAuditForTests, PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY } from '../src/lib/performanceAudit';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { restorePerformanceAuditUpload, uploadCompletedPerformanceAudit } from '../src/lib/performanceAuditSharing';
import { loadCompletedPerformanceAudit } from '../src/lib/performanceAuditReportStorage';
import type { DebugLogUploadSnapshot } from '../src/lib/debugLogSharing';

type Node = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node };
type Renderer = ReactTestRenderer & { root: Node };
const mockHydratedDownload = jest.fn();
const mockDownload = { phase: 'idle' };
let mockUpload: Partial<DebugLogUploadSnapshot> & Pick<DebugLogUploadSnapshot, 'sessionId' | 'phase'> = { sessionId: null, phase: 'idle' };
const mockRetry = jest.fn(async (_options: unknown) => {});
const mockPassive = { completed: 0, total: 0, linksCompleted: 0, linksTotal: 0, nativeStatus: 'unavailable' };
let mockUploadBusy = false;
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
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { textMuted: '#777', success: '#070', warning: '#a60', danger: '#c00', border: '#ddd', surfaceAlt: '#eee', text: '#111' }, radius: { md: 12 }, font: { body: 16 } }) }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Disclosure: 'Disclosure', Row: 'Row' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow', ToggleRow: 'ToggleRow' }));

let tree: Renderer | undefined;
const toggle = () => tree!.root.findByProps({ label: 'Public upload' });
async function mount() { await act(async () => { tree = TestRenderer.create(<PerformanceAuditScreen />) as Renderer; }); }
async function press(title: string) { await act(async () => { tree!.root.findByProps({ title }).props.onPress(); }); }
beforeEach(() => { resetPerformanceAuditForTests(); jest.clearAllMocks(); mockUpload = { sessionId: null, phase: 'idle' }; mockUploadBusy = false; mockHydratedDownload.mockResolvedValue(mockDownload); });
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
