import { Platform } from 'react-native';
import { loadCustomerProfile, updateCustomerProfile } from './customerProfileStorage';
import { normalizeCalcInputs, type CalcInputs } from './calc';
import { normalizeUserRateScenario, type UserRateScenario } from './userRateScenarioModel';
export * from './userRateScenarioModel';

export function consumeUserRateScenarioRecoveryWarning(): string | null { return null; }

/** Financial inputs stay encrypted at rest on native devices and memory-only on web. */
export async function loadUserRateScenario(): Promise<UserRateScenario> {
  if (Platform.OS === 'web') return normalizeUserRateScenario(undefined);
  try {
    const profile = await loadCustomerProfile();
    return normalizeUserRateScenario(profile.inputState!.scenario);
  } catch (error) {
    throw new Error(`Unable to read the encrypted rate scenario: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Rebase only edited leaves, so another task's concurrent edits survive. */
export function mergeScenarioChanges(current: UserRateScenario, previous: UserRateScenario, next: UserRateScenario): UserRateScenario {
  function merge(live: unknown, before: unknown, after: unknown): unknown {
    if (JSON.stringify(before) === JSON.stringify(after)) return live;
    if (before && after && live && typeof before === 'object' && typeof after === 'object' && typeof live === 'object'
      && !Array.isArray(before) && !Array.isArray(after)) {
      const result = { ...live as Record<string, unknown> };
      for (const key of Object.keys(after)) result[key] = merge(result[key], (before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]);
      return result;
    }
    return after;
  }
  return normalizeUserRateScenario(merge(current, previous, next));
}
export async function saveUserRateScenario(value: UserRateScenario, previous?: UserRateScenario): Promise<void> {
  if (Platform.OS === 'web') return;
  await updateCustomerProfile(profile => ({ ...profile, inputState: { ...profile.inputState!, scenario: previous
    ? mergeScenarioChanges(profile.inputState!.scenario, previous, value) : normalizeUserRateScenario(value) } }));
}

export async function migrateLegacyCalculatorInputs(legacy: Partial<CalcInputs> | null | undefined): Promise<void> {
  if (Platform.OS === 'web' || !legacy) return;
  const normalized = normalizeCalcInputs(legacy);
  const hasLegacyValue = Object.entries(normalized).some(
    ([key, value]) => key !== 'mode' && typeof value === 'string' && value.trim().length > 0,
  );
  if (!hasLegacyValue) return;
  let current: UserRateScenario;
  try {
    current = await loadUserRateScenario();
  } catch {
    // A transient or corrupt encrypted read must never be replaced by migration data.
    return;
  }
  const currentHasValue = Object.entries(current.mortgage).some(
    ([key, value]) => key !== 'mode' && typeof value === 'string' && value.trim().length > 0,
  );
  if (currentHasValue) return;
  await saveUserRateScenario({ ...current, mortgage: normalized });
}
