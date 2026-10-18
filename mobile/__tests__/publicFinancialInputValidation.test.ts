import { scenarioPublicCost } from '../src/data/scenarioPublicCost';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { resolvePublicRate } from '../src/data/publicRateResolver';
import { AS_OF, row } from '../testUtils/publicRateJourney';
import { PUBLIC_AS_OF, component, programme } from '../testUtils/publicRates';

const input = () => normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '100000', years: '25' },
  savings: { balance: '10000' }, projections: { mortgage: { holdVariableRate: true }, savings: { holdVariableRate: true } } });

it.each(['-100', 'abc', '12x34', '1,23', '1e3', 'Infinity'])('rejects malformed recurring cash flows instead of changing their value: %s', value => {
  for (const field of ['periodicAmount', 'withdrawalAmount'] as const) {
    const scenario = input(); scenario.projections.savings[field] = value;
    expect(scenarioPublicCost({ section: 'Savings', scenario, row, asOf: AS_OF })).toMatchObject({ reasonCodes: ['scenario_inputs_missing'] });
    expect(scenarioPublicCost({ section: 'Savings', scenario, row, asOf: AS_OF }).scenario).toBeUndefined();
  }
  const scenario = input(); scenario.projections.mortgage.extraRepaymentAmount = value;
  expect(scenarioPublicCost({ section: 'Mortgage', scenario, row, asOf: AS_OF }).scenario).toBeUndefined();
});

it('retains optional blank zeroes, formatted amounts and supported payment cadences', () => {
  const scenario = input();
  expect(scenarioPublicCost({ section: 'Savings', scenario, row, asOf: AS_OF }).scenario).toMatchObject({ monthlyContribution: '0', monthlyWithdrawal: '0' });
  scenario.projections.savings.periodicAmount = '$1,200.50'; scenario.projections.savings.periodicFrequency = 'weekly';
  scenario.projections.savings.withdrawalAmount = '60'; scenario.projections.savings.withdrawalFrequency = 'fortnightly';
  const result = scenarioPublicCost({ section: 'Savings', scenario, row, asOf: AS_OF }).scenario;
  expect(result?.section).toBe('Savings');
  if (result?.section !== 'Savings') throw Error('Missing savings scenario');
  expect(Number(result.monthlyContribution)).toBeCloseTo(1200.50 * 52 / 12, 10);
  expect(result.monthlyWithdrawal).toBe('130');
  scenario.projections.mortgage.extraRepaymentAmount = '$1,200.50';
  expect(scenarioPublicCost({ section: 'Mortgage', scenario, row, asOf: AS_OF }).scenario).toMatchObject({ extraMonthlyRepayment: '1200.5' });
});

it('rejects unsupported cash-flow cadences rather than treating them as monthly', () => {
  const scenario = input(); scenario.projections.savings.periodicFrequency = 'daily' as never;
  expect(scenarioPublicCost({ section: 'Savings', scenario, row, asOf: AS_OF }).scenario).toBeUndefined();
  scenario.projections.mortgage.extraRepaymentFrequency = 'daily' as never;
  expect(scenarioPublicCost({ section: 'Mortgage', scenario, row, asOf: AS_OF }).scenario).toBeUndefined();
});

it.each([
  ['fraction_per_annum', '-0.01'], ['fraction_per_annum', '1.01'],
  ['percentage_points', '-1'], ['percentage_points', '101'],
  ['basis_points', '-1'], ['basis_points', '10001'],
] as const)('withholds out-of-bounds comparison rates after unit conversion: %s %s', (unit, value) => {
  const result = resolvePublicRate(programme({ components: [component('net', 'payable', '0.06'), { ...component('compare', 'comparison', value), unit }] }), {}, PUBLIC_AS_OF);
  expect(result).toMatchObject({ status: 'exact', payableRate: '0.06', verifiedCurrent: true });
  expect(result.comparisonRate).toBeUndefined();
  expect(result.reasonCodes).toContain('comparison_rate_out_of_bounds');
});

it.each([['0', '0'], ['1', '1'], ['0.08', '0.08']])('retains a valid comparison fraction %s independently of payable interest', (value, expected) => {
  const result = resolvePublicRate(programme({ components: [component('net', 'payable', '0.06'), component('compare', 'comparison', value)] }), {}, PUBLIC_AS_OF);
  expect(result).toMatchObject({ comparisonRate: expected, payableRate: '0.06' });
});

it('withholds malformed comparison data without discarding the valid payable rate', () => {
  const result = resolvePublicRate(programme({ components: [component('net', 'payable', '0.06'), component('compare', 'comparison', 'invalid')] }), {}, PUBLIC_AS_OF);
  expect(result).toMatchObject({ status: 'exact', payableRate: '0.06', verifiedCurrent: true });
  expect(result.comparisonRate).toBeUndefined(); expect(result.reasonCodes).toContain('comparison_rate_invalid');
});
