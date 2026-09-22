import { sampleCore, sampleManifest } from '../src/data/sample';
import { DEFAULT_PREFS, type AppState, type StoreSet } from '../src/data/storeTypes';

const mockReadMeta = jest.fn();
const mockReadIndex = jest.fn();
const mockDownload = jest.fn();
const mockWriteIndex = jest.fn();
const mockWriteMeta = jest.fn();
let mockLocalMode = false;
jest.mock('../src/lib/appHealthTransportGuard', () => ({ isLocalAppHealthAudit: () => mockLocalMode }));
jest.mock('../src/data/cache', () => ({ cache: {
  readOptionalMeta: () => mockReadMeta(),
  readSearchIndex: () => mockReadIndex(),
  writeSearchIndex: (...args: unknown[]) => mockWriteIndex(...args),
  writeOptionalMeta: (...args: unknown[]) => mockWriteMeta(...args),
} }));
jest.mock('../src/data/payload', () => ({ downloadSearchIndex: (...args: unknown[]) => mockDownload(...args) }));
// eslint-disable-next-line import/first -- actions must share the mocked cache
import { createEnsureActions } from '../src/data/storeEnsure';

function harness() {
  const state = {
    core: sampleCore,
    source: 'remote',
    manifest: { ...sampleManifest, files: { ...sampleManifest.files,
      search_index: { name: 'search.json.gz', bytes: 10, sha256: 'index-new', url: 'https://example.test/search.json.gz' },
    } },
    prefs: { ...DEFAULT_PREFS, enableDeepSearch: true },
    searchIndex: null,
    searchIndexStatus: 'idle',
    searchIndexError: null,
  } as AppState;
  const set: StoreSet = patch => Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  return { state, actions: createEnsureActions(set, () => state) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLocalMode = false;
  mockReadMeta.mockResolvedValue(null);
  mockReadIndex.mockResolvedValue(null);
});

it('rejects a stale offline index without a network attempt, then recovers online', async () => {
  const { state, actions } = harness();
  const index = { schema_version: 1, run_date: sampleCore.run_date, products: { product: 'fees features' } };
  mockReadIndex.mockResolvedValue(index);
  mockReadMeta.mockResolvedValue({ coreSha: sampleManifest.files.core.sha256, searchIndexSha: 'old-index' });
  state.searchIndex = index;
  mockLocalMode = true;
  await actions.ensureSearchIndex();
  expect(state.searchIndex).toBeNull();
  expect(state.searchIndexStatus).toBe('unavailable');
  expect(mockDownload).not.toHaveBeenCalled();
  expect(mockWriteMeta).not.toHaveBeenCalled();

  mockLocalMode = false;
  mockDownload.mockResolvedValue({ text: JSON.stringify(index), searchIndex: index });
  await actions.ensureSearchIndex();
  expect(state.searchIndex).toBe(index);
  expect(state.searchIndexStatus).toBe('ready');
  expect(mockDownload).toHaveBeenCalledTimes(1);
  expect(mockWriteMeta).toHaveBeenCalledWith({ coreSha: sampleManifest.files.core.sha256, searchIndexSha: 'index-new' });
});

it('loads a matching cached index during a local audit', async () => {
  const { state, actions } = harness();
  const index = { schema_version: 1, run_date: sampleCore.run_date, products: { product: 'fees' } };
  mockLocalMode = true;
  mockReadMeta.mockResolvedValue({ coreSha: sampleManifest.files.core.sha256, searchIndexSha: 'index-new' });
  mockReadIndex.mockResolvedValue(index);
  await actions.ensureSearchIndex();
  expect(state.searchIndex).toBe(index);
  expect(state.searchIndexStatus).toBe('ready');
  expect(mockDownload).not.toHaveBeenCalled();
});

it('does not install a cached index after the edition changes during its read', async () => {
  const { state, actions } = harness();
  mockReadMeta.mockResolvedValue({ coreSha: sampleManifest.files.core.sha256, searchIndexSha: 'index-new' });
  mockReadIndex.mockImplementation(async () => {
    state.manifest = { ...state.manifest!, files: { ...state.manifest!.files,
      core: { ...state.manifest!.files.core, sha256: 'next-core' },
    } };
    return { schema_version: 1, run_date: sampleCore.run_date, products: {} };
  });
  await actions.ensureSearchIndex();
  expect(state.searchIndex).toBeNull();
  expect(mockDownload).not.toHaveBeenCalled();
});
