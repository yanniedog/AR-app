import { prepareBankRateHistoryAfterPaint } from '../src/data/storeBankRateHistory';
import { createBootstrapActions } from '../src/data/storeBootstrap';
import { DEFAULT_PREFS, type AppState, type StoreGet, type StoreSet } from '../src/data/storeTypes';
import { sampleCore, sampleManifest } from '../src/data/sample';
import { cache } from '../src/data/cache';
import { prepareHistoricalBankRateHistory } from '../src/data/historicalBankRateCatalogueSync';
import { warmHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import { yieldToPaintFrames } from '../src/lib/yieldToUi';
import { closeSuitabilityGateUntilRebuild } from '../src/data/suitabilityIndex';
import { integrateRbaCalendarIntoCore } from '../src/data/rbaOfficialLive';
import { cachedHistoricalBankRateCatalogue, installHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import type { RbaCalendar } from '../src/data/rbaCalendar';
import { revisionHead, revisionManifest } from '../testUtils/payloadRevision';

jest.mock('../src/data/cache', () => ({ cache: {
  readBundle: jest.fn(), readDetails: jest.fn(async () => null),
} }));
jest.mock('../src/data/historicalBankRateCatalogueSync', () => ({ prepareHistoricalBankRateHistory: jest.fn(async () => true) }));
jest.mock('../src/data/historicalBankRateCatalogueStore', () => ({
  ...jest.requireActual('../src/data/historicalBankRateCatalogueStore'), warmHistoricalBankRateCatalogue: jest.fn(async () => {}),
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToPaintFrames: jest.fn(async () => {}) }));
jest.mock('../src/lib/debugLog', () => ({ debugLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../src/data/suitabilityIndex', () => ({
  clearSuitabilityIndex: jest.fn(), hydrateSuitabilityIndex: jest.fn(async () => null), closeSuitabilityGateUntilRebuild: jest.fn(),
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function store() {
  let state = { core: sampleCore, manifest: sampleManifest, status: 'ready', bankRateHistoryRevision: 0,
    prefs: { ...DEFAULT_PREFS, enableDeepSearch: false, showHistoryRibbon: false },
    ensureDetails: jest.fn(async () => {}), refresh: jest.fn(async () => false),
  } as unknown as AppState;
  const get: StoreGet = () => state;
  const set: StoreSet = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
  return { get, set };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(yieldToPaintFrames).mockResolvedValue(undefined);
  jest.mocked(prepareHistoricalBankRateHistory).mockResolvedValue(true);
  jest.mocked(warmHistoricalBankRateCatalogue).mockResolvedValue(undefined);
  jest.mocked(cache.readDetails).mockResolvedValue(null);
});

test.each(['valid', 'malformed', 'oversized', 'wrong-head'])(
  'offline bootstrap recovers the saved selection after first paint, ignoring %s optional receipts safely', async kind => {
    const manifest = revisionManifest(1), day = manifest.run_date;
    const index = { schema_version: 1, revision_protocol: 1 as const, dates: [day], count: 1,
      min_date: day, latest_date: day, revision_heads: { [day]: revisionHead(manifest) } };
    const receipt = kind === 'malformed' ? { dates: [null] } : kind === 'oversized' ?
      { ...index, dates: Array(5001).fill(day) } : kind === 'wrong-head' ?
        { ...index, revision_heads: { [day]: revisionHead(revisionManifest(2)) } } : index;
    const details = { schema_version: 1, run_date: day, products: {} };
    jest.mocked(cache.readDetails).mockResolvedValue(details);
    jest.mocked(cache.readBundle).mockResolvedValue({ core: sampleCore, integrity: null,
      meta: { manifest, source: 'remote', coreSha: manifest.files.core.sha256, historyDatesIndex: receipt },
    } as unknown as NonNullable<Awaited<ReturnType<typeof cache.readBundle>>>);
    const paint = deferred();
    jest.mocked(yieldToPaintFrames).mockReturnValueOnce(paint.promise);
    const { get, set } = store();
    set({ status: 'idle', core: null, manifest: null });
    await createBootstrapActions(set, get, () => ({})).bootstrap({ skipRefresh: true });
    expect(get().status).toBe('ready');
    expect(cache.readDetails).not.toHaveBeenCalled();
    paint.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(prepareHistoricalBankRateHistory).toHaveBeenCalledWith(sampleCore, manifest,
      kind === 'valid' ? index : null, details);
    expect(get().bankRateHistoryLoading).toBe(false);
    expect(get().refresh).not.toHaveBeenCalled();
  },
);

test('cached bootstrap exposes a gated ready core before any history or paint work completes', async () => {
  const paint = deferred();
  jest.mocked(yieldToPaintFrames).mockReturnValueOnce(paint.promise);
  jest.mocked(cache.readBundle).mockResolvedValue({ core: sampleCore, integrity: null,
    meta: { manifest: sampleManifest, source: 'remote', coreSha: sampleManifest.files.core.sha256 },
  } as unknown as NonNullable<Awaited<ReturnType<typeof cache.readBundle>>>);
  const { get, set } = store();
  set({ status: 'idle', core: null, manifest: null });
  await createBootstrapActions(set, get, () => ({})).bootstrap({ skipRefresh: true });
  expect(get()).toMatchObject({ status: 'ready', core: sampleCore, bankRateHistoryLoading: true });
  expect(closeSuitabilityGateUntilRebuild).toHaveBeenCalled();
  expect(get().ensureDetails).toHaveBeenCalledWith({ force: true });
  expect(prepareHistoricalBankRateHistory).not.toHaveBeenCalled();
  paint.resolve();
  // Drain the optional async continuation without advancing synthetic clocks.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(get().bankRateHistoryLoading).toBe(false);
  expect(get().bankRateHistoryRevision).toBe(1);
});

test('slow or failed history does not change readiness and settles its loading state', async () => {
  const work = deferred();
  jest.mocked(prepareHistoricalBankRateHistory).mockImplementationOnce(async () => { await work.promise; throw new Error('unavailable'); });
  const { get, set } = store();
  const pending = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  await Promise.resolve();
  expect(get()).toMatchObject({ status: 'ready', bankRateHistoryLoading: true });
  work.resolve();
  await pending;
  expect(get()).toMatchObject({ status: 'ready', bankRateHistoryLoading: false, bankRateHistoryRevision: 1 });
});

test('a superseded core cannot publish completion over the new history request', async () => {
  const old = deferred(), next = deferred();
  jest.mocked(prepareHistoricalBankRateHistory)
    .mockImplementationOnce(async () => { await old.promise; return true; })
    .mockImplementationOnce(async () => { await next.promise; return true; });
  const { get, set } = store();
  const first = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  await Promise.resolve();
  const replacement = { ...sampleCore };
  set({ core: replacement });
  const second = prepareBankRateHistoryAfterPaint(set, get, replacement, sampleManifest);
  await Promise.resolve();
  old.resolve();
  await first;
  expect(get().bankRateHistoryLoading).toBe(true);
  expect(get().bankRateHistoryRevision).toBe(0);
  expect(warmHistoricalBankRateCatalogue).not.toHaveBeenCalled();
  next.resolve();
  await second;
  expect(get().bankRateHistoryLoading).toBe(false);
  expect(get().bankRateHistoryRevision).toBe(1);
});

test('a later request cancels queued startup work and uses the latest filters', async () => {
  const paint = deferred();
  jest.mocked(yieldToPaintFrames).mockReturnValueOnce(paint.promise);
  const { get, set } = store();
  const first = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  set({ prefs: { ...get().prefs, includeNonStandard: true, onboarded: true, interests: ['Savings'] } });
  await prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  paint.resolve();
  await first;
  expect(prepareHistoricalBankRateHistory).toHaveBeenCalledTimes(1);
  expect(warmHistoricalBankRateCatalogue).toHaveBeenCalledWith(sampleCore, expect.objectContaining({ includeNonStandard: true, interests: ['Savings'] }));
  expect(get().bankRateHistoryRevision).toBe(1);
});

test('RBA-only core replacements inherit in-flight and completed bank history', async () => {
  const work = deferred();
  jest.mocked(prepareHistoricalBankRateHistory).mockImplementationOnce(async core => {
    await work.promise;
    return installHistoricalBankRateCatalogue(core, {
      schema_version: 2, run_dates: [core.run_date], sources: {}, unavailable_dates: {},
      evidence: [{ status: 'unknown' }], sections: { Mortgage: [], Savings: [], TD: [] },
    });
  });
  const { get, set } = store();
  const pending = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  await Promise.resolve();
  const calendar = { decisions: [{ date: '2026-09-01', outcome: 'hold', rate: 4.1 }] } as RbaCalendar;
  const nextCore = integrateRbaCalendarIntoCore(sampleCore, calendar);
  expect(nextCore).not.toBe(sampleCore);
  set({ core: nextCore });
  work.resolve();
  await pending;
  expect(get().bankRateHistoryLoading).toBe(false);
  expect(get().bankRateHistoryRevision).toBe(1);
  expect(cachedHistoricalBankRateCatalogue(nextCore)).not.toBeNull();
  expect(warmHistoricalBankRateCatalogue).toHaveBeenCalledWith(nextCore, expect.any(Object));
  const another = integrateRbaCalendarIntoCore(nextCore, { decisions: [{ date: '2026-10-01', outcome: 'hold', rate: 4.1 }] } as RbaCalendar);
  expect(cachedHistoricalBankRateCatalogue(another)).toBe(cachedHistoricalBankRateCatalogue(nextCore));
});
