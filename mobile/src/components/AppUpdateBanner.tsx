import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Alert, AppState, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import {
  checkForAppUpdate,
  ensureApkBackgroundDownload,
  getApkDownloadPercent,
  subscribeApkDownload,
  upgradeFromBackgroundDownload,
  type ApkDownloadSnapshot,
  type ApkManifest,
  type UpdateCheckResult,
} from '../lib/appUpdate';
import { IDLE_APK_DOWNLOAD, updateBannerCopy } from '../lib/appUpdateDownloadLogic';
import { shouldShowUpdateBanner } from '../lib/updateBanner';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

export interface AppUpdateBannerState {
  visible: boolean;
  remote: ApkManifest | null;
  download: ApkDownloadSnapshot;
  dismiss: () => void;
}

const AppUpdateBannerVisibleContext = createContext(false);

export function AppUpdateBannerLayoutProvider({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <AppUpdateBannerVisibleContext.Provider value={visible}>
      {children}
    </AppUpdateBannerVisibleContext.Provider>
  );
}

export function useAppUpdateBannerVisible(): boolean {
  return useContext(AppUpdateBannerVisibleContext);
}

/**
 * Root-scoped update check. It checks again whenever the app becomes active and
 * starts a background download only when the user enabled standing consent.
 * Banner dismissal is per build_number, so a later release is shown again.
 */
export function useAppUpdateBanner(enabled = true): AppUpdateBannerState {
  const dismissedBuild = useStore((s) => s.prefs.dismissedUpdateBuild);
  const wifiOnly = useStore((s) => s.prefs.apkUpdatesWifiOnly);
  const autoDownload = useStore((s) => s.prefs.apkUpdatesAutoDownload);
  const setPref = useStore((s) => s.setPref);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    let cancelled = false;
    let availableManifest: ApkManifest | null = null;
    const checkAndDownload = () =>
      checkForAppUpdate()
        .then((r) => {
          if (cancelled) return;
          setResult(r);
          availableManifest = r.status === 'available' ? r.remote : null;
          if (autoDownload && r.status === 'available') {
            void ensureApkBackgroundDownload(r.remote, { wifiOnly }).catch(() => {
              // ensureApkBackgroundDownload persists phase=error for Retry.
            });
          }
        })
        .catch(() => {});
    const reconcileActiveDownload = () => {
      if (!autoDownload || !availableManifest || AppState.currentState !== 'active') return;
      void ensureApkBackgroundDownload(availableManifest, { wifiOnly }).catch(() => {
        // Reconciliation persists an actionable error state for Retry.
      });
    };

    void checkAndDownload();
    const reconcileTimer = setInterval(reconcileActiveDownload, 30_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkAndDownload();
    });
    return () => {
      cancelled = true;
      clearInterval(reconcileTimer);
      appStateSubscription.remove();
    };
  }, [autoDownload, enabled, wifiOnly]);

  const available = result?.status === 'available' ? result : null;
  return {
    visible: shouldShowUpdateBanner(result, dismissedBuild),
    remote: available?.remote ?? null,
    download,
    dismiss: () => {
      if (available) setPref('dismissedUpdateBuild', available.remote.build_number);
    },
  };
}

/** Dismissible top-of-app banner shown when a newer APK is published. */
export function AppUpdateBanner({
  remote,
  download,
  onDismiss,
}: {
  remote: ApkManifest;
  download: ApkDownloadSnapshot;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const wifiOnly = useStore((s) => s.prefs.apkUpdatesWifiOnly);
  const autoDownload = useStore((s) => s.prefs.apkUpdatesAutoDownload);
  const [busy, setBusy] = useState(false);
  const forThisBuild =
    download.buildNumber != null && String(download.buildNumber) === String(remote.build_number);
  const phase = forThisBuild ? download.phase : 'idle';
  const pct = forThisBuild ? getApkDownloadPercent(download) : null;
  const copy = updateBannerCopy(phase, remote.version, pct);

  const onUpgrade = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await upgradeFromBackgroundDownload(remote, { wifiOnly });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Update failed', message);
    } finally {
      setBusy(false);
    }
  };

  const requestUpgrade = () => {
    if (phase === 'ready' || autoDownload) {
      void onUpgrade();
      return;
    }
    Alert.alert(
      'Download app update?',
      `Version ${remote.version} will download a verified APK from GitHub${wifiOnly ? ' when Wi-Fi is available' : ' using the current network'}. Android will ask again before installation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => void onUpgrade() },
      ],
    );
  };

  return (
    <Row
      gap={8}
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderBottomColor: theme.colors.border,
        borderBottomWidth: 1,
        paddingHorizontal: 14,
        paddingTop: insets.top + 6,
        paddingBottom: 8,
      }}
    >
      <Ionicons
        name={phase === 'ready' ? 'checkmark-circle-outline' : 'cloud-download-outline'}
        size={16}
        color={theme.colors.primary}
      />
      <AppText
        variant="small"
        weight="600"
        numberOfLines={1}
        accessibilityLiveRegion="polite"
        style={{ flex: 1 }}
      >
        {copy.title}
      </AppText>
      <Pressable
        onPress={requestUpgrade}
        disabled={!copy.actionEnabled || busy}
        accessibilityRole="button"
        accessibilityLabel={
          phase === 'ready' ? 'Install verified update' : copy.actionLabel
        }
        accessibilityState={{ disabled: !copy.actionEnabled || busy }}
        hitSlop={8}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <AppText
          variant="small"
          weight="800"
          style={{
            color: copy.actionEnabled && !busy ? theme.colors.primary : theme.colors.textFaint,
          }}
        >
          {busy ? '…' : copy.actionLabel}
        </AppText>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss update banner"
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={theme.colors.textMuted} />
      </Pressable>
    </Row>
  );
}
