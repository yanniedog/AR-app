import { buildLifecycleProjection } from '../src/data/projections';
import { scenarioPublicCost } from '../src/data/scenarioPublicCost';
import { estimatePublicCost } from '../src/data/publicCost';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { resolvePublicRate } from '../src/data/publicRateResolver';
import { AS_OF, programme, row } from '../testUtils/publicRateJourney';

it('defaults to three mortgage years, twelve savings months and quoted maturity, requiring an explicit variable-rate assumption', () => {
  const initial = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' },
    savings: { balance: '10000', currentRate: '4' }, termDeposit: { balance: '10000', currentRate: '4' }, projections: { termDeposit: { termMonths: '12' } } });
  expect(initial.projections.mortgage.horizonYears).toBe(''); expect(initial.projections.savings.horizonYears).toBe('');
  expect(buildLifecycleProjection('Mortgage', initial, new Date(AS_OF)).missing).toContain('explicit assumption to hold variable rates unchanged');
  initial.projections.mortgage.holdVariableRate = true; initial.projections.savings.holdVariableRate = true;
  expect(buildLifecycleProjection('Mortgage', initial, new Date(AS_OF)).rateSeries[1].points).toHaveLength(37);
  expect(buildLifecycleProjection('Savings', initial, new Date(AS_OF)).rateSeries[1].points).toHaveLength(13);
  expect(buildLifecycleProjection('TD', initial, new Date(AS_OF)).rateSeries[1].points).toHaveLength(13);
  expect(initial.projections.termDeposit.rollovers).toBe('0');
  initial.projections.termDeposit.rollovers = '1';
  expect(buildLifecycleProjection('TD', initial, new Date(AS_OF)).missing).toContain('an explicit local renewal rate or assumption to reuse the quoted rate');
  initial.projections.termDeposit.renewalRate = '3';
  const renewal = buildLifecycleProjection('TD', initial, new Date(AS_OF));
  expect(renewal.rateSeries[1].label).toBe('Local renewal rate');
  expect(renewal.rateSeries[1].projectedInterest).toBeCloseTo(712, 6);
});

it('treats local sub-one-percent rates as percentages and keeps qualification unknown until explicitly supplied', () => {
  const input = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '100000', currentRate: '0.50', years: '25' },
    projections: { mortgage: { holdVariableRate: true }, savings: { holdVariableRate: true, savingsRateStructure: 'conditional-bonus', ongoingRate: '2', bonusMonthsRemaining: '3' } },
    savings: { balance: '10000', currentRate: '5' } });
  expect(buildLifecycleProjection('Mortgage', input, new Date(AS_OF)).rateSeries[1].points[1].periodInterest).toBeCloseTo(100000 * 0.005 / 12, 8);
  expect(buildLifecycleProjection('Savings', input, new Date(AS_OF)).missing).toContain('whether the bonus conditions will be met');
  input.projections.savings.bonusQualification = 'unmet';
  expect(buildLifecycleProjection('Savings', input, new Date(AS_OF)).rateSeries[1].points[1].periodInterest).toBeCloseTo(10000 * 0.02 / 12, 8);
});

it('uses payable nominal interest, separates principal and ending balance, and treats unknown fees as partial', () => {
  const input = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' },
    projections: { mortgage: { holdVariableRate: true } } });
  const publicProgramme = programme(), rate = resolvePublicRate(publicProgramme, {}, AS_OF);
  const bridge = scenarioPublicCost({ section: 'Mortgage', scenario: input, row, programme: publicProgramme, asOf: AS_OF });
  expect(bridge.scenario).toBeDefined();
  const estimate = estimatePublicCost(rate, bridge.scenario!);
  expect(estimate).toMatchObject({ requestedMonths: 36, projectedMonths: 36, completeness: 'partial' });
  expect(Number(estimate.principalRepaid)).toBeGreaterThan(0); expect(Number(estimate.endingBalance)).toBeGreaterThan(0);
  expect(estimate.interestAndFeeCost).toBeUndefined();
  const alteredMetric = scenarioPublicCost({ section: 'Mortgage', scenario: input, row: { ...row, comparison_rate: '0.25' }, programme: publicProgramme, asOf: AS_OF });
  expect(estimatePublicCost(rate, alteredMetric.scenario!)).toEqual(estimate);
  const noPrincipal = normalizeUserRateScenario({ mortgage: { years: '25' }, projections: { mortgage: { holdVariableRate: true } } });
  expect(scenarioPublicCost({ section: 'Mortgage', scenario: noPrincipal, row, asOf: AS_OF }).reasonCodes).toContain('loan_amount_unknown');
});

it('retains an exact day-quoted maturity and never guesses a renewal rate or payment frequency', () => {
  const input = normalizeUserRateScenario({ termDeposit: { balance: '10000', currentRate: '4' } });
  const publicProgramme = programme({ section: 'TD', metadata: { rateStructure: 'fixed', quotedTerm: { value: '90', unit: 'day' }, interestPayment: { type: 'maturity' } },
    components: [{ ...programme().components[0], value: '0.04' }], feeCoverage: { status: 'complete', evidenceIds: ['unit-evidence'], reasonCodes: [] }, fees: [] });
  const bridge = scenarioPublicCost({ section: 'TD', scenario: input, row, programme: publicProgramme, asOf: AS_OF });
  expect(bridge.scenario).toMatchObject({ section: 'TD', quotedTermDays: 90, interestBasis: 'actual_365' });
  const estimate = estimatePublicCost(resolvePublicRate(publicProgramme, {}, AS_OF), bridge.scenario!);
  expect(estimate.requestedDays).toBe(90); expect(estimate.projectedDays).toBe(90);
  expect(Number(estimate.interest)).toBeCloseTo(10000 * 0.04 * 90 / 365, 2);
  const unknown = scenarioPublicCost({ section: 'TD', scenario: input, row: { ...row, term_months: 12 }, asOf: AS_OF });
  expect(estimatePublicCost(resolvePublicRate(publicProgramme, {}, AS_OF), unknown.scenario!).completeness).toBe('unsupported');
});
