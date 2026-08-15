import type {
  CanonicalProductV3,
  CorePayloadV3,
  GenerationManifestV3,
} from './types';
import {
  arrayValue,
  canonicalSha256,
  dateValue,
  deepFreeze,
  enumValue,
  exactKeys,
  httpsUrl,
  instant,
  record,
  reject,
  stableStringify,
  text,
  uniqueStrings,
} from './contractPrimitives';
import {
  stableLegacyRateIndex,
  validateCanonicalFee,
  validateCanonicalIdentity,
  validateCanonicalRate,
  validateDisclosureStatus,
  validateEvidenceReference,
} from './canonicalCoreFields';

export {
  canonicalEvidenceUid,
  canonicalFeeUid,
  canonicalProductUid,
  canonicalRateUid,
} from './canonicalCoreFields';
export { adaptCoreV3ToLegacy } from './canonicalCoreAdapter';

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

function validateCanonicalProduct(value: unknown, index: number, normalizationVersion: string): CanonicalProductV3 {
  const path = `core.products[${index}]`;
  const obj = record(value, path);
  exactKeys(obj, [
    'schema_version',
    'normalization_version',
    'identity',
    'display_name',
    'provider_display_name',
    'classification',
    'evidence',
    'rates',
    'fees',
    'evidence_refs',
  ], [], path);
  if (obj.schema_version !== 3) reject(`${path}.schema_version must be 3`);
  const normalization = text(obj.normalization_version, `${path}.normalization_version`);
  if (normalization !== normalizationVersion) reject(`${path}.normalization_version disagrees with core`);
  const identity = validateCanonicalIdentity(obj.identity, `${path}.identity`, { rate: false }) as CanonicalProductV3['identity'];

  const classification = record(obj.classification, `${path}.classification`);
  exactKeys(classification, [
    'product_kind',
    'consumer_section',
    'classification_status',
    'classification_basis',
    'classification_version',
    'quarantine_reason',
  ], [], `${path}.classification`);
  const kind = enumValue(
    classification.product_kind,
    ['mortgage', 'savings_account', 'term_deposit'],
    `${path}.classification.product_kind`,
  );
  const expectedSection = kind === 'mortgage' ? 'mortgage' : kind === 'savings_account' ? 'savings' : 'term_deposit';
  if (
    classification.consumer_section !== expectedSection ||
    classification.classification_status !== 'confirmed' ||
    classification.quarantine_reason !== null
  ) {
    reject(`${path}.classification is outside the confirmed consumer cohort`);
  }

  const evidenceRefsRaw = arrayValue(obj.evidence_refs, `${path}.evidence_refs`);
  if (!evidenceRefsRaw.length) reject(`${path}.evidence_refs must not be empty`);
  const evidenceRefs = evidenceRefsRaw.map((item, evidenceIndex) => validateEvidenceReference(
    item,
    `${path}.evidence_refs[${evidenceIndex}]`,
    identity.product_id,
  ));
  const evidenceIds = new Set(evidenceRefs.map((item) => item.evidence_id));

  const evidence = record(obj.evidence, `${path}.evidence`);
  exactKeys(evidence, [
    'availability',
    'fee_disclosure_status',
    'eligibility_disclosure_status',
    'pricing_status',
    'evidence_ids',
    'observed_at',
    'effective_date',
    'effective_to',
    'source_updated_at',
    'source_urls',
  ], [], `${path}.evidence`);
  if (evidence.availability !== 'public') reject(`${path}.evidence.availability must be public in the core cohort`);
  const productEvidenceIds = uniqueStrings(evidence.evidence_ids, `${path}.evidence.evidence_ids`, (item, itemPath) => {
    if (typeof item !== 'string' || !/^evidence:v1:[0-9a-f]{64}$/.test(item)) {
      reject(`${itemPath} is not a canonical evidence identity`);
    }
    return item;
  }, 1);
  for (const id of productEvidenceIds) {
    if (!evidenceIds.has(id)) reject(`${path}.evidence references unknown evidence ${id}`);
  }
  const observedAt = instant(evidence.observed_at, `${path}.evidence.observed_at`);
  const effectiveDate = nullableInstant(evidence.effective_date, `${path}.evidence.effective_date`);
  const effectiveTo = nullableInstant(evidence.effective_to, `${path}.evidence.effective_to`);
  const sourceUpdatedAt = nullableInstant(evidence.source_updated_at, `${path}.evidence.source_updated_at`);
  for (const ref of evidenceRefs) {
    if (
      ref.observed_at !== observedAt ||
      ref.effective_date !== effectiveDate ||
      ref.effective_to !== effectiveTo ||
      ref.source_updated_at !== sourceUpdatedAt
    ) {
      reject(`${path} product and evidence-reference lineage timestamps disagree`);
    }
  }
  if (effectiveDate !== null && Date.parse(effectiveDate) > Date.parse(observedAt)) {
    reject(`${path}.evidence public availability cannot precede effective_date`);
  }
  if (effectiveTo !== null && Date.parse(effectiveTo) <= Date.parse(observedAt)) {
    reject(`${path}.evidence public product is already expired`);
  }

  const ratesRaw = arrayValue(obj.rates, `${path}.rates`);
  if (!ratesRaw.length) reject(`${path}.rates must contain a visible rate`);
  const rates = ratesRaw.map((item, rateIndex) => validateCanonicalRate(
    item,
    `${path}.rates[${rateIndex}]`,
    identity,
    kind,
    evidenceIds,
  ));
  const sourceIndexes = new Set<number>();
  const uidCounts = new Map<string, number>();
  const legacyIndexes = new Map<number, string>();
  for (const item of rates) {
    uidCounts.set(item.identity.rate_uid, (uidCounts.get(item.identity.rate_uid) ?? 0) + 1);
  }
  for (const item of rates) {
    if (sourceIndexes.has(item.source_index)) reject(`${path}.rates source_index must be unique`);
    sourceIndexes.add(item.source_index);
    if (
      (uidCounts.get(item.identity.rate_uid) ?? 0) > 1 &&
      (item.identity.rate_identity_status !== 'ambiguous' || item.exact_alert_eligible)
    ) {
      reject(`${path}.rates duplicate semantic rates must be ambiguous and alert-ineligible`);
    }
    const indexValue = stableLegacyRateIndex(item.identity.rate_uid);
    const collision = legacyIndexes.get(indexValue);
    if (collision && collision !== item.identity.rate_uid) reject(`${path}.rates stable legacy index collision`);
    legacyIndexes.set(indexValue, item.identity.rate_uid);
  }

  const fees = arrayValue(obj.fees, `${path}.fees`).map((item, feeIndex) => validateCanonicalFee(
    item,
    `${path}.fees[${feeIndex}]`,
    identity.product_uid,
    evidenceIds,
  ));
  const feeCounts = new Map<string, number>();
  for (const item of fees) feeCounts.set(item.fee_uid, (feeCounts.get(item.fee_uid) ?? 0) + 1);
  for (const item of fees) {
    const expectedStatus = (feeCounts.get(item.fee_uid) ?? 0) > 1 ? 'ambiguous' : 'confirmed';
    if (item.fee_identity_status !== expectedStatus) {
      reject(`${path}.fees identity status disagrees with semantic uniqueness`);
    }
  }

  return deepFreeze({
    schema_version: 3,
    normalization_version: normalization,
    identity,
    display_name: text(obj.display_name, `${path}.display_name`),
    provider_display_name: text(obj.provider_display_name, `${path}.provider_display_name`),
    classification: {
      product_kind: kind,
      consumer_section: expectedSection,
      classification_status: 'confirmed',
      classification_basis: (() => {
        const basis = arrayValue(classification.classification_basis, `${path}.classification.classification_basis`)
          .map((item, basisIndex) => text(item, `${path}.classification.classification_basis[${basisIndex}]`, { min: 0 }));
        if (!basis.length) reject(`${path}.classification.classification_basis must not be empty`);
        return basis;
      })(),
      classification_version: text(classification.classification_version, `${path}.classification.classification_version`),
      quarantine_reason: null,
    },
    evidence: {
      availability: 'public',
      fee_disclosure_status: validateDisclosureStatus(evidence.fee_disclosure_status, `${path}.evidence.fee_disclosure_status`),
      eligibility_disclosure_status: validateDisclosureStatus(
        evidence.eligibility_disclosure_status,
        `${path}.evidence.eligibility_disclosure_status`,
      ),
      pricing_status: enumValue(
        evidence.pricing_status,
        ['complete', 'partial', 'unpriced', 'unknown'],
        `${path}.evidence.pricing_status`,
      ),
      evidence_ids: productEvidenceIds,
      observed_at: observedAt,
      effective_date: effectiveDate,
      effective_to: effectiveTo,
      source_updated_at: sourceUpdatedAt,
      source_urls: uniqueStrings(evidence.source_urls, `${path}.evidence.source_urls`, httpsUrl),
    },
    rates,
    fees,
    evidence_refs: evidenceRefs,
  } satisfies CanonicalProductV3);
}

export function validateCorePayloadV3(value: unknown, manifest: GenerationManifestV3): CorePayloadV3 {
  const obj = record(value, 'core');
  exactKeys(obj, ['schema_version', 'normalization_version', 'observation_date', 'products'], [], 'core');
  if (obj.schema_version !== 3) reject('core.schema_version must be 3');
  const normalization = text(obj.normalization_version, 'core.normalization_version');
  const observationDate = dateValue(obj.observation_date, 'core.observation_date');
  if (normalization !== manifest.normalization_version || observationDate !== manifest.observation_date) {
    reject('core identity disagrees with generation manifest');
  }
  const products = arrayValue(obj.products, 'core.products')
    .map((item, index) => validateCanonicalProduct(item, index, normalization));
  if (products.length !== manifest.coverage.products_consumer_eligible) {
    reject('core product count disagrees with consumer-eligible coverage');
  }
  const productUids = new Set<string>();
  const providerNamesByUid = new Map<string, string>();
  const providerUidsByName = new Map<string, string>();
  let rateCount = 0;
  for (const item of products) {
    if (productUids.has(item.identity.product_uid)) reject(`core contains duplicate product_uid ${item.identity.product_uid}`);
    productUids.add(item.identity.product_uid);
    const previousName = providerNamesByUid.get(item.identity.provider_uid);
    if (previousName && previousName !== item.provider_display_name) {
      reject(`core provider_uid ${item.identity.provider_uid} has conflicting display names`);
    }
    providerNamesByUid.set(item.identity.provider_uid, item.provider_display_name);
    const previousUid = providerUidsByName.get(item.provider_display_name);
    if (previousUid && previousUid !== item.identity.provider_uid) {
      reject(`core legacy brand key ${item.provider_display_name} is ambiguous`);
    }
    providerUidsByName.set(item.provider_display_name, item.identity.provider_uid);
    rateCount += item.rates.length;
  }
  if (rateCount !== manifest.coverage.rate_tiers_eligible) {
    reject('core rate-tier count disagrees with eligible coverage');
  }
  return deepFreeze({ schema_version: 3, normalization_version: normalization, observation_date: observationDate, products });
}

export function canonicalCoreDebugDigest(core: CorePayloadV3): string {
  return canonicalSha256(JSON.parse(stableStringify(core)));
}
