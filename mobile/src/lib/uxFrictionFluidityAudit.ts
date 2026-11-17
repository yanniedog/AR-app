import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import {
  buildPerformanceAuditCompletion,
  buildPlannedStepMetadataMap,
  hasValidPerformanceAuditHealth,
  isJustifiedAvailabilitySkip,
} from './performanceAuditCompletion';
import { auditCoreMetricValues, auditTaskOutcomePopulation, hasAuditActionDurationEvidence, hasAuditReturnEvidence, measuredAuditCount, measuredAuditValue } from './auditMetricHistoryValues';
import { hasCompleteAndroidFrameCapture, hasCompleteAuditTargetSampleCapture, validAndroidFrameSegments } from './auditUxTelemetryCoverage';

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
const TARGET_ROLES = ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'adjustable', 'menuitem'] as const;
type AuditTargetRole = typeof TARGET_ROLES[number] | 'unclassified';

export interface TargetSizeSampleInput {
  id?: string;
  /** Equivalent measured layout events; not distinct controls or participants. */
  layoutObservations?: number;
  width: number;
  height: number;
  platform: 'web-wcag-aa' | 'ios-hig' | 'android';
  role?: string;
}

export interface WcagActChecksInput {
  passed: number;
  failed: number;
  requiresManualReview?: number;
  unavailable?: number;
}

export interface TaskFrictionInput {
  taskId: string;
  completed: boolean | null;
  functionalFailure?: boolean;
  minimumJustifiedActions: number | null;
  observedActions: number | null;
  errors: number | null;
  retries: number | null;
  validationFailures: number | null;
  backtracks: number | null;
  repeatedFields: number | null;
  scrollDetours: number | null;
  modalInterruptions: number | null;
  observedResponseMs: number | null;
  targetResponseMs: number | null;
  observedForwardResponseMs?: number | null;
  targetForwardResponseMs?: number | null;
  observedReturnResponseMs?: number | null;
  targetReturnResponseMs?: number | null;
  comparatorKind?: TaskComparatorKind;
  avoidableWaitMs: number | null;
  maxAvoidableWaitBudgetMs?: number;
  strictOverrunBudget?: boolean;
  probeDefects?: number | null;
}

export interface TaskFrictionEvaluation {
  taskId: string;
  /** Normalized per-task friction F_t in [0, 1]; converted to score = round1(100 * (1 - frictionIndex)). */
  frictionIndex: number | null;
  score: number | null;
  components: {
    taskSuccess: number | null;
    errorRetryPerformance: number | null;
    pathEfficiency: number | null;
    responseTimeEfficiency: number | null;
    waitingInterruptionPerformance: number | null;
  };
  frictionComponents: {
    taskFailure: number | null;
    errorRetry: number | null;
    stepExcess: number | null;
    responseDelay: number | null;
    waitingInterruption: number | null;
  };
  comparatorKind: TaskComparatorKind;
  minimumJustifiedActions: number | null;
  observedActions: number | null;
  observedResponseMs: number | null;
  targetResponseMs: number | null;
  observedReturnResponseMs: number | null;
  targetReturnResponseMs: number | null;
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
  /** Count of frames exceeding UX_AUDIT_STANDARDS.androidFrozenFrameMs (700 ms). */
  frozenFrameCount?: number | null;
  /** Individual candidate frozen-frame durations in ms; filtered against >= 700 ms. */
  frozenFrameDurationsMs?: readonly number[] | null;
  /** Maximum observed frozen-frame duration in ms; must be >= 700 ms when frozenFrameCount > 0. */
  maxFrozenFrameMs?: number | null;
  totalFrameCount?: number | null;
  inputLatencyP95Ms?: number | null;
}

export interface IosFluidityTelemetryInput {
  hitchTimeRatioMsPerS?: number | null;
  scrollTransitionP95Ms?: number | null;
}

type AndroidFrameCaptureFailure = 'start-unavailable' | 'interrupted' | 'no-samples'
  | 'dropped-callbacks' | 'drop-count-unavailable';

export interface AndroidFrameSegmentCoverage {
  attempted: number;
  observed: number;
  frames: number;
  droppedFrames?: number;
  deadlineFrames?: number;
}

export interface AuditTargetCaptureCoverage {
  capacityReached: boolean;
  aggregation?: 'control-state-geometry';
  auditStartControlsMeasured?: boolean;
}

export interface UxFrictionFluidityTelemetryOptions {
  safeCheckId?: (value: string) => string | null;
  webVitals?: WebVitalsTelemetryInput;
  androidFluidity?: AndroidFluidityTelemetryInput;
  androidFrameCapture?: AndroidFrameCaptureFailure | 'collected';
  androidFrameSegments?: AndroidFrameSegmentCoverage;
  iosFluidity?: IosFluidityTelemetryInput;
  targetSamples?: readonly TargetSizeSampleInput[] | null;
  targetCapture?: AuditTargetCaptureCoverage;
  wcagActChecks?: WcagActChecksInput | null;
  humanValidation?: Partial<HumanUxValidationLayer>;
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
    | 'task-evidence-incomplete'
    | 'target-sample-capacity'
    | 'navigation-recovery-required'
    | 'latency-over-budget'
    | 'task-latency-overrun'
    | 'js-event-loop-stall'
    | 'js-frame-gap-overrun'
    | 'native-frame-deadline-overrun'
    | 'native-frame-jank'
    | 'native-input-latency'
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
  valueMsPerS?: number;
  value?: number;
  unit?: 'ms' | 'ms-per-s' | 'unitless' | 'percent';
  checkId?: string | null;
  checkIds?: (string | null)[];
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
      scoredTaskCount: number;
      observedTaskMeanScore: number | null;
      completedTaskCount: number;
      taskOutcomes?: { success: number; failure: number; indeterminate: number; unavailable: number };
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
      surfaceContractSummary: StandardsCheckBreakdown;
      targetSampleCoverage?: { scope: 'press-feedback-layout'; retained: number; capacityReached: boolean;
        auditStartControlsMeasured: boolean; aggregation?: 'control-state-geometry'; layoutObservations?: number };
      targetSizingByRole?: Partial<Record<AuditTargetRole, Pick<StandardsCheckBreakdown, 'passed' | 'failed' | 'unavailable'>>>;
      surfaceChecks?: Record<string, StandardsCheckBreakdown>;
    };
    fluidityAndResponsiveness: {
      score: number | null;
      weight: 0.30;
      telemetryKind: 'js-runtime-callbacks' | 'android-native-frame-trace' | 'core-web-vitals-p75' | 'ios-hitch-ratio' | 'unmeasured';
      nativeFrameDeadlineMeasured: boolean;
      androidFrameCapture: AndroidFrameCaptureFailure | 'observed' | 'invalid' | 'unknown' | 'not-applicable';
      androidFrameSegments?: AndroidFrameSegmentCoverage;
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
    platform: 'android' | 'ios' | 'web' | null;
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

const TARGET_SIZING_MINIMUMS = Object.freeze({
  'web-wcag-aa': UX_AUDIT_STANDARDS.wcagAaMinTargetCssPx,
  'ios-hig': UX_AUDIT_STANDARDS.iosMinTargetPt,
  android: UX_AUDIT_STANDARDS.androidMinTargetDp,
} as const);

export function evaluateTargetSizing(input: {
  width: number;
  height: number;
  platform: 'web-wcag-aa' | 'ios-hig' | 'android';
}): { passes: boolean; minimumRequired: number; observedMinDimension: number } {
  if (
    !input
    || typeof input !== 'object'
    || Array.isArray(input)
    || !Object.prototype.hasOwnProperty.call(TARGET_SIZING_MINIMUMS, input.platform)
  ) {
    return { passes: false, minimumRequired: UX_AUDIT_STANDARDS.wcagAaMinTargetCssPx, observedMinDimension: Number.NaN };
  }
  const minimumRequired = TARGET_SIZING_MINIMUMS[input.platform];
  if (typeof input.width !== 'number' || typeof input.height !== 'number' || !Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    return { passes: false, minimumRequired, observedMinDimension: Number.NaN };
  }
  const observedMinDimension = Math.min(input.width, input.height);
  return {
    passes: observedMinDimension >= minimumRequired,
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

function resolveThresholdQualifiedFrozenFrames(input: AndroidFluidityTelemetryInput | undefined): {
  qualifiedCount: number | null;
  maxFrozenMs: number | null;
} {
  if (!input) return { qualifiedCount: 0, maxFrozenMs: null };
  if (Array.isArray(input.frozenFrameDurationsMs)) {
    const valid = input.frozenFrameDurationsMs.filter(
      (ms): ms is number => typeof ms === 'number' && Number.isFinite(ms) && ms >= 0,
    );
    if (valid.length !== input.frozenFrameDurationsMs.length) {
      return { qualifiedCount: null, maxFrozenMs: null };
    }
    const overThreshold = valid.filter(ms => ms >= UX_AUDIT_STANDARDS.androidFrozenFrameMs);
    return {
      qualifiedCount: overThreshold.length,
      maxFrozenMs: overThreshold.length > 0 ? Math.max(...overThreshold) : null,
    };
  }
  if (input.frozenFrameCount === undefined) {
    return { qualifiedCount: 0, maxFrozenMs: null };
  }
  const count = measuredAuditCount(input.frozenFrameCount);
  if (count === null) return { qualifiedCount: null, maxFrozenMs: null };
  if (count === 0) return { qualifiedCount: 0, maxFrozenMs: null };
  const maxFrozenMs = measuredAuditValue(input.maxFrozenFrameMs);
  if (maxFrozenMs === null || maxFrozenMs < UX_AUDIT_STANDARDS.androidFrozenFrameMs) {
    return { qualifiedCount: null, maxFrozenMs: null };
  }
  return { qualifiedCount: count, maxFrozenMs };
}

const measuredSignedAuditValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function scoreAndroidNativeFluidity(input: AndroidFluidityTelemetryInput): number | null {
  const deadline = androidFrameDeadlineMs(input.refreshRateHz);
  const signedOverrun = measuredSignedAuditValue(input.frameOverrunP95Ms);
  // Refresh-rate-derived frame deadline and P95 frame overrun are required for native frame scoring.
  if (deadline === null || signedOverrun === null) {
    return null;
  }
  const overrun = Math.max(0, signedOverrun);
  const parts: number[] = [
    scorePiecewiseThreshold(overrun, deadline * 0.25, deadline) ?? 0,
  ];
  if (input.jankPercent !== undefined) {
    if (typeof input.jankPercent !== 'number' || !Number.isFinite(input.jankPercent) || input.jankPercent < 0 || input.jankPercent > 100) {
      return null;
    }
    parts.push(scorePiecewiseThreshold(input.jankPercent, 2, 10) ?? 0);
  }
  if (input.inputLatencyP95Ms !== undefined) {
    const latency = measuredAuditValue(input.inputLatencyP95Ms);
    if (latency === null) return null;
    parts.push(scorePiecewiseThreshold(latency, 100, 250) ?? 0);
  }
  const frozen = resolveThresholdQualifiedFrozenFrames(input);
  if (frozen.qualifiedCount === null) return null;
  let score = parts.reduce((sum, item) => sum + item, 0) / parts.length;
  if (frozen.qualifiedCount > 0) {
    score = Math.max(0, score - Math.min(40, frozen.qualifiedCount * 15));
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

function scoreResponsePhase(observedMs: unknown, targetMs: unknown): { efficiency: number | null; overrunMs: number | null } {
  const obs = measuredAuditValue(observedMs);
  const target = measuredAuditValue(targetMs);
  if (obs === null || target === null || target <= 0) return { efficiency: null, overrunMs: null };
  return {
    efficiency: obs <= target ? 1 : round3(clamp01(target / obs)),
    overrunMs: Math.max(0, obs - target),
  };
}

export function scoreTaskInteractionFriction(input: TaskFrictionInput): TaskFrictionEvaluation {
  const comparatorKind = input.comparatorKind ?? 'product-target';
  const taskSuccess = input.completed === null
    ? null
    : input.completed && input.functionalFailure !== true ? 1 : 0;

  const minActions = measuredAuditCount(input.minimumJustifiedActions);
  const obsActions = measuredAuditCount(input.observedActions);
  const repeatedFields = measuredAuditCount(input.repeatedFields);
  const scrollDetours = measuredAuditCount(input.scrollDetours);
  const pathEfficiency = repeatedFields !== null && scrollDetours !== null
    ? calculatePathEfficiency(minActions, obsActions)
    : null;

  const errorEvents = [input.errors, input.retries, input.validationFailures, input.backtracks]
    .map(val => measuredAuditCount(val));
  const errorRetryPerformance = errorEvents.some(val => val === null)
    ? null
    : round3(clamp01(1 / (1 + errorEvents.reduce<number>((sum, val) => sum + val!, 0))));

  const obsResponse = measuredAuditValue(input.observedResponseMs);
  const targetResponse = measuredAuditValue(input.targetResponseMs);
  const primaryPhase = scoreResponsePhase(obsResponse, targetResponse);

  const hasForwardPhase = input.observedForwardResponseMs !== undefined || input.targetForwardResponseMs !== undefined;
  const forwardPhase = hasForwardPhase
    ? scoreResponsePhase(input.observedForwardResponseMs, input.targetForwardResponseMs)
    : { efficiency: 1, overrunMs: 0 };

  const hasReturnExpectation = input.observedReturnResponseMs !== undefined || input.targetReturnResponseMs !== undefined;
  const obsReturn = hasReturnExpectation ? measuredAuditValue(input.observedReturnResponseMs) : null;
  const targetReturn = hasReturnExpectation ? measuredAuditValue(input.targetReturnResponseMs) : null;
  const returnPhase = hasReturnExpectation
    ? scoreResponsePhase(obsReturn, targetReturn)
    : { efficiency: 1, overrunMs: 0 };

  const responseTimeEfficiency = primaryPhase.efficiency === null
    || forwardPhase.efficiency === null
    || returnPhase.efficiency === null
    ? null
    : round3(Math.min(primaryPhase.efficiency, forwardPhase.efficiency, returnPhase.efficiency));

  const waitMs = measuredAuditValue(input.avoidableWaitMs);
  const interruptions = measuredAuditCount(input.modalInterruptions);
  const waitBudget = typeof input.maxAvoidableWaitBudgetMs === 'number' && input.maxAvoidableWaitBudgetMs > 0
    ? input.maxAvoidableWaitBudgetMs
    : 1_000;
  const waitingInterruptionPerformance = waitMs === null || interruptions === null
    ? null
    : round3(clamp01(1 - (waitMs / waitBudget) - interruptions * 0.25));

  const taskFailureFriction = taskSuccess !== null ? round3(1 - taskSuccess) : null;
  const errorRetryFriction = errorRetryPerformance !== null ? round3(1 - errorRetryPerformance) : null;
  const stepExcessFriction = pathEfficiency !== null ? round3(1 - pathEfficiency) : null;
  const responseDelayFriction = responseTimeEfficiency !== null ? round3(1 - responseTimeEfficiency) : null;
  const waitingInterruptionFriction = waitingInterruptionPerformance !== null ? round3(1 - waitingInterruptionPerformance) : null;

  const allMeasured = taskFailureFriction !== null && errorRetryFriction !== null
    && stepExcessFriction !== null && responseDelayFriction !== null && waitingInterruptionFriction !== null;
  const frictionIndex = allMeasured
    ? round3(
      AFFS_TASK_FRICTION_WEIGHTS.taskSuccess * taskFailureFriction
      + AFFS_TASK_FRICTION_WEIGHTS.errorRetryPerformance * errorRetryFriction
      + AFFS_TASK_FRICTION_WEIGHTS.pathEfficiency * stepExcessFriction
      + AFFS_TASK_FRICTION_WEIGHTS.responseTimeEfficiency * responseDelayFriction
      + AFFS_TASK_FRICTION_WEIGHTS.waitingInterruptionPerformance * waitingInterruptionFriction,
    )
    : null;

  const extraActions = minActions !== null && obsActions !== null && repeatedFields !== null && scrollDetours !== null
    ? Math.max(0, obsActions - minActions) + repeatedFields + scrollDetours
    : null;
  const overrunMs = primaryPhase.overrunMs !== null
    && forwardPhase.overrunMs !== null
    && returnPhase.overrunMs !== null
    && waitMs !== null
    ? round1(input.strictOverrunBudget
      ? Math.max(primaryPhase.overrunMs, forwardPhase.overrunMs) + returnPhase.overrunMs + Math.max(0, waitMs - waitBudget)
      : primaryPhase.overrunMs + forwardPhase.overrunMs + returnPhase.overrunMs + waitMs)
    : null;

  return {
    taskId: input.taskId,
    frictionIndex,
    score: frictionIndex !== null ? round1(100 * (1 - frictionIndex)) : null,
    components: {
      taskSuccess,
      errorRetryPerformance,
      pathEfficiency,
      responseTimeEfficiency,
      waitingInterruptionPerformance,
    },
    frictionComponents: {
      taskFailure: taskFailureFriction,
      errorRetry: errorRetryFriction,
      stepExcess: stepExcessFriction,
      responseDelay: responseDelayFriction,
      waitingInterruption: waitingInterruptionFriction,
    },
    comparatorKind,
    minimumJustifiedActions: minActions,
    observedActions: obsActions,
    observedResponseMs: obsResponse,
    targetResponseMs: targetResponse,
    observedReturnResponseMs: obsReturn,
    targetReturnResponseMs: targetReturn,
    frictionTaxonomy: {
      intrinsicExtraActions: extraActions,
      performanceOverrunMs: overrunMs,
      cognitiveProbeFlags: measuredAuditCount(input.probeDefects) ?? 0,
      requiresHumanComprehensionReview: true,
    },
  };
}

function evaluateReportTaskJourney(
  check: AuditCheck,
  defectCheckIds: ReadonlySet<string>,
  measuredOutcome?: 'success' | 'failure' | 'indeterminate',
): TaskFrictionEvaluation {
  const hasReturn = hasAuditReturnEvidence(check);
  const completed = check.metrics.actionInvoked === true
    ? typeof check.metrics.actionCompleted === 'boolean' && typeof check.metrics.nonTimingFailure === 'boolean'
      ? check.metrics.actionCompleted
        && !check.metrics.nonTimingFailure
        && check.diagnostic?.readiness?.ready === true
        && !defectCheckIds.has(check.id)
      : check.metrics.actionCompleted === false || check.metrics.nonTimingFailure === true
        ? false
        : null
    : null;
  const isSemanticAction = hasAuditActionDurationEvidence(check);
  const actionMs = isSemanticAction ? measuredAuditValue(check.metrics.actionMs) : null;
  const forwardPhaseMs = measuredAuditValue(check.metrics.forwardWorkMs) ?? measuredAuditValue(check.metrics.forwardMs);
  const observedResponseMs = isSemanticAction ? actionMs : forwardPhaseMs;
  const targetResponseMs = measuredAuditValue(check.metrics.targetResponseMs)
    ?? (isSemanticAction ? 250 : 400);

  const explicitWait = measuredAuditValue(check.metrics.avoidableWaitMs);
  const preWaitMs = measuredAuditValue(check.metrics.preActionWaitMs);
  const waitAvoided = check.metrics.preActionQuietWindowReused === true;
  const settleInvalid = check.metrics.backgroundUnsettled === true
    && measuredAuditValue(check.metrics.backgroundSettleMs) === null;
  const backgroundSettleMs = check.metrics.backgroundUnsettled === true
    ? measuredAuditValue(check.metrics.backgroundSettleMs) ?? 0
    : 0;
  const avoidableWaitMs = settleInvalid
    ? null
    : explicitWait !== null
      ? explicitWait
      : preWaitMs !== null
        ? (waitAvoided ? 0 : preWaitMs) + backgroundSettleMs
        : null;

  return scoreTaskInteractionFriction({
    taskId: check.id,
    completed: measuredOutcome === 'success' ? true : measuredOutcome === 'failure' ? false
      : measuredOutcome === 'indeterminate' ? null : completed,
    functionalFailure: measuredOutcome === undefined
      ? check.metrics.nonTimingFailure === true || check.metrics.actionCompleted === false
      : measuredOutcome === 'failure',
    minimumJustifiedActions: measuredAuditCount(check.metrics.minimumJustifiedActions),
    observedActions: measuredAuditCount(check.metrics.observedActions),
    errors: measuredAuditCount(check.metrics.runtimeErrors),
    retries: measuredAuditCount(check.metrics.retries),
    validationFailures: measuredAuditCount(check.metrics.validationFailures),
    backtracks: measuredAuditCount(check.metrics.backtracks),
    repeatedFields: measuredAuditCount(check.metrics.repeatedFields),
    scrollDetours: measuredAuditCount(check.metrics.scrollDetours),
    modalInterruptions: measuredAuditCount(check.metrics.modalInterruptions),
    observedResponseMs,
    targetResponseMs,
    ...(isSemanticAction
      ? {
        observedForwardResponseMs: forwardPhaseMs,
        targetForwardResponseMs: measuredAuditValue(check.metrics.targetForwardResponseMs) ?? 400,
      }
      : {}),
    ...(hasReturn && (measuredAuditValue(check.metrics.backMs) !== null || check.metrics.actionCompleted !== false || forwardPhaseMs !== null)
      ? {
        observedReturnResponseMs: measuredAuditValue(check.metrics.backMs),
        targetReturnResponseMs: measuredAuditValue(check.metrics.targetBackResponseMs) ?? 400,
      }
      : {}),
    comparatorKind: 'product-target',
    avoidableWaitMs,
    maxAvoidableWaitBudgetMs: 1_500,
    strictOverrunBudget: measuredOutcome !== undefined,
    probeDefects: defectCheckIds.has(check.id) ? 1 : 0,
  });
}

function selectRequiredReportJourneys(report: PerformanceAuditReport): AuditCheck[] {
  const planSteps = buildPlannedStepMetadataMap(report.plan);
  return report.checks.filter(
    check => check.kind === 'journey' && !isJustifiedAvailabilitySkip(check, planSteps.get(check.id)?.optional === true),
  );
}

export function evaluateReportTaskJourneys(
  report: PerformanceAuditReport,
  completion = buildPerformanceAuditCompletion(report),
  safeCheckId: (value: string) => string | null = id => id,
): TaskFrictionEvaluation[] {
  const journeys = selectRequiredReportJourneys(report);
  const idCounts = new Map<string, number>();
  for (const check of journeys) {
    idCounts.set(check.id, (idCounts.get(check.id) ?? 0) + 1);
  }
  const defectCheckIds = new Set(
    completion.gapPositions
      .filter(gap => gap.source === 'performance' && typeof gap.checkId === 'string')
      .map(gap => gap.checkId!),
  );
  const outcome = report.auditEvidenceVersion === 2 ? auditTaskOutcomePopulation(report, completion) : null;
  const successful = outcome ? new Set(outcome.success) : null;
  const failed = outcome ? new Set(outcome.failure) : null;
  return journeys.map(check => {
    const isUnavailable = check.status === 'skipped'
      || check.metrics.executionAttempted === false
      || check.metrics.availabilityFailure === true;
    if (isUnavailable) {
      return scoreTaskInteractionFriction({
        taskId: safeCheckId(check.id) ?? 'redacted-task',
        completed: null,
        minimumJustifiedActions: null,
        observedActions: null,
        errors: null,
        retries: null,
        validationFailures: null,
        backtracks: null,
        repeatedFields: null,
        scrollDetours: null,
        modalInterruptions: null,
        observedResponseMs: null,
        targetResponseMs: null,
        comparatorKind: 'product-target',
        avoidableWaitMs: null,
        maxAvoidableWaitBudgetMs: 1_500,
        probeDefects: defectCheckIds.has(check.id) ? 1 : 0,
      });
    }
    const evaluated = evaluateReportTaskJourney(check, defectCheckIds,
      successful?.has(check) ? 'success' : failed?.has(check) ? 'failure' : outcome ? 'indeterminate' : undefined);
    const isDuplicate = (idCounts.get(check.id) ?? 0) > 1;
    return {
      ...evaluated,
      ...(isDuplicate ? { frictionIndex: null, score: null } : {}),
      taskId: safeCheckId(evaluated.taskId) ?? 'redacted-task',
    };
  });
}

function evaluateStandardsPillar(
  report: PerformanceAuditReport,
  options?: UxFrictionFluidityTelemetryOptions,
): {
  score: number | null;
  wcagSummary: StandardsCheckBreakdown;
  surfaceContractSummary: StandardsCheckBreakdown;
  surfaceChecks: Record<string, StandardsCheckBreakdown>;
  targetSizingByRole: Partial<Record<AuditTargetRole, Pick<StandardsCheckBreakdown, 'passed' | 'failed' | 'unavailable'>>>;
  findings: UxAuditFinding[];
} {
  const health = hasValidPerformanceAuditHealth(report) ? report.appHealth : undefined;
  const healthIdentitiesValid = health != null
    && health.coverage.complete === true
    && health.coverage.duplicateStoredCheckIds.length === 0
    && health.coverage.unexpectedStoredCheckIds.length === 0
    && new Set(health.checks.map(check => check.id)).size === health.checks.length;
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

  let surfaceApplicable = 0;
  let surfacePassed = 0;
  let surfaceFailed = 0;
  let surfaceManual = 0;
  let surfaceUnavailable = 0;
  const findings: UxAuditFinding[] = [];
  const surfaceChecks: Record<string, StandardsCheckBreakdown> = {};
  const recordSurfaceCheck = (code: string, applicableChecks: number, passed: number, failed: number,
    requiresManualReview: number, unavailable: number) => {
    surfaceChecks[code] = { applicableChecks, passed, failed, requiresManualReview, unavailable, automatedConformityClaimed: false };
  };

  for (const code of displayCodes) {
    const matches = health?.checks.filter(item => item.code === code) ?? [];
    if (matches.length !== 1) {
      surfaceUnavailable += 1;
      recordSurfaceCheck(code, 0, 0, 0, 0, 1);
      continue;
    }
    const check = matches[0];
    if (check.metrics.partial === true || ['not-run', 'unavailable'].includes(check.status)) {
      surfaceUnavailable += 1;
      recordSurfaceCheck(code, 0, 0, 0, 0, 1);
      continue;
    }
    if (code === 'display-contract') {
      const planned = measuredAuditCount(check.metrics.plannedSurfaces);
      const missing = measuredAuditCount(check.metrics.missingSurfaces);
      const duplicateContracts = measuredAuditCount(check.metrics.duplicateContracts);
      const duplicateObservations = check.metrics.duplicateObservations === undefined
        ? 0
        : measuredAuditCount(check.metrics.duplicateObservations);
      const unexpectedSurfaces = check.metrics.unexpectedSurfaces === undefined
        ? 0
        : measuredAuditCount(check.metrics.unexpectedSurfaces);
      if (
        planned === null || missing === null || duplicateContracts === null
        || duplicateObservations === null || unexpectedSurfaces === null
        || planned < missing
      ) {
        surfaceUnavailable += 1;
        recordSurfaceCheck(code, 0, 0, 0, 0, 1);
        continue;
      }
      const rawDefects = missing + duplicateContracts + duplicateObservations + unexpectedSurfaces;
      const contractDefects = check.status === 'fail' && rawDefects === 0 ? 1 : rawDefects;
      const total = planned + unexpectedSurfaces + duplicateContracts + duplicateObservations;
      const boundedFailed = Math.min(total, contractDefects);
      surfaceApplicable += total;
      surfacePassed += Math.max(0, total - boundedFailed);
      surfaceFailed += boundedFailed;
      const manual = check.status === 'warn' && boundedFailed === 0 ? 1 : 0;
      surfaceManual += manual;
      recordSurfaceCheck(code, total, Math.max(0, total - boundedFailed), boundedFailed, manual, 0);
      if (contractDefects > 0) {
        findings.push({
          pillar: 'standards-accessibility',
          dimension: 'accessibility-standard',
          code: 'standards-check-failed',
          severity: 'high',
          count: contractDefects,
          checkId: code,
        });
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
      surfaceUnavailable += 1;
      recordSurfaceCheck(code, 0, 0, 0, 0, 1);
      continue;
    }
    const total = checked + missing;
    const checkPassed = checked - checkFailed - warned - checkUnavailable;
    const totalFailed = checkFailed + missing;
    surfaceApplicable += total;
    surfacePassed += checkPassed;
    surfaceFailed += totalFailed;
    surfaceManual += warned;
    surfaceUnavailable += checkUnavailable;
    recordSurfaceCheck(code, total, checkPassed, totalFailed, warned, checkUnavailable);
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

  let wcagApplicable = 0;
  let wcagPassed = 0;
  let wcagFailed = 0;
  let wcagManual = 0;
  let wcagUnavailable = 0;

  const targetSamples = options?.targetSamples;
  const targetSizingByRole: Partial<Record<AuditTargetRole, Pick<StandardsCheckBreakdown, 'passed' | 'failed' | 'unavailable'>>> = {};
  if (Array.isArray(targetSamples) && targetSamples.length > 0) {
    let targetFailures = 0;
    for (const sample of targetSamples) {
      const evaluated = evaluateTargetSizing(sample);
      const role = TARGET_ROLES.find(candidate => candidate === sample?.role) ?? 'unclassified';
      const roleCounts = targetSizingByRole[role] ??= { passed: 0, failed: 0, unavailable: 0 };
      if (!Number.isFinite(evaluated.observedMinDimension) || evaluated.observedMinDimension <= 0) {
        wcagUnavailable += 1;
        roleCounts.unavailable += 1;
      } else if (evaluated.passes) {
        wcagApplicable += 1;
        wcagPassed += 1;
        roleCounts.passed += 1;
      } else {
        wcagApplicable += 1;
        wcagFailed += 1;
        targetFailures += 1;
        roleCounts.failed += 1;
      }
    }
    if (targetFailures > 0) {
      findings.push({
        pillar: 'standards-accessibility',
        dimension: 'accessibility-standard',
        code: 'standards-check-failed',
        severity: 'high',
        count: targetFailures,
        checkId: 'target-size',
      });
    }
  }

  const actInput = options?.wcagActChecks;
  if (actInput) {
    const actPassed = measuredAuditCount(actInput.passed);
    const actFailed = measuredAuditCount(actInput.failed);
    const actManual = actInput.requiresManualReview === undefined ? 0 : measuredAuditCount(actInput.requiresManualReview);
    const actUnavailable = actInput.unavailable === undefined ? 0 : measuredAuditCount(actInput.unavailable);
    if (actPassed === null || actFailed === null || actManual === null || actUnavailable === null) {
      wcagUnavailable += 1;
    } else {
      wcagApplicable += actPassed + actFailed + actManual + actUnavailable;
      wcagPassed += actPassed;
      wcagFailed += actFailed;
      wcagManual += actManual;
      wcagUnavailable += actUnavailable;
      if (actFailed > 0) {
        findings.push({
          pillar: 'standards-accessibility',
          dimension: 'accessibility-standard',
          code: 'standards-check-failed',
          severity: 'high',
          count: actFailed,
          checkId: 'wcag-act',
        });
      }
    }
  }

  if (wcagApplicable === 0 && wcagUnavailable === 0) {
    wcagUnavailable = 1;
  }
  if (wcagManual === 0) {
    wcagManual = 1;
  }

  const totalApplicable = surfaceApplicable + wcagApplicable;
  const totalPassed = surfacePassed + wcagPassed;
  const totalUnavailable = surfaceUnavailable + wcagUnavailable;
  const scoredSurfaceChecks = Object.values(surfaceChecks).filter(check => check.applicableChecks > 0);
  const surfaceMean = scoredSurfaceChecks.length > 0
    ? scoredSurfaceChecks.reduce((total, check) => total + check.passed / check.applicableChecks, 0) / scoredSurfaceChecks.length
    : null;
  const evidenceV2 = report.auditEvidenceVersion === 2;
  const score = healthIdentitiesValid
    && surfaceApplicable > 0
    && wcagApplicable > 0
    && totalUnavailable === 0
    && (!evidenceV2 || hasCompleteAuditTargetSampleCapture(options) && surfaceMean !== null)
    ? round1(clamp100(evidenceV2 && surfaceMean !== null
      ? 50 * (surfaceMean + wcagPassed / wcagApplicable)
      : (totalPassed / totalApplicable) * 100))
    : null;

  return {
    score,
    surfaceChecks,
    targetSizingByRole,
    wcagSummary: {
      applicableChecks: wcagApplicable,
      passed: wcagPassed,
      failed: wcagFailed,
      requiresManualReview: wcagManual,
      unavailable: wcagUnavailable,
      automatedConformityClaimed: false,
    },
    surfaceContractSummary: {
      applicableChecks: surfaceApplicable,
      passed: surfacePassed,
      failed: surfaceFailed,
      requiresManualReview: surfaceManual,
      unavailable: surfaceUnavailable,
      automatedConformityClaimed: false,
    },
    findings,
  };
}

const ALLOWED_ENVIRONMENT_PLATFORMS = new Set<'android' | 'ios' | 'web'>(['android', 'ios', 'web']);

export function buildUxFrictionFluidityAudit(
  report: PerformanceAuditReport,
  completion = buildPerformanceAuditCompletion(report),
  options?: UxFrictionFluidityTelemetryOptions,
): UxFrictionFluidityAudit {
  const resolvedOptions: UxFrictionFluidityTelemetryOptions | undefined = options
    ? { ...report.uxTelemetry, ...options }
    : report.uxTelemetry;
  const evidenceV2 = report.auditEvidenceVersion === 2;
  const sanitizeId = resolvedOptions?.safeCheckId ?? ((id: string) => id);
  const values = auditCoreMetricValues(report, completion);
  const journeys = selectRequiredReportJourneys(report);
  const validCoverage = completion.gaps.invalidCoverageReports === 0 ? report.coverage : undefined;
  const duplicateCoverageIds = Array.isArray(validCoverage?.duplicateStoredCheckIds) ? validCoverage.duplicateStoredCheckIds : [];
  const missingCoverageIds = Array.isArray(validCoverage?.missingPlannedCheckIds) ? validCoverage.missingPlannedCheckIds : [];
  const unexpectedCoverageIds = Array.isArray(validCoverage?.unexpectedStoredCheckIds) ? validCoverage.unexpectedStoredCheckIds : [];
  const hasDuplicateCheckIds = new Set(report.checks.map(check => check.id)).size !== report.checks.length
    || duplicateCoverageIds.length > 0
    || completion.gaps.duplicateChecks > 0;
  const collectionComplete = (!evidenceV2 || completion.collectionComplete)
    && completion.gaps.invalidCoverageReports === 0
    && !hasDuplicateCheckIds
    && missingCoverageIds.length === 0
    && unexpectedCoverageIds.length === 0
    && completion.gaps.missingChecks === 0
    && completion.gaps.unexpectedChecks === 0;

  const evaluatedTasks = evaluateReportTaskJourneys(report, completion, sanitizeId);
  const measuredTasks = evaluatedTasks.filter(task => task.score !== null);
  const observedTaskMeanScore = measuredTasks.length > 0
    ? round1(measuredTasks.reduce((sum, task) => sum + task.score!, 0) / measuredTasks.length)
    : null;
  const interactionFrictionScore = collectionComplete
    && measuredTasks.length === evaluatedTasks.length
    ? observedTaskMeanScore
    : null;
  const completedTaskCount = evaluatedTasks.filter(task => task.components.taskSuccess === 1).length;
  const pathEfficiencies = evaluatedTasks
    .map(task => task.components.pathEfficiency)
    .filter((val): val is number => val !== null);
  const meanPathEfficiency = pathEfficiencies.length > 0 && pathEfficiencies.length === evaluatedTasks.length
    ? round3(pathEfficiencies.reduce((sum, val) => sum + val, 0) / pathEfficiencies.length)
    : null;
  const responseEfficiencies = evaluatedTasks
    .map(task => task.components.responseTimeEfficiency)
    .filter((val): val is number => val !== null);
  const meanResponseTimeEfficiency = responseEfficiencies.length > 0 && responseEfficiencies.length === evaluatedTasks.length
    ? round3(responseEfficiencies.reduce((sum, val) => sum + val, 0) / responseEfficiencies.length)
    : null;

  const intrinsicExtraActions = evaluatedTasks.reduce(
    (sum, task) => sum + (task.frictionTaxonomy.intrinsicExtraActions ?? 0),
    0,
  );
  const overrunTasks = evaluatedTasks.filter(
    task => (task.frictionTaxonomy.performanceOverrunMs ?? 0) > 0,
  );
  const performanceOverrunChecks = overrunTasks.length;
  const cognitiveProbeFlags = completion.gaps.targetProbeDefects;

  const standards = evaluateStandardsPillar(report, resolvedOptions);

  const inpScore = scoreWebVitalInp(resolvedOptions?.webVitals?.inpP75Ms);
  const lcpScore = scoreWebVitalLcp(resolvedOptions?.webVitals?.lcpP75Ms);
  const clsScore = scoreWebVitalCls(resolvedOptions?.webVitals?.clsP75);
  const iosHitchScore = scoreIosHitchRatio(resolvedOptions?.iosFluidity?.hitchTimeRatioMsPerS);
  const androidFrameSegments = validAndroidFrameSegments(resolvedOptions?.androidFrameSegments);
  const androidFrameScore = resolvedOptions?.androidFluidity && (!evidenceV2 || hasCompleteAndroidFrameCapture(resolvedOptions))
    ? scoreAndroidNativeFluidity(resolvedOptions.androidFluidity)
    : null;
  const reportedFrameCapture = resolvedOptions?.androidFrameCapture;
  const androidFrameCapture = androidFrameScore !== null ? 'observed'
    : reportedFrameCapture === 'start-unavailable' || reportedFrameCapture === 'interrupted'
      || reportedFrameCapture === 'no-samples' || reportedFrameCapture === 'dropped-callbacks'
      || reportedFrameCapture === 'drop-count-unavailable'
      ? reportedFrameCapture
      : resolvedOptions?.androidFluidity || reportedFrameCapture === 'collected' ? 'invalid'
        : report.environment?.platform === 'android' ? 'unknown' : 'not-applicable';

  let jsRuntimeScore: number | null = null;
  const executedJourneyCount = journeys.filter(
    check => check.status !== 'skipped' && check.metrics.executionAttempted !== false && check.metrics.availabilityFailure !== true
      && (!evidenceV2 || check.metrics.actionInvoked === true),
  ).length;
  const allJourneysHaveCallbacks = executedJourneyCount > 0 && executedJourneyCount === journeys.length
    && journeys.every(check => check.metrics.eventLoopMeasurementAvailable === true && check.metrics.frameMeasurementAvailable === true);
  if (collectionComplete && allJourneysHaveCallbacks && values.jsStallPercent !== null && values.slowFramePercent !== null) {
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
  const cwvComposite = cwvScores.length > 0 && (!evidenceV2 || cwvScores.length === 3)
    ? round1(cwvScores.reduce((sum, val) => sum + val, 0) / cwvScores.length)
    : null;

  const androidNativeRequired = evidenceV2 && report.environment?.platform === 'android';
  const telemetryKind = androidFrameScore !== null
    ? 'android-native-frame-trace'
    : androidNativeRequired ? 'unmeasured' : cwvComposite !== null
      ? 'core-web-vitals-p75'
      : iosHitchScore !== null
        ? 'ios-hitch-ratio'
        : jsRuntimeScore !== null
          ? 'js-runtime-callbacks'
          : 'unmeasured';

  const fluidityScore = androidFrameScore ?? (androidNativeRequired ? null : cwvComposite ?? iosHitchScore ?? jsRuntimeScore);

  const affsScore = collectionComplete
    && interactionFrictionScore !== null
    && standards.score !== null
    && fluidityScore !== null
    ? round1(
      AFFS_PILLAR_WEIGHTS.interactionFriction * interactionFrictionScore
      + AFFS_PILLAR_WEIGHTS.standardsAndAccessibility * standards.score
      + AFFS_PILLAR_WEIGHTS.fluidityAndResponsiveness * fluidityScore,
    )
    : null;

  const findings: UxAuditFinding[] = [];
  if (intrinsicExtraActions > 0) {
    const contributors = evaluatedTasks.filter(task => (task.frictionTaxonomy.intrinsicExtraActions ?? 0) > 0);
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'intrinsic',
      code: 'avoidable-interactions',
      severity: 'medium',
      count: intrinsicExtraActions,
      ...(evidenceV2 ? { checkIds: contributors.map(task => task.taskId === 'redacted-task' ? null : task.taskId) } : {}),
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
      ...(evidenceV2 ? { checkIds: failedTasks.map(task => task.taskId === 'redacted-task' ? null : task.taskId) } : {}),
    });
  }
  const timingFailures = completion.failurePositions.filter(item => item.category === 'timing');
  const timingFailureCount = timingFailures.length;
  if (timingFailureCount > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'performance',
      code: 'latency-over-budget',
      severity: 'high',
      count: timingFailureCount,
      ...(evidenceV2 ? { checkIds: timingFailures.map(item => item.checkId) } : {}),
      ...(values.slowestCheckMs !== null ? { valueMs: values.slowestCheckMs, unit: 'ms' as const } : {}),
    });
  }
  if (evidenceV2 && performanceOverrunChecks > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'performance',
      code: 'task-latency-overrun',
      severity: 'medium',
      count: performanceOverrunChecks,
      checkIds: overrunTasks.map(task => task.taskId === 'redacted-task' ? null : task.taskId),
    });
  }
  const incompleteTasks = evaluatedTasks.filter(task => task.score === null);
  if (evidenceV2 && incompleteTasks.length > 0) {
    findings.push({
      pillar: 'interaction-friction',
      dimension: 'intrinsic',
      code: 'task-evidence-incomplete',
      severity: 'medium',
      count: incompleteTasks.length,
      checkIds: incompleteTasks.map(task => task.taskId === 'redacted-task' ? null : task.taskId),
    });
  }
  if (evidenceV2 && resolvedOptions?.targetCapture?.capacityReached === true) {
    findings.push({
      pillar: 'standards-accessibility',
      dimension: 'accessibility-standard',
      code: 'target-sample-capacity',
      severity: 'medium',
      count: resolvedOptions.targetSamples?.length ?? 0,
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
      unit: 'ms',
      ...(evidenceV2 ? { checkIds: report.checks.filter(check => check.metrics.eventLoopMeasurementAvailable === true
        && measuredAuditValue(check.metrics.maxEventLoopLagMs) === values.maxEventLoopLagMs).map(check => sanitizeId(check.id)) } : {}),
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
      unit: 'ms',
      ...(evidenceV2 ? { checkIds: report.checks.filter(check => check.metrics.frameMeasurementAvailable === true
        && measuredAuditValue(check.metrics.maxFrameGapMs) === values.maxFrameGapMs).map(check => sanitizeId(check.id)) } : {}),
    });
  }
  const inpVal = measuredAuditValue(resolvedOptions?.webVitals?.inpP75Ms);
  if (inpVal !== null && inpVal > UX_AUDIT_STANDARDS.inpGoodMs) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'cwv-inp-over-threshold',
      severity: inpVal > UX_AUDIT_STANDARDS.inpPoorMs ? 'high' : 'medium',
      count: 1,
      valueMs: inpVal,
      unit: 'ms',
    });
  }
  const lcpVal = measuredAuditValue(resolvedOptions?.webVitals?.lcpP75Ms);
  if (lcpVal !== null && lcpVal > UX_AUDIT_STANDARDS.lcpGoodMs) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'cwv-lcp-over-threshold',
      severity: lcpVal > UX_AUDIT_STANDARDS.lcpPoorMs ? 'high' : 'medium',
      count: 1,
      valueMs: lcpVal,
      unit: 'ms',
    });
  }
  const clsVal = measuredAuditValue(resolvedOptions?.webVitals?.clsP75);
  if (clsVal !== null && clsVal > UX_AUDIT_STANDARDS.clsGood) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'cwv-cls-over-threshold',
      severity: clsVal > UX_AUDIT_STANDARDS.clsPoor ? 'high' : 'medium',
      count: 1,
      value: clsVal,
      unit: 'unitless',
    });
  }
  const hitchVal = measuredAuditValue(resolvedOptions?.iosFluidity?.hitchTimeRatioMsPerS);
  if (hitchVal !== null && hitchVal >= UX_AUDIT_STANDARDS.iosHitchGoodMsPerS) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'ios-hitch-ratio-over-threshold',
      severity: hitchVal > UX_AUDIT_STANDARDS.iosHitchPoorMsPerS ? 'high' : 'medium',
      count: 1,
      valueMsPerS: hitchVal,
      unit: 'ms-per-s',
    });
  }
  const androidDeadline = androidFrameDeadlineMs(resolvedOptions?.androidFluidity?.refreshRateHz);
  const signedAndroidOverrun = measuredSignedAuditValue(resolvedOptions?.androidFluidity?.frameOverrunP95Ms);
  const androidOverrun = signedAndroidOverrun !== null ? Math.max(0, signedAndroidOverrun) : null;
  const androidJank = measuredAuditValue(resolvedOptions?.androidFluidity?.jankPercent);
  const androidInputLatency = measuredAuditValue(resolvedOptions?.androidFluidity?.inputLatencyP95Ms);
  const overrunBreached = androidDeadline !== null && androidOverrun !== null && androidOverrun > androidDeadline * 0.25;
  const jankBreached = androidJank !== null && androidJank > 2;
  const inputLatencyBreached = androidInputLatency !== null && androidInputLatency > 100;
  if (overrunBreached) {
    findings.push({
      pillar: 'fluidity-responsiveness', dimension: 'performance', code: 'native-frame-deadline-overrun',
      severity: androidOverrun > androidDeadline ? 'high' : 'medium',
      count: 1, valueMs: androidOverrun, unit: 'ms',
    });
  }
  if (jankBreached) {
    findings.push({
      pillar: 'fluidity-responsiveness', dimension: 'performance', code: 'native-frame-jank',
      severity: androidJank > 10 ? 'high' : 'medium',
      count: 1, value: androidJank, unit: 'percent',
    });
  }
  if (inputLatencyBreached) {
    findings.push({
      pillar: 'fluidity-responsiveness', dimension: 'performance', code: 'native-input-latency',
      severity: androidInputLatency > 250 ? 'high' : 'medium',
      count: 1, valueMs: androidInputLatency, unit: 'ms',
    });
  }
  const frozenResolved = resolveThresholdQualifiedFrozenFrames(resolvedOptions?.androidFluidity);
  if (frozenResolved.qualifiedCount !== null && frozenResolved.qualifiedCount > 0) {
    findings.push({
      pillar: 'fluidity-responsiveness',
      dimension: 'performance',
      code: 'native-frozen-frames',
      severity: 'high',
      count: frozenResolved.qualifiedCount,
      ...(frozenResolved.maxFrozenMs !== null ? { valueMs: frozenResolved.maxFrozenMs, unit: 'ms' as const } : {}),
    });
  }

  const rawParticipantCount = measuredAuditCount(resolvedOptions?.humanValidation?.participantCount);
  const rawSus = resolvedOptions?.humanValidation?.sus;
  const susScore = measuredAuditValue(rawSus?.score);
  const validSus: SusEvaluation | null = susScore !== null && susScore <= 100
    ? {
      score: round1(susScore),
      isPercentage: false,
      benchmarkBand: susScore >= 80 ? 'strong' : susScore >= 68 ? 'average' : 'below-average',
      referenceAverage: 68,
      referenceStrong: 80,
    }
    : null;
  const rawUmux = resolvedOptions?.humanValidation?.umuxLite;
  const umuxRawScore = measuredAuditValue(rawUmux?.rawScore);
  const umuxSusApprox = measuredAuditValue(rawUmux?.susApproximation);
  const umuxScale = measuredAuditCount(rawUmux?.scalePoints);
  const validUmuxLite: UmuxLiteEvaluation | null = umuxRawScore !== null && umuxRawScore <= 100
    && umuxSusApprox !== null && umuxSusApprox <= 100
    && umuxScale !== null && umuxScale >= 2
    ? {
      rawScore: round1(umuxRawScore),
      susApproximation: round1(umuxSusApprox),
      isPercentage: false,
      scalePoints: umuxScale,
    }
    : null;
  const validSeqTasks: SeqTaskSummary[] = Array.isArray(resolvedOptions?.humanValidation?.seqTasks)
    ? resolvedOptions!.humanValidation!.seqTasks.flatMap(task => {
      const n = measuredAuditCount(task?.n);
      const meanRating = measuredAuditValue(task?.meanRating);
      const minRating = measuredAuditValue(task?.minRating);
      const maxRating = measuredAuditValue(task?.maxRating);
      if (
        !task || typeof task.taskId !== 'string' || !task.taskId
        || n === null || n <= 0
        || meanRating === null || meanRating < 1 || meanRating > 7
        || minRating === null || minRating < 1 || minRating > 7
        || maxRating === null || maxRating < 1 || maxRating > 7
        || minRating > maxRating
      ) {
        return [];
      }
      return [{
        taskId: sanitizeId(task.taskId) ?? 'redacted-task',
        n,
        meanRating: round1(meanRating),
        minRating,
        maxRating,
      }];
    })
    : [];
  const rawNasaTlx = measuredAuditValue(resolvedOptions?.humanValidation?.nasaTlxScore);
  const validNasaTlx = rawNasaTlx !== null && rawNasaTlx <= 100 ? round1(rawNasaTlx) : null;
  const hasInstrumentEvidence = validSus !== null
    || validUmuxLite !== null
    || validSeqTasks.length > 0
    || validNasaTlx !== null;
  const humanCompleted = resolvedOptions?.humanValidation?.status === 'completed'
    && rawParticipantCount !== null
    && rawParticipantCount > 0
    && hasInstrumentEvidence;
  const humanValidation: HumanUxValidationLayer = {
    status: humanCompleted ? 'completed' : 'not-performed',
    humanValidationClaimed: humanCompleted,
    participantCount: humanCompleted ? rawParticipantCount : null,
    sus: humanCompleted ? validSus : null,
    umuxLite: humanCompleted ? validUmuxLite : null,
    seqTasks: humanCompleted ? validSeqTasks : [],
    nasaTlxScore: humanCompleted ? validNasaTlx : null,
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
        scoredTaskCount: measuredTasks.length,
        observedTaskMeanScore,
        completedTaskCount,
        ...(evidenceV2 ? { taskOutcomes: {
          success: completedTaskCount,
          failure: failedTasks.length,
          indeterminate: executedJourneyCount - completedTaskCount - failedTasks.length,
          unavailable: evaluatedTasks.length - executedJourneyCount,
        } } : {}),
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
        surfaceContractSummary: standards.surfaceContractSummary,
        ...(evidenceV2 ? {
          surfaceChecks: standards.surfaceChecks,
          targetSizingByRole: standards.targetSizingByRole,
          ...(resolvedOptions?.targetCapture ? { targetSampleCoverage: {
            scope: 'press-feedback-layout' as const,
            retained: resolvedOptions.targetSamples?.length ?? 0,
            capacityReached: resolvedOptions.targetCapture.capacityReached === true,
            auditStartControlsMeasured: resolvedOptions.targetCapture.auditStartControlsMeasured === true,
            ...(resolvedOptions.targetCapture.aggregation === 'control-state-geometry' ? {
              aggregation: 'control-state-geometry' as const,
              layoutObservations: (resolvedOptions.targetSamples ?? []).reduce((sum, sample) =>
                sum + (Number.isSafeInteger(sample.layoutObservations) && sample.layoutObservations! > 0 ? sample.layoutObservations! : 1), 0),
            } : {}),
          } } : {}),
        } : {}),
      },
      fluidityAndResponsiveness: {
        score: fluidityScore,
        weight: AFFS_PILLAR_WEIGHTS.fluidityAndResponsiveness,
        telemetryKind,
        nativeFrameDeadlineMeasured: telemetryKind === 'android-native-frame-trace',
        androidFrameCapture,
        ...(evidenceV2 && androidFrameSegments ? { androidFrameSegments } : {}),
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
      executedJourneyCount,
      viewportWidth: measuredAuditValue(report.environment?.viewportWidth),
      fontScale: measuredAuditValue(report.environment?.fontScale),
      platform: typeof report.environment?.platform === 'string'
        && ALLOWED_ENVIRONMENT_PLATFORMS.has(report.environment.platform as 'android' | 'ios' | 'web')
        ? (report.environment.platform as 'android' | 'ios' | 'web')
        : null,
    },
    humanValidation,
    findings,
  };
}
