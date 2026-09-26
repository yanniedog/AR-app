import React, { useSyncExternalStore } from 'react';

import {
  getDebugLogUploadSnapshot,
  retryDebugLogUpload,
  subscribeDebugLogUpload,
} from '../lib/debugLogSharing';
import { AppText, Button, Card } from './ui';

const LABELS = {
  idle: '',
  preparing: 'Preparing the full log…',
  uploading: 'Uploading the full log…',
  verifying: 'Checking the paste contains the full log…',
  copying: 'Copying the paste link…',
  copied: 'Full log uploaded. Link copied to clipboard.',
  failed: 'Log sharing needs attention',
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
      {state.url ? <AppText variant="small" selectable>{state.url}</AppText> : null}
      {state.error ? <AppText variant="small" color="danger">{state.error}</AppText> : null}
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
