import { publicAuditWorkDiagnostic } from './performanceAuditWorkDiagnostic';
import type { PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';
import { PUBLIC_AUDIT_ERROR_TYPES, publicAuditDiagnostic, publicAuditError, publicAuditFailureReason, publicHealthFailureReason, stallTimeoutFields } from './performanceAuditDiagnostic';
import { PUBLIC_AUDIT_METRIC_FIELDS } from './auditDiagnosticFields';
import { buildDeepPerformanceAuditPlan } from './performanceAuditPlan';
import { ANDROID_UPDATE_READINESS_AUDIT } from './performanceAuditCheckInventory';
import { hasValidPerformanceAuditHealth, performanceAuditReference, publicAuditTimestamp } from './performanceAuditCompletion';
import { AUDIT_PRODUCER_ENUMS, AUDIT_PRODUCER_METRIC_FIELDS, AUDIT_PRODUCER_SCALARS, AUDIT_REGISTERED_ACTION_IDS, AUDIT_REQUIRED_ASSET_IDS, AUDIT_WORKER_TEXT } from './auditDiagnosticProducerFields';

let planText: Map<string, Set<string>> | undefined;
/** Derive only source-authored plan text from a plan with no user/payload input. */
function publicPlanText(path: string, value: string): boolean {
  if (!path.startsWith('.plan.')) return false;
  if (path === '.plan.passes[].steps[].scenarioId' && /^sample\.catalogue\.[0-9]{1,3}$/.test(value)) return true;
  if (path === '.plan.passes[].steps[].id' && /^(?:first-pass|repeat)\.sample\.catalogue\.[0-9]{1,3}\.product\.(?:open|lender\.open)$/.test(value)) return true;
  if (!planText) {
    planText = new Map();
    const collect = (item: unknown, location: string) => {
      if (location === '.plan.inputs' || location.endsWith('.parameters')) return;
      if (typeof item === 'string') {
        const values = planText!.get(location) ?? new Set<string>();
        values.add(item); planText!.set(location, values);
      } else if (Array.isArray(item)) item.forEach(child => collect(child, `${location}[]`));
      else if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) collect(child, `${location}.${key}`);
    };
    collect(buildDeepPerformanceAuditPlan(null), '.plan');
  }
  return planText.get(path)?.has(value) === true;
}

// Only source-authored enum values are public text. Runtime text is opaque even
// when it has no recognizable personal-data prefix or shape.
const FIXED_TEXT: Record<string, ReadonlySet<string>> = Object.fromEntries(Object.entries({
  kind: 'runtime journey setup storage network filesystem data list logo graphic layout update',
  status: 'pass warn fail skipped unavailable pending ready error waiting settled interrupted',
  platform: 'android ios web', osName: 'Android iOS', jsEngine: 'Hermes hermes jsc SpiderMonkey V8 JavaScriptCore unknown',
  payloadSource: 'remote local bundled cache unknown sample',
  overall: 'healthy attention bottleneck', auditCoverageProfile: 'basic maximum-safe maximum-safe-coverage-v1',
  measurementMode: 'basic deep route-round-trip semantic-action segmented-payload-capacity',
  returnNavigationKind: 'none back second-back replace anchor-reset replace-recovery second-back+replace-recovery second-back+anchor-reset',
  stateImpact: 'none local-only restorable',
  iteration: 'cold warm deep-first-pass deep-repeat',
  stage: 'start route pre-action action path data readiness settle back recovery origin-readiness complete check',
  type: PUBLIC_AUDIT_ERROR_TYPES.join(' '),
  errorClass: 'incomplete-scenario unclassified',
  checkStatus: 'current available incompatible', downloadPhase: 'idle waiting downloading retrying verifying ready cancelled error',
  ownerCheckId: ANDROID_UPDATE_READINESS_AUDIT.checkId,
  semanticActionId: ANDROID_UPDATE_READINESS_AUDIT.semanticActionId,
  executionPhase: ANDROID_UPDATE_READINESS_AUDIT.phase, transportScope: ANDROID_UPDATE_READINESS_AUDIT.transportScope,
  actionSource: ANDROID_UPDATE_READINESS_AUDIT.expectedSurface, expectedSurface: ANDROID_UPDATE_READINESS_AUDIT.expectedSurface,
  frames: 'frame',
  coldStatus: 'pass warn fail skipped', warmStatus: 'pass warn fail skipped',
  outcome: 'completed failed fallback superseded unavailable',
  activeWork: 'refreshing postRefreshWarming bankRateHistoryLoading detailsLoading',
}).map(([key, values]) => [key, new Set(values.split(' '))]));
FIXED_TEXT.returnStage = FIXED_TEXT.stage;
for (const [key, values] of Object.entries(AUDIT_PRODUCER_ENUMS)) FIXED_TEXT[key] = new Set([...(FIXED_TEXT[key] ?? []), ...values]);

const SCALARS = new Set(('schemaVersion durationMs wallClockMs hangTimeoutMs storedCheckCount developmentBuild viewportWidth viewportHeight fontScale payloadProducts payloadProviders detailsLoaded historyLoaded productHistoryLoaded diagnosticsUploadEnabled networkConnected networkInternetReachable maximumSafeFeaturesEnabled pass warn fail skipped unavailable executed justifiedSkipped unexpectedSkipped coveragePercent slowestCheckMs plannedChecks storedChecks plannedJourneyChecks executedJourneyChecks justifiedSkippedJourneyChecks unexpectedSkippedJourneyChecks unavailableJourneyChecks attemptedPercent excludedUnsafeFacetCount complete partial coldForwardMs warmForwardMs coldBackMs warmBackMs forwardChangeMs backChangeMs ready capturing actionRevision registeredAtMs updatedAtMs coveredBySheet required expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent present frames elapsedMs stageElapsedMs lastCheckpointAgeMs processingCheckpoints').split(' '));
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
  [PROBE_PATH]: 'coveredBySheet required expected actual visible fallback empty layout accessible datasetMatches renderMatches errorPresent updatedAtMs',
  '.checks[].errorDetails': 'present frames',
  '.routeAggregates[]': 'coldForwardMs warmForwardMs coldBackMs warmBackMs forwardChangeMs backChangeMs',
  '.backgroundWorkWait': 'elapsedMs',
  '.backgroundWorkWait.jobs[]': 'id elapsedMs stageElapsedMs lastCheckpointAgeMs processingCheckpoints omittedStages',
  '.backgroundWorkWait.jobs[].stages[]': 'durationMs active',
  '.backgroundWorkWait.payloadWork': 'refreshing postRefreshWarming bankRateHistoryLoading detailsLoading',
  '.plan': 'schemaVersion safeActionCount', '.plan.passes[].steps[]': 'depth optional mutatesRestorableState',
  '.plan.passes[].steps[].skipSafety': 'maySkip',
}).map(([path, names]) => [path, new Set(names.split(' '))]));
SCALAR_PATHS['.checks[].metrics'] = new Set([...PUBLIC_AUDIT_METRIC_FIELDS, ...AUDIT_PRODUCER_SCALARS]);

function enumContext(key: string, parent: string): boolean {
  if (parent === '.checks[].metrics' && AUDIT_PRODUCER_ENUMS[key]) return true;
  if (['platform', 'osName', 'jsEngine', 'payloadSource', 'auditCoverageProfile'].includes(key)) return parent === '.environment';
  if (key === 'overall') return parent === '.summary';
  if (['measurementMode', 'returnNavigationKind', 'iteration'].includes(key)) return parent === '.checks[].metrics';
  if (['checkStatus', 'downloadPhase', 'ownerCheckId', 'semanticActionId', 'executionPhase', 'transportScope', 'actionSource', 'expectedSurface'].includes(key)) return parent === '.checks[].metrics';
  if (key === 'stage' || key === 'returnStage') return parent === '.checks[].diagnostic';
  if (key === 'type' || key === 'frames') return parent === '.checks[].errorDetails';
  if (key === 'stateImpact') return /^\.plan(?:\.passes\[\]\.steps\[\])?\.safety$/.test(parent);
  if (key === 'errorClass') return parent === PROBE_PATH;
  if (key === 'kind') return parent === '.checks[]' || parent === PROBE_PATH;
  if (key === 'status') return parent === '.checks[]' || parent === PROBE_PATH || parent === '.backgroundWorkWait';
  if (key === 'coldStatus' || key === 'warmStatus') return parent === '.routeAggregates[]';
  if (key === 'outcome') return parent === '.backgroundWorkWait.jobs[]';
  if (key === 'activeWork') return parent === '.backgroundWorkWait.payloadWork';
  return false;
}
const FIELDS = new Set([...PUBLIC_AUDIT_METRIC_FIELDS, ...AUDIT_PRODUCER_METRIC_FIELDS, ...SCALARS, ...Object.keys(FIXED_TEXT),
  ...('app environment watchdog plan inputs passes steps coverage summary checks routeAggregates limitations backgroundWorkWait payloadWork jobs diagnostic readiness returnReadiness returnStage blockers code surface probe surfaces work id actions lastCompletedAction probes error errorDetails trace metrics appHealth appVersion buildVersion platformVersion osVersion payloadRunDate datasetRevision renderRevision sessionId startedAt finishedAt lastStoredCheckAt label journeyLabel slowestCheckLabel slowestCheckId missingPlannedCheckIds duplicateStoredCheckIds unexpectedStoredCheckIds journeyId manufacturer brand model totalMemoryBytes networkType phaseDetail capturedAt outcome stage reason').split(' ')]);
for (const field of ('message safety renderRevisionBefore renderRevisionAfter actionResultEvidence readinessEvidence graphicEvidence readinessActionEvidence account accountBalance balance loanBalance loanAmount propertyValue currentRate lvr productKey product_key provider query searchQuery parameters profile profileFilters scenario selectionToken selectionTokens generationId bundleSha coreSha payloadRevision privateText').split(' ')) FIELDS.add(field);
for (const names of Object.values(SCALAR_PATHS)) for (const name of names) FIELDS.add(name);
for (const field of ('coverageProfile passId scenarioId semanticActionId expectedPath expectedSurface skipReason skipSafety when reason unsafeActionsExcluded excludedUnsafeActions stages runDate manifestRunDate revision coreSha detailsSha activeWork').split(' ')) FIELDS.add(field);
for (const field of ('installedVersion installedBuild remoteVersion remoteBuild cachedBuild').split(' ')) FIELDS.add(field);
const PUBLICATION_DATE_PATHS = new Set(['.environment.payloadRunDate', '.backgroundWorkWait.payloadWork.revision.runDate',
  '.backgroundWorkWait.payloadWork.revision.manifestRunDate', '.backgroundWorkWait.jobs[].runDate']);
function publicationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
}
function missingAssetList(value: string, separator: string): boolean {
  if (value.length > 256) return false;
  const assets = value.split(separator);
  return assets.length > 0 && assets.length <= AUDIT_REQUIRED_ASSET_IDS.size && new Set(assets).size === assets.length && assets.every(asset => AUDIT_REQUIRED_ASSET_IDS.has(asset));
}

/** Keep the canonical diagnostic report, replacing private inputs rather than
 * replacing the report with a summary. Aliases retain primitive-value equality
 * and repeated object identity without copying private object graphs. */
export function fullAuditDiagnosticLog(report: PerformanceAuditReport, safeCheckId: (value: string) => string | null): unknown {
  const domains = new Map<string, { primitives: Map<unknown, string>; objects: WeakMap<object, string> }>();
  let nextAlias = 0;
  const alias = (value: unknown, domain = 'value') => {
    let identities = domains.get(domain);
    if (!identities) { identities = { primitives: new Map(), objects: new WeakMap() }; domains.set(domain, identities); }
    // Reuse original primitive values and object identities. Serializing private
    // evidence merely to name it duplicates long traces/graphs in the JS heap.
    const object = value !== null && typeof value === 'object';
    let name = object ? identities.objects.get(value) : identities.primitives.get(value);
    if (name === undefined) {
      name = `~private${nextAlias++}`;
      if (object) identities.objects.set(value, name); else identities.primitives.set(value, name);
    }
    return name;
  };
  const privateField = /^(?:sessionId|startedAt|finishedAt|lastStoredCheckAt|manufacturer|brand|model|networkType|label|journeyLabel|slowestCheckLabel|query|searchQuery|parameters|inputs|profile|profileFilters|scenario|accountBalance|balance|loanBalance|loanAmount|propertyValue|currentRate|lvr|productKey|product_key|provider|selectionTokens?|actionResultEvidence|readinessEvidence|graphicEvidence|readinessActionEvidence|limitations|generationId|bundleSha|coreSha|payloadRevision|privateText)$/i;
  const visit = (value: unknown, key = '', path = ''): unknown => {
    if (value == null) return value;
    path = path.replace(/^\.checks\[\]\.diagnostic\.returnReadiness(?=\.|$)/, '.checks[].diagnostic.readiness');
    if (path === '.checks[].diagnostic.readiness.surfaces[].work') return publicAuditWorkDiagnostic(value) ?? {};
    const parent = path.slice(0, path.lastIndexOf('.'));
    if (['.startedAt', '.finishedAt', '.watchdog.lastStoredCheckAt', '.backgroundWorkWait.startedAt', '.backgroundWorkWait.capturedAt',
      '.backgroundWorkWait.jobs[].startedAt', '.backgroundWorkWait.jobs[].finishedAt', '.backgroundWorkWait.jobs[].stages[].startedAt'].includes(path)) {
      return publicAuditTimestamp(value) ?? alias(value);
    }
    if (path === '.sessionId' && typeof value === 'string') return performanceAuditReference(value);
    if (typeof value === 'string' && ['.backgroundWorkWait.jobs[].label', '.backgroundWorkWait.jobs[].stage', '.backgroundWorkWait.jobs[].stages[].label'].includes(path) && AUDIT_WORKER_TEXT.has(value)) return value;
    if (typeof value === 'string' && PUBLICATION_DATE_PATHS.has(path) && publicationDate(value)) return value;
    if (typeof value === 'string' && publicPlanText(path, value)) return value;
    if (path === '.routeAggregates[].journeyId' && typeof value === 'string') {
      const checkId = `journey-${value}-cold`;
      return safeCheckId(checkId) === checkId ? value : alias(value);
    }
    if (typeof value === 'string' && (parent === '.coverage' && /CheckIds$/.test(key) || path === '.summary.slowestCheckId')) return safeCheckId(value) ?? alias(value);
    if (path === '.checks[].id' && typeof value === 'string') return safeCheckId(value) ?? alias(value);
    if (privateField.test(key) || ['currentPayloadRevision', 'deepSearchEnabled', 'historyExplorerEnabled', 'includeNonStandard', 'depositRankMetric', 'mortgageRateMetric', 'enabledSections', 'account', 'totalMemoryBytes'].includes(key) || /(?:password|secret|authorization|credential|privateKey|api[_-]?key|token|accountNumber|accountId|customerId|borrower|email|balance|amount|lvr)/i.test(key) ||
      typeof value === 'string' && /(?:revision|path|url)/i.test(key)) return alias(value);
    if (typeof value === 'string') {
      if (parent === '.checks[].metrics' && (key === 'missingAssets' && missingAssetList(value, ',') ||
        key === 'availabilityEvidence' && value.startsWith('Optional assets are not cached: ') && missingAssetList(value.slice('Optional assets are not cached: '.length), ', '))) return value;
      if (parent === '.checks[].metrics' && (key === 'reason' && (publicPlanText('.plan.passes[].steps[].skipReason', value) || publicPlanText('.plan.passes[].steps[].skipSafety.reason', value)) ||
        key === 'skipSafety' && publicPlanText('.plan.passes[].steps[].skipSafety.reason', value))) return value;
      if (parent === '.checks[].diagnostic.readiness.surfaces[]' && ['actions', 'lastCompletedAction'].includes(key)) {
        return AUDIT_REGISTERED_ACTION_IDS.has(value) || publicPlanText('.plan.passes[].steps[].semanticActionId', value) || value === ANDROID_UPDATE_READINESS_AUDIT.semanticActionId ? value : alias(value);
      }
      if (parent === '.checks[].metrics' && ['installedVersion', 'installedBuild', 'remoteVersion', 'remoteBuild', 'cachedBuild'].includes(key) && /^\d+(?:\.\d+){0,3}$/.test(value) && value.length <= 32) return value;
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
  const stallTimeout = stallTimeoutFields(report.watchdog.hangTimeoutMs);
  if (retained.watchdog && typeof retained.watchdog === 'object' && !Array.isArray(retained.watchdog)) {
    Object.assign(retained.watchdog, stallTimeout);
  }
  if (Array.isArray(retained.checks)) {
    retained.checks = retained.checks.map((check, index) => {
      const reason = publicAuditFailureReason(report.checks[index], report.watchdog.hangTimeoutMs);
      return reason && check && typeof check === 'object' ? { ...check, failureReason: reason } : check;
    });
  }
  const health = report.appHealth != null
    ? hasValidPerformanceAuditHealth(report) ? toPublicAppHealthReport(report.appHealth) : visit(report.appHealth, 'appHealth', '.appHealth')
    : null;
  const annotatedHealth = health && typeof health === 'object' && !Array.isArray(health) && Array.isArray((health as { checks?: unknown }).checks)
    ? { ...health, checks: (health as { checks: unknown[] }).checks.map((check, index) => {
      const reason = publicHealthFailureReason(report.appHealth!.checks[index] ?? {});
      return reason && check && typeof check === 'object' ? { ...check, failureReason: reason } : check;
    }) }
    : health;
  // This dedicated sanitizer owns a complete public schema; do not obscure its
  // quality counts or findings through a second, unrelated schema boundary.
  return { ...retained, appHealth: annotatedHealth };
}
