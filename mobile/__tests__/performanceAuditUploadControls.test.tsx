import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PerformanceAuditScreen from '../app/performance-audit';
import { getPerformanceAuditState, markPerformanceAuditCancelled, resetPerformanceAuditForTests, PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY } from '../src/lib/performanceAudit';

type Node = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node };
type Renderer = ReactTestRenderer & { root: Node };
const mockHydratedDownload = jest.fn();
const mockDownload = { phase: 'idle' };
const mockUpload = { sessionId: null, phase: 'idle' };
const mockPassive = { completed: 0, total: 0, linksCompleted: 0, linksTotal: 0, nativeStatus: 'unavailable' };
let mockUploadBusy = false;
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));
jest.mock('../src/lib/appUpdate', () => ({
  getApkDownloadSnapshot: () => mockDownload, getHydratedApkDownloadSnapshot: () => mockHydratedDownload(), subscribeApkDownload: () => () => undefined,
}));
jest.mock('../src/lib/debugLogSharing', () => ({
  getDebugLogUploadSnapshot: () => mockUpload, isDebugLogUploadBusy: () => mockUploadBusy, subscribeDebugLogUpload: () => () => undefined,
}));
jest.mock('../src/lib/passiveAudit', () => ({ getPassiveAuditStatus: () => mockPassive, subscribePassiveAudit: () => () => undefined }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { textMuted: '#777', success: '#070', warning: '#a60', danger: '#c00', border: '#ddd', surfaceAlt: '#eee', text: '#111' }, radius: { md: 12 }, font: { body: 16 } }) }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Disclosure: 'Disclosure', Row: 'Row' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow', ToggleRow: 'ToggleRow' }));
jest.mock('../src/components/DebugLogUploadStatus', () => ({ DebugLogUploadStatus: 'DebugLogUploadStatus' }));

let tree: Renderer | undefined;
const toggle = () => tree!.root.findByProps({ label: 'Public upload' });
async function mount() { await act(async () => { tree = TestRenderer.create(<PerformanceAuditScreen />) as Renderer; }); }
async function press(title: string) { await act(async () => { tree!.root.findByProps({ title }).props.onPress(); }); }
beforeEach(() => { resetPerformanceAuditForTests(); jest.clearAllMocks(); mockUploadBusy = false; mockHydratedDownload.mockResolvedValue(mockDownload); });
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; resetPerformanceAuditForTests(); });

test.each([['Run audit', 'local'], ['Live audit', 'live-source']] as const)('%s explicitly keeps publication local by default', async (title, mode) => {
  await mount(); expect(toggle().props.value).toBe(false); expect(toggle().props.disabled).toBe(false);
  expect(tree!.root.findByProps({ label: 'Audit upload' }).props.value).toBe('Local');
  expect(tree!.root.findByProps({ label: 'Destination' }).props.value).toBe('Debug log');
  await press(title);
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', auditMode: mode, uploadLog: false });
  expect(toggle().props.disabled).toBe(true); expect(toggle().props.value).toBe(false);
});

test('explicit public publication applies to one run and the next run returns to local', async () => {
  await mount(); act(() => toggle().props.onChange(true));
  expect(tree!.root.findByProps({ label: 'Audit upload' }).props.value).toBe('Public');
  expect(tree!.root.findByProps({ label: 'Destination' }).props.value).toBe('Public hosting');
  await press('Run audit');
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', uploadLog: true });
  expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(true);
  act(() => markPerformanceAuditCancelled());
  expect(toggle().props.value).toBe(false); expect(toggle().props.disabled).toBe(false);
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
