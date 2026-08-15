export type ObservationStateV3 = 'complete' | 'partial';
export type LedgerStateV3 = 'finalized';
export type CapabilityV3 = 'core';
export type AssetEncodingV3 = 'gzip' | 'identity';
export type IdentityStatusV3 = 'confirmed' | 'fallback' | 'ambiguous';
export type DisclosureStatusV3 = 'complete' | 'partial' | 'unknown' | 'not_applicable';

export interface GenerationHeadV3 {
  generation_id: string;
  generation_revision: number;
  generation_digest: string;
  manifest_sha256: string;
  observation_date: string;
  observation_state: ObservationStateV3;
  manifest_url: string;
}

export interface GenerationPointerV3 {
  schema_version: 3;
  generated_at: string;
  contract_sha256: string;
  latest_observation: GenerationHeadV3;
  latest_complete: GenerationHeadV3 & { observation_state: 'complete' };
}

export interface AssetDescriptorV3 {
  schema_id: 'https://australianrates.app/contracts/v3/canonical-core-v3.schema.json';
  media_type: 'application/json';
  encoding: AssetEncodingV3;
  compressed_bytes: number;
  uncompressed_bytes: number;
  sha256: string;
  url: string;
  cohort: 'confirmed-consumer-products';
  capability: 'core';
}

export interface CoverageV2 {
  products_discovered: number;
  products_priced: number;
  products_consumer_eligible: number;
  rate_tiers_eligible: number;
  providers_registered: number;
  providers_attempted: number;
  providers_responded: number;
  providers_complete: number;
  providers_empty: number;
  providers_partial: number;
  providers_failed: number;
  providers_not_attempted: number;
  register_sources_attempted: number;
  register_sources_complete: number;
  register_provenance_complete: boolean;
  failure_records: number;
  failure_records_by_provider: Record<string, number>;
  corrupt_failure_records: number;
  exclusions_by_reason: Record<string, number>;
  failure_provenance_complete: boolean;
  reconciliation_status: 'reconciled' | 'partial' | 'failed';
}

export interface GenerationManifestV3 {
  schema_version: 3;
  generation_id: string;
  generation_revision: number;
  generation_digest: string;
  observation_date: string;
  observed_at: string;
  observation_state: ObservationStateV3;
  ledger_state: LedgerStateV3;
  normalization_version: string;
  producer_commit: string;
  coverage: CoverageV2;
  prior_ledger_digest: string | null;
  ledger_event_digest: string;
  capabilities: { core: AssetDescriptorV3 };
}

export interface CanonicalIdentityV3 {
  provider_uid: string;
  provider_identity_status: 'confirmed' | 'fallback';
  product_uid: string;
  product_id: string;
  rate_uid: string | null;
  rate_identity_status: 'confirmed' | 'ambiguous' | null;
  legacy_aliases: string[];
}

export type RateMetricV3 =
  | 'advertised_interest'
  | 'base_interest'
  | 'conditional_interest'
  | 'introductory_interest'
  | 'published_reversion_interest';

export type RateBasisV3 =
  | 'advertised'
  | 'base'
  | 'conditional'
  | 'introductory'
  | 'published_reversion';

export type EvidenceStatusV3 = 'verified' | 'published' | 'observed' | 'partial' | 'unknown';

export interface TypedProductRateV3 {
  value: string;
  unit: 'fraction_per_annum';
  metric: RateMetricV3;
  basis: RateBasisV3;
  evidence_status: EvidenceStatusV3;
  evidence_ids: string[];
}

export interface TypedComparisonRateV3 {
  value: string;
  unit: 'fraction_per_annum';
  metric: 'comparison_interest';
  basis: 'comparison';
  evidence_status: EvidenceStatusV3;
  evidence_ids: string[];
}

export interface SemanticConditionV3 {
  type: string | null;
  value: string | null;
  additional_info: string | null;
}

export interface SemanticTierRangeV3 {
  unit: string | null;
  method: string | null;
  minimum: string | null;
  maximum: string | null;
  additional_info: string | null;
  conditions: SemanticConditionV3[];
}

export interface SemanticTierV3 {
  family: 'deposit' | 'lending';
  rate_type: string | null;
  application_type: string | null;
  application_frequency: string | null;
  calculation_frequency: string | null;
  repayment_type: string | null;
  loan_purpose: string | null;
  interest_payment_due: string | null;
  duration: string | null;
  additional_info: string | null;
  tiers: SemanticTierRangeV3[];
  conditions: SemanticConditionV3[];
}

export interface CanonicalRateV3 {
  identity: CanonicalIdentityV3 & {
    rate_uid: string;
    rate_identity_status: 'confirmed' | 'ambiguous';
  };
  advertised: TypedProductRateV3;
  comparison: TypedComparisonRateV3 | null;
  semantic_tier: SemanticTierV3;
  exact_alert_eligible: boolean;
  source_index: number;
}

export interface CanonicalFeeV3 {
  fee_uid: string;
  fee_identity_status: 'confirmed' | 'ambiguous';
  semantic_fee: {
    name: string;
    fee_type: string;
    method: string | null;
    cadence: string | null;
    additional_info: string | null;
  };
  disclosure_status: DisclosureStatusV3;
  currency: string | null;
  fixed_amount: string | null;
  minimum_amount: string | null;
  maximum_amount: string | null;
  rate: {
    value: string;
    unit: 'fraction_of_amount';
    evidence_status: EvidenceStatusV3;
    evidence_ids: string[];
  } | null;
  condition: string | null;
  evidence_ids: string[];
}

export interface EvidenceRefV3 {
  evidence_id: string;
  source_kind: string;
  source_path: string;
  source_locator: string;
  source_sha256: string;
  source_record_sha256: string;
  observed_at: string;
  effective_date: string | null;
  effective_to: string | null;
  source_updated_at: string | null;
  source_url: string | null;
}

export interface CanonicalProductV3 {
  schema_version: 3;
  normalization_version: string;
  identity: CanonicalIdentityV3 & {
    rate_uid: null;
    rate_identity_status: null;
  };
  display_name: string;
  provider_display_name: string;
  classification: {
    product_kind: 'mortgage' | 'savings_account' | 'term_deposit';
    consumer_section: 'mortgage' | 'savings' | 'term_deposit';
    classification_status: 'confirmed';
    classification_basis: string[];
    classification_version: string;
    quarantine_reason: null;
  };
  evidence: {
    availability: 'public';
    fee_disclosure_status: DisclosureStatusV3;
    eligibility_disclosure_status: DisclosureStatusV3;
    pricing_status: 'complete' | 'partial' | 'unpriced' | 'unknown';
    evidence_ids: string[];
    observed_at: string;
    effective_date: string | null;
    effective_to: string | null;
    source_updated_at: string | null;
    source_urls: string[];
  };
  rates: CanonicalRateV3[];
  fees: CanonicalFeeV3[];
  evidence_refs: EvidenceRefV3[];
}

export interface CorePayloadV3 {
  schema_version: 3;
  normalization_version: string;
  observation_date: string;
  products: CanonicalProductV3[];
}

export interface ValidatedGenerationV3 {
  head: GenerationHeadV3;
  manifest: GenerationManifestV3;
  /** Exact UTF-8 manifest bytes authenticated by the immutable pointer head. */
  manifestText: string;
  core: CorePayloadV3;
  /** Exact inflated UTF-8 core bytes authenticated by its capability descriptor. */
  coreText: string;
  /** Exact downloaded core asset bytes authenticated by the capability SHA-256. */
  coreAssetBytesHex: string;
}
