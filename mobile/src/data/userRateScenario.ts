import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { EMPTY_CALC, normalizeCalcInputs, type CalcInputs } from './calc';

const STORAGE_KEY = 'user-rate-scenario-v1';

export interface DepositScenario {
  balance: string;
  currentRate: string;
}

export interface UserRateScenario {
  version: 1;
  mortgage: CalcInputs;
  savings: DepositScenario;
  termDeposit: DepositScenario;
}

export const EMPTY_USER_RATE_SCENARIO: UserRateScenario = {
  version: 1,
  mortgage: { ...EMPTY_CALC },
  savings: { balance: '', currentRate: '' },
  termDeposit: { balance: '', currentRate: '' },
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
    version: 1,
    mortgage: normalizeCalcInputs(obj.mortgage),
    savings: deposit(obj.savings),
    termDeposit: deposit(obj.termDeposit),
  };
}

/** Financial inputs stay encrypted at rest on native devices and memory-only on web. */
export async function loadUserRateScenario(): Promise<UserRateScenario> {
  if (Platform.OS === 'web') return { ...EMPTY_USER_RATE_SCENARIO };
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? normalizeUserRateScenario(JSON.parse(raw)) : { ...EMPTY_USER_RATE_SCENARIO };
  } catch {
    return { ...EMPTY_USER_RATE_SCENARIO };
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
  const current = await loadUserRateScenario();
  const currentHasValue = Object.entries(current.mortgage).some(
    ([key, value]) => key !== 'mode' && typeof value === 'string' && value.trim().length > 0,
  );
  if (currentHasValue) return;
  await saveUserRateScenario({ ...current, mortgage: normalized });
}
