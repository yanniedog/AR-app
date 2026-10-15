import { Decimal } from './productTermsEngine/decimal';
import type { TermRevision, TermsStageStatus } from '../data/productTerms';
import { uiDate, uiDecimal, uiDuration, uiIdentifier, uiJoin, uiLabel, uiNumber, type UiText } from './uiCopy';
export function uiTermsStageStatus(status: TermsStageStatus): UiText {
  return uiLabel(status === 'complete' ? 'Complete' : status === 'partial' ? 'Partial' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : status === 'not_applicable' ? 'Not applicable' : 'Unknown');
}
export function uiTermRevisionValue(revision: TermRevision): UiText {
  const value = revision.value;
  if (typeof value === 'boolean') return uiLabel(value ? 'Yes' : 'No');
  if (typeof value !== 'string' && typeof value !== 'number') return uiLabel('Source review required');
  if (revision.unit === 'date' || revision.unit === 'day-date') return uiDate(String(value));
  if (typeof value === 'string' && !/^[+-]?\d+(?:\.\d+)?$/.test(value)) return uiLabel('Source review required');
  const n = Number(value); if (!Number.isFinite(n)) return uiLabel('Unknown');
  const digits = Math.min(6, (String(value).split('.')[1] ?? '').length);
  const unit = revision.unit;
  if (unit === 'AUD') return uiDecimal(String(value));
  if (unit === 'fraction') {
    try { return uiDecimal(Decimal.parse(String(value)).mul(Decimal.parse('100')).fixed(Math.min(24, (String(value).split('.')[1] ?? '').length)), 'percent'); } catch { return uiLabel('Unknown'); }
  }
  if (unit === 'percent' || unit === '%') return uiDecimal(String(value), 'percent');
  if (unit === 'months' || unit === 'years' || unit === 'days') return uiDuration(n, unit);
  if (unit === 'count' || unit === null) return uiDecimal(String(value), 'count');
  return unit && /^[A-Z]{3}$/.test(unit) ? uiJoin(uiIdentifier(unit), ' ', uiNumber(n, digits)) : uiLabel('Source review required');
}
