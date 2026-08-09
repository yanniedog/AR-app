import type { CorePayload } from '../src/types';
import {
  aggregateRepeatedJourneys,
  AUDIT_LATENCY_METRIC_KEYS,
  cancelPerformanceAudit,
  buildPerformanceAuditJourneys,
  claimPerformanceAuditUploadDeletion,
  completePerformanceAudit,
  DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  flattenAuditLogText,
  ForegroundElapsed,
  formatAuditError,
  formatAuditErrorForLog,
  getPerformanceAuditPauseCount,
  getPerformanceAuditState,
  hasExplicitNonTimingFailure,
  isPerformanceAuditActive,
  markPerformanceAuditRunning,
  markPerformanceAuditUploadDeleted,
  measureAuditAction,
  parsePerformanceAuditHangTimeoutSeconds,
  pausePerformanceAudit,
  pathMatches,
  PerformanceAuditInactivityWatchdog,
  percentile,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  requestPerformanceAudit,
  releasePerformanceAuditUploadDeletion,
  resolveAuditJourneyOptionalData,
  requiresPerformanceAuditRouteRecovery,
  resumePerformanceAudit,
  resetPerformanceAuditForTests,
  subscribePerformanceAudit,
  MAX_REPORTED_AUDIT_CHECKS,
  scoreLatency,
  selectReportedAuditChecks,
  setPerformanceAuditUploadResult,
  summarizePerformanceAudit,
  summarizeResponsiveness,
  worstStatus,
  type AuditCheck,
  type AuditEnvironment,
} from '../src/lib/performanceAudit';

describe('background interruption failure evidence', () => {
  const check = (metrics: AuditCheck['metrics'], error?: string): AuditCheck => ({
    id: 'interrupted',
    label: 'Interrupted check',
    kind: 'runtime',
    status: 'fail',
    durationMs: 0,
    metrics,
    ...(error ? { error } : {}),
  });

  it('does not preserve a generic error that may have come from a paused timeout', () => {
    expect(hasExplicitNonTimingFailure(check({}, 'Update manifest check timed out'))).toBe(false);
  });

  it('preserves only an explicitly identified non-timing failure', () => {
    expect(hasExplicitNonTimingFailure(check({ nonTimingFailure: true }))).toBe(true);
  });
});

const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-07-31',
  sections: {
    Mortgage: {
      rates: [
        {
          provider: 'Bank A',
          product_key: 'Bank A|home',
          product_name: 'Home',
          rate: '0.05',
          rate_index: 2,
        },
      ],
      ribbon: {
        counts: { rates: 1, products: 1, providers: 1 },
        range: { min: 0.05, max: 0.05, mean: 0.05, median: 0.05 },
        providers: [],
      },
    },
    Savings: {
      rates: [
        {
          provider: 'Bank B',
          product_key: 'Bank B|save',
          product_name: 'Save',
          rate: '0.04',
        },
      ],
      ribbon: {
        counts: { rates: 1, products: 1, providers: 1 },
        range: { min: 0.04, max: 0.04, mean: 0.04, median: 0.04 },
        providers: [],
      },
    },
    TD: {
      rates: [],
      ribbon: {
        counts: { rates: 0, products: 0, providers: 0 },
        range: { min: null, max: null, mean: null, median: null },
        providers: [],
      },
    },
  },
  brands: {
    'Bank A': { short: 'A', color: '#000000' },
    'Bank B': { short: 'B', color: '#ffffff' },
  },
  rba: [],
};

const environment: AuditEnvironment = {
  appVersion: '1.0.0',
  buildVersion: '1',
  platform: 'android',
  platformVersion: '34',
  manufacturer: 'Test',
  brand: 'Test',
  model: 'Test',
  osName: 'Android',
  osVersion: '14',
  totalMemoryBytes: 1,
  jsEngine: 'Hermes',
  developmentBuild: false,
  viewportWidth: 400,
  viewportHeight: 800,
  fontScale: 1,
  payloadSource: 'sample',
  payloadRunDate: '2026-07-31',
  payloadProducts: 2,
  payloadProviders: 2,
  detailsLoaded: false,
  historyLoaded: false,
  productHistoryLoaded: false,
  diagnosticsUploadEnabled: false,
  networkType: 'WIFI',
  networkConnected: true,
  networkInternetReachable: true,
};

function check(
  id: string,
  status: AuditCheck['status'],
  durationMs: number,
  metrics: AuditCheck['metrics'] = {},
): AuditCheck {
  return {
    id,
    label: id,
    kind: 'runtime',
    status,
    durationMs,
    metrics,
    trace: 'trace',
  };
}

describe('performance audit journeys', () => {
  it('covers every steady-state destination and all three browse sections', () => {
    const journeys = buildPerformanceAuditJourneys(core);
    expect(journeys).toHaveLength(20);
    expect(journeys.map((journey) => journey.id)).toEqual(
      expect.arrayContaining([
        'home',
        'browse-mortgage',
        'browse-savings',
        'browse-td',
        'response',
        'outlook',
        'rba-redirect',
        'watchlist',
        'settings',
        'search',
        'calculator',
        'projections',
        'lenders',
        'profile',
        'product',
        'rate-receipt',
        'lender',
        'compare',
        'terms',
        'debug-log',
      ]),
    );
    expect(journeys.find((journey) => journey.id === 'product')?.href).toBeDefined();
    expect(journeys.find((journey) => journey.id === 'rate-receipt')?.href).toBeDefined();
    expect(journeys.find((journey) => journey.id === 'compare')?.href).toBeDefined();
    expect(journeys.every((journey) => journey.expectedSurface.length > 0)).toBe(true);
    expect(journeys.find((journey) => journey.id === 'product')?.expectedSurface)
      .toBe('product.details');
    expect(journeys.find((journey) => journey.id === 'compare')?.expectedSurface)
      .toBe('compare.table');
  });

  it('keeps data-dependent journeys visible but skipped when no payload exists', () => {
    const journeys = buildPerformanceAuditJourneys(null);
    expect(journeys.find((journey) => journey.id === 'product')).toMatchObject({
      href: undefined,
      skipReason: 'No product is loaded',
    });
    expect(journeys.find((journey) => journey.id === 'rate-receipt')).toMatchObject({
      href: undefined,
      skipReason: 'No product is loaded',
    });
    expect(journeys.find((journey) => journey.id === 'compare')?.skipReason).toMatch(
      /Fewer than two/,
    );
  });

  it('marks Browse sections outside the user interests as skipped', () => {
    const journeys = buildPerformanceAuditJourneys(core, ['Mortgage']);
    expect(journeys.find((journey) => journey.id === 'browse-mortgage')?.href).toBeDefined();
    expect(journeys.find((journey) => journey.id === 'browse-savings')).toMatchObject({
      href: undefined,
      skipReason: 'Savings accounts is disabled in interests',
    });
    expect(journeys.find((journey) => journey.id === 'browse-td')).toMatchObject({
      href: undefined,
      skipReason: 'Term deposits is disabled in interests',
    });
  });

  it('matches normalized and decoded Expo Router paths', () => {
    expect(pathMatches('/(tabs)', '/')).toBe(true);
    expect(pathMatches('/settings/', '/settings')).toBe(true);
    expect(pathMatches('/product/Bank%20A%7Chome', '/product/Bank A|home')).toBe(true);
    expect(pathMatches('/browse', '/search')).toBe(false);
  });
});

describe('performance audit optional data', () => {
  const freeBetaPrefs = {
    rateIntelligencePro: false,
    enableDeepSearch: true,
    showHistoryRibbon: true,
    includeNonStandard: false,
  };

  it('waits for free-beta insights without the deprecated Pro entitlement', () => {
    expect(resolveAuditJourneyOptionalData('response', freeBetaPrefs, true).bankInsights).toBe(true);
    expect(resolveAuditJourneyOptionalData('search', freeBetaPrefs, true).deepSearch).toBe(true);
    expect(resolveAuditJourneyOptionalData('product', freeBetaPrefs, true)).toEqual(
      expect.objectContaining({ bankInsights: true, bankHistory: false, productHistory: false }),
    );
    expect(resolveAuditJourneyOptionalData('lender', freeBetaPrefs, true)).toEqual(
      expect.objectContaining({ bankHistory: false, productHistory: false }),
    );
  });

  it('does not request unusable prebuilt bank history in Standard-only Outlook', () => {
    expect(resolveAuditJourneyOptionalData('outlook', freeBetaPrefs, true).bankHistory).toBe(false);
    expect(
      resolveAuditJourneyOptionalData(
        'outlook',
        { ...freeBetaPrefs, includeNonStandard: true },
        true,
      ).bankHistory,
    ).toBe(true);
  });
});

describe('repeat-journey aggregates', () => {
  const journey = (
    id: string,
    iteration: 'cold' | 'warm',
    status: AuditCheck['status'],
    metrics: AuditCheck['metrics'],
  ): AuditCheck => ({
    id: `${id}-${iteration}`,
    label: id,
    kind: 'journey',
    status,
    durationMs: 0,
    metrics: { journeyId: id, journeyLabel: id, iteration, ...metrics },
  });

  it('drops a pair whose check was interrupted rather than publishing a zero it never measured', () => {
    // An interrupted failure keeps its status but loses its timings, so
    // aggregating it would show a bogus 0 ms cold against a real warm.
    const aggregates = aggregateRepeatedJourneys([
      journey('route.search', 'cold', 'fail', { interruptedByBackground: true }),
      journey('route.search', 'warm', 'pass', { forwardMs: 450, backMs: 120 }),
    ]);
    expect(aggregates).toEqual([]);
  });

  it('still aggregates an ordinary failing pair', () => {
    const aggregates = aggregateRepeatedJourneys([
      journey('route.search', 'cold', 'fail', { forwardMs: 900, backMs: 200 }),
      journey('route.search', 'warm', 'pass', { forwardMs: 450, backMs: 120 }),
    ]);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]).toMatchObject({ coldForwardMs: 900, forwardChangeMs: -450 });
  });

  it('does not turn semantic actions without back measurements into zero-time routes', () => {
    const aggregates = aggregateRepeatedJourneys([
      journey('route.search.search.query', 'cold', 'pass', {
        measurementMode: 'semantic-action', actionMs: 2, forwardMs: 710,
      }),
      journey('route.search.search.query', 'warm', 'pass', {
        measurementMode: 'semantic-action', actionMs: 1, forwardMs: 690,
      }),
    ]);
    expect(aggregates).toEqual([]);
  });
});

describe('performance audit scoring', () => {
  it('computes percentiles and responsiveness counters', () => {
    expect(percentile([1, 2, 3, 50], 0.95)).toBe(50);
    expect(summarizeResponsiveness([1, 2, 120], [16, 17, 80])).toEqual({
      eventLoopSamples: 3,
      eventLoopP95Ms: 120,
      maxEventLoopLagMs: 120,
      stallsOver100Ms: 1,
      frameSamples: 3,
      frameP95Ms: 80,
      maxFrameGapMs: 80,
      framesOver50Ms: 1,
    });
  });

  it('excludes audit-only preflight time from action timing and responsiveness', async () => {
    let elapsedMs = 650;
    const snapshots: number[] = [];

    const measured = await measureAuditAction(
      async () => {
        elapsedMs += 7;
        return 'opened';
      },
      () => {
        snapshots.push(elapsedMs);
        return elapsedMs;
      },
      () => elapsedMs,
    );

    expect(measured).toMatchObject({
      result: 'opened',
      startedAt: 650,
      durationMs: 7,
      responsivenessAt: 650,
    });
    expect(snapshots).toEqual([650]);
  });

  it('summarizes a long responsiveness session without spreading the sample array', () => {
    const lagSamples = Array.from({ length: 200_000 }, (_, index) => index);
    expect(summarizeResponsiveness(lagSamples, [])).toMatchObject({
      eventLoopSamples: 200_000,
      maxEventLoopLagMs: 199_999,
      frameSamples: 0,
      maxFrameGapMs: 0,
    });
  });

  it('promotes the worst latency and check status', () => {
    expect(scoreLatency(100, 100, 300)).toBe('pass');
    expect(scoreLatency(101, 100, 300)).toBe('warn');
    expect(scoreLatency(301, 100, 300)).toBe('fail');
    expect(worstStatus('skipped', 'pass', 'warn')).toBe('warn');
  });

  it('summarizes bottlenecks and the slowest check', () => {
    const summary = summarizePerformanceAudit([
      check('fast', 'pass', 20, { maxEventLoopLagMs: 5 }),
      check('slow', 'warn', 200, { maxFrameGapMs: 80 }),
      check('broken', 'fail', 100, { maxEventLoopLagMs: 350 }),
      check('skip', 'skipped', 0),
    ]);
    expect(summary).toMatchObject({
      overall: 'bottleneck',
      pass: 1,
      warn: 1,
      fail: 1,
      skipped: 1,
      executed: 3,
      justifiedSkipped: 0,
      unexpectedSkipped: 1,
      coveragePercent: 75,
      slowestCheckId: 'slow',
      slowestCheckMs: 200,
      maxEventLoopLagMs: 350,
      maxFrameGapMs: 80,
    });
  });

  it('never treats incomplete unexpected coverage as healthy', () => {
    const summary = summarizePerformanceAudit([
      check('fast', 'pass', 20),
      check('cascade', 'skipped', 0, { reason: 'route recovery cascade' }),
    ]);
    expect(summary).toMatchObject({
      overall: 'bottleneck',
      executed: 1,
      unexpectedSkipped: 1,
      coveragePercent: 50,
    });
  });

  it('classifies terminal availability but never counts it as execution coverage', () => {
    const summary = summarizePerformanceAudit([
      check('fast', 'pass', 20),
      check('terminal', 'skipped', 1, {
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'mounted action terminal-unavailable result',
      }),
    ]);
    expect(summary).toMatchObject({
      overall: 'attention',
      justifiedSkipped: 1,
      unexpectedSkipped: 0,
      coveragePercent: 50,
    });
  });

  it('recovers only when a journey invalidated route state, never for latency alone', () => {
    const slow = check('slow-route', 'fail', 1_000, {
      nonTimingFailure: false,
      maxEventLoopLagMs: 400,
    });
    slow.kind = 'journey';
    expect(requiresPerformanceAuditRouteRecovery(slow)).toBe(false);

    const structural = check('broken-route', 'fail', 10, {
      routeStateInvalidated: true,
    });
    structural.kind = 'journey';
    expect(requiresPerformanceAuditRouteRecovery(structural)).toBe(true);

    const nonTimingFailure = check('invalid-result', 'fail', 10, {
      nonTimingFailure: true,
    });
    nonTimingFailure.kind = 'journey';
    expect(requiresPerformanceAuditRouteRecovery(nonTimingFailure)).toBe(true);

    const errored = check('errored-route', 'fail', 10);
    errored.kind = 'journey';
    errored.error = 'route action failed';
    expect(requiresPerformanceAuditRouteRecovery(errored)).toBe(true);

    const interrupted = check('interrupted-route', 'skipped', 0, {
      interruptedByBackground: true,
    });
    interrupted.kind = 'journey';
    expect(requiresPerformanceAuditRouteRecovery(interrupted)).toBe(true);
  });

  it('aggregates paired cold and warm route timings', () => {
    const cold = check('journey-home-cold', 'fail', 1_000, {
      journeyId: 'home', journeyLabel: 'Home', iteration: 'cold', forwardMs: 700, backMs: 200,
    });
    cold.kind = 'journey';
    const warm = check('journey-home-warm', 'pass', 500, {
      journeyId: 'home', journeyLabel: 'Home', iteration: 'warm', forwardMs: 300, backMs: 100,
    });
    warm.kind = 'journey';
    expect(aggregateRepeatedJourneys([cold, warm])).toEqual([{
      journeyId: 'home',
      label: 'Home',
      coldStatus: 'fail',
      warmStatus: 'pass',
      coldForwardMs: 700,
      warmForwardMs: 300,
      coldBackMs: 200,
      warmBackMs: 100,
      forwardChangeMs: -400,
      backChangeMs: -100,
    }]);
  });

  it('does not aggregate skipped cold or warm routes', () => {
    const skipped = check('journey-disabled-cold', 'skipped', 0, {
      journeyId: 'disabled', journeyLabel: 'Disabled', iteration: 'cold',
    });
    skipped.kind = 'journey';
    const warm = check('journey-disabled-warm', 'pass', 100, {
      journeyId: 'disabled', journeyLabel: 'Disabled', iteration: 'warm', forwardMs: 50, backMs: 50,
    });
    warm.kind = 'journey';

    expect(aggregateRepeatedJourneys([skipped, warm])).toEqual([]);
  });
});

describe('performance audit maintenance isolation', () => {
  beforeEach(() => resetPerformanceAuditForTests());

  it('blocks optional route maintenance only while an audit is queued or running', () => {
    expect(isPerformanceAuditActive()).toBe(false);
    requestPerformanceAudit();
    expect(isPerformanceAuditActive()).toBe(true);

    completePerformanceAudit({
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      sessionId: 'done',
      startedAt: '2026-08-06T00:00:00.000Z',
      finishedAt: '2026-08-06T00:00:01.000Z',
      durationMs: 1_000,
      app: { appVersion: environment.appVersion, buildVersion: environment.buildVersion },
      watchdog: { hangTimeoutMs: 300_000, storedCheckCount: 0, lastStoredCheckAt: null },
      environment,
      summary: summarizePerformanceAudit([]),
      checks: [],
      routeAggregates: [],
      limitations: [],
    });
    expect(isPerformanceAuditActive()).toBe(false);
  });
});

describe('reported audit check selection', () => {
  function check(id: string, status: AuditCheck['status'], durationMs: number | null): AuditCheck {
    return { id, label: id, kind: 'journey', status, durationMs, metrics: {} };
  }

  it('renders every check for a short report', () => {
    const checks = [check('a', 'pass', 1), check('b', 'fail', 2)];
    expect(selectReportedAuditChecks(checks)).toEqual([checks[1], checks[0]]);
  });

  it('keeps every check reachable with non-pass checks before slowest passes', () => {
    const checks = [
      ...Array.from({ length: 300 }, (_, index) => check(`p${index}`, 'pass', index)),
      check('f1', 'fail', 5),
      check('w1', 'warn', 6),
      check('s1', 'skipped', 0),
      check('unmeasured', 'pass', null),
    ];

    const selected = selectReportedAuditChecks(checks);

    expect(selected).toHaveLength(checks.length);
    expect(selected.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['f1', 'w1', 's1', 'p299']),
    );
    expect(selected.map((entry) => entry.id)).toContain('p0');
    expect(selected.slice(0, 3).map((entry) => entry.id)).toEqual(['f1', 'w1', 's1']);
    expect(selected[3].id).toBe('p299');
    expect(selected.at(-1)?.id).toBe('unmeasured');
  });

  it('never hides failures when there are more than one UI page', () => {
    const checks = Array.from({ length: 300 }, (_, index) => check(`f${index}`, 'fail', index));
    expect(selectReportedAuditChecks(checks)).toHaveLength(300);
    expect(MAX_REPORTED_AUDIT_CHECKS).toBeLessThan(checks.length);
  });
});

describe('performance audit lifecycle', () => {
  beforeEach(() => resetPerformanceAuditForTests());

  const reportFixture = (sessionId: string) => ({
    schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
    sessionId,
    startedAt: '2026-08-08T00:00:00.000Z',
    finishedAt: '2026-08-08T00:01:00.000Z',
    durationMs: 60_000,
    app: { appVersion: environment.appVersion, buildVersion: environment.buildVersion },
    watchdog: {
      hangTimeoutMs: DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
      storedCheckCount: 0,
      lastStoredCheckAt: null,
    },
    environment,
    summary: summarizePerformanceAudit([]),
    checks: [],
    routeAggregates: [],
    limitations: [],
  });

  it('retains the completed report for the settings result screen', () => {
    const sessionId = requestPerformanceAudit();
    const report = {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      sessionId,
      startedAt: '2026-07-31T00:00:00.000Z',
      finishedAt: '2026-07-31T00:01:00.000Z',
      durationMs: 60_000,
      app: { appVersion: environment.appVersion, buildVersion: environment.buildVersion },
      watchdog: {
        hangTimeoutMs: DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
        storedCheckCount: 0,
        lastStoredCheckAt: null,
      },
      environment,
      summary: summarizePerformanceAudit([]),
      checks: [],
      routeAggregates: [],
      limitations: [],
    };
    completePerformanceAudit(report, {
      url: 'https://paste.example/audit',
      provider: 'test-provider',
      deleteKey: 'delete-key',
      linkCopied: false,
    });
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      sessionId,
      report,
      uploadUrl: 'https://paste.example/audit',
      uploadProvider: 'test-provider',
      uploadDeleteKey: 'delete-key',
      uploadLinkCopied: false,
      uploadDeleted: false,
      uploadError: null,
    });

    markPerformanceAuditUploadDeleted(sessionId);
    expect(getPerformanceAuditState()).toMatchObject({
      uploadUrl: null,
      uploadDeleteKey: null,
      uploadDeleted: true,
    });
  });

  it('synchronously rejects a second upload deletion until the first request releases', () => {
    const guard = { current: false };

    expect(claimPerformanceAuditUploadDeletion(guard)).toBe(true);
    expect(claimPerformanceAuditUploadDeletion(guard)).toBe(false);

    releasePerformanceAuditUploadDeletion(guard);
    expect(claimPerformanceAuditUploadDeletion(guard)).toBe(true);
  });

  it('publishes the report before the upload finishes and attaches its result later', () => {
    const sessionId = requestPerformanceAudit();
    const report = {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      sessionId,
      startedAt: '2026-08-08T00:00:00.000Z',
      finishedAt: '2026-08-08T00:01:00.000Z',
      durationMs: 60_000,
      app: { appVersion: environment.appVersion, buildVersion: environment.buildVersion },
      watchdog: {
        hangTimeoutMs: DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
        storedCheckCount: 0,
        lastStoredCheckAt: null,
      },
      environment,
      summary: summarizePerformanceAudit([]),
      checks: [],
      routeAggregates: [],
      limitations: [],
    };

    completePerformanceAudit(report, 'pending');
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      report,
      uploadPending: true,
      uploadUrl: null,
      uploadError: null,
    });

    setPerformanceAuditUploadResult(sessionId, { error: 'paste.rs did not respond in time.' });
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      report,
      uploadPending: false,
      uploadUrl: null,
      uploadError: 'paste.rs did not respond in time.',
    });
  });

  it('ignores a late upload result once the audit is no longer complete', () => {
    const sessionId = requestPerformanceAudit();
    setPerformanceAuditUploadResult(sessionId, { url: 'https://paste.example/late' });
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'queued',
      uploadUrl: null,
    });
  });

  it('drops an upload result belonging to a superseded session', () => {
    const reportFor = (sessionId: string) => ({
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      sessionId,
      startedAt: '2026-08-08T00:02:00.000Z',
      finishedAt: '2026-08-08T00:03:00.000Z',
      durationMs: 60_000,
      app: { appVersion: environment.appVersion, buildVersion: environment.buildVersion },
      watchdog: {
        hangTimeoutMs: DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
        storedCheckCount: 0,
        lastStoredCheckAt: null,
      },
      environment,
      summary: summarizePerformanceAudit([]),
      checks: [],
      routeAggregates: [],
      limitations: [],
    });

    const supersededSessionId = requestPerformanceAudit();
    completePerformanceAudit(reportFor(supersededSessionId), 'pending');
    // The user starts and finishes another audit while the first upload is
    // still in flight.
    const latestSessionId = requestPerformanceAudit();
    const latestReport = reportFor(latestSessionId);
    completePerformanceAudit(latestReport, 'pending');

    setPerformanceAuditUploadResult(supersededSessionId, {
      url: 'https://paste.example/superseded',
    });

    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      report: latestReport,
      uploadUrl: null,
      uploadPending: true,
    });
  });

  it('pauses and resumes a running audit instead of discarding it', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);

    pausePerformanceAudit();
    expect(getPerformanceAuditState()).toMatchObject({ status: 'running', paused: true });
    // A paused run is still active, so route maintenance stays suppressed.
    expect(isPerformanceAuditActive()).toBe(true);

    resumePerformanceAudit();
    expect(getPerformanceAuditState()).toMatchObject({ status: 'running', paused: false });
  });

  it('counts each pause so a step can tell whether it spanned one', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    const before = getPerformanceAuditPauseCount();

    pausePerformanceAudit();
    pausePerformanceAudit(); // already paused; not a second interruption
    expect(getPerformanceAuditPauseCount()).toBe(before + 1);

    resumePerformanceAudit();
    pausePerformanceAudit();
    expect(getPerformanceAuditPauseCount()).toBe(before + 2);
  });

  it('clears the pause when the run reaches a terminal state', () => {
    const sessionId = requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    pausePerformanceAudit();

    completePerformanceAudit(reportFixture(sessionId), 'pending');

    // resumePerformanceAudit refuses terminal states, so a pause left set here
    // could never be cleared and every ForegroundElapsed built afterwards for
    // the post-publish upload would accrue nothing and never time out.
    expect(getPerformanceAuditState().paused).toBe(false);
    expect(new ForegroundElapsed(() => 0).foregroundMs).toBe(0);
  });

  it('keeps pause tracking while a published report is still uploading', () => {
    const sessionId = requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    completePerformanceAudit(reportFixture(sessionId), 'pending');

    // The upload runs on a foreground budget, so it still needs transitions.
    pausePerformanceAudit();
    expect(getPerformanceAuditState().paused).toBe(true);
    resumePerformanceAudit();
    expect(getPerformanceAuditState().paused).toBe(false);

    pausePerformanceAudit();
    setPerformanceAuditUploadResult(sessionId, { url: 'https://paste.example/audit' });
    // Nothing is left to clear a pause once the upload has settled.
    expect(getPerformanceAuditState()).toMatchObject({ uploadPending: false, paused: false });
  });

  it('never pauses a cancelled or finished audit', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    cancelPerformanceAudit();

    pausePerformanceAudit();

    // Pausing a cancelling run would strand it waiting for a foreground it no
    // longer needs.
    expect(getPerformanceAuditState()).toMatchObject({ cancelRequested: true, paused: false });
  });

  it('stores a validated custom hang timeout on the queued audit', () => {
    requestPerformanceAudit({ hangTimeoutMs: 420_000 });
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'queued',
      hangTimeoutMs: 420_000,
      storedCheckCount: 0,
      lastStoredCheckAt: null,
    });
  });
});

describe('interrupted check latency stripping', () => {
  // A failure observed before an interruption is real and stays a failure, so it
  // remains in the summary's completed set. Its timings are not usable, and
  // AUDIT_LATENCY_METRIC_KEYS is what the runner strips to keep them out.
  const stripped = (metrics: AuditCheck['metrics']) => {
    const out = { ...metrics };
    for (const key of AUDIT_LATENCY_METRIC_KEYS) delete out[key];
    return out;
  };

  it('covers every metric the summary can read as a latency', () => {
    const contaminated = Object.fromEntries(
      AUDIT_LATENCY_METRIC_KEYS.map((key) => [key, 300_000]),
    );
    // One per special case in representativeLatency, plus a plain journey.
    const ids = ['runtime-responsiveness', 'active-data', 'async-storage', 'file-system'];
    for (const id of ids) {
      const summary = summarizePerformanceAudit([
        { ...check(id, 'fail', 0, stripped(contaminated)), kind: 'runtime' },
        check('healthy', 'pass', 12, {}),
      ]);
      expect(summary.slowestCheckId).toBe('healthy');
      expect(summary.maxEventLoopLagMs).toBe(0);
      expect(summary.maxFrameGapMs).toBe(0);
    }

    const journey = summarizePerformanceAudit([
      { ...check('deep-step', 'fail', 0, stripped(contaminated)), kind: 'journey' },
      check('healthy', 'pass', 12, {}),
    ]);
    expect(journey.slowestCheckId).toBe('healthy');
  });

  it('strips every timing the report or log would show, not only the summary keys', () => {
    // The check-results screen renders backgroundSettleMs and actionMs, and the
    // uploaded log carries the rest, so a check whose reason says timings are
    // not reported must not still carry any of them.
    const contaminated = {
      backgroundSettleMs: 300_000,
      actionMs: 300_000,
      headersMs: 300_000,
      bodyMs: 300_000,
      readinessQuietWindowMs: 650,
      forwardMs: 300_000,
      runtimeErrors: 0,
      expectedSurface: 'search.results',
    };
    const out = { ...contaminated } as Record<string, unknown>;
    for (const key of Object.keys(out)) {
      if (key.endsWith('Ms')) delete out[key];
    }
    expect(Object.keys(out).sort()).toEqual(['expectedSurface', 'runtimeErrors']);
    // Every summary-consumed key is covered by the same suffix rule.
    for (const key of AUDIT_LATENCY_METRIC_KEYS) expect(key.endsWith('Ms')).toBe(true);
  });

  it('would otherwise let a minutes-long interrupted reading win', () => {
    const summary = summarizePerformanceAudit([
      { ...check('deep-step', 'fail', 0, { forwardMs: 300_000 }), kind: 'journey' },
      check('healthy', 'pass', 12, {}),
    ]);
    expect(summary.slowestCheckId).toBe('deep-step');
  });
});

describe('foreground elapsed budget', () => {
  beforeEach(() => resetPerformanceAuditForTests());

  it('defaults to a monotonic clock rather than the wall clock', () => {
    // Automatic time correction moving the wall clock would otherwise blow a
    // budget instantly or postpone the only active timeout indefinitely.
    const elapsed = new ForegroundElapsed();
    const before = performance.now();
    elapsed.accrue();
    const after = performance.now();
    // A Date.now()-based default would report ~1.7e12 here.
    expect(elapsed.foregroundMs).toBeLessThanOrEqual(after - before + 50);
  });

  it('charges only time the audit spent on screen', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    let nowMs = 0;
    const elapsed = new ForegroundElapsed(() => nowMs);

    nowMs = 1_000;
    elapsed.accrue();
    expect(elapsed.foregroundMs).toBe(1_000);

    pausePerformanceAudit();
    elapsed.accrue();
    nowMs = 301_000;
    resumePerformanceAudit();
    elapsed.accrue();

    // Five minutes off screen must not reach a two-minute budget.
    expect(elapsed.foregroundMs).toBe(1_000);
  });

  it('does not charge a suspended poll for the span it slept through', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    let nowMs = 0;
    const elapsed = new ForegroundElapsed(() => nowMs);
    // The runner accrues on every store emission as well as on its poll, which
    // is what closes the span at the transition.
    const unsubscribe = subscribePerformanceAudit(() => elapsed.accrue());
    try {
      nowMs = 1_000;
      elapsed.accrue();

      // Android suspends the JS thread: no poll ticks fire for the whole pause,
      // and the first one to run does so after `resume` cleared the flag.
      pausePerformanceAudit();
      nowMs = 301_000;
      resumePerformanceAudit();
      nowMs = 301_050;
      elapsed.accrue();

      expect(elapsed.foregroundMs).toBe(1_050);
    } finally {
      unsubscribe();
    }
  });

  it('still charges a foreground stall, which is a real hang', () => {
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    let nowMs = 0;
    const elapsed = new ForegroundElapsed(() => nowMs);

    nowMs = 130_000;
    elapsed.accrue();
    expect(elapsed.foregroundMs).toBe(130_000);
  });
});

describe('performance audit inactivity watchdog', () => {
  beforeEach(() => resetPerformanceAuditForTests());

  it('uses the five-minute default and accepts a custom timeout', () => {
    let elapsedMs = 0;
    const clock = () => elapsedMs;
    expect(new PerformanceAuditInactivityWatchdog(undefined, clock).hangTimeoutMs).toBe(
      300_000,
    );
    expect(new PerformanceAuditInactivityWatchdog(420_000, clock).hangTimeoutMs).toBe(
      420_000,
    );
  });

  it('parses only persisted whole-second values inside the safe range', () => {
    expect(parsePerformanceAuditHangTimeoutSeconds('300')).toBe(300);
    expect(parsePerformanceAuditHangTimeoutSeconds(' 420 ')).toBe(420);
    expect(parsePerformanceAuditHangTimeoutSeconds(null)).toBeNull();
    expect(parsePerformanceAuditHangTimeoutSeconds('29')).toBeNull();
    expect(parsePerformanceAuditHangTimeoutSeconds('3601')).toBeNull();
    expect(parsePerformanceAuditHangTimeoutSeconds('5 minutes')).toBeNull();
  });

  it('resets only when a completed check is recorded as stored', () => {
    let elapsedMs = 1_000;
    const watchdog = new PerformanceAuditInactivityWatchdog(300_000, () => elapsedMs);

    elapsedMs += 240_000;
    expect(watchdog.isExpired()).toBe(false);
    expect(watchdog.storedCheckCount).toBe(0);
    watchdog.recordStoredCheck();
    expect(watchdog.storedCheckCount).toBe(1);
    expect(watchdog.remainingMs()).toBe(300_000);
  });

  it('allows a run longer than five minutes while stored checks keep progressing', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(300_000, () => elapsedMs);

    elapsedMs += 240_000;
    watchdog.recordStoredCheck();
    elapsedMs += 240_000;
    expect(elapsedMs).toBeGreaterThan(300_000);
    expect(watchdog.isExpired()).toBe(false);
    watchdog.recordStoredCheck();
    elapsedMs += 240_000;
    expect(watchdog.isExpired()).toBe(false);
    expect(watchdog.storedCheckCount).toBe(2);
  });

  it('expires after genuine inactivity', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(300_000, () => elapsedMs);

    elapsedMs = 299_999;
    expect(watchdog.isExpired()).toBe(false);
    elapsedMs = 300_000;
    expect(watchdog.isExpired()).toBe(true);
    expect(watchdog.remainingMs()).toBe(0);
  });

  it('touchProgress resets the hang timer without counting a stored check', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(300_000, () => elapsedMs);

    elapsedMs = 290_000;
    watchdog.touchProgress();
    elapsedMs = 580_000;
    expect(watchdog.storedCheckCount).toBe(0);
    expect(watchdog.isExpired()).toBe(false);
    elapsedMs = 590_001;
    expect(watchdog.isExpired()).toBe(true);
  });

  it('does not count time spent backgrounded as a hang', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => elapsedMs);

    watchdog.recordStoredCheck();
    watchdog.setPaused(true);
    // A step in flight when the app backgrounds keeps polling isExpired(); a
    // short hang timeout plus a phone call must not abort the run as hung.
    elapsedMs = 120_000;
    expect(watchdog.isPaused).toBe(true);
    expect(watchdog.isExpired()).toBe(false);

    // Resuming restarts the window rather than resuming a spent one.
    watchdog.setPaused(false);
    expect(watchdog.isExpired()).toBe(false);
    elapsedMs = 145_000;
    expect(watchdog.isExpired()).toBe(false);
    elapsedMs = 150_001;
    expect(watchdog.isExpired()).toBe(true);
  });

  it('adopts a pause that began before the watchdog existed', () => {
    // The run gate can hold a queued audit past a pause, so the runner seeds the
    // watchdog from current state before subscribing. Without the seed the
    // watchdog never learns it was paused, and the resume that follows resets
    // nothing.
    requestPerformanceAudit();
    markPerformanceAuditRunning(10);
    pausePerformanceAudit();

    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => elapsedMs);
    const mirror = () => watchdog.setPaused(getPerformanceAuditState().paused);
    mirror();
    const unsubscribe = subscribePerformanceAudit(mirror);
    try {
      expect(watchdog.isPaused).toBe(true);
      elapsedMs = 120_000;
      expect(watchdog.isExpired()).toBe(false);

      resumePerformanceAudit();
      expect(watchdog.isPaused).toBe(false);
      elapsedMs = 149_000;
      expect(watchdog.isExpired()).toBe(false);
      elapsedMs = 150_001;
      expect(watchdog.isExpired()).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('beginFinalization suspends hang expiry for report persistence and upload', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => elapsedMs);

    watchdog.recordStoredCheck();
    elapsedMs = 60_000;
    expect(watchdog.isExpired()).toBe(true);

    watchdog.beginFinalization();
    expect(watchdog.remainingMs()).toBe(30_000);
    elapsedMs = 600_000;
    expect(watchdog.isFinalizing).toBe(true);
    expect(watchdog.isExpired()).toBe(false);
  });
});

describe('audit logfile error formatting', () => {
  it('keeps UI-facing stacks multi-line and logfile stacks on one physical line', () => {
    const error = new Error('Mounted action completion was not observed');
    const ui = formatAuditError(error);
    const log = formatAuditErrorForLog(error);

    expect(ui).toContain('Mounted action completion was not observed');
    expect(ui).toContain('\n');
    expect(log).toContain('Mounted action completion was not observed');
    expect(log).toContain(String.raw`\n`);
    expect(log).not.toContain('\n');
    expect(flattenAuditLogText('a\r\nb\nc')).toBe(String.raw`a\nb\nc`);
  });
});
