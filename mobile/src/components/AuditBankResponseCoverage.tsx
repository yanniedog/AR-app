import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppHealthCheck } from '../lib/appHealth/types';
import type { BankResponseCoverage } from '../lib/appHealth/bankResponseCoverage';
import { uiBankResponseReason } from '../lib/chartUiCopy';
import { uiCount, uiDate, uiJoin, uiLabel, uiProviderName, uiSectionName } from '../lib/uiCopy';
import { AppText, Button, Card } from './ui';
import { InfoRow } from './settings/settingsUi';

export function AuditBankResponseCoverage({ check }: { check?: AppHealthCheck }) {
  const [expanded, setExpanded] = useState(false);
  if (!check) return null;
  const evidence = check.localEvidence?.bankResponseCoverage as BankResponseCoverage | undefined;
  const count = (key: string) => uiCount(typeof check.metrics[key] === 'number' ? check.metrics[key] as number : null);
  return <Card style={{ gap: 8 }}>
    <AppText variant="h3">{uiLabel('Bank response coverage')}</AppText>
    <InfoRow label="Decision windows" value={count('windows')} />
    <InfoRow label="Unknown changes" value={count('unknownMoves')} />
    <InfoRow label="Unknown timing" value={count('unknownTiming')} />
    <InfoRow label="Filtered history" value={count('filteredHistory')} />
    <InfoRow label="Quarantined history" value={count('quarantinedHistory')} />
    <InfoRow label="Unverified first moves" value={count('unverifiedFirstMoves')} />
    <Button title={expanded ? 'Hide' : 'Show'} variant="ghost" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} />
    {expanded ? Array.isArray(evidence?.rows) ? evidence.rows.map(row => <View key={`${row.section}:${row.decisionDate}:${row.provider}`} style={{ gap: 2 }}>
      <AppText variant="small">{uiJoin(uiProviderName(row), ' · ', uiSectionName(row.section), ' · ', uiDate(row.decisionDate))}</AppText>
      <AppText variant="tiny">{uiJoin('Source', ': ', uiBankResponseReason(row.sourceReason), ' · ', 'Recorded results', ': ', uiBankResponseReason(row.displayReason))}</AppText>
      <AppText variant="tiny">{uiJoin('Daily gaps', ': ', uiCount(row.missingDays))}</AppText>
    </View>) : <AppText>{uiLabel('Unavailable')}</AppText> : null}
  </Card>;
}
