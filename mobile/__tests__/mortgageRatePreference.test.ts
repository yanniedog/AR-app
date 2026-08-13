import {
  CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
  DEFAULT_PREFS,
  migratedMortgageRatePreference,
} from '../src/data/storeTypes';

describe('comparison-rate default migration', () => {
  it('defaults new installs to comparison rate', () => {
    expect(DEFAULT_PREFS.mortgageRateMetric).toBe('comparison');
    expect(DEFAULT_PREFS.mortgageRatePreferenceVersion)
      .toBe(CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION);
  });

  it('moves a legacy persisted headline default to comparison once', () => {
    expect(migratedMortgageRatePreference({ mortgageRateMetric: 'headline' })).toEqual({
      mortgageRateMetric: 'comparison',
      mortgageRatePreferenceVersion: CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
    });
  });

  it('respects a user choice after the migration marker is stored', () => {
    expect(migratedMortgageRatePreference({
      mortgageRateMetric: 'headline',
      mortgageRatePreferenceVersion: CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
    })).toEqual({
      mortgageRateMetric: 'headline',
      mortgageRatePreferenceVersion: CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
    });
  });
});
