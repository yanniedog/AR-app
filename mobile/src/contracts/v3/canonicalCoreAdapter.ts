import { rebuildSectionRibbon } from '../../data/sectionIntegrity';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../../types';
import type {
  CanonicalProductV3,
  CanonicalRateV3,
  CorePayloadV3,
  RateMetricV3,
} from './types';
import { stableLegacyRateIndex } from './canonicalCoreFields';

export interface LegacyProductMigrationTarget {
  productKey: string;
}

export type LegacyProductAliasMap = ReadonlyMap<string, LegacyProductMigrationTarget>;

export type TrustedLegacyLedger = Pick<CorePayload, 'run_date' | 'rba' | 'rba_holds'>;

function durationMonths(value: string | null): number | undefined {
  if (value === null) return undefined;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(value);
  if (!match || (!match[1] && !match[2])) return undefined;
  const months = Number(match[1] ?? 0) * 12 + Number(match[2] ?? 0);
  return Number.isSafeInteger(months) && months > 0 ? months : undefined;
}

function sectionForProduct(product: CanonicalProductV3): SectionKey {
  switch (product.classification.consumer_section) {
    case 'mortgage': return 'Mortgage';
    case 'savings': return 'Savings';
    case 'term_deposit': return 'TD';
  }
}

function legacyMetric(metric: RateMetricV3): string {
  return {
    advertised_interest: 'ADVERTISED',
    base_interest: 'BASE',
    conditional_interest: 'CONDITIONAL',
    introductory_interest: 'INTRODUCTORY',
    published_reversion_interest: 'PUBLISHED_REVERSION',
  }[metric];
}

function settledRateEvidence(rateValue: CanonicalRateV3): boolean {
  return [
    rateValue.advertised.evidence_status,
    rateValue.comparison?.evidence_status,
  ].every((status) => status === undefined || status === 'verified' || status === 'published');
}

function unambiguousApplicability(rateValue: CanonicalRateV3): boolean {
  return rateValue.semantic_tier.tiers.length === 1 &&
    rateValue.semantic_tier.conditions.length === 0 &&
    rateValue.semantic_tier.tiers[0].conditions.length === 0;
}

function trustedRateIdentity(product: CanonicalProductV3, rateValue: CanonicalRateV3): boolean {
  return product.identity.provider_identity_status === 'confirmed' &&
    rateValue.identity.rate_identity_status === 'confirmed' &&
    product.evidence.pricing_status === 'complete' &&
    product.evidence.eligibility_disclosure_status === 'complete' &&
    settledRateEvidence(rateValue) &&
    unambiguousApplicability(rateValue);
}

function applicabilityKey(rateValue: CanonicalRateV3): string {
  const semantics = rateValue.semantic_tier;
  return JSON.stringify({
    family: semantics.family,
    rate_type: semantics.rate_type,
    application_type: semantics.application_type,
    application_frequency: semantics.application_frequency,
    calculation_frequency: semantics.calculation_frequency,
    repayment_type: semantics.repayment_type,
    loan_purpose: semantics.loan_purpose,
    interest_payment_due: semantics.interest_payment_due,
    duration: semantics.duration,
    additional_info: semantics.additional_info,
    tiers: semantics.tiers.map((tier) => ({
      unit: tier.unit,
      method: tier.method,
      minimum: tier.minimum,
      maximum: tier.maximum,
      additional_info: tier.additional_info,
    })),
  });
}

function ongoingBaseRate(product: CanonicalProductV3, rateValue: CanonicalRateV3): string | undefined {
  if (
    rateValue.advertised.metric !== 'conditional_interest' &&
    rateValue.advertised.metric !== 'introductory_interest'
  ) return undefined;
  const key = applicabilityKey(rateValue);
  const matches = product.rates.filter((candidate) =>
    candidate.advertised.metric === 'base_interest' &&
    trustedRateIdentity(product, candidate) &&
    applicabilityKey(candidate) === key);
  return matches.length === 1 ? matches[0].advertised.value : undefined;
}

function adaptRate(product: CanonicalProductV3, rateValue: CanonicalRateV3): RateRow {
  const section = sectionForProduct(product);
  const semantics = rateValue.semantic_tier;
  const months = durationMonths(semantics.duration);
  const rateType = semantics.rate_type ?? legacyMetric(rateValue.advertised.metric);
  const singleTier = semantics.tiers.length === 1 ? semantics.tiers[0] : undefined;
  const unambiguousTier = unambiguousApplicability(rateValue);
  const trustedIdentity = trustedRateIdentity(product, rateValue);
  const exactAlertEligible = rateValue.exact_alert_eligible && trustedIdentity;
  const ongoingRate = ongoingBaseRate(product, rateValue);
  return {
    provider: product.provider_display_name,
    product_id: product.identity.product_id,
    product_key: product.identity.product_uid,
    product_name: product.display_name,
    rate: rateValue.advertised.value,
    last_updated: product.evidence.observed_at,
    exact_alert_eligible: exactAlertEligible,
    ...(exactAlertEligible
      ? { rate_index: stableLegacyRateIndex(rateValue.identity.rate_uid) }
      : {}),
    rate_type: rateType,
    ...(section === 'Mortgage' && rateValue.comparison ? { comparison_rate: rateValue.comparison.value } : {}),
    ...(ongoingRate !== undefined ? { ongoing_rate: ongoingRate } : {}),
    ...(semantics.repayment_type ? { repayment_type: semantics.repayment_type, ribbon_repayment_type: semantics.repayment_type } : {}),
    ...(semantics.loan_purpose ? { loan_purpose: semantics.loan_purpose } : {}),
    ...(semantics.interest_payment_due ? { interest_payment: semantics.interest_payment_due } : {}),
    ...(unambiguousTier && singleTier?.unit === 'DOLLAR' && singleTier.minimum !== null ? { balance_min: singleTier.minimum } : {}),
    ...(unambiguousTier && singleTier?.unit === 'DOLLAR' && singleTier.maximum !== null ? { balance_max: singleTier.maximum } : {}),
    ...(section === 'Mortgage' && (rateType === 'FIXED' || rateType === 'VARIABLE')
      ? { ribbon_rate_structure: rateType }
      : {}),
    ...(section === 'Mortgage' && rateType === 'FIXED' && months !== undefined
      ? { term_months: months, ribbon_fixed_term: months / 12 }
      : {}),
    ...(section === 'TD' && months !== undefined ? { term_months: months, term: `P${months}M` } : {}),
    ...(rateValue.advertised.metric === 'base_interest' && section === 'Savings'
      ? { ribbon_deposit_kind: 'base' }
      : rateValue.advertised.metric === 'conditional_interest'
      ? section === 'TD' ? { ribbon_rate_structure: 'bonus' } : { ribbon_deposit_kind: 'bonus' }
      : rateValue.advertised.metric === 'introductory_interest'
        ? section === 'TD' ? { ribbon_rate_structure: 'introductory' } : { ribbon_deposit_kind: 'intro' }
        : {}),
    account_class:
      product.evidence.pricing_status === 'complete' &&
      product.evidence.eligibility_disclosure_status === 'complete' &&
      trustedIdentity
        ? 'standard'
        : 'non_standard',
    taxonomy_path: section === 'Mortgage'
      ? 'HOME_LOAN'
      : section === 'Savings'
        ? 'SAVINGS'
        : 'TERM_DEPOSIT',
  };
}

export function legacyProductAliasMap(core: CorePayloadV3): LegacyProductAliasMap {
  const result = new Map<string, LegacyProductMigrationTarget>();
  for (const product of core.products) {
    const target = Object.freeze({
      productKey: product.identity.product_uid,
    });
    for (const alias of product.identity.legacy_aliases) result.set(alias, target);
  }
  return result;
}

export function adaptCoreV3ToLegacy(core: CorePayloadV3, trustedLegacy: TrustedLegacyLedger): CorePayload {
  if (trustedLegacy.run_date !== core.observation_date) {
    throw new Error('v3 adaptation requires a same-observation trusted legacy RBA ledger');
  }
  if (!trustedLegacy.rba.length) {
    throw new Error('v3 adaptation requires a trusted legacy RBA ledger');
  }
  const rows: Record<SectionKey, RateRow[]> = { Mortgage: [], Savings: [], TD: [] };
  const brands = Object.create(null) as CorePayload['brands'];
  for (const product of core.products) {
    const section = sectionForProduct(product);
    for (const rateValue of product.rates) rows[section].push(adaptRate(product, rateValue));
    const name = product.provider_display_name;
    if (!Object.prototype.hasOwnProperty.call(brands, name)) {
      const words = name.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
      const short = words.length <= 1
        ? (words[0] ?? name).slice(0, 8)
        : words.slice(0, 3).map((word) => word[0]?.toUpperCase() ?? '').join('');
      brands[name] = { short: short || '-', color: '#64748b' };
    }
  }
  return {
    schema_version: 1,
    run_date: core.observation_date,
    sections: Object.fromEntries(SECTION_KEYS.map((section) => [
      section,
      { rates: rows[section], ribbon: rebuildSectionRibbon(rows[section]) },
    ])) as CorePayload['sections'],
    brands,
    rba: trustedLegacy.rba.map((entry) => ({ ...entry })),
    ...(trustedLegacy.rba_holds ? { rba_holds: [...trustedLegacy.rba_holds] } : {}),
  };
}
