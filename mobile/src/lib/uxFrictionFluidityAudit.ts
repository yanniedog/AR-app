import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { buildPerformanceAuditCompletion, hasValidPerformanceAuditHealth } from './performanceAuditCompletion';
import { auditMetricValues, auditTaskOutcomePopulation, hasAuditActionDurationEvidence, hasAuditReturnEvidence, measuredAuditCount, measuredAuditValue } from './auditMetricHistoryValues';

export const AFFS_PILLAR_WEIGHTS = Object.freeze({
  interactionFriction: 0.40,
  standardsAndAccessibility: 0.30,
  fluidityAndResponsiveness: 0.30,
} as const);

export const AFFS_TASK_FRICTION_WEIGHTS = Object.freeze({
  taskSuccess: 0.30,
  errorRetryPerformance: 0.20,
  pathEfficiency: 0.20,
  responseTimeEfficiency: 0.15,
  waitingInterruptionPerformance: 0.15,
} as const);

export const UX_AUDIT_STANDARDS = Object.freeze({
  usabilityDefinition: 'ISO 9241-11:2018',
  usabilityOutcomes: Object.freeze(['effectiveness', 'efficiency', 'satisfaction'] as const),
  interactionPrinciples: 'ISO 9241-110:2020',
  interactionPrincipleIds: Object.freeze([
    'suitability-for-task',
    'self-descriptiveness',
    'conformity-with-expectations',
    'learnability',
    'controllability',
    'use-error-robustness',
    'user-engagement',
  ] as const),
  usabilityReporting: 'ISO 25062:2025',
  accessibility: 'WCAG 2.2',
  actRulesFormat: '1.1',
  wcagAaMinTargetCssPx: 24,
  iosMinTargetPt: 44,
  androidMinTargetDp: 48,
  androidFrozenFrameMs: 700,
  coreWebVitalsPercentile: 75,
  inpGoodMs: 200,
  inpPoorMs: 500,
  lcpGoodMs: 2_500,
  lcpPoorMs: 4_000,
  clsGood: 0.1,
  clsPoor: 0.25,
  iosHitchGoodMsPerS: 5,
  iosHitchPoorMsPerS: 10,
} as const);

export type AffsOperationalBand =
  | 'exemplary'
  | 'strong'
  | 'moderate-friction'
  | 'material-friction'
  | 'high-friction';

export type TaskComparatorKind = 'product-target' | 'best-known-path' | 'historical-baseline';
export type FrictionDimension = 'intrinsic' | 'performance' | 'cognitive';

export interface TaskFrictionInput {
  taskId: string;
  completed: boolean | null;
  functionalFailure?: boolean;
  minimumJustifiedActions: number | null;
  observedActions: number | null;
  errors?: number | null;
  retries?: number | null;
  validationFailures?: number | null;
  backtracks?: number | null;
  repeatedFields?: number | null;
  scrollDetours?: number | null;
  modalInterruptions?: number | null;
  observedResponseMs: number | null;
  targetResponseMs: number | null;
  comparatorKind?: TaskComparatorKind;
  avoidableWaitMs?: number | null;
  maxAvoidableWaitBudgetMs?: number;
  probeDefects?: number | null;
}

export interface TaskFrictionEvaluation {
  taskId: string;
  score: number | null;
  components: {
    taskSuccess: number | null;
    errorRetryPerformance: number | null;
    pathEfficiency: number | null;
    responseTimeEfficiency: number | null;
    waitingInterruptionPerformance: number | null;
  };
  comparatorKind: TaskComparatorKind;
  minimumJustifiedActions: number | null;
  observedActions: number | null;
  observedResponseMs: number | null;
  targetResponseMs: number | null;
  frictionTaxonomy: {
    intrinsicExtraActions: number | null;
    performanceOverrunMs: number | null;
    cognitiveProbeFlags: number;
    requiresHumanComprehensionReview: true;
  };
}

export interface StandardsCheckBreakdown {
  applicableChecks: number;
  passed: number;
  failed: number;
  requiresManualReview: number;
  unavailable: number;
  automatedConformityClaimed: false;
}

export interface WebVitalsTelemetryInput {
  inpP75Ms?: number | null;
  lcpP75Ms?: number | null;
  clsP75?: number | null;
}

export interface AndroidFluidityTelemetryInput {
  refreshRateHz?: number | null;
  frameOverrunP95Ms?: number | null;
  frameOverrunP99Ms?: number | null;
  jankPercent?: number | null;
  frozenFrameCount?: number | null;
  totalFrameCount?: number | null;
  inputLatencyP95Ms?: number | null;
}

export interface IosFluidityTelemetryInput {
  hitchTimeRatioMsPerS?: number | null;
  scrollTransitionP95Ms?: number | null;
}

export interface SusEvaluation {
  score: number;
  isPercentage: false;
  benchmarkBand: 'strong' | 'average' | 'below-average';
  referenceAverage: 68;
  referenceStrong: 80;
}

export interface UmuxLiteEvaluation {
  rawScore: number;
  susApproximation: number;
  isPercentage: false;
  scalePoints: number;
}

export interface SeqTaskSummary {
  taskId: string;
  n: number;
  meanRating: number;
  minRating: number;
  maxRating: number;
}

export interface HumanUxValidationLayer {
  status: 'not-performed' | 'completed';
  humanValidationClaimed: boolean;
  participantCount: number | null;
  sus: SusEvaluation | null;
  umuxLite: UmuxLiteEvaluation | null;
  seqTasks: SeqTaskSummary[];
  nasaTlxScore: number | null;
}

export interface UxAuditFinding {
  pillar: 'interaction-friction' | 'standards-accessibility' | 'fluidity-responsiveness';
  dimension: FrictionDimension | 'accessibility-standard';
  code:
    | 'avoidable-interactions'
    | 'task-functional-failure'
    | 'navigation-recovery-required'
    | 'latency-over-budget'
    | 'js-event-loop-stall'
    | 'js-frame-gap-overrun'
    | 'native-frame-deadline-overrun'
    | 'native-frozen-frames'
    | 'cwv-inp-over-threshold'
    | 'cwv-lcp-over-threshold'
    | 'cwv-cls-over-threshold'
    | 'ios-hitch-ratio-over-threshold'
    | 'standards-check-failed'
    | 'target-probe-defect';
  severity: 'high' | 'medium';
  count: number;
  valueMs?: number;
  checkId?: string | null;
}

export interface UxFrictionFluidityAudit {
  schemaVersion: 1;
  proprietaryComposite: true;
  validatedUsabilityScaleClaimed: false;
  houseThresholds: true;
  normativeCutoffsClaimed: false;
  standards: {
    usabilityDefinition: typeof UX_AUDIT_STANDARDS.usabilityDefinition;
    interactionPrinciples: typeof UX_AUDIT_STANDARDS.interactionPrinciples;
    usabilityReporting: typeof UX_AUDIT_STANDARDS.usabilityReporting;
    accessibility: typeof UX_AUDIT_STANDARDS.accessibility;
    actRulesFormat: typeof UX_AUDIT_STANDARDS.actRulesFormat;
  };
  weights: typeof AFFS_PILLAR_WEIGHTS;
  affsScore: number | null;
  band: AffsOperationalBand | null;
  pillars: {
    interactionFriction: {
      score: number | null;
      weight: 0.40;
      evaluatedTaskCount: number;
      completedTaskCount: number;
      meanPathEfficiency: number | null;
      meanResponseTimeEfficiency: number | null;
      taskFormulaWeights: typeof AFFS_TASK_FRICTION_WEIGHTS;
      taxonomyTotals: {
        intrinsicExtraActions: number;
        performanceOverrunChecks: number;
        cognitiveProbeFlags: number;
      };
    };
    standardsAndAccessibility: {
      score: number | null;
      weight: 0.30;
      wcagSummary: StandardsCheckBreakdown;
    };
    fluidityAndResponsiveness: {
      score: number | null;
      weight: 0.30;
      telemetryKind: 'js-runtime-callbacks' | 'android-native-frame-trace' | 'core-web-vitals-p75' | 'ios-hitch-ratio' | 'unmeasured';
      nativeFrameDeadlineMeasured: boolean;
      components: {
        inpScore: number | null;
        lcpScore: number | null;
        clsScore: number | null;
        iosHitchScore: number | null;
        androidFrameScore: number | null;
        jsRuntimeScore: number | null;
      };
    };
  };
  evidenceCoverage: {
    mode: 'local' | 'live-source' | 'unknown';
    representativeTaskCount: number;
    executedJourneyCount: number;
    viewportWidth: number | null;
    fontScale: number | null;
    platform: string | null;
  };
  humanValidation: HumanUxValidationLayer;
  findings: UxAuditFinding[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round3 = (value: number): number => Math.round(value * 1_000) / 1_000;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));

export function classifyAffsBand(score: number | null): AffsOperationalBand | null {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return null;
  if (score >= 90) return 'exemplary';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'moderate-friction';
  if (score >= 60) return 'material-friction';
  return 'high-friction';
}

/**
 * Operational path efficiency: min(1, minimum justified actions / observed actions).
 * Zero-tap arrival tasks (minimumJustifiedActions === 0) achieve 1.0 only when observedActions === 0.
 */
export function calculatePathEfficiency(
  minimumJustifiedActions: number | null | undefined,
  observedActions: number | null | undefined,
): number | null {
  const minActions = measuredAuditCount(minimumJustifiedActions);
  const obsActions = measuredAuditCount(observedActions);
  if (minActions === null || obsActions === null) return null;
  if (minActions === 0) return obsActions === 0 ? 1 : 0;
  if (obsActions === 0) return null;
  return round3(Math.min(1, minActions / obsActions));
}

export function evaluateTargetSizing(input: {
  width: number;
  height: number;
  platform: 'web-wcag-aa' | 'ios-hig' | 'android';
}): { passes: boolean; minimumRequired: number; observedMinDimension: number } {
  const minimumRequired = input.platform === 'web-wcag-aa'
    ? UX_AUDIT_STANDARDS.wcagAaMinTargetCssPx
    : input.platform === 'ios-hig'
      ? UX_AUDIT_STANDARDS.iosMinTargetPt
      : UX_AUDIT_STANDARDS.androidMinTargetDp;
  const observedMinDimension = Math.min(input.width, input.height);
  return {
    passes: Number.isFinite(observedMinDimension) && observedMinDimension >= minimumRequired,
    minimumRequired,
    observedMinDimension,
  };
}

/** Piecewise linear mapping anchored to externally defined Good / Needs Improvement / Poor thresholds. */
function scorePiecewiseThreshold(value: number | null | undefined, goodLimit: number, poorLimit: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value <= goodLimit) {
    return round1(100 - (value / goodLimit) * 20);
  }
  if (value <= poorLimit) {
    return round1(80 - ((value - goodLimit) / (poorLimit - goodLimit)) * 30);
  }
  return round1(clamp100(50 - ((value - poorLimit) / poorLimit) * 50));
}

export function scoreWebVitalInp(inpP75Ms: number | null | undefined): number | null {
  return scorePiecewiseThreshold(inpP75Ms, UX_AUDIT_STANDARDS.inpGoodMs, UX_AUDIT_STANDARDS.inpPoorMs);
}

export function scoreWebVitalLcp(lcpP75Ms: number | null | undefined): number | null {
  return scorePiecewiseThreshold(lcpP75Ms, UX_AUDIT_STANDARDS.lcpGoodMs, UX_AUDIT_STANDARDS.lcpPoorMs);
}

export function scoreWebVitalCls(clsP75: number | null | undefined): number | null {
  return scorePiecewiseThreshold(clsP75, UX_AUDIT_STANDARDS.clsGood, UX_AUDIT_STANDARDS.clsPoor);
}

export function scoreIosHitchRatio(hitchMsPerS: number | null | undefined): number | null {
  return scorePiecewiseThreshold(hitchMsPerS, UX_AUDIT_STANDARDS.iosHitchGoodMsPerS, UX_AUDIT_STANDARDS.iosHitchPoorMsPerS);
}

export function androidFrameDeadlineMs(refreshRateHz: number | null | undefined): number | null {
  if (typeof refreshRateHz !== 'number' || !Number.isFinite(refreshRateHz) || refreshRateHz <= 0) return null;
  return 1_000 / refreshRateHz;
}

export function scoreAndroidNativeFluidity(input: AndroidFluidityTelemetryInput): number | null {
  const parts: number[] = [];
  const deadline = androidFrameDeadlineMs(input.refreshRateHz ?? 60);
  if (deadline !== null && typeof input.frameOverrunP95Ms === 'number' && Number.isFinite(input.frameOverrunP95Ms)) {
    const overrun = Math.max(0, input.frameOverrunP95Ms);
    parts.push(scorePiecewiseThreshold(overrun, deadline * 0.25, deadline) ?? 0);
  }
  if (typeof input.jankPercent === 'number' && Number.isFinite(input.jankPercent) && input.jankPercent >= 0 && input.jankPercent <= 100) {
    parts.push(scorePiecewiseThreshold(input.jankPercent, 2, 10) ?? 0);
  }
  if (typeof input.inputLatencyP95Ms === 'number' && Number.isFinite(input.inputLatencyP95Ms) && input.inputLatencyP95Ms >= 0) {
    parts.push(scorePiecewiseThreshold(input.inputLatencyP95Ms, 100, 250) ?? 0);
  }
  if (!parts.length) return null;
  let score = parts.reduce((sum, item) => sum + item, 0) / parts.length;
  const frozen = measuredAuditCount(input.frozenFrameCount);
  if (frozen !== null && frozen > 0) {
    score = Math.max(0, score - Math.min(40, frozen * 15));
  }
  return round1(score);
}

/**
 * Standard 10-item System Usability Scale (Brooke, 1996).
 * Each item is scored 1..5. Resulting 0..100 score is a composite scale, not a percentage.
 */
export function scoreSusQuestionnaire(items: readonly number[]): SusEvaluation | null {
  if (!Array.isArray(items) || items.length !== 10) return null;
  if (!items.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 1 && item <= 5)) return null;
  let sum = 0;
  for (let index = 0; index < 10; index++) {
    sum += index % 2 === 0 ? items[index] - 1 : 5 - items[index];
  }
  const score = round1(sum * 2.5);
  return {
    score,
    isPercentage: false,
    benchmarkBand: score >= 80 ? 'strong' : score >= 68 ? 'average' : 'below-average',
    referenceAverage: 68,
    referenceStrong: 80,
  };
}

/**
 * Two-item UMUX-Lite questionnaire (Lewis et al., CHI 2013).
 * Computes both the raw 0..100 scale and the regression SUS approximation.
 */
export function scoreUmuxLiteQuestionnaire(
  meetsRequirements: number,
  easyToUse: number,
  scalePoints: 5 | 7 = 7,
): UmuxLiteEvaluation | null {
  if (
    typeof meetsRequirements !== 'number' || !Number.isFinite(meetsRequirements)
    || typeof easyToUse !== 'number' || !Number.isFinite(easyToUse)
    || meetsRequirements < 1 || meetsRequirements > scalePoints
    || easyToUse < 1 || easyToUse > scalePoints
  ) {
    return null;
  }
  const rawScore = round1(((meetsRequirements + easyToUse - 2) / ((scalePoints - 1) * 2)) * 100);
  const susApproximation = round1(0.65 * rawScore + 22.9);
  return { rawScore, susApproximation, isPercentage: false, scalePoints };
}

/** Post-task Single Ease Question (SEQ, Sauro & Dumas, CHI 2009) on a 1..7 scale. */
export function summarizeSeqTaskRatings(
  ratings: readonly { taskId: string; rating: number }[],
): SeqTaskSummary[] {
  const grouped = new Map<string, number[]>();
  for (const item of ratings) {
    if (!item?.taskId || typeof item.rating !== 'number' || !Number.isFinite(item.rating) || item.rating < 1 || item.rating > 7) {
      continue;
    }
    const list = grouped.get(item.taskId) ?? [];
    list.push(item.rating);
    grouped.set(item.taskId, list);
  }
  return [...grouped.entries()].map(([taskId, values]) => ({
    taskId,
    n: values.length,
    meanRating: round1(values.reduce((sum, val) => sum + val, 0) / values.length),
    minRating: Math.min(...values),
    maxRating: Math.max(...values),
  }));
}

export function scoreTaskInteractionFriction(input: TaskFrictionInput): TaskFrictionEvaluation {
  const comparatorKind = input.comparatorKind ?? 'product-target';
  const taskSuccess = input.completed === null
    ? null
    : input.completed && input.functionalFailure !== true ? 1 : 0;
  const pathEfficiency = calculatePathEfficiency(input.minimumJustifiedActions, input.observedActions);
  const errorEvents = [input.errors, input.retries, input.validationFailures, input.backtracks]
    .map(val => measuredAuditCount(val ?? 0));
  const errorRetryPerformance = errorEvents.some(val => val === null)
    ? null
    : round3(clamp01(1 / (1 + errorEvents.reduce<number>((sum, val) => sum + (val ?? 0), 0))));
  const obsResponse = measuredAuditValue(input.observedResponseMs);
  const targetResponse = measuredAuditValue(input.targetResponseMs);
  const responseTimeEfficiency = obsResponse === null || targetResponse === null || targetResponse <= 0
    ? null
    : obsResponse <= targetResponse
      ? 1
      : round3(clamp01(targetResponse / obsResponse));
  const waitMs = measuredAuditValue(input.avoidableWaitMs ?? 0);
  const interruptions = measuredAuditCount(input.modalInterruptions ?? 0);
  const waitBudget = typeof input.maxAvoidableWaitBudgetMs === 'number' && input.maxAvoidableWaitBudgetMs > 0
    ? input.maxAvoidableWaitBudgetMs
    : 1_000;
  const waitingInterruptionPerformance = waitMs === null || interruptions === null
    ? null
    : round3(clamp01(1 - (waitMs / waitBudget) - interruptions * 0.25));

  const allMeasured = taskSuccess !== null && errorRetryPerformance !== null
    && pathEfficiency !== null && responseTimeEfficiency !== null && waitingInterruptionPerformance !== null;
  const composite01 = allMeasured
    ? AFFS_TASK_FRICTION_WEIGHTS.taskSuccess * taskSuccess
      + AFFS_TASK_FRICTION_WEIGHTS.errorRetryPerformance * errorRetryPerformance
      + AFFS_TASK_FRICTION_WEIGHTS.pathEfficiency * pathEfficiency
      + AFFS_TASK_FRICTION_WEIGHTS.responseTimeEfficiency * responseTimeEfficiency
      + AFFS_TASK_FRICTION_WEIGHTS.waitingInterruptionPerformance * waitingInterruptionPerformance
    : null;

  const minActions = measuredAuditCount(input.minimumJustifiedActions);
  const obsActions = measuredAuditCount(input.observedActions);
  const extraActions = minActions !== null && obsActions !== null
    ? Math.max(0, obsActions - minActions)
      + (measuredAuditCount(input.repeatedFields ?? 0) ?? 0)
      + (measuredAuditCount(input.scrollDetours ?? 0) ?? 0)
    : null;
  const overrunMs = obsResponse !== null && targetResponse !== null
    ? round1(Math.max(0, obsResponse - targetResponse) + (waitMs ?? 0))
    : null;

  return {
    taskId: input.taskId,
    score: composite01 !== null ? round1(composite01 * 100) : null,
    components: {
      taskSuccess,
      errorRetryPerformance,
      pathEfficiency,
      responseTimeEfficiency,
      waitingInterruptionPerformance,
    },
    comparatorKind,
    minimumJustifiedActions: minActions,
    observedActions: obsActions,
    observedResponseMs: obsResponse,
    targetResponseMs: targetResponse,
    frictionTaxonomy: {
      intrinsicExtraActions: extraActions,
      performanceOverrunMs: overrunMs,
      cognitiveProbeFlags: measuredAuditCount(input.probeDefects ?? 0) ?? 0,
      requiresHumanComprehensionReview: true,
    },
  };
}

function evaluateReportTaskJourney(
  check: AuditCheck,
  defectCheckIds: ReadonlySet<string>,
): TaskFrictionEvaluation {
  const isRoundTrip = hasAuditReturnEvidence(check) && !hasAuditActionDurationEvidence(check);
  const minActions = isRoundTrip ? 2 : 1;
  const recoveryOccurred = ['replaceRecoveryMs', 'anchorResetMs']
    .some(key => (measuredAuditValue(check.metrics[key]) ?? 0) > 0);
  const secondBack = (measuredAuditValue(check.metrics.secondBackMs) ?? 0) > 0;
  const observedActions = minActions + (recoveryOccurred ? 1 : 0);
  const completed = check.metrics.actionInvoked === true
    ? typeof check.metrics.actionCompleted === 'boolean' && typeof check.metrics.nonTimingFailure === 'boolean'
      && check.diagnostic?.readiness?.ready === true && !defectCheckIds.has(check.id)
      ? check.metrics.actionCompleted && !check.metrics.nonTimingFailure
      : check.metrics.actionCompleted === false || check.metrics.nonTimingFailure === true
        ? false
        : null
    : check.status !== 'skipped'
      ? check.status !== 'fail' || check.metrics.nonTimingFailure === false
      : null;
  const observedResponseMs = hasAuditActionDurationEvidence(check)
    ? measuredAuditValue(check.metrics.actionMs) ?? measuredAuditValue(check.metrics.forwardWorkMs)
    : measuredAuditValue(check.metrics.forwardWorkMs) ?? measuredAuditValue(check.metrics.forwardMs);
  const targetResponseMs = hasAuditActionDurationEvidence(check) ? 250 : 400;
  const preWaitMs = measuredAuditValue(check.metrics.preActionWaitMs) ?? 0;
  const waitAvoided = check.metrics.preActionQuietWindowReused === true;
  const backgroundSettleMs = check.metrics.backgroundUnsettled === true
    ? measuredAuditValue(check.metrics.backgroundSettleMs) ?? 250
    : 0;
  return scoreTaskInteractionFriction({
    taskId: check.id,
    completed,
    functionalFailure: check.metrics.nonTimingFailure === true || check.metrics.actionCompleted === false,
    minimumJustifiedActions: minActions,
    observedActions,
    errors: measuredAuditCount(check.metrics.runtimeErrors) ?? 0,
    retries: recoveryOccurred ? 1 : 0,
    backtracks: recoveryOccurred && secondBack ? 1 : 0,
    observedResponseMs,
    targetResponseMs,
    comparatorKind: 'product-target',
    avoidableWaitMs: (waitAvoided ? 0 : preWaitMs) + backgroundSettleMs,
    maxAvoidableWaitBudgetMs: 1_500,
    probeDefects: defectCheckIds.has(check.id) ? 1 : 0,
  });
}

export function evaluateReportTaskJourneys(
  report: PerformanceAuditReport,
  completion = buildPerformanceAuditCompletion(report),
  safeCheckId: (value: string) => string | null = id => id,
): TaskFrictionEvaluation[] {
  const { actions } = auditTaskOutcomePopulation(report, completion);
  const journeys = report.checks.filter(
    check => check.kind === 'journey' && check.status !== 'skipped'
      && check.metrics.executionAttempted !== false && check.metrics.availabilityFailure !== true,
  );
  const taskChecks = actions.length > 0 ? actions : journeys;
  const defectCheckIds = new Set(
    completion.gapPositions
      .filter(gap => gap.source === 'performance' && typeof gap.checkId === 'string')
      .map(gap => gap.checkId!),
  );
  return taskChecks.map(check => {
    const evaluated = evaluateReportTaskJourney(check, defectCheckIds);
    return { ...evaluated, taskId: safeCheckId(evaluated.taskId) ?? 'redacted-task' };
  });
}

function evaluateStandardsPillar(report: PerformanceAuditReport): {
  score: number | null;
  wcagSummary: StandardsCheckBreakdown;
  findings: UxAuditFinding[];
} {
  const health = hasValidPerformanceAuditHealth(report) ? report.appHealth : undefined;
  const displayCodes = [
    'display-contract',
    'display-model',
    'display-list',
    'display-visible',
    'display-layout',
    'display-chart',
    'display-empty-state',
    'display-logo',
  ] as const;
  let applicableChecks = 0;
  let passed = 0;
  let failed = 0;
  let requiresManualReview = 0;
  let unavailable = 0;
  const findings: UxAuditFinding[] = [];

  for (const code of displayCodes) {
    const matches = health?.checks.filter(item => item.code === code) ?? [];
    if (matches.length !== 1) continue;
    const check = matches[0];
    if (check.metrics.partial === true || ['not-run', 'unavailable'].includes(check.status)) {
      unavailable += 1;
      continue;
    }
    if (code === 'display-contract') {
      const planned = measuredAuditCount(check.metrics.plannedSurfaces);
      const missing = measuredAuditCount(check.metrics.missingSurfaces);
      const duplicates = measuredAuditCount(check.metrics.duplicateContracts);
      if (planned !== null && missing !== null && duplicates === 0 && planned >= missing) {
        applicableChecks += planned;
        passed += planned - missing;
        failed += missing;
        if (missing > 0) {
          findings.push({
            pillar: 'standards-accessibility',
            dimension: 'accessibility-standard',
            code: 'standards-check-failed',
            severity: 'high',
            count: missing,
            checkId: code,
          });
        }
      }
      continue;
    }
    const checked = measuredAuditCount(check.metrics.checked);
    const missing = measuredAuditCount(check.metrics.missing);
    const checkFailed = measuredAuditCount(check.metrics.failed);
    const warned = measuredAuditCount(check.metrics.warned);
    const checkUnavailable = measuredAuditCount(check.metrics.unavailable);
    if (
      checked === null || missing === null || checkFailed === null
      || warned === null || checkUnavailable === null
      || checked < checkFailed + warned + checkUnavailable
    ) {
      unavailable += 1;
      continue;
    }
    const total = checked + missing;
    const checkPassed = checked - checkFailed - warned - checkUnavailable;
    const totalFailed = checkFailed + missing;
    applicableChecks += total;
    passed += checkPassed;
    failed += totalFailed;
    requiresManualReview += warned;
    unavailable += checkUnavailable;
    if (totalFailed > 0) {
      findings.push({
        pillar: 'standards-accessibility',
        dimension: 'accessibility-standard',
        code: 'standards-check-failed',
        severity: code === 'display-layout' || code === 'display-visible' ? 'high' : 'medium',
        count: totalFailed,
        checkId: code,
      });
    }
  }

  // Cognitive comprehension, visual design and full WCAG 2.2 manual criteria always require manual review.
  if (applicableChecks > 0 && requiresManualReview === 0) {
    requiresManualReview = 1;
  }

  const resolved = passed + failed;
  const score = applicableChecks > 0 && resolved > 0 && unavailable === 0
    ? round1(clamp100((passed / applicableChecks) * 100))
    : null;

  return {
    score,
    wcagSummary: {
      applicableChecks,
      passed,
      failed,
      requiresManualReview,
      unavailable,
      automatedConformityClaimed: false,
    },
    findings,
  };
}

export function buildUxFrictionFluidityAudit(
  report: PerformanceAuditReport,
  completion = buildPerformanceAuditCompletion(report),
  options?: {
    safeCheckId?: (value: string) => string | null;
    webVitals?: WebVitalsTelemetryInput;
    androidFluidity?: AndroidFluidityTelemetryInput;
    iosFluidity?: IosFluidityTelemetryInput;
    humanValidation?: Partial<HumanUxValidationLayer>;
  },
): UxFrictionFluidityAudit {
  const sanitizeId = options?.safeCheckId ?? ((id: string) => id);
  const values = auditMetricValues(report, completion);
  const journeys = report.checks.filter(
    check => check.kind === 'journey' && check.status !== 'skipped'
      && check.metrics.executionAttempted !== false && check.metrics.availabilityFailure !== true,
  );
  const evaluatedTasks = evaluateReportTaskJourneys(report, completion, sanitizeId);
  const measuredTasks = evaluatedTasks.filter(task => task.score !== null);
  const interactionFrictionScore = measuredTasks.length > 0 && measuredTasks.length === evaluatedTasks.length
    ? round1(measuredTasks.reduce((sum, task) => sum + task.score!, 0) / measuredTasks.length)
    : null;
  const completedTaskCount = evaluatedTasks.filter(task => task.components.taskSuccess === 1).length;
  const pathEfficiencies = evaluatedTasks
    .map(task => task.components.pathEfficiency)
    .filter((val): val is number => val !== null);
  const meanPathEfficiency = pathEfficiencies.length > 0
    ? round3(pathEfficiencies.reduce((sum, val) => sum + val, 0) / pathEfficiencies.length)
    : null;
  const responseEfficiencies = evaluatedTasks
    .map(task => task.components.responseTimeEfficiency)
    .filter((val): val is number => val !== null);
  const meanResponseTimeEfficiency = responseEfficiencies.length > 0
    ? round3(responseEfficiencies.reduce((sum, val) => sum + val, 0) / responseEfficiencies.length)
    : null;

  const intrinsicExtraActions = evaluatedTasks.reduce(
    (sum, task) => sum + (task.frictionTaxonomy.intrinsicExtraActions ?? 0),
    0,
  );
  const performanceOverrunChecks = evaluatedTasks.filter(
    task => (task.frictionTaxonomy.performanceOverrunMs ?? 0) > 0,
  ).length;
  const cognitiveProbeFlags = completion.gaps.targetProbeDefects;

  const standards = evaluateStandardsPillar(report);

  const inpScore = scoreWebVitalInp(options?.webVitals?.inpP75Ms);
  const lcpScore = scoreWebVitalLcp(options?.webVitals?.lcpP75Ms);
  const clsScore = scoreWebVitalCls(options?.webVitals?.clsP75);
  const iosHitchScore = scoreIosHitchRatio(options?.iosFluidity?.hitchTimeRatioMsPerS);
  const androidFrameScore = options?.androidFluidity ? scoreAndroidNativeFluidity(options.androidFluidity) : null;

  let jsRuntimeScore: number | null = null;
  if (values.jsStallPercent !== null && values.slowFramePercent !== null) {
    const stallScore = Math.max(0, 100 - values.jsStallPercent * 2.5);
    const frameScore = Math.max(0, 100 - values.slowFramePercent * 2.5);
    const lagPenalty = values.maxEventLoopLagMs !== null && values.maxEventLoopLagMs > 100
      ? Math.min(30, (values.maxEventLoopLagMs - 100) / 15)
      : 0;
    const gapPenalty = values.maxFrameGapMs !== null && values.maxFrameGapMs > 50
      ? Math.min(30, (values.maxFrameGapMs - 50) / 15)
      : 0;
    jsRuntimeScore = round1(clamp100((stallScore + frameScore) / 2 - (lagPenalty + gapPenalty) / 2));
  }

  const cwvScores = [inpScore, lcpScore, clsScore].filter((val): val is number => val !== null);
  const cwvComposite = cwvScores.length > 0
    ? round1(cwvScores.reduce((sum, val) => sum + val, 0) / cwvScores.length)
    : null;

  const telemetryKind = androidFrameScore !== null
    ? 'android-native-frame-trace'
    : cwvComposite !== null
      ? 'core-web-vitals-p75'
      : iosHitchScore !== null
        ? 'ios-hitch-ratio'
        : jsRuntimeScore !== null
          ? 'js-runtime-callbacks'
          : 'unmeasured';

  const fluidityScore = androidFrameScore ?? cwvComposite ?? iosHitchScore ?? jsRuntimeScore;

  const affsScore = interactionFrictionScore !== null && standards.score !== null && fluidityScore !== null
    ? round1(
      AFFS_PILLAR_WEIGHTS.interactionFriction * interactionFrictionScore
      + AFFS_PILLAR_WEIGHTS.standardsAndAccessibility * standards.score
      + AFFS_PILLAR_WEIGHTS.fluidityAndResponsiveness * fluidityScore,
    )
    : null;

  const findings: UxAuditFinding[] = [];
  if (intrinsicExtraActions > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'intrinsic',
      code: 'avoidable-interactions',
      severity: 'medium',
      count: intrinsicExtraActions,
    });
  }
  const failedTasks = evaluatedTasks.filter(task => task.components.taskSuccess === 0);
  if (failedTasks.length > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'intrinsic',
      code: 'task-functional-failure',
      severity: 'high',
      count: failedTasks.length,
      checkId: failedTasks[0].taskId === 'redacted-task' ? null : failedTasks[0].taskId,
    });
  }
  const timingFailureCount = completion.failurePositions.filter(item => item.category === 'timing').length;
  if (timingFailureCount > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'performance',
      code: 'latency-over-budget',
      severity: 'high',
      count: timingFailureCount,
      ...(values.slowestCheckMs !== null ? { valueMs: values.slowestCheckMs } : {}),
    });
  }
  if (cognitiveProbeFlags > 0) {
    findings.push({
      pillar: 'standards-accessibility',
      dimension: 'cognitive',
      code: 'target-probe-defect',
      severity: 'high',
      count: cognitiveProbeFlags,
    });
  }
  findings.push(...standards.findings);
  if (values.maxEventLoopLagMs !== null && values.maxEventLoopLagMs > 100) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'js-event-loop-stall',
      severity: values.maxEventLoopLagMs > 300 ? 'high' : 'medium',
      count: 1,
      valueMs: values.maxEventLoopLagMs,
    });
  }
  if (values.maxFrameGapMs !== null && values.maxFrameGapMs > 50) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'js-frame-gap-overrun',
      severity: values.maxFrameGapMs > 250 ? 'high' : 'medium',
      count: 1,
      valueMs: values.maxFrameGapMs,
    });
  }
  if ((options?.webVitals?.inpP75Ms ?? 0) > UX_AUDIT_STANDARDS.inpGoodMs) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'cwv-inp-over-threshold',
      severity: (options?.webVitals?.inpP75Ms ?? 0) > UX_AUDIT_STANDARDS.inpPoorMs ? 'high' : 'medium',
      count: 1,
      valueMs: options!.webVitals!.inpP75Ms!,
    });
  }
  if ((options?.iosFluidity?.hitchTimeRatioMsPerS ?? 0) >= UX_AUDIT_STANDARDS.iosHitchGoodMsPerS) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'ios-hitch-ratio-over-threshold',
      severity: (options?.iosFluidity?.hitchTimeRatioMsPerS ?? 0) > UX_AUDIT_STANDARDS.iosHitchPoorMsPerS ? 'high' : 'medium',
      count: 1,
      valueMs: options!.iosFluidity!.hitchTimeRatioMsPerS!,
    });
  }
  if ((options?.androidFluidity?.frozenFrameCount ?? 0) > 0) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'native-frozen-frames',
      severity: 'high',
      count: options!.androidFluidity!.frozenFrameCount!,
    });
  }

  const humanCompleted = options?.humanValidation?.status === 'completed';
  const humanValidation: HumanUxValidationLayer = {
    status: humanCompleted ? 'completed' : 'not-performed',
    humanValidationClaimed: humanCompleted,
    participantCount: humanCompleted ? measuredAuditCount(options?.humanValidation?.participantCount) : null,
    sus: humanCompleted ? options?.humanValidation?.sus ?? null : null,
    umuxLite: humanCompleted ? options?.humanValidation?.umuxLite ?? null : null,
    seqTasks: humanCompleted ? options?.humanValidation?.seqTasks ?? [] : [],
    nasaTlxScore: humanCompleted ? measuredAuditValue(options?.humanValidation?.nasaTlxScore) : null,
  };

  return {
    schemaVersion: 1,
    proprietaryComposite: true,
    validatedUsabilityScaleClaimed: false,
    houseThresholds: true,
    normativeCutoffsClaimed: false,
    standards: {
      usabilityDefinition: UX_AUDIT_STANDARDS.usabilityDefinition,
      interactionPrinciples: UX_AUDIT_STANDARDS.interactionPrinciples,
      usabilityReporting: UX_AUDIT_STANDARDS.usabilityReporting,
      accessibility: UX_AUDIT_STANDARDS.accessibility,
      actRulesFormat: UX_AUDIT_STANDARDS.actRulesFormat,
    },
    weights: AFFS_PILLAR_WEIGHTS,
    affsScore,
    band: classifyAffsBand(affsScore),
    pillars: {
      interactionFriction: {
        score: interactionFrictionScore,
        weight: AFFS_PILLAR_WEIGHTS.interactionFriction,
        evaluatedTaskCount: evaluatedTasks.length,
        completedTaskCount,
        meanPathEfficiency,
        meanResponseTimeEfficiency,
        taskFormulaWeights: AFFS_TASK_FRICTION_WEIGHTS,
        taxonomyTotals: {
          intrinsicExtraActions,
          performanceOverrunChecks,
          cognitiveProbeFlags,
        },
      },
      standardsAndAccessibility: {
        score: standards.score,
        weight: AFFS_PILLAR_WEIGHTS.standardsAndAccessibility,
        wcagSummary: standards.wcagSummary,
      },
      fluidityAndResponsiveness: {
        score: fluidityScore,
        weight: AFFS_PILLAR_WEIGHTS.fluidityAndResponsiveness,
        telemetryKind,
        nativeFrameDeadlineMeasured: telemetryKind === 'android-native-frame-trace' || telemetryKind === 'ios-hitch-ratio',
        components: {
          inpScore,
          lcpScore,
          clsScore,
          iosHitchScore,
          androidFrameScore,
          jsRuntimeScore,
        },
      },
    },
    evidenceCoverage: {
      mode: report.appHealth?.mode === 'local' || report.appHealth?.mode === 'live-source'
        ? report.appHealth.mode
        : 'unknown',
      representativeTaskCount: evaluatedTasks.length,
      executedJourneyCount: journeys.length,
      viewportWidth: measuredAuditValue(report.environment.viewportWidth),
      fontScale: measuredAuditValue(report.environment.fontScale),
      platform: typeof report.environment.platform === 'string' ? report.environment.platform : null,
    },
    humanValidation,
    findings,
  };
}
