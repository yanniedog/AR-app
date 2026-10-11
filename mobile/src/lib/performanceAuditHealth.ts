import type { AppState } from '../data/storeTypes';
import { samePayloadIdentity } from '../data/payloadRevision';
import type { AuditCheck, AuditJourney } from './performanceAudit';
import type { DeepPerformanceAuditPlan } from './performanceAuditPlan';
import {
  APP_HEALTH_EXPECTED_CHECK_IDS,
  evaluateAppHealthDisplayQuality,
  finalizeAppHealthReport,
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
import { appHealthDataSnapshot } from './performanceAuditDataSnapshot';
import { passiveAuditDataChecks } from './passiveAudit';
import { appHealthCatalogueSnapshot } from './performanceAuditCatalogueSnapshot';
export { appHealthDataSnapshot } from './performanceAuditDataSnapshot';

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
    // Virtualized lists may render only part of a non-empty model. This matches
    // the display evaluator: zero rows or more rows than the model is a failure.
    case 'list': return evidence.renderedCount <= evidence.modelCount &&
      (evidence.modelCount === 0 || evidence.renderedCount > 0) ? 1 : 0;
    case 'visible': return evidence.visibleCount >= evidence.expectedMinimum ? 1 : 0;
  }
}

/** Convert independently registered screen probes into display-quality evidence. */
export function appHealthDisplayObservations(
  checks: readonly AuditCheck[],
): AppHealthSurfaceObservation[] {
  const bySurface = new Map<string, Map<AppHealthDisplayRole, AppHealthDisplayEvidence>>();
  const listFailuresBySurface = new Map<string, NonNullable<AppHealthSurfaceObservation['listFailureEvidence']>>();
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
      if (probe.kind === 'list') {
        // Counts, visible rows and the empty-state belong to the same rendered
        // list. Combining a populated visit with an empty visit invents a
        // contradiction that never appeared on screen. Retain real failures.
        const bundle = evidenceFor(probe);
        const failures = listFailuresBySurface.get(probe.surfaceId) ?? {};
        for (const evidence of bundle) {
          if ((evidence.role === 'list' || evidence.role === 'visible' || evidence.role === 'empty-state') &&
              observedEvidenceQuality(evidence) === 0 && !failures[evidence.role]) {
            // At most three coherent bundles per surface; a later, different
            // failure cannot erase an earlier failure of another list role.
            failures[evidence.role] = bundle;
          }
        }
        if (Object.keys(failures).length) listFailuresBySurface.set(probe.surfaceId, failures);
        const previous = (['list', 'visible', 'empty-state'] as const)
          .map(role => roles.get(role)).filter((entry): entry is AppHealthDisplayEvidence => entry != null);
        const failed = bundle.some(entry => observedEvidenceQuality(entry) === 0);
        const priorFailed = previous.some(entry => observedEvidenceQuality(entry) === 0);
        const prior = roles.get('list');
        if (!prior || (failed && !priorFailed) || (failed === priorFailed &&
            observedEvidenceCount(bundle[0]) >= observedEvidenceCount(prior))) {
          for (const role of ['list', 'visible', 'empty-state'] as const) roles.delete(role);
          for (const evidence of bundle) roles.set(evidence.role, evidence);
        }
        bySurface.set(probe.surfaceId, roles);
        continue;
      }
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
    ...(listFailuresBySurface.has(surfaceId)
      ? { listFailureEvidence: listFailuresBySurface.get(surfaceId)! } : {}),
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
  let data = input.dataSnapshot;
  if (data) {
    const { core, coreIntegrity, manifest } = input.state;
    // Live-source validation owns its independent payload. App selector evidence
    // can accompany it only when both describe the same verified publication.
    const matchesLocal = Boolean(core && coreIntegrity?.core === core && manifest && data.core && data.manifest &&
      coreIntegrity.coreSha256 === manifest.files.core.sha256 && coreIntegrity.runDate === core.run_date &&
      core.run_date === manifest.run_date && data.core.run_date === core.run_date &&
      data.manifest.run_date === core.run_date && data.manifest.files.core.sha256 === manifest.files.core.sha256 &&
      samePayloadIdentity(manifest, data.manifest));
    data = { ...data, catalogue: matchesLocal ? appHealthCatalogueSnapshot(input.state) : null };
  }
  const prepared = passiveAuditDataChecks(data ?? appHealthDataSnapshot(input.state, input.appVersion));
  const dataChecks = prepared.checks;
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
      `${prepared.reused} data checks reused matching passive evidence; freshness and display observations are checked during this run.`,
      'Display checks use screen probes captured during this run; a physical-device review is still required for visual polish and assistive technology.',
      input.mode === 'local'
        ? 'Local mode performs no network transport.'
        : 'Live-source mode also checks exact approved external destinations with bounded HEAD requests; blocked sites and timeouts remain unverified.',
    ],
  });
}
