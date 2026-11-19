import React from 'react';
import { View } from 'react-native';

import { useStore } from '../data/store';
import { uiLabel } from '../lib/uiCopy';
import { PayloadProgressBar } from './feedbackProgress';

/** Stage and byte progress for the first download, before any rates exist. */
export function FirstLoadProgress() {
  const progress = useStore((s) => (!s.core && s.refreshing ? s.payloadProgress : null));
  if (!progress) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <PayloadProgressBar progress={progress} caption={uiLabel('Loading rates')} />
    </View>
  );
}
