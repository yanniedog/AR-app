import type { Brand, PayloadCoverage, Ribbon, RbaEntry, SectionKey } from '../../types';

export type ObservationStateV3 = 'complete' | 'partial' | 'failed';
export type LedgerStateV3 = 'provisional' | 'finalized';
export type ReconciliationStateV3 = 'reconciled' | 'unreconciled';
export type AssetEncodingV3 = 'gzip' | 'identity';

export type CapabilityV3 =
  | 'core'
  | 'facets'
  | 'search'
  | 'details-index'
  | 'details-shard'
  | 'history-summary'
  | 'bank-response'
  | 'spread'
  | 'rba'
  | 'product-history'
  | 'economy';

export interface GenerationHeadV3 {
  generation_id: string;
  generation_digest: string;
  run_date: string;
  observation_state: ObservationStateV3;
  manifest_url: string;
  manifest_sha256: string;
  manifest_bytes: number;
}

export interface GenerationPointerV3 {
  schema_id: 'https://australianrates.app/schemas/manifest-v3.json';
  schema_version: 3;
  generated_at: string;
  latest_observation: GenerationHeadV3;
  latest_complete: GenerationHeadV3;
}

export interface AssetDescriptorV3 {
  capability: CapabilityV3;
  schema_id: string;
  media_type: 'application/json';
  encoding: AssetEncodingV3;
  compressed_bytes: number;
  uncompressed_bytes: number;
  sha256: string;
  url: string;
  required: boolean;
  cohort?: string;
  base_generation_digest?: string;
}

export interface CoverageV3 {
  reconciliation_status: ReconciliationStateV3;
  discovered_products: number;
  priced_products: number;
  consumer_eligible_products: number;
  eligible_rate_tiers: number;
  providers_registered: number;
  providers_attempted: number;
  providers_complete: number;
  providers_partial: number;
  providers_failed: number;
  exclusions_by_reason: Record<string, number>;
}

export interface GenerationManifestV3 {
  schema_id: 'https://australianrates.app/schemas/generation-manifest-v3.json';
  schema_version: 3;
  generation_id: string;
  generation_digest: string;
  ledger_digest: string;
  run_date: string;
  ledger_state: LedgerStateV3;
  observation_state: ObservationStateV3;
  normalization_version: string;
  prior_ledger_digest: string | null;
  coverage: CoverageV3;
  assets: AssetDescriptorV3[];
}

export interface CanonicalRateRowV3 {
  provider: string;
  provider_uid: string;
  product_uid: string;
  rate_uid: string;
  product_name: string;
  legacy_product_key?: string;
  classification: {
    product_kind: 'mortgage' | 'savings' | 'term_deposit';
    consumer_section: SectionKey;
    status: 'confirmed';
    basis: string;
    version: string;
  };
  typed_rate: {
    value: number;
    unit: 'fraction_per_annum';
    metric: 'advertised' | 'base' | 'conditional' | 'introductory' | 'reversion';
    evidence_status: 'published';
  };
  comparison_rate?: {
    value: number;
    unit: 'fraction_per_annum';
    metric: 'comparison';
    evidence_status: 'published';
  };
  /** Required for mortgages; deposit rows must not carry mortgage semantics. */
  mortgage_rate_type?: 'fixed' | 'variable';
  /** Required only for fixed mortgages so legacy projections retain their horizon. */
  fixed_term_months?: number;
  evidence: {
    availability: 'public' | 'restricted' | 'unknown';
    broadly_applicable: boolean;
    pricing_status: 'published' | 'partial' | 'unknown';
    fee_disclosure_status: 'complete' | 'partial' | 'unknown';
    eligibility_disclosure_status: 'complete' | 'partial' | 'unknown';
    source_url: string;
    observed_at: string;
    effective_date: string | null;
  };
}

export interface CoreSectionV3 {
  rates: CanonicalRateRowV3[];
  ribbon: Ribbon;
}

/** Lean v3 core adapted to the legacy in-memory core shape during migration. */
export interface CorePayloadV3 {
  schema_id: 'https://australianrates.app/schemas/core-v3.json';
  schema_version: 3;
  generation_id: string;
  generation_digest: string;
  run_date: string;
  sections: Record<SectionKey, CoreSectionV3>;
  brands: Record<string, Brand>;
  rba: RbaEntry[];
  rba_holds?: string[];
  coverage?: PayloadCoverage;
}

export interface ValidatedGenerationV3 {
  head: GenerationHeadV3;
  manifest: GenerationManifestV3;
  core: CorePayloadV3;
  coreText: string;
  /** Keyed by capability, or `capability:cohort` for shardable assets. */
  optionalAssets: Record<string, string>;
  optionalErrors: Record<string, string>;
}
