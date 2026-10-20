import type { PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';
import { publicAuditDiagnostic, publicAuditError } from './performanceAuditDiagnostic';
import { PUBLIC_AUDIT_METRIC_FIELDS } from './auditDiagnosticFields';

// Only source-authored enum values are public text. Runtime text is opaque even
// when it has no recognizable personal-data prefix or shape.
const FIXED_TEXT: Record<string, ReadonlySet<string>> = Object.fromEntries(Object.entries({
  kind: 'runtime journey setup storage network filesystem data list logo graphic layout update',
  status: 'pass warn fail skipped unavailable pending ready error waiting settled interrupted',
  platform: 'android ios web', osName: 'Android iOS', jsEngine: 'Hermes hermes jsc',
  payloadSource: 'remote local bundled cache unknown sample',
  overall: 'healthy attention bottleneck', auditCoverageProfile: 'basic maximum-safe',
  measurementMode: 'basic deep route-round-trip semantic-action segmented-payload-capacity',
  returnNavigationKind: 'none back second-back replace anchor-reset replace-recovery second-back+replace-recovery second-back+anchor-reset',
  stateImpact: 'none local-only restorable',
  iteration: 'cold warm deep-first-pass deep-repeat',
  stage: 'start route pre-action action path data readiness settle back recovery origin-readiness complete check',
  type: 'Error TypeError RangeError AuditDatasetChangedError PerformanceAuditReadinessTimeoutError PerformanceAuditReadinessProbeError PerformanceAuditStepTimeoutError PerformanceAuditPendingMutationError',
  frames: 'frame',
}).map(([key, values]) => [key, new Set(values.split(' '))]));

const SCALARS = new Set(('schemaVersion durationMs wallClockMs hangTimeoutMs storedCheckCount developmentBuild viewportWidth viewportHeight fontScale payloadProducts payloadProviders detailsLoaded historyLoaded productHistoryLoaded diagnosticsUploadEnabled networkConnected networkInternetReachable maximumSafeFeaturesEnabled pass warn fail skipped unavailable executed justifiedSkipped unexpectedSkipped coveragePercent slowestCheckMs plannedChecks storedChecks plannedJourneyChecks executedJourneyChecks justifiedSkippedJourneyChecks unexpectedSkippedJourneyChecks unavailableJourneyChecks attemptedPercent excludedUnsafeFacetCount complete partial coldForwardMs warmForwardMs coldBackMs warmBackMs forwardChangeMs backChangeMs ready capturing actionRevision registeredAtMs updatedAtMs required expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent present frames elapsedMs stageElapsedMs lastCheckpointAgeMs processingCheckpoints').split(' '));
const PROBE_PATH = '.checks[].diagnostic.readiness.surfaces[].probes[]';
const SCALAR_PATHS: Record<string, ReadonlySet<string>> = Object.fromEntries(Object.entries({
  '': 'schemaVersion durationMs wallClockMs partial',
  '.watchdog': 'hangTimeoutMs storedCheckCount',
  '.environment': 'developmentBuild viewportWidth viewportHeight fontScale payloadProducts payloadProviders detailsLoaded historyLoaded productHistoryLoaded diagnosticsUploadEnabled networkConnected networkInternetReachable maximumSafeFeaturesEnabled',
  '.summary': 'pass warn fail skipped unavailable executed justifiedSkipped unexpectedSkipped coveragePercent slowestCheckMs maxEventLoopLagMs maxFrameGapMs',
  '.coverage': 'plannedChecks storedChecks plannedJourneyChecks executedJourneyChecks justifiedSkippedJourneyChecks unexpectedSkippedJourneyChecks unavailableJourneyChecks coveragePercent attemptedPercent excludedUnsafeFacetCount complete',
  '.checks[]': 'durationMs',
  '.checks[].diagnostic.readiness': 'ready capturing',
  '.checks[].diagnostic.readiness.surfaces[]': 'actionRevision registeredAtMs updatedAtMs',
  [PROBE_PATH]: 'required expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent updatedAtMs',
  '.checks[].errorDetails': 'present frames',
  '.routeAggregates[]': 'coldForwardMs warmForwardMs coldBackMs warmBackMs forwardChangeMs backChangeMs',
  '.backgroundWorkWait': 'elapsedMs',
  '.backgroundWorkWait.jobs[]': 'elapsedMs stageElapsedMs lastCheckpointAgeMs processingCheckpoints',
  '.plan': 'schemaVersion', '.plan.passes[].steps[]': 'depth optional',
}).map(([path, names]) => [path, new Set(names.split(' '))]));
SCALAR_PATHS['.checks[].metrics'] = PUBLIC_AUDIT_METRIC_FIELDS;

function enumContext(key: string, parent: string): boolean {
  if (['platform', 'osName', 'jsEngine', 'payloadSource', 'auditCoverageProfile'].includes(key)) return parent === '.environment';
  if (key === 'overall') return parent === '.summary';
  if (['measurementMode', 'returnNavigationKind', 'iteration'].includes(key)) return parent === '.checks[].metrics';
  if (key === 'stage') return parent === '.checks[].diagnostic';
  if (key === 'type' || key === 'frames') return parent === '.checks[].errorDetails';
  if (key === 'stateImpact') return /^\.plan(?:\.passes\[\]\.steps\[\])?\.safety$/.test(parent);
  if (key === 'kind') return parent === '.checks[]' || parent === PROBE_PATH;
  if (key === 'status') return parent === '.checks[]' || parent === PROBE_PATH || parent === '.backgroundWorkWait';
  return false;
}
const FIELDS = new Set([...PUBLIC_AUDIT_METRIC_FIELDS, ...SCALARS, ...Object.keys(FIXED_TEXT),
  ...('app environment watchdog plan inputs passes steps coverage summary checks routeAggregates limitations backgroundWorkWait payloadWork jobs diagnostic readiness blockers code surface probe surfaces id actions lastCompletedAction probes error errorDetails trace metrics appHealth appVersion buildVersion platformVersion osVersion payloadRunDate datasetRevision renderRevision sessionId startedAt finishedAt lastStoredCheckAt label journeyLabel slowestCheckLabel slowestCheckId missingPlannedCheckIds duplicateStoredCheckIds unexpectedStoredCheckIds journeyId manufacturer brand model totalMemoryBytes networkType phaseDetail capturedAt outcome stage reason').split(' ')]);
for (const field of ('message safety renderRevisionBefore renderRevisionAfter actionResultEvidence readinessEvidence graphicEvidence readinessActionEvidence account accountBalance balance loanBalance loanAmount propertyValue currentRate lvr productKey product_key provider query searchQuery parameters profile profileFilters scenario selectionToken selectionTokens generationId bundleSha coreSha payloadRevision privateText').split(' ')) FIELDS.add(field);

/** Keep the canonical diagnostic report, replacing private inputs rather than
 * replacing the report with a summary. Opaque aliases retain equality evidence. */
export function fullAuditDiagnosticLog(report: PerformanceAuditReport, safeCheckId: (value: string) => string | null): unknown {
  const aliases = new Map<string, string>();
  const alias = (value: unknown, domain = 'value') => {
    const key = JSON.stringify([domain, value]);
    let name = aliases.get(key);
    if (name === undefined) { name = `~private${aliases.size}`; aliases.set(key, name); }
    return name;
  };
  const privateField = /^(?:sessionId|startedAt|finishedAt|lastStoredCheckAt|manufacturer|brand|model|networkType|label|journeyLabel|slowestCheckLabel|query|searchQuery|parameters|inputs|profile|profileFilters|scenario|accountBalance|balance|loanBalance|loanAmount|propertyValue|currentRate|lvr|productKey|product_key|provider|selectionTokens?|actionResultEvidence|readinessEvidence|graphicEvidence|readinessActionEvidence|limitations|generationId|bundleSha|coreSha|payloadRevision|privateText)$/i;
  const visit = (value: unknown, key = '', path = ''): unknown => {
    if (value == null) return value;
    const parent = path.slice(0, path.lastIndexOf('.'));
    if (typeof value === 'string' && (parent === '.coverage' && /CheckIds$/.test(key) || path === '.summary.slowestCheckId')) return safeCheckId(value) ?? alias(value);
    if (path === '.checks[].id' && typeof value === 'string') return safeCheckId(value) ?? alias(value);
    if (privateField.test(key) || key === 'account' || key === 'totalMemoryBytes' || /(?:password|secret|authorization|credential|privateKey|api[_-]?key|token|accountNumber|accountId|customerId|borrower|email|balance|amount|lvr)/i.test(key) ||
      typeof value === 'string' && /(?:revision|path|url)/i.test(key)) return alias(value);
    if (typeof value === 'string') {
      if (['.app', '.environment'].includes(parent) && /^(?:appVersion|buildVersion|platformVersion|osVersion)$/.test(key) && /^\d+(?:\.\d+){0,3}$/.test(value) && value.length <= 32) return value;
      if (parent.startsWith('.checks[].diagnostic.readiness.') && ['id', 'surface', 'probe', 'actions', 'lastCompletedAction', 'code'].includes(key)) {
        const roleKey = key === 'code' ? 'code' : 'id';
        const fixed = publicAuditDiagnostic({ [roleKey]: value }) as Record<string, unknown>;
        if (fixed[roleKey] === value) return value;
      }
      return enumContext(key, parent) && FIXED_TEXT[key]?.has(value) ? value : alias(value);
    }
    if (parent === '.checks[].metrics' && typeof value === 'object') return alias(value);
    if (Array.isArray(value)) return value.map(item => visit(item, key, `${path}[]`));
    if (typeof value !== 'object') return SCALAR_PATHS[parent]?.has(key) ? value : alias(value);
    return Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'networkViolations')
      .map(([name, child]) => FIELDS.has(name)
        ? [name, visit(child, name, `${path}.${name}`)]
        : [alias(name, 'key'), alias(child)]));
  };
  const retained = visit({ ...report, checks: report.checks.map(check => ({ ...check,
    errorDetails: publicAuditError(check.error, check.trace) })),
    environment: { ...report.environment, appVersion: report.app.appVersion, buildVersion: report.app.buildVersion },
    appHealth: null }) as Record<string, unknown>;
  // This dedicated sanitizer owns a complete public schema; do not obscure its
  // quality counts or findings through a second, unrelated schema boundary.
  return { ...retained, appHealth: report.appHealth ? toPublicAppHealthReport(report.appHealth) : null };
}
