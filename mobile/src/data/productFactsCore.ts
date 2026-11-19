import type { NormalizedProductFact, NormalizedProductFactKind, NormalizedProductFactUnit, ProductDetail, RateRow, SectionKey } from '../types';
import { Decimal } from '../lib/productTermsEngine/decimal';


export type FactCriterionOperator = 'exists' | 'eq' | 'gte' | 'lte';
export type FactCriterionScalar = string | number | boolean;

/** Persistable filter identity. At least one trusted key is required. */
export type FactCriterionIdentity =
  | { canonicalKey: string; sourceType?: string }
  | { canonicalKey?: string; sourceType: string };

export type FactCriterion = FactCriterionIdentity & {
  operator: FactCriterionOperator;
  value?: FactCriterionScalar;
  unit?: NormalizedProductFactUnit;
  cadence?: string;
};

const FACT_KINDS = new Set<NormalizedProductFactKind>([
  'fee', 'rate', 'tier', 'bundle', 'attribute', 'feature',
  'eligibility', 'constraint', 'condition',
]);
const FACT_UNITS = new Set([
  'AUD', 'fraction', 'duration', 'day', 'month', 'year',
  'count', 'boolean', 'text', 'enum',
]);

const isFactUnit = (value: unknown): value is NormalizedProductFactUnit =>
  typeof value === 'string' && (FACT_UNITS.has(value) || /^[A-Z]{3}$/.test(value));

/** Only these normalized keys may become interactive feature filters. */
export const CURATED_FEATURE_FACT_KEYS = new Set([
  'OFFSET', 'EXTRA_REPAYMENTS', 'REDRAW', 'GUARANTOR', 'CASHBACK_OFFER',
  'CARD_ACCESS', 'NPP_PAYID', 'UNLIMITED_TXNS', 'BILL_PAYMENT', 'OVERDRAFT',
  'FREE_TXNS', 'DIGITAL_BANKING', 'NOTIFICATIONS',
]);

/** Customer eligibility dimensions suitable for an exact-match product filter. */
export const CURATED_ELIGIBILITY_FACT_KEYS = new Set([
  'MIN_AGE', 'MAX_AGE', 'RESIDENCY', 'RESIDENCY_STATUS', 'EMPLOYMENT_STATUS',
  'CUSTOMER_TYPE', 'BORROWER_TYPE', 'NATURAL_PERSON', 'BUSINESS',
  'FIRST_HOME_BUYER', 'EXISTING_CUSTOMER', 'STAFF', 'MEMBERSHIP',
]);

/** Numeric/product boundaries exposed alongside eligibility filters. */
export const CURATED_CONSTRAINT_FACT_KEYS = new Set([
  'MIN_BALANCE', 'MAX_BALANCE', 'MIN_AMOUNT', 'MAX_AMOUNT',
  'MIN_LIMIT', 'MAX_LIMIT', 'MIN_LVR', 'MAX_LVR', 'MIN_TERM', 'MAX_TERM',
]);

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim().length > 0);

const isBoundScalar = (value: unknown): value is string | number =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim() !== '');

const isNumericLike = (value: unknown): value is string | number =>
  isBoundScalar(value) && Number.isFinite(Number(value));

function isFact(value: unknown): value is NormalizedProductFact {
  if (!value || typeof value !== 'object') return false;
  const fact = value as Partial<NormalizedProductFact>;
  if (typeof fact.id !== 'string' || !fact.id.trim()) return false;
  if (fact.groupId !== undefined && (typeof fact.groupId !== 'string' || !fact.groupId.trim())) return false;
  if (fact.parentId !== undefined && (typeof fact.parentId !== 'string' || !fact.parentId.trim())) return false;
  if (typeof fact.kind !== 'string' || !FACT_KINDS.has(fact.kind as NormalizedProductFactKind)) return false;
  if (typeof fact.canonicalKey !== 'string' || !fact.canonicalKey.trim()) return false;
  if (fact.label !== undefined && (typeof fact.label !== 'string' || !fact.label.trim())) return false;
  if (fact.unit !== undefined && !isFactUnit(fact.unit)) return false;
  if (fact.value !== undefined && !isScalar(fact.value)) return false;
  if (fact.minValue !== undefined && !isBoundScalar(fact.minValue)) return false;
  if (fact.maxValue !== undefined && !isBoundScalar(fact.maxValue)) return false;
  if (fact.cadence !== undefined && typeof fact.cadence !== 'string') return false;
  if (fact.condition !== undefined && typeof fact.condition !== 'string') return false;
  if (fact.sourceType !== undefined && typeof fact.sourceType !== 'string') return false;
  if (fact.appliesTo !== undefined && (!Array.isArray(fact.appliesTo) || !fact.appliesTo.every((item) => typeof item === 'string'))) return false;
  if (fact.searchTerms !== undefined && (!Array.isArray(fact.searchTerms) || !fact.searchTerms.every((item) => typeof item === 'string'))) return false;
  if (fact.evidenceState !== undefined && !['observed', 'conditional', 'unknown', 'conflicting'].includes(fact.evidenceState)) return false;
  if (fact.valueType !== undefined && !['decimal', 'enum', 'text', 'boolean', 'duration'].includes(fact.valueType)) return false;
  if (fact.sourcePath !== undefined && (typeof fact.sourcePath !== 'string' || fact.sourcePath.length > 8192)) return false;
  if (fact.sourcePathBasis !== undefined && !['raw-cdr', 'cleaned-cdr'].includes(fact.sourcePathBasis)) return false;
  if (fact.criteriaVersion !== undefined && fact.criteriaVersion !== 1) return false;
  if (fact.criteriaVersion === 1) {
    if (!fact.evidenceState || !fact.sourcePathBasis || typeof fact.sourcePath !== 'string') return false;
    if (fact.valueType === 'decimal' && [fact.value, fact.minValue, fact.maxValue].some(value => value !== undefined
      && (typeof value !== 'string' || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value) || decimalComparison(value, '0') === null))) return false;
  }
  return true;
}

/** Runtime guard for downloaded payloads. Order and same-key variants are preserved. */
export function normalizedProductFacts(detail: ProductDetail | null | undefined): NormalizedProductFact[] {
  if (!Array.isArray(detail?.facts)) return [];
  return (detail.facts as unknown[]).filter(isFact);
}

/**
 * A lossless semantic identity for future change comparison. Never collapse
 * variants by canonicalKey: source id, typed values and condition all matter.
 */
export function productFactSignature(fact: NormalizedProductFact): string {
  return JSON.stringify({
    id: fact.id,
    groupId: fact.groupId,
    parentId: fact.parentId,
    kind: fact.kind,
    canonicalKey: fact.canonicalKey,
    label: fact.label,
    sourceType: fact.sourceType,
    value: fact.value,
    minValue: fact.minValue,
    maxValue: fact.maxValue,
    unit: fact.unit,
    cadence: fact.cadence,
    appliesTo: fact.appliesTo,
    condition: fact.condition,
    evidenceState: fact.evidenceState,
    valueType: fact.valueType,
    sourcePath: fact.sourcePath,
    sourcePathBasis: fact.sourcePathBasis,
  });
}

function candidateFilterKeys(fact: NormalizedProductFact): string[] {
  const sourceType = fact.sourceType?.trim().toUpperCase();
  const segments = fact.canonicalKey.trim().split(/[.:/]/).filter(Boolean);
  const canonicalLeaf = segments[segments.length - 1]?.toUpperCase();
  return Array.from(new Set([sourceType, canonicalLeaf].filter((key): key is string => Boolean(key))));
}

export function curatedFeatureIdentityKey(fact: NormalizedProductFact): string | null {
  if (fact.kind !== 'feature') return null;
  return candidateFilterKeys(fact).find((key) => CURATED_FEATURE_FACT_KEYS.has(key)) ?? null;
}

export function curatedFeatureFactKey(fact: NormalizedProductFact): string | null {
  if (fact.value !== true || fact.unit !== 'boolean' || fact.condition?.trim()) return null;
  return curatedFeatureIdentityKey(fact);
}

export function featureEvidenceScope(productKey: string, row?: RateRow, section?: SectionKey): string[] {
  return [productKey, section, row?.rate_type, row?.loan_purpose, row?.security_purpose,
    row?.repayment_type, row?.ribbon_repayment_type]
    .filter((value): value is string => typeof value === 'string').map(value => value.toUpperCase());
}

export function featureAppliesToScope(fact: NormalizedProductFact, scope: readonly string[]): boolean {
  return !fact.appliesTo?.length || fact.appliesTo.every(value => scope.includes(value.toUpperCase()));
}

/** All applicable variants must agree; missing values and conditions stay unknown. */
export function featureEvidenceMatches(
  detail: ProductDetail | null | undefined, key: string, expected: boolean, scope: readonly string[] = [],
  criterion?: FactCriterion,
): boolean {
  const applicable = normalizedProductFacts(detail).filter(fact => curatedFeatureIdentityKey(fact) === key
    && featureAppliesToScope(fact, scope));
  return applicable.length > 0 && (!criterion || applicable.some(fact => factIdentityMatches(fact, criterion)))
    && applicable.every(fact => fact.value === expected
    && fact.unit === 'boolean' && !fact.condition?.trim()
    && (!fact.evidenceState || fact.evidenceState === 'observed'));
}

export function curatedEligibilityFactKey(fact: NormalizedProductFact): string | null {
  if (fact.value === false) return null;
  for (const key of candidateFilterKeys(fact)) {
    if (fact.kind === 'eligibility' && CURATED_ELIGIBILITY_FACT_KEYS.has(key)) return key;
    if (fact.kind === 'constraint' && CURATED_CONSTRAINT_FACT_KEYS.has(key)) return key;
  }
  return null;
}

function factIdentityMatches(fact: NormalizedProductFact, criterion: FactCriterion): boolean {
  if (criterion.sourceType && fact.sourceType?.trim().toUpperCase() !== criterion.sourceType.trim().toUpperCase()) {
    return false;
  }
  if (criterion.canonicalKey && fact.canonicalKey !== criterion.canonicalKey) return false;
  return Boolean(criterion.sourceType || criterion.canonicalKey);
}

function scalarEquals(left: FactCriterionScalar, right: FactCriterionScalar): boolean {
  if (typeof left === 'number' || typeof right === 'number') {
    return decimalComparison(left, right) === 0;
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') return left === right;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function decimalComparison(left: FactCriterionScalar, right: FactCriterionScalar): number | null {
  if (typeof left === 'boolean' || typeof right === 'boolean') return null;
  try { return Decimal.parse(String(left)).compare(Decimal.parse(String(right))); } catch { return null; }
}

function comparisonFactValue(fact: NormalizedProductFact, operator: 'gte' | 'lte'): FactCriterionScalar | undefined {
  if (fact.value !== undefined) return fact.value;
  // A caller testing whether a customer value is inside a published range uses
  // MIN <= customer (lte) and MAX >= customer (gte). Single-bound facts fall
  // back to their only bound so MIN_AGE/MAX_AGE facts work in either shape.
  if (operator === 'gte') return fact.maxValue ?? fact.minValue;
  return fact.minValue ?? fact.maxValue;
}

export function productMatchesFactCriterion(
  detail: ProductDetail | null | undefined,
  criterion: FactCriterion,
  scope: readonly string[] = [],
): boolean {
  return productFactCriterionState(detail, criterion, scope) === 'match';
}

export type FactMatchState = 'match' | 'no-match' | 'unknown';

/** Descriptive matching requires observed, applicable and agreeing evidence.
 * Unresolved conditions are never silently treated as fulfilled eligibility. */
export function productFactCriterionState(
  detail: ProductDetail | null | undefined,
  criterion: FactCriterion,
  scope: readonly string[] = [],
): FactMatchState {
  const key = curatedFeatureIdentityKey({ id: 'criterion', kind: 'feature',
    canonicalKey: criterion.canonicalKey ?? '', sourceType: criterion.sourceType });
  if (key) {
    if (criterion.unit && criterion.unit !== 'boolean') return 'unknown';
    const expected = criterion.operator === 'exists' ? true : criterion.value;
    if (criterion.operator !== 'exists' && criterion.operator !== 'eq') return 'unknown';
    if (typeof expected !== 'boolean') return 'unknown';
    if (featureEvidenceMatches(detail, key, expected, scope, criterion)) return 'match';
    if (featureEvidenceMatches(detail, key, !expected, scope, criterion)) return 'no-match';
    return 'unknown';
  }
  const facts = normalizedProductFacts(detail).filter(fact => factIdentityMatches(fact, criterion)
    && featureAppliesToScope(fact, scope));
  if (!facts.length) return 'unknown';
  const outcomes = facts.map((fact): FactMatchState => {
    if (fact.condition?.trim() || fact.evidenceState && fact.evidenceState !== 'observed') return 'unknown';
    if (criterion.unit && fact.unit !== criterion.unit) return 'unknown';
    if (criterion.cadence && fact.cadence !== criterion.cadence) return 'unknown';
    if (fact.kind === 'fee' && fact.cadence && !criterion.cadence) return 'unknown';
    if (criterion.operator === 'exists') return fact.value !== undefined || fact.minValue !== undefined || fact.maxValue !== undefined ? 'match' : 'unknown';
    if (criterion.value === undefined) return 'unknown';
    if (criterion.operator === 'eq') {
      const values = [fact.value, fact.minValue, fact.maxValue].filter((value): value is FactCriterionScalar => value !== undefined);
      if (!values.length) return 'unknown';
      if (fact.valueType === 'decimal' && values.some(value => decimalComparison(value, criterion.value!) === null)) return 'unknown';
      return values.some(value => fact.valueType === 'decimal' ? decimalComparison(value, criterion.value!) === 0
        : scalarEquals(value, criterion.value!)) ? 'match' : 'no-match';
    }
    const factValue = comparisonFactValue(fact, criterion.operator);
    if (factValue === undefined || fact.valueType && fact.valueType !== 'decimal') return 'unknown';
    const compared = decimalComparison(factValue, criterion.value);
    if (compared === null) return 'unknown';
    return (criterion.operator === 'gte' ? compared >= 0 : compared <= 0) ? 'match' : 'no-match';
  });
  return outcomes.every(value => value === 'match') ? 'match'
    : outcomes.every(value => value === 'no-match') ? 'no-match' : 'unknown';
}

export function productFactCriteriaState(detail: ProductDetail | null | undefined,
  criteria: readonly FactCriterion[] | null | undefined, scope: readonly string[] = []): FactMatchState {
  const states = (criteria ?? []).map(criterion => productFactCriterionState(detail, criterion, scope));
  return states.includes('no-match') ? 'no-match' : states.includes('unknown') ? 'unknown' : 'match';
}

/** AND across criteria, with each criterion checking every preserved fact variant. */
export function productMatchesAllFactCriteria(
  detail: ProductDetail | null | undefined,
  criteria: FactCriterion[] | null | undefined,
  scope: readonly string[] = [],
): boolean {
  if (!criteria?.length) return true;
  return productFactCriteriaState(detail, criteria, scope) === 'match';
}

export function factCriterionId(criterion: FactCriterion): string {
  return JSON.stringify({
    canonicalKey: criterion.canonicalKey,
    sourceType: criterion.sourceType?.trim().toUpperCase(),
    operator: criterion.operator,
    value: criterion.value,
    unit: criterion.unit,
    cadence: criterion.cadence,
  });
}

export function normalizeFactCriterion(value: unknown): FactCriterion | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<FactCriterion>;
  const canonicalKey = typeof input.canonicalKey === 'string' ? input.canonicalKey.trim() : '';
  const sourceType = typeof input.sourceType === 'string' ? input.sourceType.trim().toUpperCase() : '';
  if (!canonicalKey && !sourceType) return null;
  if (!['exists', 'eq', 'gte', 'lte'].includes(String(input.operator))) return null;
  const operator = input.operator as FactCriterionOperator;
  if (operator !== 'exists' && !isScalar(input.value)) return null;
  if (input.unit !== undefined && !isFactUnit(input.unit)) return null;
  if (input.cadence !== undefined && (typeof input.cadence !== 'string' || input.cadence.length > 80
    || !/^P(?:[0-9]+(?:\.[0-9]+)?[YMWD])+(?:T(?:[0-9]+(?:\.[0-9]+)?[HMS])+)?$/i.test(input.cadence))) return null;
  return {
    ...(canonicalKey ? { canonicalKey } : {}),
    ...(sourceType ? { sourceType } : {}),
    operator,
    ...(operator !== 'exists' ? { value: input.value } : {}),
    ...(input.unit ? { unit: input.unit } : {}),
    ...(input.cadence ? { cadence: input.cadence } : {}),
  } as FactCriterion;
}

function optionCriterion(fact: NormalizedProductFact): FactCriterion | null {
  const curatedKey = curatedFeatureIdentityKey(fact) ?? curatedEligibilityFactKey(fact);
  const descriptive = fact.valueType !== undefined && ['fee', 'eligibility', 'constraint', 'attribute', 'bundle'].includes(fact.kind)
    && /^(?:fee|eligibility|constraint|product|bundle)\.[a-z0-9_.]+$/.test(fact.canonicalKey);
  if (!curatedKey && !descriptive || fact.condition?.trim() || fact.appliesTo?.length
    || fact.evidenceState && fact.evidenceState !== 'observed') return null;
  if (descriptive && fact.valueType === 'text') return null;
  if (fact.kind === 'feature' && (typeof fact.value !== 'boolean'
    || fact.unit !== 'boolean' || fact.condition?.trim() || fact.appliesTo?.length)) return null;
  // The canonical key is the curated identity. Generic source enums such as
  // OTHER are useful qualifiers but are never specific enough on their own.
  const identity: FactCriterionIdentity = {
    canonicalKey: fact.canonicalKey,
    ...(fact.sourceType?.trim() ? { sourceType: fact.sourceType.trim().toUpperCase() } : {}),
  };
  if (fact.cadence && !normalizeFactCriterion({ ...identity, operator: 'exists', cadence: fact.cadence })) return null;
  const timing = fact.cadence ? { cadence: fact.cadence } : {};
  if (fact.value !== undefined && (typeof fact.value === 'boolean' || isNumericLike(fact.value) || fact.valueType === 'enum')) {
    return { ...identity, ...timing, operator: 'eq', value: fact.value, unit: fact.unit };
  }
  // A chip represents the exact boundary the bank publishes. Threshold
  // operators are reserved for deliberate applicant-value/range criteria.
  if (fact.minValue !== undefined && fact.maxValue === undefined && isNumericLike(fact.minValue)) {
    return { ...identity, ...timing, operator: 'eq', value: fact.minValue, unit: fact.unit };
  }
  if (fact.maxValue !== undefined && fact.minValue === undefined && isNumericLike(fact.maxValue)) {
    return { ...identity, ...timing, operator: 'eq', value: fact.maxValue, unit: fact.unit };
  }
  // A scalar criterion cannot losslessly encode both ends of one range.
  if (fact.minValue !== undefined && fact.maxValue !== undefined) return null;
  return { ...identity, operator: 'exists' };
}
export { isScalar as isFactScalar, optionCriterion as factOptionCriterion };
