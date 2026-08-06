import {
  bridgeLogToCrashlytics,
  initObservability,
  isSessionReplayRouteAllowed,
  isDiagnosticsEnabled,
  reportPerformanceAudit,
  setDiagnosticsEnabled,
  setObservabilityDepsForTests,
  type CrashlyticsLike,
  type ClarityLike,
} from '../src/lib/observability';
import firebaseConfig from '../firebase.json';

function makeMocks() {
  const crashlyticsApi: CrashlyticsLike = {
    log: jest.fn(),
    recordError: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(async () => {}),
  };
  const clarityApi: ClarityLike = {
    initialize: jest.fn(),
    pause: jest.fn(async () => true),
    resume: jest.fn(async () => true),
    consent: jest.fn(async () => true),
  };
  const crashlytics = jest.fn(() => crashlyticsApi);
  return { crashlytics, crashlyticsApi, clarityApi };
}

describe('observability', () => {
  it('keeps native crash collection disabled until explicit consent is hydrated', () => {
    expect(firebaseConfig['react-native'].crashlytics_auto_collection_enabled).toBe(false);
  });

  it('blocks replay on financial-input, profile, settings, and authentication routes', () => {
    expect(isSessionReplayRouteAllowed('/calculator')).toBe(false);
    expect(isSessionReplayRouteAllowed('/projections')).toBe(false);
    expect(isSessionReplayRouteAllowed('/profile/edit')).toBe(false);
    expect(isSessionReplayRouteAllowed('/settings')).toBe(false);
    expect(isSessionReplayRouteAllowed('/auth/login')).toBe(false);
    expect(isSessionReplayRouteAllowed('/')).toBe(false);
    expect(isSessionReplayRouteAllowed('/rate-receipt')).toBe(false);
    expect(isSessionReplayRouteAllowed('/debug-log')).toBe(false);
    expect(isSessionReplayRouteAllowed('/performance-audit')).toBe(false);
    expect(isSessionReplayRouteAllowed('/product/abc')).toBe(true);
    expect(isSessionReplayRouteAllowed('/future-sensitive-screen')).toBe(false);
  });
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  const originalClarityId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    setObservabilityDepsForTests(null);
    void setDiagnosticsEnabled(true);
  });

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID = originalClarityId;
    setObservabilityDepsForTests(null);
  });

  it('bridges info/warn/error to Crashlytics when enabled', () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: makeMocks().clarityApi });

    bridgeLogToCrashlytics('info', 'store', 'refresh ok');
    bridgeLogToCrashlytics('warn', 'store', 'prefs failed');
    bridgeLogToCrashlytics('error', 'payload', 'download failed');
    bridgeLogToCrashlytics('debug', 'store', 'skipped');

    expect(crashlyticsApi.log).toHaveBeenCalledTimes(3);
    expect(crashlyticsApi.recordError).toHaveBeenCalledTimes(1);
    expect(crashlyticsApi.log).toHaveBeenCalledWith('[ERROR] payload: download failed');
  });

  it('removes network and stable device identifiers from bridged logs', () => {
    const { crashlytics, crashlyticsApi, clarityApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: clarityApi });

    bridgeLogToCrashlytics(
      'info',
      'network',
      'https://example.test/path?token=private ip=203.0.113.7 id=0f8fad5b-d9cb-469f-a165-70867728950e',
    );

    const line = String((crashlyticsApi.log as jest.Mock).mock.calls.at(-1)?.[0]);
    expect(line).toContain('https://example.test/path');
    expect(line).not.toContain('token=private');
    expect(line).not.toContain('203.0.113.7');
    expect(line).not.toContain('0f8fad5b');
  });

  it('skips Crashlytics bridge when diagnostics disabled', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: makeMocks().clarityApi });
    await setDiagnosticsEnabled(false);

    bridgeLogToCrashlytics('error', 'app', 'boom');
    expect(crashlyticsApi.log).not.toHaveBeenCalled();
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it('initializes Clarity outside __DEV__ when project id is set', async () => {
    const { crashlytics, clarityApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: clarityApi });
    (global as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID = 'test-clarity-project';

    await initObservability();

    expect(clarityApi.initialize).toHaveBeenCalledWith('test-clarity-project');
    expect(clarityApi.consent).toHaveBeenCalledWith(false, true);
    expect(crashlytics().setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(true);
  });

  it('pauses Clarity when diagnostics are disabled after init', async () => {
    const { crashlytics, clarityApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: clarityApi });
    (global as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID = 'test-clarity-project';

    await initObservability();
    await setDiagnosticsEnabled(false);

    expect(clarityApi.pause).toHaveBeenCalled();
    expect(clarityApi.consent).toHaveBeenLastCalledWith(false, false);
  });

  it('initializes Clarity when enabling diagnostics mid-session', async () => {
    const { crashlytics, clarityApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: clarityApi });
    (global as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID = 'test-clarity-project';

    await setDiagnosticsEnabled(false);
    await setDiagnosticsEnabled(true);

    expect(clarityApi.initialize).toHaveBeenCalledWith('test-clarity-project');
    expect(clarityApi.resume).toHaveBeenCalled();
  });

  it('uploads only a deidentified audit envelope when crash reporting is enabled', () => {
    const { crashlytics, crashlyticsApi, clarityApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics, clarity: clarityApi });
    const sent = reportPerformanceAudit({
      schemaVersion: 2,
      sessionId: 'private-session-id',
      startedAt: '2026-08-06T00:00:00Z',
      finishedAt: '2026-08-06T00:01:00Z',
      durationMs: 60_000,
      watchdog: { hangTimeoutMs: 30_000, storedCheckCount: 1, lastStoredCheckAt: null },
      environment: {
        appVersion: '1.0.88', buildVersion: '201', platform: 'android', platformVersion: '37',
        manufacturer: 'Private Maker', brand: 'Private Brand', model: 'Private Model',
        osName: 'Android', osVersion: '17.2.1', totalMemoryBytes: 123456789,
        jsEngine: 'Hermes', developmentBuild: false, viewportWidth: 448, viewportHeight: 997,
        fontScale: 1, payloadSource: 'remote', payloadRunDate: '2026-08-06',
        payloadProducts: 2878, payloadProviders: 104, detailsLoaded: true, historyLoaded: true,
        diagnosticsUploadEnabled: true, networkType: 'WIFI', networkConnected: true,
        networkInternetReachable: true,
      },
      summary: {
        overall: 'bottleneck', pass: 0, warn: 0, fail: 1, skipped: 0,
        slowestCheckId: 'manifest-network', slowestCheckLabel: 'Manifest', slowestCheckMs: 7000,
        maxEventLoopLagMs: 6000, maxFrameGapMs: 6000,
      },
      checks: [{
        id: 'manifest-network', label: 'Private label', kind: 'network', status: 'fail', durationMs: 7000,
        metrics: { headersMs: 6999, expectedPath: '/product/private-id' }, trace: 'private trace',
      }],
      limitations: ['private limitation'],
    });

    expect(sent).toBe(true);
    const uploaded = (crashlyticsApi.log as jest.Mock).mock.calls.flat().join('\n');
    expect(uploaded).toContain('manifest-network');
    expect(uploaded).not.toContain('private-session-id');
    expect(uploaded).not.toContain('Private Model');
    expect(uploaded).not.toContain('/product/private-id');
    expect(uploaded).not.toContain('private trace');
  });
});
