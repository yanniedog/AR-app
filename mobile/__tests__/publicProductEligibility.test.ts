import { eligiblePublicProductKeys, isPublicProductEligible } from '../src/data/publicProductEligibility';
import { installMandatoryEligibility, mandatoryProductAllowed } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { AS_OF, catalogue, core, product, programme } from '../testUtils/publicRateJourney';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); });
afterEach(() => { installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); jest.useRealTimers(); });

it('admits a catalogue-only product through verified public rows while preserving core eligibility', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core([]), { rateTypes: ['VARIABLE'] }, {}));
  expect(mandatoryProductAllowed(product.productKey)).toBe(false);
  expect(eligiblePublicProductKeys(catalogue(), 'Mortgage', {}).has(product.productKey)).toBe(true);
  installMandatoryEligibility(selectMandatoryEligibility(core([]), { rateTypes: ['FIXED'] }, {}));
  expect(eligiblePublicProductKeys(catalogue(), 'Mortgage', {}).has(product.productKey)).toBe(false);
});

it('never bypasses missing or unpublished mandatory feature evidence', () => {
  const required = { accountFeatures: ['OFFSET'] };
  for (const details of [null, {}]) {
    installMandatoryEligibility(selectMandatoryEligibility(core([]), required, details));
    expect(eligiblePublicProductKeys(catalogue(), 'Mortgage', {}).size).toBe(0);
  }
  installMandatoryEligibility(selectMandatoryEligibility(core([]), required, {
    [product.productKey]: { facts: [{ id: 'offset', canonicalKey: 'OFFSET', kind: 'feature', value: true, unit: 'boolean' }] },
  }));
  expect(eligiblePublicProductKeys(catalogue(), 'Mortgage', {}).has(product.productKey)).toBe(true);
});

it('fails closed for an unresolved public programme or loading catalogue under mandatory requirements', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core([]), { rateTypes: ['VARIABLE'] }, {}));
  expect(eligiblePublicProductKeys({ ...catalogue(), status: 'loading' }, 'Mortgage', {}).size).toBe(0);
  const conditional = programme({ conditions: [{ conditionId: 'deposit', field: 'monthlyDeposit', operator: 'eq', value: '100', evidenceIds: [] }] });
  expect(eligiblePublicProductKeys(catalogue([conditional]), 'Mortgage', {}).size).toBe(0);
});

it('retains unpriced and legacy discovery identities when no mandatory requirements are selected', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core([]), {}, {}));
  const legacy = { ...product, status: 'legacy' as const, programmeIds: [] };
  expect(eligiblePublicProductKeys(catalogue([], [legacy]), 'Mortgage', {}).has(product.productKey)).toBe(true);
  expect(isPublicProductEligible(catalogue([], [legacy]), legacy, {})).toBe(true);
});

it('admits one product without expanding the rest of the section', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core([]), { rateTypes: ['VARIABLE'] }, {}));
  const other = { ...product, productId: 'other-product', productKey: 'OTHER|LOAN', programmeIds: ['other-programme'] };
  const view = catalogue([programme()], [product, other]);
  const getProgrammes = jest.fn((id: string) => {
    if (id !== product.productId) throw new Error('expanded another product');
    return view.getProgrammes(id);
  });
  const single = { ...view, getProgrammes };
  expect(isPublicProductEligible(single, product, {})).toBe(eligiblePublicProductKeys(view, 'Mortgage', {}).has(product.productKey));
  expect(getProgrammes).toHaveBeenCalledTimes(1);
  expect(getProgrammes).toHaveBeenCalledWith(product.productId);
});
