import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { buildAuditMetricAnalysis } from '../lib/auditMetricAnalysis';
import type { AuditMetric } from '../lib/auditMetricHistory';
import type { PerformanceAuditReport } from '../lib/performanceAudit';
import { uiCount, uiIdentifier, uiLabel, uiNumber } from '../lib/uiCopy';
import { AppText, Disclosure } from './ui';
import { InfoRow } from './settings/settingsUi';

const number = (value: number | null) => value === null ? uiLabel('Not measured') : uiNumber(value, 2);
const count = (value: number | null) => value === null ? uiLabel('Not measured') : uiCount(value);

/** Only expanded evidence builds its analysis. Historical aggregates do not
 * impersonate a retained full report; the caller must match the run identity. */
export function AuditMetricDetails({ report, metric }: { report: PerformanceAuditReport; metric: AuditMetric }) {
  const [open, setOpen] = useState(false);
  return <Disclosure title="Metric evidence" open={open} onToggle={() => setOpen(value => !value)}>
    {open ? <MetricEvidence report={report} metric={metric} /> : null}
  </Disclosure>;
}

function MetricEvidence({ report, metric }: { report: PerformanceAuditReport; metric: AuditMetric }) {
  const analysis = useMemo(() => buildAuditMetricAnalysis(report), [report]);
  const evidence = analysis.metrics[metric];
  const distribution = evidence.distribution;
  return <View style={{ gap: 8 }}>
    <InfoRow label="Method" value={uiIdentifier(evidence.methodId)} />
    <InfoRow label="Measurement scope" value={uiIdentifier(evidence.unitOfAnalysis)} />
    <InfoRow label="Sample unit" value={uiIdentifier(evidence.sampleUnit)} />
    <InfoRow label="Unit" value={evidence.unit === 'ms' ? 'ms' : evidence.unit === 'percent' ? '%' : 'Count'} />
    <InfoRow label="Version" value={count(evidence.methodVersion)} />
    <InfoRow label="Evidence status" value={evidence.applicability === 'observed' ? 'Observed'
      : evidence.applicability === 'invalid-evidence' ? 'Invalid evidence' : 'Not observed'} />
    <InfoRow label="Numerator" value={count(evidence.numerator)} />
    <InfoRow label="Denominator" value={count(evidence.denominator)} />
    <InfoRow label="Sample size" value={count(evidence.sampleSize)} />
    <InfoRow label="Eligible" value={count(evidence.eligibleCount)} />
    <InfoRow label="Observed" value={count(evidence.observedCount)} />
    <InfoRow label="Missing evidence" value={count(evidence.missingCount)} />
    <InfoRow label="Excluded" value={count(evidence.excludedCount)} />
    <InfoRow label="Evidence references" value={uiCount(evidence.contributors.length)} />
    {evidence.instrumentation ? <>
      <InfoRow label="Contributing journeys" value={uiCount(evidence.instrumentation.contributingJourneys)} />
      <InfoRow label="Unmeasured journeys" value={uiCount(evidence.instrumentation.missingJourneys)} />
    </> : null}
    {evidence.outcomes ? <>
      <InfoRow label="Successful" value={uiCount(evidence.outcomes.success)} />
      <InfoRow label="Failed" value={uiCount(evidence.outcomes.failure)} />
      <InfoRow label="Indeterminate" value={uiCount(evidence.outcomes.indeterminate)} />
    </> : null}
    {evidence.missingEvidence.map(reason => <InfoRow key={reason} label="Status" value={uiIdentifier(reason)} />)}
    {distribution ? <>
      <InfoRow label="Minimum" value={number(distribution.min)} />
      <InfoRow label="Maximum" value={number(distribution.max)} />
      <InfoRow label="p50" value={number(distribution.p50)} />
      <InfoRow label="p90" value={number(distribution.p90)} />
      <InfoRow label="p95" value={number(distribution.p95)} />
      <InfoRow label="p99" value={number(distribution.p99)} />
      <InfoRow label="Median absolute deviation" value={number(distribution.mad)} />
      <InfoRow label="Interquartile range" value={number(distribution.iqr)} />
      {distribution.strata.length ? <AppText weight="700">{uiLabel('Measurement groups')}</AppText> : null}
      {distribution.strata.map(stratum => <View key={stratum.key} style={{ gap: 4 }}>
        <InfoRow label="Group" value={uiIdentifier(stratum.key)} />
        <InfoRow label="Sample size" value={uiCount(stratum.n)} />
        <InfoRow label="p50" value={number(stratum.p50)} />
        <InfoRow label="p95" value={number(stratum.p95)} />
        <InfoRow label="p99" value={number(stratum.p99)} />
      </View>)}
      <AppText weight="700">{uiLabel('Worst observations')}</AppText>
      {distribution.worst.map(item => {
        const observation = analysis.observations[item.observation];
        return <View key={item.observation} style={{ gap: 4 }}>
          <InfoRow label="Check ID" value={uiIdentifier(observation?.checkId)} />
          <InfoRow label="Position" value={count(observation?.position ?? null)} />
          <InfoRow label="Duration" value={number(item.value)} />
        </View>;
      })}
    </> : null}
  </View>;
}
