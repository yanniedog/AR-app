import { useEffect, useMemo, useRef, useState } from 'react';

import type { MortgageComparisonInputs } from '../data/mortgageComparison';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../data/mortgageComparison';
import type { RateConditionContext } from '../data/rateConditions';
import {
  publicCataloguePricingKey,
  publicRecommendationRows,
  publicRecommendationRowsCooperatively,
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
  /**
   * Rates (or another already-painted surface) is interactive. Skip the cold
   * navigation deferral when pricing focus flips on (mortgage.scope.apply).
   */
  interactive?: boolean;
  revision: number;
}) {
  const {
    sourceRows = EMPTY_RESOLUTION.rows, candidates: providedCandidates = null, catalogue, section, sectionScenario, rowScenario,
    mortgageInputs, mortgageContext, applyMortgageScope = false, focused, interactive = false, revision,
  } = options;
  // Catalogue clients republish a new object on every shard tick. Key on content
  // identity so in-flight cooperative work is not cancelled mid-pass.
  const catalogueKey = publicCataloguePricingKey(catalogue);
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const rowScenarioRef = useRef(rowScenario);
  rowScenarioRef.current = rowScenario;
  const sectionScenarioRef = useRef(sectionScenario);
  sectionScenarioRef.current = sectionScenario;
  const sectionScenarioKey = useMemo(() => JSON.stringify(sectionScenario), [sectionScenario]);
  const request = useMemo(() => ({
    sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey,
    mortgageInputs, mortgageContext, applyMortgageScope, revision,
  }), [sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey, mortgageInputs, mortgageContext, applyMortgageScope, revision]);
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
  const buildCandidatesSync = (value: typeof request, view: PublicCatalogueView, scenario: RateScenario): RateRow[] => value.providedCandidates
    ? [...value.providedCandidates]
    : publicRecommendationRows(value.sourceRows, view, value.section, scenario);
  const synchronous = useMemo(() => {
    // Explicit empty candidates (Mortgage criteria gate) must stay sync-empty
    // without expanding publicCatalogueOfferRows on the render path.
    if (request.providedCandidates && request.providedCandidates.length === 0) {
      return {
        candidates: [] as RateRow[],
        resolution: { ...EMPTY_RESOLUTION, complete: catalogueRef.current.status === 'ready' && catalogueRef.current.allLoaded },
        mortgage: EMPTY_MORTGAGE,
      };
    }
    const inputCount = request.providedCandidates?.length ?? request.sourceRows.length;
    if (inputCount > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const view = catalogueRef.current;
    const candidates = buildCandidatesSync(request, view, sectionScenarioRef.current);
    if (candidates.length > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const resolution = resolvedPublicRankingRows(candidates, view, row => rowScenarioRef.current(row));
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
    const run = () => {
      const control = { cancelled: () => cancelled };
      void (async () => {
        await yieldToUi(0);
        if (cancelled) return;
        const view = catalogueRef.current;
        const candidates = request.providedCandidates
          ? [...request.providedCandidates]
          : await publicRecommendationRowsCooperatively(
            request.sourceRows, view, request.section, sectionScenarioRef.current, control);
        if (cancelled || !candidates) return;
        const resolution = await resolvedPublicRankingRowsCooperatively(
          candidates, view, row => rowScenarioRef.current(row), control);
        if (cancelled || !resolution) return;
        const mortgage = request.applyMortgageScope && request.mortgageInputs
          ? await mortgageComparisonRowsCooperatively(
            resolution.rows, request.mortgageInputs, request.mortgageContext, control)
          : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
        if (cancelled || !mortgage) return;
        setSnapshot({ request, attempt, candidates, resolution, mortgage });
      })();
    };
    // Cold tab entry keeps a short paint deferral; mortgage.scope.apply on an
    // already-focused Rates surface must not pay that again.
    const cancelNavigation = preparedWhileFocused.current || interactive
      ? scheduleAfterInteractions(run)
      : scheduleAfterNavigation(run, 100);
    return () => { cancelled = true; cancelNavigation(); };
  }, [request, synchronous, focused, interactive, attempt, current]);
  return {
    candidates: synchronous?.candidates ?? (current ? snapshot!.candidates : []),
    resolution: synchronous?.resolution ?? (current ? snapshot!.resolution : EMPTY_RESOLUTION),
    mortgageScope: synchronous?.mortgage ?? (current ? snapshot!.mortgage : EMPTY_MORTGAGE),
    ready: synchronous != null || current,
    retry: () => setAttempt(value => value + 1),
  };
}
