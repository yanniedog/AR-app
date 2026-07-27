// @ts-nocheck — Jest mock factories use hoisted fns with loose call signatures.
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import { sampleCore, sampleDetails, sampleManifest } from '../src/data/sample';
import { DEFAULT_PREFS } from '../src/data/store';
import {
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  getSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import { isSuitabilityFilterReady } from '../src/data/suitabilityGate';

const mockReadMeta = jest.fn();
const mockReadDetails = jest.fn();
const mockWriteDetails = jest.fn(async () => {});
const mockUpdateMeta = jest.fn(async () => {});
const mockDownloadDetails = jest.fn();
const mockWriteSuitabilityIndex = jest.fn(async () => {});
const mockReadSuitabilityIndex = jest.fn(async () => null);

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/data/cache', () => ({
  cache: {
    readMeta: (...args: unknown[]) => mockReadMeta(...args),
    readOptionalMeta: (...args: unknown[]) => mockReadMeta(...args),
    writeOptionalMeta: jest.fn(async () => {}),
    readDetails: (...args: unknown[]) => mockReadDetails(...args),
    writeDetails: (...args: unknown[]) => mockWriteDetails(...args),
    updateMeta: (...args: unknown[]) => mockUpdateMeta(...args),
    readSuitabilityIndex: (...args: unknown[]) => mockReadSuitabilityIndex(...args),
    writeSuitabilityIndex: (...args: unknown[]) => mockWriteSuitabilityIndex(...args),
    readBundle: jest.fn(async () => null),
    writeBundle: jest.fn(async () => {}),
    readSearchIndex: jest.fn(async () => null),
    writeSearchIndex: jest.fn(async () => {}),
    readHistoryBanks: jest.fn(async () => null),
    writeHistoryBanks: jest.fn(async () => {}),
    clearHistoryBanks: jest.fn(async () => {}),
    readBankInsights: jest.fn(async () => null),
    writeBankInsights: jest.fn(async () => {}),
    clearBankInsights: jest.fn(async () => {}),
    readProductHistory: jest.fn(async () => null),
    writeProductHistory: jest.fn(async () => {}),
    clearProductHistory: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  },
}));

jest.mock('../src/data/payload', () => ({
  fetchManifest: jest.fn(),
  downloadCore: jest.fn(),
  downloadDetails: (...args: unknown[]) => mockDownloadDetails(...args),
  downloadSearchIndex: jest.fn(),
  downloadHistoryBanks: jest.fn(),
  downloadBankInsights: jest.fn(),
}));

// eslint-disable-next-line import/first -- store import must follow jest mocks
import { useStore as store } from '../src/data/store';

const remoteManifest: Manifest = {
  ...sampleManifest,
  files: {
    ...sampleManifest.files,
    details: {
      ...sampleManifest.files.details,
      sha256: 'details-sha-live',
    },
    core: {
      ...sampleManifest.files.core,
      sha256: 'core-sha-live',
    },
  },
};
const remoteCore = {
  ...sampleCore,
  run_date: sampleDetails.run_date,
} as CorePayload;
const remoteDetails = sampleDetails as DetailsPayload;

function resetStore() {
  clearSuitabilityIndex();
  store.setState({
    status: 'ready',
    refreshing: false,
    source: 'remote',
    manifest: remoteManifest,
    core: remoteCore,
    details: null,
    searchIndex: null,
    historyBanks: null,
    historyBanksError: null,
    bankInsights: null,
    bankInsightsError: null,
    productHistory: null,
    productHistoryError: null,
    detailsLoading: false,
    error: null,
    offline: false,
    lastCheckedAt: null,
    payloadProgress: null,
    hydrated: true,
    prefs: { ...DEFAULT_PREFS },
    favorites: [],
    subscriptions: [],
  });
}

describe('ensureDetails suitability unblock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  afterEach(() => {
    clearSuitabilityIndex();
  });

  it('opens the fail-closed gate after a forced details warm', async () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(false)).toBe(false);

    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockResolvedValue({
      text: JSON.stringify(remoteDetails),
      details: remoteDetails,
    });

    await store.getState().ensureDetails({ force: true });

    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(getSuitabilityIndex()?.runDate).toBe(remoteCore.run_date);
    expect(store.getState().detailsLoading).toBe(false);
    expect(store.getState().details?.run_date).toBe(remoteCore.run_date);
  });

  it('lets a second caller await the in-flight load instead of no-oping', async () => {
    closeSuitabilityGateUntilRebuild();
    let finishDownload!: (value: unknown) => void;
    const download = new Promise((resolve) => {
      finishDownload = resolve;
    });
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockReturnValueOnce(download);

    const first = store.getState().ensureDetails({ force: true });
    const second = store.getState().ensureDetails({ force: true });
    finishDownload({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    await Promise.all([first, second]);

    expect(mockDownloadDetails).toHaveBeenCalledTimes(1);
    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(store.getState().detailsLoading).toBe(false);
  });

  it('leaves the suitability gate closed when details download fails', async () => {
    closeSuitabilityGateUntilRebuild();
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockRejectedValueOnce(new Error('network error'));

    await store.getState().ensureDetails({ force: true });

    expect(isSuitabilityFilterReady(false)).toBe(false);
    expect(store.getState().details).toBeNull();
    expect(store.getState().detailsLoading).toBe(false);
  });

  it('re-ensures after the in-flight slot clears when the dataset moved on', async () => {
    closeSuitabilityGateUntilRebuild();
    let finishFirst!: (value: unknown) => void;
    let finishSecond!: (value: unknown) => void;
    const firstDownload = new Promise((resolve) => {
      finishFirst = resolve;
    });
    const secondDownload = new Promise((resolve) => {
      finishSecond = resolve;
    });
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockReturnValueOnce(firstDownload).mockReturnValueOnce(secondDownload);

    const first = store.getState().ensureDetails({ force: true });
    const nextManifest: Manifest = {
      ...remoteManifest,
      files: {
        ...remoteManifest.files,
        core: { ...remoteManifest.files.core, sha256: 'core-sha-next' },
        details: { ...remoteManifest.files.details, sha256: 'details-sha-next' },
      },
    };
    const nextCore = { ...remoteCore, run_date: '2099-01-02' } as CorePayload;
    const nextDetails = { ...remoteDetails, run_date: '2099-01-02' } as DetailsPayload;
    store.setState({
      manifest: nextManifest,
      core: nextCore,
    });
    finishFirst({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    await first;
    for (let i = 0; i < 40 && mockDownloadDetails.mock.calls.length < 2; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(mockDownloadDetails).toHaveBeenCalledTimes(2);
    finishSecond({ text: JSON.stringify(nextDetails), details: nextDetails });
    for (let i = 0; i < 40 && store.getState().detailsLoading; i += 1) {
      await new Promise((r) => setImmediate(r));
    }

    expect(store.getState().details).toEqual(nextDetails);
    expect(store.getState().detailsLoading).toBe(false);
  });

  it('abandonInFlight starts a fresh ensure instead of joining a hung load', async () => {
    closeSuitabilityGateUntilRebuild();
    const downloads: Array<{ finish: (value: unknown) => void }> = [];
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockImplementation(() => {
      let finish!: (value: unknown) => void;
      const p = new Promise((resolve) => {
        finish = resolve;
      });
      downloads.push({ finish });
      return p;
    });

    void store.getState().ensureDetails({ force: true });
    for (let i = 0; i < 20 && downloads.length < 1; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(downloads.length).toBe(1);

    const abandoned = store.getState().ensureDetails({ force: true, abandonInFlight: true });
    for (let i = 0; i < 20 && downloads.length < 2; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(downloads.length).toBe(2);
    downloads[1].finish({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    await abandoned;

    expect(store.getState().details).toEqual(remoteDetails);
    expect(store.getState().detailsLoading).toBe(false);
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });
});
