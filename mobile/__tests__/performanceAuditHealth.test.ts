import type { AuditCheck } from '../src/lib/performanceAudit';
import {
  appHealthDisplayObservations,
  appHealthSurfaceContracts,
} from '../src/lib/performanceAuditHealth';
import type { DeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { evaluateAppHealthDisplayQuality } from '../src/lib/appHealth/displayQuality';
import { APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth/types';

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
  it('maps independent model, list, logo, chart and layout probes', () => {
    const observations = appHealthDisplayObservations([
      check([
        'browse.screen:probe:data:ready:12/12',
        'browse.screen:probe:list:ready:10/12:revision:render:visible=4:empty=0',
        'browse.screen:probe:logo:ready:8/10:revision:render:fallback=3',
        'browse.screen:probe:graphic:ready:6/6:summary=1',
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
        { role: 'chart', modelPointCount: 6, renderedPointCount: 6, accessibleSummary: true },
        { role: 'critical-layout', measured: true, width: null, height: null },
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

  it('prefers accessible chart proof when an optional closed chart has the same count', () => {
    const observations = appHealthDisplayObservations([
      check([
        'outlook.dashboard:history:graphic:ready:1/1:summary=1',
        'outlook.dashboard:economy:graphic:ready:1/1:summary=0',
      ].join(' | ')),
    ]);

    expect(observations[0]?.evidence).toContainEqual({
      role: 'chart',
      modelPointCount: 1,
      renderedPointCount: 1,
      accessibleSummary: true,
    });
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
