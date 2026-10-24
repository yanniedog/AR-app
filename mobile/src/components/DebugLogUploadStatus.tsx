import { uiLabel } from '../lib/uiCopy';
import React, { useSyncExternalStore } from 'react';
import { router } from 'expo-router';

import {
  getDebugLogUploadSnapshot,
  retryDebugLogUpload,
  subscribeDebugLogUpload,
} from '../lib/debugLogSharing';
import { AppText, Button, Card } from './ui';
import { uiIdentifier, uiJoin, type UiLabel } from '../lib/uiCopy';
import { AuditDeliverySymbol } from './AuditOutcomeSymbols';
import { uploadOutcome } from '../lib/auditPresentation';

const LABELS: Record<ReturnType<typeof getDebugLogUploadSnapshot>['phase'], UiLabel> = {
  idle: '',
  preparing: 'Preparing',
  uploading: 'Uploading',
  verifying: 'Verifying',
  verified: 'Uploaded',
  copying: 'Copying',
  copied: 'Copied',
  failed: 'Upload failed',
};

export function DebugLogUploadStatus({ sessionId }: { sessionId?: string | null }) {
  const state = useSyncExternalStore(
    subscribeDebugLogUpload, getDebugLogUploadSnapshot, getDebugLogUploadSnapshot,
  );
  if (sessionId !== undefined && state.sessionId !== sessionId) return sessionId ? <AuditDeliverySymbol outcome="local" /> : null;
  if (state.phase === 'idle') return sessionId ? <AuditDeliverySymbol outcome="local" /> : null;
  return (
    <Card style={{ gap: 8 }}>
      <AuditDeliverySymbol outcome={uploadOutcome(state)} />
      <AppText variant="small" weight="700" accessibilityLiveRegion="polite">
        {state.phase === 'failed' ? uiLabel(state.verified ? state.error ? 'Copy failed' : 'Uploaded' : state.url || state.mayHaveUploaded ? 'Upload uncertain' : 'Upload failed') : LABELS[state.phase]}
      </AppText>
      {state.url && (sessionId === undefined || state.verified && !state.recoveryReceipt) ? <AppText variant="small" selectable>{uiIdentifier(state.url)}</AppText> : null}
      {state.error ? <AppText variant="small" color="danger">{uiLabel(state.verified ? 'Copy failed' : state.mayHaveUploaded || state.url ? 'Upload uncertain' : 'Upload failed')}</AppText> : null}
      {state.mayHaveUploaded && !state.verified ? <AppText variant="small">{uiJoin('Public copy', ': ', 'Unverified', ' · ', 'Duplicate public copy possible')}</AppText> : null}
      {state.recoveryReceipt ? <>
        <AppText variant="small">{uiJoin('Delete uploaded log', ': ', 'Required')}</AppText>
        <Button title="Debug log" variant="secondary" onPress={() => router.push('/debug-log')} />
      </> : null}
      {!state.preparationFailed && (state.phase === 'failed' || state.phase === 'copied' || state.phase === 'verified') ? (
        <Button
          title={state.verified ? 'Copy link' : state.url ? 'Retry verification' : state.mayHaveUploaded ? 'Upload another copy' : 'Retry upload'}
          variant="secondary"
          disabled={state.recoveryReceipt != null}
          onPress={() => void retryDebugLogUpload({ acceptDuplicateRisk: state.mayHaveUploaded })}
        />
      ) : null}
    </Card>
  );
}
