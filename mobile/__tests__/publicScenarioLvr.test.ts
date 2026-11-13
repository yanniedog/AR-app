import { Decimal } from '../src/data/publicRateDecimal';
import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';
import { mortgageComparisonMatch } from '../src/data/mortgageComparison';
import { exactPublicScenarioLvr, publicScenarioLvr } from '../src/data/publicScenarioLvr';
import { evaluatePublicCondition, resolvePublicRate } from '../src/data/publicRateResolver';
import { createPublicRateResolverIndex } from '../src/data/publicRateResolverIndex';
import { estimatePublicCost } from '../src/data/publicCost';
import type { RateScenario } from '../src/data/publicRateModel';
import { PUBLIC_AS_OF, component, condition, programme } from '../testUtils/publicRates';

const fundsScenario = (loanAmount = '100000', fundsAvailable = '200000') => mortgageComparisonScenario('Mortgage', {}, {
  loanAmount, fundsAvailable, lvr: '', lvrMode: 'funds',
});
const down = '0.333333333333333333333333', up = '0.666666666666666666666667';

test.each([
  ['100000', '200000', down, 'met', 'unmet'],
  ['200000', '100000', up, 'unmet', 'met'],
] as const)('repeating funds LVR compares its exact value at the transported boundary: %s/%s', (loan, deposit, boundary, above, below) => {
  const scenario = fundsScenario(loan, deposit);
  expect(scenario.lvr).toBe(boundary);
  for (const inclusive of [true, false]) {
    expect(evaluatePublicCondition(condition('lvr', { operator: 'bounds', minimum: boundary, minimumInclusive: inclusive }), scenario, PUBLIC_AS_OF)).toBe(above);
    expect(evaluatePublicCondition(condition('lvr', { operator: 'bounds', maximum: boundary, maximumInclusive: inclusive }), scenario, PUBLIC_AS_OF)).toBe(below);
  }
  expect(evaluatePublicCondition(condition('lvr', { operator: 'eq', value: boundary }), scenario, PUBLIC_AS_OF)).toBe('unmet');
  expect(evaluatePublicCondition(condition('lvr', { operator: 'in', values: [boundary] }), scenario, PUBLIC_AS_OF)).toBe('unmet');
  expect(evaluatePublicCondition(condition('lvr', { operator: 'known' }), scenario, PUBLIC_AS_OF)).toBe('met');
});

test('finite exact and manual ratios preserve ordinary equality, known inputs and unknown source fields', () => {
  const finite = fundsScenario('600000', '150000');
  for (const scenario of [finite, { lvr: '0.8' }]) {
    expect(evaluatePublicCondition(condition('lvr', { operator: 'eq', value: '0.8' }), scenario, PUBLIC_AS_OF)).toBe('met');
    expect(evaluatePublicCondition(condition('lvr', { operator: 'bounds', maximum: '0.8', maximumInclusive: false }), scenario, PUBLIC_AS_OF)).toBe('unmet');
  }
  expect(evaluatePublicCondition(condition('lvr', { operator: 'known' }), { lvr: '0.8' }, PUBLIC_AS_OF)).toBe('met');
  expect(evaluatePublicCondition(condition('lvr', { operator: 'known' }), {}, PUBLIC_AS_OF)).toBe('unknown');
  expect(evaluatePublicCondition(condition('lvrSourceAmount', { operator: 'known' }), finite, PUBLIC_AS_OF)).toBe('unknown');
  expect(evaluatePublicCondition(condition('lvrPropertyValue', { operator: 'eq', value: '750000' }), finite, PUBLIC_AS_OF)).toBe('unknown');
});

test('private ratio survives JSON and spread copies; its weak cache revalidates every relevant mutable input', () => {
  const original = fundsScenario(), clone = JSON.parse(JSON.stringify(original)) as RateScenario;
  const ratio = Decimal.parse('1').div(Decimal.parse('3'));
  expect(publicScenarioLvr({ ...clone })!.compare(ratio)).toBe(0);
  const cached = exactPublicScenarioLvr(clone);
  expect(cached).not.toBeNull();
  expect(exactPublicScenarioLvr(clone)).toBe(cached);
  clone.amount = '100001';
  expect(exactPublicScenarioLvr(clone)).toBeNull();
  expect(publicScenarioLvr(clone)!.compare(Decimal.parse(down))).toBe(0);
  clone.amount = '100000';
  expect(exactPublicScenarioLvr(clone)).not.toBeNull();
  clone.lvr = '0.4';
  expect(exactPublicScenarioLvr(clone)).toBeNull();
  expect(publicScenarioLvr(clone)!.compare(Decimal.parse('0.4'))).toBe(0);
  clone.lvr = down;
  clone.lvrSourceAmount = '200000';
  expect(exactPublicScenarioLvr(clone)).toBeNull();
  clone.lvrSourceAmount = '100000';
  clone.lvrPropertyValue = '200000';
  expect(exactPublicScenarioLvr(clone)).toBeNull();
  expect(original).toMatchObject({ amount: '100000', lvr: down, lvrSourceAmount: '100000', lvrPropertyValue: '300000' });
});

test.each(['0', '-1', 'private', 'NaN', '1e3'])('malformed ratio metadata cannot override a manual scenario: %s', property => {
  const scenario = { ...fundsScenario(), lvrPropertyValue: property };
  expect(exactPublicScenarioLvr(scenario)).toBeNull();
  expect(publicScenarioLvr(scenario)!.compare(Decimal.parse(down))).toBe(0);
  expect(evaluatePublicCondition(condition('lvr', { operator: 'bounds', minimum: down, minimumInclusive: false }), scenario, PUBLIC_AS_OF)).toBe('unmet');
});

test('switching to direct or incomplete inputs discards stale funds-ratio metadata', () => {
  const derived = fundsScenario();
  const direct = mortgageComparisonScenario('Mortgage', derived, { loanAmount: '100000', lvr: '40', lvrMode: 'lvr' });
  expect(exactPublicScenarioLvr(direct)).toBeNull();
  expect(Object.hasOwn(direct, 'lvrPropertyValue')).toBe(false);
  expect(publicScenarioLvr(direct)!.compare(Decimal.parse('0.4'))).toBe(0);
  const incomplete = mortgageComparisonScenario('Mortgage', derived, { loanAmount: '100000', lvr: '', lvrMode: 'funds', fundsAvailable: '' });
  expect(publicScenarioLvr(incomplete)).toBeNull();
  expect(Object.hasOwn(incomplete, 'lvrSourceAmount')).toBe(false);
});

test.each(['whole_balance', 'per_tier'] as const)('LVR %s formulas and their cache distinguish repeating input from the same finite transport', method => {
  const offer = programme({ components: [component('low', 'payable', '0.04'), component('high', 'payable', '0.06')],
    formula: { op: 'tiered', field: 'lvr', method, tiers: [
      { maximum: down, formula: { op: 'component', componentId: 'low' } },
      { minimum: down, minimumInclusive: false, formula: { op: 'component', componentId: 'high' } },
    ] } });
  const manual = { amount: '100000', lvr: down }, exact = fundsScenario();
  const index = createPublicRateResolverIndex();
  const finite = index.resolve(offer, manual, PUBLIC_AS_OF), repeating = index.resolve(offer, exact, PUBLIC_AS_OF);
  expect(finite.status).toBe('exact'); expect(repeating.status).toBe('exact');
  expect(finite.appliedComponents.map(item => item.componentId)).toEqual(['low']);
  expect(repeating.appliedComponents.map(item => item.componentId)).toEqual(method === 'whole_balance' ? ['high'] : ['low', 'high']);
  expect(index.stats.misses).toBe(2);
  expect(index.resolve(offer, JSON.parse(JSON.stringify(exact)), PUBLIC_AS_OF)).toEqual(repeating);
  expect(index.stats.hits).toBe(1);
  const malformed = index.resolve(offer, { amount: '100000', lvr: '1/3' }, PUBLIC_AS_OF);
  expect(malformed.status).toBe('unresolved');
  expect(malformed.reasonCodes).toContain('tier_input_unknown');
  expect(index.stats.misses).toBe(3);
});

test('actual pricing and listed scope both admit a loan ratio above an exclusive lower boundary', () => {
  const input = { loanAmount: '100000', fundsAvailable: '200000', lvr: '', lvrMode: 'funds' as const };
  const scenario = mortgageComparisonScenario('Mortgage', {}, input);
  const row = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate_index: 4, rate: '0.05',
    lvr_tier: 'lvr_>33.33333333333333', balance_min: 0, balance_max: 1000000 };
  expect(mortgageComparisonMatch(row, input)).toBe('listed');
  expect(resolvePublicRate(programme({ conditions: [condition('lvr', { operator: 'bounds', minimum: down, minimumInclusive: false })] }), scenario, PUBLIC_AS_OF).status).toBe('exact');
  expect(resolvePublicRate(programme({ conditions: [condition('lvr', { operator: 'bounds', maximum: down })] }), scenario, PUBLIC_AS_OF).status).toBe('unresolved');
});

test.each([
  ['99999', '200001', down, true, 'unsupported'],
  ['100000', '200000', '0.333336666666666666666667', false, 'complete'],
] as const)('financed fee revalidation recomputes exact LVR using the unchanged property: %s', (loan, deposit, maximum, inclusive, completeness) => {
  const scope = fundsScenario(loan, deposit), before = JSON.stringify(scope);
  const offer = programme({ conditions: [condition('lvr', { operator: 'bounds', maximum, maximumInclusive: inclusive })] });
  const quote = resolvePublicRate(offer, scope, PUBLIC_AS_OF);
  expect(quote.status).toBe('exact');
  const cost = estimatePublicCost(quote, { asOf: PUBLIC_AS_OF, section: 'Mortgage', rateBehaviour: 'fixed', holdCurrentRate: false,
    feesKnown: true, principal: loan, remainingTermMonths: 12, comparisonMonths: 1, repayment: 'interest_only', programme: offer, rateScenario: scope,
    fees: [{ feeId: 'financed', kind: 'upfront', amount: '1', conditions: [], evidenceIds: [], origin: 'user', funding: 'financed' }] });
  expect(cost.completeness).toBe(completeness);
  if (completeness === 'unsupported') expect(cost.reasonCodes).toContain('financed_fees_invalidate_pricing_scope');
  else expect(cost.endingBalance).toBe('100001.00');
  expect(JSON.stringify(scope)).toBe(before);
});
