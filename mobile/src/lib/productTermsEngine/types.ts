/** Declarative calculation inputs. A source-evidence envelope alone is not this contract. */
import type { SavingsAssessment, SavingsContribution, SavingsRateSchedule } from './savingsTypes';
import type { TdLifecycle } from './tdTypes';
export const EVALUATOR_VERSION = 'product-terms-engine-v3' as const;
export const SAVINGS_EVALUATOR_VERSION = 'product-terms-engine-v2' as const;
export const LEGACY_EVALUATOR_VERSION = 'product-terms-engine-v1' as const;
export type DecimalString = string;
export type ISODate = string;
export type Truth = 'meets' | 'does_not_meet' | 'needs_information';
export type Fact = { type: 'decimal'; value: string; unit: string } |
  { type: 'date' | 'text'; value: string } | { type: 'boolean'; value: boolean };
export type Facts = Record<string, Fact | undefined>;
type RuleBase = { id: string; evidenceIds?: string[] };
export type Rule = RuleBase & (
  | { op: 'and' | 'or'; rules: Rule[] }
  | { op: 'not'; rule: Rule }
  | { op: 'compare'; field: string; comparison: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; expected: Fact }
  | { op: 'unknown'; reason: string }
);
export interface RuleTrace { id: string; status: Truth; reason?: string; evidenceIds: string[]; children?: RuleTrace[] }
export interface EligibilityResult { status: Truth; trace: RuleTrace; reasons: string[] }
export interface EvidenceReference {
  id: string;
  clauseId: string;
  documentSha256: string;
  sourceUrl: string;
  locator: string;
  quote: string;
  quoteSha256: string;
}
export type ReviewState = 'verified' | 'unknown' | 'conflict';
export type Rounding = 'half_up' | 'half_even' | 'toward_zero';
export interface InterestPolicy {
  dayCount: 'actual_365_fixed' | 'actual_actual';
  balanceBasis: 'closing_balance_before_posted_interest';
  eventOrder: 'ordered_events_then_accrual_then_posting';
  dailyAccrualScale: number | null;
  /** Some banks round a daily percentage rate before multiplying, not a fraction. */
  dailyRateRounding: { scale: number; unit: 'fraction' | 'percent'; mode: Rounding } | null;
  accrualRounding: Rounding;
  postingRounding: Rounding;
  postingDates: ISODate[];
  offset: 'none' | 'capped_at_balance';
  evidenceIds: string[];
}
export interface LedgerContract {
  schemaVersion: 1;
  evaluatorVersion: typeof EVALUATOR_VERSION | typeof LEGACY_EVALUATOR_VERSION | typeof SAVINGS_EVALUATOR_VERSION;
  id: string;
  productId: string;
  direction: 'asset' | 'liability';
  currency: 'AUD';
  /** This is a separately reviewed executable contract, never inferred from fetch success. */
  review: {
    applicability: ReviewState;
    materialTerms: ReviewState;
    feeCoverage: ReviewState;
    rateSchedule: ReviewState;
    benchmarkSha256: string;
  };
  applicability: { cohortKey: string | null; from: ISODate | null; toExclusive: ISODate | null };
  evidence: EvidenceReference[];
  dependencyIds: string[];
  unsupportedTerms: string[];
  eligibility: Rule;
  interest: InterestPolicy;
  initialAnnualRate: DecimalString;
  initialRateEvidenceIds: string[];
  savingsSchedule?: SavingsRateSchedule;
  tdLifecycle?: TdLifecycle;
}
type EventBase = { id: string; date: ISODate; order: number };
export type LedgerEvent = EventBase & (
  | { type: 'cashflow'; delta: DecimalString; label: string }
  | { type: 'rate'; annualRate: DecimalString; evidenceIds: string[] }
  | { type: 'offset'; balance: DecimalString }
  | { type: 'fee'; chargeKey: string; evidenceIds: string[]; waiver?: Rule;
      amount: { type: 'fixed'; value: DecimalString } |
        { type: 'percentage'; fraction: DecimalString; basis: DecimalString; rounding: Rounding;
          minimum?: DecimalString; maximum?: DecimalString } }
);
export interface LedgerScenario {
  productId: string;
  cohortKey: string;
  startDate: ISODate;
  /** Accrual includes startDate and excludes endDateExclusive. */
  endDateExclusive: ISODate;
  openingBalance: DecimalString;
  initialOffset: DecimalString;
  facts: Facts;
  events: LedgerEvent[];
  assumptions: string[];
  savingsAssessments?: SavingsAssessment[];
}
export interface LedgerEntry {
  date: ISODate;
  id: string;
  type: LedgerEvent['type'] | 'interest_accrual' | 'interest_posting';
  amount: DecimalString | null;
  balance: DecimalString;
  evidenceIds: string[];
  note?: string;
  savingsContributions?: SavingsContribution[];
}
export interface LedgerTotals {
  openingBalance: DecimalString;
  externalCashflowNet: DecimalString;
  /** Repayment allocation is not inferred from a payment's total amount. */
  principalRepaid: null;
  externalInflows: DecimalString;
  externalOutflows: DecimalString;
  interestAccrued: DecimalString;
  interestPosted: DecimalString;
  interestUnposted: DecimalString;
  interestRoundingAdjustment: DecimalString;
  feesCharged: DecimalString;
  closingBalance: DecimalString;
}
export interface CalculationReceipt {
  schemaVersion: 1;
  evaluatorVersion: typeof EVALUATOR_VERSION;
  inputSha256: string;
  contractId: string;
  dependencies: string[];
  status: 'complete' | 'incomplete' | 'unsupported';
  claimAvailable: boolean;
  issues: string[];
  assumptions: string[];
  eligibility: EligibilityResult | null;
  /** Null for rejected input. Incomplete results are evaluated known components, not guaranteed bounds. */
  totals: LedgerTotals | null;
  ledger: LedgerEntry[];
}
