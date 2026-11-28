import { createPublicRateResolverIndex } from '../data/publicRateResolverIndex';
import { bootCount } from '../lib/bootCounters';
import type { AuditWorkDiagnostic } from '../lib/performanceAuditWorkDiagnostic';
import { createPricingWorkTiming } from '../lib/pricingWorkTiming';
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
import { leadingSortedRowsInInputOrder, type MortgageRateMetric, type RankMetric, type SortKey } from '../data/selectors';
import type { RateRow, SectionKey } from '../types';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';
import { getSuitabilityRevision } from '../data/suitabilityGate';

/** Pricing is heavier than filter/sort; keep the sync path for tiny fixtures only. */
export const SYNCHRONOUS_PUBLIC_PRICING_ROW_LIMIT = 48;

/** Rank-ordered prefix whose scope is verified before the full pass finishes. */
export interface LeadingScopeRequest {
  /** Rows to scope ahead of the full pass; the caller keeps its page inside this prefix. */
  limit: number;
  sortKey: SortKey;
  metric: RankMetric;
  mortgageMetric: MortgageRateMetric;
}
export const leadingScopeKey = (value: LeadingScopeRequest | null | undefined) => value
  ? JSON.stringify([value.limit, value.sortKey, value.metric, value.mortgageMetric]) : '';

const EMPTY_RESOLUTION: PublicRankingResolution = {
  rows: [], priced: 0, unresolved: 0, complete: false,
};

const EMPTY_MORTGAGE = {
  rows: [] as RateRow[],
  unverified: 0,
  unverifiedRows: new WeakSet<RateRow>(),
  invalid: false,
};

type PreparedPricing = {
  candidates: RateRow[]; resolution: PublicRankingResolution; mortgage: typeof EMPTY_MORTGAGE;
};
const REUSABLE_ROW_SLOT_LIMIT = 50_000;
const reusable: { key: readonly unknown[]; from: number; until: number; value: PreparedPricing; retainedArrays: readonly (readonly RateRow[])[] }[] = [];
const sameKey = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
export function clearReusablePublicPricing() { reusable.length = 0; }
function reusablePricing(key: readonly unknown[], now: number) {
  // Once time has left a retained quote's validity window, never revive that
  // entry after a later clock correction.
  for (let i = reusable.length - 1; i >= 0; i--) {
    if (now < reusable[i].from || now >= reusable[i].until) reusable.splice(i, 1);
  }
  return reusable.find(item => sameKey(item.key, key));
}
function retainedRowArrays(source: readonly RateRow[], provided: readonly RateRow[] | null,
  context: RateConditionContext | undefined, value: PreparedPricing) {
  const arrays = new Set<readonly RateRow[]>([source, value.candidates, value.resolution.rows, value.mortgage.rows]);
  if (provided) arrays.add(provided);
  // The key retains the whole source owner, not just this section. Account for
  // all its section arrays so a small output cannot pin an oversized core.
  for (const core of [context?.core, context?.coreIntegrity?.core]) {
    if (core) for (const section of Object.values(core.sections)) arrays.add(section.rates);
  }
  return [...arrays];
}
function retainedRowSlots(entries: readonly { retainedArrays: readonly (readonly RateRow[])[] }[]) {
  // Requests from the same publication share their source owners. Charge each
  // array once across the cache, but retain every distinct output array.
  const arrays = new Set(entries.flatMap(entry => entry.retainedArrays));
  return [...arrays].reduce((sum, rows) => sum + rows.length, 0);
}

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
  /** Scope this rank-ordered prefix first and publish it as `leadingScope`. */
  leadingScope?: LeadingScopeRequest | null;
  /** Complete caller-owned semantics of rowScenario, beyond the section scenario. */
  resolutionContextKey?: string;
}) {
  const {
    sourceRows = EMPTY_RESOLUTION.rows, candidates: providedCandidates = null, catalogue, section, sectionScenario, rowScenario,
    mortgageInputs, mortgageContext, applyMortgageScope = false, focused, interactive = false, revision, prepareMortgageIndex = false, resolutionContextKey,
    leadingScope = null,
  } = options;
  const leadingRef = useRef(leadingScope);
  leadingRef.current = leadingScope;
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
  const [resolverIndex] = useState(createPublicRateResolverIndex);
  const resolverIndexRef = useRef(resolverIndex);
  resolverIndexRef.current = resolverIndex;
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const rowScenarioRef = useRef(rowScenario);
  rowScenarioRef.current = rowScenario;
  const sectionScenarioRef = useRef(sectionScenario);
  sectionScenarioRef.current = sectionScenario;
  const sectionScenarioKey = useMemo(() => JSON.stringify(sectionScenario), [sectionScenario]);
  const mandatoryRevision = getMandatoryEligibilityRevision(), suitabilityGateRevision = getSuitabilityRevision();
  const request = useMemo(() => ({
    sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey,
    mortgageInputs, mortgageContext, applyMortgageScope, revision, clockRevision, resolutionContextKey, mandatoryRevision, suitabilityGateRevision,
  }), [sourceRows, providedCandidates, catalogueKey, section, sectionScenarioKey, mortgageInputs, mortgageContext, applyMortgageScope, revision, clockRevision, resolutionContextKey, mandatoryRevision, suitabilityGateRevision]);
  // The context wrapper and callbacks are recreated by a remounted screen.
  // Bind reuse to their immutable inputs and the caller's complete callback
  // semantics instead, so Savings/TD can return without repricing the book.
  const reuseKey = [sourceRows, providedCandidates, catalogue, catalogueKey, section, sectionScenarioKey,
    JSON.stringify(mortgageInputs), mortgageContext?.core, mortgageContext?.details, mortgageContext?.manifest,
    mortgageContext?.coreIntegrity, applyMortgageScope, revision, mandatoryRevision, suitabilityGateRevision, resolutionContextKey] as const;
  const reusableRef = useRef(reuseKey); reusableRef.current = reuseKey;
  const [attempt, setAttempt] = useState(0);
  const requestVersion = useRef({ request, attempt, version: 1 });
  if (requestVersion.current.request !== request || requestVersion.current.attempt !== attempt) requestVersion.current = { request, attempt, version: requestVersion.current.version + 1 };
  const workerStats = useRef({ starts: 0, restarts: 0, cancellations: 0 });
  const timingRef = useRef<{ request: typeof request; attempt: number; timing: ReturnType<typeof createPricingWorkTiming> } | null>(null);
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
  const [leadingSnapshot, setLeadingSnapshot] = useState<{ request: typeof request; attempt: number; key: string;
    until: number; scope: typeof EMPTY_MORTGAGE } | null>(null);
  const completed = useRef<{ key: string; request: typeof request; catalogue: PublicCatalogueView;
    from: number; until: number; snapshot: Snapshot }[]>([]);
  const requestKey = JSON.stringify([request.section, request.sectionScenarioKey, request.mortgageInputs,
    request.applyMortgageScope, request.revision, request.clockRevision, request.resolutionContextKey, attempt]);
  const cached = resolutionContextKey === undefined ? undefined : completed.current.find(item => item.key === requestKey && item.catalogue === catalogue &&
    item.request.sourceRows === request.sourceRows && item.request.providedCandidates === request.providedCandidates &&
    item.request.mandatoryRevision === mandatoryRevision && item.request.suitabilityGateRevision === suitabilityGateRevision &&
    item.request.mortgageContext === request.mortgageContext && observedAt >= item.from && observedAt < item.until);
  const retained = resolutionContextKey !== undefined && attempt === 0 ? reusablePricing(reuseKey, observedAt) : undefined;
  const snapshot = storedSnapshot?.request === request && storedSnapshot.attempt === attempt ? storedSnapshot
    : cached ? { ...cached.snapshot, request, attempt }
      : retained ? { ...retained.value, request, attempt, error: null } : storedSnapshot;
  const current = snapshot?.request === request && snapshot.attempt === attempt;
  if (cached) clock.current.until = cached.until;
  else if (retained) clock.current.until = retained.until;
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
    return { rowScenario, from: started, asOf: (value: PublicProgramme) => { programme(value); return asOf; }, until: () => until };
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
    // A missing public catalogue leaves every published row unchanged. Avoid
    // copying the section twice or queueing a pricing job before list filtering.
    if (view.status === 'unavailable' && request.section !== 'Mortgage' && request.providedCandidates == null && !request.applyMortgageScope) {
      const rows = request.sourceRows as RateRow[];
      clock.current.until = Infinity;
      return { candidates: rows, resolution: { rows, priced: rows.length, unresolved: 0, complete: false },
        mortgage: { ...EMPTY_MORTGAGE, rows } };
    }
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
    const restart = () => { stats.restarts++; bootCount('pricing-restarts'); };
    const flight = ++flightRef.current;
    let cancelled = false;
    let finished = false;
    const run = () => {
      stats.starts++;
      bootCount('pricing-starts');
      void (async () => {
        // Keep one pass alive across scope/catalogue updates. Cancelling on
        // every request identity change starved mortgage.scope.apply so
        // search.data never left pending.
        while (!cancelled && flightRef.current === flight) {
          const req = requestRef.current;
          const retainedKey = reusableRef.current;
          const timing = createPricingWorkTiming();
          timingRef.current = { request: req, attempt, timing };
          try {
          setProgress({ request: req, attempt, stage: 'candidates' });
          const control = {
            yieldControl: timing.yieldControl,
            cancelled: () => cancelled || flightRef.current !== flight || requestRef.current !== req ||
              getMandatoryEligibilityRevision() !== req.mandatoryRevision || getSuitabilityRevision() !== req.suitabilityGateRevision,
          };
          await yieldToUi(0);
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { restart(); continue; }
          const view = catalogueRef.current;
          const validity = collectValidity(view);
          const resolve = resolverIndexRef.current.resolveForPublication(view);
          // Without a catalogue the published source is already the candidate
          // and ranking book. Borrow its immutable array just as the synchronous
          // deposit path does. Copying it twice retained 49,736 redundant row
          // slots for the audit's mortgage book, preventing bounded warm reuse.
          const publishedOnly = view.status === 'unavailable' && req.providedCandidates == null;
          const candidates = await timing.measure('candidatePreparationMs', async () => publishedOnly ? req.sourceRows as RateRow[] : req.providedCandidates
            ? [...req.providedCandidates]
            : await publicRecommendationRowsCooperatively(
              req.sourceRows, view, req.section, sectionScenarioRef.current, control, false, validity.asOf, resolve));
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { restart(); continue; }
          if (!candidates) return;
          setProgress({ request: req, attempt, stage: 'resolution' });
          const resolution = await timing.measure('pricingResolutionMs', async () => publishedOnly
            ? { rows: candidates, priced: candidates.length, unresolved: 0, complete: false }
            : await resolvedPublicRankingRowsCooperatively(
              candidates, view, validity.rowScenario, control, resolve));
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { restart(); continue; }
          if (!resolution) return;
          const leading = leadingRef.current;
          if (leading && req.applyMortgageScope && req.mortgageInputs && resolution.rows.length > leading.limit) {
            // Scope only the rows that can lead the ranked list. Row matching is
            // independent per row, so the first admitted rows here are exactly
            // the first admitted rows of the full pass.
            const prefix = leadingSortedRowsInInputOrder(resolution.rows, leading.limit, leading.sortKey, req.section,
              leading.metric, leading.mortgageMetric);
            const early = await timing.measure('mortgageScopeMs', () =>
              mortgageComparisonRowsCooperatively(prefix, req.mortgageInputs!, req.mortgageContext, { ...control, tierRows: resolution.rows }));
            if (cancelled || flightRef.current !== flight) return;
            if (requestRef.current !== req) { restart(); continue; }
            if (Date.now() >= validity.until()) { restart(); setLeadingSnapshot(null); continue; }
            if (early && !control.cancelled() && !early.invalid) {
              // Arm the wake-up now so an expiring prefix withdraws on time, not when the full pass ends.
              clock.current.until = Math.min(clock.current.until, validity.until());
              setLeadingSnapshot({ request: req, attempt, key: leadingScopeKey(leading), until: validity.until(), scope: early });
            }
          }
          setProgress({ request: req, attempt, stage: 'scope' });
          const mortgage = await timing.measure('mortgageScopeMs', async () => req.applyMortgageScope && req.mortgageInputs
            ? await mortgageComparisonRowsCooperatively(
              resolution.rows, req.mortgageInputs, req.mortgageContext, control)
            : { rows: resolution.rows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false });
          if (cancelled || flightRef.current !== flight) return;
          if (requestRef.current !== req) { restart(); continue; }
          if (!mortgage || control.cancelled()) return;
          if (Date.now() >= validity.until()) { restart(); setLeadingSnapshot(null); continue; }
          clock.current.until = validity.until();
          finished = true;
          const value = { request: req, attempt, candidates, resolution, mortgage, error: null };
          const key = JSON.stringify([req.section, req.sectionScenarioKey, req.mortgageInputs,
            req.applyMortgageScope, req.revision, req.clockRevision, req.resolutionContextKey, attempt]);
          if (req.resolutionContextKey !== undefined) {
            completed.current = completed.current.filter(item => item.key !== key);
            if (completed.current.length >= 4) completed.current.shift();
            completed.current.push({ key, request: req, catalogue: view, from: Date.now(), until: validity.until(), snapshot: value });
            const previous = reusable.findIndex(item => sameKey(item.key, retainedKey));
            if (previous >= 0) reusable.splice(previous, 1);
            const retainedArrays = retainedRowArrays(req.sourceRows, req.providedCandidates, req.mortgageContext, value);
            if (retainedRowSlots([{ retainedArrays }]) <= REUSABLE_ROW_SLOT_LIMIT) {
              // Keep only the pricing value here; the mounted snapshot owns
              // request bookkeeping. Source arrays shared across requests count
              // once, so section changes do not evict each other needlessly.
              reusable.push({ key: retainedKey, from: validity.from, until: validity.until(),
                value: { candidates, resolution, mortgage }, retainedArrays });
              while (reusable.length > 6 || retainedRowSlots(reusable) > REUSABLE_ROW_SLOT_LIMIT) reusable.shift();
            }
          }
          setSnapshot(value);
          return;
          } catch (error) {
            if (cancelled || flightRef.current !== flight) return;
            if (requestRef.current !== req) { restart(); continue; }
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
    // Admission gates can advance before their React subscriber commits. The
    // worker then cancels against the live gate without seeing a new request;
    // explicitly restart on that later render instead of leaving it pending.
  }, [synchronous, focused, interactive, attempt, current, clockRevision, collectValidity, mandatoryRevision, suitabilityGateRevision]);
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
    ...(timingRef.current?.request === request && timingRef.current.attempt === attempt ? timingRef.current.timing.snapshot() : {}),
    pricingStage: ready ? 'ready' : current && snapshot!.error ? 'error' : progress?.request === request && progress.attempt === attempt ? progress.stage : 'queued',
    ...(current && snapshot!.error && progress?.request === request && progress.attempt === attempt ? { pricingErrorStage: progress.stage } : {}),
    pricingIndexHits: resolverIndex.stats.hits, pricingIndexMisses: resolverIndex.stats.misses,
    pricingIndexPrepared: resolverIndex.stats.warmed, pricingSnapshotReused: (cached != null || retained != null) && storedSnapshot?.request !== request,
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
    /** Verified prefix of the ranked scope. It outlives the full pass so the caller can keep
     * showing it until its own result preparation lands; it never outlives its pricing validity. */
    leadingScope: leadingSnapshot?.request === request && leadingSnapshot.attempt === attempt
      && leadingSnapshot.key === leadingScopeKey(leadingScope) && observedAt < leadingSnapshot.until ? leadingSnapshot.scope : null,
    ready,
    error: current ? snapshot!.error : null,
    retry: () => setAttempt(value => value + 1),
  };
}
