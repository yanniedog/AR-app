import { Text, useWindowDimensions } from 'react-native';
import type { PerformanceAuditReport } from '../lib/performanceAudit';
import { useTheme } from '../theme/ThemeProvider';

/** Explicit report document, separate from ordinary audit status presentation. */
export function AuditEvidenceText({ report }: { report: PerformanceAuditReport }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  return <Text key={fontScale} selectable style={{ color: theme.colors.text, fontSize: theme.font.tiny, fontFamily: 'monospace' }}>
    {JSON.stringify(report, null, 2)}
  </Text>;
}
