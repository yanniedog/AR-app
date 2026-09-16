import type { CorePayload, Manifest } from '../src/types';
import { SAMPLE_MAX_AGE_DAYS, sampleCore, sampleManifest } from '../src/data/sample';

const mockReadBundle = jest.fn();
const mockReadSuitabilityIndex = jest.fn();
const mockWriteBundle = jest.fn();
const mockFetchManifest = jest.fn();
const mockDownloadCore = jest.fn();
const mockFetchDatesIndexJson = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI' })),
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR' },
}));

jest.mock('../src/data/cache', () => ({
  cache: {
    readBundle: (...args: unknown[]) => mockReadBundle(...args),
    readMeta: jest.fn(async () => null),
    writeBundle: (...args: unknown[]) => mockWriteBundle(...args),
    readDetails: jest.fn(async () => null),
    writeDetails: jest.fn(async () => {}),
    updateMeta: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
    readSearchIndex: jest.fn(async () => null),
    readHistoryBanks: jest.fn(async () => null),
    clearHistoryBanks: jest.fn(async () => {}),
    readBankInsights: jest.fn(async () => null),
    readProductHistory: jest.fn(async () => null),
    readOptionalMeta: jest.fn(async () => null),
    writeOptionalMeta: jest.fn(async () => {}),
    readSuitabilityIndex: (...args: unknown[]) => mockReadSuitabilityIndex(...args),
    writeSuitabilityIndex: jest.fn(async () => {}),
  },
}));

jest.mock('../src/data/payload', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
  downloadCore: (...args: unknown[]) => mockDownloadCore(...args),
  downloadDetails: jest.fn(),
}));

jest.mock('../src/data/historyDaily', () => {
  const actual = jest.requireActual('../src/data/historyDaily') as object;
  return {
    ...actual,
    fetchDatesIndexJson: (...args: unknown[]) => mockFetchDatesIndexJson(...args),
  };
});

// eslint-disable-next-line import/first -- store import must follow jest mocks
import { useStore } from '../src/data/store';
// eslint-disable-next-line import/first -- suitability modules share the mocked cache
import { clearSuitabilityIndex } from '../src/data/suitabilityIndex';
// eslint-disable-next-line import/first -- suitability modules share the mocked cache
import { getSuitabilityAllowed, setSuitabilityAllowed } from '../src/data/suitabilityGate';

const remoteManifest: Manifest = sampleManifest;
const remoteCore: CorePayload = sampleCore;

function resetStore() {
  useStore.setState({
    status: 'error',
    refreshing: false,
    source: 'sample',
    manifest: null,
    core: null,
    details: null,
    detailsLoading: false,
    error: 'network error',
    offline: true,
    lastCheckedAt: null,
    payloadProgress: null,
    hydrated: true,
    prefs: { ...useStore.getState().prefs, wifiOnly: false },
    favorites: [],
  });
}

describe('store error recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSuitabilityIndex();
    resetStore();
    mockReadSuitabilityIndex.mockResolvedValue(null);
    mockWriteBundle.mockResolvedValue(undefined);
    mockFetchManifest.mockResolvedValue(remoteManifest);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: [remoteManifest.run_date],
      count: 1,
      min_date: remoteManifest.run_date,
      latest_date: remoteManifest.run_date,
    });
    mockDownloadCore.mockResolvedValue({
      text: JSON.stringify(remoteCore),
      core: remoteCore,
    });
    (jest.requireMock('expo-network').getNetworkStateAsync as jest.Mock)
      .mockResolvedValue({ type: 'WIFI' });
  });

  it('legacy sample action cannot install business data from the APK', async () => {
    await useStore.getState().loadSampleFallback();
    expect(useStore.getState().status).toBe('error');
    expect(useStore.getState().core).toBeNull();
    expect(mockWriteBundle).not.toHaveBeenCalled();
  });

  it('retryDataLoad bootstraps from cache then refreshes when bundle exists', async () => {
    mockReadBundle.mockResolvedValue({
      meta: {
        manifest: remoteManifest,
        source: 'remote',
        savedAt: '2026-06-09T00:00:00Z',
        coreSha: remoteManifest.files.core.sha256,
        detailsSha: null,
      },
      core: remoteCore,
    });
    await useStore.getState().retryDataLoad();
    const state = useStore.getState();
    expect(state.status).toBe('ready');
    expect(state.error).toBeNull();
    expect(state.core).toEqual(remoteCore);
    expect(mockFetchManifest).toHaveBeenCalled();
  });

  it('retryDataLoad bypasses an expired cached sample and still refreshes remotely', async () => {
    const observed = Date.parse(`${sampleManifest.run_date}T00:00:00Z`);
    jest.useFakeTimers().setSystemTime(observed + (SAMPLE_MAX_AGE_DAYS + 1) * 86400000);
    try {
      mockReadBundle.mockResolvedValue({
        meta: {
          manifest: sampleManifest,
          source: 'sample',
          savedAt: `${sampleManifest.run_date}T00:00:00Z`,
          coreSha: sampleManifest.files.core.sha256,
          detailsSha: null,
        },
        core: sampleCore,
      });

      const retry = useStore.getState().retryDataLoad();
      await jest.runAllTimersAsync();
      await retry;

      expect(mockFetchManifest).toHaveBeenCalled();
      expect(useStore.getState().status).toBe('ready');
      expect(useStore.getState().source).toBe('remote');
    } finally {
      jest.useRealTimers();
    }
  });

  it('retains but does not display old sample cache', async () => {
    const bundledObserved = Date.parse(sampleManifest.generated_at);
    const oldGeneratedAt = new Date(
      bundledObserved - (SAMPLE_MAX_AGE_DAYS + 1) * 86400000,
    ).toISOString();
    const oldRunDate = oldGeneratedAt.slice(0, 10);
    const oldManifest = { ...sampleManifest, run_date: oldRunDate, generated_at: oldGeneratedAt };
    const oldCore = { ...sampleCore, run_date: oldRunDate };
    jest.useFakeTimers().setSystemTime(new Date(sampleManifest.generated_at));
    try {
      useStore.setState({ status: 'idle', core: null, error: null });
      mockReadBundle.mockResolvedValue({
        meta: {
          manifest: oldManifest,
          source: 'sample',
          savedAt: oldGeneratedAt,
          coreSha: sampleManifest.files.core.sha256,
          detailsSha: null,
        },
        core: oldCore,
      });

      await useStore.getState().bootstrap({ skipRefresh: true });

      expect(useStore.getState().core).toBeNull();
      expect(useStore.getState().status).toBe('error');
      expect(mockWriteBundle).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves the splash for an error screen when Wi-Fi policy skips expired-sample refresh', async () => {
    const observed = Date.parse(sampleManifest.generated_at);
    jest.useFakeTimers().setSystemTime(
      observed + (SAMPLE_MAX_AGE_DAYS + 1) * 86400000,
    );
    try {
      useStore.setState({
        status: 'idle',
        core: null,
        error: null,
        prefs: { ...useStore.getState().prefs, wifiOnly: true },
      });
      mockReadBundle.mockResolvedValue(null);
      (jest.requireMock('expo-network').getNetworkStateAsync as jest.Mock)
        .mockResolvedValue({ type: 'CELLULAR' });

      await useStore.getState().bootstrap();

      expect(useStore.getState().refreshOutcome).toBe('wifi-skip');
      expect(useStore.getState().status).toBe('error');
      expect(useStore.getState().error).toContain('No verified rates');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not replace an old sample with another bundled dataset', async () => {
    const oldManifest: Manifest = {
      ...sampleManifest,
      run_date: '2026-05-19',
      files: {
        ...sampleManifest.files,
        core: { ...sampleManifest.files.core, sha256: 'old-sample-core' },
      },
    };
    mockReadBundle.mockResolvedValue({
      meta: {
        manifest: oldManifest,
        source: 'sample',
        savedAt: '2026-05-19T00:00:00Z',
        coreSha: 'old-sample-core',
        detailsSha: null,
      },
      core: { ...sampleCore, run_date: '2026-05-19' },
    });
    useStore.setState({ status: 'idle', core: null, manifest: null, error: null });

    await useStore.getState().bootstrap({ skipRefresh: true });

    expect(mockWriteBundle).not.toHaveBeenCalled();
    expect(useStore.getState().status).toBe('error');
    expect(useStore.getState().manifest).toBeNull();
    expect(useStore.getState().core).toBeNull();
  });

  it('fails closed on cached startup until the exact post-ingest suitability index is rebuilt', async () => {
    const ensureDetails = jest.fn(async () => {});
    setSuitabilityAllowed(new Set(['stale-product']));
    useStore.setState({
      status: 'idle',
      core: null,
      error: null,
      ensureDetails,
    });
    mockReadBundle.mockResolvedValue({
      meta: {
        manifest: remoteManifest,
        source: 'remote',
        savedAt: '2026-07-24T00:00:00Z',
        coreSha: remoteManifest.files.core.sha256,
        detailsSha: null,
      },
      core: remoteCore,
    });

    await useStore.getState().bootstrap({ skipRefresh: true });

    expect(getSuitabilityAllowed()).toEqual(new Set());
    expect(ensureDetails).toHaveBeenCalledWith({ force: true });
  });

  it.each([
    { label: 'current', schemaVersion: 3, rebuild: false },
    { label: 'legacy conditionality', schemaVersion: 2, rebuild: true },
  ])('handles the $label cached suitability index without resetting the payload', async ({ schemaVersion, rebuild }) => {
    const ensureDetails = jest.fn(async () => {});
    useStore.setState({
      status: 'idle',
      core: null,
      error: null,
      ensureDetails,
    });
    mockReadBundle.mockResolvedValue({
      meta: {
        manifest: remoteManifest,
        source: 'remote',
        savedAt: '2026-07-24T00:00:00Z',
        coreSha: remoteManifest.files.core.sha256,
        detailsSha: remoteManifest.files.details.sha256,
      },
      core: remoteCore,
    });
    mockReadSuitabilityIndex.mockResolvedValue({
      schemaVersion,
      runDate: remoteCore.run_date,
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: remoteManifest.files.details.sha256,
      allowed: ['allowed-product'],
    });

    await useStore.getState().bootstrap({ skipRefresh: true });

    expect(useStore.getState().core).toBe(remoteCore);
    if (rebuild) {
      expect(getSuitabilityAllowed()).toEqual(new Set());
      expect(ensureDetails).toHaveBeenCalledWith({ force: true });
    } else {
      expect(getSuitabilityAllowed()).toEqual(new Set(['allowed-product']));
      expect(ensureDetails).not.toHaveBeenCalled();
    }
  });

  it('bootstrap preserves failure when downloaded cache cannot be written', async () => {
    useStore.setState({ status: 'idle', core: null, error: null });
    mockReadBundle.mockResolvedValue(null);
    mockWriteBundle.mockRejectedValueOnce(new Error('disk full'));
    await useStore.getState().bootstrap();
    const state = useStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('disk full');
    expect(state.core).toBeNull();
  });
});
