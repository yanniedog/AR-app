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
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';

interface FacetSnapshot {
  rows: RateRow[]; details: Record<string, ProductDetail> | null | undefined;
  section: SectionKey; revision: number; mandatoryRevision: number; attempt: number;
  options: SearchFilterOptions | null; error: UiCopy | null;
}
const reusable: FacetSnapshot[] = [];
export function clearReusableSearchFilterOptions() { reusable.length = 0; }
function retain(snapshot: FacetSnapshot) {
  if (snapshot.rows.length > 50_000) return;
  const previous = reusable.findIndex(item => item.rows === snapshot.rows && item.details === snapshot.details &&
    item.section === snapshot.section && item.revision === snapshot.revision && item.mandatoryRevision === snapshot.mandatoryRevision);
  if (previous >= 0) reusable.splice(previous, 1);
  reusable.push(snapshot);
  const rowSlots = () => [...new Set(reusable.map(item => item.rows))].reduce((sum, rows) => sum + rows.length, 0);
  while (reusable.length > 6 || rowSlots() > 50_000) reusable.shift();
}

/** Warm search facets after paint, never on the synchronous route render.
 * Replaced payloads/profile gates immediately invalidate the visible model. */
export function useSearchFilterOptions(
  rows: RateRow[],
  details: Record<string, ProductDetail> | null | undefined,
  section: SectionKey,
  revision: number,
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const warmed = useRef(false);
  const mandatoryRevision = getMandatoryEligibilityRevision();
  const [stored, setSnapshot] = useState<FacetSnapshot | null>(null);
  const matches = (value: FacetSnapshot) => value.rows === rows && value.details === details &&
    value.section === section && value.revision === revision && value.mandatoryRevision === mandatoryRevision;
  const snapshot: FacetSnapshot | null = stored && matches(stored) && stored.attempt === attempt ? stored
    : attempt === 0 ? reusable.find(matches) ?? null : null;
  const ready = snapshot?.options != null;
  useEffect(() => {
    if (!enabled || ready) return;
    let cancelled = false;
    const stale = () => cancelled || mandatoryRevision !== getMandatoryEligibilityRevision();
    // First Rates entry: short paint deferral. Later filter/scope rebuilds must
    // not re-add a 300ms navigation wait on top of cooperative pricing.
    const schedule = warmed.current ? scheduleAfterInteractions : ((work: () => void) => scheduleAfterNavigation(work, 100));
    const cancelNavigation = schedule(() => {
      void prepareSearchFilterOptions(rows, details, section, { cancelled: stale }).then(options => {
        if (!stale() && options) {
          warmed.current = true;
          const value = { rows, details, section, revision, mandatoryRevision, attempt, options, error: null };
          retain(value);
          setSnapshot(value);
        }
      }).catch(error => {
        if (!stale()) {
          debugLog.error('searchFilterOptions', error instanceof Error ? error.message : String(error));
          setSnapshot({ rows, details, section, revision, mandatoryRevision, attempt, options: null, error: uiJoin('Filter', ' · ', 'Unavailable') });
        }
      });
    });
    return () => { cancelled = true; cancelNavigation(); };
  }, [rows, details, section, revision, mandatoryRevision, attempt, enabled, ready]);
  return { ready, options: ready ? snapshot.options! : EMPTY_SEARCH_FILTER_OPTIONS,
    error: snapshot?.error ?? null, retry };
}
