import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppHealthCheck } from '../lib/appHealth/types';
import type { BankResponseCoverage } from '../lib/appHealth/bankResponseCoverage';
import { validBankResponseCoverageRow } from '../lib/appHealth/publicBankResponseCoverage';
import { uiBankResponseReason } from '../lib/chartUiCopy';
import { uiCount, uiDate, uiJoin, uiLabel, uiProviderName, uiSectionName } from '../lib/uiCopy';
import { AppText, Button, Card } from './ui';
import { InfoRow } from './settings/settingsUi';

export function AuditBankResponseCoverage({ check }: { check?: AppHealthCheck }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  if (!check) return null;
  const evidence = check.localEvidence?.bankResponseCoverage as BankResponseCoverage | undefined;
  const rows = Array.isArray(evidence?.rows) ? evidence.rows : null;
  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / 40));
  const currentPage = Math.min(page, pages - 1);
  const count = (key: string) => uiCount(typeof check.metrics[key] === 'number' ? check.metrics[key] as number : null);
  return <Card style={{ gap: 8 }}>
    <AppText variant="h3">{uiLabel('Bank response coverage')}</AppText>
    <InfoRow label="Decision windows" value={count('windows')} />
    <InfoRow label="Unknown changes" value={count('unknownMoves')} />
    <InfoRow label="Unknown timing" value={count('unknownTiming')} />
    <InfoRow label="Filtered history" value={count('filteredHistory')} />
    <InfoRow label="Quarantined history" value={count('quarantinedHistory')} />
    <InfoRow label="Unverified first moves" value={count('unverifiedFirstMoves')} />
    <Button title={expanded ? 'Hide' : 'Show'} variant="ghost" accessibilityState={{ expanded }} onPress={() => { setPage(0); setExpanded(!expanded); }} />
    {expanded ? rows ? <>
      <AppText variant="small">{uiJoin('Results', ': ', uiCount(rows.length), ' · ', 'Page', ' ', uiCount(currentPage + 1), ' / ', uiCount(pages))}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title="Previous" accessibilityLabel="Previous page" variant="ghost" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
        <Button title="Next" accessibilityLabel="Next page" variant="ghost" disabled={currentPage === pages - 1} onPress={() => setPage(currentPage + 1)} />
      </View>
      {rows.slice(currentPage * 40, (currentPage + 1) * 40).map((row, index) => !validBankResponseCoverageRow(row)
        ? <AppText key={currentPage * 40 + index}>{uiLabel('Invalid evidence')}</AppText>
        : <View key={currentPage * 40 + index} style={{ gap: 2 }}>
      <AppText variant="small">{uiJoin(uiProviderName(row), ' · ', uiSectionName(row.section), ' · ', uiDate(row.decisionDate))}</AppText>
      <AppText variant="tiny">{uiJoin('Source', ': ', uiBankResponseReason(row.sourceReason), ' · ', 'Recorded results', ': ', uiBankResponseReason(row.displayReason))}</AppText>
      <AppText variant="tiny">{uiJoin('Daily gaps', ': ', uiCount(row.missingDays))}</AppText>
    </View>)}
    </> : <AppText>{uiLabel('Unavailable')}</AppText> : null}
  </Card>;
}
