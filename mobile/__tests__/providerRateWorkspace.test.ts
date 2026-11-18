import { providerRowIdentity, providerTierSeries } from '../src/data/providerRateWorkspace';
import type { CorePayload, RateRow } from '../src/types';
function fixture(): CorePayload {
  const row: RateRow = { provider: 'Alpha', product_key: 'loan', product_name: 'Loan', rate: '0.06', bank_rate_tier: 0, rate_index: 1 };
  return { run_date: '2026-11-18', sections: { Mortgage: { rates: [row] }, Savings: { rates: [] }, TD: { rates: [] } },
    bank_rate_history: { schema_version: 1, run_dates: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'],
      row_tiers: { Mortgage: [0], Savings: [], TD: [] },
      sections: { Mortgage: [[[0, 1, [5.8]], [1, 1, [5.8, 5.9]], [3, 1, [6]]]], Savings: [], TD: [] } },
  } as unknown as CorePayload;
}
test('selected tier uses its verified binding and retains ambiguous and absent dates as gaps', () => {
  const core = fixture();
  expect(providerTierSeries(core, core.sections.Mortgage.rates[0], 'Mortgage')).toEqual({
    '2026-11-15': 0.057999999999999996, '2026-11-16': null, '2026-11-17': null, '2026-11-18': 0.06,
  });
});
test('an unbound copied row cannot acquire another row history', () => {
  const core = fixture();
  expect(providerTierSeries(core, { ...core.sections.Mortgage.rates[0] }, 'Mortgage')).toEqual({});
});
test('programme and offer identities distinguish rows with the same product and tier index', () => {
  const row = fixture().sections.Mortgage.rates[0];
  expect(providerRowIdentity('Mortgage', { ...row, public_programme_id: 'one' })).not.toBe(
    providerRowIdentity('Mortgage', { ...row, public_programme_id: 'two' }));
});

test('unindexed distinct LVR tiers retain distinct selection identities', () => {
  const row = { ...fixture().sections.Mortgage.rates[0], rate_index: undefined };
  expect(providerRowIdentity('Mortgage', { ...row, lvr_tier: 'lvr_0-60%' })).not.toBe(
    providerRowIdentity('Mortgage', { ...row, lvr_tier: 'lvr_60-80%' }));
});
