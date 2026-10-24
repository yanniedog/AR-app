import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AuditHistoryCoverage } from '../src/components/AuditHistoryCoverage';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { finalizeAppHealthReport } from '../src/lib/appHealth/report';
import { APP_HEALTH_CHECK_CODES, type AppHealthMetricValue } from '../src/lib/appHealth/types';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));

type TestNode = { props: Record<string, any>; parent: TestNode | null;
  findByProps: (props: Record<string, unknown>) => TestNode };
type Renderer = ReactTestRenderer & { root: TestNode; toJSON: () => unknown };

test.each([null, {}, [null], [{ code: 'catalogue-identity-coverage' }]])(
  'malformed retained health checks cannot crash the audit screen: %j', checks => {
    const report = makePerformanceAuditReport();
    report.appHealth = { checks } as unknown as NonNullable<typeof report.appHealth>;
    let tree!: Renderer;
    act(() => { tree = TestRenderer.create(<AuditHistoryCoverage report={report} />) as Renderer; });
    try { expect(tree.toJSON()).toBeNull(); } finally { act(() => tree.unmount()); }
  },
);

function render(metrics: Record<string, AppHealthMetricValue>) {
  const report = makePerformanceAuditReport();
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt,
    checks: [{ id: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, code: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE,
      label: 'Catalogue', domain: 'data-completeness', status: 'warn', metrics }],
    plannedCheckIds: [APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE] });
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<AuditHistoryCoverage report={report} />) as Renderer; });
  return tree;
}

const invalidEvidence: Record<string, AppHealthMetricValue>[] = [
  {}, { historyGaps: '{}' }, { historyGaps: '[null]' }, { historyGaps: 'invalid' },
  { historyGaps: '[["2026-02-31","processed-day-missing",null,1]]' },
];
test.each(invalidEvidence)(
  'missing or malformed daily evidence cannot report zero gaps: %j', metrics => {
    const tree = render(metrics);
    try {
      const label = tree.root.findByProps({ children: 'Daily gaps' });
      expect(label.parent!.props.children[1].props.children).toBe('Unknown');
    } finally { act(() => tree.unmount()); }
  },
);

test('daily gaps expand completely and loaded data does not certify screen rendering', () => {
  const gaps = [
    ['2026-10-22', 'historical-source-unavailable', null, 1],
    ['2026-10-23', 'source-to-model-mean-mismatch', 'Mortgage', 1, 'Bank'],
  ];
  const tree = render({ historyAvailable: true, historyDaysChecked: 3, historyGaps: JSON.stringify(gaps) });
  try {
    const label = tree.root.findByProps({ children: 'Rendered coverage' });
    expect(label.parent!.props.children[1].props.children).toBe('Unverified');
    act(() => tree.root.findByProps({ title: 'Show' }).props.onPress());
    const facts = JSON.stringify(tree.toJSON());
    expect(facts).toContain('22 Oct 2026');
    expect(facts).toContain('23 Oct 2026');
    expect(facts).toContain('Bank');
    expect(facts).toContain('Processing gaps');
  } finally { act(() => tree.unmount()); }
});

test('stale publications and unknown ledger observations retain their source classification', () => {
  const tree = render({ historyGaps: JSON.stringify([
    ['2026-10-24', 'current-product-observation-missing', 'Mortgage', 1, 'product'],
    ['2026-10-25', 'current-payload-stale', null, 1],
    ['2026-10-23', 'product-history-date-unavailable', null, 1],
  ]) });
  try {
    act(() => tree.root.findByProps({ title: 'Show' }).props.onPress());
    const facts = JSON.stringify(tree.toJSON());
    expect(facts).toContain('Stale');
    expect(facts).toContain('Source unavailable');
    expect(facts).toContain('Unverified');
    expect(facts).not.toContain('Processing gaps');
  } finally { act(() => tree.unmount()); }
});
