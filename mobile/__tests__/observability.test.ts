import {
  bridgeLogToCrashlytics,
  initObservability,
  isDiagnosticsEnabled,
  setDiagnosticsEnabled,
  setObservabilityDepsForTests,
  type CrashlyticsLike,
} from '../src/lib/observability';
import firebaseConfig from '../firebase.json';

function makeMocks() {
  const crashlyticsApi: CrashlyticsLike = {
    log: jest.fn(),
    recordError: jest.fn(),
    setAttribute: jest.fn(async () => {}),
    isCrashlyticsCollectionEnabled: false,
    setCrashlyticsCollectionEnabled: jest.fn(async (enabled: boolean) => {
      crashlyticsApi.isCrashlyticsCollectionEnabled = enabled;
    }),
  };
  const crashlytics = jest.fn(() => crashlyticsApi);
  return { crashlytics, crashlyticsApi };
}

describe('observability', () => {
  it('keeps native crash collection disabled until explicit consent is hydrated', () => {
    expect(firebaseConfig['react-native'].crashlytics_auto_collection_enabled).toBe(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setObservabilityDepsForTests(null);
  });

  afterEach(() => {
    setObservabilityDepsForTests(null);
  });

  it('bridges only a fixed error category to Crashlytics when enabled', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics });
    await setDiagnosticsEnabled(true);

    expect(crashlyticsApi.setAttribute).toHaveBeenCalledWith(
      'ar_diagnostics_privacy_notice',
      '2026-09-03',
    );

    bridgeLogToCrashlytics('info', 'store', 'refresh ok');
    bridgeLogToCrashlytics('warn', 'store', 'prefs failed');
    bridgeLogToCrashlytics('error', 'payload', 'download failed');
    bridgeLogToCrashlytics('debug', 'store', 'skipped');

    expect(crashlyticsApi.log).toHaveBeenCalledTimes(1);
    expect(crashlyticsApi.recordError).toHaveBeenCalledTimes(1);
    expect(crashlyticsApi.log).toHaveBeenCalledWith('[ERROR] category=payload');
    expect(crashlyticsApi.log).not.toHaveBeenCalledWith(expect.stringContaining('download failed'));
  });

  it('keeps arbitrary informational content out of Crashlytics', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics });
    await setDiagnosticsEnabled(true);

    bridgeLogToCrashlytics(
      'info',
      'network',
      'https://example.test/path?token=private ip=203.0.113.7 id=0f8fad5b-d9cb-469f-a165-70867728950e',
    );

    expect(crashlyticsApi.log).not.toHaveBeenCalled();
    expect(crashlyticsApi.recordError).not.toHaveBeenCalled();
  });

  it('skips Crashlytics bridge when diagnostics disabled', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics });
    await setDiagnosticsEnabled(false);

    bridgeLogToCrashlytics('error', 'app', 'boom');
    expect(crashlyticsApi.log).not.toHaveBeenCalled();
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it('initializes only the consent-gated crash collection state', async () => {
    const { crashlytics } = makeMocks();
    setObservabilityDepsForTests({ crashlytics });

    await initObservability();

    expect(crashlytics().setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(false);
  });

  it('does not change reported consent when native transition rejects', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    setObservabilityDepsForTests({ crashlytics });
    await setDiagnosticsEnabled(true);
    crashlyticsApi.setCrashlyticsCollectionEnabled = jest.fn(async () => {
      throw new Error('native failure');
    });

    await expect(setDiagnosticsEnabled(false)).rejects.toThrow('native failure');
    expect(isDiagnosticsEnabled()).toBe(true);
  });

  it('rejects a native transition that resolves without changing state', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    crashlyticsApi.setCrashlyticsCollectionEnabled = jest.fn(async () => {});
    setObservabilityDepsForTests({ crashlytics });

    await expect(setDiagnosticsEnabled(true)).rejects.toThrow(
      'consent was not confirmed',
    );
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it('fails closed when the current privacy marker cannot be attested', async () => {
    const { crashlytics, crashlyticsApi } = makeMocks();
    crashlyticsApi.setAttribute = jest.fn(async () => {
      throw new Error('attribute failed');
    });
    setObservabilityDepsForTests({ crashlytics });

    await expect(setDiagnosticsEnabled(true)).rejects.toThrow('attribute failed');
    expect(crashlyticsApi.setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(false);
    expect(crashlyticsApi.setCrashlyticsCollectionEnabled).not.toHaveBeenCalledWith(true);
    expect(isDiagnosticsEnabled()).toBe(false);
  });
});
