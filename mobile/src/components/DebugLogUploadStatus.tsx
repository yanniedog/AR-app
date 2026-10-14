import { uiLabel } from '../lib/uiCopy';
import React, { useSyncExternalStore } from 'react';

import {
  getDebugLogUploadSnapshot,
  retryDebugLogUpload,
  subscribeDebugLogUpload,
} from '../lib/debugLogSharing';
import { AppText, Button, Card } from './ui';
import { uiIdentifier, uiJoin, type UiLabel } from '../lib/uiCopy';

const LABELS: Record<ReturnType<typeof getDebugLogUploadSnapshot>['phase'], UiLabel> = {
  idle: '',
  preparing: 'Preparing',
  uploading: 'Uploading',
  verifying: 'Verifying',
  copying: 'Copying',
  copied: 'Copied',
  failed: 'Upload failed',
};

export function DebugLogUploadStatus({ sessionId }: { sessionId?: string | null }) {
  const state = useSyncExternalStore(
    subscribeDebugLogUpload, getDebugLogUploadSnapshot, getDebugLogUploadSnapshot,
  );
  if (state.phase === 'idle' || (sessionId !== undefined && state.sessionId !== sessionId)) return null;
  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="small" weight="700" accessibilityLiveRegion="polite">
        {LABELS[state.phase]}
      </AppText>
      {state.url ? <AppText variant="small" selectable>{uiIdentifier(state.url)}</AppText> : null}
      {state.error ? <AppText variant="small" color="danger">{uiLabel("Upload failed")}</AppText> : null}
      {state.mayHaveUploaded && !state.verified ? <AppText variant="small">{uiJoin('Public copy', ': ', 'Unverified', ' · ', 'Duplicate public copy possible')}</AppText> : null}
      {state.phase === 'failed' || state.phase === 'copied' ? (
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
