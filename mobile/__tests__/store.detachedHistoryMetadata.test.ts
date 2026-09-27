import * as FileSystem from 'expo-file-system/legacy';
import type { Manifest } from '../src/types';
import { sampleCore, sampleCoreIntegrity, sampleManifest } from '../src/data/sample';
import { cache } from '../src/data/cache';
import { validateDetachedHistoricalCatalogueDescriptor } from '../src/data/detachedHistoricalBankRateCatalogueWire';
import { samePayloadIdentity } from '../src/data/payloadRevision';
import { prepareBankRateHistoryAfterPaint } from '../src/data/storeBankRateHistory';

const mockFetchManifest = jest.fn();
const mockDownloadCore = jest.fn();
const mockFetchDatesIndexJson = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/data/payload', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
  downloadCore: (...args: unknown[]) => mockDownloadCore(...args),
  downloadDetails: jest.fn(),
}));
jest.mock('../src/data/historyDaily', () => ({
  ...jest.requireActual('../src/data/historyDaily'),
  fetchDatesIndexJson: (...args: unknown[]) => mockFetchDatesIndexJson(...args),
}));
jest.mock('../src/data/storeBankRateHistory', () => ({
  prepareBankRateHistoryAfterPaint: jest.fn(async () => {}),
  waitForBankRateHistoryPreparation: jest.fn(async () => {}),
}));
jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: async () => {},
  parseJsonHeavy: async (text: string) => JSON.parse(text),
}));

// eslint-disable-next-line import/first -- store import follows its transport mocks
import { useStore } from '../src/data/store';

const initialState = useStore.getState();
const files = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  files.clear();
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(async path =>
    files.has(path) || path.endsWith('payload/')
      ? { exists: true as const, isDirectory: path.endsWith('payload/'),
        uri: path, size: files.get(path)?.length ?? 0, modificationTime: 0 }
      : { exists: false as const, isDirectory: false, uri: path });
  jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async path => {
    const value = files.get(path);
    if (value === undefined) throw new Error(`missing ${path}`);
    return value;
  });
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (path, contents) => { files.set(path, contents); });
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async path => { files.delete(path); });
  jest.mocked(FileSystem.moveAsync).mockImplementation(async ({ from, to }) => {
    const contents = files.get(from);
    if (contents === undefined) throw new Error(`missing ${from}`);
    files.set(to, contents);
    files.delete(from);
  });
  jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue();
  jest.mocked(FileSystem.readDirectoryAsync).mockImplementation(async path =>
    [...files.keys()].filter(file => file.startsWith(path)).map(file => file.slice(path.length)));
  useStore.setState({ ...initialState,
    prefs: { ...initialState.prefs, enableDeepSearch: false, showHistoryRibbon: false },
    ensureDetails: jest.fn(async () => {}), ensureRbaCalendar: jest.fn(async () => {}),
    ensureHistoryBanks: jest.fn(async () => {}), ensureBankInsights: jest.fn(async () => {}),
    ensureBankSpreadHistory: jest.fn(async () => {}),
  }, true);
});

it.each(['bytes', 'schema', 'encryption'] as const)(
  'persists a same-SHA detached %s correction for an offline cold restart without replacing core', async correction => {
    const day = sampleCore.run_date;
    const hash = 'a'.repeat(64);
    const name = `bank-rate-history-catalogue-${day}-${hash.slice(0, 12)}.json.gz`;
    const namespace = { schema_version: 1 as const, file: { name, bytes: 2200000, sha256: hash,
      url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/${name}` } };
    const corrected: Manifest = { ...sampleManifest, tag: 'app-payload-latest',
      files: { core: sampleManifest.files.core, details: sampleManifest.files.details },
      bank_rate_history_catalogue: namespace };
    const stale: Manifest = JSON.parse(JSON.stringify(corrected));
    // Transport parsing accepts optional capability metadata; the loader fails
    // closed on these old descriptors while usable core data remains available.
    if (correction === 'bytes') stale.bank_rate_history_catalogue!.file.bytes = 9 * 1024 * 1024;
    if (correction === 'schema') Object.assign(stale.bank_rate_history_catalogue!, { schema_version: 2 });
    if (correction === 'encryption') stale.bank_rate_history_catalogue!.file.enc = { alg: 'aes-256-gcm', key_id: 'abcdef12' };
    expect(validateDetachedHistoricalCatalogueDescriptor(stale)).toBeNull();
    expect(validateDetachedHistoricalCatalogueDescriptor(corrected)).toEqual(namespace.file);
    expect(samePayloadIdentity(stale, corrected)).toBe(true);
    await cache.writeBundle({ manifest: stale, source: 'remote', savedAt: stale.generated_at,
      coreSha: stale.files.core.sha256, detailsSha: null }, JSON.stringify(sampleCore));
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const originalBundle = files.get(bundlePath);
    useStore.setState({ core: sampleCore, coreIntegrity: sampleCoreIntegrity, manifest: stale,
      source: 'remote', status: 'ready' });
    mockFetchManifest.mockResolvedValue(corrected);
    mockFetchDatesIndexJson.mockResolvedValue({ schema_version: 1, dates: [day], count: 1,
      min_date: day, latest_date: day });

    expect(await useStore.getState().refresh({ manual: true })).toBe(false);
    expect(mockDownloadCore).not.toHaveBeenCalled();
    expect(files.get(bundlePath)).toBe(originalBundle);
    expect(useStore.getState().manifest?.bank_rate_history_catalogue).toEqual(namespace);
    expect((await cache.readMeta())?.manifest.bank_rate_history_catalogue).toEqual(namespace);

    // Discard live state and restart offline through the actual bootstrap and
    // actual sidecar-backed cache reader, not the refreshed in-memory manifest.
    mockFetchManifest.mockRejectedValue(new Error('offline'));
    mockFetchManifest.mockClear();
    jest.mocked(prepareBankRateHistoryAfterPaint).mockClear();
    useStore.setState({ status: 'idle', core: null, coreIntegrity: null, manifest: null, details: null });
    await useStore.getState().bootstrap({ skipRefresh: true });
    expect(useStore.getState().status).toBe('ready');
    expect(useStore.getState().manifest?.bank_rate_history_catalogue).toEqual(namespace);
    expect(validateDetachedHistoricalCatalogueDescriptor(useStore.getState().manifest!)).toEqual(namespace.file);
    expect(prepareBankRateHistoryAfterPaint).toHaveBeenCalledWith(expect.any(Function), expect.any(Function),
      expect.objectContaining({ run_date: day }), expect.objectContaining({ bank_rate_history_catalogue: namespace }),
      null, null, expect.objectContaining({ readCachedDetails: true }));
    expect(mockFetchManifest).not.toHaveBeenCalled();
    expect(mockDownloadCore).not.toHaveBeenCalled();
  },
);
