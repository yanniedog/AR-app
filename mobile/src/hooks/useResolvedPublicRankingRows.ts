import { createPublicRateResolverIndex } from '../data/publicRateResolverIndex';
import type { AuditWorkDiagnostic } from '../lib/performanceAuditWorkDiagnostic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { nextPublicPricingBoundary } from '../data/publicRateResolver';
import type { PublicProgramme } from '../data/publicRateModel';
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
  prepareMortgageIndex?: boolean;
  /** Complete caller-owned semantics of rowScenario, beyond the section scenario. */
  resolutionContextKey?: string;
}) {
  const {
    sourceRows = EMPTY_RESOLUTION.rows, candidates: providedCandidates = null, catalogue, section, sectionScenario, rowScenario,
    mortgageInputs, mortgageContext, applyMortgageScope = false, focused, interactive = false, revision, prepareMortgageIndex = false, resolutionContextKey,
  } = options;
  const [, wakeClock] = useState(0);
  const clock = useRef({ until: Infinity, observedAt: Date.now(), revision: 0 });
  const observedAt = Date.now();
  if (observedAt >= clock.current.until || observedAt < clock.current.observedAt) {
    clock.current = { until: Infinity, observedAt, revision: clock.current.revision + 1 };
  } else clock.current.observedAt = observedAt;
  const clockRevision = clock.current.revision;
  // Catalogue clients republish a new object on every shard tick. Key on content
  // identity so in-flight cooperative work is not cancelled mid-pass, and key
  // once per snapshot so Rates renders do not re-walk every programme.
  const catalogueKey = useMemo(() => publicCataloguePricingKey(catalogue), [catalogue]);
  const resolverIndex = useMemo(() => { void catalogueKey; return createPublicRateResolverIndex(); }, [catalogueKey]);
  const resolverIndexRef = useRef(resolverIndex);
  resolverIndexRef.current = resolverIndex;
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const rowScenarioRef = useRef(rowScenario);
  rowScenarioRef.current = rowScenario;
  const sectionScenarioRef = useRef(sectionScenario);
  sectionScenarioRef.current = sectionScenario;
  const sectionScenarioKey = useMemo(() => JSON.stringify(sectionScenario), [sectionScenario]);
  const request = useMemo(() => ({
    sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey,
    mortgageInputs, mortgageContext, applyMortgageScope, revision, clockRevision, resolutionContextKey,
  }), [sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey, mortgageInputs, mortgageContext, applyMortgageScope, revision, clockRevision, resolutionContextKey]);
  const [attempt, setAttempt] = useState(0);
  const requestVersion = useRef({ request, attempt, version: 1 });
  if (requestVersion.current.request !== request || requestVersion.current.attempt !== attempt) requestVersion.current = { request, attempt, version: requestVersion.current.version + 1 };
  const workerStats = useRef({ starts: 0, restarts: 0, cancellations: 0 });
  const [progress, setProgress] = useState<{ request: typeof request; attempt: number; stage: 'candidates' | 'resolution' | 'scope' } | null>(null);
  const preparedWhileFocused = useRef(false);
  const requestRef = useRef(request);
  requestRef.current = request;
  const flightRef = useRef(0);
  type Snapshot = {
    request: typeof request;
    attempt: number;
    candidates: RateRow[];
    resolution: PublicRankingResolution;
    mortgage: typeof EMPTY_MORTGAGE;
    error: string | null;
  };
  const [storedSnapshot, setSnapshot] = useState<Snapshot | null>(null);
  const completed = useRef<{ key: string; request: typeof request; catalogue: PublicCatalogueView;
    from: number; until: number; snapshot: Snapshot }[]>([]);
  const requestKey = JSON.stringify([request.section, request.sectionScenarioKey, request.mortgageInputs,
    request.applyMortgageScope, request.revision, request.clockRevision, request.resolutionContextKey, attempt]);
  const cached = resolutionContextKey === undefined ? undefined : completed.current.find(item => item.key === requestKey && item.catalogue === catalogue &&
    item.request.sourceRows === request.sourceRows && item.request.providedCandidates === request.providedCandidates &&
    item.request.mortgageContext === request.mortgageContext && observedAt >= item.from && observedAt < item.until);
  const snapshot = storedSnapshot?.request === request && storedSnapshot.attempt === attempt ? storedSnapshot
    : cached ? { ...cached.snapshot, request, attempt } : storedSnapshot;
  const current = snapshot?.request === request && snapshot.attempt === attempt;
  if (cached) clock.current.until = cached.until;
  const collectValidity = useCallback((view: PublicCatalogueView) => {
    const started = Date.now(), seen = new Set<string>(), asOf = new Date(started).toISOString();
    let until = Infinity;
    const programme = (value: PublicProgramme) => { until = Math.min(until, nextPublicPricingBoundary(value, started)); };
    const rowScenario = (row: RateRow) => {
      const product = view.getProduct(row.product_key);
      if (product && !seen.has(product.productId)) {
        seen.add(product.productId);
        for (const value of view.getProgrammes(product.productId)) programme(value);
      }
      return rowScenarioRef.current(row);
    };
    return { rowScenario, asOf: (value: PublicProgramme) => { seen.add(value.productId); programme(value); return asOf; }, until: () => until };
  }, []);
  const buildCandidatesSync = useCallback((value: typeof request, view: PublicCatalogueView, scenario: RateScenario, asOf: (programme: PublicProgramme) => string): RateRow[] => value.providedCandidates
    ? [...value.providedCandidates]
    : publicRecommendationRows(value.sourceRows, view, value.section, scenario, false, asOf), []);
  const synchronous = useMemo(() => {
    // Explicit empty candidates (Mortgage criteria gate) must stay sync-empty
    // without expanding publicCatalogueOfferRows on the render path.
    if (request.providedCandidates && request.providedCandidates.length === 0) {
      clock.current.until = Infinity;
      return {
        candidates: [] as RateRow[],
        resolution: { ...EMPTY_RESOLUTION, complete: catalogueRef.current.status === 'ready' && catalogueRef.current.allLoaded },
        mortgage: EMPTY_MORTGAGE,
      };
    }
    const view = catalogueRef.current;
    const inputCount = request.providedCandidates?.length ?? request.sourceRows.length;
    // publicRecommendationRows walks the whole programme book. A short core
    // section must not do that walk inside render; cooperative pricing yields.
    const expandsCatalogue = request.providedCandidates == null
      && view.status === 'ready'
      && (view.products.length > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT
        || view.products.reduce((count, product) => count + product.programmeIds.length, 0) > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT);
    if (expandsCatalogue || inputCount > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const validity = collectValidity(view);
    const candidates = buildCandidatesSync(request, view, sectionScenarioRef.current, validity.asOf);
    if (candidates.length > SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT) return null;
    const resolution = resolvedPublicRankingRows(candidates, view, validity.rowScenario);
    const mortgage = request.applyMortgageScope && request.mortgageInputs
      ? mortgageComparisonRows(resolution.rows, request.mortgageInputs, request.mortgageContext)
      : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
    if (Date.now() >= validity.until()) return null;
    clock.current.until = validity.until();
    return { candidates, resolution, mortgage };
  }, [request, collectValidity, buildCandidatesSync]);
  useEffect(() => {
    if (!focused) preparedWhileFocused.current = false;
    else if (synchronous || current) preparedWhileFocused.current = true;
  }, [focused, synchronous, current]);
  useEffect(() => {
    if (!focused) {
      flightRef.current += 1;
      return;
    }
    if (synchronous || current) return;
    const stats = workerStats.current;
    const flight = ++flightRef.current;
    let cancelled = false;
    let finished = false;
    const run = () => {
      stats.starts++;
      void (async () => {
        // Keep one pass alive across scope/catalogue updates. Cancelling on
        // every request identity change starved mortgage.scope.apply so
        // search.data never left pending.
        while (!cancelled && flightRef.current === flight) {
          const req = requestRef.current;
          try {
          setProgress({ request: req, attempt, stage: 'candidates' });
          const control = {
            cancelled: () => cancelled || flightRef.current !== flight || requestRef.current !== req,
          };
          await yieldToUi(0);
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { stats.restarts++; continue; }
          const view = catalogueRef.current;
          const validity = collectValidity(view);
          const resolve = resolverIndexRef.current.resolve;
          const candidates = req.providedCandidates
            ? [...req.providedCandidates]
            : await publicRecommendationRowsCooperatively(
              req.sourceRows, view, req.section, sectionScenarioRef.current, control, false, validity.asOf, resolve);
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { stats.restarts++; continue; }
          if (!candidates) return;
          setProgress({ request: req, attempt, stage: 'resolution' });
          const resolution = await resolvedPublicRankingRowsCooperatively(
            candidates, view, validity.rowScenario, control, resolve);
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { stats.restarts++; continue; }
          if (!resolution) return;
          setProgress({ request: req, attempt, stage: 'scope' });
          const mortgage = req.applyMortgageScope && req.mortgageInputs
            ? await mortgageComparisonRowsCooperatively(
              resolution.rows, req.mortgageInputs, req.mortgageContext, control)
            : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { stats.restarts++; continue; }
          if (!mortgage) return;
          if (Date.now() >= validity.until()) { stats.restarts++; continue; }
          clock.current.until = validity.until();
          finished = true;
          const value = { request: req, attempt, candidates, resolution, mortgage, error: null };
          const key = JSON.stringify([req.section, req.sectionScenarioKey, req.mortgageInputs,
            req.applyMortgageScope, req.revision, req.clockRevision, req.resolutionContextKey, attempt]);
          if (req.resolutionContextKey !== undefined) {
            completed.current = completed.current.filter(item => item.key !== key);
            if (completed.current.length >= 4) completed.current.shift();
            completed.current.push({ key, request: req, catalogue: view, from: Date.now(), until: validity.until(), snapshot: value });
          }
          setSnapshot(value);
          return;
          } catch (error) {
            if (cancelled || flightRef.current !== flight) return;
            if (requestRef.current !== req) { stats.restarts++; continue; }
            finished = true;
            setSnapshot({ request: req, attempt, candidates: [], resolution: EMPTY_RESOLUTION,
              mortgage: EMPTY_MORTGAGE, error: error instanceof Error ? error.message : 'Public pricing failed' });
            return;
          }
        }
      })();
    };
    // Cold tab entry keeps a short paint deferral; mortgage.scope.apply on an
    // already-focused Rates surface must not pay that again.
    const cancelNavigation = preparedWhileFocused.current || interactive
      ? scheduleAfterInteractions(run)
      : scheduleAfterNavigation(run, 100);
    return () => { if (!finished) stats.cancellations++; cancelled = true; cancelNavigation(); };
  }, [synchronous, focused, interactive, attempt, current, clockRevision, collectValidity]);
  const ready = synchronous != null || current && snapshot!.error === null;
  useEffect(() => {
    if (!prepareMortgageIndex || catalogue.status !== 'ready' || !catalogue.allLoaded) return;
    let cancelled = false;
    const cancel = scheduleAfterInteractions(() => {
      void resolverIndex.prepareMortgage(catalogue, () => cancelled).catch(() => undefined);
    });
    return () => { cancelled = true; cancel(); };
  }, [prepareMortgageIndex, catalogue, resolverIndex]);
  const nextBoundary = clock.current.until;
  useEffect(() => {
    if (!focused || !Number.isFinite(nextBoundary)) return;
    const timer = setTimeout(() => wakeClock(value => value + 1), Math.max(1, nextBoundary - Date.now()));
    (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
    return () => clearTimeout(timer);
  }, [focused, nextBoundary, clockRevision]);
  const work: AuditWorkDiagnostic = {
    pricingStage: ready ? 'ready' : current && snapshot!.error ? 'error' : progress?.request === request && progress.attempt === attempt ? progress.stage : 'queued',
    ...(current && snapshot!.error && progress?.request === request && progress.attempt === attempt ? { pricingErrorStage: progress.stage } : {}),
    pricingIndexHits: resolverIndex.stats.hits, pricingIndexMisses: resolverIndex.stats.misses,
    pricingIndexPrepared: resolverIndex.stats.warmed, pricingSnapshotReused: cached != null && storedSnapshot?.request !== request,
    pricingRequestRevision: requestVersion.current.version, workerStarts: workerStats.current.starts,
    workerRestarts: workerStats.current.restarts, workerCancellations: workerStats.current.cancellations,
    sourceRowCount: sourceRows.length,
    candidateCount: ready ? (synchronous?.candidates ?? snapshot!.candidates).length : null,
    pricedRowCount: ready ? (synchronous?.resolution ?? snapshot!.resolution).priced : null,
    catalogueProductCount: catalogue.products.length,
    catalogueProgrammeCount: Number(catalogueKey.slice(catalogueKey.lastIndexOf(':') + 1)),
    catalogueAllLoaded: catalogue.allLoaded, catalogueStatus: catalogue.status,
  };
  return {
    work,
    candidates: synchronous?.candidates ?? (current ? snapshot!.candidates : []),
    resolution: synchronous?.resolution ?? (current ? snapshot!.resolution : EMPTY_RESOLUTION),
    mortgageScope: synchronous?.mortgage ?? (current ? snapshot!.mortgage : EMPTY_MORTGAGE),
    ready,
    error: current ? snapshot!.error : null,
    retry: () => setAttempt(value => value + 1),
  };
}
