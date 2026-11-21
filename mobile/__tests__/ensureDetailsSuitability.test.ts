// @ts-nocheck — Jest mock factories use hoisted fns with loose call signatures.
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import { loadSampleDetails, sampleCore, sampleManifest } from '../src/data/sample';
import { DEFAULT_PREFS } from '../src/data/store';
import {
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  getSuitabilityIndex,
  rebuildAndInstallSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import { isSuitabilityFilterReady, subscribeSuitabilityGate } from '../src/data/suitabilityGate';
import { expectFirstValue, markFirstValue, resetFirstValueForTests } from '../src/lib/firstValue';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { backgroundPayloadWork } from '../src/lib/backgroundPayloadWork';

const sampleDetails = loadSampleDetails();

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

  it('opens the gate before the details cache write finishes', async () => {
    closeSuitabilityGateUntilRebuild();
    mockReadMeta.mockResolvedValue({
      manifest: remoteManifest,
      source: 'remote',
      savedAt: '2026-07-27T00:00:00Z',
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: null,
    });
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    let finishWrite!: () => void;
    let gateOpenAtWrite: boolean | null = null;
    let writeStarted!: () => void;
    const started = new Promise<void>((resolve) => { writeStarted = resolve; });
    mockWriteDetails.mockImplementationOnce(() => new Promise<void>((resolve) => {
      gateOpenAtWrite = isSuitabilityFilterReady(false);
      finishWrite = resolve;
      writeStarted();
    }));

    const load = store.getState().ensureDetails({ force: true });
    await started;
    expect(gateOpenAtWrite).toBe(true);
    expect(mockUpdateMeta).not.toHaveBeenCalled();
    finishWrite();
    await load;
    expect(mockUpdateMeta).toHaveBeenCalledTimes(1);
    expect(store.getState().detailsLoading).toBe(false);
  });

  const mockRemoteMeta = () => mockReadMeta.mockResolvedValue({
    manifest: remoteManifest,
    source: 'remote',
    savedAt: '2026-07-27T00:00:00Z',
    coreSha: remoteManifest.files.core.sha256,
    detailsSha: null,
  });

  it('publishes details to the store in the same tick the gate opens, not before', async () => {
    closeSuitabilityGateUntilRebuild();
    mockRemoteMeta();
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    const events: string[] = [];
    let afterDetails = false;
    const unsubscribeStore = store.subscribe((state) => {
      if (state.details && !afterDetails) {
        afterDetails = true;
        events.push('details');
        // A microtask checkpoint stands for any await between the two publications.
        queueMicrotask(() => events.push('microtask'));
      }
    });
    const unsubscribeGate = subscribeSuitabilityGate(() => {
      if (isSuitabilityFilterReady(false)) events.push('gate');
    });
    try {
      await store.getState().ensureDetails({ force: true });
    } finally {
      unsubscribeStore();
      unsubscribeGate();
    }
    expect(events.slice(0, 3)).toEqual(['details', 'gate', 'microtask']);
    expect(store.getState().details?.run_date).toBe(remoteDetails.run_date);
  });

  it('still publishes details when the index is already installed for this publication', async () => {
    mockRemoteMeta();
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    await rebuildAndInstallSuitabilityIndex(
      remoteCore, remoteDetails, remoteManifest.files.details.sha256, () => true, remoteManifest.files.core.sha256,
    );
    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(store.getState().details).toBeNull();
    await store.getState().ensureDetails({ force: true });
    expect(store.getState().details?.run_date).toBe(remoteDetails.run_date);
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });

  it('publishes details but keeps the gate closed when the index build fails', async () => {
    closeSuitabilityGateUntilRebuild();
    mockRemoteMeta();
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    const poisoned = { get product_key() { throw new Error('poisoned row'); } };
    const section = Object.keys(remoteCore.sections)[0];
    store.setState({ core: { ...remoteCore, sections: { ...remoteCore.sections, [section]: { ...remoteCore.sections[section], rates: [poisoned] } } } });
    await store.getState().ensureDetails({ force: true });
    expect(store.getState().details?.run_date).toBe(remoteDetails.run_date);
    expect(isSuitabilityFilterReady(false)).toBe(false);
    expect(mockUpdateMeta).not.toHaveBeenCalled();
  });

  it('completes without waiting and saves the details cache after the first value when launch armed the wait', async () => {
    closeSuitabilityGateUntilRebuild();
    mockRemoteMeta();
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    expectFirstValue();
    try {
      await store.getState().ensureDetails({ force: true });
      expect(isSuitabilityFilterReady(false)).toBe(true);
      expect(store.getState().detailsLoading).toBe(false);
      expect(mockWriteDetails).not.toHaveBeenCalled();
      markFirstValue();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(mockWriteDetails).toHaveBeenCalledTimes(1);
      expect(mockUpdateMeta).toHaveBeenCalledTimes(1);
    } finally {
      resetFirstValueForTests();
    }
  });

  it('reuses the verified in-memory details for a second ensure while the save is deferred', async () => {
    closeSuitabilityGateUntilRebuild();
    const sha = 'a'.repeat(64);
    const manifest = { ...remoteManifest, files: { ...remoteManifest.files, details: { ...remoteManifest.files.details, sha256: sha } } };
    store.setState({ manifest });
    mockReadMeta.mockResolvedValue({ manifest, source: 'remote', savedAt: '2026-07-27T00:00:00Z', coreSha: manifest.files.core.sha256, detailsSha: null });
    const verified = bindVerifiedDetails({ ...remoteDetails }, sha);
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: verified });
    expectFirstValue();
    try {
      await store.getState().ensureDetails({ force: true });
      expect(mockDownloadDetails).toHaveBeenCalledTimes(1);
      await store.getState().ensureDetails({ force: true });
      expect(mockDownloadDetails).toHaveBeenCalledTimes(1);
      markFirstValue();
      await new Promise((resolve) => setTimeout(resolve, 30));
    } finally {
      resetFirstValueForTests();
    }
  });

  it('skips the deferred save when the dataset moved on before the first value', async () => {
    closeSuitabilityGateUntilRebuild();
    mockRemoteMeta();
    mockDownloadDetails.mockResolvedValue({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    expectFirstValue();
    try {
      await store.getState().ensureDetails({ force: true });
      store.setState({ manifest: { ...remoteManifest, files: { ...remoteManifest.files, details: { ...remoteManifest.files.details, sha256: 'newer' } } } });
      markFirstValue();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(mockWriteDetails).not.toHaveBeenCalled();
    } finally {
      resetFirstValueForTests();
    }
  });

  it('keeps the gate closed without trusted details instead of loading bundled data', async () => {
    store.setState({
      source: 'sample',
      manifest: sampleManifest,
      core: sampleCore,
      details: null,
    });
    closeSuitabilityGateUntilRebuild();
    mockReadMeta.mockResolvedValue(null);
    mockReadDetails.mockResolvedValue(null);

    await store.getState().ensureDetails({ force: true });

    expect(isSuitabilityFilterReady(false)).toBe(false);
    expect(store.getState().details).toBeNull();
    expect(backgroundPayloadWork.snapshot().reverse().find(job => job.label === 'Product details and suitability index')?.outcome).toBe('unavailable');
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

  it('reports completed when trusted live details recover after a metadata read failure', async () => {
    closeSuitabilityGateUntilRebuild();
    store.setState({ details: remoteDetails });
    mockReadMeta.mockRejectedValueOnce(new Error('temporary metadata failure')).mockResolvedValue({
      coreSha: remoteManifest.files.core.sha256,
      detailsSha: remoteManifest.files.details.sha256,
    });
    await store.getState().ensureDetails({ force: true });
    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(backgroundPayloadWork.snapshot().reverse().find(job => job.label === 'Product details and suitability index')?.outcome).toBe('completed');
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
    for (let i = 0; i < 80 && mockDownloadDetails.mock.calls.length < 2; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(mockDownloadDetails).toHaveBeenCalledTimes(2);
    finishSecond({ text: JSON.stringify(nextDetails), details: nextDetails });
    for (let i = 0; i < 80 && store.getState().detailsLoading; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }

    expect(store.getState().details).toEqual(nextDetails);
    expect(store.getState().detailsLoading).toBe(false);
  });

  it('abandonInFlight starts a fresh ensure instead of joining a hung load', async () => {
    closeSuitabilityGateUntilRebuild();
    const downloads: { finish: (value: unknown) => void }[] = [];
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
    expect(backgroundPayloadWork.snapshot().filter(job => job.label === 'Product details and suitability index' && job.outcome === null)).toEqual([]);
  });

  it('records details-only manifest supersession separately from the replacement load', async () => {
    mockReadMeta.mockResolvedValue({ detailsSha: null });
    mockReadDetails.mockResolvedValue(null);
    let finishFirst!: (value: unknown) => void;
    const download = new Promise(resolve => { finishFirst = resolve; });
    mockDownloadDetails.mockReturnValueOnce(download).mockResolvedValueOnce({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    const first = store.getState().ensureDetails({ force: true });
    for (let i = 0; i < 80 && mockDownloadDetails.mock.calls.length < 1; i++) await new Promise(resolve => setImmediate(resolve));
    const job = backgroundPayloadWork.snapshot().reverse().find(job => job.label === 'Product details and suitability index')!;
    store.setState({ manifest: { ...remoteManifest, files: { ...remoteManifest.files,
      details: { ...remoteManifest.files.details, sha256: 'details-sha-replacement' } } } });
    finishFirst({ text: JSON.stringify(remoteDetails), details: remoteDetails });
    await first;
    expect(backgroundPayloadWork.snapshot().find(entry => entry.id === job.id)?.outcome).toBe('superseded');
    await store.getState().ensureDetails({ force: true });
    expect(mockDownloadDetails).toHaveBeenCalledTimes(2);
  });
});
