import { BANK_RESPONSE_REASONS } from '../../data/bankResponseEvidence';
import { SECTION_KEYS } from '../../types';
import { isValidCalendarDate } from '../calendarDate';
import type { AppHealthCheck, AppHealthMetricValue } from './types';
const FLAGS = ['baselineAvailable', 'displayed', 'moveKnown', 'timingKnown', 'firstMoveVerified'] as const;

function validRow(row: unknown): row is Record<string, unknown> & { provider: string } {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return typeof r.provider === 'string' && r.provider.trim().length > 0 && SECTION_KEYS.some(section => section === r.section) &&
    isValidCalendarDate(r.decisionDate) && isValidCalendarDate(r.windowEnd) && r.decisionDate <= r.windowEnd &&
    BANK_RESPONSE_REASONS.some(reason => reason === r.sourceReason) && BANK_RESPONSE_REASONS.some(reason => reason === r.displayReason) &&
    typeof r.missingDays === 'number' && Number.isSafeInteger(r.missingDays) && r.missingDays >= 0 &&
    FLAGS.every(key => typeof r[key] === 'boolean') &&
    (!r.firstMoveVerified || r.moveKnown === true && r.timingKnown === true) &&
    (!['no-recorded-move', 'no-products'].includes(String(r.displayReason)) || r.moveKnown === false && r.timingKnown === false) &&
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
  const valid = rows.filter(validRow);
  const banks = new Map([...new Set(valid.map(row => row.provider))].sort().map((provider, index) => [provider, index]));
  const windowKey = (row: Record<string, unknown>) => JSON.stringify([row.decisionDate, row.windowEnd]);
  const windows = [...new Set(valid.map(windowKey))].sort();
  const windowIndices = new Map(windows.map((key, index) => [key, index]));
  let invalid = 0;
  const output = rows.map((row: unknown) => {
    if (!validRow(row)) { invalid++; return null; }
    const r = row;
    return [banks.get(r.provider), SECTION_KEYS.findIndex(section => section === r.section), windowIndices.get(windowKey(r)),
      BANK_RESPONSE_REASONS.findIndex(reason => reason === r.sourceReason), BANK_RESPONSE_REASONS.findIndex(reason => reason === r.displayReason),
      r.missingDays, FLAGS.reduce((bits, key, index) => bits | (r[key] ? 1 << index : 0), 0)];
  });
  const completeClaimInvalid = check.metrics.coverageComplete === true && (!rows.length ||
    record?.runMatches !== true || record.projectionAvailable !== true ||
    rows.some(row => !validRow(row) || !['recorded-move', 'no-recorded-move', 'no-products'].includes(String(row.displayReason))));
  return { bankResponseRowSchema: JSON.stringify({ version: 1,
    columns: ['bank', 'section', 'window', 'sourceReason', 'displayReason', 'missingDays', 'flags'],
    banks: [...banks.values()].map(index => `bank-${index + 1}`), sections: SECTION_KEYS,
    windows: windows.map(key => JSON.parse(key)), reasons: BANK_RESPONSE_REASONS, flags: FLAGS, invalidRow: null }),
    bankResponseRows: JSON.stringify(output), bankResponseEvidenceInvalid: invalid > 0 || completeClaimInvalid || check.metrics.checked !== rows.length,
    bankResponseInvalidRows: invalid };
}
