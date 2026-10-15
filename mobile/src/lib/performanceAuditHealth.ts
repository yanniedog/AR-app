import type { AppState } from '../data/storeTypes';
import { samePayloadIdentity } from '../data/payloadRevision';
import { roundMetric, type AuditCheck, type AuditJourney, type PerformanceAuditSummary } from './performanceAudit';
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
import { preparedAppHealthCatalogueSnapshot } from './performanceAuditCatalogueSnapshot';
import { APP_HEALTH_DATA_CHECKS } from './appHealth/dataQuality';
import { PERFORMANCE_AUDIT_DEDICATED_CHECKS } from './performanceAuditCheckInventory';
export { appHealthDataSnapshot } from './performanceAuditDataSnapshot';

interface ParsedProbe {
  surfaceId: string;
  probeId: string;
  required: boolean;
  kind: 'data' | 'list' | 'logo' | 'graphic' | 'layout';
  ready: boolean;
  pending: boolean;
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
    pending: status === 'pending',
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
      // Preparing optional work is not completed model evidence. A contract
      // requiring that model still fails when its evidence is absent.
      if (probe.kind === 'data' && !probe.required && probe.pending) continue;
      if (probe.kind === 'graphic') {
        // Ordinary navigation may finish while an optional chart is preparing.
        // Its transient state is not a completed chart check. Explicit chart
        // actions serialize effective required=true and retain failures below.
        if (!probe.required && probe.pending) continue;
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
  dedicatedContext?: Pick<AppHealthRunInput, 'mode' | 'performanceChecks'>,
): AppHealthSurfaceContract[] {
  const roles = new Map<string, Set<AppHealthDisplayRole>>();
  const independentListEvidenceSurfaces = new Set([
    'browse.hierarchy',
    'lenders.list',
    'search.results',
  ]);
  const include = (surface: string, requested: readonly string[] = [], modelRequired = true) => {
    const next = roles.get(surface) ?? new Set<AppHealthDisplayRole>();
    if (modelRequired) next.add('model');
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
  if (dedicatedContext) {
    const recordedIds = new Set(dedicatedContext.performanceChecks.map(check => check.id));
    for (const owner of PERFORMANCE_AUDIT_DEDICATED_CHECKS) {
      if (recordedIds.has(owner.checkId)) {
        // Android Settings mounts this layout even when Local mode suppresses
        // metadata. Live requires the owner's actual result model as well.
        include(owner.expectedSurface, [], dedicatedContext.mode === owner.executionMode);
      }
    }
  }
  return [...roles].map(([id, requiredRoles]) => ({
    id,
    requiredRoles: [...requiredRoles],
    allowsIntentionalEmpty: requiredRoles.has('empty-state'),
    chartRequired: requiredRoles.has('chart'),
    logosRequired: requiredRoles.has('logo'),
  }));
}

interface AppHealthDataInput {
  state: AppState;
  appVersion: string;
  dataSnapshot?: AppHealthDataSnapshot;
}

function scopedHealthDataSnapshot(input: AppHealthDataInput): AppHealthDataSnapshot {
  let data = input.dataSnapshot;
  if (data) {
    const { core, coreIntegrity, manifest } = input.state;
    const matchesLocal = Boolean(core && coreIntegrity?.core === core && manifest && data.core && data.manifest &&
      coreIntegrity.coreSha256 === manifest.files.core.sha256 && coreIntegrity.runDate === core.run_date &&
      core.run_date === manifest.run_date && data.core.run_date === core.run_date &&
      data.manifest.run_date === core.run_date && data.manifest.files.core.sha256 === manifest.files.core.sha256 &&
      samePayloadIdentity(manifest, data.manifest));
    data = { ...data, catalogue: matchesLocal ? preparedAppHealthCatalogueSnapshot(input.state) : null };
  }
  return data ?? appHealthDataSnapshot(input.state, input.appVersion);
}

export interface CapturedAppHealthDataEvidence {
  readonly capturedAt: string;
  readonly checks: readonly AppHealthCheck[];
  readonly reused: number;
}

/** Resolve passive evidence before audit preference mutations; retain only the
 * detached check results, never mutable store/core references or a later scan. */
export function captureAppHealthDataEvidence(input: AppHealthDataInput): CapturedAppHealthDataEvidence {
  const prepared = passiveAuditDataChecks(scopedHealthDataSnapshot(input));
  return {
    capturedAt: new Date().toISOString(),
    checks: JSON.parse(JSON.stringify(prepared.checks)) as AppHealthCheck[],
    reused: prepared.reused,
  };
}

interface AppHealthRunInput {
  sessionId: string;
  mode: AppHealthAuditMode;
  startedAt: string;
  finishedAt: string;
  performanceChecks: readonly AuditCheck[];
  journeys: readonly AuditJourney[];
  plan: DeepPerformanceAuditPlan;
  network: AppHealthNetworkSnapshot;
}

export function buildIntegratedAppHealthReport(input: AppHealthRunInput & AppHealthDataInput): AppHealthReport {
  const prepared = passiveAuditDataChecks(scopedHealthDataSnapshot(input));
  const dataChecks = prepared.checks;
  const contracts = appHealthSurfaceContracts(input.journeys, input.plan, input);
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

/** Fatal reporting performs no data scan or I/O while an interrupted mutation
 * may still be running. Successful partial display observations cannot stand
 * in for the unvisited parts of the declared foreground plan. */
export function buildPartialAppHealthReport(input: AppHealthRunInput & {
  capturedData: CapturedAppHealthDataEvidence | null;
}): AppHealthReport {
  const observations = appHealthDisplayObservations(input.performanceChecks);
  const observedIds = new Set(observations.map(observation => observation.surfaceId));
  const contracts = appHealthSurfaceContracts(input.journeys, input.plan, input);
  const observedContracts = contracts.filter(contract => observedIds.has(contract.id));
  const displayChecks = evaluateAppHealthDisplayQuality(observedContracts, observations).map(check => ({
    ...check,
    status: check.status === 'fail' ? 'fail' as const : 'not-run' as const,
    metrics: { ...check.metrics, partial: true, observedStatus: check.status,
      plannedSurfaces: contracts.length, observedSurfaces: observedIds.size },
    summary: check.status === 'fail' ? check.summary : 'Foreground display coverage stopped before the complete plan ran.',
  }));
  const dataChecks: AppHealthCheck[] = input.capturedData
    ? input.capturedData.checks.map(check => ({ ...check, metrics: { ...check.metrics,
        evidenceCapturedAt: input.capturedData!.capturedAt, capturedBeforeAuditMutations: true } }))
    : APP_HEALTH_DATA_CHECKS.map(job => ({ id: job.code, code: job.code, label: job.code,
        domain: 'data-integrity', status: 'not-run', metrics: {},
        summary: 'The audit stopped before data evidence was captured.' }));
  return finalizeAppHealthReport({
    sessionId: input.sessionId, mode: input.mode, startedAt: input.startedAt, finishedAt: input.finishedAt,
    checks: [...dataChecks, ...displayChecks, appHealthNetworkCheck(input.network)],
    plannedCheckIds: APP_HEALTH_EXPECTED_CHECK_IDS,
    incompleteReason: 'The audit stopped before all planned foreground checks completed.',
    limitations: [
      input.capturedData
        ? `Data and catalogue evidence was captured at ${input.capturedData.capturedAt} before audit preference mutations (${input.capturedData.reused} matching passive checks reused); it does not describe unfinished changes at the time of failure.`
        : 'No validated data evidence was captured before the audit stopped.',
      'Observed display failures are retained; incomplete display groups are not counted as executed coverage.',
    ],
  });
}

/** The denominator remains the full declared plan even for a fatal partial report. */
export function combineAppHealthPerformanceSummary(performance: PerformanceAuditSummary,
  health: AppHealthReport, plannedPerformanceChecks: number): PerformanceAuditSummary {
  const executed = performance.executed + health.summary.pass + health.summary.warn + health.summary.fail;
  const total = plannedPerformanceChecks + health.summary.total;
  return {
    ...performance,
    pass: performance.pass + health.summary.pass,
    warn: performance.warn + health.summary.warn,
    fail: performance.fail + health.summary.fail,
    skipped: performance.skipped + health.summary.notRun,
    unavailable: performance.unavailable + health.summary.unavailable,
    executed,
    justifiedSkipped: performance.justifiedSkipped + (health.coverage.complete ? health.summary.notRun : 0),
    unexpectedSkipped: performance.unexpectedSkipped + (health.coverage.complete ? 0 : health.summary.notRun),
    coveragePercent: total ? roundMetric((executed / total) * 100) : null,
    overall: health.summary.overall === 'bottleneck' ? 'bottleneck'
      : health.summary.overall === 'attention' && performance.overall === 'healthy' ? 'attention' : performance.overall,
  };
}
