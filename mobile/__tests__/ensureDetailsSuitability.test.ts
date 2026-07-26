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

  it('unblocks with a core-only gate when details download fails', async () => {
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

    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(getSuitabilityIndex()?.detailsSha).toBe('');
    expect(store.getState().details).toBeNull();
    expect(store.getState().detailsLoading).toBe(false);
  });
});
