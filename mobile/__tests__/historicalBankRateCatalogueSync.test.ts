import { prepareHistoricalBankRateHistory, decodeSavedHistoricalCatalogue, decodeSavedHistoricalCatalogueAsync } from '../src/data/historicalBankRateCatalogueSync';
import { upsertHistoricalCatalogueDay } from '../src/data/historicalBankRateCatalogueMerge';
import { availableHistoricalBankRateCatalogue, clearHistoricalBankRateCatalogue, missingHistoricalCatalogueDates } from '../src/data/historicalBankRateCatalogueStore';
import { cache } from '../src/data/cache';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import * as compression from '../src/data/historicalBankRateCatalogueCompression';
import { getBundledHistoricalBankRateCatalogueAsync } from '../src/data/bundledHistoricalBankRateCatalogue';
import type { HistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import type { DatesIndex } from '../src/data/datesIndex';
import type { PayloadRevisionHead } from '../src/data/payloadRevision';
import { integrateRbaCalendarIntoCore } from '../src/data/rbaOfficialLive';
import type { RbaCalendar } from '../src/data/rbaCalendar';

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
function compactLegacyManifest(day = '2026-09-27'): Manifest {
  const result = manifest(day);
  delete result.payload_revision;
  result.tag = 'app-payload-latest';
  const sha256 = 'd'.repeat(64), name = `bank-rate-history-catalogue-${day}-${sha256.slice(0, 12)}.json.gz`;
  result.bank_rate_history_catalogue = { schema_version: 1, file: { name, sha256, bytes: 123,
    url: `https://github.com/yanniedog/AR-local/releases/download/${result.tag}/${name}` } };
  return result;
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

test('a compact legacy core restores prior bundled public history offline without inventing a current edition', async () => {
  const current = core('2026-09-28'), edition = compactLegacyManifest(current.run_date), before = JSON.stringify(current);
  expect(await prepareHistoricalBankRateHistory(current, edition, null, details(current.run_date))).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-26')).toEqual([6]);
  expect(rates(history(current), '2026-09-27')).toEqual([]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-27']);
  expect(history(current).sources[current.run_date]).toBeUndefined();
  expect(history(current).run_dates).not.toContain(current.run_date);
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
  expect(JSON.stringify(current)).toBe(before);
  const prepared = history(current);
  const reads = jest.mocked(cache.readBankRateHistory).mock.calls.length;
  await prepareHistoricalBankRateHistory(current, edition, null, details(current.run_date));
  expect(history(current)).toBe(prepared);
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(reads);
});

test('legacy fallback retains dated feature evidence and excludes non-public baseline provenance', async () => {
  const known = mockBaseline.evidence.find(evidence => evidence.status === 'known');
  mockBaseline.sources['2026-09-26'] = { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 };
  const current = core('2026-09-27');
  expect(await prepareHistoricalBankRateHistory(current, compactLegacyManifest())).toBe(true);
  expect(history(current).evidence).toContainEqual(known);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-26')).toEqual([]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-26']);
});

test('a legacy fallback persists an index-only correction and does not resurrect its old observations offline', async () => {
  const current = core('2026-09-27'), edition = compactLegacyManifest(), corrected = mockIndex(current.run_date, true);
  expect(await prepareHistoricalBankRateHistory(current, edition, corrected)).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([]);
  expect(rates(history(current), '2026-09-26')).toEqual([6]);
  const saved = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(saved).toEqual({ schema_version: 3, core_bindings: {}, index: corrected });
  const restarted = core(current.run_date);
  expect(await prepareHistoricalBankRateHistory(restarted, edition)).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  expect(missingHistoricalCatalogueDates(restarted)).toEqual(['2026-09-25']);
  expect(await prepareHistoricalBankRateHistory(restarted, edition, mockIndex(current.run_date))).toBe(false);
  expect(availableHistoricalBankRateCatalogue(restarted)).toBeNull();
  const equivocated = mockIndex(current.run_date, true);
  equivocated.revision_heads!['2026-09-25'].bundle_sha256 = 'e'.repeat(64);
  expect(await prepareHistoricalBankRateHistory(restarted, edition, equivocated)).toBe(false);
  // The historical receipt cannot authorize this current immutable edition.
  expect(await prepareHistoricalBankRateHistory(core(current.run_date), manifest(current.run_date))).toBe(false);
});

test('a normal dates-only legacy index retains independent verified history and calendar gaps', async () => {
  const current = core('2026-09-28'), edition = compactLegacyManifest(current.run_date);
  const index: DatesIndex = { schema_version: 1, dates: ['2026-09-24', '2026-09-25', '2026-09-28'],
    count: 3, min_date: '2026-09-24', latest_date: current.run_date };
  expect(await prepareHistoricalBankRateHistory(current, edition, index)).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-26')).toEqual([6]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-24', '2026-09-27']);
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
  const corrected = mockIndex(current.run_date, true);
  await prepareHistoricalBankRateHistory(current, edition, corrected);
  const saved = mockCache;
  const restarted = core(current.run_date);
  expect(await prepareHistoricalBankRateHistory(restarted, edition, index)).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  expect(rates(history(restarted), '2026-09-26')).toEqual([6]);
  expect(mockCache).toBe(saved);
});

test('superseding every bundled date durably retains gaps with no fabricated core binding', async () => {
  const current = core('2026-09-27'), edition = compactLegacyManifest(), corrected = mockIndex(current.run_date, true);
  corrected.revision_heads!['2026-09-26'] = head('2026-09-26', 2);
  expect(await prepareHistoricalBankRateHistory(current, edition, corrected)).toBe(true);
  expect(history(current).sources).toEqual({});
  const saved = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(saved.core_bindings).toEqual({});
  expect(saved.public_fallback).toBeUndefined();
  const restarted = core(current.run_date);
  expect(await prepareHistoricalBankRateHistory(restarted, edition)).toBe(true);
  expect(history(restarted).sources).toEqual({});
  expect(missingHistoricalCatalogueDates(restarted)).toEqual(['2026-09-25', '2026-09-26']);
  const schema2 = { ...saved, schema_version: 2, catalogue: mockBaseline };
  expect(decodeSavedHistoricalCatalogue(JSON.stringify(compression.compressCatalogue(schema2)))).toBeNull();
  expect(decodeSavedHistoricalCatalogue(JSON.stringify(compression.compressCatalogue({ ...saved,
    producer_core_sha256: 'a'.repeat(64) })))).toBeNull();
});

test.each(['no capability', 'wrong repo', 'wrong date', 'unknown tag'])(
  'bundled fallback remains scoped away from unsupported legacy %s input', async kind => {
    const current = core('2026-09-27'), edition = compactLegacyManifest();
    if (kind === 'no capability') delete edition.bank_rate_history_catalogue;
    if (kind === 'wrong repo') edition.repo = 'untrusted/payload';
    if (kind === 'wrong date') edition.run_date = '2026-09-28';
    if (kind === 'unknown tag') edition.tag = 'other-release';
    expect(await prepareHistoricalBankRateHistory(current, edition)).toBe(false);
    expect(availableHistoricalBankRateCatalogue(current)).toBeNull();
    expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  },
);

test('legacy fallback restores a saved selected public correction without reusing another producer archive', async () => {
  const corrected = mockIndex('2026-09-27', true);
  const correctedDay = upsertHistoricalCatalogueDay(null, core('2026-09-25', '0.08'), details('2026-09-25'),
    { ...source('2026-09-25'), manifest_sha256: corrected.revision_heads!['2026-09-25'].manifest_sha256 });
  mockCache = JSON.stringify(compression.compressCatalogue({ schema_version: 3, core_bindings: {},
    index: corrected, public_fallback: correctedDay }));
  const current = core('2026-09-27');
  expect(await prepareHistoricalBankRateHistory(current, compactLegacyManifest())).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([8]);
  expect(rates(history(current), '2026-09-26')).toEqual([6]);
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
});

test.each(['embedded', 'detached'] as const)(
  'a successful partial legacy %s archive fills earlier verified dates and preserves independent producer rates', async location => {
    const current = core('2026-09-27'), edition = compactLegacyManifest(), packed = producerWithGap();
    // A dates-only list can itself omit older known public dates; it is not a
    // complete revision selection and must not trigger the old raw fast path.
    const datesOnly: DatesIndex = { schema_version: 1, dates: ['2026-09-26', current.run_date], count: 2,
      min_date: '2026-09-26', latest_date: current.run_date };
    const before = JSON.stringify(packed);
    if (location === 'embedded') current.bank_rate_history_catalogue = packed;
    expect(await prepareHistoricalBankRateHistory(current, edition, datesOnly, null,
      location === 'detached' ? packed : null)).toBe(true);
    expect(rates(history(current), '2026-09-25')).toEqual([5]);
    expect(rates(history(current), '2026-09-26')).toEqual([9]);
    expect(history(current).sources['2026-09-26']).toEqual(packed.sources['2026-09-26']);
    expect(history(current).sources[current.run_date]).toBeUndefined();
    expect(missingHistoricalCatalogueDates(current)).toEqual([]);
    expect(JSON.stringify(packed)).toBe(before);
  },
);

test.each(['bundled', 'saved', 'fresh'] as const)(
  'legacy public observations are reconciled against known %s heads, including complete archives', async authority => {
    const current = core('2026-09-27'), edition = compactLegacyManifest(), packed = structuredClone(mockBaseline);
    const corrected = mockIndex(current.run_date, true);
    if (authority === 'bundled') packed.sources['2026-09-25'] = { ...source('2026-09-25'), manifest_sha256: 'e'.repeat(64) };
    if (authority === 'saved') mockCache = JSON.stringify(compression.compressCatalogue({
      schema_version: 3, core_bindings: {}, index: corrected }));
    expect(await prepareHistoricalBankRateHistory(current, edition, authority === 'fresh' ? corrected : null, null, packed)).toBe(true);
    expect(rates(history(current), '2026-09-25')).toEqual(authority === 'bundled' ? [5] : []);
    expect(rates(history(current), '2026-09-26')).toEqual([6]);
    expect(missingHistoricalCatalogueDates(current)).toEqual(authority === 'bundled' ? [] : ['2026-09-25']);
    const restarted = core(current.run_date);
    expect(await prepareHistoricalBankRateHistory(restarted, edition, null, null, packed)).toBe(true);
    expect(rates(history(restarted), '2026-09-25')).toEqual(authority === 'bundled' ? [5] : []);
  },
);

test.each(['selected_contract', 'retained_legacy_export', 'published_core'] as const)(
  'legacy reconciliation preserves authentic %s dates beyond known selected public history', async kind => {
    const current = core('2026-09-29'), edition = compactLegacyManifest(current.run_date);
    const packed = upsertHistoricalCatalogueDay(null, core('2026-09-27', '0.07'), details('2026-09-27'), source('2026-09-27'));
    if (kind === 'selected_contract') packed.sources['2026-09-27'] = { kind, generation_id: 'new-independent',
      contract_digest: 'd'.repeat(64), banks_sha256: 'e'.repeat(64), bytes: 123 };
    if (kind === 'retained_legacy_export') packed.sources['2026-09-27'] = { kind, banks_sha256: 'e'.repeat(64), bytes: 123 };
    expect(await prepareHistoricalBankRateHistory(current, edition, null, null, packed)).toBe(true);
    expect(rates(history(current), '2026-09-25')).toEqual([5]);
    expect(rates(history(current), '2026-09-27')).toEqual([7.000000000000001]);
    expect(history(current).sources['2026-09-27']).toEqual(packed.sources['2026-09-27']);
    expect(missingHistoricalCatalogueDates(current)).toContain('2026-09-28');
    expect(history(current).sources[current.run_date]).toBeUndefined();
  },
);

test('a newer selected public observation in a legacy archive survives a later detached cache miss', async () => {
  const current = core('2026-09-28'), edition = compactLegacyManifest(current.run_date);
  const packed = upsertHistoricalCatalogueDay(null, core('2026-09-27', '0.07'), details('2026-09-27'), source('2026-09-27'));
  expect(await prepareHistoricalBankRateHistory(current, edition, mockIndex(current.run_date), null, packed)).toBe(true);
  expect(decodeSavedHistoricalCatalogue(mockCache)?.public_fallback?.sources['2026-09-27']).toEqual(source('2026-09-27'));
  const restarted = core(current.run_date);
  expect(await prepareHistoricalBankRateHistory(restarted, edition)).toBe(true);
  expect(rates(history(restarted), '2026-09-27')).toEqual([7.000000000000001]);
});

test.each(['selected_contract', 'published_core'] as const)(
  'complete legacy %s history avoids decoding a duplicate baseline and reuses its prepared result', async kind => {
    const current = core('2026-09-27'), edition = compactLegacyManifest();
    const packed = kind === 'selected_contract' ? rawProducer('2026-09-26', []) : mockBaseline;
    expect(await prepareHistoricalBankRateHistory(current, edition, null, null, packed)).toBe(true);
    expect(history(current)).toBe(packed);
    expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
    expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
    const reads = jest.mocked(cache.readBankRateHistory).mock.calls.length;
    expect(await prepareHistoricalBankRateHistory(current, edition, null, null, packed)).toBe(true);
    expect(cache.readBankRateHistory).toHaveBeenCalledTimes(reads);
  },
);

test('a selected public correction in a legacy archive wins over the older bundled edition and is durable', async () => {
  const current = core('2026-09-27'), edition = compactLegacyManifest(), corrected = mockIndex(current.run_date, true);
  const replacement = { ...source('2026-09-25'), manifest_sha256: corrected.revision_heads!['2026-09-25'].manifest_sha256 };
  const packed = upsertHistoricalCatalogueDay(mockBaseline, core('2026-09-25', '0.08'), details('2026-09-25'), replacement);
  expect(await prepareHistoricalBankRateHistory(current, edition, corrected, null, packed)).toBe(true);
  expect(rates(history(current), '2026-09-25')).toEqual([8]);
  expect(history(current).sources['2026-09-25']).toEqual(replacement);
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  expect(decodeSavedHistoricalCatalogue(mockCache)?.core_bindings).toEqual({});
  const restarted = core(current.run_date);
  expect(await prepareHistoricalBankRateHistory(restarted, edition)).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([8]);
});

test.each(['malformed', 'older latest date', 'rollback', 'equivocation'])(
  'rejected %s legacy selection cannot expose known superseded embedded public rates', async kind => {
    const current = core('2026-09-27'), edition = compactLegacyManifest(), corrected = mockIndex(current.run_date, true);
    const packed = structuredClone(mockBaseline);
    packed.sources['2026-09-26'] = { kind: 'retained_legacy_export', banks_sha256: 'e'.repeat(64), bytes: 123 };
    current.bank_rate_history_catalogue = packed;
    mockCache = JSON.stringify(compression.compressCatalogue({ schema_version: 3, core_bindings: {}, index: corrected }));
    const before = mockCache;
    const rejected = mockIndex(kind === 'older latest date' ? '2026-09-26' : current.run_date, kind !== 'rollback');
    if (kind === 'malformed') rejected.revision_protocol = 99 as 1;
    if (kind === 'equivocation') rejected.revision_heads!['2026-09-25'].bundle_sha256 = 'e'.repeat(64);
    expect(await prepareHistoricalBankRateHistory(current, edition, rejected)).toBe(true);
    expect(rates(history(current), '2026-09-25')).toEqual([]);
    expect(rates(history(current), '2026-09-26')).toEqual([6]);
    expect(history(current).sources['2026-09-26']).toEqual(packed.sources['2026-09-26']);
    expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-25']);
    expect(mockCache).toBe(before);
    expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
  },
);

test('a valid legacy archive remains usable if optional bundled decoding fails', async () => {
  const current = core('2026-09-27'), packed = producerWithGap();
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockRejectedValueOnce(new Error('unavailable bundle'));
  expect(await prepareHistoricalBankRateHistory(current, compactLegacyManifest(), null, null, packed)).toBe(true);
  expect(rates(history(current), '2026-09-26')).toEqual([9]);
  expect(missingHistoricalCatalogueDates(current)).toEqual(['2026-09-25']);
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
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

test('detached producer history installs without changing the verified core or loading the bundled archive', async () => {
  const current = core(), packed = rawProducer(current.run_date, []), before = JSON.stringify(current);
  expect(await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(), null, packed)).toBe(true);
  expect(history(current)).toBe(packed);
  expect(JSON.stringify(current)).toBe(before);
  expect(cache.readBankRateHistory).not.toHaveBeenCalled();
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  expect(missingHistoricalCatalogueDates(current)).toEqual([]);
});

test('a corrected detached archive replaces history even when core bytes are unchanged', async () => {
  const current = core(), first = producerWithGap(), next = producerWithGap('0.10');
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(), null, first);
  expect(rates(history(current), current.run_date)).toEqual([9]);
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(), null, next);
  expect(rates(history(current), current.run_date)).toEqual([10]);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(current.bank_rate_history_catalogue).toBeUndefined();
});

test('a complete detached public archive skips the duplicate bundled decode on first use and restart', async () => {
  const packed = structuredClone(mockBaseline);
  const current = core();
  expect(await prepareHistoricalBankRateHistory(current, manifest(), mockIndex(), null, packed)).toBe(true);
  expect(history(current)).toBe(packed);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  const checkpoint = compression.decompressCatalogue(JSON.parse(mockCache!)) as Record<string, unknown>;
  expect(checkpoint.public_fallback).toBeUndefined();
  const restarted = core();
  expect(await prepareHistoricalBankRateHistory(restarted, manifest(), mockIndex(), null, structuredClone(packed))).toBe(true);
  expect(history(restarted)).toEqual(packed);
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
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
  expect(getBundledHistoricalBankRateCatalogueAsync).toHaveBeenCalledTimes(1);
});

test('a producer with baseline-restorable gaps persists only revision receipts and never serializes either durable catalogue', async () => {
  const current = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  const encode = jest.spyOn(compression, 'compressCatalogueAsync');
  await prepareHistoricalBankRateHistory(current, manifest(), mockIndex());
  const checkpoint = encode.mock.calls[0][0] as Record<string, unknown>;
  expect(Object.keys(checkpoint).sort()).toEqual(['core_bindings', 'index', 'schema_version']);
  expect(checkpoint.schema_version).toBe(3);
  expect(rates(history(current), '2026-09-25')).toEqual([5]);
  expect(rates(history(current), '2026-09-26')).toEqual([9]);
  const restarted = { ...core(), bank_rate_history_catalogue: producerWithGap() };
  await prepareHistoricalBankRateHistory(restarted, manifest(), mockIndex());
  expect(history(restarted)).toEqual(history(current));
  expect(encode).toHaveBeenCalledTimes(1);
});

test.each(['catalogue', 'producer_core_sha256'])('a delta checkpoint rejects the legacy-only %s field', async field => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  const checkpoint = compression.decompressCatalogue(JSON.parse(mockCache!)) as Record<string, unknown>;
  checkpoint[field] = field === 'catalogue' ? mockBaseline : 'a'.repeat(64);
  const text = JSON.stringify(compression.compressCatalogue(checkpoint));
  expect(decodeSavedHistoricalCatalogue(text)).toBeNull();
  expect(await decodeSavedHistoricalCatalogueAsync(text)).toBeNull();
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
  saved!.schema_version = 2;
  saved!.catalogue = history(current);
  delete saved!.public_fallback;
  mockCache = JSON.stringify(compression.compressCatalogue(saved));
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date), mockIndex(current.run_date));
  const archive = decodeSavedHistoricalCatalogue(mockCache)!.public_fallback!;
  expect(archive.run_dates).toEqual([current.run_date]);
  expect(Object.keys(archive.sources)).toEqual([current.run_date]);
  expect(archive.sections.Mortgage).toHaveLength(1);
  expect(archive.sections.Mortgage[0].spans).toHaveLength(1);
  expect(archive.evidence).toHaveLength(2);
  const migrated = compression.decompressCatalogue(JSON.parse(mockCache!)) as Record<string, unknown>;
  expect(migrated.schema_version).toBe(3);
  expect(migrated.catalogue).toBeUndefined();
  expect(migrated.producer_core_sha256).toBeUndefined();
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

test('runtime delta recovery uses the cooperative codec and restores the baseline without serializing it again', async () => {
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
  expect(getBundledHistoricalBankRateCatalogueAsync).toHaveBeenCalledTimes(1);
  const saved = await decodeSavedHistoricalCatalogueAsync(mockCache);
  expect(decodeSavedHistoricalCatalogue(mockCache)).toBe(saved);
  expect(asyncInflate).toHaveBeenCalledTimes(1);
  expect(syncInflate).not.toHaveBeenCalled();
});

test('a compatible checkpoint with a baseline gap still loads the bundle to restore that selected date', async () => {
  const day = '2026-09-27';
  await prepareHistoricalBankRateHistory(core(day), manifest(day), mockIndex(day), details(day));
  const saved = compression.decompressCatalogue(JSON.parse(mockCache!)) as NonNullable<ReturnType<typeof decodeSavedHistoricalCatalogue>>;
  saved.schema_version = 2;
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

test('offline recovery uses the persisted exact index and verified details when the new core predates its history checkpoint', async () => {
  const previousDay = '2026-09-27', nextDay = '2026-09-28';
  await prepareHistoricalBankRateHistory(core(previousDay, '0.07'), manifest(previousDay), mockIndex(previousDay), details(previousDay));
  const oldCheckpoint = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(oldCheckpoint.index.latest_date).toBe(previousDay);
  expect(oldCheckpoint.core_bindings[nextDay]).toBeUndefined();

  // Core/manifest/index/details survived the interrupted adoption; no history
  // job ran for this edition before the simulated offline restart.
  const restarted = core(nextDay, '0.08'), originalRow = restarted.sections.Mortgage.rates[0];
  const persistedIndex = JSON.parse(JSON.stringify(mockIndex(nextDay))) as DatesIndex;
  expect(await prepareHistoricalBankRateHistory(restarted, manifest(nextDay), persistedIndex, details(nextDay))).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([5]);
  expect(rates(history(restarted), '2026-09-26')).toEqual([6]);
  expect(rates(history(restarted), previousDay)).toEqual([7.000000000000001]);
  expect(rates(history(restarted), nextDay)).toEqual([8]);
  expect(history(restarted).sources[previousDay]).toEqual(oldCheckpoint.public_fallback!.sources[previousDay]);
  expect(missingHistoricalCatalogueDates(restarted)).toEqual([]);
  expect(restarted.sections.Mortgage.rates[0]).toBe(originalRow);

  const recoveredCheckpoint = decodeSavedHistoricalCatalogue(mockCache)!;
  expect(recoveredCheckpoint.core_bindings[nextDay]).toEqual({ core_sha256: manifest(nextDay).files.core.sha256,
    manifest_sha256: persistedIndex.revision_heads![nextDay].manifest_sha256 });
  const secondRestart = core(nextDay, '0.08');
  expect(await prepareHistoricalBankRateHistory(secondRestart, manifest(nextDay))).toBe(true);
  expect(history(secondRestart)).toEqual(history(restarted));
});

test('a persisted historical correction takes effect after a crash even when the current selected head is unchanged', async () => {
  const day = '2026-09-27', edition = manifest(day), originalIndex = mockIndex(day);
  await prepareHistoricalBankRateHistory(core(day, '0.07'), edition, originalIndex, details(day));
  const persistedIndex = JSON.parse(JSON.stringify(mockIndex(day, true))) as DatesIndex;
  expect(persistedIndex.revision_heads![day]).toEqual(originalIndex.revision_heads![day]);
  const restarted = core(day, '0.07');
  expect(await prepareHistoricalBankRateHistory(restarted, edition, persistedIndex, details(day))).toBe(true);
  expect(rates(history(restarted), '2026-09-25')).toEqual([]);
  expect(rates(history(restarted), '2026-09-26')).toEqual([6]);
  expect(rates(history(restarted), day)).toEqual([7.000000000000001]);
  expect(missingHistoricalCatalogueDates(restarted)).toEqual(['2026-09-25']);
  expect(decodeSavedHistoricalCatalogue(mockCache)!.index.revision_heads!['2026-09-25']).toEqual(head('2026-09-25', 2));
  const secondRestart = core(day, '0.07');
  expect(await prepareHistoricalBankRateHistory(secondRestart, edition)).toBe(true);
  expect(rates(history(secondRestart), '2026-09-25')).toEqual([]);
  expect(await prepareHistoricalBankRateHistory(secondRestart, edition, originalIndex)).toBe(false);
  expect(availableHistoricalBankRateCatalogue(secondRestart)).toBeNull();
});

test('a persisted index removing a verified historical head cannot reuse the old checkpoint through an unchanged current head', async () => {
  const day = '2026-09-27', edition = manifest(day), originalIndex = mockIndex(day);
  await prepareHistoricalBankRateHistory(core(day), edition, originalIndex, details(day));
  const oldCheckpoint = mockCache, writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  const persistedIndex = JSON.parse(JSON.stringify(originalIndex)) as DatesIndex;
  persistedIndex.dates = persistedIndex.dates.filter(date => date !== '2026-09-25');
  persistedIndex.min_date = persistedIndex.dates[0]; persistedIndex.count = persistedIndex.dates.length;
  delete persistedIndex.revision_heads!['2026-09-25'];
  expect(persistedIndex.revision_heads![day]).toEqual(originalIndex.revision_heads![day]);
  const restarted = core(day);
  expect(await prepareHistoricalBankRateHistory(restarted, edition, persistedIndex, details(day))).toBe(false);
  expect(availableHistoricalBankRateCatalogue(restarted)).toBeNull();
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes);
  expect(mockCache).toBe(oldCheckpoint);
});

test('offline recovery rejects a persisted index selecting another current edition despite the same core digest', async () => {
  const previousDay = '2026-09-27', nextDay = '2026-09-28';
  await prepareHistoricalBankRateHistory(core(previousDay), manifest(previousDay), mockIndex(previousDay), details(previousDay));
  const oldCheckpoint = mockCache, writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  const persistedIndex = mockIndex(nextDay);
  persistedIndex.revision_heads![nextDay] = head(nextDay, 2);
  const restarted = core(nextDay);
  expect(await prepareHistoricalBankRateHistory(restarted, manifest(nextDay), persistedIndex, details(nextDay))).toBe(false);
  expect(availableHistoricalBankRateCatalogue(restarted)).toBeNull();
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes);
  expect(mockCache).toBe(oldCheckpoint);
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

test('consecutive identical verified preparations reuse the installed catalogue without cache IO or decoding', async () => {
  const current = core('2026-09-27'), edition = manifest(current.run_date), index = mockIndex(current.run_date);
  await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date));
  const first = history(current), reads = jest.mocked(cache.readBankRateHistory).mock.calls.length;
  const inflate = jest.spyOn(compression, 'decompressCatalogueAsync');
  const encode = jest.spyOn(compression, 'compressCatalogueAsync');
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockClear();
  await prepareHistoricalBankRateHistory(current, { ...edition }, JSON.parse(JSON.stringify(index)), details(current.run_date));
  expect(history(current)).toBe(first);
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(reads);
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(1);
  expect(inflate).not.toHaveBeenCalled(); expect(encode).not.toHaveBeenCalled();
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
  clearHistoricalBankRateCatalogue(current);
  await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date));
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(reads + 1);
  expect(history(current)).toEqual(first);
});

test('later verified details and same-core terms revisions invalidate the preparation shortcut', async () => {
  const current = core('2026-09-27'), edition = manifest(current.run_date), index = mockIndex(current.run_date);
  await prepareHistoricalBankRateHistory(current, edition, index);
  expect(history(current).sources[current.run_date]).toBeUndefined();
  await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date));
  expect(rates(history(current), current.run_date)).toEqual([6]);
  const revised = mockIndex(current.run_date); revised.revision_heads![current.run_date] = head(current.run_date, 2);
  await prepareHistoricalBankRateHistory(current, manifest(current.run_date, 'a'.repeat(64), 2), revised, details(current.run_date));
  expect(history(current).sources[current.run_date]).toEqual({ ...source(current.run_date), manifest_sha256: head(current.run_date, 2).manifest_sha256 });
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(3);
});

test('verified details arriving after an absent-details preparation persist the new evidence under the unchanged head', async () => {
  const day = '2026-09-27', current = core(day), edition = manifest(day), index = mockIndex(day);
  await prepareHistoricalBankRateHistory(current, edition, index);
  expect(decodeSavedHistoricalCatalogue(mockCache)!.public_fallback).toBeUndefined();
  const writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  await prepareHistoricalBankRateHistory(current, edition, index, details(day));
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes + 1);
  const archived = decodeSavedHistoricalCatalogue(mockCache)!.public_fallback!;
  const evidenceId = archived.sections.Mortgage[0].spans[0][3];
  expect(archived.evidence[evidenceId].status).toBe('known');
  const next = core('2026-09-28');
  await prepareHistoricalBankRateHistory(next, manifest(next.run_date), mockIndex(next.run_date));
  const restarted = core(next.run_date);
  await prepareHistoricalBankRateHistory(restarted, manifest(next.run_date));
  expect(rates(history(restarted), day)).toEqual([6]);
  expect(history(restarted).sources[day]).toEqual(source(day));
  expect(decodeSavedHistoricalCatalogue(mockCache)!.public_fallback!.evidence).toEqual(archived.evidence);
});

test('an explicit RBA-only wrapper reuses its historical owner without clearing or reading the cache', async () => {
  const current = core('2026-09-27'), edition = manifest(current.run_date), index = mockIndex(current.run_date);
  current.rba = [];
  await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date));
  const prepared = availableHistoricalBankRateCatalogue(current);
  const reads = jest.mocked(cache.readBankRateHistory).mock.calls.length;
  const writes = jest.mocked(cache.writeBankRateHistory).mock.calls.length;
  const replacement = integrateRbaCalendarIntoCore(current, {
    decisions: [{ date: '2026-09-01', outcome: 'hold', rate: 4.1 }],
  } as RbaCalendar);
  expect(replacement).not.toBe(current);
  expect(availableHistoricalBankRateCatalogue(replacement)).toBe(prepared);
  const inflate = jest.spyOn(compression, 'decompressCatalogueAsync');
  const encode = jest.spyOn(compression, 'compressCatalogueAsync');
  jest.mocked(getBundledHistoricalBankRateCatalogueAsync).mockClear();
  expect(await prepareHistoricalBankRateHistory(replacement, { ...edition }, JSON.parse(JSON.stringify(index)), details(current.run_date))).toBe(true);
  expect(availableHistoricalBankRateCatalogue(replacement)).toBe(prepared);
  expect(availableHistoricalBankRateCatalogue(current)).toBe(prepared);
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(reads);
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(writes);
  expect(inflate).not.toHaveBeenCalled(); expect(encode).not.toHaveBeenCalled();
  expect(getBundledHistoricalBankRateCatalogueAsync).not.toHaveBeenCalled();
});

test('an intervening different core advances historical revision checks before an earlier core can reuse history', async () => {
  const installed = core(), installedManifest = manifest(), original = mockIndex();
  await prepareHistoricalBankRateHistory(installed, installedManifest, original);
  await prepareHistoricalBankRateHistory(core('2026-09-27'), manifest('2026-09-27'), mockIndex('2026-09-27', true), details('2026-09-27'));
  expect(await prepareHistoricalBankRateHistory(installed, installedManifest, original)).toBe(false);
  expect(availableHistoricalBankRateCatalogue(installed)).toBeNull();
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(3);
});

test('failed preparation and failed persistence remain retryable on identical input', async () => {
  const current = core('2026-09-27'), edition = manifest(current.run_date), index = mockIndex(current.run_date);
  expect(await prepareHistoricalBankRateHistory(current, edition)).toBe(false);
  expect(await prepareHistoricalBankRateHistory(current, edition)).toBe(false);
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(2);
  jest.mocked(cache.writeBankRateHistory).mockRejectedValueOnce(new Error('Temporary storage failure'));
  expect(await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date))).toBe(true);
  expect(await prepareHistoricalBankRateHistory(current, edition, index, details(current.run_date))).toBe(true);
  expect(cache.readBankRateHistory).toHaveBeenCalledTimes(4);
  expect(cache.writeBankRateHistory).toHaveBeenCalledTimes(2);
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
