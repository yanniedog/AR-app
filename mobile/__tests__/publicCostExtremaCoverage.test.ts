import { PUBLIC_AS_OF, resolution } from '../testUtils/publicRates';
import { estimatePublicCost, rankPublicCandidates } from '../src/data/publicCost';
import type { PublicCostCandidate } from '../src/data/publicCost';
import type { PublicCostScenario } from '../src/data/publicCostModel';

const mortgage: PublicCostScenario = { asOf: PUBLIC_AS_OF, section: 'Mortgage', principal: '1000',
  remainingTermMonths: 120, repayment: 'interest_only', comparisonMonths: 12, rateBehaviour: 'fixed',
  holdCurrentRate: false, feesKnown: true, fees: [] };
function candidate(id: string, rate: string, scenario = mortgage): PublicCostCandidate {
  const resolved = resolution({ payableRate: rate });
  return { id, resolution: resolved, cost: estimatePublicCost(resolved, scenario) };
}
const scope = { section: 'Mortgage' as const, eligibleCount: 2 };

test('an unresolved 3% candidate prevents a 4% candidate being declared the lowest rate', () => {
  const exact = candidate('exact-4', '0.04');
  const range = { id: 'range-3', resolution: resolution({ status: 'range', payableRate: undefined, minimumRate: '0.03', maximumRate: '0.05' }) };
  const ranked = rankPublicCandidates([exact, range], true, scope);
  expect(ranked).toMatchObject({ priced: 1, unresolved: 1, completeScope: false });
  expect(ranked.rateRanking.map(item => item.id)).toEqual(['exact-4']);
  expect(ranked.lowestRate).toBeUndefined(); expect(ranked.lowestCost).toBeUndefined();
  expect(rankPublicCandidates([exact, range], true, { ...scope, section: 'Savings' }).highestRate).toBeUndefined();
});

test('rate extrema remain available with complete rates while incomplete fees withhold cost extrema', () => {
  const known = candidate('known-4', '0.04'), unknownFees = candidate('fees-3', '0.03', { ...mortgage, feesKnown: false });
  expect(known.cost).toMatchObject({ completeness: 'complete', interestAndFeeCost: '39.96' });
  expect(unknownFees.cost?.interestAndFeeCost).toBeUndefined();
  const ranked = rankPublicCandidates([known, unknownFees], true, scope);
  expect(ranked.lowestRate?.id).toBe('fees-3'); expect(ranked.lowestCost).toBeUndefined();
  const withFees = candidate('rate-4-fee-200', '0.04', { ...mortgage, fees: [{ feeId: 'upfront', kind: 'upfront', amount: '200',
    conditions: [], evidenceIds: ['public-source'], origin: 'public' }] });
  const noFees = candidate('rate-5-no-fee', '0.05');
  expect(withFees.cost?.interestAndFeeCost).toBe('239.96'); expect(noFees.cost?.interestAndFeeCost).toBe('50.04');
  const complete = rankPublicCandidates([withFees, noFees], true, scope);
  expect(complete.lowestRate?.id).toBe('rate-4-fee-200'); expect(complete.lowestCost?.id).toBe('rate-5-no-fee');
});

test('all deposit candidates need complete comparable returns before a highest return is emitted', () => {
  const savings: PublicCostScenario = { ...mortgage, section: 'Savings', startingBalance: '1000', interestPayment: 'monthly' };
  const known = candidate('known-4', '0.04', savings), partial = candidate('unknown-fees-5', '0.05', { ...savings, feesKnown: false });
  const ranked = rankPublicCandidates([known, partial], true, { section: 'Savings', eligibleCount: 2 });
  expect(ranked.highestRate?.id).toBe('unknown-fees-5'); expect(ranked.highestReturn).toBeUndefined();
  const high = candidate('complete-5', '0.05', savings);
  expect(Number(high.cost?.netReturn)).toBeGreaterThan(Number(known.cost?.netReturn));
  expect(rankPublicCandidates([known, high], true, { section: 'Savings', eligibleCount: 2 }).highestReturn?.id).toBe('complete-5');
  const missing = { ...high, cost: { ...high.cost!, netReturn: undefined } };
  expect(rankPublicCandidates([known, missing], true, { section: 'Savings', eligibleCount: 2 }).highestReturn).toBeUndefined();
});
