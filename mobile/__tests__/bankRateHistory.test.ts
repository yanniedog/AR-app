import { packedBankRateHistory, packedBankRateSnapshots } from '../src/data/bankRateHistory';
import { bankRateScope } from '../src/data/bankRateOverview';
import type { CorePayload, RateRow } from '../src/types';
const row = (id: number, rate = '0.06', extra: Partial<RateRow> = {}): RateRow => ({ provider: 'Alpha', product_key: String(id), product_name: 'Loan', rate, bank_rate_tier: id, ...extra });
function fixture(): CorePayload {
  return { run_date: '2026-09-22', sections: {
    Mortgage: { rates: [row(0), row(0, '0.07'), row(1, '0.09', { rate_type: 'FIXED' })] },
    Savings: { rates: [row(0, '0.02')] }, TD: { rates: [] },
  }, bank_rate_history: { schema_version: 1, run_dates: ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'],
    row_tiers: { Mortgage: [0, 0, 1], Savings: [0], TD: [] },
    sections: { Mortgage: [[[0, 2, [0, 2]], [3, 1, [6, 7]]], [[0, 4, [9]]]], Savings: [[[0, 4, [2]]]], TD: [] } },
  } as unknown as CorePayload;
}
function scope(core: CorePayload, mortgage = core.sections.Mortgage.rates) {
  return bankRateScope({ Mortgage: mortgage, Savings: core.sections.Savings.rates, TD: [] });
}
test('full history is synchronous; matching duplicate tiers count once and blank days remain blank', () => {
  const core = fixture();
  const result = packedBankRateSnapshots(core, scope(core, core.sections.Mortgage.rates.slice(0, 2)));
  expect(Object.keys(result)).toEqual(core.bank_rate_history!.run_dates);
  expect(result['2026-09-19'].Mortgage!.Alpha).toEqual({ min: 0, mean: 1, median: 1, max: 2, count: 2 });
  expect(result['2026-09-20'].Mortgage!.Alpha.count).toBe(2);
  expect(result['2026-09-21'].Mortgage).toEqual({});
  expect(result['2026-09-22'].Mortgage!.Alpha.mean).toBeCloseTo(6.5);
});
test('changing profile membership immediately recomputes every date without fetching', () => {
  const core = fixture();
  const result = packedBankRateSnapshots(core, scope(core, [core.sections.Mortgage.rates[2]]));
  expect(Object.values(result).every(day => day.Mortgage!.Alpha.mean === 9)).toBe(true);
  const excluded = packedBankRateSnapshots(core, scope(core, []));
  expect(Object.values(excluded).every(day => Object.keys(day.Mortgage!).length === 0)).toBe(true);
});
test('weighted median and simultaneous span changes match the full tier population', () => {
  const core = fixture();
  const result = packedBankRateSnapshots(core, scope(core));
  expect(result['2026-09-19'].Mortgage!.Alpha).toEqual({ min: 0, mean: 11 / 3, median: 2, max: 9, count: 3 });
  expect(result['2026-09-21'].Mortgage!.Alpha).toEqual({ min: 9, mean: 9, median: 9, max: 9, count: 1 });
  expect(result['2026-09-19'].Mortgage!.Alpha.count).toBe(3);
});
test('cached history cannot reuse the current statistic of another duplicate-row subset', () => {
  const core = fixture();
  const first = packedBankRateSnapshots(core, scope(core, [core.sections.Mortgage.rates[0]]));
  const second = packedBankRateSnapshots(core, scope(core, [core.sections.Mortgage.rates[1]]));
  expect(first[core.run_date].Mortgage!.Alpha.mean).toBe(6);
  expect(second[core.run_date].Mortgage!.Alpha.mean).toBeCloseTo(7);
  expect(second['2026-09-19'].Mortgage!.Alpha.count).toBe(2);
});
test.each(['overlap', 'out of bounds', 'negative', 'bad ID', 'shared ID', 'date order'])('rejects malformed complete history: %s', reason => {
  const core = fixture(), pack = core.bank_rate_history!;
  if (reason === 'overlap') pack.sections.Mortgage[0][1][0] = 1;
  if (reason === 'out of bounds') pack.sections.Mortgage[0][0][1] = 100;
  if (reason === 'negative') pack.sections.Mortgage[0][0][2][0] = -1;
  if (reason === 'bad ID') core.sections.Mortgage.rates[0].bank_rate_tier = 99;
  if (reason === 'shared ID') core.sections.Mortgage.rates[1].provider = 'Other';
  if (reason === 'date order') pack.run_dates.reverse();
  expect(packedBankRateHistory(core)).toBeNull();
  expect(Object.keys(packedBankRateSnapshots(core, scope(core)))).toEqual([core.run_date]);
});
test('legacy data has no network fallback; a quarantined row cannot re-enter history', () => {
  const core = fixture();
  const excluded = core.sections.Mortgage.rates.pop()!;
  expect(packedBankRateSnapshots(core, scope(core, [excluded]))['2026-09-19'].Mortgage).toEqual({});
  const legacy = { ...core, bank_rate_history: undefined };
  expect(Object.keys(packedBankRateSnapshots(legacy, scope(legacy)))).toEqual([core.run_date]);
});
