import type { PerformanceAuditReadinessSnapshot } from './performanceAuditReadiness';

export type AuditDiagnosticStage = 'start' | 'route' | 'pre-action' | 'action' | 'path' | 'data' | 'readiness' | 'settle' | 'back' | 'recovery' | 'origin-readiness' | 'complete' | 'check';
export interface AuditCheckDiagnostic {
  stage: AuditDiagnosticStage;
  readiness: ReturnType<typeof diagnosticReadiness> | null;
}

// Probe IDs are source-authored roles. Reject arbitrary route/account content.
const WORDS = new Set(('1 2 a about account active actual advance age all app assessment async audit august b back bank bankrates base bonus bound browse buffer calculations calculator calendar candidates chart check collision columns compare content contribution core coverage criterion dashboard data debug deposit details different discount due duplicate economic economy eligible empty entries environment evidence excess execution external facet facts fake features fee file filters first flat forecast found frame future graphic graphics group growth hierarchy history id inputs insights interest inventory io items later layout leader lender lifecycle link linked list local log logo logos maintenance manifest market maturity maximum metric minimum model modeled movements moves name network new not notices observed one ongoing optional options outlook overview package pagination participation payload payment payments pi pinned preceding preferences prepared primary product products profile progress projection projections providers purchases rate rates rba readiness receipt recovery remaining render repay repayment response responsiveness restoration result results reversal root rule runtime safety saved scenario search secondary sections self september settings settle setup snapshot source state status stop storage successor suitability system table target td terms there tier tiers transfer two unemployment unknown update visible wages waiver watchlist whole window zero').split(' '));
function role(value: string | undefined): string | null {
  return value && value.length <= 100 && value.split(/[.-]/).every(word => WORDS.has(word)) ? value : null;
}

const STAGES = new Set<AuditDiagnosticStage>(['start', 'route', 'pre-action', 'action', 'path', 'data', 'readiness', 'settle', 'back', 'recovery', 'origin-readiness', 'complete', 'check']);
const KEYS = new Set('stage readiness ready capturing blockers code surface probe surfaces id actionRevision probes kind required status expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent'.split(' '));
const CODES = new Set('capture-inactive no-surfaces no-probes probe-pending probe-error dataset-revision-mismatch render-revision-mismatch count-incomplete graphic-evidence-missing required-kind-missing'.split(' '));
const NUMERIC = new Set('actionRevision expected actual visible fallback'.split(' '));
const BOOLEAN = new Set('ready capturing required empty layout accessible datasetMatches renderMatches errorPresent'.split(' '));
/** Repeat the field boundary for saved reports; arbitrary strings never become public evidence. */
export function publicAuditDiagnostic(value: unknown): unknown {
  const visit = (item: unknown, key = ''): unknown => {
    if (item == null) return item;
    if (typeof item === 'boolean') return BOOLEAN.has(key) ? item : null;
    if (typeof item === 'number') return NUMERIC.has(key) && Number.isFinite(item) ? item : null;
    if (typeof item === 'string') {
      if (['id', 'surface', 'probe'].includes(key)) return role(item);
      if (key === 'stage' && STAGES.has(item as AuditDiagnosticStage) || key === 'code' && CODES.has(item) ||
        key === 'kind' && ['data', 'list', 'logo', 'graphic', 'layout'].includes(item) ||
        key === 'status' && ['pending', 'ready', 'error'].includes(item)) return item;
      return null;
    }
    if (Array.isArray(item)) return item.map(child => visit(child, key));
    if (typeof item !== 'object') return null;
    return Object.fromEntries(Object.entries(item).filter(([name]) => KEYS.has(name)).map(([name, child]) => [name, visit(child, name)]));
  };
  return value ? visit(value) : null;
}

/** Keep actionable code locations without exporting URLs, paths or raw error text. */
export function publicAuditError(error?: string, trace?: string) {
  const types = ['Error', 'TypeError', 'RangeError', 'AuditDatasetChangedError', 'PerformanceAuditReadinessTimeoutError',
    'PerformanceAuditReadinessProbeError', 'PerformanceAuditStepTimeoutError', 'PerformanceAuditPendingMutationError'];
  const type = types.find(name => error?.startsWith(`${name}:`)) ?? null;
  const frames: (string | number)[][] = [];
  for (const line of [error ?? '', trace ?? ''].join('\n').split(/\r?\n|\\n/)) {
    const frame = line.match(/^\s*at\s+([A-Za-z_$][\w.$<>]*)\s+\([^\n]*:(\d+):(\d+)\)\s*$/) ??
      line.match(/^\s*([A-Za-z_$][\w.$<>]*)@[^\n]*:(\d+):(\d+)\s*$/);
    if (frame) frames.push([frame[1], Number(frame[2]), Number(frame[3])]);
  }
  return { present: Boolean(error), type, frames };
}
function diagnosticReadiness(snapshot: PerformanceAuditReadinessSnapshot) {
  return {
    ready: snapshot.ready,
    capturing: snapshot.capturing,
    blockers: snapshot.blockers.map(blocker => ({ code: blocker.code, surface: blocker.surfaceId ?? null, probe: blocker.probeId ?? null, message: blocker.message })),
    surfaces: snapshot.surfaces.map(surface => ({
      id: surface.id, actionRevision: surface.actionRevision,
      actions: surface.actions, lastCompletedAction: surface.lastCompletedAction,
      datasetRevision: surface.datasetRevision, renderRevision: surface.renderRevision,
      registeredAtMs: surface.registeredAtMs, updatedAtMs: surface.updatedAtMs,
      probes: surface.probes.map(probe => ({ id: probe.id, kind: probe.kind, required: probe.required, status: probe.status,
        expected: probe.expectedCount, actual: probe.actualCount, visible: probe.visibleCount, fallback: probe.fallbackCount,
        empty: probe.emptyStateRendered, layout: probe.layoutMeasured, accessible: probe.accessibleSummary,
        datasetMatches: probe.datasetRevision == null || surface.datasetRevision == null ? null : probe.datasetRevision === surface.datasetRevision,
        renderMatches: probe.renderRevision == null || surface.renderRevision == null ? null : probe.renderRevision === surface.renderRevision,
        errorPresent: probe.error !== null,
        error: probe.error, datasetRevision: probe.datasetRevision, renderRevision: probe.renderRevision, updatedAtMs: probe.updatedAtMs,
      })),
    })),
  };
}
export function captureAuditDiagnostic(snapshot: PerformanceAuditReadinessSnapshot, stage: AuditDiagnosticStage): AuditCheckDiagnostic {
  return { stage, readiness: diagnosticReadiness(snapshot) };
}
