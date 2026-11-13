import { BANK_RESPONSE_REASONS } from '../../data/bankResponseEvidence';
import { SECTION_KEYS } from '../../types';
import { isValidCalendarDate } from '../calendarDate';
import type { AppHealthCheck, AppHealthMetricValue } from './types';

function validRow(row: unknown): row is Record<string, unknown> & { provider: string } {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return typeof r.provider === 'string' && r.provider.trim().length > 0 && SECTION_KEYS.some(section => section === r.section) &&
    isValidCalendarDate(r.decisionDate) && isValidCalendarDate(r.windowEnd) && r.decisionDate <= r.windowEnd &&
    BANK_RESPONSE_REASONS.some(reason => reason === r.sourceReason) && BANK_RESPONSE_REASONS.some(reason => reason === r.displayReason) &&
    typeof r.missingDays === 'number' && Number.isSafeInteger(r.missingDays) && r.missingDays >= 0 &&
    ['baselineAvailable', 'displayed', 'moveKnown', 'timingKnown', 'firstMoveVerified'].every(key => typeof r[key] === 'boolean') &&
    (!r.firstMoveVerified || r.moveKnown === true && r.timingKnown === true) &&
    (!['recorded-move', 'no-recorded-move', 'no-products'].includes(String(r.displayReason)) ||
      r.baselineAvailable === true && r.missingDays === 0 && r.displayed === true &&
      (r.displayReason !== 'recorded-move' || r.firstMoveVerified === true));
}

/** Retain every bank/window position, with aliased bank identities and a closed
 * schema. Never forward arbitrary nested diagnostic objects or runtime prose. */
export function publicBankResponseCoverage(check: AppHealthCheck): Record<string, AppHealthMetricValue> {
  const evidence = check.localEvidence?.bankResponseCoverage;
  const record = evidence && typeof evidence === 'object' ? evidence as Record<string, unknown> : null;
  const rows = record?.rows;
  if (!Array.isArray(rows)) return { bankResponseRows: '[]',
    bankResponseEvidenceInvalid: check.metrics.coverageAvailable === true };
  const banks = new Map([...new Set(rows.filter(validRow).map(row => row.provider))].sort()
    .map((provider, index) => [provider, `bank-${index + 1}`]));
  let invalid = 0;
  const output = rows.map((row: unknown) => {
    if (!validRow(row)) { invalid++; return { invalid: true }; }
    const r = row;
    return { bank: banks.get(r.provider), section: r.section, decisionDate: r.decisionDate, windowEnd: r.windowEnd,
      sourceReason: r.sourceReason, displayReason: r.displayReason, missingDays: r.missingDays,
      baselineAvailable: r.baselineAvailable, displayed: r.displayed, moveKnown: r.moveKnown,
      timingKnown: r.timingKnown, firstMoveVerified: r.firstMoveVerified };
  });
  const completeClaimInvalid = check.metrics.coverageComplete === true && (!rows.length ||
    record?.runMatches !== true || record.projectionAvailable !== true ||
    rows.some(row => !validRow(row) || !['recorded-move', 'no-recorded-move', 'no-products'].includes(String(row.displayReason))));
  return { bankResponseRows: JSON.stringify(output), bankResponseEvidenceInvalid: invalid > 0 || completeClaimInvalid || check.metrics.checked !== rows.length,
    bankResponseInvalidRows: invalid };
}
