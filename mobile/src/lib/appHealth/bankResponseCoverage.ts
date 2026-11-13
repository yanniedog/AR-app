import { buildCompactBankResponseWindows } from '../../data/bankResponseModel';
import { createBankResponseEvidenceReader, type BankResponseReason } from '../../data/bankResponseEvidence';
import type { BankInsightsPayload } from '../../data/bankInsightsTypes';
import type { RbaCalendar } from '../../data/rbaCalendar';
import { bankHistoryPairKey } from '../../data/sectionIntegrity';
import { SECTION_KEYS, type CorePayload, type SectionKey } from '../../types';
import { APP_HEALTH_CHECK_CODES, type AppHealthCheck, type AppHealthDataSnapshot } from './types';

export interface BankResponseCoverageRow {
  provider: string;
  section: SectionKey;
  decisionDate: string;
  windowEnd: string;
  sourceReason: BankResponseReason;
  displayReason: BankResponseReason;
  missingDays: number;
  baselineAvailable: boolean;
  displayed: boolean;
  moveKnown: boolean;
  timingKnown: boolean;
  firstMoveVerified: boolean;
}
export interface BankResponseCoverage {
  runDate: string;
  runMatches: boolean;
  projectionAvailable: boolean;
  windows: number;
  rows: BankResponseCoverageRow[];
}

/** Exhaustive source and selected-product coverage, independent of the visited
 * tab/date and virtualized rows. Missing banks are retained in the denominator. */
export function bankResponseCoverage(source: BankInsightsPayload | null | undefined,
  projected: BankInsightsPayload | null | undefined, calendar: RbaCalendar | null | undefined,
  core: CorePayload | null, quarantinedPairs: ReadonlySet<string> = new Set()): BankResponseCoverage | null {
  if (!source || !calendar || !core) return null;
  const rows: BankResponseCoverageRow[] = [];
  const sourceEvidence = createBankResponseEvidenceReader(source);
  const windowKey = (date: string, end: string) => `${date}:${end}`;
  const windows = new Set<string>();
  for (const section of SECTION_KEYS) {
    const sourceWindows = buildCompactBankResponseWindows(source, calendar, section);
    const displayWindows = new Map((projected === source ? sourceWindows : projected ? buildCompactBankResponseWindows(projected, calendar, section, source) : [])
      .map(window => [windowKey(window.decision.date, window.windowEnd), new Map(window.rows.map(row => [row.provider, row]))]));
    const providers = new Set([...Object.keys(source.banks).filter(provider => source.banks[provider][section]),
      ...source.events.filter(event => event.section === section).map(event => event.provider),
      ...(core.sections[section]?.rates ?? []).map(row => row.provider)]);
    sourceWindows.forEach(window => windows.add(`${window.decision.date}:${window.windowEnd}`));
    for (const window of sourceWindows) {
      const sourceRows = new Map(window.rows.map(row => [row.provider, row]));
      for (const provider of providers) {
        const raw = sourceRows.get(provider);
        const visible = displayWindows.get(windowKey(window.decision.date, window.windowEnd))?.get(provider);
        const evidence = raw?.evidence ?? sourceEvidence(section, provider,
          window.decision.date, window.windowEnd, null);
        rows.push({ provider, section, decisionDate: window.decision.date, windowEnd: window.windowEnd,
          sourceReason: evidence.reason,
          displayReason: quarantinedPairs.has(bankHistoryPairKey(provider, section)) ? 'quarantined-history'
            : visible?.evidence.reason ?? (raw && projected ? 'filtered-history' : 'missing-history'),
          missingDays: evidence.missingDays, baselineAvailable: evidence.baselineAvailable,
          displayed: !!visible, moveKnown: visible?.movePp != null, timingKnown: visible?.daysAfter != null,
          firstMoveVerified: visible?.evidence.firstMoveVerified ?? false });
      }
    }
  }
  return { runDate: source.run_date, runMatches: source.run_date === core.run_date &&
    (projected == null || projected.run_date === source.run_date),
    projectionAvailable: projected != null, windows: windows.size, rows };
}

export const BANK_RESPONSE_PUBLIC_METRICS = ['coverageAvailable', 'runMatches', 'projectionAvailable',
  'windows', 'checked', 'displayed', 'knownMoves', 'knownTiming', 'unknownMoves', 'unknownTiming',
  'noRecordedMove', 'noProducts', 'filteredHistory', 'quarantinedHistory', 'missingHistory', 'missingBaseline', 'historyGaps',
  'unverifiedFirstMoves', 'unverifiedEvents', 'coverageComplete', 'renderedCoverageVerified'] as const;

export function evaluateBankResponseCoverage(snapshot: AppHealthDataSnapshot): AppHealthCheck {
  const evidence = snapshot.bankResponseCoverage;
  const base = { id: APP_HEALTH_CHECK_CODES.BANK_RESPONSE_COVERAGE, code: APP_HEALTH_CHECK_CODES.BANK_RESPONSE_COVERAGE,
    label: 'Bank response coverage', domain: 'data-completeness' as const };
  if (!evidence) return { ...base, status: 'unavailable', metrics: { coverageAvailable: false, coverageComplete: false },
    summary: 'Unavailable' };
  const count = (reason: BankResponseReason) => evidence.rows.filter(row => row.displayReason === reason).length;
  const complete = evidence.runMatches && evidence.projectionAvailable && evidence.windows > 0 && evidence.rows.length > 0 &&
    evidence.rows.every(row => ['recorded-move', 'no-recorded-move', 'no-products'].includes(row.displayReason));
  return { ...base, status: !evidence.runMatches ? 'fail' : complete ? 'pass' : 'warn', metrics: {
    coverageAvailable: true, runMatches: evidence.runMatches, projectionAvailable: evidence.projectionAvailable,
    windows: evidence.windows, checked: evidence.rows.length, displayed: evidence.rows.filter(row => row.displayed).length,
    knownMoves: evidence.rows.filter(row => row.moveKnown).length, knownTiming: evidence.rows.filter(row => row.timingKnown).length,
    unknownMoves: evidence.rows.filter(row => !row.moveKnown && !['no-recorded-move', 'no-products'].includes(row.displayReason)).length,
    unknownTiming: evidence.rows.filter(row => !row.timingKnown && !['no-recorded-move', 'no-products'].includes(row.displayReason)).length,
    noRecordedMove: count('no-recorded-move'), noProducts: count('no-products'), filteredHistory: count('filtered-history'),
    quarantinedHistory: count('quarantined-history'),
    missingHistory: count('missing-history'), missingBaseline: count('missing-baseline'), historyGaps: count('history-gap'),
    unverifiedFirstMoves: evidence.rows.filter(row => row.moveKnown && !row.firstMoveVerified).length,
    unverifiedEvents: count('unverified-events'),
    coverageComplete: complete, renderedCoverageVerified: false,
  }, localEvidence: { bankResponseCoverage: evidence },
  summary: complete ? 'Complete' : 'Incomplete' };
}
