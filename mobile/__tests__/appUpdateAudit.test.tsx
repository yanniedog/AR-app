import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import { AppUpdateSection } from '../src/components/settings/AppUpdateSection';
import { getPerformanceAuditState, markPerformanceAuditRunning, requestPerformanceAudit, resetPerformanceAuditForTests,
  cancelPerformanceAudit, PerformanceAuditStepWatchdog } from '../src/lib/performanceAudit';
import { performanceAuditReadinessRegistry as registry } from '../src/lib/performanceAuditReadiness';
import { installAppHealthTransportGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { readAppUpdateMetadata } from '../src/lib/appUpdateMetadata';
import { TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256, type ApkManifest } from '../src/lib/appUpdateLogic';
import { runLiveUpdateReadiness } from '../src/lib/performanceAuditUpdate';
import { ANDROID_UPDATE_READINESS_AUDIT, dedicatedPerformanceAuditChecks } from '../src/lib/performanceAuditCheckInventory';
import { checkForAppUpdate, ensureApkBackgroundDownload, upgradeFromBackgroundDownload } from '../src/lib/appUpdate';
import { APK_MANIFEST_URL, APK_ARM_MANIFEST_URL } from '../src/config';

jest.mock('expo-device', () => ({ supportedCpuArchitectures: ['x86_64'] }));
jest.mock('../src/data/store', () => ({ useStore: (select: (state: unknown) => unknown) => select({
  prefs: { apkUpdatesWifiOnly: true, apkUpdatesAutoDownload: true }, setPref: jest.fn(),
}) }));
jest.mock('../src/lib/appUpdate', () => ({
  checkForAppUpdate: jest.fn(), ensureApkBackgroundDownload: jest.fn(), upgradeFromBackgroundDownload: jest.fn(),
  getApkDownloadPercent: () => null,
  getInstalledAppInfo: () => ({ version: '1.0.0', buildNumber: '40' }), subscribeApkDownload: () => () => undefined,
}));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));
jest.mock('../src/components/settings/settingsUi', () => ({
  DisclosureGroup: 'DisclosureGroup', InfoRow: 'InfoRow', Section: 'Section', SettingsGap: 'SettingsGap', ToggleRow: 'ToggleRow',
}));

type Node = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node;
  findAll: (predicate: (node: Node) => boolean) => Node[] };
type Tree = ReactTestRenderer & { root: Node };
const remote: ApkManifest = {
  schema_version: 1, version: '1.0.1', build_number: '42', bytes: 12345, sha256: 'a'.repeat(64),
  package_name: 'com.eyex.australianrates', supported_abis: ['x86_64', 'arm64-v8a'],
  signing_certificate_sha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
  download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.1/app-preview.apk',
};
const originalFetch = global.fetch;
const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
let tree: Tree | undefined;
let release: (() => unknown) | undefined;
let session = '';
function start(mode: 'local' | 'live-source' = 'live-source') {
  session = requestPerformanceAudit({ mode, uploadLog: false });
  markPerformanceAuditRunning(10);
  registry.beginCapture(session);
}
async function mount(measured = true) {
  await act(async () => { tree = TestRenderer.create(<AppUpdateSection />) as Tree; });
  if (measured) act(() => {
    tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0].props.onLayout({
      nativeEvent: { layout: { width: 380, height: 320 } },
    });
  });
}
function guardedFetch() {
  const spy = jest.fn<Promise<{ ok: boolean; url: string; json: () => Promise<ApkManifest> }>, [RequestInfo | URL, RequestInit?]>(
    async (url, _init) => ({ ok: true, url: String(url), json: async () => remote }));
  global.fetch = spy as unknown as typeof fetch;
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'live-source', contract: createV1AppHealthSourceContract() });
  release = () => guard.restore();
  return { guard, spy };
}
beforeEach(() => {
  jest.clearAllMocks(); resetPerformanceAuditForTests();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
});
afterEach(() => {
  if (tree) act(() => tree!.unmount()); tree = undefined;
  registry.endCapture(); release?.(); release = undefined; resetPerformanceAuditForTests();
  global.fetch = originalFetch;
  if (descriptor) Object.defineProperty(Platform, 'OS', descriptor);
  jest.useRealTimers();
});

test('the real mounted Settings action reads fresh metadata, renders it and never downloads with standing consent', async () => {
  start(); const { guard, spy } = guardedFetch(); await mount();
  const stop = guard.beginAppUpdateMetadata();
  const controller = new AbortController();
  await act(async () => {
    const result = await registry.invokeAction('settings.app-update', 'settings.update.check', {
      sessionId: session, signal: controller.signal, remainingMs: () => 8000,
    });
    expect(result).toMatchObject({ status: 'available', remote, changelogs: [] });
  });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(String(spy.mock.calls[0][0]).startsWith(`${APK_MANIFEST_URL}?_=`)).toBe(true);
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).toBe('Update available');
  expect(tree!.root.findByProps({ title: 'Download & install' }).props.disabled).toBe(true);
  expect(ensureApkBackgroundDownload).not.toHaveBeenCalled();
  expect(upgradeFromBackgroundDownload).not.toHaveBeenCalled();
  expect(checkForAppUpdate).not.toHaveBeenCalled();
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  act(() => tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0].props.onLayout({
    nativeEvent: { layout: { width: 380, height: 320 } },
  }));
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout'])).toMatchObject({ ready: true, pendingRequiredProbes: 0 });
  expect(getPerformanceAuditState().uploadLog).toBe(false);
  // A fast, identical response may batch Checking away. It is still a new
  // request and must not inherit the previous result's measured native view.
  const firstResultView = tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  const firstResultCallback = firstResultView.props.onLayout;
  await act(async () => { await registry.invokeAction('settings.app-update', 'settings.update.check', {
    sessionId: session, signal: controller.signal, remainingMs: () => 8000,
  }); });
  expect(spy).toHaveBeenCalledTimes(2);
  const secondResultView = tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  expect(secondResultView).not.toBe(firstResultView);
  act(() => firstResultCallback({ nativeEvent: { layout: { width: 380, height: 320 } } }));
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  act(() => secondResultView.props.onLayout({ nativeEvent: { layout: { width: 380, height: 320 } } }));
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(true);
  stop();
});

test('repeated metadata reads bypass the normal cache and omit every changelog request', async () => {
  const { guard, spy } = guardedFetch(); const stop = guard.beginAppUpdateMetadata();
  const request = { sessionId: 'read', signal: new AbortController().signal, remainingMs: () => 8000 };
  await readAppUpdateMetadata({ version: '0.9.0', buildNumber: '1' }, ['x86_64'], request);
  await readAppUpdateMetadata({ version: '0.9.0', buildNumber: '1' }, ['x86_64'], request);
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy.mock.calls.every(([url]) => String(url).startsWith(`${APK_MANIFEST_URL}?_=`))).toBe(true);
  stop();
});

test('two synchronous registered actions share one pending request; cancellation rejects without committing a result', async () => {
  start(); const { guard, spy } = guardedFetch(); await mount();
  spy.mockImplementation((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')));
  }));
  const stop = guard.beginAppUpdateMetadata(), controller = new AbortController();
  const request = { sessionId: session, signal: controller.signal, remainingMs: () => 8000 };
  let first!: Promise<unknown>, second!: Promise<unknown>;
  act(() => { first = registry.invokeAction('settings.app-update', 'settings.update.check', request);
    second = registry.invokeAction('settings.app-update', 'settings.update.check', request); });
  const settled = Promise.allSettled([first, second]);
  await act(async () => { controller.abort(); await settled; });
  expect((await settled).every(result => result.status === 'rejected')).toBe(true);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(registry.actionCompletion('settings.app-update')).toBeNull();
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).not.toBe('Update available');
  stop();
});

test.each(['local', 'stale'] as const)('%s requests cannot invoke this live action', async condition => {
  start(condition === 'local' ? 'local' : 'live-source'); const { spy } = guardedFetch(); await mount();
  const request = { sessionId: condition === 'stale' ? 'another-session' : session,
    signal: new AbortController().signal, remainingMs: () => 8000 };
  await expect(registry.invokeAction('settings.app-update', 'settings.update.check', request)).rejects.toThrow('unavailable');
  expect(spy).not.toHaveBeenCalled();
});

test('offline retry produces a failed UI result rather than reusing the previous successful result', async () => {
  start(); const { guard, spy } = guardedFetch(); await mount(); const stop = guard.beginAppUpdateMetadata();
  const request = { sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000 };
  await act(async () => { await registry.invokeAction('settings.app-update', 'settings.update.check', request); });
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).toBe('Update available');
  spy.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await expect(registry.invokeAction('settings.app-update', 'settings.update.check', {
      sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000,
    })).rejects.toThrow('offline');
  });
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).toBe('Check failed');
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  expect(ensureApkBackgroundDownload).not.toHaveBeenCalled(); stop();
});

test.each([
  { package_name: 'another.package' },
  { signing_certificate_sha256: 'b'.repeat(64) },
  { bytes: 0 },
] as const)('rejects malformed/untrusted metadata without a ready UI result: %j', async invalid => {
  start(); const { guard, spy } = guardedFetch(); await mount(); const stop = guard.beginAppUpdateMetadata();
  spy.mockImplementation(async url => ({ ok: true, url: String(url), json: async () => ({ ...remote, ...invalid }) }));
  await act(async () => { await expect(registry.invokeAction('settings.app-update', 'settings.update.check', {
    sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000,
  })).rejects.toThrow(); });
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).toBe('Check failed');
  expect(ensureApkBackgroundDownload).not.toHaveBeenCalled(); stop();
});

test('unmount aborts its native request and releases the single-flight controller', async () => {
  start(); const { guard, spy } = guardedFetch(); await mount(); const stop = guard.beginAppUpdateMetadata();
  let aborted = false;
  spy.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }));
  let pending!: Promise<unknown>;
  act(() => { pending = registry.invokeAction('settings.app-update', 'settings.update.check', {
    sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000,
  }); });
  const outcome = pending.then(() => 'passed', () => 'failed');
  act(() => { tree!.unmount(); }); tree = undefined;
  await act(async () => { await outcome; });
  expect(await outcome).toBe('failed'); expect(aborted).toBe(true);
  await mount(); spy.mockImplementation(async url => ({ ok: true, url: String(url), json: async () => remote }));
  await act(async () => { await expect(registry.invokeAction('settings.app-update', 'settings.update.check', {
    sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000,
  })).resolves.toMatchObject({ status: 'available' }); });
  stop();
});

test('the driver waits for native layout of the committed result, rejecting initial and Checking callbacks', async () => {
  jest.useFakeTimers(); start(); const { guard, spy } = guardedFetch(); await mount();
  const initialView = tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  const initialCallback = initialView.props.onLayout;
  let respond!: () => void;
  spy.mockImplementation(url => new Promise(resolve => { respond = () => resolve({ ok: true, url: String(url), json: async () => remote }); }));
  const watchdog = new PerformanceAuditStepWatchdog('update');
  let result: Awaited<ReturnType<typeof runLiveUpdateReadiness>> | undefined;
  const pending = runLiveUpdateReadiness({ app: { appVersion: '1.0.0', buildVersion: '40' },
    download: { phase: 'idle' } as any, watchdog, transport: guard,
    openSettings: async () => {}, assertActive: () => watchdog.assertWithinBudget() });
  const outcome = pending.then(value => { result = value; });
  await act(async () => { await jest.advanceTimersByTimeAsync(700); });
  expect(spy).toHaveBeenCalledTimes(1);
  const checkingCallback = tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0].props.onLayout;
  const layout = { nativeEvent: { layout: { width: 380, height: 320 } } };
  act(() => checkingCallback(layout));
  await act(async () => { respond(); });
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).toBe('Update available');
  // Fresh metadata and a previous native layout must never certify the result.
  await act(async () => { await jest.advanceTimersByTimeAsync(700); });
  expect(result).toBeUndefined();
  act(() => { initialCallback(layout); checkingCallback(layout); });
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  expect(result).toBeUndefined();
  const resultView = tree!.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  expect(resultView).not.toBe(initialView);
  const resultCallback = resultView.props.onLayout;
  act(() => resultCallback({ nativeEvent: { layout: { width: 0, height: 320 } } }));
  expect(registry.snapshot(['settings.app-update'], ['data', 'layout']).ready).toBe(false);
  act(() => resultCallback(layout));
  act(() => checkingCallback({ nativeEvent: { layout: { width: 0, height: 0 } } }));
  const measured = registry.snapshot(['settings.app-update'], ['data', 'layout']);
  expect(measured.ready).toBe(true);
  expect(measured.surfaces[0].probes.find(probe => probe.id === 'app-update.layout')?.renderRevision)
    .toBe(measured.surfaces[0].renderRevision);
  await act(async () => { await jest.advanceTimersByTimeAsync(700); await outcome; });
  const [owner] = dedicatedPerformanceAuditChecks('android');
  expect(owner).toBe(ANDROID_UPDATE_READINESS_AUDIT);
  expect(result).toMatchObject({ id: owner.checkId, status: 'pass', metrics: {
    ownerCheckId: owner.checkId, semanticActionId: owner.semanticActionId,
    expectedSurface: owner.expectedSurface, expectedPath: owner.expectedPath,
    executionPhase: owner.phase, transportScope: owner.transportScope,
    executionAttempted: true, actionInvoked: true, actionCompleted: true, durationMayUseTtlCache: false,
    updateMetadataTransportCalls: 1, readinessPendingRequiredProbeCount: 0,
  } });
  expect(result?.durationMs).toBeLessThan(10_000); watchdog.close();
});

test('one budget bounds route setup, network and rendering; timeout revokes access and aborts the pending request', async () => {
  jest.useFakeTimers(); start(); const { guard, spy } = guardedFetch(); await mount();
  let aborted = false;
  spy.mockImplementation((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }));
  const watchdog = new PerformanceAuditStepWatchdog('update');
  const pending = runLiveUpdateReadiness({ app: { appVersion: '1.0.0', buildVersion: '40' },
    download: { phase: 'idle' } as any, watchdog, transport: guard,
    openSettings: async () => { await new Promise(resolve => setTimeout(resolve, 6000)); },
    assertActive: () => watchdog.assertWithinBudget() });
  const outcome = pending.then(() => 'passed', () => 'failed');
  await act(async () => { await jest.advanceTimersByTimeAsync(10_050); });
  expect(await outcome).toBe('failed'); expect(aborted).toBe(true);
  await expect(global.fetch(APK_MANIFEST_URL, { method: 'GET', credentials: 'omit' })).rejects.toThrow('blocked');
  watchdog.close();
});

test('an unmeasured update surface cannot pass or execute the metadata request', async () => {
  jest.useFakeTimers(); start(); const { guard, spy } = guardedFetch(); await mount(false);
  const watchdog = new PerformanceAuditStepWatchdog('update');
  const pending = runLiveUpdateReadiness({ app: { appVersion: '1.0.0', buildVersion: '40' },
    download: { phase: 'idle' } as any, watchdog, transport: guard, openSettings: async () => {},
    assertActive: () => watchdog.assertWithinBudget() });
  const outcome = pending.then(() => 'passed', () => 'failed');
  await act(async () => { await jest.advanceTimersByTimeAsync(10_050); });
  expect(await outcome).toBe('failed'); expect(spy).not.toHaveBeenCalled(); watchdog.close();
});

test('a cancelled session ignores a late successful response', async () => {
  start(); const { guard, spy } = guardedFetch(); await mount(); const stop = guard.beginAppUpdateMetadata();
  let respond!: () => void;
  spy.mockImplementation(url => new Promise(resolve => { respond = () => resolve({ ok: true, url: String(url), json: async () => remote }); }));
  let pending!: Promise<unknown>;
  act(() => { pending = registry.invokeAction('settings.app-update', 'settings.update.check', {
    sessionId: session, signal: new AbortController().signal, remainingMs: () => 8000,
  }); });
  const outcome = pending.then(() => 'passed', () => 'failed');
  await act(async () => { cancelPerformanceAudit(); respond(); await outcome; });
  expect(await outcome).toBe('failed'); expect(registry.actionCompletion('settings.app-update')).toBeNull();
  expect(tree!.root.findByProps({ label: 'Status' }).props.value).not.toBe('Update available'); stop();
});

test('ARM metadata checks retain canonical universal fallback within the shared remaining budget', async () => {
  const { guard, spy } = guardedFetch(); const stop = guard.beginAppUpdateMetadata();
  spy.mockRejectedValueOnce(new Error('ARM channel unavailable'));
  expect(await readAppUpdateMetadata({ version: '1.0.0', buildNumber: '40' }, ['arm64-v8a'], {
    sessionId: 'arm', signal: new AbortController().signal, remainingMs: () => 7000,
  })).toMatchObject({ status: 'available' });
  expect(String(spy.mock.calls[0][0])).toContain(APK_ARM_MANIFEST_URL);
  expect(String(spy.mock.calls[1][0])).toContain(APK_MANIFEST_URL); stop();
});
