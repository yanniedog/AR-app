import type { ConditionalRateFact, ConditionalRatePresentation } from '../data/rateConditionalFacts';
import type { EvidenceFact, EvidencePresentation } from '../data/displayEvidenceFacts';
import type { NumericConditionBoundary, PublishedNumericConditionFact } from '../data/scopedFinancialConditionFacts';
import { advertisedTermMonths } from '../data/calc';
import { parseLvrTier } from '../data/profile';
import type { RateRow } from '../types';
import type { SelectedTargetConstraint } from './selectedTargetConstraints';
import type { AccessAssessment, AccessCategory } from '../data/access';
import { uiCount, uiDate, uiDuration, uiJoin, uiLabel, uiMoney, uiNumber, uiProviderName, uiRate, type UiLabel, type UiText } from './uiCopy';

export interface FinancialFactRow { readonly label: UiLabel; readonly value: UiText }
const ACCESS_LABELS: Readonly<Record<AccessCategory, UiLabel>> = {
  staff: 'Staff', occupation: 'Occupation', membership: 'Membership', business: 'Business / SMSF', student: 'Students',
  'first-home': 'First-home buyers', youth: 'Youth', pension: 'Pensioners', geographic: 'Region', package: 'Package / existing customers', channel: 'Application channel',
};
export function uiAccessBadge(model: AccessAssessment): UiText {
  if (!model.restricted && !model.verify) return uiLabel('');
  return uiJoin(...model.categories.flatMap((category, index) => index ? [uiLabel(' / '), uiLabel(ACCESS_LABELS[category] ?? 'Unknown')] : [uiLabel(ACCESS_LABELS[category] ?? 'Unknown')]),
    model.categories.length ? uiLabel(' · ') : null, 'Eligibility unverified');
}
export function uiTargetConstraint(model: SelectedTargetConstraint): UiText {
  return uiLabel(model.status === 'outside-lvr' ? model.basis === 'source-condition' ? 'Outside published LVR' : 'Outside listed LVR tier'
    : model.status === 'outside-balance' ? model.basis === 'source-condition' ? 'Outside published balance' : 'Outside listed balance tier'
      : 'Eligibility unverified');
}

export function uiConditionalRateFact(fact: ConditionalRateFact): UiText {
  switch (fact.kind) {
    case 'rate-kind': return uiLabel(fact.value === 'bonus' ? 'Bonus rate' : 'Introductory');
    case 'bonus-conditions': return uiLabel('Conditions required');
    case 'intro-period': return uiJoin('Introductory period', ': ', fact.state === 'known' ? uiDuration(fact.months, 'months') : uiLabel('Unknown'));
    case 'ongoing-rate': return uiJoin('Ongoing rate', ': ', fact.state === 'known' ? uiRate(fact.fraction) : uiLabel('Unknown'));
  }
}
export function uiConditionalRateFacts(model: ConditionalRatePresentation): UiText {
  return uiJoin(...model.facts.flatMap((fact, index) => index ? [uiLabel(' · '), uiConditionalRateFact(fact)] : [uiConditionalRateFact(fact)]));
}
export function uiEvidenceStatus(model: EvidencePresentation): UiText {
  switch (model.kind) {
    case 'current': return uiLabel(model.observedToday ? 'Today' : 'Verified');
    case 'partial': return uiLabel('Partial');
    case 'saved': return uiLabel('Cached');
    case 'overdue': return uiLabel('Update overdue');
    case 'sample': return uiLabel('Sample data');
    case 'offline': return uiLabel('Offline');
    case 'unavailable': return uiLabel('Unavailable');
    case 'loading': return uiLabel('Loading');
  }
}
export function uiEvidenceFact(fact: EvidenceFact): FinancialFactRow {
  switch (fact.kind) {
    case 'source': return { label: 'Source', value: uiLabel(fact.value === 'remote' ? 'Verified' : fact.value === 'cache' ? 'Cached' : 'Sample data') };
    case 'observed': return { label: 'Observed', value: fact.state === 'known' ? uiDate(fact.day) : uiLabel('Unknown') };
    case 'coverage': return { label: 'Coverage', value: uiLabel(fact.value === 'complete' ? 'Complete' : fact.value === 'partial' ? 'Partial' : 'Unknown') };
    case 'providers-attempted': return { label: 'Providers attempted', value: fact.state === 'known' ? uiCount(fact.count) : uiLabel('Unknown') };
    case 'providers-succeeded': return { label: 'Providers succeeded', value: fact.state === 'known' ? uiCount(fact.count) : uiLabel('Unknown') };
    case 'providers-partial': return { label: 'Partial providers', value: fact.state === 'known' ? uiCount(fact.count) : uiLabel('Unknown') };
    case 'providers-failed': return { label: 'Failed providers', value: fact.state === 'known' ? uiCount(fact.count) : uiLabel('Unknown') };
    case 'provider-issue': return { label: 'Bank', value: uiJoin(uiProviderName({ provider: fact.provider }), ' · ', uiLabel(fact.state === 'partial' ? 'Partial' : fact.state === 'failed' ? 'Failed' : 'Unknown')) };
    case 'coverage-limitations': return { label: 'Coverage limitations', value: uiCount(fact.count) };
    case 'asset-status': return { label: 'Data', value: uiLabel(fact.value === 'live' ? 'Live' : fact.value === 'cached' ? 'Cached' : fact.value === 'sample' ? 'Sample data' : fact.value === 'partial' ? 'Partial' : fact.value === 'loading' ? 'Loading' : fact.value === 'error' ? 'Error' : 'Unavailable') };
    case 'connection': return { label: 'Connection', value: uiLabel(fact.value === 'offline' ? 'Offline' : 'Online') };
    case 'update-deadline': return { label: 'Update deadline', value: fact.state === 'known' ? uiDate(fact.utc) : uiLabel('Unknown') };
  }
}

function numberDigits(value: number): number { return Math.min(6, (String(value).split('.')[1] ?? '').length); }
function boundValue(value: number, unit: 'percent' | 'AUD' | 'months'): UiText {
  return unit === 'percent' ? uiJoin(uiNumber(value, numberDigits(value)), '%')
    : unit === 'AUD' ? uiMoney(value, numberDigits(value)) : uiDuration(value, 'months');
}
function numericRange(lower: NumericConditionBoundary, upper: NumericConditionBoundary, unit: 'percent' | 'AUD' | 'months'): UiText {
  if (lower.state === 'known' && upper.state === 'known') {
    if (lower.value === upper.value && lower.inclusive && upper.inclusive) return boundValue(lower.value, unit);
    return uiJoin(lower.inclusive ? '' : '>', boundValue(lower.value, unit), '–', upper.inclusive ? '' : '<', boundValue(upper.value, unit));
  }
  if (lower.state === 'known') return uiJoin(lower.inclusive ? '≥' : '>', boundValue(lower.value, unit));
  if (upper.state === 'known') return uiJoin(upper.inclusive ? '≤' : '<', boundValue(upper.value, unit));
  return uiLabel('Unknown');
}
export function uiConditionRange(fact: PublishedNumericConditionFact): UiText { return numericRange(fact.lower, fact.upper, fact.unit); }
export function uiConditionFact(fact: PublishedNumericConditionFact): FinancialFactRow {
  const label: UiLabel = fact.kind === 'published-lvr-range' ? 'LVR'
    : fact.kind === 'published-balance-range' ? fact.subject === 'loan-amount' ? 'Loan amount' : fact.subject === 'borrowing-amount' ? 'Borrowing amount' : fact.subject === 'deposit-balance' ? 'Deposit balance' : 'Balance'
      : fact.subject === 'fixed-term' ? 'Fixed term' : fact.subject === 'loan-term' ? 'Loan term' : fact.subject === 'deposit-term' ? 'Deposit term' : 'Term';
  return { label, value: uiConditionRange(fact) };
}
export function uiConditionTag(fact: PublishedNumericConditionFact): UiText {
  const row = uiConditionFact(fact); return uiJoin(row.label, ' ', row.value);
}
export function uiListedLvrRange(row: Pick<RateRow, 'lvr_tier'>): UiText {
  const value = row.lvr_tier?.trim() ?? '';
  const catalogueBand = /^LVR_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)$/i.exec(value);
  const upper = /^(?:LVR_)?(?:LE|<=|≤)(\d+(?:\.\d+)?)(?:%)?$/i.exec(value);
  const ordinary = /^(?:LVR_)?(?:=?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?|>\d+(?:\.\d+)?|\d+(?:\.\d+)?\+)%?$/i.test(value);
  // The catalogue's underscore spelling represents the same (lo, hi] band
  // as the existing hyphen spelling; this affects presentation only.
  const range = catalogueBand ? { lo: Number(catalogueBand[1]), hi: Number(catalogueBand[2]) }
    : upper ? { lo: 0, hi: Number(upper[1]) } : ordinary ? parseLvrTier(value) : null;
  if (!range || !Number.isFinite(range.lo) || range.lo < 0 || range.lo > 100 || range.hi < range.lo
    || (Number.isFinite(range.hi) && range.hi > 100)) return uiLabel('Unverified');
  return numericRange(range.lo > 0 ? { state: 'known', value: range.lo, inclusive: false } : { state: 'unspecified' },
    Number.isFinite(range.hi) ? { state: 'known', value: range.hi, inclusive: true } : { state: 'unspecified' }, 'percent');
}
export function uiListedLvr(row: Pick<RateRow, 'lvr_tier'>): UiText { return uiJoin('Listed LVR', ' ', uiListedLvrRange(row)); }
export function uiPublishedTerm(row: RateRow): UiText { const months = advertisedTermMonths(row); return months === null ? uiJoin('Term', ' ', 'Unknown') : uiDuration(months, 'months'); }
export function uiRateStructure(row: RateRow): UiText {
  const value = (row.ribbon_rate_structure ?? row.rate_type ?? '').toLowerCase().trim();
  return uiLabel(value === 'fixed' ? 'Fixed' : value === 'variable' ? 'Variable' : value === 'base' ? 'Ongoing' : value === 'bonus' ? 'Bonus rate' : ['intro', 'introductory'].includes(value) ? 'Introductory' : 'Unknown');
}
export function uiRepayment(row: RateRow): UiText {
  const value = (row.ribbon_repayment_type ?? row.repayment_type ?? '').toUpperCase();
  return uiLabel(['PI', 'P&I', 'PRINCIPAL_AND_INTEREST', 'PRINCIPAL_INTEREST'].includes(value) ? 'Principal & interest'
    : ['IO', 'INTEREST_ONLY'].includes(value) ? 'Interest only' : 'Unknown');
}
export function uiLoanPurpose(row: Pick<RateRow, 'loan_purpose' | 'security_purpose'>): UiText {
  const value = (row.loan_purpose ?? row.security_purpose ?? '').trim().toUpperCase();
  return uiLabel(['OO', 'OWNER_OCCUPIED', 'OWNER_OCCUPIER'].includes(value) ? 'Owner occupied' : ['INV', 'INVESTOR', 'INVESTMENT'].includes(value) ? 'Investor' : value === 'UNCONSTRAINED' ? 'Unspecified purpose' : value === 'OTHER' ? 'Other purpose' : 'Unknown');
}
export function uiBalanceTier(row: RateRow): UiText {
  const parse = (value: RateRow['balance_min']): NumericConditionBoundary => value !== undefined && String(value).trim() !== '' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(value).trim()) && Number.isFinite(Number(value))
    ? { state: 'known', value: Number(value), inclusive: true } : { state: 'unspecified' };
  const lower = parse(row.balance_min), upper = parse(row.balance_max);
  if ((row.balance_min && lower.state !== 'known') || (row.balance_max && upper.state !== 'known') ||
    (lower.state === 'known' && upper.state === 'known' && lower.value > upper.value)) return uiJoin('Balance', ' ', 'Unverified');
  return uiJoin('Balance', ' ', numericRange(lower, upper, 'AUD'));
}
