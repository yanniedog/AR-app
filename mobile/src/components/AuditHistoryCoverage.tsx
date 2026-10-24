import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Row } from './ui';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel } from '../lib/uiCopy';
import type { PerformanceAuditReport } from '../lib/performanceAudit';

/** Daily facts are bound to the retained report, never the mutable store. */
export function AuditHistoryCoverage({ report }: { report: PerformanceAuditReport }) {
  const [expanded, setExpanded] = useState(false);
  const check = report.appHealth?.checks.find(item => item.code === 'catalogue-identity-coverage');
  if (!check) return null;
  let readable = typeof check.metrics.historyGaps === 'string';
  let gaps: [string, string, string | null, number, string?][] = [];
  try {
    const value: unknown = JSON.parse(String(check.metrics.historyGaps ?? '[]'));
    if (Array.isArray(value)) {
      gaps = value.filter((gap): gap is [string, string, string | null, number, string?] =>
      Array.isArray(gap) && (gap.length === 4 || gap.length === 5) && typeof gap[0] === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(gap[0]) && Number.isFinite(Date.parse(gap[0])) && typeof gap[1] === 'string' &&
      (gap[2] === null || ['Mortgage', 'Savings', 'TD'].includes(gap[2])) && typeof gap[3] === 'number' && Number.isFinite(gap[3]) &&
      (gap.length === 4 || typeof gap[4] === 'string'));
      readable = readable && gaps.length === value.length;
    } else readable = false;
  } catch { readable = false; }
  return <View style={{ gap: 8 }}>
    <AppText variant="h3">{uiLabel('Historical publications')}</AppText>
    <Row><AppText>{uiLabel('History days')}</AppText><AppText>{uiCount(typeof check.metrics.historyDaysChecked === 'number' ? check.metrics.historyDaysChecked : null)}</AppText></Row>
    <Row><AppText>{uiLabel('Daily gaps')}</AppText><AppText>{uiCount(readable ? gaps.length : null)}</AppText></Row>
    <Row><AppText>{uiLabel('Data')}</AppText><AppText>{uiLabel(check.metrics.historyAvailable === true ? 'Available' : check.metrics.historyAvailable === false ? 'Unavailable' : 'Unverified')}</AppText></Row>
    <Row><AppText>{uiLabel('Rendered coverage')}</AppText><AppText>{uiLabel('Unverified')}</AppText></Row>
    {gaps.length > 0 && <Button variant="secondary" title={uiLabel(expanded ? 'Hide' : 'Show')} onPress={() => setExpanded(value => !value)} />}
    {expanded && gaps.map(([day, reason, section, count, provider], index) => <AppText key={index} selectable variant="small">
      {uiJoin(uiDate(day), ' / ', uiIdentifier(section), ' / ', uiIdentifier(provider), ' / ',
        uiLabel(reason === 'historical-detail-evidence-unknown' ? 'Unverified details' : reason === 'historical-quarantined-tiers' ? 'Quarantined tiers' : reason.includes('chart') ? 'Chart gaps' : reason.includes('source') && !reason.includes('model') ? 'Source unavailable' : 'Processing gaps'),
        ' / ', uiCount(count))}
    </AppText>)}
  </View>;
}
