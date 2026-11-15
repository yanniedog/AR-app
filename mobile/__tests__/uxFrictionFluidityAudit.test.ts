import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport } from '../src/lib/appHealth';
import { buildAuditMetricAnalysis } from '../src/lib/auditMetricAnalysis';
import type { AuditCheck, PerformanceAuditReport } from '../src/lib/performanceAudit';
import {
  AFFS_TASK_FRICTION_WEIGHTS,
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
      retries: 0,
      validationFailures: 0,
      backtracks: 0,
      repeatedFields: 0,
      scrollDetours: 0,
      modalInterruptions: 0,
      minimumJustifiedActions: 2,
      observedActions: 2,
      preActionWaitMs: 0,
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

function attachCompleteDisplayHealth(report: PerformanceAuditReport): void {
  const roleCodes = [
    APP_HEALTH_CHECK_CODES.DISPLAY_MODEL,
    APP_HEALTH_CHECK_CODES.DISPLAY_LIST,
    APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY,
    APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
    APP_HEALTH_CHECK_CODES.DISPLAY_CHART,
    APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE,
    APP_HEALTH_CHECK_CODES.DISPLAY_LOGO,
  ] as const;
  const allCodes = [APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, ...roleCodes];
  report.appHealth = finalizeAppHealthReport({
    sessionId: report.sessionId,
    mode: 'local',
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    plannedCheckIds: [...allCodes],
    checks: [
      {
        id: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
        code: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
        domain: 'display-completeness',
        label: 'Contract',
        status: 'pass',
        metrics: {
          plannedSurfaces: 20,
          missingSurfaces: 0,
          duplicateContracts: 0,
          duplicateObservations: 0,
          unexpectedSurfaces: 0,
        },
      },
      ...roleCodes.map(code => ({
        id: code,
        code,
        domain: 'display-completeness' as const,
        label: code,
        status: code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT ? ('warn' as const) : ('pass' as const),
        metrics: code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT
          ? { checked: 10, missing: 0, failed: 2, warned: 1, unavailable: 0 }
          : { checked: 10, missing: 0, failed: 0, warned: 0, unavailable: 0 },
      })),
    ],
  });
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

  test('per-task interaction friction follows Ft = 0.30*(1-St) + 0.20*(1-Et) + 0.20*(1-At) + 0.15*(1-Rt) + 0.15*(1-Wt) and preserves null on missing counters', () => {
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
      validationFailures: 0,
      backtracks: 0,
      repeatedFields: 0,
      scrollDetours: 0,
      modalInterruptions: 0,
      observedResponseMs: 180,
      targetResponseMs: 200,
      comparatorKind: 'product-target',
      avoidableWaitMs: 0,
    });
    expect(ideal.frictionIndex).toBe(0);
    expect(ideal.score).toBe(100);
    expect(ideal.components).toEqual({
      taskSuccess: 1,
      errorRetryPerformance: 1,
      pathEfficiency: 1,
      responseTimeEfficiency: 1,
      waitingInterruptionPerformance: 1,
    });
    expect(ideal.frictionComponents).toEqual({
      taskFailure: 0,
      errorRetry: 0,
      stepExcess: 0,
      responseDelay: 0,
      waitingInterruption: 0,
    });

    const degraded = scoreTaskInteractionFriction({
      taskId: 'checkout',
      completed: true,
      minimumJustifiedActions: 5,
      observedActions: 8,
      errors: 1,
      retries: 0,
      validationFailures: 0,
      backtracks: 0,
      repeatedFields: 1,
      scrollDetours: 2,
      modalInterruptions: 0,
      observedResponseMs: 400,
      targetResponseMs: 200,
      comparatorKind: 'best-known-path',
      avoidableWaitMs: 500,
      maxAvoidableWaitBudgetMs: 1_000,
      probeDefects: 1,
    });
    // Friction Ft = 0.30*0 + 0.20*0.5 + 0.20*0.375 + 0.15*0.5 + 0.15*0.5 = 0.325 => score = 100*(1 - 0.325) = 67.5
    expect(degraded.frictionIndex).toBe(0.325);
    expect(degraded.score).toBe(67.5);
    expect(degraded.comparatorKind).toBe('best-known-path');
    expect(degraded.frictionTaxonomy).toEqual({
      intrinsicExtraActions: 6,
      performanceOverrunMs: 700,
      cognitiveProbeFlags: 1,
      requiresHumanComprehensionReview: true,
    });

    const missingCounters = scoreTaskInteractionFriction({
      taskId: 'missing-evidence',
      completed: true,
      minimumJustifiedActions: 4,
      observedActions: 4,
      errors: null,
      retries: 0,
      validationFailures: 0,
      backtracks: 0,
      repeatedFields: 0,
      scrollDetours: 0,
      modalInterruptions: 0,
      observedResponseMs: 150,
      targetResponseMs: 200,
      avoidableWaitMs: 0,
    });
    expect(missingCounters.components.errorRetryPerformance).toBeNull();
    expect(missingCounters.frictionIndex).toBeNull();
    expect(missingCounters.score).toBeNull();
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

    // Omitted refreshRateHz or input-latency-only telemetry must return null
    expect(scoreAndroidNativeFluidity({ frameOverrunP95Ms: 1, jankPercent: 1 })).toBeNull();
    expect(scoreAndroidNativeFluidity({ inputLatencyP95Ms: 50 })).toBeNull();
    // Positive frozenFrameCount without >=700 ms duration evidence returns null
    expect(scoreAndroidNativeFluidity({
      refreshRateHz: 120,
      frameOverrunP95Ms: 1,
      frozenFrameCount: 1,
      maxFrozenFrameMs: 650,
    })).toBeNull();

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
      maxFrozenFrameMs: 740,
      inputLatencyP95Ms: 50,
    });
    // At 120 Hz, deadline = 8.333 ms, goodLimit = 2.083 ms => overrun 1 ms scores 90.4; jank 1% scores 90; input 50 ms scores 90 => mean = 90.1
    expect(smooth120Hz).toBe(90.1);
    expect(frozen120Hz).toBe(60.1);
    // Negative frameOverrunP95Ms (frames completing before deadline) clamps to 0 overrun
    expect(scoreAndroidNativeFluidity({
      refreshRateHz: 60,
      frameOverrunP95Ms: -7.1,
      jankPercent: 0,
    })).toBe(100);
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
      makeJourneyCheck('journey-rates-warm', {
        observedActions: 3,
        retries: 1,
        replaceRecoveryMs: 25,
        maxEventLoopLagMs: 140,
        maxFrameGapMs: 65,
        stallsOver100Ms: 1,
        framesOver50Ms: 2,
      }),
    ]);
    attachCompleteDisplayHealth(report);
    report.uxTelemetry = {
      targetSamples: [
        { id: 'cta-primary', width: 48, height: 48, platform: 'android' },
        { id: 'filter-chip', width: 44, height: 48, platform: 'android' },
      ],
      wcagActChecks: { passed: 8, failed: 0, requiresManualReview: 1, unavailable: 0 },
    };

    const analysis = buildAuditMetricAnalysis(report);
    const audit = analysis.uxAudit;
    expect(audit.proprietaryComposite).toBe(true);
    expect(audit.validatedUsabilityScaleClaimed).toBe(false);
    expect(audit.houseThresholds).toBe(true);
    expect(audit.normativeCutoffsClaimed).toBe(false);
    expect(audit.standards).toEqual({
      usabilityDefinition: 'ISO 9241-11:2018',
      interactionPrinciples: 'ISO 9241-110:2020',
      usabilityReporting: 'ISO 25062:2025',
      accessibility: 'WCAG 2.2',
      actRulesFormat: '1.1',
    });
    expect(audit.weights).toEqual({
      interactionFriction: 0.4,
      standardsAndAccessibility: 0.3,
      fluidityAndResponsiveness: 0.3,
    });
    expect(audit.pillars.standardsAndAccessibility.wcagSummary).toEqual({
      applicableChecks: 11,
      passed: 9,
      failed: 1,
      requiresManualReview: 1,
      unavailable: 0,
      automatedConformityClaimed: false,
    });
    expect(audit.pillars.standardsAndAccessibility.surfaceContractSummary).toEqual({
      applicableChecks: 90,
      passed: 87,
      failed: 2,
      requiresManualReview: 1,
      unavailable: 0,
      automatedConformityClaimed: false,
    });
    // Interaction friction: cold = 100, warm: St=1, Et=0.5, At=0.667, Rt=1, Wt=1 => Ft=0.167 => 83.3 => mean = 91.7
    expect(audit.pillars.interactionFriction.score).toBe(91.7);
    // Standards: (87 + 9) / (90 + 11) = 96 / 101 = 95.0%
    expect(audit.pillars.standardsAndAccessibility.score).toBe(95);
    expect(audit.pillars.fluidityAndResponsiveness.telemetryKind).toBe('js-runtime-callbacks');
    expect(audit.pillars.fluidityAndResponsiveness.nativeFrameDeadlineMeasured).toBe(false);
    expect(audit.pillars.fluidityAndResponsiveness.score).toBe(91.9);
    // Composite: 0.4 * 91.7 + 0.3 * 95.0 + 0.3 * 91.9 = 36.68 + 28.5 + 27.57 = 92.8
    expect(audit.affsScore).toBe(92.8);
    expect(audit.band).toBe('exemplary');
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
      expect.arrayContaining(['avoidable-interactions', 'standards-check-failed', 'js-event-loop-stall', 'js-frame-gap-overrun']),
    );
  });

  test('withholds scores on slow Back round-trip, uninvoked/duplicate journeys, missing standards checks or unevidenced human validation', () => {
    const slowBackReport = makePerformanceAuditReport('slow-back', [
      makeJourneyCheck('journey-round-trip', {
        measurementMode: 'route-round-trip',
        forwardWorkMs: 100,
        backMs: 9_000,
      }, 'fail'),
    ]);
    delete slowBackReport.checks[0].metrics.actionMs;
    attachCompleteDisplayHealth(slowBackReport);
    const slowBackAudit = buildUxFrictionFluidityAudit(slowBackReport, undefined, {
      wcagActChecks: { passed: 4, failed: 0, requiresManualReview: 1, unavailable: 0 },
      iosFluidity: { hitchTimeRatioMsPerS: 8 },
      webVitals: { lcpP75Ms: 4_200, clsP75: 0.3 },
      humanValidation: { status: 'completed' },
    });
    expect(slowBackAudit.pillars.interactionFriction.score).toBeLessThan(90);
    expect(slowBackAudit.pillars.fluidityAndResponsiveness.nativeFrameDeadlineMeasured).toBe(false);
    expect(slowBackAudit.humanValidation.status).toBe('not-performed');
    expect(slowBackAudit.humanValidation.humanValidationClaimed).toBe(false);
    expect(slowBackAudit.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'cwv-lcp-over-threshold', valueMs: 4_200, unit: 'ms' }),
      expect.objectContaining({ code: 'cwv-cls-over-threshold', value: 0.3, unit: 'unitless' }),
      expect.objectContaining({ code: 'ios-hitch-ratio-over-threshold', valueMsPerS: 8, unit: 'ms-per-s' }),
    ]));

    // Duplicate journey IDs withhold interactionFriction and affsScore
    const dupReport = makePerformanceAuditReport('dup-journeys', [
      makeJourneyCheck('journey-dup'),
      makeJourneyCheck('journey-dup'),
    ]);
    attachCompleteDisplayHealth(dupReport);
    const dupAudit = buildUxFrictionFluidityAudit(dupReport, undefined, {
      wcagActChecks: { passed: 4, failed: 0, requiresManualReview: 1, unavailable: 0 },
    });
    expect(dupAudit.pillars.interactionFriction.score).toBeNull();
    expect(dupAudit.affsScore).toBeNull();

    // SEQ task IDs are sanitized through safeCheckId, invalid instrument scores are rejected, and extra fields are stripped
    const seqAudit = buildUxFrictionFluidityAudit(dupReport, undefined, {
      safeCheckId: () => null,
      humanValidation: {
        status: 'completed',
        participantCount: 5,
        sus: Object.assign(scoreSusQuestionnaire([5, 1, 5, 1, 4, 2, 5, 1, 5, 1])!, { participantEmail: 'leaked@example.invalid' }),
        umuxLite: Object.assign(scoreUmuxLiteQuestionnaire(6, 6, 7)!, { participantName: 'leaked' }),
        seqTasks: [{ taskId: 'private-person@example.invalid', n: 5, meanRating: 6.2, minRating: 5, maxRating: 7 }],
      },
    });
    expect(seqAudit.humanValidation.seqTasks).toEqual([
      { taskId: 'redacted-task', n: 5, meanRating: 6.2, minRating: 5, maxRating: 7 },
    ]);
    expect(seqAudit.humanValidation.sus).toEqual({
      score: 95,
      isPercentage: false,
      benchmarkBand: 'strong',
      referenceAverage: 68,
      referenceStrong: 80,
    });
    expect(seqAudit.humanValidation.umuxLite).toEqual({
      rawScore: 83.3,
      susApproximation: 77,
      isPercentage: false,
      scalePoints: 7,
    });

    const badInstrument = buildUxFrictionFluidityAudit(dupReport, undefined, {
      humanValidation: {
        status: 'completed',
        participantCount: 5,
        sus: { score: -1, isPercentage: false, benchmarkBand: 'below-average', referenceAverage: 68, referenceStrong: 80 },
      },
    });
    expect(badInstrument.humanValidation.status).toBe('not-performed');
    expect(badInstrument.humanValidation.humanValidationClaimed).toBe(false);
    expect(badInstrument.humanValidation.sus).toBeNull();

    // Malformed legacy coverage ({}) does not throw and withholds scores; partial callback coverage withholds jsRuntimeScore
    const malformedCovReport = makePerformanceAuditReport('malformed-cov', [
      makeJourneyCheck('journey-1'),
      makeJourneyCheck('journey-2', { eventLoopMeasurementAvailable: false, frameMeasurementAvailable: false }),
    ]);
    malformedCovReport.coverage = {} as PerformanceAuditReport['coverage'];
    const malformedAudit = buildUxFrictionFluidityAudit(malformedCovReport);
    expect(malformedAudit.affsScore).toBeNull();
    expect(malformedAudit.pillars.fluidityAndResponsiveness.components.jsRuntimeScore).toBeNull();
  });
});
