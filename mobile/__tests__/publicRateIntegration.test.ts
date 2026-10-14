import { bindCurrentPublicRow, payableRateForRow, publicRateScenario, publicRecommendationRows, resolveLocalCurrentRate,
  resolveProductPublicRate, resolvedPublicRankingRows, scenarioWithLocalCurrentRate } from '../src/data/publicRateIntegration';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { normalizeProfileFilters } from '../src/data/profile';
import { installMandatoryEligibility, mandatoryEligibleRows } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { makeSavedRateRef, normalizeSavedRates, resolveSavedRates } from '../src/data/savedRates';
import { isProductSubscribed, makeProductSubscription } from '../src/data/subscriptions';
import { currentProductDiscovery, currentProductSelectionMatches, alphabeticalScenarioProviders } from '../src/data/scenarioCatalog';
import { publicReferenceScope } from '../src/data/publicRatePresentation';
import { resolveCompareSelections } from '../src/data/compareSelection';
import { AS_OF, catalogue, core, product, programme, reference, row } from './fixtures/publicRateJourney';

const profile = normalizeProfileFilters({ loanPurposes: ['OWNER_OCCUPIED'], repaymentTypes: ['PRINCIPAL_AND_INTEREST'] });
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); });
afterEach(() => jest.useRealTimers());

it('preserves entered rates across reference calculations and never adds public discounts to a total local adjustment', () => {
  const scenario = normalizeUserRateScenario({ version: 3, mortgage: { currentRate: '6.27' },
    localRates: { mortgage: { mode: 'reference', referenceId: 'unit-reference', totalAdjustment: '-2.50' } } });
  const before = JSON.stringify(scenario);
  const result = resolveLocalCurrentRate('Mortgage', scenario, [reference()], AS_OF, catalogue(), profile);
  expect(result).toMatchObject({ status: 'exact', payableRate: '0.0639', origin: 'locally_calculated', verifiedCurrent: false });
  const calculationCopy = scenarioWithLocalCurrentRate('Mortgage', scenario, result);
  expect(calculationCopy.mortgage.currentRate).toBe('6.39');
  expect(JSON.stringify(scenario)).toBe(before);
  expect(scenario.mortgage.currentRate).toBe('6.27');
  expect(scenarioWithLocalCurrentRate('Mortgage', normalizeUserRateScenario({ ...scenario, localRates: {} }),
    resolveLocalCurrentRate('Mortgage', normalizeUserRateScenario({ ...scenario, localRates: {} }), [reference({ value: '20' })], AS_OF)).mortgage.currentRate).toBe('6.27');
});

it('keeps missing, mismatched and ambiguous reference families unresolved with no fallback to the saved entered rate', () => {
  const scenario = normalizeUserRateScenario({ mortgage: { currentRate: '6.27' }, localRates: { mortgage: {
    mode: 'reference', referenceId: 'unit-reference', totalAdjustment: '-2' } } });
  const scoped = reference({ conditions: [{ conditionId: 'customer', field: 'customerCategory', operator: 'eq', value: 'OVERSEAS_BORROWER', evidenceIds: ['unit-evidence'] }] });
  const unknown = resolveLocalCurrentRate('Mortgage', scenario, [scoped], AS_OF, catalogue(), profile);
  expect(unknown.reasonCodes).toContain('reference_conditions_unknown');
  expect(unknown.payableRate).toBeUndefined();
  expect(scenarioWithLocalCurrentRate('Mortgage', scenario, unknown).mortgage.currentRate).toBe('');
  expect(scenario.mortgage.currentRate).toBe('6.27');
  const mismatch = normalizeUserRateScenario({ ...scenario, localRates: { mortgage: { ...scenario.localRates.mortgage, referenceScenario: { customerCategory: 'ORDINARY' } } } });
  expect(resolveLocalCurrentRate('Mortgage', mismatch, [scoped], AS_OF, catalogue(), profile).reasonCodes).toContain('reference_conditions_unmet');
  const matched = normalizeUserRateScenario({ ...scenario, localRates: { mortgage: { ...scenario.localRates.mortgage, referenceScenario: { customerCategory: 'OVERSEAS_BORROWER' } } } });
  expect(resolveLocalCurrentRate('Mortgage', matched, [scoped], AS_OF, catalogue(), profile).status).toBe('exact');
  expect(publicReferenceScope(scoped)).toContain('Customer category: overseas borrower');
  expect(resolveLocalCurrentRate('Mortgage', scenario, [reference(), reference({ value: '9.77' })], AS_OF).reasonCodes).toContain('source_conflict');
  expect(resolveLocalCurrentRate('Mortgage', scenario, [reference({ effectiveFrom: '2026-11-01' })], AS_OF).payableRate).toBeUndefined();
});

it('requires product bindings and treats fixed terms and ambiguous comparison purpose as explicit scenario inputs', () => {
  const scenario = normalizeUserRateScenario({ projections: { mortgage: { mortgageRateStructure: 'fixed', fixedPeriodMonths: '24' } },
    currentProducts: { mortgage: { provider: 'Unit Bank', productKey: product.productKey } },
    localRates: { mortgage: { mode: 'reference', referenceId: 'another-bank', totalAdjustment: '0' } } });
  expect(publicRateScenario('Mortgage', scenario, profile).termMonths).toBe('24');
  const dollars = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '$500,000', propertyValue: '$625,000' } });
  expect(publicRateScenario('Mortgage', dollars, profile)).toMatchObject({ amount: '500000', lvr: '0.8' });
  const malformed = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '500000', propertyValue: '62,50,00' } });
  expect(publicRateScenario('Mortgage', malformed, profile).lvr).toBeUndefined();
  expect(publicRateScenario('Mortgage', scenario, normalizeProfileFilters({ loanPurposes: ['OWNER_OCCUPIED', 'INVESTMENT'] }), row).purpose).toBeUndefined();
  expect(resolveLocalCurrentRate('Mortgage', scenario, [reference({ referenceId: 'another-bank', providerId: 'other-bank' })], AS_OF, catalogue(), profile).reasonCodes).toContain('selected_reference_product_mismatch');
  const coverageOnly = normalizeUserRateScenario({ ...scenario, currentProducts: { mortgage: { provider: 'Failed Source Bank' } },
    localRates: { mortgage: { mode: 'reference', referenceId: 'unit-reference', totalAdjustment: '0' } } });
  expect(resolveLocalCurrentRate('Mortgage', coverageOnly, [reference()], AS_OF,
    { ...catalogue(), products: [], coverage: [{ providerId: 'failed-provider', providerName: 'Failed Source Bank' }] }, profile).reasonCodes).toContain('selected_reference_product_mismatch');
  const ambiguous = { ...product, programmeIds: ['unit-programme', 'alternative'] };
  expect(resolveProductPublicRate(ambiguous, catalogue(), {}).reasonCodes).toContain('pricing_programme_selection_required');
});

it('retains unpriced and discontinued products, aliases and source-failed providers in discovery', () => {
  const unpriced = { ...product, programmeIds: [], status: 'legacy' as const, reasonCodes: ['pricing_programme_not_enabled'] };
  expect(alphabeticalScenarioProviders([], [unpriced], ['Failed Source Bank'])).toEqual(['Failed Source Bank', 'Unit Bank']);
  const options = currentProductDiscovery([], [unpriced], 'Unit Bank', 'Mortgage');
  expect(options).toHaveLength(1);
  expect(options[0]).toMatchObject({ productKey: product.productKey, status: 'legacy', aliases: ['Former Unit Loan'] });
  expect(options[0].row).toBeUndefined();
  const retired = catalogue([programme()], [{ ...product, status: 'legacy' }]);
  expect(publicRecommendationRows([row], retired, 'Mortgage', {})).toEqual([]);
  const saved = makeSavedRateRef(bindCurrentPublicRow(row, retired));
  expect(resolveSavedRates(core(), [saved], retired)).toHaveLength(1);
});

it('keeps semantic saved selections and subscriptions stable when source arrays reorder', () => {
  const saved = makeSavedRateRef(bindCurrentPublicRow(row, catalogue()), 'rate', AS_OF);
  const reordered = catalogue([programme({ sourceBindings: [{ rateIndex: 3, pointer: '/lendingRates/3' }] })]);
  const resolved = resolveSavedRates(core([{ ...row, rate_index: 3 }]), [saved], reordered);
  expect(resolved[0].row.rate_index).toBe(3);
  expect(resolved[0].ref.id).toBe(saved.id);
  const legacy = makeSavedRateRef(row, 'rate', AS_OF);
  expect(resolveSavedRates(core(), [legacy], catalogue())).toEqual([]);
  const option = currentProductDiscovery([bindCurrentPublicRow(row, catalogue())], [product], 'Unit Bank')[0];
  expect(currentProductSelectionMatches(option, { productKey: product.productKey, rateIndex: 0 })).toBe(false);
  expect(currentProductSelectionMatches(option, { productKey: product.productKey, rateIndex: 99, offerId: saved.offerId })).toBe(true);
  const synthetic = { ...bindCurrentPublicRow(row, catalogue()), rate_index: undefined, exact_alert_eligible: true };
  const withoutIndex = makeSavedRateRef(synthetic, 'rate', AS_OF);
  expect(normalizeSavedRates([withoutIndex])).toEqual([withoutIndex]);
  const subscription = makeProductSubscription(synthetic, null);
  expect(isProductSubscribed([subscription], product.productKey, null, 'unit-offer')).toBe(true);
  expect(isProductSubscribed([subscription], product.productKey, null, 'unrelated-offer')).toBe(false);
  expect(resolveCompareSelections(core([synthetic]), [`offer:unit-offer#${product.productKey}`])[0].row.public_offer_id).toBe('unit-offer');
  expect(resolveCompareSelections(core([synthetic]), [`offer:unrelated-offer#${product.productKey}`])).toEqual([]);
});

it('includes newly resolved offers while preserving mandatory feature gates and excluding unresolved rankings', () => {
  const candidates = publicRecommendationRows([], catalogue(), 'Mortgage', {});
  expect(candidates[0]).toMatchObject({ rate: '0.06', public_offer_id: 'unit-offer' });
  const required = normalizeProfileFilters({ accountFeatures: ['OFFSET'] });
  installMandatoryEligibility(selectMandatoryEligibility(core([]), required, {}));
  expect(mandatoryEligibleRows(candidates)).toEqual([]);
  installMandatoryEligibility(selectMandatoryEligibility(core([]), required, { [product.productKey]: { facts: [{ id: 'offset', canonicalKey: 'OFFSET', kind: 'feature', value: true, unit: 'boolean' }] } }));
  expect(mandatoryEligibleRows(candidates)).toHaveLength(1);
  const priced = resolvedPublicRankingRows(candidates, catalogue());
  expect(priced).toMatchObject({ priced: 1, unresolved: 0, complete: true });
  expect(payableRateForRow({ ...row, comparison_rate: '0.10' }, { ...resolveProductPublicRate(product, catalogue()), status: 'range' })).toBeNull();
  expect(payableRateForRow({ ...row, comparison_rate: '0.10' }, resolveProductPublicRate(product, catalogue()))).toBe(0.06);
  expect(resolvedPublicRankingRows(candidates, { ...catalogue(), allLoaded: false }).complete).toBe(false);
});

it('resolves legacy repayment facet spellings while retaining the same mandatory profile eligibility', () => {
  const savedProfile = normalizeProfileFilters({ loanPurposes: ['OO'], repaymentTypes: ['principal_and_interest'] });
  const scenario = normalizeUserRateScenario({});
  const scope = publicRateScenario('Mortgage', scenario, savedProfile);
  expect(scope).toMatchObject({ purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' });
  const scoped = catalogue([programme({ conditions: [
    { conditionId: 'purpose', field: 'purpose', operator: 'eq', value: 'OWNER_OCCUPIED', evidenceIds: ['unit-evidence'] },
    { conditionId: 'repayment', field: 'repayment', operator: 'eq', value: 'PRINCIPAL_AND_INTEREST', evidenceIds: ['unit-evidence'] },
  ] })]);
  const candidates = publicRecommendationRows([], scoped, 'Mortgage', scope);
  expect(candidates[0]).toMatchObject({ loan_purpose: 'OO', ribbon_repayment_type: 'principal_and_interest', rate: '0.06' });
  installMandatoryEligibility(selectMandatoryEligibility(core([]), savedProfile, {}));
  expect(mandatoryEligibleRows(candidates)).toHaveLength(1);
  expect(resolveLocalCurrentRate('Mortgage', normalizeUserRateScenario({ localRates: { mortgage: {
    mode: 'reference', referenceId: 'unit-reference', totalAdjustment: '-2' } } }), [reference({ conditions: [
    { conditionId: 'repayment', field: 'repayment', operator: 'eq', value: 'PRINCIPAL_AND_INTEREST', evidenceIds: ['unit-evidence'] },
  ] })], AS_OF, scoped, savedProfile).status).toBe('exact');
});
