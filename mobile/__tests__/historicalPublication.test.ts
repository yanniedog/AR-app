import captured from '../assets/sample/core.json';
import type { CorePayload, Manifest } from '../src/types';
import { fetchManifest, downloadCore } from '../src/data/payload';
import { syncHistoryFromDailyPayloads } from '../src/data/historyDaily';
import { legacyPublicationIdentity } from '../src/data/historicalPublication';
import { HISTORY_DERIVATION_VERSION } from '../src/data/historyDerivation';
import { chartModelFromPrebuiltHistory } from '../src/data/historyPayload';
jest.mock('../src/data/payload', () => ({ fetchManifest: jest.fn(), downloadCore: jest.fn() }));
const day = captured.run_date, today = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const core = captured as CorePayload, current = { ...core, run_date: today };
const manifest = (hash: string) => ({ schema_version: 1, run_date: day, repo: 'yanniedog/AR-local', files: { core: { sha256: hash.repeat(64), bytes: 1, name: 'core.json.gz', url: 'https://example.test/core.json.gz' } } } as Manifest);
const originalFetch = global.fetch;
beforeEach(() => {
  jest.resetAllMocks(); global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ dates: [day, today] }) });
  jest.mocked(fetchManifest).mockResolvedValue(manifest('a'));
  jest.mocked(downloadCore).mockResolvedValue({ core } as Awaited<ReturnType<typeof downloadCore>>);
});
afterEach(() => { global.fetch = originalFetch; });
test('legacy selection refresh checks manifest each time; same identity reuses core but corrected core refetches', async () => {
  const opts = { targetRunDate: today, currentCore: current, coreSha: 'current' };
  const first = await syncHistoryFromDailyPayloads(opts);
  expect(first.source_identities?.[day]).toBe(legacyPublicationIdentity(day, manifest('a')));
  expect(first.derivation_version).toBe(HISTORY_DERIVATION_VERSION);
  const same = await syncHistoryFromDailyPayloads({ ...opts, existing: first });
  expect(fetchManifest).toHaveBeenCalledTimes(2); expect(downloadCore).toHaveBeenCalledTimes(1);
  jest.mocked(fetchManifest).mockResolvedValue(manifest('b'));
  const revised = await syncHistoryFromDailyPayloads({ ...opts, existing: same });
  expect(downloadCore).toHaveBeenCalledTimes(2); expect(revised.source_identities?.[day]).not.toBe(first.source_identities?.[day]);
  jest.mocked(fetchManifest).mockRejectedValue(new Error('offline'));
  const failed = await syncHistoryFromDailyPayloads({ ...opts, existing: revised });
  expect(failed.run_dates).toEqual([day, today]); expect(failed.date_status?.[day]).toBe('unavailable');
  expect(failed.sections.Mortgage?.points[0]).toMatchObject({ date: day, min: null, max: null, mean: null, count: 0 });
  expect(chartModelFromPrebuiltHistory(failed, 'Mortgage', 'All')?.points[0].mean).toBeNull();
});
test('parsed manifest identity is order-independent and does not claim raw byte identity', () => {
  const a = manifest('a'), reordered = { files: a.files, repo: a.repo, run_date: a.run_date, schema_version: a.schema_version } as Manifest;
  expect(legacyPublicationIdentity(day, a)).toBe(legacyPublicationIdentity(day, reordered));
  expect(legacyPublicationIdentity(day, a)).toMatch(/^legacy-content:/);
});
test('changed local derivation rebuilds same-source aggregate; verified missing section does not refetch core forever', async () => {
  const opts = { targetRunDate: today, currentCore: current, coreSha: 'current' };
  const first = await syncHistoryFromDailyPayloads(opts);
  jest.mocked(downloadCore).mockResolvedValue({ core: { ...core, sections: { ...core.sections, Mortgage: { ...core.sections.Mortgage, ribbon: { ...core.sections.Mortgage.ribbon, range: { min: null, max: null, mean: null, median: null } } } } } } as Awaited<ReturnType<typeof downloadCore>>);
  const updated = await syncHistoryFromDailyPayloads({ ...opts, existing: { ...first, derivation_version: 'old' } });
  expect(downloadCore).toHaveBeenCalledTimes(2); expect(updated.sections.Mortgage?.points[0].mean).toBeNull(); expect(updated.date_status?.[day]).toBe('verified');
  await syncHistoryFromDailyPayloads({ ...opts, existing: updated }); expect(downloadCore).toHaveBeenCalledTimes(2);
});
