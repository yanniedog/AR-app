import captured from '../assets/sample/core.json';
import { revisionHead, revisionManifest } from '../testUtils/payloadRevision';
import { revisionTag } from '../src/data/payloadRevision';
import { historicalRevisionHighWater, historicalSourceIdentity } from '../src/data/historyIdentity';
import { downloadCore, fetchManifest } from '../src/data/payload';
import { mergeHistoryFromCores, syncHistoryFromDailyPayloads } from '../src/data/historyDaily';
import { normalizeHistoryBanksPayload, type HistoryBanksPayload } from '../src/data/historyPayload';
import { buildProductHistoryFromCores, normalizeProductHistoryPayload,
  syncProductHistoryFromDailyPayloads, type ProductHistoryPayload } from '../src/data/productHistory';
import type { CorePayload } from '../src/types';

jest.mock('../src/data/payload', () => ({ downloadCore: jest.fn(), fetchManifest: jest.fn() }));

// Revision/network controls around captured rates, not financial acceptance data.
const datedCore = captured as CorePayload;
const day = datedCore.run_date;
const today = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const currentCore = { ...datedCore, run_date: today };
const revisions = [1, 2, 3].map((revision) => revisionManifest(revision));
const currentHead = { ...revisionHead(revisions[0]),
  manifest_url: `https://github.com/${revisions[0].repo}/releases/download/${revisionTag(today, 1)}/manifest.json` };
const originalFetch = global.fetch;
const mockedDownload = jest.mocked(downloadCore);
const mockedManifest = jest.mocked(fetchManifest);

function index(revision: number, omitted = false) {
  const dates = omitted ? [today] : [day, today];
  return { schema_version: 1, revision_protocol: 1 as const, dates, count: dates.length,
    min_date: dates[0], latest_date: today,
    revision_heads: { ...(omitted ? {} : { [day]: revisionHead(revisions[revision - 1]) }), [today]: currentHead } };
}

function advertise(revision: number, omitted = false) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => index(revision, omitted) });
}

type Ledger = ProductHistoryPayload | HistoryBanksPayload;

function context(kind: 'product' | 'ribbon') {
  const cores = new Map([[day, datedCore], [today, currentCore]]);
  const source_identities = { [day]: historicalSourceIdentity(index(2), day), [today]: 'core:current' };
  if (kind === 'product') {
    return {
      original: { ...buildProductHistoryFromCores(cores, [day, today], today, undefined, 'current'), source_identities } as Ledger,
      normalize: normalizeProductHistoryPayload,
      sync: (existing: Ledger) => syncProductHistoryFromDailyPayloads({ targetRunDate: today,
        currentCore, coreSha: 'current', existing: existing as ProductHistoryPayload }),
    };
  }
  return {
    original: { ...mergeHistoryFromCores(null, cores, [day, today], today)!, source_identities } as Ledger,
    normalize: normalizeHistoryBanksPayload,
    sync: (existing: Ledger) => syncHistoryFromDailyPayloads({ targetRunDate: today,
      currentCore, coreSha: 'current', existing: existing as HistoryBanksPayload }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedManifest.mockImplementation(async (url) => {
    const manifest = revisions.find((entry) => revisionHead(entry).manifest_url === url);
    if (!manifest) throw new Error('Unexpected manifest request');
    return manifest;
  });
  mockedDownload.mockRejectedValue(new Error('Revision 3 download unavailable'));
});
afterEach(() => { global.fetch = originalFetch; });

test.each(['product', 'ribbon'] as const)('%s history rejects r1 after failed r3 and a cache round trip', async (kind) => {
  const test = context(kind);
  advertise(3);
  const failed = await test.sync(test.original);
  expect(failed.run_dates).toEqual([today]);
  expect(failed.source_identities?.[day]).toBeUndefined();
  const reloaded = test.normalize(JSON.parse(JSON.stringify(failed)))!;
  advertise(1);
  mockedDownload.mockResolvedValue({ core: datedCore } as Awaited<ReturnType<typeof downloadCore>>);
  if (kind === 'ribbon') await expect(test.sync(reloaded)).rejects.toThrow('stale');
  else expect((await test.sync(reloaded)).run_dates).toEqual([today]);
  expect(mockedManifest.mock.calls.map(([url]) => url)).toEqual([revisionHead(revisions[2]).manifest_url]);
  expect(mockedDownload).toHaveBeenCalledTimes(1);
  expect(reloaded.revision_high_water?.[day]).toBe(historicalSourceIdentity(index(2), day));

  advertise(3);
  const recovered = await test.sync(reloaded);
  expect(mockedDownload).toHaveBeenCalledTimes(2);
  expect(recovered.run_dates).toEqual([day, today]);
  expect(recovered.source_identities?.[day]).toBe(historicalSourceIdentity(index(3), day));
  expect(recovered.revision_high_water?.[day]).toBe(historicalSourceIdentity(index(3), day));
});

test.each(['product', 'ribbon'] as const)('%s history retains the barrier through an omitted date and raised floor', async (kind) => {
  const test = context(kind);
  advertise(3);
  const failed = await test.sync(test.original);
  advertise(1, true);
  const omitted = await test.sync(test.normalize(JSON.parse(JSON.stringify(failed)))!);
  const reloaded = test.normalize(JSON.parse(JSON.stringify(omitted)))!;
  expect(reloaded.run_dates).toEqual([today]);
  advertise(1);
  mockedDownload.mockResolvedValue({ core: datedCore } as Awaited<ReturnType<typeof downloadCore>>);
  if (kind === 'ribbon') await expect(test.sync(reloaded)).rejects.toThrow('stale');
  else expect((await test.sync(reloaded)).run_dates).toEqual([today]);
  expect(mockedDownload).toHaveBeenCalledTimes(1);
  expect(reloaded.revision_high_water?.[day]).toBe(historicalSourceIdentity(index(2), day));
});

test.each(['product', 'ribbon'] as const)('%s normalizer migrates out-of-axis revision markers without exposing dates', (kind) => {
  const test = context(kind);
  const migrated = test.normalize(JSON.parse(JSON.stringify({ ...test.original, run_dates: [today] })))!;
  expect(migrated.run_dates).toEqual([today]);
  expect(migrated.source_identities?.[day]).toBeUndefined();
  expect(migrated.revision_high_water?.[day]).toBe(historicalSourceIdentity(index(2), day));
  expect(migrated.revision_high_water?.[today]).toBeUndefined();
});

test('high-water merge advances monotonically and keeps the first identity on equal-revision conflicts', () => {
  const first = historicalSourceIdentity(index(1), day);
  const second = historicalSourceIdentity(index(2), day);
  const third = historicalSourceIdentity(index(3), day);
  expect(historicalRevisionHighWater({ [day]: second }, { [day]: first })).toEqual({ [day]: second });
  expect(historicalRevisionHighWater({ [day]: second }, { [day]: third })).toEqual({ [day]: third });
  expect(historicalRevisionHighWater({ [day]: second }, { [day]: `${second}changed` })).toEqual({ [day]: second });
});

test('high-water validation excludes core hashes, legacy dates, invalid calendar dates and unsafe revisions', () => {
  const valid = historicalSourceIdentity(index(2), day);
  for (const invalid of ['core:current', `legacy:${day}`, 'revision:0:a:b',
    'revision:9007199254740992:a:b', 'revision:2', 2, null]) {
    expect(historicalRevisionHighWater({ [day]: invalid })).toEqual({});
  }
  expect(historicalRevisionHighWater({ '2026-02-30': valid, 'not-a-date': valid })).toEqual({});
  expect(historicalRevisionHighWater(null, [], 'invalid')).toEqual({});
});
