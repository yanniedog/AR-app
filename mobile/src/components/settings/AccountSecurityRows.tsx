import React from 'react';
import { Alert } from 'react-native';

import { AppText } from '../ui';
import { authenticateBiometric, biometricsAvailable } from '../../lib/appLock';
import { SettingsGap, ToggleRow } from './settingsUi';

export function AccountSecurityRows({
  appLockEnabled,
  onAppLockChange,
}: {
  appLockEnabled: boolean;
  onAppLockChange: (v: boolean) => void;
}) {
  const handleAppLockChange = async (next: boolean) => {
    if (next && !(await biometricsAvailable())) {
      Alert.alert(
        'No screen lock set up',
        'Add a fingerprint, face unlock, or device PIN in your system settings first.',
      );
      return;
    }
    if (await authenticateBiometric(next ? 'Confirm to enable app lock' : 'Confirm to disable app lock')) {
      onAppLockChange(next);
    }
  };

  return (
    <>
      <AppText variant="tiny" color="textFaint" style={{ lineHeight: 16 }}>
        No account required. Your rates and scenarios stay on this device.
      </AppText>
      <SettingsGap size={10} />
      <ToggleRow
        icon="finger-print"
        label="App lock"
        sub="Require unlock when opening the app"
        value={appLockEnabled}
        onChange={(v) => void handleAppLockChange(v)}
      />
    </>
  );
}
