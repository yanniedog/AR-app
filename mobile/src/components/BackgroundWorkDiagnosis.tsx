import React, { useState } from 'react';
import { View } from 'react-native';
import type { AuditBackgroundWorkWait } from '../lib/performanceAuditBackgroundWork';
import { AppText, Button, Card } from './ui';

export function BackgroundWorkDiagnosis({ wait }: { wait: AuditBackgroundWorkWait }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3">Background payload and history work</AppText>
      <AppText variant="small">
        Audit waited {(wait.elapsedMs / 1_000).toFixed(1)} s · {wait.status === 'settled' ? 'work settled' : 'wait interrupted'}
      </AppText>
      <AppText variant="tiny" color="textMuted">
        Worker totals include time before the audit started waiting. Overlapping jobs are not added together. Timings are wall-clock observations.
      </AppText>
      {wait.jobs.map(job => (
        <View key={job.id} style={{ gap: 4 }}>
          <AppText variant="small" weight="700">
            {job.label}{job.runDate ? ` (${job.runDate})` : ''}: {(job.elapsedMs / 1_000).toFixed(1)} s · {job.outcome ?? 'still active at capture'}
          </AppText>
          <AppText variant="tiny" color="textMuted">
            {job.stage} · {(job.stageElapsedMs / 1_000).toFixed(1)} s in stage
          </AppText>
          <AppText variant="tiny" color="textMuted">
            {job.lastCheckpointAgeMs != null
              ? `${job.processingCheckpoints} processing checkpoints · last ${(job.lastCheckpointAgeMs / 1_000).toFixed(1)} s before capture`
              : 'No processing checkpoint recorded; activity within this stage is unverified.'}
          </AppText>
          {expanded ? job.stages.map((stage, index) => (
            <AppText key={index} variant="tiny" color="textMuted">
              {stage.label}: {(stage.durationMs / 1_000).toFixed(1)} s{stage.active ? ' (active at capture)' : ''}
            </AppText>
          )) : null}
          {expanded && job.omittedStages > 0 ? <AppText variant="tiny" color="textMuted">{job.omittedStages} earlier stages omitted.</AppText> : null}
        </View>
      ))}
      {wait.payloadWork.activeWork.length ? (
        <AppText variant="tiny" color="textMuted">Active flags at capture: {wait.payloadWork.activeWork.join(', ')}</AppText>
      ) : null}
      {!wait.jobs.length ? <AppText variant="small">Worker stage evidence unavailable.</AppText> : null}
      <Button title={expanded ? 'Hide stage timings' : 'Show stage timings'} variant="ghost" onPress={() => setExpanded(value => !value)} />
    </Card>
  );
}
