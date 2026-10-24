import { useEffect, useMemo, useRef, useState } from 'react';

import type { MortgageComparisonInputs } from '../data/mortgageComparison';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../data/mortgageComparison';
import type { RateConditionContext } from '../data/rateConditions';
import {
  publicRecommendationRows,
  resolvedPublicRankingRows,
  resolvedPublicRankingRowsCooperatively,
  type PublicCatalogueView,
  type PublicRankingResolution,
} from '../data/publicRateIntegration';
import type { RateScenario } from '../data/publicRateModel';
import { scheduleAfterInteractions, scheduleAfterNavigation, yieldToUi } from '../lib/yieldToUi';
import type { RateRow, SectionKey } from '../types';

/** Pricing is heavier than filter/sort; keep the sync path for tiny fixtures only. */
export const SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT = 48;

const EMPTY_RESOLUTION: PublicRankingResolution = {
  rows: [], priced: 0, unresolved: 0, complete: false,
};

const EMPTY_MORTGAGE = {
  rows: [] as RateRow[],
  unverified: 0,
  unverifiedRows: new WeakSet<RateRow>(),
  invalid: false,
};

/**
 * Resolve payable public rates (and optional mortgage amount/LVR scope) without
 * blocking the JS thread on a full-day catalogue. Small fixtures stay sync so
 * unit tests and sparse sections keep immediate readiness.
 */
export function useResolvedPublicRankingRows(options: {
  sourceRows?: readonly RateRow[];
  /** Pre-built offer candidates; skips publicRecommendationRows when set. */
  candidates?: readonly RateRow[] | null;
  catalogue: PublicCatalogueView;
  section: SectionKey;
  sectionScenario: RateScenario;
  rowScenario: (row: RateRow) => RateScenario;
  mortgageInputs?: MortgageComparisonInputs;
  mortgageContext?: RateConditionContext;
  applyMortgageScope?: boolean;
  focused: boolean;
  revision: number;
}) {
  const {
    sourceRows = EMPTY_RESOLUTION.rows, candidates: providedCandidates = null, catalogue, section, sectionScenario, rowScenario,
    mortgageInputs, mortgageContext, applyMortgageScope = false, focused, revision,
  } = options;
  const request = useMemo(() => ({
    sourceRows, providedCandidates, catalogue, section, sectionScenario, rowScenario,
    mortgageInputs, mortgageContext, applyMortgageScope, revision,
  }), [sourceRows, providedCandidates, catalogue, section, sectionScenario, rowScenario, mortgageInputs, mortgageContext, applyMortgageScope, revision]);
  const [attempt, setAttempt] = useState(0);
  const preparedWhileFocused = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    request: typeof request;
    attempt: number;
    candidates: RateRow[];
    resolution: PublicRankingResolution;
    mortgage: typeof EMPTY_MORTGAGE;
  } | null>(null);
  const current = snapshot?.request === request && snapshot.attempt === attempt;
  const buildCandidates = (value: typeof request): RateRow[] => value.providedCandidates
    ? [...value.providedCandidates]
    : publicRecommendationRows(value.sourceRows, value.catalogue, value.section, value.sectionScenario);
  const synchronous = useMemo(() => {
    const inputCount = request.providedCandidates?.length ?? request.sourceRows.length;
    if (inputCount > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const candidates = buildCandidates(request);
    if (candidates.length > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const resolution = resolvedPublicRankingRows(candidates, request.catalogue, request.rowScenario);
    const mortgage = request.applyMortgageScope && request.mortgageInputs
      ? mortgageComparisonRows(resolution.rows, request.mortgageInputs, request.mortgageContext)
      : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
    return { candidates, resolution, mortgage };
  }, [request]);
  useEffect(() => {
    if (!focused) preparedWhileFocused.current = false;
    else if (synchronous || current) preparedWhileFocused.current = true;
  }, [focused, synchronous, current]);
  useEffect(() => {
    if (synchronous || !focused || current) return;
    let cancelled = false;
    const schedule = preparedWhileFocused.current ? scheduleAfterInteractions : scheduleAfterNavigation;
    const cancelNavigation = schedule(() => {
      const control = { cancelled: () => cancelled };
      void (async () => {
        // Yield once before candidate assembly; recommendation can still scan a
        // full section, but it must not share the same turn as navigation paint.
        await yieldToUi(0);
        if (cancelled) return;
        const candidates = buildCandidates(request);
        if (cancelled) return;
        const resolution = await resolvedPublicRankingRowsCooperatively(
          candidates, request.catalogue, request.rowScenario, control);
        if (cancelled || !resolution) return;
        const mortgage = request.applyMortgageScope && request.mortgageInputs
          ? await mortgageComparisonRowsCooperatively(
            resolution.rows, request.mortgageInputs, request.mortgageContext, control)
          : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
        if (cancelled || !mortgage) return;
        setSnapshot({ request, attempt, candidates, resolution, mortgage });
      })();
    });
    return () => { cancelled = true; cancelNavigation(); };
  }, [request, synchronous, focused, attempt, current]);
  return {
    candidates: synchronous?.candidates ?? (current ? snapshot!.candidates : []),
    resolution: synchronous?.resolution ?? (current ? snapshot!.resolution : EMPTY_RESOLUTION),
    mortgageScope: synchronous?.mortgage ?? (current ? snapshot!.mortgage : EMPTY_MORTGAGE),
    ready: synchronous != null || current,
    retry: () => setAttempt(value => value + 1),
  };
}
