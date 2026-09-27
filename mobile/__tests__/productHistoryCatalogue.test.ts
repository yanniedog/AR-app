import { bundledHistoricalCatalogueBinding, getBundledHistoricalBankRateCatalogue } from '../src/data/bundledHistoricalBankRateCatalogue';
import { prepareHistoricalBankRateCatalogue, type PreparedHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogue';
import { productRatesFromHistoricalCatalogue } from '../src/data/productHistoryCatalogue';
import { syncProductHistoryFromDailyPayloads } from '../src/data/productHistorySync';
import { bestRatesForCore, productKeysForCore } from '../src/data/productHistoryModel';
import { downloadDatedCore, fetchDatesIndexJson, historyDatesUpTo } from '../src/data/historyDaily';
import { historicalSourceIdentity } from '../src/data/historyIdentity';
import { revisionTag } from '../src/data/payloadRevision';
import { sampleCore, sampleManifest } from '../src/data/sample';
import type { CorePayload, Manifest } from '../src/types';
import type { DatesIndex } from '../src/data/datesIndex';
import { createEnsureActions } from '../src/data/storeEnsure';
import { prepareBankRateHistoryAfterPaint } from '../src/data/storeBankRateHistory';
import { prepareHistoricalBankRateHistory } from '../src/data/historicalBankRateCatalogueSync';
import { installHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import { DEFAULT_PREFS, type AppState, type StoreGet, type StoreSet } from '../src/data/storeTypes';
import { cache } from '../src/data/cache';
import type { CacheMeta } from '../src/data/cache';
import { HISTORY_DERIVATION_VERSION } from '../src/data/historyDerivation';
import { installAppHealthTransportGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';

jest.mock('../src/data/historyDaily', () => ({
  ...jest.requireActual('../src/data/historyDaily'), downloadDatedCore: jest.fn(), fetchDatesIndexJson: jest.fn(),
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}), yieldToPaintFrames: jest.fn(async () => {}) }));
jest.mock('../src/data/cache', () => ({ cache: {
  readProductHistory: jest.fn(async () => null), writeProductHistory: jest.fn(async () => {}),
  readMeta: jest.fn(async () => null),
} }));
jest.mock('../src/data/historicalBankRateCatalogueSync', () => ({ prepareHistoricalBankRateHistory: jest.fn() }));

let prepared: PreparedHistoricalBankRateCatalogue;
const originalIndex = bundledHistoricalCatalogueBinding.index!;
const target = '2026-09-27';
// Captured product rows with protocol-only date/edition changes for recovery cases.
const current = { ...sampleCore, run_date: target };
const coreSha = 'e'.repeat(64);
function selectedIndex(): DatesIndex {
  const index = JSON.parse(JSON.stringify(originalIndex)) as DatesIndex;
  index.dates.push(target); index.latest_date = target; index.count = index.dates.length;
  index.revision_heads![target] = { ...index.revision_heads![originalIndex.latest_date], revision: 1,
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${revisionTag(target, 1)}/manifest.json` };
  return index;
}

beforeAll(() => {
  prepared = prepareHistoricalBankRateCatalogue(getBundledHistoricalBankRateCatalogue())!;
  expect(prepared).not.toBeNull();
});
beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(fetchDatesIndexJson).mockResolvedValue(selectedIndex());
  jest.mocked(cache.readMeta).mockResolvedValue(null);
});

test('reuses all 134 real bundled publications without downloading their cores', async () => {
  const onCheckpoint = jest.fn();
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: prepared, onCheckpoint });
  expect(originalIndex.dates).toHaveLength(134);
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(onCheckpoint).toHaveBeenCalledTimes(1);
  expect(result.run_dates).toHaveLength(135);
  expect(Object.values(result.date_status!)).toEqual(Array(135).fill('verified'));
  for (const day of originalIndex.dates) expect(result.source_identities?.[day]).toBe(historicalSourceIdentity(originalIndex, day));
  expect(result.source_identities?.[target]).toBe(`core:${coreSha}`);
  expect(Object.keys(result.products).length).toBeGreaterThan(3000);
});

test('downloads only a corrected publication and clears products absent from that corrected core', async () => {
  const index = selectedIndex(), day = originalIndex.latest_date;
  const head = index.revision_heads![day];
  head.revision++; head.manifest_sha256 = 'f'.repeat(64); head.bundle_sha256 = 'd'.repeat(64);
  head.manifest_url = `https://github.com/yanniedog/AR-local/releases/download/${revisionTag(day, head.revision)}/manifest.json`;
  jest.mocked(fetchDatesIndexJson).mockResolvedValue(index);
  const corrected: CorePayload = { ...sampleCore, run_date: day, sections: Object.fromEntries(
    Object.entries(sampleCore.sections).map(([section, value]) => [section, { ...value, rates: [] }]),
  ) as unknown as CorePayload['sections'] };
  jest.mocked(downloadDatedCore).mockResolvedValue(corrected);
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha, catalogue: prepared });
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
  expect(downloadDatedCore).toHaveBeenCalledWith(day, index, undefined);
  const position = result.run_dates.indexOf(day);
  expect(Object.values(result.products).every(series => series[position] === null)).toBe(true);
  expect(result.source_identities?.[day]).toBe(historicalSourceIdentity(index, day));
});

test('a failed corrected date stays unavailable instead of borrowing the stale bundled observation', async () => {
  const index = selectedIndex(), day = originalIndex.latest_date;
  index.revision_heads![day].manifest_sha256 = 'f'.repeat(64);
  jest.mocked(fetchDatesIndexJson).mockResolvedValue(index);
  jest.mocked(downloadDatedCore).mockRejectedValue(new Error('corrected edition unavailable'));
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha, catalogue: prepared });
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
  expect(result.date_status?.[day]).toBe('unavailable');
  expect(result.source_identities?.[day]).toBeUndefined();
  expect(Object.values(result.products).every(series => series[result.run_dates.indexOf(day)] === null)).toBe(true);
});

test('today always uses installed current rows and core identity even when the catalogue contains today', async () => {
  const day = originalIndex.latest_date, core = { ...sampleCore, run_date: day };
  jest.mocked(fetchDatesIndexJson).mockResolvedValue(originalIndex);
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: day, currentCore: core, coreSha, catalogue: prepared });
  const expected = bestRatesForCore(core, productKeysForCore(core)), position = result.run_dates.indexOf(day);
  for (const [key, series] of Object.entries(result.products)) expect(series[position]).toBe(expected.get(key) ?? null);
  expect(result.source_identities?.[day]).toBe(`core:${coreSha}`);
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test('raw producer sources and unavailable dates cannot acquire public revision identities', async () => {
  const [rawDay, missingDay] = originalIndex.dates;
  const catalogue = { ...prepared.catalogue, sources: { ...prepared.catalogue.sources,
    [rawDay]: { kind: 'selected_contract' as const, generation_id: 'raw-source', contract_digest: 'c'.repeat(64), banks_sha256: 'b'.repeat(64), bytes: 100 } },
    unavailable_dates: { ...prepared.catalogue.unavailable_dates, [missingDay]: 'unavailable' } };
  // These source-selection changes cannot add observations; use the already
  // validated tier data to isolate the projection's provenance gate.
  const projected = await productRatesFromHistoricalCatalogue({ ...prepared, catalogue }, originalIndex, [rawDay, missingDay]);
  expect(projected.size).toBe(0);
});

test('does not project unselected dates even when requested by an older caller', async () => {
  const day = originalIndex.dates[0], index = selectedIndex();
  index.dates = index.dates.filter(value => value !== day);
  const projected = await productRatesFromHistoricalCatalogue(prepared, index, [day]);
  expect(projected.size).toBe(0);
});

test('cooperatively yields and cancels before publishing rates after generation replacement', async () => {
  let active = true;
  const yieldWork = jest.fn(async () => { active = false; });
  await expect(productRatesFromHistoricalCatalogue(prepared, originalIndex,
    historyDatesUpTo(originalIndex, originalIndex.latest_date), () => active, yieldWork)).rejects.toThrow('superseded');
  expect(yieldWork).toHaveBeenCalledTimes(1);
});

test('cancels during bounded projection work after a later yield', async () => {
  let active = true, time = 0;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => time += 9);
  const yieldWork = jest.fn(async () => { if (yieldWork.mock.calls.length === 2) active = false; });
  try {
    await expect(productRatesFromHistoricalCatalogue(prepared, originalIndex, originalIndex.dates,
      () => active, yieldWork)).rejects.toThrow('superseded');
    expect(yieldWork).toHaveBeenCalledTimes(2);
  } finally { clock.mockRestore(); }
});

function productStore(manifest: Manifest = { ...sampleManifest, run_date: target }) {
  let state = { core: { ...current }, manifest, source: 'remote',
    prefs: DEFAULT_PREFS, productHistory: null, productHistoryError: null } as unknown as AppState;
  const get: StoreGet = () => state;
  const set: StoreSet = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
  return { get, set, actions: createEnsureActions(set, get) };
}
function deferredPreparation() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  jest.mocked(prepareHistoricalBankRateHistory).mockImplementationOnce(async core => {
    await gate;
    return installHistoricalBankRateCatalogue(core, prepared.catalogue);
  });
  return release;
}

test('store coalesces product requests behind active catalogue preparation and avoids all 134 downloads', async () => {
  const { get, set, actions } = productStore(), release = deferredPreparation();
  const historyWork = prepareBankRateHistoryAfterPaint(set, get, get().core!, get().manifest!, null, null, { warm: false });
  const first = actions.ensureProductHistory(), second = actions.ensureProductHistory();
  await Promise.resolve(); await Promise.resolve();
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(cache.writeProductHistory).not.toHaveBeenCalled();
  release();
  await Promise.all([historyWork, first, second]);
  expect(fetchDatesIndexJson).toHaveBeenCalledTimes(1);
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(cache.writeProductHistory).toHaveBeenCalledTimes(1);
  expect(get().productHistory?.run_dates).toHaveLength(135);
  expect(get().productHistoryError).toBeNull();
});

function receipt(index = selectedIndex()): CacheMeta {
  const head = index.revision_heads![target], prefix = head.manifest_url.slice(0, -'manifest.json'.length);
  const manifest: Manifest = { ...sampleManifest, run_date: target, repo: 'yanniedog/AR-local',
    tag: revisionTag(target, head.revision), payload_revision: { schema_version: 1,
      revision: head.revision, generation_id: head.generation_id, bundle_sha256: head.bundle_sha256, parent_revision: null },
    files: Object.fromEntries(Object.entries(sampleManifest.files).map(([key, file]) => [key,
      { ...file, sha256: key === 'core' ? coreSha : 'd'.repeat(64), bytes: 100, url: prefix + file!.name },
    ])) as Manifest['files'],
  };
  return { manifest, source: 'remote', coreSha, detailsSha: null, savedAt: target, historyDatesIndex: index };
}

test('local audit awaiting catalogue preparation retains all 134 public dates without a network attempt', async () => {
  const meta = receipt(), { get, set, actions } = productStore(meta.manifest), release = deferredPreparation();
  jest.mocked(cache.readMeta).mockResolvedValue(meta);
  const historyWork = prepareBankRateHistoryAfterPaint(set, get, get().core!, get().manifest!, meta.historyDatesIndex!, null, { warm: false });
  const pending = actions.ensureProductHistory();
  await Promise.resolve(); await Promise.resolve();
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'local', contract: createV1AppHealthSourceContract() });
  try {
    release(); await Promise.all([historyWork, pending]);
    expect(fetchDatesIndexJson).not.toHaveBeenCalled();
    expect(downloadDatedCore).not.toHaveBeenCalled();
    expect(guard.snapshot()).toMatchObject({ authorizationAttempts: 0, transportCalls: 0 });
    expect(get().productHistory?.run_dates).toHaveLength(135);
    for (const day of originalIndex.dates) expect(get().productHistory?.source_identities?.[day]).toBe(historicalSourceIdentity(originalIndex, day));
    expect(get().productHistoryError).toBeNull();
  } finally { guard.restore(); }
});

test('a network outage reuses the bound receipt and archive without retrying dated cores', async () => {
  jest.mocked(fetchDatesIndexJson).mockRejectedValue(new Error('offline'));
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: prepared, fallbackIndex: selectedIndex() });
  expect(fetchDatesIndexJson).toHaveBeenCalledTimes(1);
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(result.run_dates).toHaveLength(135);
  expect(Object.values(result.date_status!)).toEqual(Array(135).fill('verified'));
});

test('offline corrected receipt leaves unmatched archive dates unavailable', async () => {
  const index = selectedIndex(), day = originalIndex.latest_date;
  index.revision_heads![day] = { ...index.revision_heads![day], revision: 9, manifest_sha256: 'f'.repeat(64), bundle_sha256: 'c'.repeat(64),
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${revisionTag(day, 9)}/manifest.json` };
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: prepared, fallbackIndex: index, allowNetwork: false });
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(result.date_status?.[day]).toBe('unavailable');
  expect(result.source_identities?.[day]).toBeUndefined();
  expect(Object.values(result.products).every(series => series[result.run_dates.indexOf(day)] === null)).toBe(true);
});

test('offline reuse leaves raw producer and absent-source observations unverified', async () => {
  const [rawDay, missingDay] = originalIndex.dates;
  const catalogue = { ...prepared.catalogue, sources: { ...prepared.catalogue.sources,
    [rawDay]: { kind: 'selected_contract' as const, generation_id: 'raw-source', contract_digest: 'c'.repeat(64), banks_sha256: 'b'.repeat(64), bytes: 100 } },
    unavailable_dates: { ...prepared.catalogue.unavailable_dates, [missingDay]: 'unavailable' } };
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: { ...prepared, catalogue }, fallbackIndex: selectedIndex(), allowNetwork: false });
  for (const day of [rawDay, missingDay]) {
    expect(result.date_status?.[day]).toBe('unavailable');
    expect(result.source_identities?.[day]).toBeUndefined();
  }
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test('a successful fresh correction is never replaced by an older fallback receipt', async () => {
  const fallback = selectedIndex(), fresh = selectedIndex(), day = originalIndex.latest_date;
  fresh.revision_heads![day].manifest_sha256 = 'f'.repeat(64);
  jest.mocked(fetchDatesIndexJson).mockResolvedValue(fresh);
  jest.mocked(downloadDatedCore).mockRejectedValue(new Error('corrected asset unavailable'));
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: prepared, fallbackIndex: fallback });
  expect(downloadDatedCore).toHaveBeenCalledWith(day, fresh, undefined);
  expect(result.date_status?.[day]).toBe('unavailable');
  expect(result.source_identities?.[day]).toBeUndefined();
});

test.each(['rollback', 'equivocation', 'missing-head'] as const)('rejects an offline %s receipt against retained revision high-water', async kind => {
  const index = selectedIndex(), day = originalIndex.latest_date, head = index.revision_heads![day];
  const identity = kind === 'rollback' ? `revision:${head.revision + 1}:${head.bundle_sha256}:${head.manifest_sha256}` : historicalSourceIdentity(index, day);
  if (kind === 'equivocation') head.manifest_sha256 = 'f'.repeat(64);
  if (kind === 'missing-head') { index.dates = index.dates.filter(value => value !== day); delete index.revision_heads![day]; }
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: target, currentCore: current, coreSha,
    catalogue: prepared, fallbackIndex: index, allowNetwork: false,
    existing: { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: target,
      run_dates: [day, target], products: { 'retained-product': [0.01, null] },
      source_identities: { [day]: identity }, revision_high_water: { [day]: identity } },
  });
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(result.run_dates).toEqual([day, target]);
  expect(result.products['retained-product'][0]).toBe(0.01);
  expect(result.source_identities?.[day]).toBe(identity);
});

test.each(['core', 'details', 'payload', 'head', 'malformed-files'] as const)('ignores an offline cache receipt with mismatched %s binding', async mismatch => {
  const meta = receipt(), { get, actions } = productStore(meta.manifest);
  installHistoricalBankRateCatalogue(get().core!, prepared.catalogue);
  const invalid = JSON.parse(JSON.stringify(meta)) as CacheMeta;
  if (mismatch === 'core') invalid.coreSha = 'f'.repeat(64);
  if (mismatch === 'details') invalid.manifest.files.details.sha256 = 'f'.repeat(64);
  if (mismatch === 'payload') invalid.manifest.payload_revision!.bundle_sha256 = 'f'.repeat(64);
  if (mismatch === 'head') invalid.historyDatesIndex!.revision_heads![target].bundle_sha256 = 'f'.repeat(64);
  if (mismatch === 'malformed-files') Object.assign(invalid.manifest, { files: {} });
  jest.mocked(cache.readMeta).mockResolvedValue(invalid);
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'local', contract: createV1AppHealthSourceContract() });
  try {
    await actions.ensureProductHistory();
    expect(fetchDatesIndexJson).not.toHaveBeenCalled();
    expect(downloadDatedCore).not.toHaveBeenCalled();
    expect(get().productHistory?.run_dates).toEqual([target]);
    expect(get().productHistoryError).toBeNull();
  } finally { guard.restore(); }
});

test('store rechecks the current edition after reading the offline receipt', async () => {
  const meta = receipt(), { get, set, actions } = productStore(meta.manifest);
  installHistoricalBankRateCatalogue(get().core!, prepared.catalogue);
  jest.mocked(cache.readMeta).mockImplementationOnce(async () => {
    set({ manifest: { ...meta.manifest, files: { ...meta.manifest.files,
      core: { ...meta.manifest.files.core, sha256: 'f'.repeat(64) } } } });
    return meta;
  });
  await actions.ensureProductHistory();
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(cache.writeProductHistory).not.toHaveBeenCalled();
  expect(get().productHistory).toBeNull();
});

test('store abandons a superseded product request after the catalogue waiter resolves', async () => {
  const { get, set, actions } = productStore(), release = deferredPreparation();
  const historyWork = prepareBankRateHistoryAfterPaint(set, get, get().core!, get().manifest!, null, null, { warm: false });
  const pending = actions.ensureProductHistory();
  await Promise.resolve(); await Promise.resolve();
  const manifest = get().manifest!;
  set({ core: { ...current }, manifest: { ...manifest, files: { ...manifest.files,
    core: { ...manifest.files.core, sha256: 'f'.repeat(64) } } } });
  release();
  await Promise.all([historyWork, pending]);
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(cache.writeProductHistory).not.toHaveBeenCalled();
  expect(get().productHistory).toBeNull();
});
