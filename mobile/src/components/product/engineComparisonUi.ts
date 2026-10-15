import type { SavingsSubject } from '../../data/monetaryContracts/types';
import type { TermRevision } from '../../data/productTerms';
import { uiDecimal, uiIdentifier, uiJoin, uiLabel, type UiText } from '../../lib/uiCopy';

/** Policy scope tokens are identifiers; unrecognized source wording never enters. */
export function uiEngineScope(value: string): UiText {
  return value === 'all_source_declared' ? uiLabel('All') : value === 'none_source_declared' ? uiLabel('None') : uiIdentifier(value);
}
export function uiSavingsTier(period: Pick<SavingsSubject['policy']['intervals'][number], 'tiers' | 'allocation'>, index: number): UiText {
  const upper = period.tiers[index].upperInclusive, lower = index ? period.tiers[index - 1].upperInclusive : '0';
  return uiJoin(period.allocation === 'marginal' ? 'Marginal tier' : 'Whole balance', ' · ', index ? '>' : '≥', uiDecimal(lower), upper === null ? null : uiJoin(' · ', '≤', uiDecimal(upper)));
}
/** Only represented numeric/boolean term facts are displayed; clauses remain source-only. */
export function uiCanonicalTermValue(revision: Pick<TermRevision, 'value'>): UiText {
  if (typeof revision.value === 'boolean') return uiLabel(revision.value ? 'Yes' : 'No');
  if (typeof revision.value === 'string' && /^-?\d+(?:\.\d+)?$/.test(revision.value)) return uiDecimal(revision.value, 'count');
  if (typeof revision.value === 'number' && Number.isFinite(revision.value)) return uiDecimal(String(revision.value), 'count');
  return uiLabel('Source review required');
}
