import { Platform } from 'react-native';

import { EMPTY_CALC, normalizeCalcInputs, type CalcInputs } from './calc';
import {
  EMPTY_PROJECTION_INPUTS_BY_SECTION,
  normalizeProjectionInputsBySection,
  type ProjectionInputsBySection,
} from './projectionScenario';
import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';
import {
  readSecureStoreValue,
  RecoveredIncompleteSecureStoreValueError,
  writeSecureStoreValue,
} from '../lib/secureStoreValue';

const STORAGE_KEY = SECURE_STORE_KEYS.userRateScenario;
const RECOVERY_WARNING =
  'Encrypted scenario inputs were incomplete and have been reset on this device. You can enter them again.';
let pendingRecoveryWarning: string | null = null;

export function consumeUserRateScenarioRecoveryWarning(): string | null {
  const warning = pendingRecoveryWarning;
  pendingRecoveryWarning = null;
  return warning;
}

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
  /** Semantic public offer identity. Array positions are compatibility hints only. */
  offerId?: string;
  programmeId?: string;
}

export type CurrentProductReferences = Record<ScenarioSection, CurrentProductReference>;

export interface LocalRateInputs {
  mode: 'entered' | 'reference';
  /** A named public reference family selected explicitly by the user. */
  referenceId: string;
  /** Signed total adjustment in percentage points; public discounts are not added. */
  totalAdjustment: string;
  /** Historical source use is a local assumption, never current verified pricing. */
  allowHistorical: boolean;
  referenceChangeAlerts: boolean;
  /** Explicit assumptions for this existing loan; never copied from source conditions. */
  referenceScenario: Partial<Record<'purpose' | 'repayment' | 'package' | 'customerCategory' | 'channel' | 'termMonths' | 'termDays', string>>;
}

export const EMPTY_LOCAL_RATE_INPUTS: LocalRateInputs = {
  mode: 'entered', referenceId: '', totalAdjustment: '', allowHistorical: false, referenceChangeAlerts: false, referenceScenario: {},
};

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
  version: 4;
  mortgage: CalcInputs;
  savings: DepositScenario;
  termDeposit: DepositScenario;
  projections: ProjectionInputsBySection;
  currentProducts: CurrentProductReferences;
  mortgageSwitch: MortgageSwitchInputs;
  localRates: Record<ScenarioSection, LocalRateInputs>;
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
  version: 4,
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
  localRates: {
    mortgage: { ...EMPTY_LOCAL_RATE_INPUTS },
    savings: { ...EMPTY_LOCAL_RATE_INPUTS },
    termDeposit: { ...EMPTY_LOCAL_RATE_INPUTS },
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
  const productReference = (input: unknown): CurrentProductReference => {
    const item = input && typeof input === 'object' ? input as Partial<CurrentProductReference> : {};
    const provider = typeof item.provider === 'string' ? item.provider.trim() : '';
    const productKey = provider && provider !== NOT_LISTED_PROVIDER && typeof item.productKey === 'string'
      ? item.productKey
      : '';
    const rateIndex = productKey && Number.isInteger(item.rateIndex) && Number(item.rateIndex) >= 0
      ? Number(item.rateIndex)
      : null;
    return {
      provider, productKey, rateIndex,
      ...(productKey && typeof item.offerId === 'string' && item.offerId ? { offerId: item.offerId } : {}),
      ...(productKey && typeof item.programmeId === 'string' && item.programmeId ? { programmeId: item.programmeId } : {}),
    };
  };
  const references = obj.currentProducts && typeof obj.currentProducts === 'object'
    ? obj.currentProducts as Partial<CurrentProductReferences>
    : {};
  const switchInput = obj.mortgageSwitch && typeof obj.mortgageSwitch === 'object'
    ? obj.mortgageSwitch as Partial<MortgageSwitchInputs>
    : {};
  const switchString = (key: keyof Omit<MortgageSwitchInputs, 'targetOffsetAvailable' | 'fundingMethod'>): string =>
    typeof switchInput[key] === 'string' ? switchInput[key] : '';
  const localRates = obj.localRates && typeof obj.localRates === 'object' ? obj.localRates : {};
  const localRate = (key: ScenarioSection): LocalRateInputs => {
    const input = (localRates as Partial<Record<ScenarioSection, LocalRateInputs>>)[key];
    const referenceScenario: LocalRateInputs['referenceScenario'] = {};
    for (const field of ['purpose', 'repayment', 'package', 'customerCategory', 'channel', 'termMonths', 'termDays'] as const) {
      const value = input?.referenceScenario?.[field];
      if (typeof value === 'string' && value.trim()) referenceScenario[field] = value.trim();
    }
    return {
      mode: input?.mode === 'reference' ? 'reference' : 'entered',
      referenceId: typeof input?.referenceId === 'string' ? input.referenceId : '',
      totalAdjustment: typeof input?.totalAdjustment === 'string' ? input.totalAdjustment : '',
      allowHistorical: input?.allowHistorical === true,
      referenceChangeAlerts: input?.referenceChangeAlerts === true,
      referenceScenario,
    };
  };
  return {
    version: 4,
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
    localRates: { mortgage: localRate('mortgage'), savings: localRate('savings'), termDeposit: localRate('termDeposit') },
  };
}

/** Financial inputs stay encrypted at rest on native devices and memory-only on web. */
export async function loadUserRateScenario(): Promise<UserRateScenario> {
  if (Platform.OS === 'web') return normalizeUserRateScenario(undefined);
  try {
    const raw = await readSecureStoreValue(STORAGE_KEY);
    return raw ? normalizeUserRateScenario(JSON.parse(raw)) : normalizeUserRateScenario(undefined);
  } catch (error) {
    if (error instanceof RecoveredIncompleteSecureStoreValueError) {
      pendingRecoveryWarning = RECOVERY_WARNING;
      return normalizeUserRateScenario(undefined);
    }
    throw new Error(`Unable to read the encrypted rate scenario: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveUserRateScenario(value: UserRateScenario): Promise<void> {
  if (Platform.OS === 'web') return;
  await writeSecureStoreValue(STORAGE_KEY, JSON.stringify(normalizeUserRateScenario(value)));
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
