import { uiLabel } from '../../lib/uiCopy';
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
        'Device lock required',
        'Device settings',
      );
      return;
    }
    if (await authenticateBiometric('Confirm app lock')) {
      onAppLockChange(next);
    }
  };

  return (
    <>
      <AppText variant="tiny" color="textFaint">{uiLabel("Local only")}</AppText>
      <SettingsGap size={10} />
      <ToggleRow
        icon="finger-print"
        label="App lock"
        value={appLockEnabled}
        onChange={(v) => void handleAppLockChange(v)}
      />
    </>
  );
}
