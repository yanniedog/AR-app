import { PUBLIC_AS_OF, component, condition, programme, resolution } from '../testUtils/publicRates';
import { estimatePublicCost, publicMortgagePayment, rankPublicCandidates } from '../src/data/publicCost';
import { publicProgrammeCostFees } from '../src/data/publicCostFees';
import type { PublicCostFee, PublicCostScenario } from '../src/data/publicCostModel';
import { resolvePublicRate } from '../src/data/publicRateResolver';

const base = { asOf: PUBLIC_AS_OF, rateBehaviour: 'fixed' as const, holdCurrentRate: false, feesKnown: true, fees: [] };
const fee = (amount: string, rest: Partial<PublicCostFee> = {}): PublicCostFee => ({ feeId: 'fee', kind: 'upfront', amount, conditions: [], evidenceIds: ['public-source'], origin: 'public', ...rest });

it('deducts savings fees at the start of their interval before monthly or daily interest', () => {
  const scenario = { ...base, section: 'Savings' as const, startingBalance: '1000', comparisonMonths: 1,
    fees: [fee('100', { kind: 'recurring', everyMonths: 1 })] };
  expect(estimatePublicCost(resolution({ payableRate: '0.12' }), { ...scenario, interestPayment: 'monthly' }))
    .toMatchObject({ interest: '9.00', endingBalance: '909.00', fees: '100.00', netReturn: '-91.00' });
  const daily = { interestPayment: 'daily' as const, interestBasis: 'actual_365' as const };
  const charged = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...scenario, ...daily });
  const netOpening = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...scenario, ...daily, startingBalance: '900', fees: [] });
  expect(charged.interest).toBe(netOpening.interest);
  expect(charged.endingBalance).toBe(netOpening.endingBalance);
});

it.each([
  condition('monthlyDeposit', { operator: 'eq', value: '10' }),
  condition('monthlyDeposit', { operator: 'bounds', maximum: '10' }),
])('rechecks deposit qualifications against projected contributions: %j', qualification => {
  const source = programme({ section: 'Savings', conditions: [qualification] });
  const scope = { monthlyDeposit: '10' }, resolved = resolvePublicRate(source, scope, PUBLIC_AS_OF);
  const scenario: PublicCostScenario = { ...base, section: 'Savings', startingBalance: '1000', interestPayment: 'monthly',
    programme: source, rateScenario: scope, monthlyContribution: '20' };
  const estimate = estimatePublicCost(resolved, scenario);
  expect(estimate).toMatchObject({ completeness: 'unsupported', projectedMonths: 0, verifiedCurrent: false });
  expect(estimate.reasonCodes).toContain('qualification_cashflow_conflict');
  expect(estimate.netReturn).toBeUndefined();
  expect(scope).toEqual({ monthlyDeposit: '10' });
});

it('amortises payable nominal interest and separates principal from one-month borrowing cost', () => {
  const estimate = estimatePublicCost(resolution({ payableRate: '0.12', comparisonRate: '0.80' }), { ...base, section: 'Mortgage', principal: '1000', remainingTermMonths: 1,
    repayment: 'principal_and_interest', fees: [fee('12')] });
  expect(estimate).toMatchObject({ completeness: 'complete', interest: '10.00', fees: '12.00', interestAndFeeCost: '22.00', principalRepaid: '1000.00', endingBalance: '0.00' });
  expect(publicMortgagePayment('1000', '0.12', 1)).toBe('1010.00');
});

it('models financed fees, offset funding and eligible cashback separately', () => {
  const financed = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...base, section: 'Mortgage', principal: '1000', remainingTermMonths: 1, repayment: 'interest_only',
    fees: [fee('100', { funding: 'financed' }), fee('50', { feeId: 'cashback', kind: 'cashback' })] });
  expect(financed).toMatchObject({ interest: '11.00', principalRepaid: '0.00', endingBalance: '1100.00', knownCostSubtotal: '61.00' });
  const offset = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...base, section: 'Mortgage', principal: '1000', remainingTermMonths: 1, repayment: 'interest_only',
    offsetBalance: '200', offsetSupported: true, fees: [fee('100', { funding: 'offset' })] });
  expect(offset).toMatchObject({ interest: '9.00', endingOffset: '100.00', knownCostSubtotal: '109.00' });
});

it('rechecks financed upfront fees against genuine loan amount and LVR bounds without selecting another tier', () => {
  const source = programme({ conditions: [condition('lvr', { operator: 'bounds', maximum: '0.8' })] });
  const scope = { amount: '500000', lvr: '0.8' };
  const scenario: PublicCostScenario = { ...base, section: 'Mortgage', principal: '500000', remainingTermMonths: 360, repayment: 'principal_and_interest',
    programme: source, rateScenario: scope, fees: [fee('1200', { funding: 'financed' })] };
  const invalid = estimatePublicCost(resolvePublicRate(source, scope, PUBLIC_AS_OF), scenario);
  expect(invalid).toMatchObject({ completeness: 'unsupported', projectedMonths: 0 });
  expect(invalid.reasonCodes).toContain('financed_fees_invalidate_pricing_scope');
  expect(invalid.interestAndFeeCost).toBeUndefined();
  const eligible = { ...source, conditions: [condition('lvr', { operator: 'bounds', maximum: '0.9' })] };
  expect(estimatePublicCost(resolvePublicRate(eligible, scope, PUBLIC_AS_OF), { ...scenario, programme: eligible }).completeness).toBe('complete');
  const amountCap = { ...source, conditions: [condition('amount', { operator: 'bounds', maximum: '500000' })] };
  expect(estimatePublicCost(resolvePublicRate(amountCap, scope, PUBLIC_AS_OF), { ...scenario, programme: amountCap }).reasonCodes).toContain('financed_fees_invalidate_pricing_scope');
});

it('requires the variable assumption and preserves incomplete fees and unknown cashback', () => {
  const scenario: PublicCostScenario = { ...base, section: 'Mortgage', principal: '1000', remainingTermMonths: 120, repayment: 'interest_only', rateBehaviour: 'variable' };
  expect(estimatePublicCost(resolution(), scenario).reasonCodes).toContain('variable_rate_assumption_required');
  const partial = estimatePublicCost(resolution(), { ...scenario, holdCurrentRate: true, feesKnown: false,
    fees: [fee('200', { kind: 'cashback', conditions: [{ conditionId: 'qualify', field: 'qualification', operator: 'known', value: 'cashbackQualified', evidenceIds: ['public-source'] }] })] });
  expect(partial.requestedMonths).toBe(36);
  expect(partial.completeness).toBe('partial');
  expect(partial.interestAndFeeCost).toBeUndefined(); expect(partial.fees).toBeUndefined();
  expect(partial.reasonCodes).toContain('cashback_eligibility_unknown');
});

it('stops a complete mortgage projection at an unknown reversion boundary', () => {
  const resolved = resolution({ phases: [{ phaseId: 'fixed', startMonth: 0, endMonth: 2, status: 'exact', payableRate: '0.12', reasonCodes: [], evidenceIds: ['public-source'] }] });
  const estimate = estimatePublicCost(resolved, { ...base, section: 'Mortgage', principal: '1000', remainingTermMonths: 120, repayment: 'interest_only' });
  expect(estimate).toMatchObject({ completeness: 'partial', projectedMonths: 2, interest: '20.00', knownCostSubtotal: '20.00' });
  expect(estimate.interestAndFeeCost).toBeUndefined();
});

it('honours savings introduction expiry and monthly compounding under stated assumptions', () => {
  const resolved = resolution({ payableRate: '0.12', phases: [{ phaseId: 'intro', startMonth: 0, endMonth: 3, status: 'exact', payableRate: '0.12', reasonCodes: [], evidenceIds: ['public-source'] },
    { phaseId: 'ongoing', startMonth: 3, status: 'exact', payableRate: '0', reasonCodes: [], evidenceIds: ['public-source'] }] });
  const estimate = estimatePublicCost(resolved, { ...base, section: 'Savings', startingBalance: '1000', interestPayment: 'monthly' });
  expect(estimate).toMatchObject({ completeness: 'complete', requestedMonths: 12, interest: '30.30', endingBalance: '1030.30', netReturn: '30.30' });
});

it('recalculates capped per-tier savings when the balance grows', () => {
  const source = programme({ section: 'Savings', components: [component('cap', 'payable', '0.12'), component('excess', 'payable', '0')],
    formula: { op: 'tiered', field: 'balance', method: 'per_tier', tiers: [{ maximum: '1000', formula: { op: 'component', componentId: 'cap' } }, { minimum: '1000', formula: { op: 'component', componentId: 'excess' } }] } });
  const estimate = estimatePublicCost(resolvePublicRate(source, { balance: '2000' }, PUBLIC_AS_OF), { ...base, section: 'Savings', startingBalance: '2000', interestPayment: 'monthly', comparisonMonths: 2,
    programme: source, rateScenario: { balance: '2000' } });
  expect(estimate).toMatchObject({ interest: '20.00', endingBalance: '2020.00' });
});

it('refuses bonus projections when explicit qualification inputs contradict the modelled cash flows', () => {
  const source = programme({ section: 'Savings', conditions: [condition('monthlyDeposit', { operator: 'bounds', minimum: '10' }),
    condition('withdrawals', { operator: 'bounds', maximum: '0' })] });
  const scope = { monthlyDeposit: '10', withdrawals: '0' };
  const resolved = resolvePublicRate(source, scope, PUBLIC_AS_OF);
  const scenario: PublicCostScenario = { ...base, section: 'Savings', startingBalance: '1000', interestPayment: 'monthly', programme: source,
    rateScenario: scope, monthlyContribution: '10', monthlyWithdrawal: '0' };
  for (const conflicting of [{ ...scenario, monthlyContribution: '0' }, { ...scenario, monthlyWithdrawal: '1' }]) {
    const estimate = estimatePublicCost(resolved, conflicting);
    expect(estimate).toMatchObject({ completeness: 'unsupported', projectedMonths: 0, verifiedCurrent: false });
    expect(estimate.reasonCodes).toContain('qualification_cashflow_conflict');
    expect(estimate.netReturn).toBeUndefined();
  }
  expect(estimatePublicCost(resolved, scenario).completeness).toBe('complete');
  expect(scope).toEqual({ monthlyDeposit: '10', withdrawals: '0' });
  expect(estimatePublicCost(resolution(), { ...scenario, programme: undefined, monthlyContribution: '0' }).completeness).toBe('complete');
});

it('stops term deposits at quoted maturity without inventing renewal rates', () => {
  const scenario: PublicCostScenario = { ...base, section: 'TD', deposit: '1200', quotedTermMonths: 3, interestPayment: 'maturity' };
  expect(estimatePublicCost(resolution({ payableRate: '0.12' }), scenario)).toMatchObject({ requestedMonths: 3, projectedMonths: 3, interest: '36.00', netReturn: '36.00' });
  const renewed = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...scenario, comparisonMonths: 12 });
  expect(renewed).toMatchObject({ completeness: 'partial', projectedMonths: 3, knownReturnSubtotal: '36.00' });
  expect(renewed.netReturn).toBeUndefined(); expect(renewed.reasonCodes).toContain('renewal_rate_unknown');
});

it('keeps monthly paid TD interest outside the locked principal and never invents a reinvestment rate', () => {
  const quote: PublicCostScenario = { ...base, section: 'TD', deposit: '1200', quotedTermMonths: 3, interestPayment: 'monthly' };
  const nominal = estimatePublicCost(resolution({ payableRate: '0.12' }), quote);
  expect(nominal).toMatchObject({ interest: '36.00', endingBalance: '1200.00', completeness: 'complete', netReturn: '36.00' });
  const localReinvestment = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...quote, reinvestPaidInterest: true });
  expect(localReinvestment).toMatchObject({ interest: '36.00', endingBalance: '1200.00', completeness: 'partial' });
  expect(localReinvestment.reasonCodes).toContain('reinvestment_return_unknown');
  expect(localReinvestment.netReturn).toBeUndefined();
});

it('keeps paid term-deposit fees outside the fixed principal and refuses unknown payment frequency', () => {
  const estimate = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...base, section: 'TD', deposit: '1200', quotedTermMonths: 3, interestPayment: 'monthly', fees: [fee('100')] });
  expect(estimate).toMatchObject({ interest: '36.00', endingBalance: '1200.00', netReturn: '-64.00' });
  expect(estimatePublicCost(resolution(), { ...base, section: 'Savings', startingBalance: '1000', interestPayment: 'unknown' }).completeness).toBe('unsupported');
});

it('preserves quoted day units and uses actual365 without converting days into months', () => {
  const estimate = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...base, section: 'TD', deposit: '3650', quotedTermDays: 30, interestPayment: 'maturity', interestBasis: 'actual_365' });
  expect(estimate).toMatchObject({ completeness: 'complete', requestedDays: 30, projectedDays: 30, interest: '36.00', netReturn: '36.00' });
  expect(estimatePublicCost(resolution(), { ...base, section: 'TD', deposit: '3650', quotedTermDays: 30, interestPayment: 'maturity' }).reasonCodes).toContain('day_term_interest_basis_unknown');
  const periodic = estimatePublicCost(resolution({ payableRate: '0.12' }), { ...base, section: 'TD', deposit: '3650', quotedTermDays: 60,
    interestPayment: 'monthly', interestBasis: 'actual_365', reinvestPaidInterest: true });
  expect(periodic).toMatchObject({ completeness: 'partial', interest: '72.00', endingBalance: '3650.00', projectedDays: 60 });
  expect(periodic.reasonCodes).toContain('reinvestment_return_unknown');
});

it('keeps stale estimates out of current complete-cost rankings and waits for all eligible candidates', () => {
  const stale = resolution({ verifiedCurrent: false, freshness: { state: 'stale', reasonCodes: ['source_stale'] } });
  const costs = estimatePublicCost(stale, { ...base, section: 'Savings', startingBalance: '1000', interestPayment: 'monthly' });
  expect(costs.completeness).toBe('stale'); expect(costs.netReturn).toBeUndefined();
  const candidates = [{ id: 'high', resolution: resolution({ payableRate: '0.08' }) }, { id: 'low', resolution: resolution({ payableRate: '0.04' }) }, { id: 'range', resolution: resolution({ status: 'range', payableRate: undefined, minimumRate: '0.03' }) }];
  expect(rankPublicCandidates(candidates, false, { section: 'Mortgage', eligibleCount: 3 }).lowestRate).toBeUndefined();
  expect(rankPublicCandidates(candidates, true, { section: 'Mortgage', eligibleCount: 4 }).lowestRate).toBeUndefined();
  expect(rankPublicCandidates(candidates, true, { section: 'Mortgage', eligibleCount: 3 })).toMatchObject({ priced: 2, unresolved: 1, lowestRate: { id: 'low' } });
  expect(rankPublicCandidates(candidates, true, { section: 'Savings', eligibleCount: 3 }).highestRate?.id).toBe('high');
});

it('does not equate product fee coverage with complete switching or offset costs', () => {
  const source = programme({ fees: [], feeCoverage: { status: 'complete', reasonCodes: [], evidenceIds: ['public-source'] } });
  expect(publicProgrammeCostFees(source, { operation: 'new', switchingCostsKnown: false, offsetTermsKnown: true }).feesKnown).toBe(false);
  expect(publicProgrammeCostFees(source, { operation: 'existing', switchingCostsKnown: false, offsetTermsKnown: true }).feesKnown).toBe(true);
});
