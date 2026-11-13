import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuditMetricHistory, AuditMetricHistoryChart } from '../src/components/AuditMetricHistory';
import { loadPerformanceAuditHistory } from '../src/lib/performanceAuditReportStorage';
import { auditMetricRun } from '../src/lib/auditMetricHistory';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';

jest.mock('../src/lib/performanceAuditReportStorage', () => ({ loadPerformanceAuditHistory: jest.fn(async () => []) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Row: 'Row', Disclosure: 'Disclosure' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle', Line: 'Line', Path: 'Path' }));

let tree: any;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = undefined; jest.clearAllMocks(); });

test('empty history has no invented line, and failed storage can be retried', async () => {
  jest.mocked(loadPerformanceAuditHistory).mockRejectedValueOnce(new Error('disk'));
  await act(async () => { tree = TestRenderer.create(<AuditMetricHistory report={null} />); });
  expect(tree.root.findByProps({ children: 'History unavailable' })).toBeDefined();
  await act(async () => { tree.root.findByProps({ title: 'Retry' }).props.onPress(); });
  expect(tree.root.findByProps({ children: 'No audit history' })).toBeDefined();
  expect(tree.root.findAllByType('Svg')).toHaveLength(0);
});

test('a single recorded run is a dot, and mode switches keep unlike audits separate', () => {
  const first = { ...auditMetricRun(makePerformanceAuditReport('local')), mode: 'local' as const };
  const second = { ...first, sessionId: 'live', mode: 'live-source' as const,
    metrics: { ...first.metrics, slowestCheckMs: null } };
  act(() => { tree = TestRenderer.create(<AuditMetricHistoryChart runs={[first, second]} />); });
  expect(tree.root.findAllByType('Circle')).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Local checks' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Failures' }).props.onPress());
  expect(tree.root.findAllByType('Circle')).toHaveLength(1);
  expect(tree.root.findByType('Path').props.d).not.toContain('L');
  act(() => tree.root.findByProps({ title: 'Recorded results' }).props.onToggle());
  expect(tree.root.findByProps({ label: 'Coverage' }).props.value).toBe('Incomplete');
});

test('the completed in-memory report appears immediately and deduplicates its persisted copy', async () => {
  const report = makePerformanceAuditReport('just-finished');
  await act(async () => { tree = TestRenderer.create(<AuditMetricHistory report={report} />); });
  act(() => tree.root.findByProps({ title: 'Failures' }).props.onPress());
  expect(tree.root.findAllByType('Circle')).toHaveLength(1);
  expect(tree.root.findAllByProps({ label: 'Finished' })).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Recorded results' }).props.onToggle());
  expect(tree.root.findByProps({ label: 'Finished' }).props.value).toBe(report.finishedAt);
  jest.mocked(loadPerformanceAuditHistory).mockResolvedValueOnce([auditMetricRun(report)]);
  await act(async () => tree.update(<AuditMetricHistory report={{ ...report }} />));
  expect(tree.root.findByProps({ label: 'Retained runs' }).props.value).toBe('1 / 120');
  act(() => tree.root.findByProps({ title: 'Failures' }).props.onPress());
  expect(tree.root.findAllByType('Circle')).toHaveLength(1);
});

test('retention removing the selected mode falls back to the newest retained mode', () => {
  const local = { ...auditMetricRun(makePerformanceAuditReport('local')), mode: 'local' as const };
  const live = { ...local, sessionId: 'live', mode: 'live-source' as const };
  act(() => { tree = TestRenderer.create(<AuditMetricHistoryChart runs={[local, live]} />); });
  act(() => tree.root.findByProps({ title: 'Local checks' }).props.onPress());
  act(() => tree.update(<AuditMetricHistoryChart runs={[live]} />));
  act(() => tree.root.findByProps({ title: 'Failures' }).props.onPress());
  expect(tree.root.findByProps({ title: 'Live checks' }).props.accessibilityState.selected).toBe(true);
  expect(tree.root.findAllByType('Circle')).toHaveLength(1);
});


test('metric groups show one chart and retain percent versus duration units', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  run.metrics.collectionPercent = 80;
  run.metrics.displayLayoutPassPercent = 75;
  act(() => { tree = TestRenderer.create(<AuditMetricHistoryChart runs={[run]} />); });
  expect(tree.root.findAllByProps({ title: 'Collected checks' })).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Coverage' }).props.onPress());
  expect(tree.root.findAllByProps({ label: 'Collected checks' })[0].props.value).toBe('80.0%');
  expect(tree.root.findAllByType('Svg')).toHaveLength(1);
  expect(tree.root.findAllByProps({ title: 'Slowest check' })).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Rendering checks' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Layout-callback checks passed' }).props.onPress());
  expect(tree.root.findAllByProps({ label: 'Layout-callback checks passed' })[0].props.value).toBe('75.0%');
  expect(tree.root.findAllByType('Svg')).toHaveLength(1);
});

test('check results expose timely task outcomes and never imply measured usability or pixel quality', () => {
  const report = makePerformanceAuditReport('quality-scope', [{ id: 'action', label: 'Action', kind: 'journey',
    status: 'fail', durationMs: 500, metrics: { executionAttempted: true, actionInvoked: true,
      actionCompleted: true, nonTimingFailure: false, actionMs: 500, forwardWorkMs: 500,
      eventLoopMeasurementAvailable: true, frameMeasurementAvailable: true },
    diagnostic: { stage: 'complete', readiness: { capturing: true, ready: true, blockers: [], surfaces: [] } } }]);
  const run = auditMetricRun(report);
  act(() => { tree = TestRenderer.create(<AuditMetricHistoryChart runs={[run]} report={report} />); });
  expect(tree.root.findAllByProps({ title: 'App quality' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ title: 'Display quality' })).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Check results' }).props.onPress());
  expect(tree.root.findByProps({ label: 'Invoked actions' }).props.value).toBe('1');
  expect(tree.root.findByProps({ label: 'Ready within timing limits' }).props.value).toBe('0');
  expect(tree.root.findByProps({ label: 'Ready with timing failures' }).props.value).toBe('1');
  expect(tree.root.findByProps({ label: 'Human usability' }).props.value).toBe('Not measured');
  act(() => tree.root.findByProps({ title: 'Rendering checks' }).props.onPress());
  expect(tree.root.findByProps({ label: 'Visual design' }).props.value).toBe('Not measured');
  expect(tree.root.findByProps({ label: 'Pixel correctness' }).props.value).toBe('Not measured');
  expect(tree.root.findByProps({ label: 'Denominator' }).props.value).toBe('Not measured');
});
