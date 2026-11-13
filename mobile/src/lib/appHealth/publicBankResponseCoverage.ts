import { BANK_RESPONSE_REASONS } from '../../data/bankResponseEvidence';
import { SECTION_KEYS } from '../../types';
import { isValidCalendarDate } from '../calendarDate';
import type { AppHealthCheck, AppHealthMetricValue } from './types';

/** Retain every bank/window position, with aliased bank identities and a closed
 * schema. Never forward arbitrary nested diagnostic objects or runtime prose. */
export function publicBankResponseCoverage(check: AppHealthCheck): Record<string, AppHealthMetricValue> {
  const evidence = check.localEvidence?.bankResponseCoverage;
  const rows = evidence && typeof evidence === 'object' && 'rows' in evidence ? evidence.rows : null;
  if (!Array.isArray(rows)) return { bankResponseRows: '[]',
    bankResponseEvidenceInvalid: check.metrics.coverageAvailable === true };
  const banks = new Map<string, string>();
  let invalid = 0;
  const output = rows.map((row: unknown) => {
    if (!row || typeof row !== 'object') { invalid++; return { invalid: true }; }
    const r = row as Record<string, unknown>;
    if (typeof r.provider !== 'string' || !SECTION_KEYS.some(section => section === r.section) ||
      !isValidCalendarDate(r.decisionDate) || !isValidCalendarDate(r.windowEnd) ||
      !BANK_RESPONSE_REASONS.some(reason => reason === r.sourceReason) ||
      !BANK_RESPONSE_REASONS.some(reason => reason === r.displayReason) ||
      typeof r.missingDays !== 'number' || !Number.isSafeInteger(r.missingDays) || r.missingDays < 0 ||
      ['baselineAvailable', 'displayed', 'moveKnown', 'timingKnown', 'firstMoveVerified'].some(key => typeof r[key] !== 'boolean')) {
      invalid++; return { invalid: true };
    }
    if (!banks.has(r.provider)) banks.set(r.provider, `bank-${banks.size + 1}`);
    return { bank: banks.get(r.provider), section: r.section, decisionDate: r.decisionDate, windowEnd: r.windowEnd,
      sourceReason: r.sourceReason, displayReason: r.displayReason, missingDays: r.missingDays,
      baselineAvailable: r.baselineAvailable, displayed: r.displayed, moveKnown: r.moveKnown,
      timingKnown: r.timingKnown, firstMoveVerified: r.firstMoveVerified };
  });
  return { bankResponseRows: JSON.stringify(output), bankResponseEvidenceInvalid: invalid > 0 || check.metrics.checked !== rows.length,
    bankResponseInvalidRows: invalid };
}
