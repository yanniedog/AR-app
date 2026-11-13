import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AUDIT_HISTORY_LIMIT, AUDIT_METRICS, AUDIT_METRIC_DEFINITIONS, AUDIT_METRIC_GROUPS, auditMetricPlot, auditMetricRun, mergeAuditMetricRuns, type AuditMetric, type AuditMetricRun, type AuditMetricGroup } from '../lib/auditMetricHistory';
import { loadPerformanceAuditHistory } from '../lib/performanceAuditReportStorage';
import type { PerformanceAuditReport } from '../lib/performanceAudit';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel, uiNumber, type UiLabel } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Disclosure, Row } from './ui';
import { InfoRow } from './settings/settingsUi';
import { AuditMetricDetails } from './AuditMetricDetails';
import { auditCheckResultSummary } from '../lib/auditCheckResultSummary';

const MODES: Record<AuditMetricRun['mode'], UiLabel> = { local: 'Local checks', 'live-source': 'Live checks', unknown: 'Unknown' };
const OUTCOMES: Record<AuditMetricRun['outcome'], UiLabel> = {
  successful: 'Successful', failed: 'Failed', incomplete: 'Incomplete', warning: 'Needs review',
};
function valueLabel(value: number | null, metric: AuditMetric) {
  if (value === null) return uiLabel('Not measured');
  const unit = AUDIT_METRIC_DEFINITIONS[metric].unit;
  return uiJoin(uiNumber(value, unit === 'percent' ? 1 : 0),
    unit === 'count' ? '' : unit === 'percent' ? '%' : uiJoin(' ', 'ms'));
}

/** Plot aggregate facts from saved runs and the current report without network work. */
export function AuditMetricHistory({ report }: { report: PerformanceAuditReport | null }) {
  const [runs, setRuns] = useState<AuditMetricRun[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    void loadPerformanceAuditHistory(report).then(rows => {
      if (active) {
        setRuns(mergeAuditMetricRuns(rows, report ? [auditMetricRun(report)] : []));
        setStatus('ready');
      }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [report, retry]);
  return <Card style={{ gap: 12 }}>
    <AppText variant="h2">{uiLabel('Audit history')}</AppText>
    {status === 'loading' ? <AppText>{uiLabel('Loading')}</AppText>
      : status === 'error' ? <>
        <AppText color="danger">{uiLabel('History unavailable')}</AppText>
        <Button title="Retry" variant="secondary" onPress={() => setRetry(value => value + 1)} />
      </> : <AuditMetricHistoryChart runs={runs} report={report} />}
  </Card>;
}

export function AuditMetricHistoryChart({ runs, report }: { runs: AuditMetricRun[]; report?: PerformanceAuditReport | null }) {
  const theme = useTheme();
  const [metric, setMetric] = useState<AuditMetric>('slowestCheckMs');
  const group: AuditMetricGroup = AUDIT_METRIC_DEFINITIONS[metric].group;
  const [chosenMode, setChosenMode] = useState<AuditMetricRun['mode'] | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const mode = chosenMode && runs.some(run => run.mode === chosenMode)
    ? chosenMode : runs[runs.length - 1]?.mode ?? 'local';
  const visibleRuns = useMemo(() => runs.filter(run => run.mode === mode), [mode, runs]);
  const plot = useMemo(() => auditMetricPlot(visibleRuns, metric), [visibleRuns, metric]);
  const currentReport = report?.sessionId === visibleRuns[visibleRuns.length - 1]?.sessionId ? report : null;
  const checkGroup = group === 'Check results' || group === 'Rendering checks';
  const analysis = useMemo(() => currentReport && checkGroup ? auditCheckResultSummary(currentReport) : null,
    [currentReport, checkGroup]);
  const evidence = analysis?.metrics[metric];
  const taskEvidence = analysis?.taskEvidence;
  const measuredCount = (value: number | null | undefined) => value == null ? uiLabel('Not measured') : uiCount(value);
  const points = plot.points.filter(point => point !== null);
  if (!runs.length) return <AppText>{uiLabel('No audit history')}</AppText>;
  return <View style={{ gap: 12 }}>
    <InfoRow label="Retained runs" value={uiJoin(uiCount(runs.length), ' / ', uiCount(AUDIT_HISTORY_LIMIT))} />
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {(Object.keys(MODES) as AuditMetricRun['mode'][]).filter(key => runs.some(run => run.mode === key)).map(key =>
        <Button key={key} title={MODES[key]} variant={key === mode ? 'primary' : 'secondary'}
          accessibilityState={{ selected: key === mode }} onPress={() => setChosenMode(key)} />)}
    </Row>
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {AUDIT_METRIC_GROUPS.map(key => <Button key={key} title={key} variant={key === group ? 'primary' : 'secondary'}
        accessibilityState={{ selected: key === group }} onPress={() => setMetric(key === 'Check results' ? 'timingFailures'
          : AUDIT_METRICS.find(candidate => AUDIT_METRIC_DEFINITIONS[candidate].group === key)!)} />)}
    </Row>
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {AUDIT_METRICS.filter(key => AUDIT_METRIC_DEFINITIONS[key].group === group).map(key => <Button key={key} title={AUDIT_METRIC_DEFINITIONS[key].label} variant={key === metric ? 'secondary' : 'ghost'}
        accessibilityState={{ selected: key === metric }} onPress={() => setMetric(key)} />)}
    </Row>
    <InfoRow label={AUDIT_METRIC_DEFINITIONS[metric].label} value={valueLabel(visibleRuns[visibleRuns.length - 1]?.metrics[metric] ?? null, metric)} />
    {checkGroup ? <View style={{ gap: 4 }}>
      <InfoRow label="Measurement scope" value={evidence ? uiIdentifier(evidence.unitOfAnalysis) : 'Not measured'} />
      <InfoRow label="Numerator" value={measuredCount(evidence?.numerator)} />
      <InfoRow label="Denominator" value={measuredCount(evidence?.denominator)} />
      <InfoRow label="Missing evidence" value={measuredCount(evidence?.missingCount)} />
      {evidence?.inventory ? <>
        <InfoRow label="Observed" value={measuredCount(evidence.inventory.observed)} />
        <InfoRow label="Eligible" value={measuredCount(evidence.inventory.expected)} />
        <InfoRow label="Unavailable" value={measuredCount(evidence.inventory.unavailable)} />
      </> : null}
      {evidence?.unit === 'percent' && evidence.numerator !== null && evidence.denominator !== null
        ? <InfoRow label="Not passed" value={uiCount(evidence.denominator - evidence.numerator)} /> : null}
      {group === 'Check results' ? <>
        <InfoRow label="Invoked actions" value={measuredCount(taskEvidence?.denominator)} />
        <InfoRow label="Ready within timing limits" value={measuredCount(taskEvidence?.outcomes?.withinTimingLimits)} />
        <InfoRow label="Ready with timing failures" value={measuredCount(taskEvidence?.outcomes?.timingFailures)} />
        <InfoRow label="Ready with warnings" value={measuredCount(taskEvidence?.outcomes?.warnings)} />
        <InfoRow label="Action failures" value={measuredCount(taskEvidence?.outcomes?.failure)} />
        <InfoRow label="Indeterminate" value={measuredCount(taskEvidence?.outcomes?.indeterminate)} />
        <InfoRow label="Human usability" value="Not measured" />
      </> : <>
        <InfoRow label="Visual design" value="Not measured" />
        <InfoRow label="Pixel correctness" value="Not measured" />
      </>}
    </View> : null}
    {points.length ? <View>
      <AppText variant="tiny" color="textMuted">{valueLabel(plot.ceiling, metric)}</AppText>
      <Svg width="100%" height={148} viewBox="0 0 320 148" accessible={false}>
        {[16, 72, 128].map(y => <Line key={y} x1={12} x2={308} y1={y} y2={y} stroke={theme.colors.border} />)}
        <Path d={plot.path} stroke={theme.colors.primary} strokeWidth={2} fill="none" />
        {points.map(point => <Circle key={point.sessionId} cx={point.x} cy={point.y} r={4}
          fill={theme.colors.primary} stroke={theme.colors.surface} strokeWidth={1} />)}
      </Svg>
      <AppText variant="tiny" color="textMuted">{valueLabel(0, metric)}</AppText>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="tiny">{uiDate(visibleRuns[0].finishedAt)}</AppText>
        {visibleRuns.length > 1 ? <AppText variant="tiny">{uiDate(visibleRuns[visibleRuns.length - 1].finishedAt)}</AppText> : null}
      </Row>
    </View> : <AppText>{uiLabel('Not measured')}</AppText>}
    {report?.sessionId === visibleRuns[visibleRuns.length - 1]?.sessionId
      ? <AuditMetricDetails report={report!} metric={metric} /> : null}
    <Disclosure title="Recorded results" open={showRuns} onToggle={() => setShowRuns(!showRuns)}>
      {showRuns ? [...visibleRuns].reverse().map(run => <View key={run.sessionId} style={{ gap: 4, paddingVertical: 8 }}>
        <InfoRow label="Finished" value={uiIdentifier(run.finishedAt)} />
        <InfoRow label="Version" value={uiJoin(uiIdentifier(run.appVersion), ' / ', 'Build', ' ', uiIdentifier(run.buildVersion))} />
        <InfoRow label="Status" value={OUTCOMES[run.outcome]} />
        <InfoRow label="Collection" value={run.collectionComplete ? 'Complete' : 'Incomplete'} />
        <InfoRow label="Coverage" value={run.coverageComplete ? 'Complete' : 'Incomplete'} />
        <InfoRow label="Executed" value={uiCount(run.executed)} />
        <InfoRow label="Method" value={uiCount(run.methodVersions[metric])} />
        <InfoRow label={AUDIT_METRIC_DEFINITIONS[metric].label} value={valueLabel(run.metrics[metric], metric)} />
      </View>) : null}
    </Disclosure>
  </View>;
}
