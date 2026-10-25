import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_SEARCH_FILTER_OPTIONS,
  prepareSearchFilterOptions,
  type SearchFilterOptions,
} from '../data/searchFilterOptions';
import { scheduleAfterInteractions, scheduleAfterNavigation } from '../lib/yieldToUi';
import type { ProductDetail, RateRow, SectionKey } from '../types';
import { uiJoin, type UiCopy } from '../lib/uiCopy';
import { debugLog } from '../lib/debugLog';

/** Warm search facets after paint, never on the synchronous route render.
 * Replaced payloads/profile gates immediately invalidate the visible model. */
export function useSearchFilterOptions(
  rows: RateRow[],
  details: Record<string, ProductDetail> | null | undefined,
  section: SectionKey,
  revision: number,
) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const warmed = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    rows: RateRow[];
    details: typeof details;
    section: SectionKey;
    revision: number;
    attempt: number;
    options: SearchFilterOptions | null;
    error: UiCopy | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // First Rates entry: short paint deferral. Later filter/scope rebuilds must
    // not re-add a 300ms navigation wait on top of cooperative pricing.
    const schedule = warmed.current ? scheduleAfterInteractions : ((work: () => void) => scheduleAfterNavigation(work, 100));
    const cancelNavigation = schedule(() => {
      void prepareSearchFilterOptions(rows, details, section, { cancelled: () => cancelled }).then(options => {
        if (!cancelled && options) {
          warmed.current = true;
          setSnapshot({ rows, details, section, revision, attempt, options, error: null });
        }
      }).catch(error => {
        if (!cancelled) {
          debugLog.error('searchFilterOptions', error instanceof Error ? error.message : String(error));
          setSnapshot({ rows, details, section, revision, attempt, options: null, error: uiJoin('Filter', ' · ', 'Unavailable') });
        }
      });
    });
    return () => { cancelled = true; cancelNavigation(); };
  }, [rows, details, section, revision, attempt]);
  const current = snapshot?.rows === rows && snapshot.details === details &&
    snapshot.section === section && snapshot.revision === revision && snapshot.attempt === attempt;
  const ready = current && snapshot.options !== null;
  return { ready, options: ready ? snapshot.options! : EMPTY_SEARCH_FILTER_OPTIONS,
    error: current ? snapshot.error : null, retry };
}
