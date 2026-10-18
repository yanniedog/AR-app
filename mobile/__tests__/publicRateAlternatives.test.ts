import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';
import { publicCatalogueOfferRows, publicRecommendationRows, publicScenarioForRow, resolveRowPublicRate } from '../src/data/publicRateIntegration';
import { catalogue, product, programme } from '../testUtils/publicRateJourney';

function fixture(conditions: ReturnType<typeof programme>['conditions']) {
  const p = programme({ sourceBindings: [], conditions });
  return catalogue([{ ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() } }], [product], []);
}
const selection = () => mortgageComparisonScenario('Mortgage', {}, { loanAmount: '600000', lvr: '75' },
  { loanPurposes: ['OO', 'INV'], repaymentTypes: ['PI', 'IO'] });
test('multiple exact scopes for one semantic offer require a choice rather than selecting the first price', () => {
  const view = fixture([{ conditionId: 'purpose', field: 'purpose', operator: 'in', values: ['OWNER_OCCUPIED', 'INVESTMENT'], evidenceIds: [] }]);
  expect(publicCatalogueOfferRows(view, 'Mortgage', selection())).toEqual([]);
});
test('a unique allowed programme scope is retained through row resolution while unrelated inputs stay local', () => {
  const view = fixture([
    { conditionId: 'purpose', field: 'purpose', operator: 'eq', value: 'INVESTMENT', evidenceIds: [] },
    { conditionId: 'repayment', field: 'repayment', operator: 'eq', value: 'INTEREST_ONLY', evidenceIds: [] },
  ]);
  const scenario = selection();
  const rows = publicRecommendationRows([], view, 'Mortgage', scenario);
  expect(rows).toHaveLength(1);
  const scoped = publicScenarioForRow(rows[0], view, scenario);
  expect(scoped).toMatchObject({ purpose: 'INVESTMENT', repayment: 'INTEREST_ONLY', amount: '600000', lvr: '0.75' });
  expect(resolveRowPublicRate(rows[0], view, scenario)).toMatchObject({ status: 'exact', verifiedCurrent: true });
  expect(scenario.purpose).toBeUndefined();
  expect(JSON.stringify(view.products)).not.toContain('600000');
});
