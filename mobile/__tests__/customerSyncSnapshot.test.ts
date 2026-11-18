import { customerSyncSnapshot, customerProfileFromSnapshot } from '../src/data/customerSyncSnapshot';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import type { CustomerProfile } from '../src/data/customerProfile';

const profile: CustomerProfile = { version: 1, revision: 7, answers: {}, definitions: {}, negotiatedTerms: [],
  legacyScenario: { rawOriginal: 'local-only' }, inputState: {
    version: 1, scenario: normalizeUserRateScenario({ mortgage: { loanBalance: '650000' } }),
    comparison: { lvr: '', facets: { loanPurposes: [], repaymentTypes: [] } },
    conflicts: [], legacyComparison: { original: 'local-only' },
  } };

test('exports only admitted inputs and selected preferences, never migration evidence or consent', () => {
  const document = customerSyncSnapshot(profile, DEFAULT_PREFS);
  const encoded = JSON.stringify(document);
  expect(encoded).toContain('650000');
  for (const excluded of ['legacyScenario', 'legacyComparison', 'local-only', 'revision', 'privacyChoiceVersion', 'appLockEnabled', 'notificationsEnabled', 'crashReportsEnabled']) {
    expect(encoded).not.toContain(excluded);
  }
});

test('restoration validates financial state while retaining local recovery originals', () => {
  const restored = customerProfileFromSnapshot(customerSyncSnapshot(profile, DEFAULT_PREFS), profile);
  expect(restored.inputState?.scenario.mortgage.loanBalance).toBe('650000');
  expect(restored.legacyScenario).toBe(profile.legacyScenario);
  expect(restored.inputState?.legacyComparison).toBe(profile.inputState?.legacyComparison);
  expect(() => customerProfileFromSnapshot({ customer: { version: 1 } }, profile)).toThrow();
  expect(() => customerProfileFromSnapshot({ customer: { version: 1, answers: {}, definitions: {}, negotiatedTerms: [] } }, profile)).toThrow();
});

test('a genuine new installation has no financial edits to conflict with cloud restoration', () => {
  const empty: CustomerProfile = { ...profile, answers: {}, definitions: {}, negotiatedTerms: [], inputState: {
    ...profile.inputState!, scenario: normalizeUserRateScenario(undefined), comparison: { lvr: '', facets: { loanPurposes: [], repaymentTypes: [] } },
  } };
  expect(customerSyncSnapshot(empty, DEFAULT_PREFS)).toEqual({});
  expect(customerSyncSnapshot(empty, { ...DEFAULT_PREFS, themeMode: 'dark' })).not.toEqual({});
  const enteredZero = { ...empty, inputState: { ...empty.inputState!, scenario: normalizeUserRateScenario({ savings: { balance: '0' } }) } };
  expect(customerSyncSnapshot(enteredZero, DEFAULT_PREFS)).not.toEqual({});
});
