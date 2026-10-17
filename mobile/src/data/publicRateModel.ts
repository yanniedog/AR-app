import type { SectionKey } from '../types';

/** Public pricing wire v1. Decimal strings always carry an explicit unit. */
export type PublicRateUnit = 'fraction_per_annum' | 'percentage_points' | 'basis_points';
export type PublicRateRole = 'payable' | 'reference' | 'discount' | 'margin' | 'bonus' | 'comparison' | 'reversion';
export interface PublicCondition {
  conditionId: string;
  field: string;
  operator: 'eq' | 'in' | 'bounds' | 'known';
  value?: string | boolean;
  values?: (string | boolean)[];
  minimum?: string;
  maximum?: string;
  minimumInclusive?: boolean;
  maximumInclusive?: boolean;
  description?: string;
  evidenceIds: string[];
}
export interface PublicComponent {
  componentId: string;
  role: PublicRateRole;
  value?: string;
  unit: PublicRateUnit;
  scopeId: string;
  conditions: PublicCondition[];
  evidenceIds: string[];
  source: { rawType: string; rawValue?: string; pointer: string };
  includedInPayable?: boolean;
  referenceId?: string;
}
export type PublicFormula =
  | { op: 'component'; componentId: string }
  | { op: 'add' | 'subtract'; operands: PublicFormula[] }
  | { op: 'alternatives'; choices: { conditions: PublicCondition[]; formula: PublicFormula }[] }
  | { op: 'tiered'; field: string; method: 'whole_balance' | 'per_tier'; tiers: PublicTier[] }
  | { op: 'cap'; value: string; formula: PublicFormula }
  | { op: 'from'; formula: PublicFormula }
  | { op: 'range'; minimum: PublicFormula; maximum: PublicFormula };
export interface PublicTier {
  minimum?: string;
  maximum?: string;
  minimumInclusive?: boolean;
  maximumInclusive?: boolean;
  formula: PublicFormula;
}
export interface PublicPhase {
  phaseId: string;
  startMonth: number;
  endMonth?: number;
  formula: PublicFormula;
  conditions: PublicCondition[];
  evidenceIds: string[];
}
export interface PublicFreshness {
  state: 'current' | 'failed' | 'stale' | 'deferred' | 'unknown';
  checkedAt?: string;
  lastSuccessAt?: string;
  reasonCodes: string[];
}
export interface PublicProgramme {
  schemaVersion: 1;
  programmeId: string;
  productId: string;
  section: SectionKey;
  offerId: string;
  conditions: PublicCondition[];
  components: PublicComponent[];
  formula?: PublicFormula;
  phases?: PublicPhase[];
  evidenceIds: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
  freshness: PublicFreshness;
  reasonCodes: string[];
  /** Public raw notes retained for deterministic adapter review; never consumer prose. */
  materialFootnotes?: string[];
  sourceBindings?: { pointer: string; rateIndex: number }[];
  fees?: PublicFee[];
  feeCoverage?: { status: 'complete' | 'partial' | 'unknown'; reasonCodes: string[]; evidenceIds: string[] };
  feeSetId?: string;
  metadata?: {
    rateStructure?: 'fixed' | 'variable' | 'conditional' | 'introductory';
    quotedTerm?: { value: string; unit: 'month' | 'day' };
    interestPayment?: { type: 'maturity' | 'periodic'; frequency?: string };
    tierApplication?: 'whole_balance' | 'per_tier';
  };
}
export interface PublicFee {
  feeId: string;
  scopeId: string;
  name: string;
  role: 'upfront' | 'recurring' | 'package' | 'switching' | 'cashback' | 'event';
  currency?: string;
  amount?: string;
  minimumAmount?: string;
  maximumAmount?: string;
  frequencyMonths?: number;
  event?: string;
  conditions: PublicCondition[];
  evidenceIds: string[];
  source: { rawType: string; rawValue?: string; pointer: string };
}
export interface PublicFeeSet {
  feeSetId: string;
  productId: string;
  fees: PublicFee[];
  feeCoverage: NonNullable<PublicProgramme['feeCoverage']>;
}
export interface PublicProduct {
  productId: string;
  productKey: string;
  providerId: string;
  providerName: string;
  name: string;
  section: SectionKey;
  aliases: {
    name: string;
    /** Lender-published effective dates, independent of observation history. */
    effectiveFrom?: string;
    effectiveTo?: string;
    firstObservedAt?: string;
    lastObservedAt?: string;
  }[];
  status: 'current' | 'legacy' | 'unknown';
  programmeIds: string[];
  referenceIds: string[];
  reasonCodes: string[];
  suppressedProgrammeCount?: number;
  freshness?: PublicFreshness;
  sourceEvidence?: PublicEvidence;
}
export interface PublicReferenceRate {
  referenceId: string;
  providerId: string;
  name: string;
  scopeId?: string;
  conditions?: PublicCondition[];
  value?: string;
  unit: PublicRateUnit;
  effectiveFrom?: string;
  effectiveTo?: string;
  freshness: PublicFreshness;
  evidenceIds: string[];
}
export interface PublicEvidence {
  evidenceId: string;
  url: string;
  sha256: string;
  locator: string;
  checkedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  extractionVersion?: string;
}
export interface PublicCoverage {
  providerId: string;
  providerName: string;
  section: SectionKey;
  sourceStatus: string;
  resolutionStatus: string;
  publicationStatus: string;
  reasonCodes: string[];
  [key: string]: unknown;
}
/** Inputs stay local. They are never a source observation or public evidence. */
export interface RateScenario {
  amount?: string;
  balance?: string;
  lvr?: string;
  termMonths?: string;
  termDays?: string;
  purpose?: string;
  repayment?: string;
  channel?: string;
  package?: string;
  customerCategory?: string;
  qualification?: string | boolean;
  monthlyDeposit?: string;
  withdrawals?: string;
  balanceGrowth?: string;
  cardTransactions?: string;
  effectiveDate?: string;
  allowHistorical?: boolean;
  [key: string]: string | boolean | undefined;
}
export interface ResolvedPhase {
  phaseId: string;
  startMonth: number;
  endMonth?: number;
  status: 'exact' | 'from' | 'range' | 'unresolved';
  payableRate?: string;
  minimumRate?: string;
  maximumRate?: string;
  reasonCodes: string[];
  evidenceIds: string[];
}
export interface RateResolution {
  status: 'exact' | 'from' | 'range' | 'unresolved';
  payableRate?: string;
  minimumRate?: string;
  maximumRate?: string;
  comparisonRate?: string;
  appliedComponents: PublicComponent[];
  phases: ResolvedPhase[];
  conditions: { met: PublicCondition[]; unmet: PublicCondition[]; unknown: PublicCondition[] };
  reasonCodes: string[];
  evidenceIds: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
  freshness: PublicFreshness;
  verifiedCurrent: boolean;
  origin: 'published' | 'publicly_calculated' | 'user_entered' | 'locally_calculated';
}
export interface PublicRateAsset {
  name: string;
  sha256: string;
  bytes: number;
  decodedBytes: number;
  encoding: 'gzip' | 'identity';
  url: string;
}
export interface PublicRateBinding {
  schemaVersion: 1;
  generationId: string;
  runDate: string;
  coreSha256: string;
  detailsSha256: string;
}
export interface PublicRateCapability extends PublicRateBinding {
  index: PublicRateAsset;
  shards: PublicRateAsset[];
}
export interface PublicRateIndex extends PublicRateBinding {
  products: PublicProduct[];
  coverage: PublicCoverage[];
  shards: (Omit<PublicRateAsset, 'url'> & { productIds: string[] })[];
  routes?: { name: string; kind: 'discovery' | 'pricing'; providerIds: string[]; sections: SectionKey[] }[];
}
export interface PublicRateShard extends PublicRateBinding {
  products?: PublicProduct[];
  programmes: PublicProgramme[];
  referenceRates: PublicReferenceRate[];
  evidence: PublicEvidence[];
  feeSets?: PublicFeeSet[];
}
