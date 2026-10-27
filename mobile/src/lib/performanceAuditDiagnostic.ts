import { getProcessingYieldDiagnostics } from './yieldToUi';
import { publicAuditWorkDiagnostic } from './performanceAuditWorkDiagnostic';
import type { PerformanceAuditReadinessSnapshot } from './performanceAuditReadiness';
import type { AuditCheck } from './performanceAudit';
import { PERFORMANCE_AUDIT_STEP_LIMIT_MS } from './performanceAuditTiming';
import { redactSecrets } from './redactSecrets';

export type AuditDiagnosticStage = 'start' | 'route' | 'pre-action' | 'action' | 'path' | 'data' | 'readiness' | 'settle' | 'back' | 'recovery' | 'origin-readiness' | 'complete' | 'check';
export interface AuditCheckDiagnostic {
  stage: AuditDiagnosticStage;
  readiness: ReturnType<typeof diagnosticReadiness> | null;
  returnReadiness?: ReturnType<typeof diagnosticReadiness>;
  returnStage?: AuditDiagnosticStage;
}

// Probe IDs are source-authored roles. Reject arbitrary route/account content.
const WORDS = new Set(('1 2 a about account active actual advance age all app assessment async audit august b back bank bankrates base bonus bound browse buffer calculations calculator calendar candidates chart check collision columns compare comparisons content contribution core coverage criterion dashboard data debug deposit details different discount due duplicate economic economy eligible empty entries environment evidence excess execution external facet facts fake features fee file filters first flat forecast found frame future graphic graphics group growth hierarchy history id inputs insights interest inventory io items later layout leader lender lifecycle link linked list local log logo logos maintenance manifest market maturity maximum metric minimum model modeled movements moves name network new not notices observed one ongoing optional options outlook overview package pagination participation payload payment payments pi pinned preceding preferences prepared primary product products profile progress projection projections providers purchases rate rates rba readiness receipt recovery remaining render repay repayment response responsiveness restoration result results reversal root rule runtime safety saved scenario search secondary sections self september settings settle setup sheet snapshot source state status stop storage successor suitability system table target td terms there tier tiers transfer two unemployment unknown update visible wages waiver watchlist whole window zero').split(' '));
function role(value: string | undefined): string | null {
  return value && value.length <= 100 && value.split(/[.-]/).every(word => WORDS.has(word)) ? value : null;
}

const STAGES = new Set<AuditDiagnosticStage>(['start', 'route', 'pre-action', 'action', 'path', 'data', 'readiness', 'settle', 'back', 'recovery', 'origin-readiness', 'complete', 'check']);
const KEYS = new Set('returnReadiness returnStage work stage readiness ready capturing blockers code surface probe surfaces id actionRevision probes kind required status expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent errorClass coveredBySheet'.split(' '));
const CODES = new Set('capture-inactive no-surfaces no-probes probe-pending probe-error dataset-revision-mismatch render-revision-mismatch count-incomplete graphic-evidence-missing required-kind-missing'.split(' '));
const NUMERIC = new Set('actionRevision expected actual visible fallback'.split(' '));
const BOOLEAN = new Set('ready capturing required empty layout accessible datasetMatches renderMatches errorPresent coveredBySheet'.split(' '));
/** Repeat the field boundary for saved reports; arbitrary strings never become public evidence. */
export function publicAuditDiagnostic(value: unknown): unknown {
  const visit = (item: unknown, key = ''): unknown => {
    if (item == null) return item;
    if (typeof item === 'boolean') return BOOLEAN.has(key) ? item : null;
    if (typeof item === 'number') return NUMERIC.has(key) && Number.isFinite(item) ? item : null;
    if (typeof item === 'string') {
      if (['id', 'surface', 'probe'].includes(key)) return role(item);
      if ((key === 'stage' || key === 'returnStage') && STAGES.has(item as AuditDiagnosticStage) || key === 'code' && CODES.has(item) ||
        key === 'kind' && ['data', 'list', 'logo', 'graphic', 'layout'].includes(item) ||
        key === 'errorClass' && ['incomplete-scenario', 'unclassified'].includes(item) ||
        key === 'status' && ['pending', 'ready', 'error'].includes(item)) return item;
      return null;
    }
    if (Array.isArray(item)) return item.map(child => visit(child, key));
    if (typeof item !== 'object') return null;
    if (key === 'work') return publicAuditWorkDiagnostic(item);
    return Object.fromEntries(Object.entries(item).filter(([name]) => KEYS.has(name)).map(([name, child]) => [name, visit(child, name)]));
  };
  return value ? visit(value) : null;
}

export const PUBLIC_AUDIT_ERROR_TYPES = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AuditEvidenceCapacityError',
  'EvalError', 'URIError', 'AggregateError', 'InternalError', 'DOMException', 'AbortError', 'TimeoutError',
  'AuditDatasetChangedError', 'AuditInactivityError', 'PerformanceAuditReadinessTimeoutError', 'PerformanceAuditReadinessProbeError',
  'PerformanceAuditStepTimeoutError', 'PerformanceAuditPendingMutationError'] as const;

const REDACTED = '[REDACTED]';
/** Route and semantic scorers fail above these durations. Cited only when the stored metric exceeds them. */
const LATENCY_FAIL_MS: Record<string, number> = {
  forwardWorkMs: 2_500,
  actionMs: 2_500,
  backMs: 2_000,
  maxEventLoopLagMs: 300,
  maxFrameGapMs: 250,
};

function errorLines(error?: string): string[] {
  return (error ?? '').split(/\r?\n|\\n/).map(line => line.trim()).filter(Boolean);
}

function isStackLine(line: string): boolean {
  return /^\s*at\s+/.test(line) || /^[A-Za-z_$][\w.$<>]*@\S+:\d+:\d+\s*$/.test(line);
}

/** First-line classification plus the remaining prose, without stack frames. */
export function auditErrorProse(error?: string): { type: string | null; message: string } {
  const lines = errorLines(error).filter(line => !isStackLine(line));
  const first = lines[0] ?? '';
  const named = first.match(/^([A-Za-z_][\w]*)\s*:\s*([\s\S]*)$/);
  const known = named && (PUBLIC_AUDIT_ERROR_TYPES as readonly string[]).includes(named[1]) ? named[1] : null;
  const type = known ?? PUBLIC_AUDIT_ERROR_TYPES.find(name => error?.startsWith(`${name}:`)) ?? null;
  const message = [
    known ? named?.[2] ?? '' : first.replace(/^[A-Za-z_][\w]*\s*:\s*/, ''),
    ...lines.slice(1),
  ].join(' ').replace(/\s+/g, ' ').trim();
  return { type, message };
}

function redactGroupedDigits(value: string): string {
  return value.replace(/\b\d{1,6}(?:[\s.-]\d{1,6})+\b/g, (match) => (
    match.replace(/\D/g, '').length >= 6 ? REDACTED : match
  ));
}

/** Secrets, account numbers, tokens, URLs and paths stay opaque. Ordinary diagnostic words remain. */
export function deidentifyAuditText(text: string, maxChars = 400): string | null {
  let value = text.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  value = value.replace(/https?:\/\/\S+/gi, REDACTED);
  value = value.replace(/\b[A-Za-z]:\\[^\s]+/g, REDACTED);
  value = value.replace(/(?:^|[\s"'=:])\/[\w.~+-]+(?:\/[\w.~+-]+)+/g, (match) => `${/[\s"'=:]/.test(match[0]) ? match[0] : ''}${REDACTED}`);
  value = value.replace(/(?:^|[\s"'=:])(?:\.\.?\/)?[\w.-]+(?:\/[\w.-]+){2,}/g, (match) => `${/[\s"'=:]/.test(match[0]) ? match[0] : ''}${REDACTED}`);
  value = value.replace(/"(sessionId|manufacturer|model|brand|expectedPath|product_key|account)"\s*:\s*"(?:[^"\\]|\\.)*"/gi, `"$1":"${REDACTED}"`);
  value = redactSecrets(value);
  value = value.replace(/\bprivate\b/gi, REDACTED);
  value = redactGroupedDigits(value);
  value = value.replace(/\b\d{6,}\b/g, REDACTED);
  value = value.replace(/\s+/g, ' ').trim();
  const readable = value.replaceAll(REDACTED, '').replace(/[^A-Za-z0-9]+/g, '');
  if (!readable) return null;
  if (/secret|password|\btoken\b|@[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) return null;
  const limit = Math.min(16_384, Math.max(1, Number.isFinite(maxChars) ? Math.floor(maxChars) : 400));
  return value.length > limit ? `${value.slice(0, limit)}…[truncated ${value.length - limit} chars]` : value;
}

/** Keep actionable code locations and a deidentified message. Frames never replace the message. */
export function publicAuditError(error?: string, trace?: string) {
  const prose = auditErrorProse(error);
  const type = prose.type ?? PUBLIC_AUDIT_ERROR_TYPES.find(name => error?.startsWith(`${name}:`)) ?? null;
  const frames: (string | number)[][] = [];
  for (const line of [error ?? '', trace ?? ''].join('\n').split(/\r?\n|\\n/)) {
    const frame = line.match(/^\s*at\s+([A-Za-z_$][\w.$<>]*)\s+\([^\n]*:(\d+):(\d+)\)\s*$/) ??
      line.match(/^\s*([A-Za-z_$][\w.$<>]*)@[^\n]*:(\d+):(\d+)\s*$/);
    if (frame) frames.push(['frame', Number(frame[2]), Number(frame[3])]);
  }
  return { present: Boolean(error), type, message: deidentifyAuditText(prose.message), frames };
}

function finiteMetric(metrics: AuditCheck['metrics'], key: string): number | null {
  const value = metrics[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stepLimitMs(check: AuditCheck, message: string): number {
  if (typeof check.metrics.stepLimitMs === 'number' && check.metrics.stepLimitMs > 0) return check.metrics.stepLimitMs;
  const seconds = message.match(/(\d+)-second step limit/);
  if (seconds) return Number(seconds[1]) * 1_000;
  const millis = message.match(/after (\d+)ms/);
  if (millis) return Number(millis[1]);
  return PERFORMANCE_AUDIT_STEP_LIMIT_MS;
}

/**
 * Specific public cause for a failed check, derived from status, error type,
 * message, step-limit metrics, stage and action completion. Timeout limits are named.
 */
export function publicAuditFailureReason(check: AuditCheck, hangTimeoutMs?: number): string | null {
  if (check.status !== 'fail') return null;
  const diagnostic = publicAuditDiagnostic(check.diagnostic) as { stage?: string } | null;
  const stage = diagnostic?.stage ?? 'unknown';
  const prose = auditErrorProse(check.error);
  const error = publicAuditError(check.error, check.trace);
  const message = error.message;
  const metrics = check.metrics;
  const limitMs = stepLimitMs(check, prose.message);
  const inactivityMs = prose.message.match(/stored no completed check for (\d+)ms/);
  const stall = prose.type === 'AuditInactivityError' || inactivityMs != null;
  if (stall) {
    const ms = inactivityMs ? Number(inactivityMs[1]) : hangTimeoutMs;
    const seconds = ms == null ? null : ms / 1_000;
    const limit = ms == null ? 'the configured stall timeout' : `${ms}ms (${seconds}s)`;
    return `Timed out: stall timeout of ${limit} elapsed with no completed check stored.`;
  }
  const stepTimeout = metrics.stepLimitExceeded === true
    || error.type === 'PerformanceAuditStepTimeoutError'
    || error.type === 'PerformanceAuditReadinessTimeoutError'
    || /step limit|did not settle after \d+ms/i.test(prose.message);
  const causes: string[] = [];
  if (metrics.publicCatalogueChanged === true) causes.push('Public catalogue changed');
  if (metrics.publicCatalogueCacheMiss === true) causes.push('Public catalogue cache miss');
  if (metrics.catalogueAdmissionRejected === true) causes.push('Catalogue admission rejected');
  if (metrics.datasetRefreshStarted === true) causes.push('Dataset refresh started');
  if (metrics.datasetManifestChanged === true) causes.push('Dataset manifest changed');
  if (metrics.datasetChanged === true || metrics.datasetRevisionChanged === true) causes.push('Dataset revision changed');
  if (stepTimeout) {
    const wait = error.type === 'PerformanceAuditReadinessTimeoutError' || /did not settle after \d+ms/i.test(prose.message)
      ? 'readiness wait'
      : 'step';
    const action = metrics.actionCompleted === false ? ' Action did not complete.' : '';
    const typed = error.type ? ` Error type ${error.type}.` : '';
    const detail = message ? ` Message: ${message}` : prose.message ? ' Error message redacted.' : '';
    const lead = causes.length ? `${causes.join('. ')}. ` : '';
    return `${lead}Timed out at stage ${stage}: ${wait} limit of ${limitMs}ms exceeded.${action}${typed}${detail}`;
  }
  const parts = [`Failed at stage ${stage}.`];
  if (causes.length) parts.push(`${causes.join('. ')}.`);
  if (metrics.actionCompleted === false) parts.push('Action did not complete.');
  else if (metrics.actionCompleted === true) parts.push('Action completed.');
  if (error.type) parts.push(`Error type ${error.type}.`);
  else if (error.present) parts.push('Error type was not recognized.');
  else parts.push('No error object was recorded.');
  if (metrics.nonTimingFailure === true) parts.push('Non-timing failure.');
  else if (metrics.nonTimingFailure === false) parts.push('Timing failure, not a step or stall timeout.');
  let citedLimit = false;
  for (const [key, limit] of Object.entries(LATENCY_FAIL_MS)) {
    const value = finiteMetric(metrics, key);
    if (value != null && value > limit) {
      citedLimit = true;
      parts.push(`${key}=${value}ms exceeded the ${limit}ms fail limit.`);
    }
  }
  if (metrics.measurementMode === 'route-round-trip') {
    if (metrics.backReturnedToAudit === false) parts.push('Back navigation did not return to the audit.');
    if (metrics.backChangedPath === false) parts.push('Back navigation did not change path.');
  }
  if (!citedLimit && metrics.nonTimingFailure === false) {
    const observed = ['forwardWorkMs', 'actionMs', 'backgroundSettleMs', 'backMs', 'maxEventLoopLagMs', 'maxFrameGapMs']
      .flatMap(key => {
        const value = finiteMetric(metrics, key);
        return value == null ? [] : [`${key}=${value}`];
      });
    if (observed.length) parts.push(`Measured ${observed.join(', ')}.`);
  }
  if (message) parts.push(`Message: ${message}`);
  else if (prose.message) parts.push('Error message redacted.');
  return parts.join(' ');
}

export function publicHealthFailureReason(check: { code?: string; status?: string; metrics?: Record<string, unknown> }): string | null {
  if (check.status !== 'fail') return null;
  const code = typeof check.code === 'string' && /^[a-z0-9-]{1,80}$/.test(check.code) ? check.code : 'health-check';
  const metrics = check.metrics ?? {};
  const parts = [`Health check ${code} failed`];
  if (typeof metrics.checked === 'number' && Number.isFinite(metrics.checked)) parts.push(`checked=${metrics.checked}`);
  if (metrics.complete === false) parts.push('complete=false');
  if (typeof metrics.source === 'string' && /^[a-z0-9_-]{1,40}$/.test(metrics.source)) parts.push(`source=${metrics.source}`);
  for (const [key, value] of Object.entries(metrics)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,60}$/.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && /fail|missing|mismatch/i.test(key)) parts.push(`${key}=${value}`);
    if (value === false && /(?:Available|Rendered|Matches)$/.test(key)) parts.push(`${key}=false`);
  }
  for (const key of ['historyGaps', 'historySourceGapDays']) {
    const value = metrics[key];
    if (typeof value === 'string' && value !== '[]' && value !== 'null' && value.length > 2) parts.push(`${key} recorded`);
  }
  return `${parts.join('. ')}.`;
}

export function stallTimeoutFields(hangTimeoutMs: number): { stallTimeoutMs: number; stallTimeoutSeconds: number } {
  return { stallTimeoutMs: hangTimeoutMs, stallTimeoutSeconds: hangTimeoutMs / 1_000 };
}
function diagnosticReadiness(snapshot: PerformanceAuditReadinessSnapshot) {
  return {
    ready: snapshot.ready,
    capturing: snapshot.capturing,
    blockers: snapshot.blockers.map(blocker => ({ code: blocker.code, surface: blocker.surfaceId ?? null, probe: blocker.probeId ?? null, message: blocker.message })),
    surfaces: snapshot.surfaces.map(surface => ({
      id: surface.id, work: publicAuditWorkDiagnostic(surface.work ? { ...surface.work,
        ...(typeof getProcessingYieldDiagnostics === 'function' ? {
          schedulerNativeScheduleAttempts: getProcessingYieldDiagnostics().nativeScheduleAttempts,
          schedulerNativeCompleted: getProcessingYieldDiagnostics().nativeCompleted,
          schedulerNativeFallbacks: getProcessingYieldDiagnostics().nativeFallbacks,
        } : {}),
      } : undefined), actionRevision: surface.actionRevision,
      actions: surface.actions, lastCompletedAction: surface.lastCompletedAction,
      datasetRevision: surface.datasetRevision, renderRevision: surface.renderRevision,
      registeredAtMs: surface.registeredAtMs, updatedAtMs: surface.updatedAtMs,
      probes: surface.probes.map(probe => ({ id: probe.id, kind: probe.kind, required: probe.required, coveredBySheet: probe.coveredBySheet, status: probe.status,
        expected: probe.expectedCount, actual: probe.actualCount, visible: probe.visibleCount, fallback: probe.fallbackCount,
        empty: probe.emptyStateRendered, layout: probe.layoutMeasured, accessible: probe.accessibleSummary,
        datasetMatches: probe.datasetRevision == null || surface.datasetRevision == null ? null : probe.datasetRevision === surface.datasetRevision,
        renderMatches: probe.renderRevision == null || surface.renderRevision == null ? null : probe.renderRevision === surface.renderRevision,
        errorPresent: probe.error !== null,
        errorClass: probe.error == null ? null : probe.id === 'projections.model' &&
          probe.error.startsWith('Incomplete scenario: ') ? 'incomplete-scenario' : 'unclassified',
        error: probe.error, datasetRevision: probe.datasetRevision, renderRevision: probe.renderRevision, updatedAtMs: probe.updatedAtMs,
      })),
    })),
  };
}
export function captureAuditDiagnostic(snapshot: PerformanceAuditReadinessSnapshot, stage: AuditDiagnosticStage): AuditCheckDiagnostic {
  return { stage, readiness: diagnosticReadiness(snapshot) };
}


/** Optional visual/model evidence may be unavailable, but cannot produce a
 * fully passing journey. Required defects remain functional failures. */
export function scoreAuditTargetProbeEvidence(diagnostic: AuditCheckDiagnostic | undefined, surfaceId: string): 'pass' | 'warn' | 'fail' {
  let outcome: 'pass' | 'warn' | 'fail' = 'pass';
  for (const surface of diagnostic?.readiness?.surfaces ?? []) {
    if (surface.id !== surfaceId) continue;
    for (const probe of surface.probes) {
      if (probe.coveredBySheet === true) continue;
      const defective = probe.status !== 'ready' || probe.errorPresent ||
        probe.renderMatches === false || probe.datasetMatches === false;
      if (!defective) continue;
      if (probe.required) return 'fail';
      outcome = 'warn';
    }
  }
  return outcome;
}


/** Keep the failed destination as primary evidence when return/recovery fails. */
export function appendAuditReturnDiagnostic(destination: AuditCheckDiagnostic | undefined,
  snapshot: PerformanceAuditReadinessSnapshot, stage: AuditDiagnosticStage): AuditCheckDiagnostic {
  return destination ? { ...destination, returnReadiness: diagnosticReadiness(snapshot), returnStage: stage }
    : captureAuditDiagnostic(snapshot, stage);
}
