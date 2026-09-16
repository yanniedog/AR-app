import type { EvidenceReference, InterestPolicy, Rule } from '../../lib/productTermsEngine/types';
export interface ExecutableTemplate {
  schemaVersion: 1; kind: 'fixed_aud_td_maturity_v1'; adapterVersion: 'fixed-aud-td-v1'; evaluatorVersion: 'product-terms-engine-v7' | 'product-terms-engine-v8';
  id: string; tierKey: string; packageKey: string; productKey: string; cohortKey: string; currency: 'AUD'; effectiveFrom: string; effectiveToExclusive: string;
  effectiveScope: 'funded_date' | 'whole_accrual_horizon'; sourceObservationId: string; sourceSha256: string; sourceGenerationId: string; runDate: string;
  selectedRate: { sourceManifestSha256: string; coreAssetSha256: string; coreRowIndex: number; rowSha256: string; rateIndex: number };
  documentVersionIds: string[]; termRevisionIds: string[]; annualRate: string;
  term: { unit: 'days' | 'months'; count: number; monthConvention: 'clamp' | 'preserve_month_end' };
  principalBounds: { minimum: { value: string; inclusive: boolean } | { unbounded: true }; maximum: { value: string; inclusive: boolean } | { unbounded: true } };
  interest: Pick<InterestPolicy, 'dayCount' | 'dailyAccrualScale' | 'dailyRateRounding' | 'accrualRounding' | 'postingRounding'>;
  policies: { posting: 'calendar_day_maturity'; businessDayAdjustment: 'none_source_declared'; compounding: 'none'; offset: 'none'; feeDisposition: 'complete_no_fees'; accrualBoundary: 'funded_inclusive_maturity_exclusive' };
  inputDefinitions: { key: string; label: string; type: 'decimal' | 'date' | 'text' | 'boolean'; unit: string | null; clauseIds: string[]; binding: 'customer_fact' | 'deposit_principal' | 'funded_date' | 'maturity_date' }[];
  eligibility: Rule; fieldClauseIds: Record<string, string[]>; evidence: (EvidenceReference & { documentVersionId: string })[];
}
export interface ExecutableAsset {
  schemaVersion: 1; productKey: string; sourceGenerationId: string; runDate: string; coreAssetSha256: string;
  approvalPolicy: 'as_of_adopted_edition'; identitySha256: string;
  templates: { template: ExecutableTemplate; approval: { templateId: string; reviewId: string; reviewEvidenceSha256: string; benchmarkResultSha256: string; reviewedAt: string;
    review: { applicability: 'verified'; materialTerms: 'verified'; feeCoverage: 'verified'; rateSchedule: 'verified' } } }[];
}
