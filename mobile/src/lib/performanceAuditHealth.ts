import type { AppState } from '../data/storeTypes';
import type { AuditCheck, AuditJourney } from './performanceAudit';
import type { DeepPerformanceAuditPlan } from './performanceAuditPlan';
import {
  APP_HEALTH_EXPECTED_CHECK_IDS,
  CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
  evaluateAppHealthDataQuality,
  evaluateAppHealthDisplayQuality,
  finalizeAppHealthReport,
  type AppHealthAssetObservation,
  type AppHealthAssetKey,
  type AppHealthAuditMode,
  type AppHealthCheck,
  type AppHealthDataSnapshot,
  type AppHealthDisplayEvidence,
  type AppHealthDisplayRole,
  type AppHealthNetworkSnapshot,
  type AppHealthReport,
  type AppHealthSurfaceContract,
  type AppHealthSurfaceObservation,
} from './appHealth';
import { appHealthNetworkCheck } from './appHealth/networkPolicy';

function countRecord(value: unknown): number | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).length
    : null;
}

function asset(
  ready: boolean,
  failed: boolean,
  runDate?: string | null,
  itemCount?: number | null,
): AppHealthAssetObservation {
  return {
    state: ready ? 'ready' : failed ? 'failed' : 'not-requested',
    runDate: runDate ?? null,
    itemCount: itemCount ?? null,
  };
}

/** Snapshot the exact in-memory revision already pinned by the audit. No I/O. */
export function appHealthDataSnapshot(
  state: AppState,
  appVersion: string,
): AppHealthDataSnapshot {
  const coreKeys = new Set(
    Object.values(state.core?.sections ?? {})
      .flatMap((section) => section.rates)
      .map((row) => row.product_key),
  );
  const detailKeys = Object.keys(state.details?.products ?? {});
  const assets: Partial<Record<AppHealthAssetKey, AppHealthAssetObservation>> = {
    core: {
      state: state.core ? 'ready' : state.coreAssetState.status === 'error' ? 'failed' : 'missing',
      runDate: state.core?.run_date ?? null,
      itemCount: coreKeys.size,
    },
    details: asset(
      Boolean(state.details),
      false,
      state.details?.run_date,
      detailKeys.length,
    ),
    search_index: asset(
      Boolean(state.searchIndex),
      state.searchIndexStatus === 'error',
      state.searchIndex?.run_date,
      countRecord(state.searchIndex?.products),
    ),
    history_banks: asset(
      Boolean(state.historyBanks),
      Boolean(state.historyBanksError),
      state.historyBanks?.run_date,
      state.historyBanks?.run_dates.length,
    ),
    bank_history: asset(
      Boolean(state.bankInsights),
      Boolean(state.bankInsightsError),
      state.bankInsights?.run_date,
      countRecord(state.bankInsights?.banks),
    ),
    bank_spread_history: asset(
      Boolean(state.bankSpreadHistory),
      Boolean(state.bankSpreadHistoryError),
      state.bankSpreadHistory?.run_date,
      countRecord(state.bankSpreadHistory?.banks),
    ),
    rba_calendar: asset(
      Boolean(state.rbaCalendar),
      Boolean(state.rbaCalendarError),
      state.core?.run_date,
      state.rbaCalendar
        ? state.rbaCalendar.decisions.length + state.rbaCalendar.schedule.length
        : null,
    ),
  };
  return {
    source: state.source,
    core: state.core,
    manifest: state.manifest,
    appVersion,
    details: state.details
      ? {
          runDate: state.details.run_date,
          productCount: detailKeys.length,
          matchedProductCount: detailKeys.filter((key) => coreKeys.has(key)).length,
          orphanProductCount: detailKeys.filter((key) => !coreKeys.has(key)).length,
        }
      : null,
    assets,
    quarantine: state.coreIntegrity
      ? {
          rowsByReason: state.coreIntegrity.quarantines.rowsByReason,
          bankHistoryPairs: state.coreIntegrity.quarantines.bankHistoryPairs.size,
          countImpacts: state.coreIntegrity.quarantines.countImpacts,
        }
      : null,
  };
}

interface ParsedProbe {
  surfaceId: string;
  probeId: string;
  required: boolean;
  kind: 'data' | 'list' | 'logo' | 'graphic' | 'layout';
  ready: boolean;
  actual: number | null;
  expected: number | null;
  fallbackCount: number | null;
  visibleCount: number | null;
  emptyStateRendered: boolean | null;
  layoutMeasured: boolean | null;
  accessibleSummary: boolean | null;
}

function parseProbe(line: string): ParsedProbe | null {
  const parts = line.split(':');
  if (parts.length < 5) return null;
  const [surfaceId, probeId, kind, status, counts] = parts;
  if (!['data', 'list', 'logo', 'graphic', 'layout'].includes(kind)) return null;
  const match = /^(\d+)\/(\d+)$/.exec(counts);
  const fallback = parts
    .map((part) => /^fallback=(\d+)$/.exec(part)?.[1] ?? null)
    .find((value): value is string => value != null);
  const visible = parts
    .map((part) => /^visible=(\d+)$/.exec(part)?.[1] ?? null)
    .find((value): value is string => value != null);
  const empty = parts
    .map((part) => /^empty=([01])$/.exec(part)?.[1] ?? null)
    .find((value): value is string => value != null);
  const measured = parts
    .map((part) => /^measured=([01])$/.exec(part)?.[1] ?? null)
    .find((value): value is string => value != null);
  const summary = parts
    .map((part) => /^summary=([01])$/.exec(part)?.[1] ?? null)
    .find((value): value is string => value != null);
  return {
    surfaceId,
    probeId,
    required: !parts.includes('required=0'),
    kind: kind as ParsedProbe['kind'],
    ready: status === 'ready',
    actual: match ? Number(match[1]) : null,
    expected: match ? Number(match[2]) : null,
    fallbackCount: fallback == null ? null : Number(fallback),
    visibleCount: visible == null ? null : Number(visible),
    emptyStateRendered: empty == null ? null : empty === '1',
    layoutMeasured: measured == null ? null : measured === '1',
    accessibleSummary: summary == null ? null : summary === '1',
  };
}

function evidenceFor(probe: ParsedProbe): AppHealthDisplayEvidence[] {
  const expected = probe.expected ?? (probe.ready ? 1 : 0);
  const actual = probe.actual ?? (probe.ready ? expected : 0);
  if (probe.kind === 'data') {
    return [{ role: 'model', sourceCount: expected, modelCount: actual }];
  }
  if (probe.kind === 'list') {
    return [
      { role: 'list' as const, modelCount: expected, renderedCount: actual },
      ...(probe.visibleCount == null ? [] : [{
        role: 'visible' as const,
        expectedMinimum: expected > 0 ? 1 : 0,
        visibleCount: probe.visibleCount,
      }]),
      ...(probe.emptyStateRendered == null ? [] : [{
        role: 'empty-state' as const,
        expected: expected === 0,
        rendered: probe.emptyStateRendered,
      }]),
    ];
  }
  if (probe.kind === 'logo') {
    const fallbackCount = Math.min(actual, probe.fallbackCount ?? 0);
    return [{
      role: 'logo',
      expectedCount: expected,
      decodedCount: actual - fallbackCount,
      fallbackCount,
      missingCount: Math.max(0, expected - actual),
    }];
  }
  if (probe.kind === 'graphic') {
    return [{
      role: 'chart',
      modelPointCount: probe.expected ?? 0,
      renderedPointCount: probe.actual ?? 0,
      accessibleSummary: probe.accessibleSummary === true,
      layoutMeasured: probe.layoutMeasured === true,
      emptyStateRendered: probe.emptyStateRendered === true,
      unverifiedCount: !probe.ready || probe.actual == null || probe.expected == null ? 1 : 0,
    }];
  }
  return [{
    role: 'critical-layout',
    measured: probe.layoutMeasured === true,
    width: null,
    height: null,
  }];
}

function observedEvidenceCount(evidence: AppHealthDisplayEvidence): number {
  switch (evidence.role) {
    case 'model': return evidence.modelCount;
    case 'list': return evidence.renderedCount;
    case 'visible': return evidence.visibleCount;
    case 'empty-state': return evidence.rendered ? 1 : 0;
    case 'critical-layout': return evidence.measured ? 1 : 0;
    case 'chart': return evidence.renderedPointCount;
    case 'logo': return evidence.decodedCount + evidence.fallbackCount;
  }
}

function observedEvidenceQuality(evidence: AppHealthDisplayEvidence): number {
  switch (evidence.role) {
    case 'chart': return evidence.layoutMeasured &&
      ((evidence.modelPointCount > 0 && evidence.accessibleSummary) ||
       (evidence.modelPointCount === 0 && evidence.emptyStateRendered)) &&
      !evidence.unverifiedCount ? 1 : 0;
    case 'critical-layout': return evidence.measured ? 1 : 0;
    case 'empty-state': return evidence.rendered === evidence.expected ? 1 : 0;
    case 'logo': return evidence.decodedCount - evidence.fallbackCount - evidence.missingCount;
    case 'model': return evidence.modelCount === evidence.sourceCount ? 1 : 0;
    case 'list': return evidence.renderedCount === evidence.modelCount ? 1 : 0;
    case 'visible': return evidence.visibleCount >= evidence.expectedMinimum ? 1 : 0;
  }
}

/** Convert independently registered screen probes into display-quality evidence. */
export function appHealthDisplayObservations(
  checks: readonly AuditCheck[],
): AppHealthSurfaceObservation[] {
  const bySurface = new Map<string, Map<AppHealthDisplayRole, AppHealthDisplayEvidence>>();
  const chartsBySurface = new Map<string, Map<string, ParsedProbe>>();
  for (const check of checks) {
    const raw = check.metrics.readinessEvidence;
    if (typeof raw !== 'string') continue;
    const graphEvidence = typeof check.metrics.graphicEvidence === 'string'
      ? check.metrics.graphicEvidence : '';
    for (const line of `${raw} | ${graphEvidence}`.split(' | ')) {
      const probe = parseProbe(line);
      if (!probe) continue;
      if (probe.kind === 'graphic') {
        // A closed optional chart is not a graph the journey expected to show.
        if (!probe.required && probe.expected === 0 && probe.actual === 0 &&
            probe.emptyStateRendered !== true) continue;
        const charts = chartsBySurface.get(probe.surfaceId) ?? new Map<string, ParsedProbe>();
        const prior = charts.get(probe.probeId);
        const valid = (entry: ParsedProbe) => entry.ready && entry.actual != null &&
          entry.expected != null && entry.actual === entry.expected &&
          entry.layoutMeasured === true && (entry.expected > 0
            ? entry.accessibleSummary === true : entry.emptyStateRendered === true);
        // A later successful visit cannot erase a missing graph observed earlier.
        if (!prior || (valid(prior) && (!valid(probe) ||
            (prior.expected !== 0 && probe.expected === 0)))) charts.set(probe.probeId, probe);
        chartsBySurface.set(probe.surfaceId, charts);
        if (!bySurface.has(probe.surfaceId)) bySurface.set(probe.surfaceId, new Map());
        continue;
      }
      const roles = bySurface.get(probe.surfaceId) ?? new Map();
      for (const evidence of evidenceFor(probe)) {
        const prior = roles.get(evidence.role);
        // Repeated cold/warm probes keep the strongest independently observed
        // count. On a tie, retain the evidence with the stronger quality proof
        // (for example an accessible chart rather than a closed optional chart).
        const nextCount = observedEvidenceCount(evidence);
        const priorCount = prior == null ? -1 : observedEvidenceCount(prior);
        if (
          !prior ||
          nextCount > priorCount ||
          (nextCount === priorCount && observedEvidenceQuality(evidence) > observedEvidenceQuality(prior))
        ) {
          roles.set(evidence.role, evidence);
        }
      }
      bySurface.set(probe.surfaceId, roles);
    }
  }
  for (const [surfaceId, charts] of chartsBySurface) {
    const probes = [...charts.values()];
    bySurface.get(surfaceId)!.set('chart', {
      role: 'chart',
      modelPointCount: probes.reduce((sum, probe) => sum + (probe.expected ?? 0), 0),
      renderedPointCount: probes.reduce((sum, probe) => sum + (probe.actual ?? 0), 0),
      accessibleSummary: probes.every((probe) => probe.expected === 0 || probe.accessibleSummary === true),
      layoutMeasured: probes.every((probe) => probe.layoutMeasured === true),
      emptyStateRendered: probes.every((probe) => probe.expected !== 0 || probe.emptyStateRendered === true),
      unverifiedCount: probes.filter((probe) => !probe.ready || probe.actual == null ||
        probe.expected == null || probe.actual !== probe.expected).length,
      unavailableCount: probes.filter((probe) => probe.expected === 0 && probe.emptyStateRendered === true).length,
    });
  }
  return [...bySurface].map(([surfaceId, roles]) => ({
    surfaceId,
    evidence: [...roles.values()],
  }));
}

export function appHealthSurfaceContracts(
  journeys: readonly AuditJourney[],
  plan: DeepPerformanceAuditPlan,
): AppHealthSurfaceContract[] {
  const roles = new Map<string, Set<AppHealthDisplayRole>>();
  const independentListEvidenceSurfaces = new Set([
    'browse.hierarchy',
    'lenders.list',
    'search.results',
  ]);
  const include = (surface: string, requested: readonly string[] = []) => {
    const next = roles.get(surface) ?? new Set<AppHealthDisplayRole>();
    next.add('model');
    next.add('critical-layout');
    if (requested.includes('list')) {
      next.add('list');
      if (independentListEvidenceSurfaces.has(surface)) {
        next.add('visible');
        next.add('empty-state');
      }
    }
    if (requested.includes('logos')) next.add('logo');
    if (requested.includes('graphics')) next.add('chart');
    roles.set(surface, next);
  };
  for (const journey of journeys) include(journey.expectedSurface);
  for (const pass of plan.passes) {
    for (const step of pass.steps) include(step.expectedSurface, step.readiness);
  }
  return [...roles].map(([id, requiredRoles]) => ({
    id,
    requiredRoles: [...requiredRoles],
    allowsIntentionalEmpty: requiredRoles.has('empty-state'),
    chartRequired: requiredRoles.has('chart'),
    logosRequired: requiredRoles.has('logo'),
  }));
}

export function buildIntegratedAppHealthReport(input: {
  sessionId: string;
  mode: AppHealthAuditMode;
  startedAt: string;
  finishedAt: string;
  state: AppState;
  appVersion: string;
  performanceChecks: readonly AuditCheck[];
  journeys: readonly AuditJourney[];
  plan: DeepPerformanceAuditPlan;
  network: AppHealthNetworkSnapshot;
  /** Validated remote payload for explicit live-source mode; otherwise use pinned app state. */
  dataSnapshot?: AppHealthDataSnapshot;
}): AppHealthReport {
  const dataChecks = evaluateAppHealthDataQuality(
    input.dataSnapshot ?? appHealthDataSnapshot(input.state, input.appVersion),
    CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
  );
  const contracts = appHealthSurfaceContracts(input.journeys, input.plan);
  const displayChecks = evaluateAppHealthDisplayQuality(
    contracts,
    appHealthDisplayObservations(input.performanceChecks),
  );
  const checks: AppHealthCheck[] = [
    ...dataChecks,
    ...displayChecks,
    appHealthNetworkCheck(input.network),
  ];
  return finalizeAppHealthReport({
    sessionId: input.sessionId,
    mode: input.mode,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    checks,
    plannedCheckIds: APP_HEALTH_EXPECTED_CHECK_IDS,
    limitations: [
      'Display checks use screen probes captured during this run; a physical-device review is still required for visual polish and assistive technology.',
      input.mode === 'local'
        ? 'Local mode performs no network transport.'
        : 'Live-source mode also checks exact approved external destinations with bounded HEAD requests; blocked sites and timeouts remain unverified.',
    ],
  });
}
