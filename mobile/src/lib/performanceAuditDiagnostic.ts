import type { PerformanceAuditReadinessSnapshot } from './performanceAuditReadiness';

export type AuditDiagnosticStage = 'start' | 'route' | 'pre-action' | 'action' | 'path' | 'readiness' | 'settle' | 'complete' | 'check';
export interface AuditCheckDiagnostic {
  stage: AuditDiagnosticStage;
  readiness: ReturnType<typeof diagnosticReadiness> | null;
}

// Probe IDs are source-authored roles. Reject arbitrary route/account content.
const WORDS = new Set(('rates results search audit target data list layout filters logos logo model projections lifecycle chart inputs scenario storage calculator product details receipt evidence lender products history graphic compare table columns market snapshot outlook dashboard economy rba response calendar moves saved items profile local state options settings sections preferences update status terms notices content debug log entries buffer not found recovery bank bankrates providers window result suitability candidates core optional projection prepared visible pagination maximum features calculations readiness render').split(' '));
function role(value: string | undefined): string | null {
  return value && value.length <= 100 && value.split(/[.-]/).every(word => WORDS.has(word)) ? value : null;
}

const STAGES = new Set(['start', 'route', 'pre-action', 'action', 'path', 'readiness', 'settle', 'complete', 'check']);
const KEYS = new Set('stage readiness ready capturing blockers code surface probe surfaces id actionRevision probes kind required status expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent'.split(' '));
const CODES = new Set('capture-inactive no-surfaces no-probes probe-pending probe-error dataset-revision-mismatch render-revision-mismatch count-incomplete graphic-evidence-missing required-kind-missing'.split(' '));
/** Repeat the field boundary for saved reports; arbitrary strings never become public evidence. */
export function publicAuditDiagnostic(value: unknown): unknown {
  const visit = (item: unknown, key = ''): unknown => {
    if (item == null || typeof item === 'boolean') return item;
    if (typeof item === 'number') return Number.isFinite(item) ? item : null;
    if (typeof item === 'string') {
      if (['id', 'surface', 'probe'].includes(key)) return role(item);
      if (key === 'stage' && STAGES.has(item) || key === 'code' && CODES.has(item) ||
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
    blockers: snapshot.blockers.map(blocker => ({ code: blocker.code, surface: role(blocker.surfaceId), probe: role(blocker.probeId) })),
    surfaces: snapshot.surfaces.map(surface => ({
      id: role(surface.id), actionRevision: surface.actionRevision,
      probes: surface.probes.map(probe => ({ id: role(probe.id), kind: probe.kind, required: probe.required, status: probe.status,
        expected: probe.expectedCount, actual: probe.actualCount, visible: probe.visibleCount, fallback: probe.fallbackCount,
        empty: probe.emptyStateRendered, layout: probe.layoutMeasured, accessible: probe.accessibleSummary,
        datasetMatches: probe.datasetRevision == null || surface.datasetRevision == null ? null : probe.datasetRevision === surface.datasetRevision,
        renderMatches: probe.renderRevision == null || surface.renderRevision == null ? null : probe.renderRevision === surface.renderRevision,
        errorPresent: probe.error !== null,
      })),
    })),
  };
}
export function captureAuditDiagnostic(snapshot: PerformanceAuditReadinessSnapshot, stage: AuditDiagnosticStage): AuditCheckDiagnostic {
  return { stage, readiness: diagnosticReadiness(snapshot) };
}
