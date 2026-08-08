import type { CorePayload } from '../src/types';
import {
  aggregateRepeatedJourneys,
  buildPerformanceAuditJourneys,
  completePerformanceAudit,
  DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  flattenAuditLogText,
  formatAuditError,
  formatAuditErrorForLog,
  getPerformanceAuditState,
  isPerformanceAuditActive,
  parsePerformanceAuditHangTimeoutSeconds,
  pathMatches,
  PerformanceAuditInactivityWatchdog,
  percentile,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  requestPerformanceAudit,
  resolveAuditJourneyOptionalData,
  resetPerformanceAuditForTests,
  scoreLatency,
  summarizePerformanceAudit,
  summarizeResponsiveness,
  worstStatus,
  type AuditCheck,
  type AuditEnvironment,
} from '../src/lib/performanceAudit';

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
      slowestCheckId: 'slow',
      slowestCheckMs: 200,
      maxEventLoopLagMs: 350,
      maxFrameGapMs: 80,
    });
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

describe('performance audit lifecycle', () => {
  beforeEach(() => resetPerformanceAuditForTests());

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
    });
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      sessionId,
      report,
      uploadUrl: 'https://paste.example/audit',
      uploadProvider: 'test-provider',
      uploadError: null,
    });
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

describe('performance audit inactivity watchdog', () => {
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

  it('beginFinalization suspends hang expiry for report persistence and upload', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => elapsedMs);

    watchdog.recordStoredCheck();
    elapsedMs = 60_000;
    expect(watchdog.isExpired()).toBe(true);

    watchdog.beginFinalization();
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
