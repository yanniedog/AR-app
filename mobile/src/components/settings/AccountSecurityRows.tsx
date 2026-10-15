import { uiLabel } from '../../lib/uiCopy';
import React, { useEffect, useRef, useState } from 'react';
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
  const changingRef = useRef(false);
  const mountedRef = useRef(true);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const handleAppLockChange = async (next: boolean) => {
    if (changingRef.current) return;
    changingRef.current = true;
    setChanging(true);
    try {
      if (next && !(await biometricsAvailable())) {
        Alert.alert('Device lock required', 'Device settings');
        return;
      }
      if (await authenticateBiometric('Confirm app lock')) onAppLockChange(next);
    } catch {
      Alert.alert('App lock', 'Failed');
    } finally {
      changingRef.current = false;
      if (mountedRef.current) setChanging(false);
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
        disabled={changing}
        onChange={(v) => void handleAppLockChange(v)}
      />
    </>
  );
}
