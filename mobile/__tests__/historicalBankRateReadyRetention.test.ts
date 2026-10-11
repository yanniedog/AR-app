import * as compiler from '../contracts/history-ready/compiler-manifest.json';
import { compactPublicReadyHistory, decodeReadyHistoryArchive, decodeRetainedReadyHistory, encodeRetainedReadyHistory, needsRetainedReadyMigration, type RetainedReadyHistory } from '../src/data/historicalBankRateReadyRetention';
import * as codec from '../src/data/historicalBankRateCatalogueCompression';
import { historicalReadySnapshots } from '../src/data/historicalBankRateReady';
import type { HistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import { EMPTY_PROFILE } from '../src/data/profile';

const days = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'];
const sha = 'a'.repeat(64), tick = async () => {};
const source = { kind: 'published_core' as const, core_sha256: sha, details_sha256: sha, manifest_sha256: sha };
const heads = Object.fromEntries(days.map(day => [day, { revision: 2, generation_id: `sha256-${sha}`, bundle_sha256: sha,
  manifest_sha256: sha, manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${day}-r000002/manifest.json` }]));
function ready(rate = 5): HistoricalBankRateReady {
  return { schema_version: 1, semantic_revision: 'ar-history-ready-v1', compiler_sha256: compiler.sha256,
    run_dates: days, sources: Object.fromEntries(days.map(day => [day, source])), unavailable_dates: {}, quarantined_tier_count: 0,
    sections: { Mortgage: [['Bank', [null, null, null, null], false, false, 0, [[0, [[rate, 3]]], [4, [[rate, -3]]]]]], Savings: [], TD: [] },
    products: { Mortgage: [['product', [[0, 4, rate]]]], Savings: [], TD: [] } };
}
function snapshots(value: HistoricalBankRateReady) {
  const iterator = historicalReadySnapshots(value, { interests: ['Mortgage'], includeNonStandard: true, profileFilters: EMPTY_PROFILE });
  let result = iterator.next(); while (!result.done) result = iterator.next(); return result.value;
}
test('disjoint date masks merge exact cohort multiplicity and product values without expanding tiers', async () => {
  const first = ready(), second = ready(7), unchanged = JSON.stringify([first, second]);
  const retained = (await compactPublicReadyHistory([{ ready: first, acceptedDates: [days[0], days[2]] },
    { ready: second, acceptedDates: [days[1], days[3]] }], tick))!;
  expect(retained.sections.Mortgage).toHaveLength(1);
  const values = snapshots(retained);
  for (let i = 0; i < days.length; i++) expect(values[days[i]].Mortgage?.Bank).toEqual({ count: 3, min: i % 2 ? 7 : 5,
    max: i % 2 ? 7 : 5, median: i % 2 ? 7 : 5, mean: i % 2 ? 7 : 5 });
  expect(retained.products.Mortgage).toEqual([['product', [[0, 1, 5], [1, 1, 7], [2, 1, 5], [3, 1, 7]]]]);
  expect(JSON.stringify([first, second])).toBe(unchanged);
});
test('clipped axes preserve missing dates and merge adjacent equal product spans', async () => {
  const retained = (await compactPublicReadyHistory([{ ready: ready(), acceptedDates: [days[1], days[3]] }], tick))!;
  expect(retained.run_dates).toEqual(days.slice(1));
  expect(retained.unavailable_dates[days[2]]).toBeDefined();
  expect(snapshots(retained)[days[2]].Mortgage).toEqual({});
  const merged = (await compactPublicReadyHistory([{ ready: ready(), acceptedDates: days.slice(0, 2) }, { ready: ready(), acceptedDates: days.slice(2) }], tick))!;
  expect(merged.products.Mortgage).toEqual([['product', [[0, 4, 5]]]]);
  expect(merged.sections.Mortgage[0][5]).toEqual([[0, [[5, 3]]], [4, [[5, -3]]]]);
});
test('public-only masks reject duplicate ownership and independent producer sources', async () => {
  const value = ready();
  await expect(compactPublicReadyHistory([{ ready: value, acceptedDates: days }, { ready: value, acceptedDates: [days[0]] }], tick)).rejects.toThrow('disjoint');
  value.sources[days[0]] = { kind: 'retained_legacy_export', banks_sha256: sha, bytes: 100 };
  await expect(compactPublicReadyHistory([{ ready: value, acceptedDates: days }], tick)).rejects.toThrow('public');
});
test('compressed checkpoint restores exact data and keeps high-water on compiler upgrades', async () => {
  const value: RetainedReadyHistory = { schema_version: 1, ready: ready(), heads, conflicts: [] };
  const text = await encodeRetainedReadyHistory(value, tick);
  const restored = await decodeRetainedReadyHistory(text, tick);
  expect(restored).toEqual(value);
  expect(await decodeRetainedReadyHistory(text, tick)).toBe(restored);
  const changedCompiler = { ...value, ready: { ...value.ready!, compiler_sha256: 'f'.repeat(64) } };
  const upgraded = await decodeRetainedReadyHistory(await encodeRetainedReadyHistory(changedCompiler, tick), tick);
  expect(upgraded?.ready).toBeNull(); expect(upgraded?.heads).toEqual(heads);
  expect(await decodeRetainedReadyHistory(`${text.slice(0, -1)}x`, tick)).toBeNull();
});

test('whole verified public archive retains its object and exact compressed receipt without recompilation or encoding', async () => {
  const archive = codec.compressCatalogue(ready());
  const verified = (await decodeReadyHistoryArchive(archive, { yieldControl: tick }))!;
  const compacted = await compactPublicReadyHistory([{ ready: verified, acceptedDates: [...days].reverse() }], tick);
  expect(compacted).toBe(verified);
  const encode = jest.spyOn(codec, 'compressCatalogueAsync');
  try {
    const text = await encodeRetainedReadyHistory({ schema_version: 1, ready: compacted, heads, conflicts: [] }, tick);
    expect(encode).not.toHaveBeenCalled();
    const wire = JSON.parse(text);
    expect(wire.schema_version).toBe(2); expect(wire.ready).toEqual(archive);
    expect(await decodeRetainedReadyHistory(text, tick)).toEqual({ schema_version: 1, ready: verified, heads, conflicts: [] });
    expect(await decodeReadyHistoryArchive({ ...archive, sha256: 'f'.repeat(64) }, { yieldControl: tick })).toBeNull();
    expect(await decodeReadyHistoryArchive({ ...archive, bytes: 4 * 1024 * 1024 + 1 }, { yieldControl: tick })).toBeNull();
  } finally { encode.mockRestore(); }
});

test('legacy v1 checkpoint migrates to v2 while preserving exact public observations and receipts', async () => {
  const prior = { schema_version: 1 as const, ready: ready(), heads, conflicts: [] };
  const legacy = JSON.stringify(codec.compressCatalogue(prior));
  const restored = (await decodeRetainedReadyHistory(legacy, tick))!;
  expect(restored).toEqual(prior); expect(needsRetainedReadyMigration(restored)).toBe(true);
  const migrated = (await decodeRetainedReadyHistory(await encodeRetainedReadyHistory(restored, tick), tick))!;
  expect(migrated).toEqual(prior); expect(needsRetainedReadyMigration(migrated)).toBe(false);
});

test.each(['metadata', 'archive-sha', 'archive-size', 'head-source', 'conflict'])('v2 rejects malformed %s without poisoning the valid receipt memo', async defect => {
  const value = { schema_version: 1 as const, ready: ready(), heads, conflicts: [] };
  const text = await encodeRetainedReadyHistory(value, tick);
  const wire = JSON.parse(text);
  if (defect === 'metadata') wire.metadata.heads[days[0]].revision++;
  if (defect === 'archive-sha') wire.ready.sha256 = 'f'.repeat(64);
  if (defect === 'archive-size') wire.ready.bytes = 4 * 1024 * 1024 + 1;
  let malformed: string;
  if (defect === 'head-source') malformed = await encodeRetainedReadyHistory({ ...value,
    heads: { ...heads, [days[0]]: { ...heads[days[0]], manifest_sha256: 'f'.repeat(64) } } }, tick);
  else if (defect === 'conflict') malformed = await encodeRetainedReadyHistory({ ...value, conflicts: [days[0]] }, tick);
  else malformed = JSON.stringify(wire);
  expect(await decodeRetainedReadyHistory(malformed, tick)).toBeNull();
  expect(await decodeRetainedReadyHistory(text, tick)).toEqual(value);
});
