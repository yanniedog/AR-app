import { gzipSync, strToU8 } from 'fflate';

import type {
  CanonicalProductV3,
  CorePayloadV3,
  CoverageV2,
  GenerationHeadV3,
  GenerationManifestV3,
  GenerationPointerV3,
  SemanticConditionV3,
  SemanticTierRangeV3,
  SemanticTierV3,
  ValidatedGenerationV3,
} from '../src/contracts/v3/types';
import {
  canonicalEvidenceUid,
  canonicalGenerationManifestDigest,
  canonicalProductUid,
  canonicalRateUid,
  sha256Utf8,
  utf8ByteLength,
  validateCorePayloadTextV3,
  validateGenerationHeadV3,
  validateGenerationManifestTextV3,
} from '../src/contracts/v3/validators';
import { V3_CONTRACT_SCHEMA_SET_SHA256 } from '../src/contracts/v3/contractLock';
import { bytesToHex, sha256Bytes, utf8Hex } from '../src/contracts/v3/contractPrimitives';

export const PROVIDER_UID = `provider:v1:${'1'.repeat(64)}`;
export const SECOND_PROVIDER_UID = `provider:v1:${'2'.repeat(64)}`;
export const LEDGER_A = 'a'.repeat(64);
export const LEDGER_B = 'b'.repeat(64);

const SOURCE_SHA = 'c'.repeat(64);
const RECORD_SHA = 'd'.repeat(64);

function defaultTier(): SemanticTierRangeV3 {
  return {
    unit: 'DOLLAR',
    method: 'PER_TIER',
    minimum: null,
    maximum: null,
    additional_info: null,
    conditions: [],
  };
}

export function makeProduct(options: {
  providerUid?: string;
  providerName?: string;
  productId?: string;
  productName?: string;
  kind?: 'mortgage' | 'savings_account' | 'term_deposit';
  duration?: string | null;
  rateType?: string | null;
  metric?: 'advertised_interest' | 'base_interest' | 'conditional_interest' | 'introductory_interest' | 'published_reversion_interest';
  tiers?: SemanticTierRangeV3[];
  conditions?: SemanticConditionV3[];
  eligibility?: CanonicalProductV3['evidence']['eligibility_disclosure_status'];
  pricing?: CanonicalProductV3['evidence']['pricing_status'];
  observedAt?: string;
} = {}): CanonicalProductV3 {
  const providerUid = options.providerUid ?? PROVIDER_UID;
  const providerName = options.providerName ?? 'Example Bank';
  const productId = options.productId ?? 'example-mortgage';
  const productName = options.productName ?? 'Example variable home loan';
  const kind = options.kind ?? 'mortgage';
  const section = kind === 'mortgage' ? 'mortgage' : kind === 'savings_account' ? 'savings' : 'term_deposit';
  const family = kind === 'mortgage' ? 'lending' : 'deposit';
  const productUid = canonicalProductUid(providerUid, productId);
  const aliases = [`${providerName}|${productId}`];
  const observedAt = options.observedAt ?? '2026-08-14T09:30:00+10:00';
  const sourcePath = `runs/2026-08-14/raw/${productId}.json`;
  const sourceLocator = `/products/${productId}`;
  const evidenceId = canonicalEvidenceUid(
    'cdr-product-detail',
    SOURCE_SHA,
    sourcePath,
    sourceLocator,
    RECORD_SHA,
    productId,
  );
  const semantics: SemanticTierV3 = {
    family,
    rate_type: options.rateType ?? (kind === 'mortgage' ? 'VARIABLE' : 'STANDARD'),
    application_type: null,
    application_frequency: null,
    calculation_frequency: null,
    repayment_type: kind === 'mortgage' ? 'PRINCIPAL_AND_INTEREST' : null,
    loan_purpose: kind === 'mortgage' ? 'OWNER_OCCUPIED' : null,
    interest_payment_due: kind === 'term_deposit' ? 'MATURITY' : null,
    duration: options.duration ?? null,
    additional_info: null,
    tiers: options.tiers ?? [defaultTier()],
    conditions: options.conditions ?? [],
  };
  const metric = options.metric ?? (kind === 'mortgage' ? 'advertised_interest' : 'base_interest');
  const basis = {
    advertised_interest: 'advertised',
    base_interest: 'base',
    conditional_interest: 'conditional',
    introductory_interest: 'introductory',
    published_reversion_interest: 'published_reversion',
  }[metric] as CanonicalProductV3['rates'][number]['advertised']['basis'];
  const rateUid = canonicalRateUid(productUid, semantics);
  return {
    schema_version: 3,
    normalization_version: 'canonical-v3-domain-v1',
    identity: {
      provider_uid: providerUid,
      provider_identity_status: 'confirmed',
      product_uid: productUid,
      product_id: productId,
      rate_uid: null,
      rate_identity_status: null,
      legacy_aliases: aliases,
    },
    display_name: productName,
    provider_display_name: providerName,
    classification: {
      product_kind: kind,
      consumer_section: section,
      classification_status: 'confirmed',
      classification_basis: ['cdr-product-category'],
      classification_version: 'classifier-v1',
      quarantine_reason: null,
    },
    evidence: {
      availability: 'public',
      fee_disclosure_status: 'complete',
      eligibility_disclosure_status: options.eligibility ?? 'complete',
      pricing_status: options.pricing ?? 'complete',
      evidence_ids: [evidenceId],
      observed_at: observedAt,
      effective_date: null,
      effective_to: null,
      source_updated_at: null,
      source_urls: [`https://example.test/products/${productId}`],
    },
    rates: [{
      identity: {
        provider_uid: providerUid,
        provider_identity_status: 'confirmed',
        product_uid: productUid,
        product_id: productId,
        rate_uid: rateUid,
        rate_identity_status: 'confirmed',
        legacy_aliases: aliases,
      },
      advertised: {
        value: kind === 'mortgage' ? '0.06' : '0.045',
        unit: 'fraction_per_annum',
        metric,
        basis,
        evidence_status: 'published',
        evidence_ids: [evidenceId],
      },
      comparison: kind === 'mortgage' ? {
        value: '0.061',
        unit: 'fraction_per_annum',
        metric: 'comparison_interest',
        basis: 'comparison',
        evidence_status: 'published',
        evidence_ids: [evidenceId],
      } : null,
      semantic_tier: semantics,
      exact_alert_eligible: true,
      source_index: 0,
    }],
    fees: [],
    evidence_refs: [{
      evidence_id: evidenceId,
      source_kind: 'cdr-product-detail',
      source_path: sourcePath,
      source_locator: sourceLocator,
      source_sha256: SOURCE_SHA,
      source_record_sha256: RECORD_SHA,
      observed_at: observedAt,
      effective_date: null,
      effective_to: null,
      source_updated_at: null,
      source_url: `https://example.test/products/${productId}`,
    }],
  };
}

export function coverageFor(products: CanonicalProductV3[], overrides: Partial<CoverageV2> = {}): CoverageV2 {
  const base: CoverageV2 = {
    products_discovered: products.length,
    products_priced: products.length,
    products_consumer_eligible: products.length,
    rate_tiers_eligible: products.reduce((sum, product) => sum + product.rates.length, 0),
    providers_registered: 1,
    providers_attempted: 1,
    providers_responded: 1,
    providers_complete: 1,
    providers_empty: 0,
    providers_partial: 0,
    providers_failed: 0,
    providers_not_attempted: 0,
    register_sources_attempted: 1,
    register_sources_complete: 1,
    register_provenance_complete: true,
    failure_records: 0,
    failure_records_by_provider: {},
    corrupt_failure_records: 0,
    exclusions_by_reason: {},
    failure_provenance_complete: true,
    reconciliation_status: 'reconciled',
  };
  return { ...base, ...overrides };
}

export function buildGeneration(options: {
  date?: string;
  revision?: number;
  products?: CanonicalProductV3[];
  observationState?: 'complete' | 'partial';
  coverage?: CoverageV2;
  priorLedgerDigest?: string | null;
  ledgerEventDigest?: string;
  manifestTag?: 'rolling' | 'candidate';
  coreEncoding?: 'identity' | 'gzip';
} = {}): ValidatedGenerationV3 {
  const date = options.date ?? '2026-08-14';
  const revision = options.revision ?? 1;
  const products = options.products ?? [makeProduct()];
  const core: CorePayloadV3 = {
    schema_version: 3,
    normalization_version: 'canonical-v3-domain-v1',
    observation_date: date,
    products,
  };
  const coreText = JSON.stringify(core);
  const coreEncoding = options.coreEncoding ?? 'identity';
  const coreAssetBytes = coreEncoding === 'gzip' ? gzipSync(strToU8(coreText)) : strToU8(coreText);
  const coreSha = sha256Bytes(coreAssetBytes);
  const material = {
    schema_version: 3 as const,
    generation_id: 'placeholder',
    generation_revision: revision,
    generation_digest: '0'.repeat(64),
    observation_date: date,
    observed_at: `${date}T09:30:00+10:00`,
    observation_state: options.observationState ?? 'complete',
    ledger_state: 'finalized' as const,
    normalization_version: 'canonical-v3-domain-v1',
    producer_commit: 'e'.repeat(40),
    coverage: options.coverage ?? coverageFor(products),
    prior_ledger_digest: options.priorLedgerDigest ?? null,
    ledger_event_digest: options.ledgerEventDigest ?? LEDGER_A,
    capabilities: {
      core: {
        schema_id: 'https://australianrates.app/contracts/v3/canonical-core-v3.schema.json' as const,
        media_type: 'application/json' as const,
        encoding: coreEncoding,
        compressed_bytes: coreAssetBytes.byteLength,
        uncompressed_bytes: utf8ByteLength(coreText),
        sha256: coreSha,
        url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-gen/${coreSha}.${coreEncoding === 'gzip' ? 'json.gz' : 'json'}`,
        cohort: 'confirmed-consumer-products' as const,
        capability: 'core' as const,
      },
    },
  } satisfies GenerationManifestV3;
  const generationDigest = canonicalGenerationManifestDigest(material);
  const generationId = `gen-${date}-r${String(revision).padStart(4, '0')}-${generationDigest.slice(0, 12)}`;
  const manifest = { ...material, generation_id: generationId, generation_digest: generationDigest };
  const manifestText = JSON.stringify(manifest);
  const manifestSha = sha256Utf8(manifestText);
  const manifestPath = options.manifestTag === 'candidate'
    ? `app-payload-v3-candidate-${generationId}/${manifestSha}.json`
    : `app-payload-gen/${manifestSha}.json`;
  const head = validateGenerationHeadV3({
    generation_id: generationId,
    generation_revision: revision,
    generation_digest: generationDigest,
    manifest_sha256: manifestSha,
    observation_date: date,
    observation_state: manifest.observation_state,
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${manifestPath}`,
  });
  const validatedManifest = validateGenerationManifestTextV3(manifestText, head);
  return {
    head,
    manifest: validatedManifest,
    manifestText,
    core: validateCorePayloadTextV3(coreText, validatedManifest),
    coreText,
    coreAssetBytesHex: coreEncoding === 'identity' ? utf8Hex(coreText) : bytesToHex(coreAssetBytes),
  };
}

export function pointerFor(
  latestObservation: GenerationHeadV3,
  latestComplete: GenerationHeadV3 = latestObservation,
): GenerationPointerV3 {
  return {
    schema_version: 3,
    generated_at: '2026-08-15T10:00:00+10:00',
    contract_sha256: V3_CONTRACT_SCHEMA_SET_SHA256,
    latest_observation: latestObservation,
    latest_complete: latestComplete as GenerationPointerV3['latest_complete'],
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
