import { validateProfile, type CustomerProfile } from './customerProfile';
import type { Prefs } from './storeTypes';
import { DEFAULT_PREFS } from './storeTypes';
import { normalizeUserRateScenario } from './userRateScenarioModel';
import { customerSyncValuesEqual, validateSyncDocument, type SyncDocument } from './customerSyncMerge';

/** Only customer-authored data and presentation preferences cross the sync boundary.
 * Migration originals, permission consents, credentials, diagnostics and caches do not.
 */
const preferenceKeys = ['themeMode', 'defaultSection', 'includeNonStandard', 'ratesPageSize',
  'depositRankMetric', 'mortgageRateMetric', 'interests', 'profileFilters'] as const;

export function customerSyncSnapshot(profile: CustomerProfile, preferences: Prefs): SyncDocument {
  validateProfile(profile);
  const customer = {
    version: profile.version, answers: profile.answers, definitions: profile.definitions, negotiatedTerms: profile.negotiatedTerms,
    ...(profile.inputState ? { inputState: {
      version: profile.inputState.version, scenario: profile.inputState.scenario, comparison: profile.inputState.comparison,
    } } : {}),
  };
  const prefs = validateSyncDocument(JSON.parse(JSON.stringify(Object.fromEntries(preferenceKeys.map(key => [key, preferences[key]])))));
  const defaultPrefs = validateSyncDocument(JSON.parse(JSON.stringify(Object.fromEntries(preferenceKeys.map(key => [key, DEFAULT_PREFS[key]])))));
  const emptyInputs = Object.keys(profile.answers).length === 0 && Object.keys(profile.definitions).length === 0
    && profile.negotiatedTerms.length === 0 && (!profile.inputState ||
      customerSyncValuesEqual(profile.inputState.scenario as unknown as SyncDocument, normalizeUserRateScenario(undefined) as unknown as SyncDocument)
      && customerSyncValuesEqual(profile.inputState.comparison as unknown as SyncDocument, { lvr: '', facets: { loanPurposes: [], repaymentTypes: [] } }));
  // A reinstall has defaults but no entered data. Treating those defaults as
  // edits would conflict with the very remote inputs it needs to restore.
  if (emptyInputs && customerSyncValuesEqual(prefs, defaultPrefs)) return {};
  return validateSyncDocument(JSON.parse(JSON.stringify({ customer, preferences: prefs })));
}

export function customerProfileFromSnapshot(document: SyncDocument, current: CustomerProfile): CustomerProfile {
  validateSyncDocument(document);
  const customer = document.customer as unknown as Partial<CustomerProfile> | undefined;
  if (!customer || customer.version !== 1) throw new Error('Invalid Google customer profile.');
  const state = customer.inputState;
  // Cloud v1 is introduced with shared inputs. Missing financial state is an
  // incomplete snapshot, never authority to remove the current input store.
  if (!state) throw new Error('Invalid Google customer profile.');
  // Explicit projection: a remote document cannot replace local migration evidence.
  return validateProfile({
    version: 1, revision: current.revision,
    answers: customer.answers, definitions: customer.definitions, negotiatedTerms: customer.negotiatedTerms,
    legacyScenario: current.legacyScenario,
    ...(state ? { inputState: {
      version: state.version, scenario: state.scenario, comparison: state.comparison,
      conflicts: current.inputState?.conflicts ?? [], legacyComparison: current.inputState?.legacyComparison ?? null,
    } } : {}),
  });
}
