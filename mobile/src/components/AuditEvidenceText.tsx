import { useMemo } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import type { PerformanceAuditReport } from '../lib/performanceAudit';
import { buildAuditMetricAnalysis } from '../lib/auditMetricAnalysis';
import { useTheme } from '../theme/ThemeProvider';

/** Explicit report document, separate from ordinary audit status presentation. */
export function AuditEvidenceText({ report: source }: { report: PerformanceAuditReport }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  // A saved or imported derived object is not authority; always recompute from
  // this report's canonical checks, including for reports from older builds.
  const report: PerformanceAuditReport = useMemo(() => ({ ...source,
    metricAnalysis: buildAuditMetricAnalysis(source),
  }), [source]);
  return <Text key={fontScale} selectable style={{ color: theme.colors.text, fontSize: theme.font.tiny, fontFamily: 'monospace' }}>
    {JSON.stringify(report, null, 2)}
  </Text>;
}
