export type ProjectionFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type MortgageRateStructure = 'variable' | 'fixed';
export type SavingsRateStructure = 'ongoing' | 'conditional-bonus';

export interface ProjectionInputs {
  /** Optional historical reconstruction anchor. ISO date, balance and rate must all be supplied. */
  startDate: string;
  startBalance: string;
  startRate: string;
  /** Comparison window, capped at the remaining term or quoted maturity. */
  horizonYears: string;
  /** Mortgage repayment or savings contribution. */
  periodicAmount: string;
  periodicFrequency: ProjectionFrequency;
  /** Savings withdrawals. */
  withdrawalAmount: string;
  withdrawalFrequency: ProjectionFrequency;
  /** Mortgage offset assumptions. */
  offsetBalance: string;
  startOffsetBalance: string;
  offsetContributionAmount: string;
  offsetContributionFrequency: ProjectionFrequency;
  offsetBoostAmount: string;
  /** Additional mortgage repayments beyond the normal repayment. */
  extraRepaymentAmount: string;
  extraRepaymentFrequency: ProjectionFrequency;
  /** User-editable future-rate range. Empty values derive from the current rate. */
  lowerRate: string;
  higherRate: string;
  /** A fixed mortgage projection must stop when the known fixed period ends. */
  mortgageRateStructure: MortgageRateStructure;
  fixedPeriodMonths: string;
  /** Savings bonus rates step down to the entered ongoing rate. */
  savingsRateStructure: SavingsRateStructure;
  ongoingRate: string;
  bonusMonthsRemaining: string;
  bonusConditionsMet: boolean;
  bonusQualification: 'met' | 'unmet' | 'unknown';
  /** Explicit local assumption required for a variable-rate projection. */
  holdVariableRate: boolean;
  /** Optional explicit qualification assumptions; blank values remain unknown. */
  monthlyDeposit: string;
  withdrawals: string;
  balanceGrowth: string;
  cardTransactions: string;
  /** Term-deposit lifecycle assumptions. */
  termMonths: string;
  renewalRate: string;
  rollovers: string;
  reinvestInterest: boolean;
}

export type ProjectionInputsBySection = {
  mortgage: ProjectionInputs;
  savings: ProjectionInputs;
  termDeposit: ProjectionInputs;
};

export const EMPTY_PROJECTION_INPUTS: ProjectionInputs = {
  startDate: '',
  startBalance: '',
  startRate: '',
  horizonYears: '',
  periodicAmount: '',
  periodicFrequency: 'monthly',
  withdrawalAmount: '',
  withdrawalFrequency: 'monthly',
  offsetBalance: '',
  startOffsetBalance: '',
  offsetContributionAmount: '',
  offsetContributionFrequency: 'monthly',
  offsetBoostAmount: '',
  extraRepaymentAmount: '',
  extraRepaymentFrequency: 'monthly',
  lowerRate: '',
  higherRate: '',
  mortgageRateStructure: 'variable',
  fixedPeriodMonths: '',
  savingsRateStructure: 'ongoing',
  ongoingRate: '',
  bonusMonthsRemaining: '',
  bonusConditionsMet: false,
  bonusQualification: 'unknown',
  holdVariableRate: false,
  monthlyDeposit: '', withdrawals: '', balanceGrowth: '', cardTransactions: '',
  termMonths: '',
  renewalRate: '',
  rollovers: '0',
  reinvestInterest: true,
};

export const EMPTY_PROJECTION_INPUTS_BY_SECTION: ProjectionInputsBySection = {
  mortgage: { ...EMPTY_PROJECTION_INPUTS, horizonYears: '3' },
  savings: { ...EMPTY_PROJECTION_INPUTS, horizonYears: '1' },
  termDeposit: { ...EMPTY_PROJECTION_INPUTS },
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function frequency(value: unknown): ProjectionFrequency {
  return value === 'weekly' || value === 'fortnightly' ? value : 'monthly';
}

function mortgageRateStructure(value: unknown): MortgageRateStructure {
  return value === 'fixed' ? 'fixed' : 'variable';
}

function savingsRateStructure(value: unknown): SavingsRateStructure {
  return value === 'conditional-bonus' ? 'conditional-bonus' : 'ongoing';
}

export function normalizeProjectionInputs(value: unknown): ProjectionInputs {
  const input = value && typeof value === 'object'
    ? value as Partial<ProjectionInputs>
    : {};
  return {
    startDate: stringValue(input.startDate),
    startBalance: stringValue(input.startBalance),
    startRate: stringValue(input.startRate),
    horizonYears: stringValue(input.horizonYears),
    periodicAmount: stringValue(input.periodicAmount),
    periodicFrequency: frequency(input.periodicFrequency),
    withdrawalAmount: stringValue(input.withdrawalAmount),
    withdrawalFrequency: frequency(input.withdrawalFrequency),
    offsetBalance: stringValue(input.offsetBalance),
    startOffsetBalance: stringValue(input.startOffsetBalance),
    offsetContributionAmount: stringValue(input.offsetContributionAmount),
    offsetContributionFrequency: frequency(input.offsetContributionFrequency),
    offsetBoostAmount: stringValue(input.offsetBoostAmount),
    extraRepaymentAmount: stringValue(input.extraRepaymentAmount),
    extraRepaymentFrequency: frequency(input.extraRepaymentFrequency),
    lowerRate: stringValue(input.lowerRate),
    higherRate: stringValue(input.higherRate),
    mortgageRateStructure: mortgageRateStructure(input.mortgageRateStructure),
    fixedPeriodMonths: stringValue(input.fixedPeriodMonths),
    savingsRateStructure: savingsRateStructure(input.savingsRateStructure),
    ongoingRate: stringValue(input.ongoingRate),
    bonusMonthsRemaining: stringValue(input.bonusMonthsRemaining),
    bonusConditionsMet: input.bonusConditionsMet === true,
    bonusQualification: input.bonusQualification === 'met' || input.bonusQualification === 'unmet'
      ? input.bonusQualification
      : input.bonusConditionsMet === true ? 'met' : 'unknown',
    holdVariableRate: input.holdVariableRate === true,
    monthlyDeposit: stringValue(input.monthlyDeposit), withdrawals: stringValue(input.withdrawals),
    balanceGrowth: stringValue(input.balanceGrowth), cardTransactions: stringValue(input.cardTransactions),
    termMonths: stringValue(input.termMonths),
    renewalRate: stringValue(input.renewalRate),
    rollovers: stringValue(input.rollovers) || '0',
    reinvestInterest: input.reinvestInterest !== false,
  };
}

export function normalizeProjectionInputsBySection(value: unknown): ProjectionInputsBySection {
  const input = value && typeof value === 'object'
    ? value as Partial<ProjectionInputsBySection>
    : {};
  return {
    mortgage: normalizeProjectionInputs({ horizonYears: '3', ...input.mortgage }),
    savings: normalizeProjectionInputs({ horizonYears: '1', ...input.savings }),
    termDeposit: normalizeProjectionInputs(input.termDeposit),
  };
}
