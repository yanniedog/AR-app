import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { EMPTY_CALC, normalizeCalcInputs, type CalcInputs } from './calc';
import {
  EMPTY_PROJECTION_INPUTS_BY_SECTION,
  normalizeProjectionInputsBySection,
  type ProjectionInputsBySection,
} from './projectionScenario';
import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';

const STORAGE_KEY = SECURE_STORE_KEYS.userRateScenario;

export interface DepositScenario {
  balance: string;
  currentRate: string;
}

export type ScenarioSection = 'mortgage' | 'savings' | 'termDeposit';

/** Sentinel kept out of the CDR provider namespace for an unlisted institution. */
export const NOT_LISTED_PROVIDER = '__not_listed__';

export interface CurrentProductReference {
  /** Exact CDR provider name, the not-listed sentinel, or empty until selected. */
  provider: string;
  /** Optional exact catalogue match. The entered balance/rate remain authoritative. */
  productKey: string;
  rateIndex: number | null;
}

export type CurrentProductReferences = Record<ScenarioSection, CurrentProductReference>;

export type OffsetAvailabilityOverride = 'auto' | 'yes' | 'no';
export type SwitchFundingMethod = 'cash-or-offset' | 'new-loan';

/**
 * User-editable switch assumptions. Empty fee fields defer to published CDR
 * evidence for the selected current and target products.
 */
export interface MortgageSwitchInputs {
  currentBankExitFees: string;
  applicationFees: string;
  valuationFees: string;
  settlementFees: string;
  governmentAndLegalFees: string;
  otherUpfrontFees: string;
  cashback: string;
  fundingMethod: SwitchFundingMethod;
  targetOffsetAvailable: OffsetAvailabilityOverride;
}

export interface UserRateScenario {
  version: 3;
  mortgage: CalcInputs;
  savings: DepositScenario;
  termDeposit: DepositScenario;
  projections: ProjectionInputsBySection;
  currentProducts: CurrentProductReferences;
  mortgageSwitch: MortgageSwitchInputs;
}

const EMPTY_CURRENT_PRODUCT_REFERENCE: CurrentProductReference = {
  provider: '',
  productKey: '',
  rateIndex: null,
};

export const EMPTY_MORTGAGE_SWITCH_INPUTS: MortgageSwitchInputs = {
  currentBankExitFees: '',
  applicationFees: '',
  valuationFees: '',
  settlementFees: '',
  governmentAndLegalFees: '',
  otherUpfrontFees: '',
  cashback: '',
  fundingMethod: 'cash-or-offset',
  targetOffsetAvailable: 'auto',
};

export const EMPTY_USER_RATE_SCENARIO: UserRateScenario = {
  version: 3,
  mortgage: { ...EMPTY_CALC },
  savings: { balance: '', currentRate: '' },
  termDeposit: { balance: '', currentRate: '' },
  projections: {
    mortgage: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.mortgage },
    savings: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.savings },
    termDeposit: { ...EMPTY_PROJECTION_INPUTS_BY_SECTION.termDeposit },
  },
  currentProducts: {
    mortgage: { ...EMPTY_CURRENT_PRODUCT_REFERENCE },
    savings: { ...EMPTY_CURRENT_PRODUCT_REFERENCE },
    termDeposit: { ...EMPTY_CURRENT_PRODUCT_REFERENCE },
  },
  mortgageSwitch: { ...EMPTY_MORTGAGE_SWITCH_INPUTS },
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
  const productReference = (input: unknown): CurrentProductReference => {
    const item = input && typeof input === 'object' ? input as Partial<CurrentProductReference> : {};
    const provider = typeof item.provider === 'string' ? item.provider.trim() : '';
    const productKey = provider && provider !== NOT_LISTED_PROVIDER && typeof item.productKey === 'string'
      ? item.productKey
      : '';
    const rateIndex = productKey && Number.isInteger(item.rateIndex) && Number(item.rateIndex) >= 0
      ? Number(item.rateIndex)
      : null;
    return { provider, productKey, rateIndex };
  };
  const references = obj.currentProducts && typeof obj.currentProducts === 'object'
    ? obj.currentProducts as Partial<CurrentProductReferences>
    : {};
  const switchInput = obj.mortgageSwitch && typeof obj.mortgageSwitch === 'object'
    ? obj.mortgageSwitch as Partial<MortgageSwitchInputs>
    : {};
  const switchString = (key: keyof Omit<MortgageSwitchInputs, 'targetOffsetAvailable' | 'fundingMethod'>): string =>
    typeof switchInput[key] === 'string' ? switchInput[key] : '';
  return {
    version: 3,
    mortgage: normalizeCalcInputs(obj.mortgage),
    savings: deposit(obj.savings),
    termDeposit: deposit(obj.termDeposit),
    projections: normalizeProjectionInputsBySection(obj.projections),
    currentProducts: {
      mortgage: productReference(references.mortgage),
      savings: productReference(references.savings),
      termDeposit: productReference(references.termDeposit),
    },
    mortgageSwitch: {
      currentBankExitFees: switchString('currentBankExitFees'),
      applicationFees: switchString('applicationFees'),
      valuationFees: switchString('valuationFees'),
      settlementFees: switchString('settlementFees'),
      governmentAndLegalFees: switchString('governmentAndLegalFees'),
      otherUpfrontFees: switchString('otherUpfrontFees'),
      cashback: switchString('cashback'),
      fundingMethod: switchInput.fundingMethod === 'new-loan' ? 'new-loan' : 'cash-or-offset',
      targetOffsetAvailable: switchInput.targetOffsetAvailable === 'yes' || switchInput.targetOffsetAvailable === 'no'
        ? switchInput.targetOffsetAvailable
        : 'auto',
    },
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
