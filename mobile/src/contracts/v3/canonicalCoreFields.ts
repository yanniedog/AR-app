import type {
  CanonicalFeeV3,
  CanonicalIdentityV3,
  CanonicalProductV3,
  CanonicalRateV3,
  DisclosureStatusV3,
  EvidenceRefV3,
  RateBasisV3,
  RateMetricV3,
  SemanticConditionV3,
  SemanticTierRangeV3,
  SemanticTierV3,
  TypedComparisonRateV3,
  TypedProductRateV3,
} from './types';
import {
  arrayValue,
  booleanValue,
  canonicalSha256,
  decimalString,
  deepFreeze,
  digest,
  enumValue,
  exactKeys,
  fractionString,
  httpsUrl,
  instant,
  integer,
  nullableText,
  record,
  reject,
  sameCanonicalValue,
  text,
  uniqueStrings,
} from './contractPrimitives';

const DIGEST_ID = /^(?:provider(?:-fallback)?|product|rate|fee):v1:[0-9a-f]{64}$/;
const EVIDENCE_ID = /^evidence:v1:[0-9a-f]{64}$/;
const PRODUCT_METRICS = [
  'advertised_interest',
  'base_interest',
  'conditional_interest',
  'introductory_interest',
  'published_reversion_interest',
] as const;
const EVIDENCE_STATUSES = ['verified', 'published', 'observed', 'partial', 'unknown'] as const;
const DISCLOSURE_STATUSES = ['complete', 'partial', 'unknown', 'not_applicable'] as const;

function identityDigest(kind: string, value: unknown): string {
  return canonicalSha256(['identity-v1', kind, value]);
}

export function canonicalProductUid(providerUid: string, productId: string): string {
  return `product:v1:${identityDigest('product', {
    provider_uid: providerUid,
    product_id: productId.trim(),
  })}`;
}

export function canonicalRateUid(productUid: string, semantics: SemanticTierV3): string {
  return `rate:v1:${identityDigest('rate', { product_uid: productUid, semantics })}`;
}

export function canonicalFeeUid(productUid: string, semantics: CanonicalFeeV3['semantic_fee']): string {
  return `fee:v1:${identityDigest('fee', { product_uid: productUid, semantics })}`;
}

export function canonicalEvidenceUid(
  sourceKind: string,
  sourceSha256: string,
  sourcePath: string,
  sourceLocator: string,
  sourceRecordSha256: string,
  productId: string,
): string {
  return `evidence:v1:${canonicalSha256([
    sourceKind,
    sourceSha256,
    sourcePath,
    sourceLocator,
    sourceRecordSha256,
    productId,
  ])}`;
}

export function stableLegacyRateIndex(rateUid: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < rateUid.length; index += 1) {
    hash ^= rateUid.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function digestId(value: unknown, path: string, prefix?: string): string {
  if (typeof value !== 'string' || !DIGEST_ID.test(value) || (prefix && !value.startsWith(`${prefix}:v1:`))) {
    reject(`${path} is not a canonical ${prefix ?? 'digest'} identity`);
  }
  return value;
}

function evidenceId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !EVIDENCE_ID.test(value)) reject(`${path} is not a canonical evidence identity`);
  return value;
}

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

export function validateCanonicalIdentity(
  value: unknown,
  path: string,
  expected: { product?: CanonicalIdentityV3; rate: boolean },
): CanonicalIdentityV3 {
  const obj = record(value, path);
  exactKeys(obj, [
    'provider_uid',
    'provider_identity_status',
    'product_uid',
    'product_id',
    'rate_uid',
    'rate_identity_status',
    'legacy_aliases',
  ], [], path);
  const providerUid = digestId(obj.provider_uid, `${path}.provider_uid`);
  if (!providerUid.startsWith('provider:v1:') && !providerUid.startsWith('provider-fallback:v1:')) {
    reject(`${path}.provider_uid must be a provider identity`);
  }
  const expectedProviderStatus = providerUid.startsWith('provider-fallback:') ? 'fallback' : 'confirmed';
  const providerStatus = enumValue(obj.provider_identity_status, ['confirmed', 'fallback'], `${path}.provider_identity_status`);
  if (providerStatus !== expectedProviderStatus) reject(`${path}.provider_identity_status disagrees with provider_uid`);
  const productUid = digestId(obj.product_uid, `${path}.product_uid`, 'product');
  const productId = text(obj.product_id, `${path}.product_id`);
  const aliases = uniqueStrings(
    obj.legacy_aliases,
    `${path}.legacy_aliases`,
    (item, itemPath) => text(item, itemPath, { min: 0 }),
  );
  const rateUid = expected.rate ? digestId(obj.rate_uid, `${path}.rate_uid`, 'rate') : null;
  const rateStatus = expected.rate
    ? enumValue(obj.rate_identity_status, ['confirmed', 'ambiguous'], `${path}.rate_identity_status`)
    : null;
  if (!expected.rate && (obj.rate_uid !== null || obj.rate_identity_status !== null)) {
    reject(`${path} product identity cannot carry a rate identity`);
  }
  const validated: CanonicalIdentityV3 = {
    provider_uid: providerUid,
    provider_identity_status: providerStatus,
    product_uid: productUid,
    product_id: productId,
    rate_uid: rateUid,
    rate_identity_status: rateStatus,
    legacy_aliases: aliases,
  };
  if (expected.product) {
    const inherited = ['provider_uid', 'provider_identity_status', 'product_uid', 'product_id', 'legacy_aliases'] as const;
    for (const key of inherited) {
      if (!sameCanonicalValue(validated[key], expected.product[key])) reject(`${path}.${key} disagrees with its product identity`);
    }
  } else if (productUid !== canonicalProductUid(providerUid, productId)) {
    reject(`${path}.product_uid does not match its canonical derivation`);
  }
  return validated;
}

function semanticCondition(value: unknown, path: string): SemanticConditionV3 {
  const obj = record(value, path);
  exactKeys(obj, ['type', 'value', 'additional_info'], [], path);
  return {
    type: nullableText(obj.type, `${path}.type`),
    value: nullableText(obj.value, `${path}.value`),
    additional_info: nullableText(obj.additional_info, `${path}.additional_info`),
  };
}

function semanticConditions(value: unknown, path: string): SemanticConditionV3[] {
  return arrayValue(value, path).map((item, index) => semanticCondition(item, `${path}[${index}]`));
}

function nullableDecimal(value: unknown, path: string): string | null {
  return value === null ? null : decimalString(value, path);
}

function semanticRange(value: unknown, path: string): SemanticTierRangeV3 {
  const obj = record(value, path);
  exactKeys(obj, ['unit', 'method', 'minimum', 'maximum', 'additional_info', 'conditions'], [], path);
  const minimum = nullableDecimal(obj.minimum, `${path}.minimum`);
  const maximum = nullableDecimal(obj.maximum, `${path}.maximum`);
  if (minimum !== null && maximum !== null && Number(minimum) > Number(maximum)) {
    reject(`${path}.minimum cannot exceed maximum`);
  }
  return {
    unit: nullableText(obj.unit, `${path}.unit`),
    method: nullableText(obj.method, `${path}.method`),
    minimum,
    maximum,
    additional_info: nullableText(obj.additional_info, `${path}.additional_info`),
    conditions: semanticConditions(obj.conditions, `${path}.conditions`),
  };
}

function semanticTier(value: unknown, path: string): SemanticTierV3 {
  const obj = record(value, path);
  exactKeys(obj, [
    'family',
    'rate_type',
    'application_type',
    'application_frequency',
    'calculation_frequency',
    'repayment_type',
    'loan_purpose',
    'interest_payment_due',
    'duration',
    'additional_info',
    'tiers',
    'conditions',
  ], [], path);
  return {
    family: enumValue(obj.family, ['deposit', 'lending'], `${path}.family`),
    rate_type: nullableText(obj.rate_type, `${path}.rate_type`),
    application_type: nullableText(obj.application_type, `${path}.application_type`),
    application_frequency: nullableText(obj.application_frequency, `${path}.application_frequency`),
    calculation_frequency: nullableText(obj.calculation_frequency, `${path}.calculation_frequency`),
    repayment_type: nullableText(obj.repayment_type, `${path}.repayment_type`),
    loan_purpose: nullableText(obj.loan_purpose, `${path}.loan_purpose`),
    interest_payment_due: nullableText(obj.interest_payment_due, `${path}.interest_payment_due`),
    duration: nullableText(obj.duration, `${path}.duration`),
    additional_info: nullableText(obj.additional_info, `${path}.additional_info`),
    tiers: arrayValue(obj.tiers, `${path}.tiers`).map((item, index) => semanticRange(item, `${path}.tiers[${index}]`)),
    conditions: semanticConditions(obj.conditions, `${path}.conditions`),
  };
}

function rateEvidenceIds(value: unknown, path: string): string[] {
  return uniqueStrings(value, path, evidenceId, 1);
}

function advertisedRate(value: unknown, path: string): TypedProductRateV3 {
  const obj = record(value, path);
  exactKeys(obj, ['value', 'unit', 'metric', 'basis', 'evidence_status', 'evidence_ids'], [], path);
  const metric = enumValue(obj.metric, PRODUCT_METRICS, `${path}.metric`);
  const expectedBasis: Record<RateMetricV3, RateBasisV3> = {
    advertised_interest: 'advertised',
    base_interest: 'base',
    conditional_interest: 'conditional',
    introductory_interest: 'introductory',
    published_reversion_interest: 'published_reversion',
  };
  const basis = enumValue(obj.basis, [expectedBasis[metric]], `${path}.basis`);
  if (obj.unit !== 'fraction_per_annum') reject(`${path}.unit must be fraction_per_annum`);
  return {
    value: fractionString(obj.value, `${path}.value`),
    unit: 'fraction_per_annum',
    metric,
    basis,
    evidence_status: enumValue(obj.evidence_status, EVIDENCE_STATUSES, `${path}.evidence_status`),
    evidence_ids: rateEvidenceIds(obj.evidence_ids, `${path}.evidence_ids`),
  };
}

function comparisonRate(value: unknown, path: string): TypedComparisonRateV3 | null {
  if (value === null) return null;
  const obj = record(value, path);
  exactKeys(obj, ['value', 'unit', 'metric', 'basis', 'evidence_status', 'evidence_ids'], [], path);
  if (obj.unit !== 'fraction_per_annum' || obj.metric !== 'comparison_interest' || obj.basis !== 'comparison') {
    reject(`${path} must use comparison_interest/fraction_per_annum/comparison semantics`);
  }
  return {
    value: fractionString(obj.value, `${path}.value`),
    unit: 'fraction_per_annum',
    metric: 'comparison_interest',
    basis: 'comparison',
    evidence_status: enumValue(obj.evidence_status, EVIDENCE_STATUSES, `${path}.evidence_status`),
    evidence_ids: rateEvidenceIds(obj.evidence_ids, `${path}.evidence_ids`),
  };
}

export function validateCanonicalRate(
  value: unknown,
  path: string,
  productIdentity: CanonicalIdentityV3,
  productKind: CanonicalProductV3['classification']['product_kind'],
  evidenceIds: ReadonlySet<string>,
): CanonicalRateV3 {
  const obj = record(value, path);
  exactKeys(obj, ['identity', 'advertised', 'comparison', 'semantic_tier', 'exact_alert_eligible', 'source_index'], [], path);
  const identityValue = validateCanonicalIdentity(obj.identity, `${path}.identity`, { product: productIdentity, rate: true });
  const semantics = semanticTier(obj.semantic_tier, `${path}.semantic_tier`);
  const expectedFamily = productKind === 'mortgage' ? 'lending' : 'deposit';
  if (semantics.family !== expectedFamily) reject(`${path}.semantic_tier.family contradicts product classification`);
  if (identityValue.rate_uid !== canonicalRateUid(productIdentity.product_uid, semantics)) {
    reject(`${path}.identity.rate_uid does not match its canonical derivation`);
  }
  const advertised = advertisedRate(obj.advertised, `${path}.advertised`);
  const comparison = comparisonRate(obj.comparison, `${path}.comparison`);
  for (const id of [...advertised.evidence_ids, ...(comparison?.evidence_ids ?? [])]) {
    if (!evidenceIds.has(id)) reject(`${path} references unknown evidence ${id}`);
  }
  const exactAlertEligible = booleanValue(obj.exact_alert_eligible, `${path}.exact_alert_eligible`);
  if (identityValue.rate_identity_status === 'ambiguous' && exactAlertEligible) {
    reject(`${path} ambiguous rate cannot power exact alerts`);
  }
  if (exactAlertEligible && (
    identityValue.rate_identity_status !== 'confirmed' ||
    productIdentity.provider_identity_status !== 'confirmed'
  )) {
    reject(`${path} exact alerts require confirmed provider and rate identities`);
  }
  return {
    identity: identityValue as CanonicalRateV3['identity'],
    advertised,
    comparison,
    semantic_tier: deepFreeze(semantics),
    exact_alert_eligible: exactAlertEligible,
    source_index: integer(obj.source_index, `${path}.source_index`),
  };
}

export function validateEvidenceReference(value: unknown, path: string, productId: string): EvidenceRefV3 {
  const obj = record(value, path);
  exactKeys(obj, [
    'evidence_id',
    'source_kind',
    'source_path',
    'source_locator',
    'source_sha256',
    'source_record_sha256',
    'observed_at',
    'effective_date',
    'effective_to',
    'source_updated_at',
    'source_url',
  ], [], path);
  const sourceKind = text(obj.source_kind, `${path}.source_kind`);
  const sourcePath = text(obj.source_path, `${path}.source_path`);
  if (sourcePath.startsWith('/') || sourcePath.includes('\\') || sourcePath.includes(':') || sourcePath.split('/').includes('..')) {
    reject(`${path}.source_path must be safe and relative`);
  }
  const sourceLocator = text(obj.source_locator, `${path}.source_locator`);
  const sourceSha = digest(obj.source_sha256, `${path}.source_sha256`);
  const recordSha = digest(obj.source_record_sha256, `${path}.source_record_sha256`);
  const id = evidenceId(obj.evidence_id, `${path}.evidence_id`);
  if (id !== canonicalEvidenceUid(sourceKind, sourceSha, sourcePath, sourceLocator, recordSha, productId)) {
    reject(`${path}.evidence_id does not match its canonical derivation`);
  }
  return {
    evidence_id: id,
    source_kind: sourceKind,
    source_path: sourcePath,
    source_locator: sourceLocator,
    source_sha256: sourceSha,
    source_record_sha256: recordSha,
    observed_at: instant(obj.observed_at, `${path}.observed_at`),
    effective_date: nullableInstant(obj.effective_date, `${path}.effective_date`),
    effective_to: nullableInstant(obj.effective_to, `${path}.effective_to`),
    source_updated_at: nullableInstant(obj.source_updated_at, `${path}.source_updated_at`),
    source_url: obj.source_url === null ? null : httpsUrl(obj.source_url, `${path}.source_url`),
  };
}

function semanticFee(value: unknown, path: string): CanonicalFeeV3['semantic_fee'] {
  const obj = record(value, path);
  exactKeys(obj, ['name', 'fee_type', 'method', 'cadence', 'additional_info'], [], path);
  return {
    name: text(obj.name, `${path}.name`),
    fee_type: text(obj.fee_type, `${path}.fee_type`),
    method: nullableText(obj.method, `${path}.method`),
    cadence: nullableText(obj.cadence, `${path}.cadence`),
    additional_info: nullableText(obj.additional_info, `${path}.additional_info`),
  };
}

function nullableMoney(value: unknown, path: string): string | null {
  return value === null ? null : decimalString(value, path, true);
}

export function validateCanonicalFee(
  value: unknown,
  path: string,
  productUid: string,
  evidenceIds: ReadonlySet<string>,
): CanonicalFeeV3 {
  const obj = record(value, path);
  exactKeys(obj, [
    'fee_uid',
    'fee_identity_status',
    'semantic_fee',
    'disclosure_status',
    'currency',
    'fixed_amount',
    'minimum_amount',
    'maximum_amount',
    'rate',
    'condition',
    'evidence_ids',
  ], [], path);
  const semantics = deepFreeze(semanticFee(obj.semantic_fee, `${path}.semantic_fee`));
  const feeUid = digestId(obj.fee_uid, `${path}.fee_uid`, 'fee');
  if (feeUid !== canonicalFeeUid(productUid, semantics)) reject(`${path}.fee_uid does not match its canonical derivation`);
  const fixedAmount = nullableMoney(obj.fixed_amount, `${path}.fixed_amount`);
  const minimumAmount = nullableMoney(obj.minimum_amount, `${path}.minimum_amount`);
  const maximumAmount = nullableMoney(obj.maximum_amount, `${path}.maximum_amount`);
  if (minimumAmount !== null && maximumAmount !== null && Number(minimumAmount) > Number(maximumAmount)) {
    reject(`${path}.minimum_amount cannot exceed maximum_amount`);
  }
  let feeRate: CanonicalFeeV3['rate'] = null;
  if (obj.rate !== null) {
    const rateObj = record(obj.rate, `${path}.rate`);
    exactKeys(rateObj, ['value', 'unit', 'evidence_status', 'evidence_ids'], [], `${path}.rate`);
    if (rateObj.unit !== 'fraction_of_amount') reject(`${path}.rate.unit must be fraction_of_amount`);
    feeRate = {
      value: fractionString(rateObj.value, `${path}.rate.value`),
      unit: 'fraction_of_amount',
      evidence_status: enumValue(rateObj.evidence_status, EVIDENCE_STATUSES, `${path}.rate.evidence_status`),
      evidence_ids: rateEvidenceIds(rateObj.evidence_ids, `${path}.rate.evidence_ids`),
    };
  }
  const evidence = rateEvidenceIds(obj.evidence_ids, `${path}.evidence_ids`);
  for (const id of [...evidence, ...(feeRate?.evidence_ids ?? [])]) {
    if (!evidenceIds.has(id)) reject(`${path} references unknown evidence ${id}`);
  }
  const methods = Number(fixedAmount !== null) + Number(minimumAmount !== null || maximumAmount !== null) + Number(feeRate !== null);
  if (methods > 1) reject(`${path} contains contradictory pricing methods`);
  const disclosure = enumValue(obj.disclosure_status, DISCLOSURE_STATUSES, `${path}.disclosure_status`);
  if (disclosure === 'complete' && methods === 0) reject(`${path} complete disclosure requires published pricing`);
  if (disclosure === 'unknown' && methods > 0) reject(`${path} unknown disclosure cannot carry settled pricing`);
  const currency = obj.currency === null ? null : text(obj.currency, `${path}.currency`);
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) reject(`${path}.currency must be an ISO 4217 code`);
  if (disclosure === 'complete' && (fixedAmount !== null || minimumAmount !== null || maximumAmount !== null) && currency === null) {
    reject(`${path} complete monetary pricing requires currency`);
  }
  return {
    fee_uid: feeUid,
    fee_identity_status: enumValue(obj.fee_identity_status, ['confirmed', 'ambiguous'], `${path}.fee_identity_status`),
    semantic_fee: semantics,
    disclosure_status: disclosure,
    currency,
    fixed_amount: fixedAmount,
    minimum_amount: minimumAmount,
    maximum_amount: maximumAmount,
    rate: feeRate,
    condition: nullableText(obj.condition, `${path}.condition`),
    evidence_ids: evidence,
  };
}

export function validateDisclosureStatus(value: unknown, path: string): DisclosureStatusV3 {
  return enumValue(value, DISCLOSURE_STATUSES, path);
}
