import type { PublicCondition, PublicProgramme, RateScenario } from './publicRateModel';

export interface PublicCostFee {
  feeId: string;
  kind: 'upfront' | 'recurring' | 'switching' | 'cashback';
  amount?: string;
  atMonth?: number;
  everyMonths?: number;
  funding?: 'cash' | 'financed' | 'offset';
  conditions: PublicCondition[];
  evidenceIds: string[];
  origin: 'public' | 'user';
}
interface CostBase {
  asOf: string;
  comparisonMonths?: number;
  comparisonDays?: number;
  rateBehaviour: 'variable' | 'fixed';
  /** Explicit local assumption; it never forecasts an undisclosed variable change. */
  holdCurrentRate: boolean;
  feesKnown: boolean;
  fees: PublicCostFee[];
  rateScenario?: RateScenario;
  programme?: PublicProgramme;
  fixedPeriodMonths?: number;
}
export type PublicCostScenario = CostBase & (
  | { section: 'Mortgage'; principal: string; remainingTermMonths: number; repayment: 'principal_and_interest' | 'interest_only'; offsetBalance?: string; extraMonthlyRepayment?: string; offsetSupported?: boolean }
  | { section: 'Savings'; startingBalance: string; monthlyContribution?: string; monthlyWithdrawal?: string; interestPayment: 'monthly' | 'quarterly' | 'annually' | 'maturity' | 'daily' | 'unknown'; interestBasis?: 'monthly_nominal' | 'actual_365'; }
  | { section: 'TD'; deposit: string; quotedTermMonths?: number; quotedTermDays?: number; interestPayment: 'monthly' | 'quarterly' | 'annually' | 'maturity' | 'unknown'; reinvestPaidInterest?: boolean; interestBasis?: 'monthly_nominal' | 'actual_365'; }
);
export interface PublicCostPoint {
  month: number;
  balance: string;
  interest: string;
  principalRepaid: string;
  knownFees: string;
  cashback: string;
}
export interface PublicCostEstimate {
  completeness: 'complete' | 'partial' | 'unsupported' | 'stale';
  requestedMonths: number;
  projectedMonths: number;
  requestedDays?: number;
  projectedDays?: number;
  interest?: string;
  knownFees?: string;
  fees?: string;
  cashback?: string;
  interestAndFeeCost?: string;
  knownCostSubtotal?: string;
  netReturn?: string;
  knownReturnSubtotal?: string;
  principalRepaid?: string;
  endingBalance?: string;
  endingOffset?: string;
  points: PublicCostPoint[];
  reasonCodes: string[];
  assumptions: string[];
  evidenceIds: string[];
  verifiedCurrent: boolean;
}
