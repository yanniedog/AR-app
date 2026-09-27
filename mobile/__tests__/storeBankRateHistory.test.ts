import { prepareBankRateHistoryAfterPaint, waitForBankRateHistoryPreparation } from '../src/data/storeBankRateHistory';
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
import { loadDetachedHistoricalBankRateCatalogue } from '../src/data/detachedHistoricalBankRateCatalogue';
import { isLocalAppHealthAudit } from '../src/lib/appHealthTransportGuard';
import { configureNativeHistoricalCatalogueCodec } from '../src/data/historicalBankRateCatalogueNative';
import { gzipSync, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { downloadInflate } from '../src/data/payload';
import { compressCatalogue } from '../src/data/historicalBankRateCatalogueCompression';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { upsertHistoricalCatalogueDay } from '../src/data/historicalBankRateCatalogueMerge';
import type { HistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import type { DatesIndex } from '../src/data/datesIndex';

let mockLegacyCatalogue: HistoricalBankRateCatalogue;
let mockLegacyIndex: DatesIndex;
jest.mock('../src/data/bundledHistoricalBankRateCatalogue', () => ({
  getBundledHistoricalBankRateCatalogueAsync: jest.fn(async () => mockLegacyCatalogue),
  bundledHistoricalCatalogueBinding: { core_sha256: 'a'.repeat(64), get index() { return mockLegacyIndex; } },
}));

jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async (_: unknown, bytes: Uint8Array) => new Uint8Array(jest.requireActual('@noble/hashes/sha256').sha256(bytes)).buffer),
}));
jest.mock('../src/data/payload', () => ({ ...jest.requireActual('../src/data/payload'), downloadInflate: jest.fn() }));

jest.mock('../src/data/cache', () => ({ cache: {
  readBundle: jest.fn(), readDetails: jest.fn(async () => null),
  readDetachedBankRateHistoryAsset: jest.fn(async () => null), writeDetachedBankRateHistoryAsset: jest.fn(async () => {}),
} }));
jest.mock('../src/data/historicalBankRateCatalogueSync', () => ({ prepareHistoricalBankRateHistory: jest.fn(async () => true) }));
jest.mock('../src/data/historicalBankRateCatalogueNative', () => ({ configureNativeHistoricalCatalogueCodec: jest.fn(async () => false) }));
jest.mock('../src/data/detachedHistoricalBankRateCatalogue', () => ({ loadDetachedHistoricalBankRateCatalogue: jest.fn(async () => null) }));
jest.mock('../src/lib/appHealthTransportGuard', () => ({ isLocalAppHealthAudit: jest.fn(() => false) }));
jest.mock('../src/data/historicalBankRateCatalogueStore', () => ({
  ...jest.requireActual('../src/data/historicalBankRateCatalogueStore'), warmHistoricalBankRateCatalogue: jest.fn(async () => {}),
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToPaintFrames: jest.fn(async () => {}),
  yieldToUi: jest.fn(async () => {}), parseJsonHeavy: async (text: string) => JSON.parse(text),
}));
jest.mock('../src/lib/debugLog', () => ({ debugLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
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
  jest.mocked(loadDetachedHistoricalBankRateCatalogue).mockResolvedValue(null);
  jest.mocked(isLocalAppHealthAudit).mockReturnValue(false);
  jest.mocked(configureNativeHistoricalCatalogueCodec).mockResolvedValue(false);
});

function detachedManifest() {
  return { ...sampleManifest, bank_rate_history_catalogue: { schema_version: 1 as const,
    file: { name: 'history.json.gz', bytes: 123, sha256: 'a'.repeat(64), url: 'https://example.invalid/history.json.gz' },
  } };
}

test.each(['paint', 'native setup', 'cached details'] as const)(
  'same-edition refresh reuses a download completed while the successor awaits %s', async pausedStage => {
    const { get, set } = store(), manifest = revisionManifest(1);
    // Unique captured binding prevents the module's prepared memo from hiding
    // transport in any of the three scheduling paths.
    manifest.files.core = { ...manifest.files.core, sha256: bytesToHex(sha256(strToU8(pausedStage))) };
    delete manifest.files.core.enc;
    const catalogue = { schema_version: 2 as const, run_dates: [sampleCore.run_date], sources: {}, unavailable_dates: {},
      evidence: [{ status: 'unknown' as const }], sections: { Mortgage: [], Savings: [], TD: [] } };
    const text = JSON.stringify({ schema_version: 1, run_date: manifest.run_date,
      core_sha256: manifest.files.core.sha256, catalogue: compressCatalogue(catalogue) });
    const raw = gzipSync(strToU8(text)), hash = bytesToHex(sha256(raw));
    const name = `bank-rate-history-catalogue-${manifest.run_date}-${hash.slice(0, 12)}.json.gz`;
    manifest.bank_rate_history_catalogue = { schema_version: 1, file: { name, bytes: raw.length, sha256: hash,
      url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}` } };
    const bundle = payloadBundleIdentity(manifest);
    manifest.payload_revision = { ...manifest.payload_revision!, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
    set({ manifest });
    const enteredDownload = deferred(), download = deferred(), enteredPause = deferred(), pause = deferred();
    jest.mocked(loadDetachedHistoricalBankRateCatalogue).mockImplementation(
      jest.requireActual('../src/data/detachedHistoricalBankRateCatalogue').loadDetachedHistoricalBankRateCatalogue);
    jest.mocked(downloadInflate).mockImplementation(async (_url, _sha, options) => {
      enteredDownload.resolve(); await download.promise;
      options!.onVerifiedBytes!(raw); return text;
    });
    const first = prepareBankRateHistoryAfterPaint(set, get, sampleCore, manifest);
    await Promise.race([enteredDownload.promise, first.then(() => { throw new Error('Download was not reached: ' +
      JSON.stringify(jest.requireMock('../src/lib/debugLog').debugLog.warn.mock.calls)); })]);
    const freshIndex = { schema_version: 1, revision_protocol: 1 as const, dates: [manifest.run_date], count: 1,
      min_date: manifest.run_date, latest_date: manifest.run_date, revision_heads: { [manifest.run_date]: revisionHead(manifest) } };
    const freshDetails = { schema_version: 1, run_date: manifest.run_date, products: {} };
    const wait = async () => { enteredPause.resolve(); await pause.promise; };
    if (pausedStage === 'paint') jest.mocked(yieldToPaintFrames).mockImplementationOnce(wait);
    if (pausedStage === 'native setup') jest.mocked(configureNativeHistoricalCatalogueCodec).mockImplementationOnce(async () => { await wait(); return false; });
    jest.mocked(cache.readDetails).mockImplementationOnce(async () => {
      if (pausedStage === 'cached details') await wait();
      return freshDetails;
    });
    const second = prepareBankRateHistoryAfterPaint(set, get, sampleCore, manifest, freshIndex, null, { readCachedDetails: true });
    await enteredPause.promise;
    const firstOptions = jest.mocked(loadDetachedHistoricalBankRateCatalogue).mock.calls[0][1];
    expect(firstOptions.isCurrent?.()).toBe(false);
    expect(firstOptions.isAssetCurrent?.()).toBe(true);
    download.resolve(); await first;
    expect(prepareHistoricalBankRateHistory).not.toHaveBeenCalled();
    expect(cache.writeDetachedBankRateHistoryAsset).toHaveBeenCalledTimes(1);
    expect(get().bankRateHistoryLoading).toBe(true);
    pause.resolve(); await second;
    expect(downloadInflate).toHaveBeenCalledTimes(1);
    expect(cache.readDetachedBankRateHistoryAsset).toHaveBeenCalledTimes(1);
    expect(prepareHistoricalBankRateHistory).toHaveBeenCalledTimes(1);
    expect(prepareHistoricalBankRateHistory).toHaveBeenCalledWith(sampleCore, manifest, freshIndex, freshDetails, catalogue);
    expect(get()).toMatchObject({ bankRateHistoryLoading: false, bankRateHistoryRevision: 1 });
  },
);

test('detached history starts after paint and native setup, respecting the local audit network guard', async () => {
  const paint = deferred(), { get, set } = store(), manifest = detachedManifest();
  const catalogue = { schema_version: 2 as const, run_dates: [sampleCore.run_date], sources: {}, unavailable_dates: {},
    evidence: [{ status: 'unknown' as const }], sections: { Mortgage: [], Savings: [], TD: [] } };
  set({ manifest });
  jest.mocked(isLocalAppHealthAudit).mockReturnValue(true);
  jest.mocked(yieldToPaintFrames).mockReturnValueOnce(paint.promise);
  jest.mocked(loadDetachedHistoricalBankRateCatalogue).mockImplementationOnce(async (_manifest, options) => {
    expect(configureNativeHistoricalCatalogueCodec).toHaveBeenCalled();
    expect(options.allowNetwork).toBe(false);
    expect(options.isCurrent?.()).toBe(true);
    return catalogue;
  });
  const pending = prepareBankRateHistoryAfterPaint(set, get, sampleCore, manifest);
  expect(loadDetachedHistoricalBankRateCatalogue).not.toHaveBeenCalled();
  expect(get().status).toBe('ready');
  paint.resolve();
  await pending;
  expect(prepareHistoricalBankRateHistory).toHaveBeenCalledWith(sampleCore, manifest, null, null, catalogue);
  expect(get().bankRateHistoryRevision).toBe(1);
});

test('missing detached archive keeps the bundled preparation path available', async () => {
  const { get, set } = store(), manifest = detachedManifest();
  set({ manifest });
  await prepareBankRateHistoryAfterPaint(set, get, sampleCore, manifest);
  expect(prepareHistoricalBankRateHistory).toHaveBeenCalledWith(sampleCore, manifest, null, null);
  expect(get().bankRateHistoryLoading).toBe(false);
});

test.each(['missing', 'corrupt', 'partial'])(
  'a legacy compact core with a %s detached asset actually restores verified prior history during a local audit', async kind => {
    const { get, set } = store(), current = { ...sampleCore };
    const previousDay = new Date(Date.parse(current.run_date) - (kind === 'partial' ? 2 : 1) * 86_400_000).toISOString().slice(0, 10);
    const source = { kind: 'published_core' as const, core_sha256: 'a'.repeat(64),
      details_sha256: 'b'.repeat(64), manifest_sha256: 'c'.repeat(64) };
    const captured = { ...current, run_date: previousDay, sections: { ...current.sections,
      Mortgage: { ...current.sections.Mortgage, rates: current.sections.Mortgage.rates.slice(0, 1) },
      Savings: { ...current.sections.Savings, rates: [] }, TD: { ...current.sections.TD, rates: [] } } };
    mockLegacyCatalogue = upsertHistoricalCatalogueDay(null, captured, null, source);
    mockLegacyIndex = { schema_version: 1, revision_protocol: 1, dates: [previousDay], count: 1,
      min_date: previousDay, latest_date: previousDay, revision_heads: { [previousDay]: {
        revision: 1, generation_id: 'verified-bundled-day', bundle_sha256: 'd'.repeat(64),
        manifest_sha256: source.manifest_sha256,
        manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${previousDay}-r000001/manifest.json`,
      } } };
    const manifest = { ...sampleManifest, tag: 'app-payload-latest', files: {
      ...sampleManifest.files, core: { ...sampleManifest.files.core } } };
    delete manifest.payload_revision;
    delete manifest.files.core.enc;
    const partialDay = new Date(Date.parse(current.run_date) - 86_400_000).toISOString().slice(0, 10);
    const partial = upsertHistoricalCatalogueDay(null, { ...captured, run_date: partialDay }, null, source);
    partial.sources[partialDay] = { kind: 'selected_contract', generation_id: 'verified-producer-day',
      contract_digest: 'e'.repeat(64), banks_sha256: 'f'.repeat(64), bytes: 123 };
    const raw = gzipSync(strToU8(JSON.stringify({ schema_version: 1, run_date: manifest.run_date,
      core_sha256: manifest.files.core.sha256, catalogue: compressCatalogue(partial) })));
    const hash = bytesToHex(sha256(kind === 'partial' ? raw : strToU8(`unavailable-${kind}`)));
    const name = `bank-rate-history-catalogue-${current.run_date}-${hash.slice(0, 12)}.json.gz`;
    manifest.bank_rate_history_catalogue = { schema_version: 1, file: { name, sha256: hash, bytes: kind === 'partial' ? raw.length : 100,
      url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}` } };
    set({ core: current, manifest });
    jest.mocked(isLocalAppHealthAudit).mockReturnValue(true);
    jest.mocked(cache.readDetachedBankRateHistoryAsset).mockImplementation(async decode =>
      kind === 'partial' ? decode(Buffer.from(raw).toString('base64')) : kind === 'corrupt' ? decode('not-a-valid-base64-asset') : null);
    jest.mocked(loadDetachedHistoricalBankRateCatalogue).mockImplementationOnce(
      jest.requireActual('../src/data/detachedHistoricalBankRateCatalogue').loadDetachedHistoricalBankRateCatalogue);
    jest.mocked(prepareHistoricalBankRateHistory).mockImplementationOnce(
      jest.requireActual('../src/data/historicalBankRateCatalogueSync').prepareHistoricalBankRateHistory);
    const datesOnly: DatesIndex = { schema_version: 1, dates: [previousDay, current.run_date], count: 2,
      min_date: previousDay, latest_date: current.run_date };

    await prepareBankRateHistoryAfterPaint(set, get, current, manifest, datesOnly);

    const prepared = cachedHistoricalBankRateCatalogue(current)!;
    expect(prepared?.catalogue.sources).toEqual({ [previousDay]: source,
      ...(kind === 'partial' ? { [partialDay]: partial.sources[partialDay] } : {}) });
    expect(prepared.catalogue.sections.Mortgage[0].spans[0][2]).toEqual(mockLegacyCatalogue.sections.Mortgage[0].spans[0][2]);
    expect(prepared.catalogue.sources[current.run_date]).toBeUndefined();
    expect(cache.readDetachedBankRateHistoryAsset).toHaveBeenCalled();
    if (kind === 'partial') {
      expect(await jest.mocked(loadDetachedHistoricalBankRateCatalogue).mock.results.at(-1)!.value).not.toBeNull();
      expect(prepareHistoricalBankRateHistory).toHaveBeenCalledWith(current, manifest, datesOnly, null, partial);
    }
    expect(downloadInflate).not.toHaveBeenCalled();
    expect(get()).toMatchObject({ status: 'ready', bankRateHistoryLoading: false, bankRateHistoryRevision: 1 });
  },
);

test('a replaced selection cannot install a detached archive that finishes later', async () => {
  const work = deferred(), { get, set } = store(), manifest = detachedManifest();
  set({ manifest });
  jest.mocked(loadDetachedHistoricalBankRateCatalogue).mockImplementationOnce(async (_manifest, options) => {
    await work.promise;
    expect(options.isAssetCurrent?.()).toBe(false);
    return null;
  });
  const pending = prepareBankRateHistoryAfterPaint(set, get, sampleCore, manifest);
  await new Promise(resolve => setTimeout(resolve, 0));
  set({ manifest: { ...manifest, bank_rate_history_catalogue: { schema_version: 1,
    file: { ...manifest.bank_rate_history_catalogue.file, sha256: 'b'.repeat(64) } } } });
  work.resolve();
  await pending;
  expect(prepareHistoricalBankRateHistory).not.toHaveBeenCalled();
  expect(get().bankRateHistoryRevision).toBe(0);
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
  await new Promise(resolve => setTimeout(resolve, 0));
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
  await new Promise(resolve => setTimeout(resolve, 0));
  const replacement = { ...sampleCore };
  set({ core: replacement });
  const second = prepareBankRateHistoryAfterPaint(set, get, replacement, sampleManifest);
  await new Promise(resolve => setTimeout(resolve, 0));
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

test('product history waits for the replacement preparation before choosing a source', async () => {
  const old = deferred(), next = deferred();
  jest.mocked(prepareHistoricalBankRateHistory)
    .mockImplementationOnce(async () => { await old.promise; return true; })
    .mockImplementationOnce(async () => { await next.promise; return true; });
  const { get, set } = store();
  const first = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  await new Promise(resolve => setTimeout(resolve, 0));
  let settled = false;
  const waiting = waitForBankRateHistoryPreparation(get).then(() => { settled = true; });
  const replacement = { ...sampleCore };
  set({ core: replacement });
  const second = prepareBankRateHistoryAfterPaint(set, get, replacement, sampleManifest);
  await new Promise(resolve => setTimeout(resolve, 0));
  old.resolve();
  await first;
  expect(settled).toBe(false);
  next.resolve();
  await second;
  await waiting;
  expect(settled).toBe(true);
  expect(get().bankRateHistoryLoading).toBe(false);
});

test('a cancelled preparation without a successor releases its flag and product waiter', async () => {
  const paint = deferred();
  jest.mocked(yieldToPaintFrames).mockReturnValueOnce(paint.promise);
  const { get, set } = store();
  const pending = prepareBankRateHistoryAfterPaint(set, get, sampleCore, sampleManifest);
  const waiting = waitForBankRateHistoryPreparation(get);
  set({ core: { ...sampleCore } });
  paint.resolve();
  await pending;
  await waiting;
  expect(prepareHistoricalBankRateHistory).not.toHaveBeenCalled();
  expect(get().bankRateHistoryLoading).toBe(false);
  expect(get().bankRateHistoryRevision).toBe(0);
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
  await new Promise(resolve => setTimeout(resolve, 0));
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
