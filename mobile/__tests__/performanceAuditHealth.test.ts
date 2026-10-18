import type { AuditCheck } from '../src/lib/performanceAudit';
import { summarizePartialPerformanceAudit } from '../src/lib/performanceAudit';
import {
  appHealthDataSnapshot,
  appHealthDisplayObservations,
  appHealthSurfaceContracts,
  buildIntegratedAppHealthReport,
  buildPartialAppHealthReport,
  captureAppHealthDataEvidence,
  combineAppHealthPerformanceSummary,
} from '../src/lib/performanceAuditHealth';
import type { AppState } from '../src/data/storeTypes';
import type { DeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { evaluateAppHealthDisplayQuality } from '../src/lib/appHealth/displayQuality';
import { APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth/types';
import { makeHealthyDataFixture } from '../__fixtures__/appHealth';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { ANDROID_UPDATE_READINESS_AUDIT } from '../src/lib/performanceAuditCheckInventory';

function check(readinessEvidence: string): AuditCheck {
  return {
    id: readinessEvidence,
    label: 'Display probe',
    kind: 'journey',
    status: 'pass',
    durationMs: 1,
    metrics: { readinessEvidence },
  };
}

describe('integrated app-health display evidence', () => {
  function updateDisplayReport(readinessEvidence: string, mode: 'local' | 'live-source' = 'live-source') {
    const { snapshot } = makeHealthyDataFixture();
    const owner = ANDROID_UPDATE_READINESS_AUDIT;
    return buildIntegratedAppHealthReport({
      sessionId: 'dedicated-update-display', mode, startedAt: '2026-10-15T10:00:00Z',
      finishedAt: '2026-10-15T10:00:01Z', appVersion: '1.0.0',
      state: {} as AppState, dataSnapshot: snapshot, journeys: [],
      plan: { passes: [] } as unknown as DeepPerformanceAuditPlan,
      performanceChecks: [{ ...check(readinessEvidence), id: owner.checkId, kind: owner.kind,
        status: mode === owner.executionMode ? 'fail' : 'skipped',
        metrics: { readinessEvidence, executionAttempted: mode === owner.executionMode } }],
      network: { mode, authorizationAttempts: 0, authorizedAttempts: 0, blockedAttempts: 0,
        transportCalls: 0, policyViolations: 0 },
    }).checks;
  }

  it('declares the dedicated Settings update owner without inventing display evidence', () => {
    const surface = ANDROID_UPDATE_READINESS_AUDIT.expectedSurface;
    const checks = updateDisplayReport([
      `${surface}:app-update.layout:layout:ready::measured=1`,
      `${surface}:app-update.result:data:ready:1/1`,
    ].join(' | '));
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT))
      .toMatchObject({ status: 'pass', metrics: { plannedSurfaces: 1, unexpectedSurfaces: 0 } });
    for (const code of [APP_HEALTH_CHECK_CODES.DISPLAY_MODEL, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT]) {
      expect(checks.find(entry => entry.code === code)).toMatchObject({ status: 'pass', metrics: { checked: 1 } });
    }
  });

  it('keeps a timed-out dedicated update result pending rather than promoting its measured layout', () => {
    const surface = ANDROID_UPDATE_READINESS_AUDIT.expectedSurface;
    const checks = updateDisplayReport([
      `${surface}:app-update.layout:layout:ready::measured=1`,
      `${surface}:app-update.result:data:pending:0/1:required=0`,
    ].join(' | '));
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT)?.status).toBe('pass');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_MODEL))
      .toMatchObject({ status: 'fail', metrics: { missing: 1 } });
  });

  it('requires the declared dedicated owner to supply actual layout and data probes', () => {
    const checks = updateDisplayReport('');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT))
      .toMatchObject({ status: 'fail', metrics: { missingSurfaces: 1 } });
    for (const code of [APP_HEALTH_CHECK_CODES.DISPLAY_MODEL, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT]) {
      expect(checks.find(entry => entry.code === code)).toMatchObject({ status: 'fail', metrics: { missing: 1 } });
    }
  });

  it('does not admit arbitrary Settings surfaces beside the exact dedicated descriptor', () => {
    const checks = updateDisplayReport('settings.app-update.other:layout:layout:ready::measured=1');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT))
      .toMatchObject({ status: 'fail', metrics: { missingSurfaces: 1, unexpectedSurfaces: 1 },
        localEvidence: { unexpectedSurfaceIds: ['settings.app-update.other'] } });
  });

  it('requires Local Android layout without claiming its suppressed metadata was measured', () => {
    const surface = ANDROID_UPDATE_READINESS_AUDIT.expectedSurface;
    const checks = updateDisplayReport([
      `${surface}:app-update.layout:layout:ready::measured=1`,
      `${surface}:app-update.result:data:pending:0/1:required=0`,
    ].join(' | '), 'local');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT))
      .toMatchObject({ status: 'pass', metrics: { plannedSurfaces: 1, observedSurfaces: 1 } });
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT)?.status).toBe('pass');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_MODEL)?.status).toBe('not-run');
  });

  it('does not invent a missing live update surface for a local snapshot that never visited it', () => {
    const checks = updateDisplayReport('', 'local');
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT))
      .toMatchObject({ status: 'not-run', metrics: { missingSurfaces: 0, plannedSurfaces: 0 } });
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT)?.status).toBe('not-run');
  });

  it('retains a terminal failed result even when its data probe is optional', () => {
    const surface = ANDROID_UPDATE_READINESS_AUDIT.expectedSurface;
    const checks = updateDisplayReport([
      `${surface}:app-update.layout:layout:ready::measured=1`,
      `${surface}:app-update.result:data:error:0/1:required=0`,
    ].join(' | '));
    expect(checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_MODEL))
      .toMatchObject({ status: 'fail', metrics: { failed: 1 } });
  });

  it('never discards a pending required model as optional work', () => {
    expect(appHealthDisplayObservations([check('screen:data:data:pending:0/1:required=1')]))
      .toEqual([{ surfaceId: 'screen', evidence: [{ role: 'model', sourceCount: 1, modelCount: 0 }] }]);
  });

  it('includes app catalogue evidence in live-source reports only for the same verified publication', () => {
    const { snapshot } = makeHealthyDataFixture();
    const normalized = normalizeCoreWithIntegrity(snapshot.core!, { coreSha256: snapshot.manifest!.files.core.sha256 });
    const state = { core: normalized.core, coreIntegrity: normalized.integrity, manifest: snapshot.manifest,
      prefs: { ...DEFAULT_PREFS, includeNonStandard: true }, details: null, searchIndex: null } as unknown as AppState;
    const report = (current: AppState, remote = snapshot) => buildIntegratedAppHealthReport({
      sessionId: 'live-catalogue-binding', mode: 'live-source', startedAt: '2026-10-12T00:00:00Z',
      finishedAt: '2026-10-12T00:00:01Z', state: current, appVersion: '1.0.0',
      performanceChecks: [], journeys: [], plan: { passes: [] } as unknown as DeepPerformanceAuditPlan,
      network: { mode: 'live-source', authorizationAttempts: 0, authorizedAttempts: 0, blockedAttempts: 0,
        transportCalls: 0, policyViolations: 0 }, dataSnapshot: remote,
    }).checks.find(check => check.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE)!;
    expect(report(state).metrics.catalogueAvailable).toBe(true);
    expect(report({ ...state, coreIntegrity: null })).toMatchObject({ status: 'unavailable', metrics: { catalogueAvailable: false } });
    const revised = { ...snapshot, manifest: { ...snapshot.manifest!, files: { ...snapshot.manifest!.files,
      core: { ...snapshot.manifest!.files.core, sha256: 'c'.repeat(64) } } } };
    expect(report(state, revised)).toMatchObject({ status: 'unavailable', metrics: { catalogueAvailable: false } });
    const wrongDate = { ...snapshot, core: { ...snapshot.core!, run_date: '2026-10-11' } };
    expect(report(state, wrongDate)).toMatchObject({ status: 'unavailable', metrics: { catalogueAvailable: false } });
  });

  it.each([false, true])('keeps empty and populated list evidence coherent (reverse=%s)', reverse => {
    const visits = [
      check('search.results:items:list:ready:12/12:visible=4:empty=0'),
      check('search.results:items:list:ready:0/0:visible=0:empty=1'),
    ];
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'search.results', requiredRoles: ['list', 'visible', 'empty-state'], allowsIntentionalEmpty: true }],
      appHealthDisplayObservations(reverse ? visits.reverse() : visits),
    );
    for (const code of [APP_HEALTH_CHECK_CODES.DISPLAY_LIST, APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY,
      APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE]) {
      expect(result.find(entry => entry.code === code)?.status).toBe('pass');
    }
  });

  it.each([false, true])('retains distinct list failures across visits (reverse=%s)', reverse => {
    const visits = [
      check('search.results:items:list:ready:0/0:visible=0:empty=0'),
      check('search.results:items:list:ready:12/12:visible=0:empty=0'),
    ];
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'search.results', requiredRoles: ['list', 'visible', 'empty-state'], allowsIntentionalEmpty: true }],
      appHealthDisplayObservations([
        ...(reverse ? visits.reverse() : visits),
        check('search.results:items:list:ready:20/20:visible=4:empty=0'),
      ]),
    );
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LIST)?.status).toBe('pass');
    for (const code of [APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY, APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE]) {
      expect(result.find(entry => entry.code === code)).toMatchObject({
        status: 'fail', metrics: { checked: 1, failed: 1 },
        localEvidence: { failedSurfaceIds: ['search.results'] },
      });
    }
  });

  it.each([false, true])('retains missing rows alongside virtualized visits (reverse=%s)', reverse => {
    const visits = [
      check('search.results:items:list:ready:0/12:visible=0:empty=0'),
      check('search.results:items:list:ready:4/12:visible=4:empty=0'),
    ];
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'search.results', requiredRoles: ['list', 'visible', 'empty-state'] }],
      appHealthDisplayObservations(reverse ? visits.reverse() : visits),
    );
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LIST))
      .toMatchObject({ status: 'fail', metrics: { checked: 1, failed: 1 } });
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE)?.status).toBe('pass');
  });

  it('does not erase a missing empty-state after a later populated visit', () => {
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'search.results', requiredRoles: ['list', 'empty-state'], allowsIntentionalEmpty: true }],
      appHealthDisplayObservations([
        check('search.results:items:list:ready:0/0:visible=0:empty=0'),
        check('search.results:items:list:ready:12/12:visible=4:empty=0'),
      ]),
    );
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE)?.status).toBe('fail');
  });

  it('reports an attempted deep-search failure as a failed asset', () => {
    const snapshot = appHealthDataSnapshot({
      source: 'network',
      core: null,
      coreAssetState: { status: 'idle' },
      details: null,
      searchIndex: null,
      searchIndexStatus: 'error',
      historyBanks: null,
      historyBanksError: null,
      bankInsights: null,
      bankInsightsError: null,
      bankSpreadHistory: null,
      bankSpreadHistoryError: null,
      rbaCalendar: null,
      rbaCalendarError: null,
      manifest: null,
      coreIntegrity: null,
    } as unknown as AppState, '1.0.180');

    expect(snapshot.assets?.search_index).toMatchObject({
      state: 'failed',
      runDate: null,
      itemCount: null,
    });
  });

  it('maps independent model, list, logo, chart and layout probes', () => {
    const observations = appHealthDisplayObservations([
      check([
        'browse.screen:probe:data:ready:12/12',
        'browse.screen:probe:list:ready:10/12:revision:render:visible=4:empty=0',
        'browse.screen:probe:logo:ready:8/10:revision:render:fallback=3',
        'browse.screen:probe:graphic:ready:6/6:summary=1:measured=1',
        'browse.screen:probe:layout:ready:1/1:measured=1',
      ].join(' | ')),
    ]);

    expect(observations).toEqual([{
      surfaceId: 'browse.screen',
      evidence: [
        { role: 'model', sourceCount: 12, modelCount: 12 },
        { role: 'list', modelCount: 12, renderedCount: 10 },
        { role: 'visible', expectedMinimum: 1, visibleCount: 4 },
        { role: 'empty-state', expected: false, rendered: false },
        { role: 'logo', expectedCount: 10, decodedCount: 5, fallbackCount: 3, missingCount: 2 },
        { role: 'critical-layout', measured: true, width: null, height: null },
        { role: 'chart', modelPointCount: 6, renderedPointCount: 6, accessibleSummary: true,
          layoutMeasured: true, emptyStateRendered: true, unverifiedCount: 0, unavailableCount: 0 },
      ],
    }]);
  });

  it('retains the highest observed count from repeated cold and warm probes', () => {
    const observations = appHealthDisplayObservations([
      check('browse.screen:probe:list:ready:9/12:::visible=3:empty=0'),
      check('browse.screen:probe:list:ready:10/12:::visible=4:empty=0'),
      check('browse.screen:probe:list:ready:8/12:::visible=2:empty=0'),
    ]);

    expect(observations[0]?.evidence).toEqual([
      { role: 'list', modelCount: 12, renderedCount: 10 },
      { role: 'visible', expectedMinimum: 1, visibleCount: 4 },
      { role: 'empty-state', expected: false, rendered: false },
    ]);
  });

  it('keeps each expected chart so a healthy sibling cannot mask a missing graph', () => {
    const observations = appHealthDisplayObservations([
      check([
        'outlook.dashboard:history:graphic:ready:1/1:summary=1:measured=1',
        'outlook.dashboard:economy:graphic:ready:0/1:summary=0:measured=0',
      ].join(' | ')),
    ]);

    expect(observations[0]?.evidence).toContainEqual({
      role: 'chart',
      modelPointCount: 2,
      renderedPointCount: 1,
      accessibleSummary: false,
      layoutMeasured: false, emptyStateRendered: true, unverifiedCount: 1, unavailableCount: 0,
    });
  });

  it('does not invent graph counts and retains a failure across repeat visits', () => {
    const contracts = [{ id: 'screen', requiredRoles: ['chart' as const], chartRequired: true }];
    const observations = appHealthDisplayObservations([
      check('screen:plot:graphic:ready::measured=1:summary=1'),
      check('screen:plot:graphic:ready:2/2:measured=1:summary=1'),
    ]);
    expect(evaluateAppHealthDisplayQuality(contracts, observations)
      .find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)?.status).toBe('fail');
  });

  it.each([false, true])('does not turn incidental optional chart loading into a failed completed chart check (reverse=%s)', reverse => {
    const visits = [
      check('product.details:history:graphic:pending:15/15:required=0:empty=0:measured=1:summary=1'),
      check('product.details:history:graphic:ready:15/15:required=1:empty=0:measured=1:summary=1'),
    ];
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'product.details', requiredRoles: ['chart'], chartRequired: true }],
      appHealthDisplayObservations(reverse ? visits.reverse() : visits),
    );
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART))
      .toMatchObject({ status: 'pass', metrics: { checked: 1, failed: 0 } });
    // Loading alone is not rendered proof or positive coverage.
    expect(appHealthDisplayObservations([check('product.details:history:graphic:pending:15/15:required=0:measured=1:summary=1')]))
      .toEqual([]);
  });

  it.each([
    'pending:15/15:required=1:measured=1:summary=1',
    'ready:15/15:required=0:measured=1:summary=0',
    'ready:14/15:required=0:measured=1:summary=1',
    'error:15/15:required=0:measured=1:summary=1',
  ])('retains actual chart failures after a later successful visit (%s)', failure => {
    const result = evaluateAppHealthDisplayQuality(
      [{ id: 'product.details', requiredRoles: ['chart'], chartRequired: true }],
      appHealthDisplayObservations([
        check(`product.details:history:graphic:${failure}`),
        check('product.details:history:graphic:ready:15/15:required=1:measured=1:summary=1'),
      ]),
    );
    expect(result.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)?.status).toBe('fail');
  });

  it('distinguishes a measured no-data state from a rendered graph', () => {
    const contracts = [{ id: 'screen', requiredRoles: ['chart' as const], chartRequired: true }];
    expect(evaluateAppHealthDisplayQuality(contracts, appHealthDisplayObservations([
      check('screen:plot:graphic:ready:0/0:required=0:measured=1:empty=1:summary=1'),
    ])).find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)?.status).toBe('unavailable');
  });

  it('retains a no-data lens even when another visit to the same graph has data', () => {
    const contracts = [{ id: 'screen', requiredRoles: ['chart' as const], chartRequired: true }];
    expect(evaluateAppHealthDisplayQuality(contracts, appHealthDisplayObservations([
      check('screen:plot:graphic:ready:2/2:measured=1:summary=1'),
      check('screen:plot:graphic:ready:0/0:required=1:measured=1:empty=1'),
      check('screen:plot:graphic:ready:3/3:measured=1:summary=1'),
    ])).find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)?.status).toBe('unavailable');
  });

  it('records an explicitly rendered empty state for an empty settled list', () => {
    expect(appHealthDisplayObservations([
      check('saved.list:items:list:ready:0/0:::visible=0:empty=1'),
    ])[0]?.evidence).toEqual([
      { role: 'list', modelCount: 0, renderedCount: 0 },
      { role: 'visible', expectedMinimum: 0, visibleCount: 0 },
      { role: 'empty-state', expected: true, rendered: true },
    ]);
  });

  it('does not invent empty-state or visibility evidence from a list count', () => {
    expect(appHealthDisplayObservations([
      check('saved.list:items:list:ready:0/0'),
    ])[0]?.evidence).toEqual([
      { role: 'list', modelCount: 0, renderedCount: 0 },
    ]);
  });

  it('requires independent list roles only on surfaces instrumented to capture them', () => {
    const plan = {
      passes: [{
        steps: [
          { expectedSurface: 'browse.hierarchy', readiness: ['list'] },
          { expectedSurface: 'calculator.results', readiness: ['list'] },
          { expectedSurface: 'debug-log.entries', readiness: ['list'] },
        ],
      }],
    } as unknown as DeepPerformanceAuditPlan;

    const contracts = appHealthSurfaceContracts([], plan);
    expect(contracts.find(({ id }) => id === 'browse.hierarchy')?.requiredRoles).toEqual([
      'model',
      'critical-layout',
      'list',
      'visible',
      'empty-state',
    ]);
    expect(contracts.find(({ id }) => id === 'calculator.results')?.requiredRoles).toEqual([
      'model',
      'critical-layout',
      'list',
    ]);
    expect(contracts.find(({ id }) => id === 'debug-log.entries')?.requiredRoles).toEqual([
      'model',
      'critical-layout',
      'list',
    ]);
  });

  it('fails explicit visibility evidence when rendered rows are not viewable', () => {
    const checks = evaluateAppHealthDisplayQuality(
      [{ id: 'browse.screen', requiredRoles: ['list', 'visible'] }],
      appHealthDisplayObservations([
        check('browse.screen:items:list:ready:10/10:::visible=0:empty=0'),
      ]),
    );

    expect(checks.find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY))
      .toMatchObject({ status: 'fail', metrics: { failed: 1 } });
  });

  it('requires explicit layout measurement evidence rather than inferring it from readiness', () => {
    const checks = evaluateAppHealthDisplayQuality(
      [{ id: 'today.hero', requiredRoles: ['critical-layout'] }],
      appHealthDisplayObservations([check('today.hero:layout:layout:ready:1/1:measured=1')]),
    );
    expect(checks.find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT)?.status)
      .toBe('pass');

    const missing = evaluateAppHealthDisplayQuality(
      [{ id: 'today.hero', requiredRoles: ['critical-layout'] }],
      appHealthDisplayObservations([check('today.hero:layout:layout:ready:1/1')]),
    );
    expect(missing.find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT)?.status)
      .toBe('fail');
  });
});

describe('fatal app-health evidence', () => {
  const plan = { passes: [{ steps: [
    { expectedSurface: 'search.results', readiness: ['data', 'list', 'layout'] },
    { expectedSurface: 'unvisited.screen', readiness: ['data', 'layout'] },
  ] }] } as unknown as DeepPerformanceAuditPlan;
  const input = {
    sessionId: 'interrupted', mode: 'local' as const, startedAt: '2026-10-12T00:00:00Z',
    finishedAt: '2026-10-12T00:00:10Z', journeys: [], plan,
    network: { mode: 'local' as const, authorizationAttempts: 0, authorizedAttempts: 0,
      blockedAttempts: 0, transportCalls: 0, policyViolations: 0 },
  };

  it('retains detached initial data and bank/category evidence after the store and profile change', () => {
    const { snapshot } = makeHealthyDataFixture();
    const normalized = normalizeCoreWithIntegrity(snapshot.core!, { coreSha256: snapshot.manifest!.files.core.sha256 });
    const state = { source: 'network', core: normalized.core, coreIntegrity: normalized.integrity,
      manifest: snapshot.manifest, prefs: { ...DEFAULT_PREFS, includeNonStandard: true },
      details: null, searchIndex: null } as unknown as AppState;
    const capturedData = captureAppHealthDataEvidence({ state, appVersion: '1.0.0' });
    const retainedChecks = JSON.parse(JSON.stringify(capturedData.checks));
    expect(capturedData.checks).toHaveLength(16);
    const catalogue = capturedData.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE)!;
    expect(catalogue).toMatchObject({ metrics: { catalogueAvailable: true, publishedProducts: 3,
      publishedProviders: 3, includeNonStandard: true } });
    expect(catalogue.localEvidence).toMatchObject({ sections: expect.arrayContaining([
      expect.objectContaining({ section: 'Mortgage', providers: [expect.objectContaining({ provider: 'Provider 1' })] }),
    ]) });

    // A failed preference restore or changed publication must not be rescanned
    // into the initial snapshot, including its nested producer evidence.
    state.prefs.includeNonStandard = false;
    state.core!.run_date = '2026-10-13';
    state.core!.sections.Mortgage.rates.splice(0);
    state.core!.coverage!.limitations!.push('Later publication limitation');
    state.core = null;
    state.manifest = null;
    const report = buildPartialAppHealthReport({ ...input, capturedData, performanceChecks: [] });
    expect(capturedData.checks).toEqual(retainedChecks);
    expect(report.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE))
      .toMatchObject({ ...catalogue, metrics: { ...catalogue.metrics,
        evidenceCapturedAt: capturedData.capturedAt, capturedBeforeAuditMutations: true } });
    expect(report.coverage).toMatchObject({ complete: false, plannedChecks: 26, storedChecks: 26 });
    expect(report.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.AUDIT_PLAN))
      .toMatchObject({ status: 'fail', metrics: { complete: false, interrupted: true } });
    expect(report.limitations.join(' ')).toContain('before audit preference mutations');
  });

  it('preserves observed display failures while leaving successful incomplete groups unverified', () => {
    const performanceChecks = [check([
      'search.results:data:data:ready:3/3',
      'search.results:items:list:ready:0/3:visible=0:empty=0',
      'search.results:layout:layout:ready:1/1:measured=1',
    ].join(' | '))];
    Object.assign(performanceChecks[0].metrics, { executionAttempted: true, actionInvoked: true, actionCompleted: true });
    const report = buildPartialAppHealthReport({ ...input, capturedData: null, performanceChecks });
    expect(report.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LIST))
      .toMatchObject({ status: 'fail', metrics: { observedSurfaces: 1, plannedSurfaces: 2 },
        localEvidence: { failedSurfaceIds: ['search.results'] } });
    expect(report.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT))
      .toMatchObject({ status: 'not-run', metrics: { observedStatus: 'pass', partial: true } });
    expect(report.checks.filter(entry => entry.domain === 'display-completeness')
      .every(entry => entry.status === 'fail' || entry.status === 'not-run')).toBe(true);
    const performanceSummary = summarizePartialPerformanceAudit(performanceChecks, 100, 1);
    const summary = combineAppHealthPerformanceSummary(performanceSummary, report, 100);
    expect(summary.executed).toBe(1 + report.summary.pass + report.summary.warn + report.summary.fail);
    expect(summary.justifiedSkipped).toBe(performanceSummary.justifiedSkipped);
    expect(summary.unexpectedSkipped).toBe(performanceSummary.unexpectedSkipped + report.summary.notRun);
    expect(summary.coveragePercent).toBe(Math.round(summary.executed / 126 * 1000) / 10);
    expect(summary.coveragePercent).toBeLessThan(10);
    const completeSummary = combineAppHealthPerformanceSummary(performanceSummary,
      { ...report, coverage: { ...report.coverage, complete: true } }, 100);
    expect(completeSummary.justifiedSkipped).toBe(performanceSummary.justifiedSkipped + report.summary.notRun);
    expect(completeSummary.unexpectedSkipped).toBe(performanceSummary.unexpectedSkipped);
  });

  it('reports data checks as not run if setup failed before evidence capture', () => {
    const report = buildPartialAppHealthReport({ ...input, capturedData: null, performanceChecks: [] });
    expect(report.checks.find(entry => entry.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE))
      .toMatchObject({ status: 'not-run', metrics: {} });
    expect(report.checks.filter(entry => entry.status === 'not-run')).toHaveLength(24);
    expect(report.coverage.complete).toBe(false);
    expect(report.summary.coveragePercent).toBeLessThan(10);
  });
});
