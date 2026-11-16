import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildAuditMetricAnalysis } from '../src/lib/auditMetricAnalysis';
import { AuditMetricDetails } from '../src/components/AuditMetricDetails';
import { AuditEvidenceText } from '../src/components/AuditEvidenceText';

jest.mock('../src/lib/auditMetricAnalysis', () => ({
  ...jest.requireActual('../src/lib/auditMetricAnalysis'),
  buildAuditMetricAnalysis: jest.fn((...args: unknown[]) => jest.requireActual('../src/lib/auditMetricAnalysis').buildAuditMetricAnalysis(...args)),
}));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Disclosure: 'Disclosure' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));

let tree: any;
afterEach(() => { if (tree) act(() => tree.unmount()); jest.clearAllMocks(); });

test('detailed analysis is lazy, stays bound to its report and exposes missing evidence', () => {
  const report = makePerformanceAuditReport();
  act(() => { tree = TestRenderer.create(<AuditMetricDetails report={report} metric="actionP95Ms" />); });
  expect(buildAuditMetricAnalysis).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ title: 'Metric evidence' }).props.onToggle());
  expect(buildAuditMetricAnalysis).toHaveBeenCalledTimes(1);
  const evidence = jest.mocked(buildAuditMetricAnalysis).mock.results[0].value.metrics.actionP95Ms;
  expect(tree.root.findByProps({ label: 'Method' }).props.value).toBe(evidence.methodId);
  expect(tree.root.findByProps({ label: 'Sample size' }).props.value).toBe('0');
  expect(tree.root.findByProps({ label: 'Evidence status' }).props.value).toBe('Not observed');
  act(() => tree.update(<AuditMetricDetails report={report} metric="failures" />));
  expect(buildAuditMetricAnalysis).toHaveBeenCalledTimes(1);
});

test('raw report includes every derived metric and discards a saved analysis payload', () => {
  const report = makePerformanceAuditReport();
  Object.assign(report, { metricAnalysis: { privateText: 'forged-analysis-secret' } });
  act(() => { tree = TestRenderer.create(<AuditEvidenceText report={report} />); });
  const text = tree.root.findByType(Text).props.children as string;
  expect(text).not.toContain('forged-analysis-secret');
  const rendered = JSON.parse(text);
  expect(rendered.metricAnalysis.metrics).toHaveProperty('actionP95Ms');
  expect(rendered.metricAnalysis.metrics).toHaveProperty('historySourceCoveragePercent');
  expect(rendered.checks).toEqual(report.checks);
});
