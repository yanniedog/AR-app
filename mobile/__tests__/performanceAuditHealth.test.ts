import type { AuditCheck } from '../src/lib/performanceAudit';
import { appHealthDisplayObservations } from '../src/lib/performanceAuditHealth';
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
        'browse.screen:probe:list:ready:10/12',
        'browse.screen:probe:logo:ready:8/10:revision:render:fallback=3',
        'browse.screen:probe:graphic:ready:6/6',
        'browse.screen:probe:layout:ready:1/1',
      ].join(' | ')),
    ]);

    expect(observations).toEqual([{
      surfaceId: 'browse.screen',
      evidence: [
        { role: 'model', sourceCount: 12, modelCount: 12 },
        { role: 'list', modelCount: 12, renderedCount: 10 },
        { role: 'visible', expectedMinimum: 1, visibleCount: 10 },
        { role: 'empty-state', expected: false, rendered: false },
        { role: 'logo', expectedCount: 10, decodedCount: 5, fallbackCount: 3, missingCount: 2 },
        { role: 'chart', modelPointCount: 6, renderedPointCount: 6, accessibleSummary: true },
        { role: 'critical-layout', measured: true, clipped: false, width: null, height: null },
      ],
    }]);
  });

  it('retains the highest observed count from repeated cold and warm probes', () => {
    const observations = appHealthDisplayObservations([
      check('browse.screen:probe:list:ready:9/12'),
      check('browse.screen:probe:list:ready:10/12'),
      check('browse.screen:probe:list:ready:8/12'),
    ]);

    expect(observations[0]?.evidence).toEqual([
      { role: 'list', modelCount: 12, renderedCount: 10 },
      { role: 'visible', expectedMinimum: 1, visibleCount: 10 },
      { role: 'empty-state', expected: false, rendered: false },
    ]);
  });

  it('records an explicitly rendered empty state for an empty settled list', () => {
    expect(appHealthDisplayObservations([
      check('saved.list:items:list:ready:0/0'),
    ])[0]?.evidence).toEqual([
      { role: 'list', modelCount: 0, renderedCount: 0 },
      { role: 'visible', expectedMinimum: 0, visibleCount: 0 },
      { role: 'empty-state', expected: true, rendered: true },
    ]);
  });

  it('accepts a measured count-only layout probe end to end', () => {
    const checks = evaluateAppHealthDisplayQuality(
      [{ id: 'today.hero', requiredRoles: ['critical-layout'] }],
      appHealthDisplayObservations([check('today.hero:layout:layout:ready:1/1')]),
    );
    expect(checks.find((entry) => entry.code === APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT)?.status)
      .toBe('pass');
  });
});
