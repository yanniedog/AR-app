import { prepareHistoricalBankRateHistory, decodeSavedHistoricalCatalogue, decodeSavedHistoricalCatalogueAsync } from '../src/data/historicalBankRateCatalogueSync';
import { upsertHistoricalCatalogueDay } from '../src/data/historicalBankRateCatalogueMerge';
import { availableHistoricalBankRateCatalogue, missingHistoricalCatalogueDates } from '../src/data/historicalBankRateCatalogueStore';
import { cache } from '../src/data/cache';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import * as compression from '../src/data/historicalBankRateCatalogueCompression';
import { getBundledHistoricalBankRateCatalogueAsync } from '../src/data/bundledHistoricalBankRateCatalogue';
import type { HistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import type { DatesIndex } from '../src/data/datesIndex';
import type { PayloadRevisionHead } from '../src/data/payloadRevision';

let mockBaseline: HistoricalBankRateCatalogue;
let mockCache: string | null = null;
jest.mock('../src/data/cache', () => ({ cache: {
  readBankRateHistory: jest.fn(async (decode: (text: string) => unknown) => mockCache === null ? null : decode(mockCache)),
  writeBankRateHistory: jest.fn(async (text: string) => { mockCache = text; }),
} }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
jest.mock('../src/data/bundledHistoricalBankRateCatalogue', () => ({
  getBundledHistoricalBankRateCatalogue: () => mockBaseline,
  getBundledHistoricalBankRateCatalogueAsync: jest.fn(async () => mockBaseline),
  bundledHistoricalCatalogueBinding: { core_sha256: 'a'.repeat(64), get index() { return mockIndex(); } },
}));

function head(day: string, revision = 1): PayloadRevisionHead {
  return { revision, generation_id: `generation-${day}-${revision}`,
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${day}-r${String(revision).padStart(6, '0')}/manifest.json`,
    manifest_sha256: (revision > 1 ? 'f' : String(Number(day.slice(-2)) - 24)).repeat(64),
    bundle_sha256: (revision > 1 ? 'c' : 'b').repeat(64) };
}
function mockIndex(last = '2026-09-26', corrected = false): DatesIndex {
  const dates = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'].filter(day => day <= last);
  return { schema_version: 1, revision_protocol: 1, dates, min_date: dates[0], latest_date: last, count: dates.length,
    revision_heads: Object.fromEntries(dates.map(day => [day, head(day, corrected && day === '2026-09-25' ? 2 : 1)])) };
}
function core(day = '2026-09-26', rate = '0.06'): CorePayload {
  return { run_date: day, sections: { Mortgage: { rates: [{ provider: 'Bank', product_id: 'loan', product_key: 'Bank|loan',
    product_name: 'Ordinary loan', category: 'RESIDENTIAL_MORTGAGES', rate_type: 'VARIABLE', rate }] },
  Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
}
function manifest(day = '2026-09-26', coreSha = 'a'.repeat(64), revision = 1): Manifest {
  const selected = head(day, revision), tag = `app-payload-${day}-r${String(revision).padStart(6, '0')}`;
  const prefix = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
  const asset = (name: string) => ({ name, url: prefix + name, sha256: 'b'.repeat(64), bytes: 123 });
  return { schema_version: 1, repo: 'yanniedog/AR-local', tag, run_date: day,
    payload_revision: { schema_version: 1, revision, parent_revision: revision > 1 ? revision - 1 : null,
      generation_id: selected.generation_id, bundle_sha256: selected.bundle_sha256 },
    files: { core: { ...asset('core.json.gz'), sha256: coreSha }, details: asset('details.json.gz') },
  } as Manifest;
}
function details(day = '2026-09-26', sha = 'b'.repeat(64)): DetailsPayload {
  return bindVerifiedDetails({ schema_version: 1, run_date: day, products: { 'Bank|loan': { description: 'Ordinary retail mortgage.' } } }, sha);
}
const source = (day: string) => ({ kind: 'published_core' as const, core_sha256: 'a'.repeat(64),
  details_sha256: 'b'.repeat(64), manifest_sha256: head(day).manifest_sha256 });
const history = (value: CorePayload) => availableHistoricalBankRateCatalogue(value)!.catalogue;
const rates = (catalogue: HistoricalBankRateCatalogue, day: string) => {
  const position = catalogue.run_dates.indexOf(day);
  return catalogue.sections.Mortgage.flatMap(tier => tier.spans.flatMap(([start, count, values]) =>
    position >= start && position < start + count ? values : []));
};

beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); mockCache = null;
  mockBaseline = upsertHistoricalCatalogueDay(null, core('2026-09-25', '0.05'), details('2026-09-25'), source('2026-09-25'));
  mockBaseline = upsertHistoricalCatalogueDay(mockBaseline, core(), details(), source('2026-09-26'));
});

test('exact bundled edition is reusable offline without a duplicate cache write or current-row mutation', async () => {
  const current = core(), before = JSON.stringify(current);
  expect(await prepareHistoricalBankRateHistory(current, manifest())).toBe(true);
  expect(history(current)).toBe(mockBaseline);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(), details());
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
  expect(JSON.stringify(current)).toBe(before);
});

test('embedded verified raw producer catalogue wins without cache reads or supplementary persistence', async () => {
  const current = core(); current.bank_rate_history_catalogue = rawProducer(current.run_date, []);
  expect(await prepareHistoricalBankRateHistory(current, manifest(), mockIndex())).toBe(true);
  expect(history(current)).toBe(current.bank_rate_history_catalogue);
  expect(cache.readBankRateHistory).not.toHaveBeenCalled();
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
});

function producerWithGap(rate = '0.09'): HistoricalBankRateCatalogue {
  const value = upsertHistoricalCatalogueDay(null, core('2026-09-26', rate), details(), source('2026-09-26'));
  return { ...value, run_dates: ['2026-09-25', '2026-09-26'],
    sources: { '2026-09-26': { kind: 'selected_contract', generation_id: 'producer', contract_digest: 'c'.repeat(64), banks_sha256: 'd'.repeat(64), bytes: 100 } },
    unavailable_dates: { '2026-09-25': 'historical_selection_unresolved' },
    sections: { ...value.sections, Mortgage: value.sections.Mortgage.map(tier => ({ ...tier, spans: [[1, 1, tier.spans[0][2], tier.spans[0][3]]] })) },
  };
}

function rawProducer(last: string, missing: string[]): HistoricalBankRateCatalogue {
  const dates = mockIndex(last).dates;
  let value: HistoricalBankRateCatalogue | null = null;
  for (const day of dates) if (!missing.includes(day)) {
    value = upsertHistoricalCatalogueDay(value, core(day, `0.${day.slice(-2)}`), details(day), source(day));
  }
  const shift = dates.indexOf(value!.run_dates[0]);
  return { ...value!, run_dates: dates,
    sources: Object.fromEntries(Object.keys(value!.sources).map(day => [day, { kind: 'selected_contract',
      generation_id: `raw-${day}`, contract_digest: 'c'.repeat(64), banks_sha256: 'd'.repeat(64), bytes: 100 }])),
    unavailable_dates: Object.fromEntries(missing.map(day => [day, 'historical_selection_unresolved'])),
    sections: { ...value!.sections, Mortgage: value!.sections.Mortgage.map(tier => ({ ...tier,
      spans: tier.spans.map(([start, count, values, evidenceId]) => [start + shift, count, values, evidenceId]),
    })) },
  };
}

test('a producer gap retains independently selected public history and its exact offline edition', async () => {
  const current = core(), packed = producerWithGap(), before = JSON.stringify(packed);
  current.bank_rate_history_catalogue = packed;
  const edition = manifest(current.run_date, 'e'.repeat(64));
  expect(await prepareHistoricalBankRateHistory(current, edition, mockIndex())).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-26')).toEqual([9]);
  expect(history(current).sources['2026-09-25']).toEqual(source('2026-09-25'));
  expect(history(current).sources['2026-09-26'].kind).toBe('selected_contract');
  expect(JSON.stringify(packed)).toBe(before);
  expect(missingHistoricalCatalogueDates(current)).toEqual([]);
  const restarted = { ...core(), bank_rate_history_catalogue: JSON.parse(before) };
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockClear();
  expect(await prepareHistoricalBankRateHistory(restarted, edition)).toBe(true);
  expect(history(restarted)).toEqual(history(current));
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
});

test('an older overlay cannot replace observations in a new producer edition', async () => {
  const current = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex());
  const next = { ...core(), bank_rate_history_catalogue: producerWithGap('0.10') };
  const selected = mockIndex(); selected.revision_heads!['2026-09-26'] = head('2026-09-26', 2);
  expect(await prepareHistoricalBankRateHistory(next, manifest(next.run_date, 'e'.repeat(64), 2), selected)).toBe(true);
  expect(rates(history(next), '2026-09-25')).toEqual([5]);
  expect(rates(history(next), '2026-09-26')).toEqual([10]);
});

test('a changed public identity invalidates a producer overlay without resurrecting it offline', async () => {
  const current = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  const edition = manifest(current.run_date, 'e'.repeat(64));
  await prepareHistoricalBankRateHistory(current, edition, mockIndex());
  expect(await prepareHistoricalBankRateHistory(current, edition, mockIndex(current.run_date, true))).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-25']);
  const restarted = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  await prepareHistoricalBankRateHistory(restarted, edition);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  await prepareHistoricalBankRateHistory(restarted, edition, mockIndex());
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
});

test('complete embedded public history honors fresh corrections and cannot resurrect them through an offline restart or rollback', async () => {
  const packed = JSON.stringify(mockBaseline);
  const current = { ...core(), bank_rate_history_catalogue: JSON.parse(packed) };
  const edition = manifest(current.run_date, 'e'.repeat(64));
  await prepareHistoricalBankRateHistory(current, edition, mockIndex(current.run_date, true));
  expect(rates(history(current), '2026-09-25')).toEqual([]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-25']);
  const restarted = { ...core(), bank_rate_history_catalogue: JSON.parse(packed) };
  await prepareHistoricalBankRateHistory(restarted, edition);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  await prepareHistoricalBankRateHistory(restarted, edition, mockIndex());
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  expect(missingHistoricalCatalogueDates(restarted)).toEqual(['2026-09-25']);
  expect(JSON.stringify(current.bank_rate_history_catalogue)).toBe(packed);
});

test('without a selected edition or exact cached binding, producer blanks remain unknown', async () => {
  const current = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  expect(await prepareHistoricalBankRateHistory(current, manifest(current.run_date, 'e'.repeat(64)))).toBe(true);
  expect(history(current)).toBe(current.bank_rate_history_catalogue);
  expect(rates(history(current), '2026-09-25')).toEqual([]);
});

test('removing a selected date cannot leave a previous public overlay visible on the same core', async () => {
  const current = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex());
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  const selected = mockIndex(); selected.dates = ['2026-09-26'];
  delete selected.revision_heads!['2026-09-25'];
  await prepareHistoricalBankRateHistory(current, manifest(), selected);
  expect(history(current)).toBe(current.bank_rate_history_catalogue);
  expect(rates(history(current), '2026-09-25')).toEqual([]);
});

test('offline restart retains an overlaid public date newer than the bundled index', async () => {
  const legacy = core('2026-09-27', '0.07');
  await prepareHistoricalBankRateHistory(legacy, manifest(legacy.run_date), mockIndex(legacy.run_date), details(legacy.run_date));
  const next = core('2026-09-28', '0.08');
  const packed = upsertHistoricalCatalogueDay(mockBaseline, next, details(next.run_date), source(next.run_date));
  packed.unavailable_dates['2026-09-27'] = 'historical_selection_unresolved';
  const current = { ...next, bank_rate_history_catalogue: packed };
  const edition = manifest(current.run_date, 'e'.repeat(64));
  await prepareHistoricalBankRateHistory(current, edition, mockIndex(current.run_date));
  expect(rates(history(current), '2026-09-27')).toEqual([7.000000000000001]);
  const restarted = { ...core(current.run_date), bank_rate_history_catalogue: JSON.parse(JSON.stringify(packed)) };
  await prepareHistoricalBankRateHistory(restarted, edition);
  expect(rates(history(restarted), '2026-09-27')).toEqual([7.000000000000001]);
});

test('a newer staged raw producer cannot erase the public overlay needed by the older installed core', async () => {
  const day = '2026-09-27', publicCore = core(day, '0.07');
  await prepareHistoricalBankRateHistory(publicCore, manifest(day), mockIndex(day), details(day));
  const installed = { ...core('2026-09-28'), bank_rate_history_catalogue: rawProducer('2026-09-28', [day]) };
  const installedManifest = manifest(installed.run_date, 'e'.repeat(64));
  await prepareHistoricalBankRateHistory(installed, installedManifest, mockIndex(installed.run_date));
  const publicTier = history(installed).sections.Mortgage[0];
  const publicEvidence = history(installed).evidence[publicTier.spans.find(([start, count]) =>
    history(installed).run_dates.indexOf(day) >= start && history(installed).run_dates.indexOf(day) < start + count)![3]];
  const staged = { ...core('2026-09-29'), bank_rate_history_catalogue: rawProducer('2026-09-29', ['2026-09-25']) };
  const stagedManifest = manifest(staged.run_date, 'd'.repeat(64));
  await prepareHistoricalBankRateHistory(staged, stagedManifest, mockIndex(staged.run_date));
  expect(history(staged).sources[day].kind).toBe('selected_contract');
  expect(rates(history(staged), day)).toEqual([27]);
  const saved = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(saved.public_fallback!.sources[day]).toEqual(source(day));
  expect(saved.public_fallback!.evidence[saved.public_fallback!.sections.Mortgage[0].spans[0][3]]).toEqual(publicEvidence);
  expect(saved.core_bindings[installed.run_date].core_sha256).toBe(installedManifest.files.core.sha256);
  const writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  await prepareHistoricalBankRateHistory(staged, stagedManifest, mockIndex(staged.run_date));
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes);
  const restarted = { ...core(installed.run_date), bank_rate_history_catalogue: JSON.parse(JSON.stringify(installed.bank_rate_history_catalogue)) };
  await prepareHistoricalBankRateHistory(restarted, installedManifest);
  expect(history(restarted).sources[day]).toEqual(source(day));
  expect(rates(history(restarted), day)).toEqual([7.000000000000001]);
  expect(missingHistoricalCatalogueDates(restarted)).toEqual([]);
});

test('a corrected public head removes its archived edition before an older producer reopens offline', async () => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  const installed = { ...core('2026-09-28'), bank_rate_history_catalogue: rawProducer('2026-09-28', [day]) };
  const edition = manifest(installed.run_date, 'e'.repeat(64));
  await prepareHistoricalBankRateHistory(installed, edition, mockIndex(installed.run_date));
  const staged = { ...core('2026-09-29'), bank_rate_history_catalogue: rawProducer('2026-09-29', ['2026-09-25']) };
  const corrected = mockIndex(staged.run_date); corrected.revision_heads![day] = head(day, 2);
  await prepareHistoricalBankRateHistory(staged, manifest(staged.run_date, 'd'.repeat(64)), corrected);
  expect(decodeSavedHistoricalCatalogue(mockCache)!.public_fallback).toBeUndefined();
  const restarted = { ...core(installed.run_date), bank_rate_history_catalogue: JSON.parse(JSON.stringify(installed.bank_rate_history_catalogue)) };
  await prepareHistoricalBankRateHistory(restarted, edition);
  expect(history(restarted).sources[day]).toBeUndefined();
  expect(missingHistoricalCatalogueDates(restarted)).toEqual([day]);
  await prepareHistoricalBankRateHistory(restarted, edition, mockIndex(installed.run_date));
  expect(history(restarted).sources[day]).toBeUndefined();
});

test('the public archive clips baseline-only rows and dates and migrates legacy caches without repeated writes', async () => {
  const original = mockBaseline.sections.Mortgage[0];
  mockBaseline = { ...mockBaseline, sections: { ...mockBaseline.sections, Mortgage: [...mockBaseline.sections.Mortgage,
    { row: { ...original.row, product_id: 'retired', product_key: 'Bank|retired' }, spans: [[0, 1, [4], 0]] }] } };
  const current = core('2026-09-27');
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), details(current.run_date));
  const saved = compression.decompressCatalogue(JSON.parse(mockCache!)) as ReturnType<typeof decodeSavedHistoricalCatalogue>;
  delete saved!.public_fallback;
  mockCache = JSON.stringify(compression.compressCatalogue(saved));
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date));
  const archive = decodeSavedHistoricalCatalogue(mockCache)!.public_fallback!;
  expect(archive.run_dates).toEqual([current.run_date]);
  expect(Object.keys(archive.sources)).toEqual([current.run_date]);
  expect(archive.sections.Mortgage).toHaveLength(1);
  expect(archive.sections.Mortgage[0].spans).toHaveLength(1);
  expect(archive.evidence).toHaveLength(2);
  expect(JSON.parse(mockCache!).bytes).toBeLessThan(12_000);
  const writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  const compress = jest.spyOn(compression, 'compressCatalogue');
  const compressAsync = jest.spyOn(compression, 'compressCatalogueAsync');
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date));
  expect(decodeSavedHistoricalCatalogue(mockCache)!.public_fallback).toBe(archive);
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes);
  expect(compress).not.toHaveBeenCalled();
  expect(compressAsync).not.toHaveBeenCalled();
});

test.each(['raw source', 'stale head', 'invalid span', 'oversized calendar'])('a compressed public archive rejects %s', async kind => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  const saved = compression.decompressCatalogue(JSON.parse(mockCache!)) as NonNullable<ReturnType<typeof decodeSavedHistoricalCatalogue>>;
  const archive = saved.public_fallback!;
  if (kind === 'raw source') archive.sources[day] = { kind: 'retained_legacy_export', banks_sha256: 'c'.repeat(64), bytes: 10 };
  if (kind === 'stale head' && archive.sources[day].kind === 'published_core') archive.sources[day].manifest_sha256 = 'f'.repeat(64);
  if (kind === 'invalid span') archive.sections.Mortgage[0].spans[0][1] = 2;
  if (kind === 'oversized calendar') archive.run_dates = Array.from({ length: 5001 }, (_, index) =>
    new Date(Date.parse(day) + index * 86_400_000).toISOString().slice(0, 10));
  const text = JSON.stringify(compression.compressCatalogue(saved));
  expect(decodeSavedHistoricalCatalogue(text)).toBeNull();
  expect(await decodeSavedHistoricalCatalogueAsync(text)).toBeNull();
});

test('runtime checkpoint recovery uses the cooperative codec and shares the validated object with synchronous readers', async () => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  mockCache += ' ';
  const syncInflate = jest.spyOn(compression, 'decompressCatalogue');
  const asyncInflate = jest.spyOn(compression, 'decompressCatalogueAsync');
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockClear();
  const restarted = core(day);
  await prepareHistoricalBankRateHistory(restarted, manifest(day));
  expect(rates(history(restarted), day)).toEqual([6]);
  expect(asyncInflate).toHaveBeenCalledTimes(1);
  expect(syncInflate).not.toHaveBeenCalled();
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  const saved = await decodeSavedHistoricalCatalogueAsync(mockCache);
  expect(decodeSavedHistoricalCatalogue(mockCache)).toBe(saved);
  expect(asyncInflate).toHaveBeenCalledTimes(1);
  expect(syncInflate).not.toHaveBeenCalled();
});

test('a compatible checkpoint with a baseline gap still loads the bundle to restore that selected date', async () => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  const saved = compression.decompressCatalogue(JSON.parse(mockCache!)) as NonNullable<ReturnType<typeof decodeSavedHistoricalCatalogue>>;
  saved.catalogue = upsertHistoricalCatalogueDay(null, core(day), details(day), source(day));
  mockCache = JSON.stringify(compression.compressCatalogue(saved));
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockClear();
  const restarted = core(day);
  await prepareHistoricalBankRateHistory(restarted, manifest(day));
  expect(getBundledHistoricalBankRateCatalogueAsync).toHaveBeenCalledTimes(1);
  expect(rates(history(restarted), '2026-09-25')).toEqual([5]);
  expect(rates(history(restarted), '2026-09-26')).toEqual([6]);
  expect(rates(history(restarted), day)).toEqual([6]);
});

test('a later core adds only today, exposes missing dates, and reopens its compressed catalogue offline', async () => {
  const current = core('2026-09-28', '0.08');
  expect(await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), details(current.run_date))).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-28')).toEqual([8]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-27']);
  expect(JSON.parse(mockCache!).gzip_base64).toEqual(expect.any(String));
  expect(JSON.parse(mockCache!).payload).toBeUndefined();
  const restarted = core(current.run_date, '0.08');
  expect(await prepareHistoricalBankRateHistory(restarted, manifest(current.run_date))).toBe(true);
  expect(history(restarted)).toEqual(history(current));
  expect(missingHistoricalCatalogueDates(restarted)).toEqual(['2026-09-27']);
});

test.each(['unbound', 'wrong date', 'wrong digest', 'absent'])('current-day history rejects %s details provenance', async kind => {
  const current = core('2026-09-27', '0.07');
  const candidate = kind === 'absent' ? null : kind === 'wrong date' ? details() : kind === 'wrong digest' ? details(current.run_date, 'c'.repeat(64)) :
    { ...details(current.run_date) };
  expect(await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), candidate)).toBe(true);
  expect(history(current).sources[current.run_date]).toBeUndefined();
  expect(rates(history(current), current.run_date)).toEqual([]);
});

test('staging a newer catalogue preserves the installed older date binding if adoption fails', async () => {
  const installed = core('2026-09-27', '0.07'), staged = core('2026-09-28', '0.08');
  const installedManifest = manifest(installed.run_date, 'b'.repeat(64));
  await prepareHistoricalBankRateHistory(installed, installedManifest, mockIndex(installed.run_date), details(installed.run_date));
  await prepareHistoricalBankRateHistory(staged, manifest(staged.run_date, 'c'.repeat(64)), mockIndex(staged.run_date), details(staged.run_date));
  const saved = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(Object.keys(saved.core_bindings)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
  const restarted = core(installed.run_date, '0.07');
  expect(await prepareHistoricalBankRateHistory(restarted, installedManifest)).toBe(true);
  expect(rates(history(restarted), installed.run_date)).toEqual([7.000000000000001]);
});

test('a legacy core restores only public observations after a different raw producer is staged', async () => {
  const installed = core('2026-09-27', '0.07'), installedManifest = manifest(installed.run_date);
  await prepareHistoricalBankRateHistory(installed, installedManifest, mockIndex(installed.run_date), details(installed.run_date));
  const staged = { ...core('2026-09-28'), bank_rate_history_catalogue: rawProducer('2026-09-28', ['2026-09-25']) };
  await prepareHistoricalBankRateHistory(staged, manifest(staged.run_date, 'e'.repeat(64)), mockIndex(staged.run_date));
  expect(rates(history(staged), '2026-09-26')).toEqual([26]);
  const restarted = core(installed.run_date, '0.07');
  await prepareHistoricalBankRateHistory(restarted, installedManifest);
  expect(rates(history(restarted), '2026-09-25')).toEqual([5]);
  expect(rates(history(restarted), '2026-09-26')).toEqual([6]);
  expect(rates(history(restarted), '2026-09-27')).toEqual([7.000000000000001]);
  expect(Object.values(history(restarted).sources).every(value => value.kind === 'published_core')).toBe(true);
});

test('historical public-core corrections become persisted gaps and an older selected index cannot resurrect them', async () => {
  const current = core();
  expect(await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(current.run_date, true), details())).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-25']);
  const restarted = core();
  expect(await prepareHistoricalBankRateHistory(restarted, manifest())).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  expect(await prepareHistoricalBankRateHistory(restarted, manifest(), mockIndex())).toBe(false);
  expect(availableHistoricalBankRateCatalogue(restarted)).toBeNull();
});

test('producer contract provenance stays independent of older public-core revisions', async () => {
  mockBaseline = { ...mockBaseline, sources: { ...mockBaseline.sources,
    '2026-09-25': { kind: 'selected_contract', generation_id: 'canonical', contract_digest: 'c'.repeat(64), banks_sha256: 'd'.repeat(64), bytes: 123 } } };
  const current = core();
  expect(await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(current.run_date, true))).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(missingHistoricalCatalogueDates(current)).toEqual([]);
});

test('an equal-number historical revision with a different verified identity is rejected', async () => {
  const current = core();
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(current.run_date, true));
  const equivocated = mockIndex(current.run_date, true);
  equivocated.revision_heads!['2026-09-25'].bundle_sha256 = 'd'.repeat(64);
  expect(await prepareHistoricalBankRateHistory(current, manifest(), equivocated)).toBe(false);
  expect(availableHistoricalBankRateCatalogue(current)).toBeNull();
});

test.each(['terms-only', 'changed core'])('same-date %s revision replaces its old binding and observation', async kind => {
  const day = '2026-09-27', current = core(day, '0.07'), previous = manifest(day);
  await prepareHistoricalBankRateHistory(current, previous, mockIndex(day), details(day));
  const revisedIndex = mockIndex(day); revisedIndex.revision_heads![day] = head(day, 2);
  const nextManifest = manifest(day, kind === 'terms-only' ? 'a'.repeat(64) : 'c'.repeat(64), 2);
  const next = core(day, '0.08');
  expect(await prepareHistoricalBankRateHistory(next, nextManifest, revisedIndex, details(day))).toBe(true);
  expect(rates(history(next), day)).toEqual([8]);
  expect(await prepareHistoricalBankRateHistory(core(day), previous)).toBe(false);
  expect(await prepareHistoricalBankRateHistory(core(day), nextManifest)).toBe(true);
});

test('repeated saved-checkpoint reads reuse one decoded object and up-to-date refresh avoids inflation or rewrite', async () => {
  const current = core('2026-09-27');
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), details(current.run_date));
  const inflate = jest.spyOn(compression, 'decompressCatalogue');
  const first = decodeSavedHistoricalCatalogue(mockCache);
  expect(decodeSavedHistoricalCatalogue(mockCache)).toBe(first);
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), details(current.run_date));
  expect(inflate).not.toHaveBeenCalled();
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(1);
});

test('old numerical envelopes, invalid compression and mismatched edition bindings are rejected', async () => {
  expect(decodeSavedHistoricalCatalogue('{"sha256":"old","payload":"{}"}')).toBeNull();
  expect(decodeSavedHistoricalCatalogue('{broken')).toBeNull();
  const current = core('2026-09-27');
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date), details(current.run_date));
  const saved = compression.decompressCatalogue(JSON.parse(mockCache!)) as { core_bindings: Record<string, { manifest_sha256: string }> };
  saved.core_bindings[current.run_date].manifest_sha256 = 'f'.repeat(64);
  expect(decodeSavedHistoricalCatalogue(JSON.stringify(compression.compressCatalogue(saved)))).toBeNull();
});
