import type { DetailItem, FeeDiscount, NormalizedProductFact } from '../types';
import { humanizeEnum, toFraction } from '../data/format';
import { descriptiveValue } from '../data/descriptiveValue';
import { uiCount, uiDuration, uiExactFactDecimal, uiFeeTypeLabel, uiIdentifier, uiJoin, uiLabel, uiMoney, uiNumber, uiPublishedFeeName, uiRate, type UiCopy, type UiLabel, type UiText } from './uiCopy';

export interface ProductPresentationFact {
  sourceFact?: NormalizedProductFact;
  label: UiCopy;
  value: UiText;
  reference: UiText;
  conditions: 'source-review-required' | 'none';
  conditionsUnverified: boolean;
  scope: readonly UiText[];
}

/** Repeated source entries (same label, name, value and wording) are one fact. */
export function dedupeDetailItems(items: readonly DetailItem[] | undefined): DetailItem[] {
  const seen = new Set<string>();
  return (items ?? []).filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Identical normalized facts (same id, kind, values and wording) are one fact. */
export function dedupeFacts<T extends object>(facts: readonly T[]): T[] {
  const seen = new Set<string>();
  return facts.filter(fact => {
    const key = JSON.stringify(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Annual and upfront charges are recognised by published category or name, never by guesswork. */
export function isAnnualFee(fee: DetailItem): boolean {
  const label = (fee.label ?? '').toUpperCase();
  return label === 'ANNUAL' || label === 'ANNUAL_FEE' || /\bannual\b/i.test(fee.name ?? '')
    || label === 'PERIODIC' && String(fee.additionalValue ?? fee.accrualFrequency ?? '') === 'P1Y';
}
export function isUpfrontFee(fee: DetailItem): boolean { return (fee.label ?? '').toUpperCase() === 'UPFRONT'; }
const PRESENCE_ONLY_CODES = new Set(['NATURAL_PERSON', 'BUSINESS', 'STAFF', 'STUDENT', 'PENSION_RECIPIENT', 'FIRST_HOME_BUYER', 'MIN_RESIDENCY']);

export function uiProductFactValue(fact: ProductPresentationFact): UiText {
  if (fact.sourceFact?.evidenceState === 'unknown') return uiLabel('Unknown');
  if (fact.sourceFact?.evidenceState === 'conflicting') return uiLabel('Conflicting');
  if (fact.sourceFact?.evidenceState === 'conditional') return uiJoin(fact.value, ' · ', 'Conditional');
  return uiJoin(fact.value, fact.conditionsUnverified ? uiJoin(' · ', 'Conditions', ': ', 'Unverified') : null);
}
const CASHBACK_VALUE_MAX_LENGTH = 80;
function number(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\s*\$?\s*[+-]?(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?\s*$/.test(value))) return null;
  const n = Number(String(value).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : null;
}
function precision(n: number): number { return Math.min(6, (String(n).split('.')[1] ?? '').length); }
function money(value: unknown, currency?: string): UiText {
  const n = number(value); if (n === null) return uiLabel('Unknown');
  if (!currency || currency === 'AUD') return uiMoney(n, Math.min(2, precision(n)));
  return /^[A-Z]{3}$/.test(currency) ? uiJoin(uiIdentifier(currency), ' ', uiNumber(n, Math.min(2, precision(n)))) : uiLabel('Unknown');
}
export function uiCadence(value?: string): UiText {
  if (!value) return uiLabel('');
  const match = /^P(\d+)([DWMY])$/.exec(value);
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) return uiLabel('Unverified');
  if (Number(match[1]) === 1) return uiJoin('per', ' ', match[2] === 'D' ? 'day' : match[2] === 'W' ? 'week' : match[2] === 'M' ? 'month' : 'year');
  return uiJoin('every', ' ', uiCount(Number(match[1])), ' ', match[2] === 'D' ? 'days' : match[2] === 'W' ? 'weeks' : match[2] === 'M' ? 'months' : 'years');
}
function amountRange(lo: unknown, hi: unknown, currency?: string): UiText {
  const lower = number(lo), upper = number(hi);
  if (lower !== null && upper !== null) return lower <= upper ? uiJoin(money(lower, currency), '–', money(upper, currency)) : uiLabel('Unverified');
  if (lower !== null) return uiJoin('≥', money(lower, currency));
  if (upper !== null) return uiJoin('≤', money(upper, currency));
  return uiLabel('Unknown');
}
function ratePart(raw: unknown): UiText | null {
  const n = number(raw); if (n === null || n < 0) return null; return uiRate(toFraction(n));
}
function cashbackRange(item: DetailItem): UiText | null {
  if (item.label !== 'CASHBACK_OFFER' || typeof item.value !== 'string'
    || item.value.length > CASHBACK_VALUE_MAX_LENGTH || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(item.value)) return null;
  const bound = '(?:\\d{1,12}|[1-9]\\d{0,2}(?:,\\d{3}){1,3})(?:\\.\\d{1,2})?';
  const match = new RegExp(`^ *\\$? *(${bound}) *[-–] *\\$? *(${bound}) *$`).exec(item.value);
  if (!match) return null;
  const lower = number(match[1]), upper = number(match[2]);
  return lower !== null && upper !== null && lower <= upper
    ? uiJoin(money(lower, item.currency), '–', money(upper, item.currency)) : null;
}
export function uiFeeValue(item: DetailItem): UiText {
  const method = item.feeMethodUType?.toLowerCase();
  if (item.amountStatus === 'variable' || method === 'variable' || item.label === 'VARIABLE') return amountRange(item.variable?.feeMinimum, item.variable?.feeMaximum, item.currency);
  const rate = ratePart(item.rateBased?.rate ?? item.balanceRate ?? item.transactionRate ?? item.accruedRate);
  const basis = item.rateBased?.rateType ?? (item.balanceRate !== undefined ? 'BALANCE' : item.transactionRate !== undefined ? 'TRANSACTION' : item.accruedRate !== undefined ? 'ACCRUED' : undefined);
  if (rate) return uiJoin(rate, basis ? uiJoin(' · ', humanizeEnum(basis)) : null,
    item.rateBased?.accrualFrequency || item.accrualFrequency ? uiJoin(' · ', uiCadence(item.rateBased?.accrualFrequency ?? item.accrualFrequency)) : null,
    item.rateBased?.amountRange ? uiJoin(' · ', amountRange(item.rateBased.amountRange.feeMinimum, item.rateBased.amountRange.feeMaximum, item.currency)) : null);
  if (item.amountStatus && item.amountStatus !== 'fixed') return uiLabel('Unknown');
  const legacyCadence = typeof item.value === 'string' ? uiCadence(item.value) : null;
  const amount = number(item.amount ?? item.fixedAmount?.amount ?? item.value);
  if (amount === null) {
    return legacyCadence && legacyCadence !== 'Unverified' ? uiJoin('Unknown', ' · ', legacyCadence) : uiLabel('Unknown');
  }
  return uiJoin(money(amount, item.currency),
    item.additionalValue !== undefined || item.accrualFrequency ? uiJoin(' · ', uiCadence(String(item.additionalValue ?? item.accrualFrequency)))
      : legacyCadence && legacyCadence !== 'Unverified' ? uiJoin(' · ', legacyCadence) : null);
}
export function uiFeeCap(item: DetailItem): UiText | null {
  return number(item.feeCap) === null ? null : uiJoin('Fee cap', ': ', money(item.feeCap, item.currency), item.feeCapPeriod ? uiJoin(' · ', uiCadence(item.feeCapPeriod)) : null);
}
export function uiFeeDiscount(discount: FeeDiscount): UiText {
  const amount = number(discount.amount ?? discount.fixedAmount?.amount);
  const rate = ratePart(discount.rateBased?.rate ?? discount.feeRate ?? discount.balanceRate ?? discount.transactionRate ?? discount.accruedRate);
  return uiJoin('Discount', ': ', amount !== null ? money(amount) : rate ?? uiLabel('Unknown'),
    discount.discountType ? uiJoin(' · ', humanizeEnum(discount.discountType)) : null,
    discount.additionalInfo?.trim() || discount.description?.trim() || discount.eligibility?.length
      ? uiJoin(' · ', 'Conditions', ': ', 'Unverified') : null);
}
/**
 * ISO 8601 durations such as P1Y, P30Y or PT12H read as "1 year", "30 years" or "12 hours". Week form stands alone, only the last
 * component may be fractional, and anything else is not a duration, so the published text is left as it is.
 */
function isoDurationText(value: string): UiText | null {
  const n = '(\\d+(?:[.,]\\d+)?)';
  const parts = new RegExp(`^P(?:${n}Y)?(?:${n}M)?(?:${n}W)?(?:${n}D)?(?:T(?:${n}H)?(?:${n}M)?(?:${n}S)?)?$`).exec(value.trim());
  if (!parts || /T$/.test(value.trim())) return null;
  const present = parts.slice(1).flatMap((raw, index) => raw ? [{ raw, index }] : []);
  if (!present.length || parts[3] && present.length > 1) return null;
  if (present.slice(0, -1).some(({ raw }) => /[.,]/.test(raw))) return null;
  const units: readonly (readonly [UiLabel, UiLabel])[] = [['year', 'years'], ['month', 'months'], ['week', 'weeks'], ['day', 'days'], ['hour', 'hours'], ['minute', 'minutes'], ['second', 'seconds']];
  const values = present.map(({ raw, index }) => {
    const amount = Number(raw.replace(',', '.'));
    return uiJoin(/[.,]/.test(raw) ? uiNumber(amount, raw.split(/[.,]/)[1].length) : uiCount(amount), ' ', units[index][amount === 1 ? 0 : 1]);
  });
  return uiJoin(...values.flatMap((part, i) => i ? [uiLabel(', '), part] : [part]));
}
function factValue(value: unknown, unit?: string): UiText {
  if (unit === 'boolean' || typeof value === 'boolean') return value === true ? uiLabel('Yes') : value === false ? uiLabel('No') : uiLabel('Unknown');
  if (unit === 'enum' && typeof value === 'string') return humanizeEnum(value);
  if ((unit === 'text' || !unit) && typeof value === 'string' && number(value) === null) {
    // Only a recognised controlled value is shown; other source wording stays Unknown.
    return humanizeEnum(value);
  }
  if (unit === 'duration' && typeof value === 'string') return isoDurationText(value) ?? uiLabel('Unknown');
  const n = number(value); if (n === null) return uiLabel('Unknown');
  if (unit === 'fraction') return uiRate(toFraction(n));
  if (unit === 'AUD' || unit && /^[A-Z]{3}$/.test(unit)) return money(n, unit);
  if (unit === 'day' || unit === 'month' || unit === 'year') return uiDuration(n, unit === 'day' ? 'days' : unit === 'month' ? 'months' : 'years');
  return unit === 'count' || !unit ? uiNumber(n, precision(n)) : uiLabel('Unverified');
}
export function uiNormalizedProductFact(fact: NormalizedProductFact): ProductPresentationFact {
  const lower = fact.minValue, upper = fact.maxValue;
  const declaredWithoutValue = (fact.kind === 'feature' || fact.kind === 'bundle') && fact.value === undefined && lower === undefined
    && upper === undefined && !fact.cadence && fact.evidenceState !== 'unknown' && fact.evidenceState !== 'conflicting';
  const conditionsUnverified = Boolean(fact.condition?.trim() || fact.evidenceState && fact.evidenceState !== 'observed');
  const render = (field: 'value' | 'minValue' | 'maxValue') => fact.valueType === 'decimal'
    ? uiExactFactDecimal(fact, field) : factValue(fact[field], fact.unit);
  const value = fact.evidenceState === 'unknown' ? uiLabel('Unknown') : fact.evidenceState === 'conflicting' ? uiLabel('Conflicting')
    : declaredWithoutValue ? uiLabel(fact.condition?.trim() ? 'Conditions apply' : 'Included')
    : lower !== undefined && upper !== undefined ? uiJoin(render('minValue'), '–', render('maxValue'))
      : lower !== undefined ? uiJoin('≥', render('minValue')) : upper !== undefined ? uiJoin('≤', render('maxValue')) : render('value');
  const generic = humanizeEnum(fact.sourceType?.toUpperCase() !== 'OTHER' ? fact.sourceType ?? fact.canonicalKey.split(/[.:/]/).at(-1) : fact.canonicalKey.split(/[.:/]/).at(-1));
  const other = generic === 'Unknown' || fact.canonicalKey.split(/[.:/]/).at(-1)?.toLowerCase() === 'other';
  const label = fact.kind === 'fee' ? uiFeeTypeLabel(fact.sourceType) ?? uiFeeTypeLabel(fact.canonicalKey.split(/[.:/]/).at(-1)?.toUpperCase()) ?? uiLabel('Other fee')
    : other ? uiLabel(fact.kind === 'feature' ? 'Other feature' : 'Other criterion') : generic;
  return { sourceFact: fact, label,
    value: uiJoin(value, fact.cadence ? uiJoin(' · ', uiCadence(fact.cadence)) : null), reference: uiIdentifier(fact.id),
    conditions: conditionsUnverified || declaredWithoutValue && fact.condition?.trim() ? 'source-review-required' : 'none', conditionsUnverified,
    scope: fact.appliesTo?.map(humanizeEnum) ?? [] };
}
function residencyValue(item: DetailItem): UiText | null {
  if (item.label !== 'RESIDENCY_STATUS') return null;
  // Missing additionalValue may carry a compact requirement in additionalInfo.
  // An unsupported value never falls back to a different info requirement.
  const source = item.value == null || item.value === '' ? item.info : item.value;
  if (typeof source !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(source)) return null;
  switch (source.trim().toLowerCase()) {
    case 'australian citizen':
    case 'australian citizens': return uiLabel('Australian citizen');
    case 'australian resident':
    case 'australian residents':
    case 'australian resident only':
    case 'australian residents only':
    case 'australian residents only.': return uiLabel('Australian resident');
    case 'permanent resident': return uiLabel('Permanent resident');
    case 'permanent australian resident':
    case 'australian permanent resident':
    case 'must be a permanent resident of australia':
    case 'must be a permanent resident of australia.': return uiLabel('Australian permanent resident');
    case 'australian citizen or australian permanent resident':
      return uiJoin('Australian citizen', ' ', 'or', ' ', 'Australian permanent resident');
    case 'an australian citizen or permanent resident':
    case 'australian citizen or permanent resident':
    case 'australian citizens or permanent residents':
    case 'australian citizen or permanent residency only':
    case 'australian citizen or premanent residency only':
      return uiJoin('Australian citizen', ' ', 'or', ' ', 'Permanent resident');
    case 'citizen or permanent resident':
      return uiJoin('Citizen', ' ', 'or', ' ', 'Permanent resident');
    case 'resident or citizen': return uiJoin('Resident', ' ', 'or', ' ', 'Citizen');
    case 'australian resident or citizen': return uiJoin('Australian resident', ' ', 'or', ' ', 'Citizen');
    case 'permanent australian residents or australian citizens':
      return uiJoin('Australian permanent resident', ' ', 'or', ' ', 'Australian citizen');
    default: return null;
  }
}
export function uiDetailItem(item: DetailItem, index: number, group: 'Fees' | 'Eligibility' | 'Features' | 'Constraints'): ProductPresentationFact {
  const codes: Readonly<Record<string, UiLabel>> = { MIN_AGE: 'Minimum age', MAX_AGE: 'Maximum age', MIN_LIMIT: 'Minimum limit', MAX_LIMIT: 'Maximum limit', MIN_BALANCE: 'Minimum balance', MAX_BALANCE: 'Maximum balance', OTHER: 'Other' };
  const names: Readonly<Record<string, UiLabel>> = { 'minimum age': 'Minimum age', 'maximum age': 'Maximum age', 'annual fee': 'Annual fee', 'monthly fee': 'Monthly fee' };
  const isOther = (item.label ?? '').toUpperCase() === 'OTHER';
  const controlled = isOther ? undefined : codes[item.label ?? ''] ?? names[(item.name ?? '').toLowerCase()];
  const category = group === 'Fees' ? uiFeeTypeLabel(item.label) ?? (item.label ? uiLabel('Other fee') : uiLabel('Unknown'))
    : isOther ? uiLabel(group === 'Features' ? 'Other feature' : 'Other criterion')
      : controlled ? uiLabel(controlled) : humanizeEnum(item.label);
  const feeName = group === 'Fees' ? uiPublishedFeeName(item) : null;
  const label = feeName && feeName !== 'Unknown' ? uiJoin(feeName,
    category && category !== 'Unknown' && feeName.trim().toLowerCase() !== category.trim().toLowerCase() ? uiJoin(' · ', category) : null) : category;
  const info = /^(?:Australian resident|Permanent resident)\.?$/i.exec(item.info?.trim() ?? '');
  const knownInfo = info ? uiLabel(/^Australian/i.test(info[0]) ? 'Australian resident' : 'Permanent resident') : null;
  const rejectedCashback = group === 'Features' && item.label === 'CASHBACK_OFFER'
    && typeof item.value === 'string' && item.value.length > CASHBACK_VALUE_MAX_LENGTH;
  const scalar = rejectedCashback ? null : descriptiveValue(item.value);
  const numeric = number(scalar);
  const residencyField = group === 'Eligibility' && item.label === 'RESIDENCY_STATUS';
  const residency = residencyField ? residencyValue(item) : null;
  const textLike = group === 'Eligibility' || group === 'Constraints';
  const presenceOnly = textLike && PRESENCE_ONLY_CODES.has((item.label ?? '').toUpperCase()) && item.value == null && !item.info?.trim();
  const cashback = group === 'Features' ? cashbackRange(item) : null;
  // These published CDR constraint codes establish the unit. Older payloads
  // contain both ratios (0.8) and percentage numbers (98), like the rate DTO.
  const lvr = group === 'Constraints' && /^(?:MIN|MAX)_LVR$/.test(item.label ?? '');
  const lvrDecimals = (scalar?.split('.')[1] ?? '').replace(/0+$/, '').length;
  const lvrValue = lvr && scalar !== null && /^\s*\d+(?:\.\d+)?\s*$/.test(scalar)
    && numeric !== null && numeric >= 0 && numeric <= 100
    ? uiRate(toFraction(numeric), Math.max(2, Math.min(6, lvrDecimals - (numeric <= 1 ? 2 : 0)))) : uiLabel('Unknown');
  const value = group === 'Fees' ? uiFeeValue(item) : residencyField ? residency ?? uiLabel('Unknown') : lvr ? lvrValue : numeric !== null ? uiJoin(group === 'Constraints' && /^(?:MIN|MAX)_(?:LIMIT|BALANCE|AMOUNT)$/.test(item.label ?? '') ? uiMoney(numeric, Math.min(2, precision(numeric))) : uiNumber(numeric, precision(numeric)),
    ['Minimum age', 'Maximum age'].includes(controlled ?? '') ? uiJoin(' ', 'years') : null)
    : residency ?? cashback ?? (scalar?.toLowerCase() === 'false' || scalar?.toLowerCase() === 'true' ? uiLabel(scalar.toLowerCase() === 'true' ? 'Yes' : 'No') : group === 'Features' && item.value == null ? uiLabel(item.info?.trim() ? 'Conditions apply' : 'Included') : presenceOnly ? uiLabel('Required') : scalar ? isoDurationText(scalar) ?? uiTextValue(scalar) : uiLabel('Unknown'));
  const unresolvedInfo = Boolean(item.info?.trim() && !knownInfo);
  // Unclassified eligibility prose can describe the criterion itself, rather
  // than an extra condition on a published amount or limit.
  const conditionsUnverified = unresolvedInfo && (
    group === 'Fees' || group === 'Features' && item.value == null || (group === 'Features' && item.label === 'CASHBACK_OFFER' && (cashback !== null || numeric !== null))
    || (lvr && lvrValue !== 'Unknown')
  );
  return { label: label || uiJoin(group, ' ', uiCount(index + 1)), value: uiJoin(value || uiLabel('Unknown'), knownInfo && knownInfo !== residency ? uiJoin(' · ', knownInfo) : null),
    reference: uiCount(index + 1),
    conditions: unresolvedInfo || feeName === 'Unknown' && !!item.name?.trim()
      || group === 'Eligibility' && item.label === 'RESIDENCY_STATUS' && !!scalar && !residency
      || numeric === null && group !== 'Fees' && !item.label ? 'source-review-required' : 'none',
    conditionsUnverified, scope: [] };
}
function uiTextValue(scalar: string): UiText {
  const label = humanizeEnum(scalar);
  return label !== 'Unknown' && label !== '' ? label : uiLabel('Unknown');
}
