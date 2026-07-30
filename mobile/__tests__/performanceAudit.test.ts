import type { CorePayload } from '../src/types';
import {
  buildPerformanceAuditJourneys,
  completePerformanceAudit,
  getPerformanceAuditState,
  pathMatches,
  percentile,
  requestPerformanceAudit,
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
    expect(journeys).toHaveLength(18);
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
        'lenders',
        'profile',
        'product',
        'lender',
        'compare',
        'terms',
        'debug-log',
      ]),
    );
    expect(journeys.find((journey) => journey.id === 'product')?.href).toBeDefined();
    expect(journeys.find((journey) => journey.id === 'compare')?.href).toBeDefined();
  });

  it('keeps data-dependent journeys visible but skipped when no payload exists', () => {
    const journeys = buildPerformanceAuditJourneys(null);
    expect(journeys.find((journey) => journey.id === 'product')).toMatchObject({
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
});

describe('performance audit lifecycle', () => {
  beforeEach(() => resetPerformanceAuditForTests());

  it('retains the completed report for the settings result screen', () => {
    const sessionId = requestPerformanceAudit();
    const report = {
      schemaVersion: 1,
      sessionId,
      startedAt: '2026-07-31T00:00:00.000Z',
      finishedAt: '2026-07-31T00:01:00.000Z',
      durationMs: 60_000,
      environment,
      summary: summarizePerformanceAudit([]),
      checks: [],
      limitations: [],
    };
    completePerformanceAudit(report);
    expect(getPerformanceAuditState()).toMatchObject({
      status: 'complete',
      sessionId,
      report,
    });
  });
});
