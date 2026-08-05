import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { EMPTY_CALC, normalizeCalcInputs, type CalcInputs } from './calc';
import {
  EMPTY_PROJECTION_INPUTS_BY_SECTION,
  normalizeProjectionInputsBySection,
  type ProjectionInputsBySection,
} from './projectionScenario';

const STORAGE_KEY = 'user-rate-scenario-v1';

export interface DepositScenario {
  balance: string;
  currentRate: string;
}

export interface UserRateScenario {
  version: 2;
  mortgage: CalcInputs;
  savings: DepositScenario;
  termDeposit: DepositScenario;
  projections: ProjectionInputsBySection;
}

export const EMPTY_USER_RATE_SCENARIO: UserRateScenario = {
  version: 2,
  mortgage: { ...EMPTY_CALC },
  savings: { balance: '', currentRate: '' },
  termDeposit: { balance: '', currentRate: '' },
  projections: {
    mortgage: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.mortgage },
    savings: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.savings },
    termDeposit: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.termDeposit },
  },
};

export function normalizeUserRateScenario(value: unknown): UserRateScenario {
  const obj = value && typeof value === 'object' ? value as Partial<UserRateScenario> : {};
  const deposit = (input: unknown): DepositScenario => {
    const item = input && typeof input === 'object' ? input as Partial<DepositScenario> : {};
    return {
      balance: typeof item.balance === 'string' ? item.balance : '',
      currentRate: typeof item.currentRate === 'string' ? item.currentRate : '',
    };
  };
  return {
    version: 2,
    mortgage: normalizeCalcInputs(obj.mortgage),
    savings: deposit(obj.savings),
    termDeposit: deposit(obj.termDeposit),
    projections: normalizeProjectionInputsBySection(obj.projections),
  };
}

/** Financial inputs stay encrypted at rest on native devices and memory-only on web. */
export async function loadUserRateScenario(): Promise<UserRateScenario> {
  if (Platform.OS === 'web') return normalizeUserRateScenario(undefined);
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? normalizeUserRateScenario(JSON.parse(raw)) : normalizeUserRateScenario(undefined);
  } catch (error) {
    throw new Error(`Unable to read the encrypted rate scenario: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveUserRateScenario(value: UserRateScenario): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalizeUserRateScenario(value)), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
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
