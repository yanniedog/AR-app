import React from 'react';
import { openBank } from '../../lib/nav';
import { uiProviderName } from '../../lib/uiCopy';
import { PressFeedback } from '../PressFeedback';
import { AppText } from '../ui';

export function ProductProviderLink({ provider }: { provider: string }) {
  const label = uiProviderName({ provider });
  return (
    <PressFeedback accessibilityRole="link" accessibilityLabel={label} onPress={() => openBank(provider)}
      style={{ alignSelf: 'flex-start', alignItems: 'flex-start', minHeight: 48, minWidth: 48 }}>
      <AppText variant="small" color="primary" style={{ textDecorationLine: 'underline' }}>{label}</AppText>
    </PressFeedback>
  );
}
