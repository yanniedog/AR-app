import { uiLabel } from '../lib/uiCopy';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { AuditBackgroundWorkWait } from '../lib/performanceAuditBackgroundWork';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiNumber } from '../lib/uiCopy';
import { AppText, Button, Card } from './ui';

export function BackgroundWorkDiagnosis({ wait }: { wait: AuditBackgroundWorkWait }) {
  const [expanded, setExpanded] = useState(false);
  return <Card style={{ gap: 8 }}>
    <AppText variant="h3">{uiLabel("Background checks")}</AppText>
    <AppText variant="small">{uiJoin('Duration', ': ', uiNumber(wait.elapsedMs / 1000, 1), ' ', 'seconds', ' · ', wait.status === 'settled' ? 'Complete' : wait.status === 'waiting' ? 'Pending' : 'Cancelled')}</AppText>
    <AppText variant="tiny">{uiJoin('Wall clock', ' · ', 'Overlapping jobs', ' · ', 'Nonadditive')}</AppText>
    {wait.jobs.map(job => <View key={job.id} style={{ gap: 4 }}>
      <AppText variant="small" weight="700">{uiJoin(uiCount(job.id), ' · ', uiDate(job.runDate), ' · ', uiNumber(job.elapsedMs / 1000, 1), ' ', 'seconds', ' · ', job.outcome ? uiIdentifier(job.outcome) : 'Pending')}</AppText>
      <AppText variant="tiny">{uiJoin('Stage', ': ', uiNumber(job.stageElapsedMs / 1000, 1), ' ', 'seconds', ' · ', 'Checkpoints', ': ', uiCount(job.processingCheckpoints))}</AppText>
      <AppText variant="tiny">{uiJoin('Last evidence', ': ', job.lastCheckpointAgeMs == null ? 'Unverified' : uiJoin(uiNumber(job.lastCheckpointAgeMs / 1000, 1), ' ', 'seconds'), ' · ', job.finishedAt ? 'Complete' : 'Pending')}</AppText>
      {expanded ? job.stages.map((stage, index) => <AppText key={index} variant="tiny">{uiJoin('Stage', ' ', uiCount(index + 1), ': ', uiNumber(stage.durationMs / 1000, 1), ' ', 'seconds', ' · ', stage.active ? 'Pending' : 'Complete')}</AppText>) : null}
      {expanded && job.omittedStages > 0 ? <AppText variant="tiny">{uiJoin('Omitted stages', ': ', uiCount(job.omittedStages))}</AppText> : null}
    </View>)}
    {wait.payloadWork.activeWork.length ? <AppText variant="tiny">{uiJoin('Active jobs', ': ', uiCount(wait.payloadWork.activeWork.length))}</AppText> : null}
    {!wait.jobs.length ? <AppText variant="small">{uiLabel("Unavailable")}</AppText> : null}
    <Button title={expanded ? 'Hide' : 'Show'} variant="ghost" onPress={() => setExpanded(value => !value)} />
  </Card>;
}
