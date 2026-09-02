import type { AuditCheck } from '../src/lib/performanceAudit';
import { appHealthDisplayObservations } from '../src/lib/performanceAuditHealth';

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
        'browse.screen:probe:logo:ready:8/10',
        'browse.screen:probe:graphic:ready:6/6',
        'browse.screen:probe:layout:ready:1/1',
      ].join(' | ')),
    ]);

    expect(observations).toEqual([{
      surfaceId: 'browse.screen',
      evidence: [
        { role: 'model', sourceCount: 12, modelCount: 12 },
        { role: 'list', modelCount: 12, renderedCount: 10 },
        { role: 'logo', expectedCount: 10, decodedCount: 8, fallbackCount: 0, missingCount: 2 },
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
    ]);
  });
});
