import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { PLAY_STORE_URL, SELF_UPDATE_ENABLED } from '../config';
import { useStore } from '../data/store';
import { checkForAppUpdate, upgradeFromBackgroundDownload } from './appUpdate';
import { debugLog } from './debugLog';

/**
 * Update action for an incompatible payload. Self-updating Android builds
 * install the verified APK directly; otherwise the store listing opens. Any
 * failure falls back to Settings, which owns the full update surface.
 */
export async function startAppUpdate(): Promise<void> {
  try {
    if (SELF_UPDATE_ENABLED && Platform.OS === 'android') {
      const result = await checkForAppUpdate({ force: true });
      if (result.status === 'available') {
        await upgradeFromBackgroundDownload(result.remote, {
          wifiOnly: useStore.getState().prefs.apkUpdatesWifiOnly,
        });
        return;
      }
      debugLog.info('app-update', `update action check status=${result.status}`);
      router.push('/settings');
      return;
    }
    await Linking.openURL(PLAY_STORE_URL);
  } catch (err) {
    debugLog.warn('app-update', `update action failed: ${String((err as Error)?.message ?? err)}`);
    router.push('/settings');
  }
}
