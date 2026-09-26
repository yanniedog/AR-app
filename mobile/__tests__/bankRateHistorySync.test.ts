import { prepareBankRateHistory, decodeSavedBankRateHistory } from '../src/data/bankRateHistorySync';
import { mergePortableBankRateHistory, type PortableBankRateHistory } from '../src/data/portableBankRateHistory';
import { availableBankRateHistory, missingBankRateHistoryDates, packedBankRateSnapshots } from '../src/data/bankRateHistory';
import { bankRateScope } from '../src/data/bankRateOverview';
import { cache } from '../src/data/cache';
import { downloadDatedCore } from '../src/data/historyDaily';
import type { CorePayload, Manifest } from '../src/types';
import type { DatesIndex } from '../src/data/datesIndex';
import type { PayloadRevisionHead } from '../src/data/payloadRevision';

let mockBaseline: PortableBankRateHistory;
let mockCache: string | null = null;
jest.mock('../src/data/cache', () => ({ cache: {
  readBankRateHistory: jest.fn(async (decode: (text: string) => unknown) => mockCache === null ? null : decode(mockCache)),
  writeBankRateHistory: jest.fn(async (text: string) => { mockCache = text; }),
} }));
jest.mock('../src/data/historyDaily', () => ({ downloadDatedCore: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
jest.mock('../src/data/portableBankRateHistory', () => ({
  ...jest.requireActual('../src/data/portableBankRateHistory'),
  getBundledPortableBankRateHistory: () => mockBaseline,
}));
jest.mock('../src/data/portableBankRateHistory.snapshot.json', () => {
  const dates = ['2026-09-25', '2026-09-26'];
  return { core_sha256: 'a'.repeat(64), source_index: {
    schema_version: 1, revision_protocol: 1, dates, min_date: dates[0], latest_date: dates[1], count: 2,
    revision_heads: Object.fromEntries(dates.map((date, index) => [date, {
      revision: 1, generation_id: `generation-${date}-1`,
      manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${date}-r000001/manifest.json`,
      manifest_sha256: String(index + 1).repeat(64), bundle_sha256: 'b'.repeat(64),
    }])),
  } };
});

function head(date: string, revision = 1): PayloadRevisionHead {
  return { revision, generation_id: `generation-${date}-${revision}`,
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${date}-r${String(revision).padStart(6, '0')}/manifest.json`,
    manifest_sha256: (revision > 1 ? 'f' : String(Number(date.slice(-2)) - 24)).repeat(64),
    bundle_sha256: (revision > 1 ? 'c' : 'b').repeat(64) };
}
function index(last = '2026-09-26', corrected = false): DatesIndex {
  const dates = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'].filter(day => day <= last);
  return { schema_version: 1, revision_protocol: 1, dates, min_date: dates[0], latest_date: last, count: dates.length,
    revision_heads: Object.fromEntries(dates.map(day => [day, head(day, corrected && day === '2026-09-25' ? 2 : 1)])) };
}
function core(day = '2026-09-26', rate = '0.06'): CorePayload {
  return { run_date: day, sections: { Mortgage: { rates: [
    { provider: 'Bank', product_key: 'loan', product_name: 'Loan', rate_type: 'VARIABLE', rate },
  ] }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
}
function manifest(day = '2026-09-26', coreSha = 'a'.repeat(64), revision = 1): Manifest {
  const selected = head(day, revision), tag = `app-payload-${day}-r${String(revision).padStart(6, '0')}`;
  const prefix = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
  const asset = (name: string) => ({ name, url: prefix + name, sha256: 'a'.repeat(64), bytes: 123 });
  return { schema_version: 1, repo: 'yanniedog/AR-local', tag, run_date: day,
    payload_revision: { schema_version: 1, revision, parent_revision: revision > 1 ? revision - 1 : null,
      generation_id: selected.generation_id, bundle_sha256: selected.bundle_sha256 },
    files: { core: { ...asset('core.json.gz'), sha256: coreSha }, details: asset('details.json.gz') },
  } as Manifest;
}
function values(value: CorePayload) {
  return packedBankRateSnapshots(value, bankRateScope({ Mortgage: value.sections.Mortgage.rates, Savings: [], TD: [] }));
}
beforeEach(() => {
  jest.clearAllMocks(); mockCache = null;
  mockBaseline = mergePortableBankRateHistory(null, core('2026-09-25', '0.05'), head('2026-09-25').manifest_sha256);
  mockBaseline = mergePortableBankRateHistory(mockBaseline, core(), head('2026-09-26').manifest_sha256);
});

test('exact cached edition has complete offline history without network or a redundant baseline cache write', async () => {
  const value = core(), before = JSON.stringify(value);
  expect(await prepareBankRateHistory(value, manifest())).toBe(true);
  expect(Object.keys(values(value))).toEqual(['2026-09-25', '2026-09-26']);
  expect(values(value)['2026-09-25'].Mortgage!.Bank.mean).toBe(5);
  expect(JSON.stringify(value)).toBe(before);
  expect(downloadDatedCore).not.toHaveBeenCalled();
  await prepareBankRateHistory(value, manifest(), index());
  expect(cache.writeBankRateHistory).not.toHaveBeenCalled();
});

test('later catalogue loads only the intervening date and appends its own current rates; restart is offline', async () => {
  const value = core('2026-09-28', '0.08');
  jest.mocked(downloadDatedCore).mockResolvedValue(core('2026-09-27', '0.07'));
  expect(await prepareBankRateHistory(value, manifest(value.run_date), index(value.run_date))).toBe(true);
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
  expect(jest.mocked(downloadDatedCore).mock.calls[0][0]).toBe('2026-09-27');
  expect(Object.values(values(value)).map(day => day.Mortgage!.Bank.mean)).toEqual([5, 6, 7.000000000000001, 8]);
  expect(decodeSavedBankRateHistory(mockCache)).not.toBeNull();
  const restarted = core(value.run_date, '0.08');
  expect(await prepareBankRateHistory(restarted, manifest(value.run_date))).toBe(true);
  expect(Object.keys(values(restarted))).toHaveLength(4);
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
});

test('preparing a later edition preserves offline history for the installed core if adoption fails', async () => {
  const installed = core('2026-09-27', '0.07'), staged = core('2026-09-28', '0.08');
  const installedManifest = manifest(installed.run_date, 'b'.repeat(64));
  const stagedManifest = manifest(staged.run_date, 'c'.repeat(64));
  expect(await prepareBankRateHistory(installed, installedManifest, index(installed.run_date))).toBe(true);
  expect(await prepareBankRateHistory(staged, stagedManifest, index(staged.run_date))).toBe(true);
  const saved = decodeSavedBankRateHistory(mockCache)!;
  expect(saved.core_bindings[installed.run_date]).toEqual({ core_sha256: 'b'.repeat(64), manifest_sha256: head(installed.run_date).manifest_sha256 });
  expect(saved.core_bindings[staged.run_date]).toEqual({ core_sha256: 'c'.repeat(64), manifest_sha256: head(staged.run_date).manifest_sha256 });
  // Required details can fail after preparation but before writeBundle. The
  // next process still boots the installed Sep27 edition from disk.
  const restarted = core(installed.run_date, '0.07');
  expect(await prepareBankRateHistory(restarted, installedManifest)).toBe(true);
  expect(Object.keys(values(restarted))).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
  expect(values(restarted)['2026-09-25'].Mortgage!.Bank.mean).toBe(5);
  expect(values(restarted)['2026-09-27'].Mortgage!.Bank.mean).toBeCloseTo(7);
  // The bundled edition was never redundantly written, but its verified
  // binding remains usable too if the very first later adoption fails.
  expect(await prepareBankRateHistory(core(), manifest())).toBe(true);
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test.each(['terms-only', 'changed-core'])('a %s revision replaces its same-date binding and cannot admit the old edition', async revisionKind => {
  const day = '2026-09-27', oldManifest = manifest(day, 'b'.repeat(64));
  expect(await prepareBankRateHistory(core(day, '0.07'), oldManifest, index(day))).toBe(true);
  const correctedIndex = index(day);
  correctedIndex.revision_heads![day] = head(day, 2);
  const correctedSha = (revisionKind === 'terms-only' ? 'b' : 'c').repeat(64);
  const correctedRate = revisionKind === 'terms-only' ? '0.07' : '0.08';
  const correctedManifest = manifest(day, correctedSha, 2);
  expect(await prepareBankRateHistory(core(day, correctedRate), correctedManifest, correctedIndex)).toBe(true);
  expect(decodeSavedBankRateHistory(mockCache)!.core_bindings[day]).toEqual({
    core_sha256: correctedSha, manifest_sha256: head(day, 2).manifest_sha256,
  });
  const oldRestart = core(day, '0.07');
  expect(await prepareBankRateHistory(oldRestart, oldManifest)).toBe(false);
  expect(availableBankRateHistory(oldRestart)).toBeNull();
  const correctedRestart = core(day, correctedRate);
  expect(await prepareBankRateHistory(correctedRestart, correctedManifest)).toBe(true);
  expect(values(correctedRestart)[day].Mortgage!.Bank.mean).toBeCloseTo(Number(correctedRate) * 100);
});

test('a corrected selected date replaces the prior rate instead of mixing the two editions', async () => {
  const value = core();
  jest.mocked(downloadDatedCore).mockResolvedValue(core('2026-09-25', '0.09'));
  expect(await prepareBankRateHistory(value, manifest(), index(value.run_date, true))).toBe(true);
  expect(values(value)['2026-09-25'].Mortgage!.Bank).toMatchObject({ mean: 9, count: 1 });
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
  const restarted = core();
  await prepareBankRateHistory(restarted, manifest());
  expect(values(restarted)['2026-09-25'].Mortgage!.Bank.mean).toBe(9);
});

test('failed correction hides superseded rates, survives restart as a gap, and retries that date', async () => {
  const value = core();
  jest.mocked(downloadDatedCore).mockRejectedValue(new Error('offline'));
  expect(await prepareBankRateHistory(value, manifest(), index(value.run_date, true))).toBe(true);
  expect(values(value)['2026-09-25'].Mortgage).toEqual({});
  expect(missingBankRateHistoryDates(value)).toEqual(['2026-09-25']);
  const restarted = core();
  expect(await prepareBankRateHistory(restarted, manifest())).toBe(true);
  expect(values(restarted)['2026-09-25'].Mortgage).toEqual({});
  jest.mocked(downloadDatedCore).mockResolvedValue(core('2026-09-25', '0.09'));
  await prepareBankRateHistory(restarted, manifest(), index(value.run_date, true));
  expect(values(restarted)['2026-09-25'].Mortgage!.Bank.mean).toBe(9);
  expect(missingBankRateHistoryDates(restarted)).toEqual([]);
});

test('a stale index cannot roll back a previously verified historical correction', async () => {
  const value = core();
  jest.mocked(downloadDatedCore).mockResolvedValue(core('2026-09-25', '0.09'));
  await prepareBankRateHistory(value, manifest(), index(value.run_date, true));
  expect(await prepareBankRateHistory(core(), manifest(), index())).toBe(false);
  expect(downloadDatedCore).toHaveBeenCalledTimes(1);
});

test('a complete producer pack has priority and performs no fallback I/O', async () => {
  const value = core();
  value.sections.Mortgage.rates[0].bank_rate_tier = 0;
  value.bank_rate_history = { schema_version: 1, run_dates: ['2026-09-25', '2026-09-26'],
    row_tiers: { Mortgage: [0], Savings: [], TD: [] }, sections: { Mortgage: [[[0, 2, [6]]]], Savings: [], TD: [] } };
  expect(await prepareBankRateHistory(value, manifest(), index())).toBe(true);
  expect(availableBankRateHistory(value)).toBe(value.bank_rate_history);
  expect(cache.readBankRateHistory).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test('corrupt or oversized persisted envelopes are rejected', () => {
  expect(decodeSavedBankRateHistory('{')).toBeNull();
  expect(decodeSavedBankRateHistory(JSON.stringify({ payload: '{}', sha256: 'bad' }))).toBeNull();
});
