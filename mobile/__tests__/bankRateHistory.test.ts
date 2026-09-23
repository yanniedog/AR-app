import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadBankRateHistory } from '../src/data/bankRateHistory';
import { bankRateScope } from '../src/data/bankRateOverview';
import { downloadDatedCore, fetchDatesIndexJson } from '../src/data/historyDaily';
import { resolveDatedPublication } from '../src/data/historicalPublication';
import type { CorePayload, RateRow } from '../src/types';
jest.mock('../src/data/historyDaily', () => ({ fetchDatesIndexJson: jest.fn(), downloadDatedCore: jest.fn(), historyDatesUpTo: (index: { dates: string[] }) => index.dates }));
jest.mock('../src/data/historicalPublication', () => ({ resolveDatedPublication: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
const row: RateRow = { provider: 'Alpha', product_key: 'a', product_name: 'Loan', rate: '0.06' };
const scope = bankRateScope({ Mortgage: [row], Savings: [], TD: [] });
const core = { sections: { Mortgage: { rates: [row] }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: ['2026-09-20', '2026-09-21'] });
  (resolveDatedPublication as jest.Mock).mockImplementation(async (date: string) => ({ identity: `legacy-content:${date}:a`, manifest: {} }));
  (downloadDatedCore as jest.Mock).mockResolvedValue(core);
});
test('reuses only revalidated scoped aggregates, re-downloads corrected publications', async () => {
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(2);
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(2);
  (resolveDatedPublication as jest.Mock).mockResolvedValue({ identity: 'corrected', manifest: {} });
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(4);
});
test('superseded scope never publishes old history', async () => {
  let current = true;
  (downloadDatedCore as jest.Mock).mockImplementation(async () => { current = false; return core; });
  const progress = jest.fn();
  await loadBankRateHistory(scope, '2026-09-22', () => current, progress);
  expect(progress).not.toHaveBeenCalled();
});
test('cached-only startup performs no network requests even with a populated cache', async () => {
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn(), true);
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  jest.clearAllMocks();
  const progress = jest.fn();
  await loadBankRateHistory(scope, '2026-09-22', () => true, progress, true);
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
  expect(resolveDatedPublication).not.toHaveBeenCalled();
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
});
test('bounds downloads to 30 observations and circuit-breaks failures with blank dates', async () => {
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`) });
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(30);
  await AsyncStorage.clear();
  (downloadDatedCore as jest.Mock).mockRejectedValue(new Error('offline'));
  const progress = jest.fn();
  await expect(loadBankRateHistory(scope, '2026-09-22', () => true, progress)).rejects.toThrow('Retry');
  expect(progress).toHaveBeenCalledTimes(4);
  expect(Object.values(progress.mock.calls.at(-1)![0])).toEqual([{}, {}, {}, {}]);
});
test('automatic warmup stops after seven missing catalogues', async () => {
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: Array.from({ length: 20 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`) });
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn(), false, 7);
  expect(downloadDatedCore).toHaveBeenCalledTimes(7);
});
test('roundoff in a mean does not invalidate a verified cache', async () => {
  (downloadDatedCore as jest.Mock).mockResolvedValue({ ...core, sections: { ...core.sections,
    Mortgage: { rates: Array.from({ length: 17 }, () => ({ ...row, rate: '0.0612' })) },
  } });
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(2);
});
test('warmup retains and reuses older observations beyond seven missing new dates', async () => {
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: ['2026-08-09', '2026-08-10'] });
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: Array.from({ length: 20 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`) });
  const progress = jest.fn();
  await loadBankRateHistory(scope, '2026-09-22', () => true, progress, false, 7);
  expect(downloadDatedCore).toHaveBeenCalledTimes(9);
  const last = progress.mock.calls.at(-1)![0];
  expect(last['2026-08-10'].Mortgage.Alpha.mean).toBe(6);
  expect(last['2026-08-11']).toEqual({});
  const saved = JSON.parse((await AsyncStorage.getItem('bank-rate-overview-v1'))!);
  expect(saved.snapshots['2026-08-09'].Mortgage.Alpha.mean).toBe(6);
});
test('interrupting a backfill preserves unvisited cached observations on disk', async () => {
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  (fetchDatesIndexJson as jest.Mock).mockResolvedValue({ dates: ['2026-09-20', '2026-09-21', '2026-09-22'] });
  let current = true;
  await loadBankRateHistory(scope, '2026-09-23', () => current, () => { current = false; });
  const saved = JSON.parse((await AsyncStorage.getItem('bank-rate-overview-v1'))!);
  expect(Object.keys(saved.snapshots).sort()).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
});
test('a cached missing-date marker must be retried even when its old identity matches', async () => {
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  const saved = JSON.parse((await AsyncStorage.getItem('bank-rate-overview-v1'))!);
  saved.snapshots['2026-09-20'] = {};
  await AsyncStorage.setItem('bank-rate-overview-v1', JSON.stringify(saved));
  await loadBankRateHistory(scope, '2026-09-22', () => true, jest.fn());
  expect(downloadDatedCore).toHaveBeenCalledTimes(3);
});
