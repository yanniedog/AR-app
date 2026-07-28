import type { CorePayload, Manifest } from '../src/types';
import { sampleCore, sampleManifest } from '../src/data/sample';

const mockReadBundle = jest.fn();
const mockReadMeta = jest.fn();
const mockWriteBundle = jest.fn();
const mockUpdateMeta = jest.fn(async (_meta?: unknown) => {});
const mockFetchManifest = jest.fn();
const mockDownloadCore = jest.fn();
const mockReadDetails = jest.fn();
const mockFetchDatesIndexJson = jest.fn();
const mockEnsureHistoryBanks = jest.fn(async () => {});
const mockEnsureBankInsights = jest.fn(async () => {});
const mockEnsureRbaCalendar = jest.fn(async () => {});

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
    readMeta: (...args: unknown[]) => mockReadMeta(...args),
    writeBundle: (...args: unknown[]) => mockWriteBundle(...args),
    readDetails: (...args: unknown[]) => mockReadDetails(...args),
    writeDetails: jest.fn(async () => {}),
    updateMeta: (meta: unknown) => mockUpdateMeta(meta),
    readSuitabilityIndex: jest.fn(async () => null),
    writeSuitabilityIndex: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
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
// eslint-disable-next-line import/first -- suitability module shares the mocked cache
import {
  clearSuitabilityIndex,
  installSuitabilityIndex,
} from '../src/data/suitabilityIndex';
// eslint-disable-next-line import/first -- suitability module shares the mocked cache
import { getSuitabilityAllowed } from '../src/data/suitabilityGate';

const originalEnsureHistoryBanks = useStore.getState().ensureHistoryBanks;
const originalEnsureBankInsights = useStore.getState().ensureBankInsights;
const originalEnsureRbaCalendar = useStore.getState().ensureRbaCalendar;

const remoteManifest: Manifest = sampleManifest;
const remoteCore: CorePayload = sampleCore;

function resetStore() {
  useStore.setState({
    status: 'ready',
    refreshing: false,
    source: 'sample',
    manifest: remoteManifest,
    core: remoteCore,
    details: null,
    detailsLoading: false,
    error: null,
    offline: false,
    lastCheckedAt: null,
    payloadProgress: null,
    refreshOutcome: null,
    pendingIngestRunDate: null,
    hydrated: true,
    prefs: useStore.getState().prefs,
    favorites: [],
    ensureHistoryBanks: originalEnsureHistoryBanks,
    ensureBankInsights: originalEnsureBankInsights,
    ensureRbaCalendar: originalEnsureRbaCalendar,
  });
}

describe('store refresh lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSuitabilityIndex();
    resetStore();
    mockFetchManifest.mockResolvedValue(remoteManifest);
    mockWriteBundle.mockResolvedValue(undefined);
    mockReadDetails.mockResolvedValue(null);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: [remoteManifest.run_date],
      count: 1,
      min_date: remoteManifest.run_date,
      latest_date: remoteManifest.run_date,
    });
  });

  it('syncs source to remote on up-to-date refresh and clears refreshing', async () => {
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-06-09T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
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

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(mockReadBundle).not.toHaveBeenCalled();
    const state = useStore.getState();
    expect(state.source).toBe('remote');
    expect(state.refreshing).toBe(false);
    expect(state.payloadProgress).toBeNull();
    expect(state.offline).toBe(false);
    expect(state.refreshOutcome).toBe('success');
  });

  it('refreshes optional assets when a same-core manifest revises their hashes', async () => {
    const asset = (name: string, sha256: string) => ({
      name,
      bytes: 100,
      sha256,
      url: `https://example.com/${name}`,
    });
    const previousManifest: Manifest = {
      ...remoteManifest,
      files: {
        ...remoteManifest.files,
        history_banks: asset('history.json.gz', 'history-old'),
        bank_history: asset('banks.json.gz', 'banks-old'),
        rba_calendar: asset('calendar.json.gz', 'calendar-old'),
      },
    };
    const revisedManifest: Manifest = {
      ...previousManifest,
      files: {
        ...previousManifest.files,
        history_banks: asset('history.json.gz', 'history-new'),
        bank_history: asset('banks.json.gz', 'banks-new'),
        rba_calendar: asset('calendar.json.gz', 'calendar-new'),
      },
    };
    useStore.setState({
      source: 'remote',
      manifest: previousManifest,
      ensureHistoryBanks: mockEnsureHistoryBanks,
      ensureBankInsights: mockEnsureBankInsights,
      ensureRbaCalendar: mockEnsureRbaCalendar,
    });
    mockFetchManifest.mockResolvedValue(revisedManifest);
    mockReadMeta.mockResolvedValue({
      manifest: previousManifest,
      source: 'remote',
      savedAt: '2026-06-09T00:00:00Z',
      coreSha: revisedManifest.files.core.sha256,
      detailsSha: revisedManifest.files.details.sha256,
    });

    await expect(useStore.getState().refresh({})).resolves.toBe(false);

    expect(mockEnsureHistoryBanks).toHaveBeenCalledTimes(1);
    expect(mockEnsureBankInsights).toHaveBeenCalledTimes(1);
    expect(mockEnsureRbaCalendar).toHaveBeenCalledTimes(1);
  });

  it('manual refresh checks the manifest but preserves an identical live core', async () => {
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-06-09T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    const liveCore = useStore.getState().core;

    const changed = await useStore.getState().refresh({ manual: true });

    expect(changed).toBe(false);
    expect(mockFetchManifest).toHaveBeenCalledTimes(1);
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(mockWriteBundle).not.toHaveBeenCalled();
    expect(mockReadBundle).not.toHaveBeenCalled();
    expect(useStore.getState().core).toBe(liveCore);
  });

  it('supports an explicit cache repair without overloading manual refresh', async () => {
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-06-09T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadCore.mockResolvedValue({ text: JSON.stringify(remoteCore), core: remoteCore });

    const changed = await useStore.getState().refresh({ manual: true, repairCache: true });

    expect(changed).toBe(true);
    expect(mockDownloadCore).toHaveBeenCalledTimes(1);
    expect(mockWriteBundle).toHaveBeenCalledTimes(1);
  });

  it('repairs an unreadable cached bundle even when metadata is current', async () => {
    useStore.setState({ core: null });
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-06-09T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockReadBundle.mockResolvedValue(null);
    mockDownloadCore.mockResolvedValue({ text: JSON.stringify(remoteCore), core: remoteCore });

    const changed = await useStore.getState().refresh({ manual: true });

    expect(changed).toBe(true);
    expect(mockReadBundle).toHaveBeenCalledTimes(1);
    expect(mockDownloadCore).toHaveBeenCalledTimes(1);
    expect(mockWriteBundle).toHaveBeenCalledTimes(1);
  });

  it('closes a stale suitability gate before publishing a replacement core', async () => {
    const previousManifest: Manifest = {
      ...remoteManifest,
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'previous-core-sha' },
      },
    };
    useStore.setState({ source: 'remote', manifest: previousManifest });
    installSuitabilityIndex({
      runDate: remoteCore.run_date,
      coreSha: 'previous-core-sha',
      detailsSha: previousManifest.files.details.sha256,
      allowed: new Set(['previously-allowed-product']),
    });
    mockReadMeta.mockResolvedValue({
      manifest: previousManifest,
      source: 'remote',
      savedAt: '2026-06-08T00:00:00Z',
      coreSha: 'previous-core-sha',
      detailsSha: previousManifest.files.details.sha256,
    });
    mockDownloadCore.mockResolvedValue({ text: JSON.stringify(remoteCore), core: remoteCore });

    await useStore.getState().refresh({});

    // Refresh closes the stale allowlist before publish, then post-warm rebuilds
    // a fresh gate. The previous payload's product must not remain allowed.
    expect(getSuitabilityAllowed()?.has('previously-allowed-product')).toBe(false);
  });

  it('holds the prior day while rolling ingest is ahead of dates-index', async () => {
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    const priorCore = { ...remoteCore, run_date: '2026-07-27' } as CorePayload;
    const priorManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
    };
    useStore.setState({
      source: 'remote',
      core: priorCore,
      manifest: priorManifest,
      pendingIngestRunDate: null,
    });
    mockFetchManifest
      .mockResolvedValueOnce(rollingManifest)
      // Dated release for rolling day not ready yet → hold prior day.
      .mockRejectedValueOnce(new Error('dated 28 not ready'))
      .mockResolvedValue(priorManifest);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    mockReadMeta.mockResolvedValue({
      manifest: priorManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: priorManifest.files.core.sha256,
      detailsSha: null,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().core?.run_date).toBe('2026-07-27');
    expect(useStore.getState().pendingIngestRunDate).toBe('2026-07-28');
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('adopts dated rolling day when dates-index lags a completed publish', async () => {
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    const datedManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      tag: 'app-payload-2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'dated-28-core-sha' },
      },
    };
    const datedCore = { ...remoteCore, run_date: '2026-07-28' } as CorePayload;
    const priorCore = { ...remoteCore, run_date: '2026-07-27' } as CorePayload;
    const priorManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
    };
    useStore.setState({
      source: 'remote',
      core: priorCore,
      manifest: priorManifest,
      pendingIngestRunDate: null,
    });
    mockFetchManifest
      .mockResolvedValueOnce(rollingManifest)
      .mockResolvedValueOnce(datedManifest);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    mockReadMeta.mockResolvedValue({
      manifest: priorManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: priorManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadCore.mockResolvedValue({
      text: JSON.stringify(datedCore),
      core: datedCore,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(true);
    expect(useStore.getState().core?.run_date).toBe('2026-07-28');
    expect(useStore.getState().pendingIngestRunDate).toBeNull();
    expect(useStore.getState().manifest?.files.core.sha256).toBe('dated-28-core-sha');
    expect(mockDownloadCore).toHaveBeenCalled();
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('keeps bank_history when adopting a core/details-only dated release', async () => {
    const bankHistory = {
      name: 'bank-history.json.gz',
      bytes: 100,
      sha256: 'bank-history-sha',
      url: 'https://example.com/bank-history.json.gz',
    };
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'same-core-sha' },
        bank_history: bankHistory,
        rba_calendar: {
          name: 'rba-calendar.json.gz',
          bytes: 50,
          sha256: 'rba-calendar-sha',
          url: 'https://example.com/rba-calendar.json.gz',
        },
      },
    };
    const datedCoreOnly: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      tag: 'app-payload-2026-07-28',
      files: {
        core: rollingManifest.files.core,
        details: rollingManifest.files.details,
      },
    };
    const datedCore = { ...remoteCore, run_date: '2026-07-28' } as CorePayload;
    const priorCore = { ...remoteCore, run_date: '2026-07-27' } as CorePayload;
    const priorManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
    };
    useStore.setState({
      source: 'remote',
      core: priorCore,
      manifest: priorManifest,
      pendingIngestRunDate: null,
    });
    mockFetchManifest
      .mockResolvedValueOnce(rollingManifest)
      .mockResolvedValueOnce(datedCoreOnly);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    mockReadMeta.mockResolvedValue({
      manifest: priorManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: priorManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadCore.mockResolvedValue({
      text: JSON.stringify(datedCore),
      core: datedCore,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(true);
    expect(useStore.getState().manifest?.files.bank_history).toEqual(bankHistory);
    expect(useStore.getState().manifest?.files.rba_calendar?.sha256).toBe('rba-calendar-sha');
    expect(useStore.getState().manifest?.tag).toBe('app-payload-2026-07-28');
    expect(useStore.getState().pendingIngestRunDate).toBeNull();
  });

  it('preserves installed optional assets when re-adopting the same prior dated day', async () => {
    const bankHistory = {
      name: 'bank-history.json.gz',
      bytes: 100,
      sha256: 'installed-bank-history',
      url: 'https://example.com/bank-history.json.gz',
    };
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    const priorCore = { ...remoteCore, run_date: '2026-07-27' } as CorePayload;
    const priorManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
      files: {
        ...remoteManifest.files,
        bank_history: bankHistory,
      },
    };
    const datedPriorCoreOnly: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
      tag: 'app-payload-2026-07-27',
      files: {
        core: priorManifest.files.core,
        details: priorManifest.files.details,
      },
    };
    useStore.setState({
      source: 'remote',
      core: priorCore,
      manifest: priorManifest,
      pendingIngestRunDate: null,
    });
    mockFetchManifest
      .mockResolvedValueOnce(rollingManifest)
      .mockRejectedValueOnce(new Error('dated 28 not ready'))
      .mockResolvedValueOnce(datedPriorCoreOnly);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    mockReadMeta.mockResolvedValue({
      manifest: priorManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: priorManifest.files.core.sha256,
      detailsSha: null,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().core?.run_date).toBe('2026-07-27');
    expect(useStore.getState().pendingIngestRunDate).toBe('2026-07-28');
    expect(useStore.getState().manifest?.files.bank_history).toEqual(bankHistory);
    expect(mockDownloadCore).not.toHaveBeenCalled();
  });

  it('persists enriched optional assets onto cache meta on up-to-date refresh', async () => {
    const bankHistory = {
      name: 'bank-history.json.gz',
      bytes: 100,
      sha256: 'bank-history-sha',
      url: 'https://example.com/bank-history.json.gz',
    };
    const coreSha = 'same-core-sha';
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: coreSha },
        bank_history: bankHistory,
      },
    };
    const datedCoreOnly: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      tag: 'app-payload-2026-07-28',
      files: {
        core: rollingManifest.files.core,
        details: rollingManifest.files.details,
      },
    };
    const liveCore = { ...remoteCore, run_date: '2026-07-28' } as CorePayload;
    useStore.setState({
      source: 'remote',
      core: liveCore,
      manifest: datedCoreOnly,
      pendingIngestRunDate: null,
      ensureBankInsights: mockEnsureBankInsights,
    });
    mockFetchManifest
      .mockResolvedValueOnce(rollingManifest)
      .mockResolvedValueOnce(datedCoreOnly);
    mockFetchDatesIndexJson.mockResolvedValue({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    mockReadMeta.mockResolvedValue({
      manifest: datedCoreOnly,
      source: 'remote',
      savedAt: '2026-07-28T00:00:00Z',
      coreSha,
      detailsSha: null,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().manifest?.files.bank_history).toEqual(bankHistory);
    expect(useStore.getState().refreshOutcome).toBe('success');
    expect(mockUpdateMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        coreSha,
        manifest: expect.objectContaining({
          files: expect.objectContaining({ bank_history: bankHistory }),
        }),
      }),
    );
    expect(mockEnsureBankInsights).toHaveBeenCalled();
  });

  it('holds cached day when dates-index is unavailable and rolling is newer', async () => {
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    const priorCore = { ...remoteCore, run_date: '2026-07-27' } as CorePayload;
    const priorManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-27',
    };
    useStore.setState({
      source: 'remote',
      core: priorCore,
      manifest: priorManifest,
      pendingIngestRunDate: null,
      status: 'ready',
      error: null,
    });
    mockFetchManifest.mockResolvedValueOnce(rollingManifest);
    mockFetchDatesIndexJson.mockRejectedValueOnce(new Error('dates-index 503'));
    mockReadMeta.mockResolvedValue({
      manifest: priorManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: priorManifest.files.core.sha256,
      detailsSha: null,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().core?.run_date).toBe('2026-07-27');
    expect(useStore.getState().pendingIngestRunDate).toBe('2026-07-28');
    expect(useStore.getState().status).toBe('ready');
    expect(useStore.getState().error).toBeNull();
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('surfaces an error on cold start when dates-index is unavailable', async () => {
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    useStore.setState({
      source: 'sample',
      core: null,
      manifest: null,
      pendingIngestRunDate: null,
      status: 'idle',
      error: null,
    });
    mockFetchManifest.mockResolvedValueOnce(rollingManifest);
    mockFetchDatesIndexJson.mockRejectedValueOnce(new Error('dates-index 503'));

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().core).toBeNull();
    expect(useStore.getState().error).toMatch(/cannot verify ingest finalisation/i);
    expect(useStore.getState().status).toBe('error');
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('surfaces an error on cold start when rolling ingest is not yet finalised', async () => {
    const rollingManifest: Manifest = {
      ...remoteManifest,
      run_date: '2026-07-28',
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'rolling-core-sha' },
      },
    };
    useStore.setState({
      source: 'sample',
      core: null,
      manifest: null,
      pendingIngestRunDate: null,
      status: 'idle',
      error: null,
    });
    mockFetchManifest.mockResolvedValueOnce(rollingManifest);
    mockFetchDatesIndexJson.mockResolvedValueOnce({
      schema_version: 1,
      dates: ['2026-07-27'],
      count: 1,
      min_date: '2026-07-27',
      latest_date: '2026-07-27',
    });
    // Dated rolling day + prior-day fallback both unavailable → pending null.
    mockFetchManifest
      .mockRejectedValueOnce(new Error('dated 28 missing'))
      .mockRejectedValueOnce(new Error('dated 27 missing'));

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().core).toBeNull();
    expect(useStore.getState().error).toMatch(/still uploading/i);
    expect(useStore.getState().status).toBe('error');
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('sets source remote after download and clears refreshing', async () => {
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'sample',
      savedAt: '2026-06-08T00:00:00Z',
      coreSha: 'old-hash',
      detailsSha: null,
    });
    mockDownloadCore.mockResolvedValue({
      text: JSON.stringify(remoteCore),
      core: remoteCore,
    });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(true);
    expect(mockReadDetails).not.toHaveBeenCalled();
    expect(useStore.getState().source).toBe('remote');
    expect(useStore.getState().refreshing).toBe(false);
    expect(useStore.getState().payloadProgress).toBeNull();
    expect(useStore.getState().refreshOutcome).toBe('success');
  });

  it('clears refreshing and flags offline on fetch failure', async () => {
    mockFetchManifest.mockRejectedValue(new Error('network error'));

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    const state = useStore.getState();
    expect(state.refreshing).toBe(false);
    expect(state.payloadProgress).toBeNull();
    expect(state.offline).toBe(true);
    expect(state.source).toBe('sample');
    expect(state.refreshOutcome).toBe('failure');
  });

  it('clears refreshing and flags offline on downloadCore failure', async () => {
    mockDownloadCore.mockRejectedValueOnce(new Error('download failure'));

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    const state = useStore.getState();
    expect(state.refreshing).toBe(false);
    expect(state.payloadProgress).toBeNull();
    expect(state.offline).toBe(true);
    expect(state.source).toBe('sample');
    expect(state.refreshOutcome).toBe('failure');
  });

  it('sets wifi-skip outcome when wifi-only pref blocks background refresh', async () => {
    useStore.setState({
      prefs: { ...useStore.getState().prefs, wifiOnly: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock
    const Network = require('expo-network');
    Network.getNetworkStateAsync.mockResolvedValueOnce({ type: 'CELLULAR' });

    const changed = await useStore.getState().refresh({});

    expect(changed).toBe(false);
    expect(useStore.getState().refreshOutcome).toBe('wifi-skip');
    expect(mockFetchManifest).not.toHaveBeenCalled();
  });

  it('clearRefreshOutcome resets snackbar state', () => {
    useStore.setState({ refreshOutcome: 'success' });
    useStore.getState().clearRefreshOutcome();
    expect(useStore.getState().refreshOutcome).toBeNull();
  });
});
