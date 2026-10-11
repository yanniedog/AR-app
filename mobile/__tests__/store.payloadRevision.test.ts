import type { CorePayload, Manifest } from '../src/types';
import { sampleCore, sampleCoreIntegrity, sampleManifest } from '../src/data/sample';
import { revisionHead, revisionManifest } from '../testUtils/payloadRevision';
import { cache } from '../src/data/cache';
import { COMPACT_HISTORY_NORMALIZATION_VERSION } from '../src/data/historyDerivation';

const mockReadBundle = jest.fn();
const mockReadMeta = jest.fn();
const mockWriteBundle = jest.fn();
const mockUpdateMeta = jest.fn(async (_meta?: unknown) => {});
const mockFetchManifest = jest.fn();
const mockDownloadCore = jest.fn();
const mockDownloadDetails = jest.fn();
const mockDownloadInflate = jest.fn();
const mockReadDetails = jest.fn();
const mockFetchDatesIndexJson = jest.fn();
const mockEnsureHistoryBanks = jest.fn(async () => {});
const mockEnsureBankInsights = jest.fn(async () => {});
const mockEnsureBankSpreadHistory = jest.fn(async () => {});
const mockEnsureRbaCalendar = jest.fn(async () => {});
const mockEnsureDetails = jest.fn(async () => {});
const mockYieldToUi = jest.fn(async () => {});
const mockOptionalMeta = jest.fn();
const mockWriteOptionalMeta = jest.fn();
const mockOptionalDownload = jest.fn();

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
    writeSearchIndex: jest.fn(async () => {}),
    writeHistoryBanks: jest.fn(async () => {}),
    writeBankInsights: jest.fn(async () => {}),
    readOptionalMeta: (...args: unknown[]) => mockOptionalMeta(...args),
    writeOptionalMeta: (...args: unknown[]) => mockWriteOptionalMeta(...args),
    readHistoryBanks: jest.fn(async () => null),
    readBankInsights: jest.fn(async () => null),
    readSearchIndex: jest.fn(async () => null),
    updateMeta: (meta: unknown) => mockUpdateMeta(meta),
    readSuitabilityIndex: jest.fn(async () => null),
    writeSuitabilityIndex: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  },
}));

jest.mock('../src/data/payload', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
  downloadCore: (...args: unknown[]) => mockDownloadCore(...args),
  downloadDetails: (...args: unknown[]) => mockDownloadDetails(...args),
  downloadInflate: (...args: unknown[]) => mockDownloadInflate(...args),
  downloadHistoryBanks: (...args: unknown[]) => mockOptionalDownload(...args),
  downloadBankInsights: (...args: unknown[]) => mockOptionalDownload(...args),
  downloadSearchIndex: (...args: unknown[]) => mockOptionalDownload(...args),
  BANK_SPREAD_MAX_COMPRESSED_BYTES: 8 * 1024 * 1024,
  BANK_SPREAD_MAX_INFLATED_BYTES: 64 * 1024 * 1024,
}));
jest.mock('../src/data/storeBankRateHistory', () => ({ prepareBankRateHistoryAfterPaint: jest.fn(async () => {}),
  waitForBankRateHistoryPreparation: jest.fn(async () => {}) }));

jest.mock('../src/data/historyDaily', () => {
  const actual = jest.requireActual('../src/data/historyDaily') as object;
  return {
    ...actual,
    fetchDatesIndexJson: (...args: unknown[]) => mockFetchDatesIndexJson(...args),
  };
});

jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: () => mockYieldToUi(),
  yieldToPaintFrames: async () => {},
  parseJsonHeavy: async (text: string) => JSON.parse(text),
}));

// eslint-disable-next-line import/first -- store import must follow jest mocks
import { useStore } from '../src/data/store';

const originalEnsureHistoryBanks = useStore.getState().ensureHistoryBanks;
const originalEnsureBankInsights = useStore.getState().ensureBankInsights;
const originalEnsureBankSpreadHistory = useStore.getState().ensureBankSpreadHistory;
const originalEnsureRbaCalendar = useStore.getState().ensureRbaCalendar;
const originalEnsureDetails = useStore.getState().ensureDetails;
const originalEnsureSearchIndex = useStore.getState().ensureSearchIndex;
const originalPrefs = useStore.getState().prefs;

const remoteManifest: Manifest = sampleManifest;
const remoteCore: CorePayload = sampleCore;

function resetStore() {
  useStore.setState({
    status: 'ready',
    refreshing: false,
    source: 'sample',
    manifest: remoteManifest,
    core: remoteCore,
    coreIntegrity: sampleCoreIntegrity,
    coreAssetState: { status: 'sample', data: sampleCoreIntegrity },
    details: null,
    detailsLoading: false,
    error: null,
    offline: false,
    lastCheckedAt: null,
    payloadProgress: null,
    refreshOutcome: null,
    pendingIngestRunDate: null,
    hydrated: true,
    prefs: {
      ...originalPrefs,
      profileFilters: { ...originalPrefs.profileFilters },
    },
    favorites: [],
    ensureHistoryBanks: originalEnsureHistoryBanks,
    ensureBankInsights: originalEnsureBankInsights,
    ensureBankSpreadHistory: originalEnsureBankSpreadHistory,
    ensureRbaCalendar: originalEnsureRbaCalendar,
    ensureDetails: originalEnsureDetails,
    ensureSearchIndex: originalEnsureSearchIndex,
    bankSpreadHistory: null,
    bankSpreadHistoryError: null,
    searchIndex: null,
    searchIndexStatus: 'idle',
    searchIndexError: null,
  });
}

describe('selected immutable payload refresh', () => {
  const installed = revisionManifest(1);
  const next = revisionManifest(2, { files: { ...sampleManifest.files,
    details: { ...sampleManifest.files.details, sha256: 'c'.repeat(64) } } });
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    useStore.setState({ manifest: installed, source: 'remote',
      ensureDetails: mockEnsureDetails, ensureHistoryBanks: mockEnsureHistoryBanks,
      ensureBankInsights: mockEnsureBankInsights, ensureBankSpreadHistory: mockEnsureBankSpreadHistory,
      ensureRbaCalendar: mockEnsureRbaCalendar });
    mockReadMeta.mockResolvedValue({ manifest: installed, source: 'remote',
      coreSha: installed.files.core.sha256, detailsSha: installed.files.details.sha256 });
    mockFetchDatesIndexJson.mockResolvedValue({ dates: [next.run_date], latest_date: next.run_date,
      revision_protocol: 1, revision_heads: { [next.run_date]: revisionHead(next) } });
    mockFetchManifest.mockImplementation(async (url?: string) => url ? next : installed);
    mockDownloadCore.mockResolvedValue({ core: sampleCore, text: JSON.stringify(sampleCore), integrity: sampleCoreIntegrity });
    mockDownloadDetails.mockResolvedValue({ details: { schema_version: 1, run_date: next.run_date, products: {} }, text: '{}' });
    mockDownloadInflate.mockResolvedValue('{}');
    mockWriteBundle.mockResolvedValue(undefined);
    mockOptionalMeta.mockResolvedValue(null);
    mockWriteOptionalMeta.mockImplementation(async (value, isCurrent) => { if (isCurrent()) mockOptionalMeta.mockResolvedValue(value); });
  });

  it('adopts a details-only same-day correction despite an unchanged core hash', async () => {
    expect(await useStore.getState().refresh({ manual: true })).toBe(true);
    expect(mockDownloadDetails).toHaveBeenCalledWith(next.files.details.url, next.files.details.sha256, expect.objectContaining({ requireExactBytes: true }));
    expect(mockWriteBundle).toHaveBeenCalledWith(expect.objectContaining({ manifest: next, detailsSha: next.files.details.sha256 }), expect.any(String));
    expect(useStore.getState().manifest).toEqual(next);
  });

  it('drops old live details when another refresh already committed the newer cache edition', async () => {
    useStore.setState({ details: { schema_version: 1, run_date: installed.run_date, products: {} } });
    mockReadMeta.mockResolvedValue({ manifest: next, source: 'remote', coreSha: next.files.core.sha256,
      detailsSha: next.files.details.sha256 });
    mockReadBundle.mockResolvedValue({ meta: { manifest: next }, core: sampleCore, integrity: sampleCoreIntegrity });
    expect(await useStore.getState().refresh({ manual: true })).toBe(false);
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(useStore.getState().manifest).toEqual(next);
    expect(useStore.getState().details).toBeNull();
  });

  it('keeps the installed edition if a selected asset fails hash verification', async () => {
    mockDownloadDetails.mockRejectedValueOnce(new Error('asset sha256 mismatch'));
    expect(await useStore.getState().refresh({ manual: true })).toBe(false);
    expect(mockWriteBundle).not.toHaveBeenCalled();
    expect(useStore.getState().manifest).toEqual(installed);
    expect(useStore.getState().refreshOutcome).toBe('failure');
  });

  it('preserves an unchanged verified optional asset on a details-only correction', async () => {
    const historyFile = { name: 'history-banks.json.gz', bytes: 100, sha256: 'd'.repeat(64), url: '' };
    const oldWithHistory = revisionManifest(1, { files: { ...installed.files, history_banks: historyFile } });
    const nextWithHistory = revisionManifest(2, { files: { ...next.files, history_banks: historyFile } });
    const history = { schema_version: 1, run_date: installed.run_date, run_dates: [installed.run_date],
      sections: { Mortgage: { points: [{ date: installed.run_date, min: .05, max: .06, mean: .055, median: .055, count: 2 }] } } };
    useStore.setState({ manifest: oldWithHistory, historyBanks: history });
    mockFetchManifest.mockImplementation(async (url?: string) => url ? nextWithHistory : oldWithHistory);
    mockFetchDatesIndexJson.mockResolvedValue({ dates: [next.run_date], latest_date: next.run_date,
      revision_protocol: 1, revision_heads: { [next.run_date]: revisionHead(nextWithHistory) } });
    mockReadMeta.mockResolvedValue({ manifest: oldWithHistory, source: 'remote',
      coreSha: installed.files.core.sha256, detailsSha: installed.files.details.sha256 });
    mockDownloadInflate.mockResolvedValue(JSON.stringify(history));
    expect(await useStore.getState().refresh({ manual: true })).toBe(true);
    expect(useStore.getState().historyBanks).toEqual({ ...history, normalization_version: COMPACT_HISTORY_NORMALIZATION_VERSION });
    expect(mockEnsureHistoryBanks).not.toHaveBeenCalled();
  });

  it('refuses a hash-verified optional asset with the wrong publication date', async () => {
    const withHistory = revisionManifest(2, { files: { ...next.files, history_banks: {
      name: 'history-banks.json.gz', bytes: 100, sha256: 'd'.repeat(64), url: '',
    } } });
    mockFetchManifest.mockResolvedValue(withHistory);
    mockDownloadInflate.mockResolvedValue(JSON.stringify({ run_date: '2020-01-01' }));
    expect(await useStore.getState().refresh({ manual: true })).toBe(false);
    expect(mockWriteBundle).not.toHaveBeenCalled();
    expect(useStore.getState().manifest).toEqual(installed);
  });

  function withPreparedOptionals() {
    const files = Object.fromEntries(['history_banks', 'bank_history', 'search_index'].map((key, n) => [key,
      { name: `${key}.json.gz`, bytes: 100, sha256: String(n + 4).repeat(64), url: '' }]));
    const manifest = revisionManifest(2, { files: { ...next.files, ...files } });
    const day = manifest.run_date;
    const assets = {
      history_banks: { schema_version: 1, run_date: day, run_dates: [day], sections: {
        Mortgage: { points: [{ date: day, min: .05, max: .06, mean: .055, median: .055, count: 2 }] } } },
      bank_history: { schema_version: 1, run_date: day, run_dates: [day], banks: {
        Example: { Mortgage: { median: [.055], best: [.05], count: [2] } } }, events: [] },
      search_index: { schema_version: 1, run_date: day, products: { example: 'mortgage' } },
    };
    mockFetchManifest.mockResolvedValue(manifest);
    mockFetchDatesIndexJson.mockResolvedValue({ dates: [day], latest_date: day,
      revision_protocol: 1, revision_heads: { [day]: revisionHead(manifest) } });
    mockDownloadInflate.mockImplementation(async url => JSON.stringify(Object.entries(assets)
      .find(([key]) => (manifest.files as Record<string, { url: string }>)[key].url === url)![1]));
    return { manifest, assets };
  }

  it('reuses every staged summary/search object in real post-refresh ensures without another download', async () => {
    const { manifest } = withPreparedOptionals();
    useStore.setState({ prefs: { ...originalPrefs, enableDeepSearch: true, showHistoryRibbon: true },
      ensureHistoryBanks: originalEnsureHistoryBanks, ensureBankInsights: originalEnsureBankInsights });
    mockWriteOptionalMeta.mockImplementation(async (value, isCurrent) => {
      expect(mockWriteBundle).toHaveBeenCalledTimes(1);
      expect(useStore.getState().manifest).toBe(installed);
      expect(isCurrent()).toBe(true);
      mockOptionalMeta.mockResolvedValue(value);
    });
    expect(await useStore.getState().refresh({ manual: true })).toBe(true);
    expect(mockDownloadInflate).toHaveBeenCalledTimes(3);
    expect(mockOptionalDownload).not.toHaveBeenCalled();
    expect(cache.readHistoryBanks).not.toHaveBeenCalled();
    expect(cache.readSearchIndex).not.toHaveBeenCalled();
    expect(useStore.getState().searchIndexStatus).toBe('ready');
    expect(mockWriteOptionalMeta).toHaveBeenCalledWith({ coreSha: manifest.files.core.sha256,
      historyBanksSha: manifest.files.history_banks!.sha256, bankInsightsSha: manifest.files.bank_history!.sha256,
      searchIndexSha: manifest.files.search_index!.sha256 }, expect.any(Function));
  });

  it.each(['semantic', 'hash', 'cache-write', 'superseded'] as const)(
    'does not publish staged optional bindings on %s failure', async failure => {
      withPreparedOptionals();
      if (failure === 'semantic') mockDownloadInflate.mockResolvedValue(JSON.stringify({ run_date: next.run_date }));
      if (failure === 'hash') mockDownloadInflate.mockRejectedValue(new Error('asset sha256 mismatch'));
      if (failure === 'cache-write') mockWriteBundle.mockRejectedValue(new Error('disk failure'));
      const successor = revisionManifest(3);
      if (failure === 'superseded') mockWriteBundle.mockImplementation(async () => { useStore.setState({ manifest: successor }); });
      expect(await useStore.getState().refresh({ manual: true })).toBe(false);
      expect(mockWriteOptionalMeta).not.toHaveBeenCalled();
      expect(useStore.getState().manifest).toBe(failure === 'superseded' ? successor : installed);
      expect(useStore.getState().searchIndex).toBeNull();
    },
  );

  it('rejects rollback before downloading replacement assets', async () => {
    useStore.setState({ manifest: next });
    mockFetchManifest.mockResolvedValue(installed);
    mockFetchDatesIndexJson.mockResolvedValue({ dates: [installed.run_date], latest_date: installed.run_date,
      revision_protocol: 1, revision_heads: { [installed.run_date]: revisionHead(installed) } });
    expect(await useStore.getState().refresh({ manual: true })).toBe(false);
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(mockWriteBundle).not.toHaveBeenCalled();
    expect(useStore.getState().manifest).toEqual(next);
  });
});
