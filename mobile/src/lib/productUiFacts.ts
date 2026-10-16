import type { DetailItem, FeeDiscount, NormalizedProductFact } from '../types';
import { humanizeEnum, toFraction } from '../data/format';
import { descriptiveValue } from '../data/descriptiveValue';
import { uiCount, uiDuration, uiIdentifier, uiJoin, uiLabel, uiMoney, uiNumber, uiPublishedFeeName, uiRate, type UiCopy, type UiLabel, type UiText } from './uiCopy';

export interface ProductPresentationFact { label: UiCopy; value: UiText; reference: UiText; conditions: 'source-review-required' | 'none'; scope: readonly UiText[] }
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
    discount.additionalInfo || discount.description || discount.eligibility?.length ? uiJoin(' · ', 'Source review required') : null);
}
function factValue(value: unknown, unit?: string): UiText {
  if (unit === 'boolean' || typeof value === 'boolean') return value === true ? uiLabel('Yes') : value === false ? uiLabel('No') : uiLabel('Unknown');
  if (unit === 'enum' && typeof value === 'string') return humanizeEnum(value);
  if (unit === 'duration' && typeof value === 'string') {
    const parts = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(value);
    if (!parts || !parts.slice(1).some(Boolean)) return uiLabel('Unknown');
    const units: readonly (readonly [UiLabel, UiLabel])[] = [['year', 'years'], ['month', 'months'], ['week', 'weeks'], ['day', 'days']];
    const values = parts.slice(1).flatMap((raw, index) => raw ? [uiJoin(uiCount(Number(raw)), ' ', units[index][Number(raw) === 1 ? 0 : 1])] : []);
    return uiJoin(...values.flatMap((part, i) => i ? [uiLabel(', '), part] : [part]));
  }
  const n = number(value); if (n === null) return uiLabel('Unknown');
  if (unit === 'fraction') return uiRate(toFraction(n));
  if (unit === 'AUD' || unit && /^[A-Z]{3}$/.test(unit)) return money(n, unit);
  if (unit === 'day' || unit === 'month' || unit === 'year') return uiDuration(n, unit === 'day' ? 'days' : unit === 'month' ? 'months' : 'years');
  return unit === 'count' || !unit ? uiNumber(n, precision(n)) : uiLabel('Unverified');
}
export function uiNormalizedProductFact(fact: NormalizedProductFact): ProductPresentationFact {
  const lower = fact.minValue, upper = fact.maxValue;
  const value = lower !== undefined && upper !== undefined ? uiJoin(factValue(lower, fact.unit), '–', factValue(upper, fact.unit))
    : lower !== undefined ? uiJoin('≥', factValue(lower, fact.unit)) : upper !== undefined ? uiJoin('≤', factValue(upper, fact.unit)) : factValue(fact.value, fact.unit);
  return { label: humanizeEnum(fact.sourceType?.toUpperCase() !== 'OTHER' ? fact.sourceType ?? fact.canonicalKey.split(/[.:/]/).at(-1) : fact.canonicalKey.split(/[.:/]/).at(-1)),
    value: uiJoin(value, fact.cadence ? uiJoin(' · ', uiCadence(fact.cadence)) : null), reference: uiIdentifier(fact.id),
    conditions: fact.condition?.trim() ? 'source-review-required' : 'none', scope: fact.appliesTo?.map(humanizeEnum) ?? [] };
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
    case 'australian permanent resident': return uiLabel('Australian permanent resident');
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
  const codes: Readonly<Record<string, UiLabel>> = { MIN_AGE: 'Minimum age', MAX_AGE: 'Maximum age', MIN_LIMIT: 'Minimum limit', MAX_LIMIT: 'Maximum limit', MIN_BALANCE: 'Minimum balance', MAX_BALANCE: 'Maximum balance' };
  const names: Readonly<Record<string, UiLabel>> = { 'minimum age': 'Minimum age', 'maximum age': 'Maximum age', 'annual fee': 'Annual fee', 'monthly fee': 'Monthly fee' };
  const controlled = codes[item.label ?? ''] ?? names[(item.name ?? '').toLowerCase()];
  const category = controlled ? uiLabel(controlled) : humanizeEnum(item.label);
  const feeName = group === 'Fees' ? uiPublishedFeeName(item) : null;
  const label = feeName && feeName !== 'Unknown' ? uiJoin(feeName,
    category && feeName.trim().toLowerCase() !== category.trim().toLowerCase() ? uiJoin(' · ', category) : null) : category;
  const info = /^(?:Australian resident|Permanent resident)\.?$/i.exec(item.info?.trim() ?? '');
  const knownInfo = info ? uiLabel(/^Australian/i.test(info[0]) ? 'Australian resident' : 'Permanent resident') : null;
  const scalar = descriptiveValue(item.value);
  const numeric = number(scalar);
  const residencyField = group === 'Eligibility' && item.label === 'RESIDENCY_STATUS';
  const residency = residencyField ? residencyValue(item) : null;
  // These published CDR constraint codes establish the unit. Older payloads
  // contain both ratios (0.8) and percentage numbers (98), like the rate DTO.
  const lvr = group === 'Constraints' && /^(?:MIN|MAX)_LVR$/.test(item.label ?? '');
  const lvrDecimals = (scalar?.split('.')[1] ?? '').replace(/0+$/, '').length;
  const lvrValue = lvr && scalar !== null && /^\s*\d+(?:\.\d+)?\s*$/.test(scalar)
    && numeric !== null && numeric >= 0 && numeric <= 100
    ? uiRate(toFraction(numeric), Math.max(2, Math.min(6, lvrDecimals - (numeric <= 1 ? 2 : 0)))) : uiLabel('Unknown');
  const value = group === 'Fees' ? uiFeeValue(item) : residencyField ? residency ?? uiLabel('Unknown') : lvr ? lvrValue : numeric !== null ? uiJoin(group === 'Constraints' && /^(?:MIN|MAX)_(?:LIMIT|BALANCE|AMOUNT)$/.test(item.label ?? '') ? uiMoney(numeric, Math.min(2, precision(numeric))) : uiNumber(numeric, precision(numeric)),
    ['Minimum age', 'Maximum age'].includes(controlled ?? '') ? uiJoin(' ', 'years') : null)
    : residency ?? (scalar?.toLowerCase() === 'false' || scalar?.toLowerCase() === 'true' ? uiLabel(scalar.toLowerCase() === 'true' ? 'Yes' : 'No') : group === 'Features' && item.value == null && !item.info ? uiLabel('Included') : scalar ? humanizeEnum(scalar) : uiLabel('Unknown'));
  return { label: label || uiJoin(group, ' ', uiCount(index + 1)), value: uiJoin(value || uiLabel('Unknown'), knownInfo && knownInfo !== residency ? uiJoin(' · ', knownInfo) : null),
    reference: uiCount(index + 1), conditions: item.info?.trim() && !knownInfo || feeName === 'Unknown' && !!item.name?.trim()
      || group === 'Eligibility' && item.label === 'RESIDENCY_STATUS' && !!scalar && !residency
      || numeric === null && group !== 'Fees' && !item.label ? 'source-review-required' : 'none', scope: [] };
}
