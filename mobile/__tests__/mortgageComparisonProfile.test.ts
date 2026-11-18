import type { MortgageComparisonInputs } from '../src/data/mortgageComparison';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';

const mockValues = new Map<string, string>();
const mockRead = jest.fn(async (key: string) => mockValues.get(key) ?? null);
const mockWrite = jest.fn(async (key: string, value: string) => { mockValues.set(key, value); });
jest.mock('../src/lib/secureStoreValue', () => ({
  readSecureStoreValue: (key: string) => mockRead(key),
  writeSecureStoreValue: (key: string, value: string) => mockWrite(key, value),
}));

const comparison: MortgageComparisonInputs = {
  loanAmount: '$650k', lvr: '80.0025', lvrMode: 'funds', fundsType: 'offset',
  fundsAvailable: '$155k', propertyValue: '$775k',
};
const facets = { loanPurposes: ['OWNER_OCCUPIED'], repaymentTypes: ['PRINCIPAL_AND_INTEREST'] };

function boot() {
  let state!: {
    profile: typeof import('../src/data/mortgageComparisonProfile');
    comparison: typeof import('../src/data/mortgageComparison');
    session: typeof import('../src/data/ratesSession');
    defaults: typeof import('../src/data/storeTypes');
  };
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    state = {
      profile: require('../src/data/mortgageComparisonProfile'),
      comparison: require('../src/data/mortgageComparison'),
      session: require('../src/data/ratesSession'),
      defaults: require('../src/data/storeTypes'),
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return state;
}

beforeEach(() => {
  mockValues.clear();
  jest.clearAllMocks();
});

test('restores exact saved inputs and purpose/repayment through a cold start and Rates initialization', async () => {
  const first = boot();
  await first.profile.openMortgageComparisonProfile();
  first.profile.saveMortgageComparisonInputs(comparison);
  first.profile.saveMortgageComparisonFacets(facets);
  await first.profile.openMortgageComparisonProfile();
  expect(mockWrite).toHaveBeenLastCalledWith(SECURE_STORE_KEYS.customerProfile, expect.any(String));

  const restarted = boot();
  await restarted.profile.openMortgageComparisonProfile();
  restarted.session.initializeRatesSession(restarted.defaults.DEFAULT_PREFS, 'Mortgage');
  expect(restarted.comparison.useMortgageComparison.getState()).toEqual(comparison);
  expect(restarted.session.useRatesSession.getState().sections.Mortgage.filters).toMatchObject(facets);
  expect(restarted.profile.useMortgageComparisonProfile.getState().profile).toEqual({ inputs: comparison, facets });
});

test('audit scope writes and rollback affect active inputs without rewriting saved profile evidence', async () => {
  const { profile, comparison: live, session } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  profile.saveMortgageComparisonFacets(facets);
  await profile.openMortgageComparisonProfile();
  const durable = mockValues.get(SECURE_STORE_KEYS.customerProfile);
  const active = session.captureRatesSession();
  live.setMortgageComparisonInputs({ loanAmount: '400000', lvr: '65' });
  session.updateRatesSection('Mortgage', current => ({ filters: { ...current.filters, loanPurposes: ['INVESTMENT'] } }));
  live.setMortgageComparisonInputs(comparison);
  session.restoreRatesSession(active);
  expect(mockValues.get(SECURE_STORE_KEYS.customerProfile)).toBe(durable);
  expect(profile.useMortgageComparisonProfile.getState().profile).toEqual({ inputs: comparison, facets });
});

test('clearing Rates comparison preserves shared loan details after reopening', async () => {
  const { profile } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  profile.saveMortgageComparisonFacets(facets);
  await profile.openMortgageComparisonProfile();
  profile.clearSavedMortgageComparison();
  await profile.openMortgageComparisonProfile();

  const restarted = boot();
  await restarted.profile.openMortgageComparisonProfile();
  expect(restarted.profile.useMortgageComparisonProfile.getState().profile).toEqual({
    inputs: { ...comparison, lvr: '' },
    facets: { loanPurposes: [], repaymentTypes: [] },
  });
});

test('numeric Clear persists direct LVR reset while retaining personal inputs and selected facets', async () => {
  const first = boot();
  first.profile.saveMortgageComparisonInputs(comparison);
  first.profile.saveMortgageComparisonFacets(facets);
  await first.profile.openMortgageComparisonProfile();
  first.profile.clearSavedMortgageComparison({ preserveFacets: true });
  await first.profile.openMortgageComparisonProfile();
  const restarted = boot();
  await restarted.profile.openMortgageComparisonProfile();
  expect(restarted.profile.useMortgageComparisonProfile.getState().profile).toEqual({
    inputs: { ...comparison, lvr: '' }, facets,
  });
});

test('an unreadable encrypted record is retained, and queued edits survive write retry', async () => {
  mockValues.set(SECURE_STORE_KEYS.mortgageComparisonProfile, '{malformed');
  const { profile } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  await profile.openMortgageComparisonProfile();
  expect(mockWrite).not.toHaveBeenCalled();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
  expect(mockValues.get(SECURE_STORE_KEYS.mortgageComparisonProfile)).toBe('{malformed');

  mockValues.set(SECURE_STORE_KEYS.mortgageComparisonProfile, JSON.stringify({ version: 1, inputs: { loanAmount: '', lvr: '' }, facets }));
  mockWrite.mockRejectedValueOnce(new Error('Locked'));
  await profile.openMortgageComparisonProfile();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
  await profile.openMortgageComparisonProfile();
  expect(profile.useMortgageComparisonProfile.getState().profile).toEqual({ inputs: comparison, facets });
});

test('Rates clear never replaces an unreadable personal record', async () => {
  mockValues.set(SECURE_STORE_KEYS.mortgageComparisonProfile, '{malformed');
  const { profile } = boot();
  await profile.openMortgageComparisonProfile();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
  expect(mockWrite).not.toHaveBeenCalled();

  profile.clearSavedMortgageComparison();
  await profile.openMortgageComparisonProfile();
  expect(mockValues.get(SECURE_STORE_KEYS.mortgageComparisonProfile)).toBe('{malformed');
  expect(mockWrite).not.toHaveBeenCalled();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
});


test('clearing Rates scope preserves a buying scenario exactly, including costs and offset', async () => {
  mockValues.set(SECURE_STORE_KEYS.userRateScenario, JSON.stringify({ version: 4,
    mortgage: { mode: 'buy', propertyValue: '900000', deposit: '250000', costs: '10000', currentRate: '6.74', years: '25' },
    projections: { mortgage: { offsetBalance: '45000' } },
  }));
  const { profile } = boot();
  await profile.openMortgageComparisonProfile();
  const before = JSON.parse(mockValues.get(SECURE_STORE_KEYS.customerProfile)!).inputState.scenario;
  expect(before.mortgage.mode).toBe('buy');
  profile.clearSavedMortgageComparison();
  await profile.openMortgageComparisonProfile();
  const after = JSON.parse(mockValues.get(SECURE_STORE_KEYS.customerProfile)!).inputState.scenario;
  expect(after).toEqual(before);
});

test('clearing Rates scope retains a newer pending loan edit instead of replaying the committed amount', async () => {
  const { profile } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  await profile.openMortgageComparisonProfile();
  profile.saveMortgageComparisonInputs({ ...comparison, loanAmount: '700000' });
  profile.clearSavedMortgageComparison();
  await profile.openMortgageComparisonProfile();
  const restarted = boot();
  await restarted.profile.openMortgageComparisonProfile();
  expect(restarted.profile.useMortgageComparisonProfile.getState().profile.inputs).toEqual({ ...comparison, loanAmount: '700000', lvr: '' });
});
