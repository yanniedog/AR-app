import { useCallback, useEffect, useState } from 'react';

import {
  EMPTY_SEARCH_FILTER_OPTIONS,
  prepareSearchFilterOptions,
  type SearchFilterOptions,
} from '../data/searchFilterOptions';
import { scheduleAfterNavigation } from '../lib/yieldToUi';
import type { ProductDetail, RateRow, SectionKey } from '../types';

/** Warm search facets after navigation, never on the synchronous route render.
 * Replaced payloads/profile gates immediately invalidate the visible model. */
export function useSearchFilterOptions(
  rows: RateRow[],
  details: Record<string, ProductDetail> | null | undefined,
  section: SectionKey,
  revision: number,
) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [snapshot, setSnapshot] = useState<{
    rows: RateRow[];
    details: typeof details;
    section: SectionKey;
    revision: number;
    attempt: number;
    options: SearchFilterOptions | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const cancelNavigation = scheduleAfterNavigation(() => {
      void prepareSearchFilterOptions(rows, details, section, { cancelled: () => cancelled }).then(options => {
        if (!cancelled && options) setSnapshot({ rows, details, section, revision, attempt, options, error: null });
      }).catch(error => {
        if (!cancelled) setSnapshot({ rows, details, section, revision, attempt, options: null,
          error: error instanceof Error && error.message.trim() ? error.message : 'Could not prepare search filters' });
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
