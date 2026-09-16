import type { CalculationReceipt, LedgerContract, LedgerScenario } from './types';
import type { SavingsActivityKind } from './savingsActivityTypes';

export interface PortfolioFrame {
  id: string;
  currency: 'AUD';
  startDate: string;
  endDateExclusive: string;
  timezone: 'Australia/Sydney' | 'Australia/Hobart';
  settlement: 'same_civil_day';
  valuation: 'holding_with_accrued_interest';
  openingNetWorth: string;
  scopeCoverage: 'reviewed_complete' | 'unknown';
  externalFlows: { id: string; date: string; delta: string }[];
  externalFeeFunding: 'outside_frame_cost_adjustment';
  allowConditional: boolean;
  metric: 'terminal_net_worth' | 'net_interest_fee_cost';
}
export interface PortfolioAccount { id: string; timezone: PortfolioFrame['timezone']; contract: LedgerContract; scenario: LedgerScenario }
export interface PortfolioTransfer {
  id: string;
  from: string;
  to: string;
  date: string;
  status: 'cleared' | 'projected';
  order: number;
  amount: { type: 'fixed'; value: string } | { type: 'generated_cashflow'; occurrenceId: string };
  sourceLoan?: { type: 'redraw' };
  targetLoan?: { type: 'payment' | 'extra_payment'; obligationId?: string };
  evidenceIds: string[];
}
export interface PortfolioInput {
  schemaVersion: 1;
  frame: PortfolioFrame;
  accounts: PortfolioAccount[];
  transfers: PortfolioTransfer[];
  dependencyGraph: { from: string; to: string; date?: string }[];
  dependencyIds: string[];
  packages?: { id: string; memberAccountIds: string[]; debtorAccountId: string; from: string; toExclusive: string; evidenceIds: string[] }[];
  tdFeeRoutes?: { accountId: string; generalFees: 'external_only'; lifecycleOccurrenceId: 'td:break-fee'; evidenceIds: string[] }[];
  projectedTransferAssumption?: { id: string; acknowledged: true; transfersSha256: string };
  activityBindings?: { accountId: string; assessmentId: string; sourceAccountIds: string[]; evidenceIds: string[];
    entries: { sourceAccountId: string; sourceType: 'cashflow' | 'fee' | 'interest_posting'; sourceOccurrenceId: string; date: string; activityId: string;
      kind: SavingsActivityKind; classification: string | null; dateBasis: 'processed' | 'transaction'; status: 'settled' | 'pending'; originalPurchaseId?: string }[] }[];
  feeFundingRoutes?: { sourceAccountId: string; fundingAccountId: string; occurrenceId: string; date: string; order: number; status: 'cleared'; evidenceIds: string[] }[];
}
export interface TransferReceipt { id: string; date: string; from: string; to: string; amount: string; debitIdentity: string; creditIdentity: string; status: 'cleared' | 'projected' }
export interface PortfolioDay { date: string; netWorth: string | null; knownNetWorth: string; netInterestFeeCost: string | null; knownNetInterestFeeCost: string }
export interface PortfolioReceipt {
  fundedFees: { sourceAccountId: string; fundingAccountId: string; occurrenceId: string; date: string; amount: string; movementIdentity: string }[];
  assumptions: { id: string; kind: 'projected_transfer_schedule'; inputSha256: string }[];
  schemaVersion: 1;
  evaluatorVersion: string;
  inputSha256: string;
  completeness: 'factual_complete' | 'conditional_complete' | 'incomplete' | 'unsupported';
  issues: string[];
  accounts: Record<string, CalculationReceipt>;
  transfers: TransferReceipt[];
  days: PortfolioDay[];
  externalContributionNet: string;
  closingNetWorth: string | null;
  netInterestFeeCost: string | null;
}
export interface ComparisonInput { schemaVersion: 1; referenceId: string; alternatives: { id: string; input: PortfolioInput }[] }
export interface ComparisonReceipt {
  inputSha256: string;
  referenceId: string;
  available: boolean;
  conditional: boolean;
  metric: PortfolioFrame['metric'] | null;
  issues: string[];
  results: { id: string; receipt: PortfolioReceipt; advantage: string | null; rank: number | null; breakEven: { firstPositive: string | null; sustainedFrom: string | null; through: string | null; transient: boolean; tiedDates: string[] } | null }[];
}
