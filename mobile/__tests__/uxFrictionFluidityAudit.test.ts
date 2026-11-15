import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport } from '../src/lib/appHealth';
import type { AuditCheck } from '../src/lib/performanceAudit';
import {
  AFFS_PILLAR_WEIGHTS,
  AFFS_TASK_FRICTION_WEIGHTS,
  UX_AUDIT_STANDARDS,
  androidFrameDeadlineMs,
  buildUxFrictionFluidityAudit,
  calculatePathEfficiency,
  classifyAffsBand,
  evaluateTargetSizing,
  scoreAndroidNativeFluidity,
  scoreIosHitchRatio,
  scoreSusQuestionnaire,
  scoreTaskInteractionFriction,
  scoreUmuxLiteQuestionnaire,
  scoreWebVitalCls,
  scoreWebVitalInp,
  scoreWebVitalLcp,
  summarizeSeqTaskRatings,
} from '../src/lib/uxFrictionFluidityAudit';

function makeJourneyCheck(id: string, overrides: Partial<AuditCheck['metrics']> = {}, status: AuditCheck['status'] = 'pass'): AuditCheck {
  return {
    id,
    label: 'Task journey',
    kind: 'journey',
    status,
    durationMs: 120,
    metrics: {
      executionAttempted: true,
      actionInvoked: true,
      actionCompleted: true,
      nonTimingFailure: false,
      eventLoopMeasurementAvailable: true,
      frameMeasurementAvailable: true,
      eventLoopSamples: 20,
      stallsOver100Ms: 0,
      maxEventLoopLagMs: 18,
      frameSamples: 40,
      framesOver50Ms: 0,
      maxFrameGapMs: 22,
      runtimeErrors: 0,
      actionMs: 120,
      forwardWorkMs: 120,
      backMs: 60,
      ...overrides,
    },
    diagnostic: {
      stage: 'complete',
      readiness: { ready: true, capturing: true, blockers: [], surfaces: [] },
    },
  };
}

describe('AR Friction & Fluidity Score (AFFS) framework', () => {
  test('path efficiency implements min(1, minimum justified actions / observed actions) and zero-tap arrival rules', () => {
    expect(calculatePathEfficiency(5, 8)).toBe(0.625);
    expect(calculatePathEfficiency(5, 5)).toBe(1);
    expect(calculatePathEfficiency(5, 3)).toBe(1);
    expect(calculatePathEfficiency(0, 0)).toBe(1);
    expect(calculatePathEfficiency(0, 2)).toBe(0);
    expect(calculatePathEfficiency(3, 0)).toBeNull();
    expect(calculatePathEfficiency(-1, 4)).toBeNull();
    expect(calculatePathEfficiency(2.5, 4)).toBeNull();
  });

  test('per-task interaction friction follows Ft = 0.30*St + 0.20*Et + 0.20*At + 0.15*Rt + 0.15*Wt', () => {
    expect(AFFS_TASK_FRICTION_WEIGHTS).toEqual({
      taskSuccess: 0.30,
      errorRetryPerformance: 0.20,
      pathEfficiency: 0.20,
      responseTimeEfficiency: 0.15,
      waitingInterruptionPerformance: 0.15,
    });
    const ideal = scoreTaskInteractionFriction({
      taskId: 'compare-two',
      completed: true,
      minimumJustifiedActions: 4,
      observedActions: 4,
      errors: 0,
      retries: 0,
      observedResponseMs: 180,
      targetResponseMs: 200,
      comparatorKind: 'product-target',
      avoidableWaitMs: 0,
    });
    expect(ideal.score).toBe(100);
    expect(ideal.components).toEqual({
      taskSuccess: 1,
      errorRetryPerformance: 1,
      pathEfficiency: 1,
      responseTimeEfficiency: 1,
      waitingInterruptionPerformance: 1,
    });

    const degraded = scoreTaskInteractionFriction({
      taskId: 'checkout',
      completed: true,
      minimumJustifiedActions: 5,
      observedActions: 8,
      errors: 1,
      retries: 0,
      repeatedFields: 1,
      scrollDetours: 2,
      observedResponseMs: 400,
      targetResponseMs: 200,
      comparatorKind: 'best-known-path',
      avoidableWaitMs: 500,
      maxAvoidableWaitBudgetMs: 1_000,
      probeDefects: 1,
    });
    // St=1, Et=0.5, At=0.625, Rt=0.5, Wt=0.5 => Ft = 0.30 + 0.10 + 0.125 + 0.075 + 0.075 = 0.675 => 67.5
    expect(degraded.score).toBe(67.5);
    expect(degraded.comparatorKind).toBe('best-known-path');
    expect(degraded.frictionTaxonomy).toEqual({
      intrinsicExtraActions: 6,
      performanceOverrunMs: 700,
      cognitiveProbeFlags: 1,
      requiresHumanComprehensionReview: true,
    });
  });

  test('house operational bands classify 0..100 scores and reject invalid inputs', () => {
    expect(classifyAffsBand(95)).toBe('exemplary');
    expect(classifyAffsBand(90)).toBe('exemplary');
    expect(classifyAffsBand(82)).toBe('strong');
    expect(classifyAffsBand(78)).toBe('moderate-friction');
    expect(classifyAffsBand(65)).toBe('material-friction');
    expect(classifyAffsBand(59.9)).toBe('high-friction');
    expect(classifyAffsBand(null)).toBeNull();
    expect(classifyAffsBand(-1)).toBeNull();
    expect(classifyAffsBand(101)).toBeNull();
  });

  test('target sizing enforces WCAG 2.2 AA (24px), iOS HIG (44pt) and Android (48dp) minimums', () => {
    expect(evaluateTargetSizing({ width: 24, height: 24, platform: 'web-wcag-aa' })).toMatchObject({ passes: true, minimumRequired: 24 });
    expect(evaluateTargetSizing({ width: 23, height: 28, platform: 'web-wcag-aa' })).toMatchObject({ passes: false, minimumRequired: 24 });
    expect(evaluateTargetSizing({ width: 44, height: 44, platform: 'ios-hig' })).toMatchObject({ passes: true, minimumRequired: 44 });
    expect(evaluateTargetSizing({ width: 42, height: 48, platform: 'ios-hig' })).toMatchObject({ passes: false, minimumRequired: 44 });
    expect(evaluateTargetSizing({ width: 48, height: 48, platform: 'android' })).toMatchObject({ passes: true, minimumRequired: 48 });
    expect(evaluateTargetSizing({ width: 47, height: 48, platform: 'android' })).toMatchObject({ passes: false, minimumRequired: 48 });
  });

  test('web Core Web Vitals, iOS hitch ratio and refresh-rate-aware Android fluidity map external thresholds', () => {
    expect(scoreWebVitalInp(100)).toBe(90);
    expect(scoreWebVitalInp(200)).toBe(80);
    expect(scoreWebVitalInp(350)).toBe(65);
    expect(scoreWebVitalInp(500)).toBe(50);
    expect(scoreWebVitalInp(750)).toBe(25);

    expect(scoreWebVitalLcp(2_500)).toBe(80);
    expect(scoreWebVitalLcp(4_000)).toBe(50);
    expect(scoreWebVitalCls(0.1)).toBe(80);
    expect(scoreWebVitalCls(0.25)).toBe(50);

    expect(scoreIosHitchRatio(2.5)).toBe(90);
    expect(scoreIosHitchRatio(5)).toBe(80);
    expect(scoreIosHitchRatio(7.5)).toBe(65);
    expect(scoreIosHitchRatio(10)).toBe(50);
    expect(scoreIosHitchRatio(15)).toBe(25);

    expect(androidFrameDeadlineMs(60)).toBeCloseTo(16.667, 2);
    expect(androidFrameDeadlineMs(90)).toBeCloseTo(11.111, 2);
    expect(androidFrameDeadlineMs(120)).toBeCloseTo(8.333, 2);

    const smooth120Hz = scoreAndroidNativeFluidity({
      refreshRateHz: 120,
      frameOverrunP95Ms: 1,
      jankPercent: 1,
      frozenFrameCount: 0,
      inputLatencyP95Ms: 50,
    });
    const frozen120Hz = scoreAndroidNativeFluidity({
      refreshRateHz: 120,
      frameOverrunP95Ms: 1,
      jankPercent: 1,
      frozenFrameCount: 2,
      inputLatencyP95Ms: 50,
    });
    expect(smooth120Hz).toBeGreaterThan(85);
    expect(frozen120Hz).toBe(round1(smooth120Hz! - 30));
  });

  test('SUS, UMUX-Lite and SEQ questionnaires validate inputs and stay separate from automated scores', () => {
    const susAverage = scoreSusQuestionnaire([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(susAverage).toEqual({
      score: 50,
      isPercentage: false,
      benchmarkBand: 'below-average',
      referenceAverage: 68,
      referenceStrong: 80,
    });
    const susStrong = scoreSusQuestionnaire([5, 1, 5, 1, 4, 2, 5, 1, 5, 1]);
    expect(susStrong).toMatchObject({ score: 95, benchmarkBand: 'strong', isPercentage: false });
    expect(scoreSusQuestionnaire([5, 1, 5])).toBeNull();
    expect(scoreSusQuestionnaire([6, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBeNull();

    const umux = scoreUmuxLiteQuestionnaire(6, 6, 7);
    expect(umux).toEqual({
      rawScore: 83.3,
      susApproximation: 77,
      isPercentage: false,
      scalePoints: 7,
    });
    expect(scoreUmuxLiteQuestionnaire(0, 5, 7)).toBeNull();

    const seq = summarizeSeqTaskRatings([
      { taskId: 'compare-two', rating: 6 },
      { taskId: 'compare-two', rating: 7 },
      { taskId: 'filter', rating: 5 },
      { taskId: 'invalid', rating: 9 },
    ]);
    expect(seq).toEqual([
      { taskId: 'compare-two', n: 2, meanRating: 6.5, minRating: 6, maxRating: 7 },
      { taskId: 'filter', n: 1, meanRating: 5, minRating: 5, maxRating: 5 },
    ]);
  });

  test('buildUxFrictionFluidityAudit combines the three pillars, preserves ACT/WCAG boundaries and keeps human validation separate', () => {
    const report = makePerformanceAuditReport('affs-complete', [
      makeJourneyCheck('journey-rates-cold'),
      makeJourneyCheck('journey-rates-warm', { replaceRecoveryMs: 25, maxEventLoopLagMs: 140, maxFrameGapMs: 65, stallsOver100Ms: 1, framesOver50Ms: 2 }),
    ]);
    report.appHealth = finalizeAppHealthReport({
      sessionId: report.sessionId,
      mode: 'local',
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      plannedCheckIds: [APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT],
      checks: [
        {
          id: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
          code: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
          domain: 'display-completeness',
          label: 'Contract',
          status: 'pass',
          metrics: { plannedSurfaces: 23, missingSurfaces: 0, duplicateContracts: 0 },
        },
        {
          id: APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
          code: APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
          domain: 'display-completeness',
          label: 'Layout',
          status: 'warn',
          metrics: { checked: 11, missing: 0, failed: 2, warned: 1, unavailable: 0 },
        },
      ],
    });

    const audit = buildUxFrictionFluidityAudit(report);
    expect(audit.proprietaryComposite).toBe(true);
    expect(audit.validatedUsabilityScaleClaimed).toBe(false);
    expect(audit.houseThresholds).toBe(true);
    expect(audit.normativeCutoffsClaimed).toBe(false);
    expect(audit.standards).toEqual({
      usabilityDefinition: UX_AUDIT_STANDARDS.usabilityDefinition,
      interactionPrinciples: UX_AUDIT_STANDARDS.interactionPrinciples,
      usabilityReporting: UX_AUDIT_STANDARDS.usabilityReporting,
      accessibility: UX_AUDIT_STANDARDS.accessibility,
      actRulesFormat: UX_AUDIT_STANDARDS.actRulesFormat,
    });
    expect(audit.weights).toEqual(AFFS_PILLAR_WEIGHTS);
    expect(audit.pillars.standardsAndAccessibility.wcagSummary).toEqual({
      applicableChecks: 34,
      passed: 31,
      failed: 2,
      requiresManualReview: 1,
      unavailable: 0,
      automatedConformityClaimed: false,
    });
    expect(audit.pillars.standardsAndAccessibility.score).toBe(91.2);
    expect(audit.pillars.fluidityAndResponsiveness.telemetryKind).toBe('js-runtime-callbacks');
    expect(audit.pillars.fluidityAndResponsiveness.nativeFrameDeadlineMeasured).toBe(false);
    expect(audit.affsScore).not.toBeNull();
    expect(audit.band).toBe('Exemplary'.toLowerCase());
    expect(audit.humanValidation).toEqual({
      status: 'not-performed',
      humanValidationClaimed: false,
      participantCount: null,
      sus: null,
      umuxLite: null,
      seqTasks: [],
      nasaTlxScore: null,
    });
    expect(audit.findings.map(item => item.code)).toEqual(
      expect.arrayContaining(['avoidable-interactions', 'standards-check-failed']),
    );
  });
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
