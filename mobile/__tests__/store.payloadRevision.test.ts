import type { CorePayload, Manifest } from '../src/types';
import { sampleCore, sampleCoreIntegrity, sampleManifest } from '../src/data/sample';
import { revisionHead, revisionManifest } from '../testUtils/payloadRevision';

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
}));

jest.mock('../src/data/historyDaily', () => {
  const actual = jest.requireActual('../src/data/historyDaily') as object;
  return {
    ...actual,
    fetchDatesIndexJson: (...args: unknown[]) => mockFetchDatesIndexJson(...args),
  };
});

jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: () => mockYieldToUi(),
  parseJsonHeavy: async (text: string) => JSON.parse(text),
}));

// eslint-disable-next-line import/first -- store import must follow jest mocks
import { useStore } from '../src/data/store';

const originalEnsureHistoryBanks = useStore.getState().ensureHistoryBanks;
const originalEnsureBankInsights = useStore.getState().ensureBankInsights;
const originalEnsureBankSpreadHistory = useStore.getState().ensureBankSpreadHistory;
const originalEnsureRbaCalendar = useStore.getState().ensureRbaCalendar;
const originalEnsureDetails = useStore.getState().ensureDetails;
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
    const history = { schema_version: 1, run_date: installed.run_date, run_dates: [installed.run_date], sections: {} };
    useStore.setState({ manifest: oldWithHistory, historyBanks: history });
    mockFetchManifest.mockImplementation(async (url?: string) => url ? nextWithHistory : oldWithHistory);
    mockFetchDatesIndexJson.mockResolvedValue({ dates: [next.run_date], latest_date: next.run_date,
      revision_protocol: 1, revision_heads: { [next.run_date]: revisionHead(nextWithHistory) } });
    mockReadMeta.mockResolvedValue({ manifest: oldWithHistory, source: 'remote',
      coreSha: installed.files.core.sha256, detailsSha: installed.files.details.sha256 });
    mockDownloadInflate.mockResolvedValue(JSON.stringify(history));
    expect(await useStore.getState().refresh({ manual: true })).toBe(true);
    expect(useStore.getState().historyBanks).toEqual(history);
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
