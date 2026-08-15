import { rebuildSectionRibbon } from '../../data/sectionIntegrity';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../../types';
import type {
  CanonicalProductV3,
  CanonicalRateV3,
  CorePayloadV3,
  RateMetricV3,
} from './types';
import { stableLegacyRateIndex } from './canonicalCoreFields';

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

function adaptRate(product: CanonicalProductV3, rateValue: CanonicalRateV3): RateRow {
  const section = sectionForProduct(product);
  const semantics = rateValue.semantic_tier;
  const months = durationMonths(semantics.duration);
  const rateType = semantics.rate_type ?? legacyMetric(rateValue.advertised.metric);
  const singleTier = semantics.tiers.length === 1 ? semantics.tiers[0] : undefined;
  const unambiguousTier =
    singleTier !== undefined &&
    semantics.conditions.length === 0 &&
    singleTier.conditions.length === 0;
  return {
    provider: product.provider_display_name,
    product_id: product.identity.product_uid,
    product_key: product.identity.product_uid,
    product_name: product.display_name,
    rate: rateValue.advertised.value,
    exact_alert_eligible: rateValue.exact_alert_eligible,
    ...(rateValue.exact_alert_eligible && rateValue.identity.rate_identity_status === 'confirmed'
      ? { rate_index: stableLegacyRateIndex(rateValue.identity.rate_uid) }
      : {}),
    rate_type: rateType,
    ...(rateValue.comparison ? { comparison_rate: rateValue.comparison.value } : {}),
    ...(semantics.repayment_type ? { repayment_type: semantics.repayment_type, ribbon_repayment_type: semantics.repayment_type } : {}),
    ...(semantics.loan_purpose ? { loan_purpose: semantics.loan_purpose } : {}),
    ...(semantics.interest_payment_due ? { interest_payment: semantics.interest_payment_due } : {}),
    ...(unambiguousTier && singleTier.minimum !== null ? { balance_min: singleTier.minimum } : {}),
    ...(unambiguousTier && singleTier.maximum !== null ? { balance_max: singleTier.maximum } : {}),
    ...(section === 'Mortgage' && (rateType === 'FIXED' || rateType === 'VARIABLE')
      ? { ribbon_rate_structure: rateType }
      : {}),
    ...(section === 'Mortgage' && rateType === 'FIXED' && months !== undefined
      ? { term_months: months, ribbon_fixed_term: months / 12 }
      : {}),
    ...(section === 'TD' && months !== undefined ? { term_months: months, term: `P${months}M` } : {}),
    ...(rateValue.advertised.metric === 'conditional_interest'
      ? section === 'TD' ? { ribbon_rate_structure: 'bonus' } : { ribbon_deposit_kind: 'bonus' }
      : rateValue.advertised.metric === 'introductory_interest'
        ? section === 'TD' ? { ribbon_rate_structure: 'introductory' } : { ribbon_deposit_kind: 'intro' }
        : {}),
    account_class:
      product.evidence.pricing_status === 'complete' &&
      product.evidence.eligibility_disclosure_status === 'complete' &&
      unambiguousTier
        ? 'standard'
        : 'non_standard',
    taxonomy_path: section === 'Mortgage'
      ? 'HOME_LOAN'
      : section === 'Savings'
        ? 'TRANS_AND_SAVINGS_ACCOUNTS'
        : 'TERM_DEPOSIT',
  };
}

export function adaptCoreV3ToLegacy(core: CorePayloadV3): CorePayload {
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
    rba: [],
  };
}
