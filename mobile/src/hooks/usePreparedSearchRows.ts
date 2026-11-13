import { useEffect, useMemo, useRef, useState } from 'react';

import type { SearchIndexPayload } from '../data/detailSearch';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';
import { getSuitabilityRevision } from '../data/suitabilityGate';
import { filterRows, prepareSearchRows, sortRows, sortRowsCooperatively, type Filters, type MortgageRateMetric, type RankMetric, type SortKey } from '../data/selectors';
import { scheduleAfterInteractions, scheduleAfterNavigation } from '../lib/yieldToUi';
import type { ProductDetail, RateRow, SectionKey } from '../types';

const EMPTY_ROWS: RateRow[] = [];
const SYNCHRONOUS_ROW_LIMIT = 128;
const sameRows = (a: readonly RateRow[], b: readonly RateRow[]) => a === b ||
  a.length === b.length && a.every((row, index) => row === b[index]);

/** Changed membership immediately invalidates results; cancelled work never installs. */
export function usePreparedSearchRows(
  rows: RateRow[], filters: Filters, sortKey: SortKey, section: SectionKey,
  details: Record<string, ProductDetail> | null | undefined, index: SearchIndexPayload | null,
  metric: RankMetric, mortgageMetric: MortgageRateMetric, revision: number, focused: boolean,
) {
  const mandatoryRevision = getMandatoryEligibilityRevision();
  const suitabilityGateRevision = getSuitabilityRevision();
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filtersKey) as Filters, [filtersKey]);
  const membership = useMemo(() => ({ rows, filters: stableFilters, section, details, index, revision, mandatoryRevision, suitabilityGateRevision }),
    [rows, stableFilters, section, details, index, revision, mandatoryRevision, suitabilityGateRevision]);
  const request = useMemo(() => ({ membership, sortKey, metric, mortgageMetric }),
    [membership, sortKey, metric, mortgageMetric]);
  const [attempt, setAttempt] = useState(0);
  const preparedWhileFocused = useRef(false);
  type Snapshot = { request: typeof request; attempt: number; rows: RateRow[]; error: string | null };
  const [storedSnapshot, setSnapshot] = useState<Snapshot | null>(null);
  const completed = useRef<{ request: typeof request; attempt: number; filtersKey: string; result: RateRow[] }[]>([]);
  const cached = completed.current.find(item => item.attempt === attempt && item.filtersKey === filtersKey &&
    sameRows(item.request.membership.rows, rows) && item.request.membership.mandatoryRevision === mandatoryRevision &&
    item.request.membership.suitabilityGateRevision === suitabilityGateRevision && item.request.membership.section === section &&
    item.request.membership.details === details && item.request.membership.index === index &&
    item.request.membership.revision === revision && item.request.sortKey === sortKey &&
    item.request.metric === metric && item.request.mortgageMetric === mortgageMetric);
  const snapshot = useMemo(() => storedSnapshot?.request === request && storedSnapshot.attempt === attempt ? storedSnapshot
    : cached ? { request, attempt, rows: cached.result, error: null } : storedSnapshot,
  [storedSnapshot, request, attempt, cached]);
  const current = snapshot?.request === request && snapshot.attempt === attempt;
  const currentMembership = snapshot?.request.membership === membership && snapshot.attempt === attempt && snapshot.error === null;
  const sortInput = useMemo(() => {
    if (!currentMembership || current) return null;
    // Earlier sorting must not become the tie order of the next sort. Rebuild
    // the same admitted membership in the original section/scope row order.
    const matches = new Set(snapshot.rows);
    return rows.filter(row => matches.has(row));
  }, [currentMembership, current, snapshot, rows]);
  const synchronous = useMemo(() => {
    const { rows, filters, section, details, index } = membership;
    return rows.length <= SYNCHRONOUS_ROW_LIMIT
      ? filterRows(sortRows(rows, sortKey, section, metric, mortgageMetric), filters, details, index, section)
      : sortInput && sortInput.length <= SYNCHRONOUS_ROW_LIMIT
        ? sortRows(sortInput, sortKey, section, metric, mortgageMetric) : null;
  }, [membership, sortKey, metric, mortgageMetric, sortInput]);
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
      const control = { cancelled: () => cancelled || getMandatoryEligibilityRevision() !== eligibilityRevision ||
        getSuitabilityRevision() !== suitabilityRevision };
      const work = sortInput
        ? sortRowsCooperatively(sortInput, sortKey, section, metric, mortgageMetric, control)
        : prepareSearchRows(rows, stableFilters, sortKey, section, details, index, metric, mortgageMetric, control);
      void work
        .then(result => { if (!cancelled && result) {
          if (completed.current.length >= 4) completed.current.shift();
          completed.current.push({ request, attempt, filtersKey, result });
          setSnapshot({ request, attempt, rows: result, error: null });
        } })
        .catch(error => { if (!cancelled) setSnapshot({ request, attempt, rows: EMPTY_ROWS,
          error: error instanceof Error ? error.message : 'Could not prepare search results' }); });
    });
    return () => { cancelled = true; cancelNavigation(); };
  }, [request, synchronous, focused, attempt, current, sortInput, rows, stableFilters, filtersKey, sortKey, section, details, index, metric, mortgageMetric]);
  // Large reorders keep membership only as input to the worker. Withholding
  // rows preserves the list's new-result commit/measurement lifecycle.
  return { rows: synchronous ?? (current ? snapshot.rows : EMPTY_ROWS),
    ready: synchronous !== null || (current && snapshot.error === null),
    reused: cached != null && storedSnapshot?.request !== request,
    error: current ? snapshot.error : null, retry: () => setAttempt(value => value + 1) };
}
