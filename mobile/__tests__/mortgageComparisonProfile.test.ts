import type { MortgageComparisonInputs } from '../src/data/mortgageComparison';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';

let mockStored: string | null = null;
const mockRead = jest.fn(async () => mockStored);
const mockWrite = jest.fn(async (_key: string, value: string) => { mockStored = value; });
jest.mock('../src/lib/secureStoreValue', () => ({
  readSecureStoreValue: () => mockRead(),
  writeSecureStoreValue: (key: string, value: string) => mockWrite(key, value),
}));

const comparison: MortgageComparisonInputs = {
  loanAmount: '540k', lvr: '80.0025', lvrMode: 'funds', fundsType: 'offset',
  fundsAvailable: '52k', propertyValue: '750k',
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
  mockStored = null;
  jest.clearAllMocks();
});

test('restores exact saved inputs and purpose/repayment through a cold start and Rates initialization', async () => {
  const first = boot();
  await first.profile.openMortgageComparisonProfile();
  first.profile.saveMortgageComparisonInputs(comparison);
  first.profile.saveMortgageComparisonFacets(facets);
  await first.profile.openMortgageComparisonProfile();
  expect(mockWrite).toHaveBeenLastCalledWith(SECURE_STORE_KEYS.mortgageComparisonProfile, expect.any(String));

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
  const durable = mockStored;
  const active = session.captureRatesSession();
  live.setMortgageComparisonInputs({ loanAmount: '400000', lvr: '65' });
  session.updateRatesSection('Mortgage', current => ({ filters: { ...current.filters, loanPurposes: ['INVESTMENT'] } }));
  live.setMortgageComparisonInputs(comparison);
  session.restoreRatesSession(active);
  expect(mockStored).toBe(durable);
  expect(profile.useMortgageComparisonProfile.getState().profile).toEqual({ inputs: comparison, facets });
});

test('clearing the saved comparison remains cleared after reopening', async () => {
  const { profile } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  profile.saveMortgageComparisonFacets(facets);
  await profile.openMortgageComparisonProfile();
  profile.clearSavedMortgageComparison();
  await profile.openMortgageComparisonProfile();

  const restarted = boot();
  await restarted.profile.openMortgageComparisonProfile();
  expect(restarted.profile.useMortgageComparisonProfile.getState().profile).toEqual({
    inputs: { loanAmount: '', lvr: '' },
    facets: { loanPurposes: [], repaymentTypes: [] },
  });
});

test('an unreadable encrypted record is retained, and queued edits survive write retry', async () => {
  mockStored = '{malformed';
  const { profile } = boot();
  profile.saveMortgageComparisonInputs(comparison);
  await profile.openMortgageComparisonProfile();
  expect(mockWrite).not.toHaveBeenCalled();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
  expect(mockStored).toBe('{malformed');

  mockStored = JSON.stringify({ version: 1, inputs: { loanAmount: '', lvr: '' }, facets });
  mockWrite.mockRejectedValueOnce(new Error('Locked'));
  await profile.openMortgageComparisonProfile();
  expect(profile.useMortgageComparisonProfile.getState().status).toBe('unavailable');
  await profile.openMortgageComparisonProfile();
  expect(JSON.parse(mockStored!)).toEqual({ version: 1, inputs: comparison, facets });
});
