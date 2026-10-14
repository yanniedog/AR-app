import { useEffect, useMemo, useRef, useState } from 'react';

import type { SearchIndexPayload } from '../data/detailSearch';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';
import { getSuitabilityRevision } from '../data/suitabilityGate';
import { filterRows, prepareSearchRows, sortRows, type Filters, type MortgageRateMetric, type RankMetric, type SortKey } from '../data/selectors';
import { scheduleAfterInteractions, scheduleAfterNavigation } from '../lib/yieldToUi';
import type { ProductDetail, RateRow, SectionKey } from '../types';

const EMPTY_ROWS: RateRow[] = [];
const SYNCHRONOUS_ROW_LIMIT = 128;

/** Replaced inputs immediately invalidate results; cancelled work never installs. */
export function usePreparedSearchRows(
  rows: RateRow[], filters: Filters, sortKey: SortKey, section: SectionKey,
  details: Record<string, ProductDetail> | null | undefined, index: SearchIndexPayload | null,
  metric: RankMetric, mortgageMetric: MortgageRateMetric, revision: number, focused: boolean,
) {
  const request = useMemo(() => ({ rows, filters, sortKey, section, details, index, metric, mortgageMetric, revision }),
    [rows, filters, sortKey, section, details, index, metric, mortgageMetric, revision]);
  const [attempt, setAttempt] = useState(0);
  const preparedWhileFocused = useRef(false);
  const [snapshot, setSnapshot] = useState<{ request: typeof request; attempt: number; rows: RateRow[]; error: string | null } | null>(null);
  const synchronous = useMemo(() => request.rows.length <= SYNCHRONOUS_ROW_LIMIT
    ? filterRows(sortRows(request.rows, request.sortKey, request.section, request.metric, request.mortgageMetric),
      request.filters, request.details, request.index, request.section) : null, [request]);
  const current = snapshot?.request === request && snapshot.attempt === attempt;
  useEffect(() => {
    if (!focused) preparedWhileFocused.current = false;
    else if (synchronous || current) preparedWhileFocused.current = true;
  }, [focused, synchronous, current]);
  useEffect(() => {
    if (synchronous || !focused || current) return;
    let cancelled = false;
    const eligibilityRevision = getMandatoryEligibilityRevision();
    const suitabilityRevision = getSuitabilityRevision();
    // Only entry to the route needs the navigation animation delay. Applying
    // it to every query/sort/filter added 300 ms to mounted search controls.
    const schedule = preparedWhileFocused.current ? scheduleAfterInteractions : scheduleAfterNavigation;
    const cancelNavigation = schedule(() => {
      void prepareSearchRows(request.rows, request.filters, request.sortKey, request.section,
        request.details, request.index, request.metric, request.mortgageMetric,
        { cancelled: () => cancelled || getMandatoryEligibilityRevision() !== eligibilityRevision ||
          getSuitabilityRevision() !== suitabilityRevision })
        .then(result => { if (!cancelled && result) setSnapshot({ request, attempt, rows: result, error: null }); })
        .catch(error => { if (!cancelled) setSnapshot({ request, attempt, rows: EMPTY_ROWS,
          error: error instanceof Error ? error.message : 'Could not prepare search results' }); });
    });
    return () => { cancelled = true; cancelNavigation(); };
  }, [request, synchronous, focused, attempt, current]);
  return { rows: synchronous ?? (current ? snapshot.rows : EMPTY_ROWS),
    ready: synchronous !== null || (current && snapshot.error === null),
    error: current ? snapshot.error : null, retry: () => setAttempt(value => value + 1) };
}
