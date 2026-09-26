import { bankRateScope, buildBankRateChart, snapshotBankRates, summarizeBankRates, MAX_BANK_RATE_PERCENT } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE, profileFilterRows } from '../src/data/profile';
import type { CorePayload, RateRow } from '../src/types';

const row = (rate: string, extra: Partial<RateRow> = {}): RateRow => ({ provider: 'Alpha', product_key: 'a', product_name: 'Loan', rate, rate_type: 'VARIABLE', ...extra });
const core = (rows: RateRow[]) => ({ run_date: '2026-09-22', sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } }) as unknown as CorePayload;

test('all four statistics use eligible tiers, including zero; odd and even medians', () => {
  const rates = [row('0'), row('0.02'), row('0.06'), row('0.12'), row('invalid')];
  expect(summarizeBankRates(rates).Alpha).toEqual({ min: 0, mean: 5, median: 4, max: 12, count: 4 });
  expect(summarizeBankRates(rates.slice(0, 3)).Alpha.median).toBe(2);
});

test('unrepresentable current rates are excluded while bounded extreme chart coordinates remain finite', () => {
  const stats = summarizeBankRates([row(String(Number.MAX_VALUE)), row('0.06')]);
  expect(stats.Alpha).toEqual({ min: 6, mean: 6, median: 6, max: 6, count: 1 });
  const boundary = summarizeBankRates([row(String(MAX_BANK_RATE_PERCENT)), row(String(MAX_BANK_RATE_PERCENT))]);
  const model = buildBankRateChart({ '2026-09-26': { Mortgage: boundary } }, 'Mortgage', 'mean', false, null);
  expect(Number.isFinite(model.min)).toBe(true);
  expect(Number.isFinite(model.max)).toBe(true);
  expect(model.max).toBeGreaterThan(model.min);
  expect(Number.isFinite((model.max - model.lines[0].points[0].value) / (model.max - model.min))).toBe(true);
});

test('profile filtering precedes every statistic, excludes sibling tiers and unknown features', () => {
  const rows = [row('0.06'), row('0.99', { rate_type: 'FIXED' }), row('0.88', { provider: 'Other', rate_type: 'FIXED' })];
  const matching = profileFilterRows(rows, { ...EMPTY_PROFILE, rateTypes: ['VARIABLE'] }, 'Mortgage');
  const scope = bankRateScope({ Mortgage: matching, Savings: [], TD: [] });
  expect(snapshotBankRates(scope).Mortgage).toEqual({ Alpha: { min: 6, mean: 6, median: 6, max: 6, count: 1 } });
  expect(profileFilterRows(rows, { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] }, 'Mortgage', null)).toEqual([]);
  const historical = snapshotBankRates(scope, core([row('0.05'), row('0.77', { rate_type: 'FIXED' })]));
  expect(historical.Mortgage!.Alpha.mean).toBe(5);
  expect(historical.Mortgage!.Alpha.count).toBe(1);
});

test('recomputed scope cannot retain a formerly matching bank; section and statistic are independent', () => {
  const scope = bankRateScope({ Mortgage: [row('0.02'), row('0.06')], Savings: [row('0.04', { provider: 'Beta' })], TD: [row('0.08', { provider: 'Gamma' })] });
  const snapshots = { '2026-09-22': snapshotBankRates(scope) };
  expect(buildBankRateChart(snapshots, 'Mortgage', 'mean', false, null).lines[0].points[0].value).toBe(4);
  expect(buildBankRateChart(snapshots, 'Mortgage', 'max', false, null).lines[0].points[0].value).toBe(6);
  expect(buildBankRateChart(snapshots, 'TD', 'min', false, null).lines.map(l => l.provider)).toEqual(['Gamma']);
  expect(buildBankRateChart(snapshots, 'Savings', 'median', false, null).lines.map(l => l.provider)).toEqual(['Beta']);
});

test('gap needs both matching sides; absent dates remain on axis and no observations are invented', () => {
  const snapshot = snapshotBankRates(bankRateScope({ Mortgage: [row('0.06')], Savings: [row('0.04')], TD: [] }));
  const model = buildBankRateChart({ '2026-09-20': snapshot, '2026-09-21': {}, '2026-09-22': snapshot }, 'Mortgage', 'max', true, null);
  expect(model.dates).toHaveLength(3);
  expect(model.lines[0].points.map(p => p.value)).toEqual([2, 2]);
  expect(buildBankRateChart({ '2026-09-22': { Mortgage: snapshot.Mortgage } }, 'Mortgage', 'mean', true, null).lines).toEqual([]);
  expect(buildBankRateChart({}, 'Mortgage', 'mean', false, null)).toMatchObject({ min: 0, max: 1, lines: [] });
});
