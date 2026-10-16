import type { CorePayload, ProductDetail, RateRow } from '../src/types';
import { EMPTY_PROFILE, profileFilterRows } from '../src/data/profile';
import { clearHomeLoanRequirements, otherProfileFeatures, profileAttributeOptions, profileRequirementImpact } from '../src/data/profileRequirements';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { filterRows, EMPTY_FILTERS } from '../src/data/selectors';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, syncRatesPreferences, useRatesSession } from '../src/data/ratesSession';

const rows: RateRow[] = [
  { product_key: 'a', provider: 'A', product_name: 'A', rate: '0.05', rate_type: 'VARIABLE' },
  { product_key: 'a', provider: 'A', product_name: 'A', rate: '0.055', rate_type: 'FIXED' },
  { product_key: 'b', provider: 'B', product_name: 'B', rate: '0.06', rate_type: 'FIXED' },
];
const core = { sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
const original = captureRatesSession();
beforeEach(() => restoreRatesSession(original));
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('editor reads all catalogue metadata even when mandatory results are empty; absent selections remain removable', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, { ...EMPTY_PROFILE, rateTypes: ['MISSING'] }, null));
  expect(filterRows(rows, EMPTY_FILTERS)).toEqual([]);
  expect(profileAttributeOptions(rows, 'rate_type', ['MISSING'])).toEqual(['MISSING', 'FIXED', 'VARIABLE']);
  expect(profileAttributeOptions([], 'rate_type', ['MISSING'])).toEqual(['MISSING']);
  expect(profileAttributeOptions([], 'rate_type', [])).toEqual([]);
  expect(profileAttributeOptions([{ ...rows[0], loan_purpose: undefined, security_purpose: 'INVESTOR' }], 'loan_purpose', [])).toEqual(['INVESTOR']);
});

test('Home loans clear preserves every other category, shared feature and unknown selection without mutating the source', () => {
  const profile = { ...EMPTY_PROFILE, loanPurposes: ['OWNER_OCCUPIED'], rateTypes: ['VARIABLE'], repaymentTypes: ['PI'],
    lvrTiers: ['lvr_70-80%'], depositKinds: ['BONUS'], interestPayments: ['MONTHLY'],
    accountFeatures: ['OFFSET', 'EXTRA_REPAYMENTS', 'CARD_ACCESS', 'DIGITAL_BANKING', 'LEGACY_FEATURE'] };
  const before = JSON.stringify(profile), cleared = clearHomeLoanRequirements(profile);
  expect(cleared).toMatchObject({ loanPurposes: [], rateTypes: [], repaymentTypes: [], lvrTiers: [],
    depositKinds: ['BONUS'], interestPayments: ['MONTHLY'], accountFeatures: ['CARD_ACCESS', 'DIGITAL_BANKING', 'LEGACY_FEATURE'] });
  expect(JSON.stringify(profile)).toBe(before);
  expect(otherProfileFeatures(cleared)).toEqual(['LEGACY_FEATURE']);
});

test('counts distinguish rate rows, products and banks, and withhold unknown feature matches', () => {
  const profile = { ...EMPTY_PROFILE, rateTypes: ['FIXED'] };
  expect(profileRequirementImpact(core, profile, 'Mortgage', null)).toEqual({
    catalogue: { rates: 3, products: 2, banks: 2 }, matching: { rates: 2, products: 2, banks: 2 } });
  expect(profileRequirementImpact(core, { ...profile, accountFeatures: ['OFFSET'] }, 'Mortgage', null).matching).toBeNull();
  expect(profileRequirementImpact(null, EMPTY_PROFILE, 'Mortgage', null)).toEqual({ catalogue: null, matching: null });
  const details: Record<string, ProductDetail> = { a: { facts: [{ id: 'o', kind: 'feature', canonicalKey: 'OFFSET', value: 'unknown', unit: 'boolean' }] } };
  expect(profileFilterRows(rows, { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] }, 'Mortgage', details)).toEqual([]);
});

test('the saved and temporary layers reset independently and a restarted session never reintroduces a cleared seed', () => {
  const saved = { ...EMPTY_PROFILE, rateTypes: ['VARIABLE'] }, prefs = { ...DEFAULT_PREFS, includeNonStandard: true, profileFilters: saved };
  initializeRatesSession(prefs, 'Mortgage');
  installMandatoryEligibility(selectMandatoryEligibility(core, saved, null));
  expect(useRatesSession.getState().sections.Mortgage.filters.rateTypes).toEqual([]);
  updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['B'] }, page: 8 });
  expect(filterRows(rows, useRatesSession.getState().sections.Mortgage.filters)).toEqual([]);
  updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true } });
  expect(filterRows(rows, useRatesSession.getState().sections.Mortgage.filters)).toEqual([rows[0]]);
  expect(saved.rateTypes).toEqual(['VARIABLE']);
  updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['B'] } });
  const cleared = clearHomeLoanRequirements(saved);
  installMandatoryEligibility(selectMandatoryEligibility(core, cleared, null));
  syncRatesPreferences({ ...prefs, profileFilters: cleared });
  expect(filterRows(rows, useRatesSession.getState().sections.Mortgage.filters)).toEqual([rows[2]]);
  restoreRatesSession(original); initializeRatesSession({ ...prefs, profileFilters: cleared }, 'Mortgage');
  expect(filterRows(rows, useRatesSession.getState().sections.Mortgage.filters)).toEqual(rows);
});
