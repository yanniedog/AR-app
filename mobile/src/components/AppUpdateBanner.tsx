import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Alert, AppState, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import {
  checkForAppUpdate,
  ensureApkBackgroundDownload,
  getApkDownloadPercent,
  installReadyApkUpdate,
  subscribeApkDownload,
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
 * Root-scoped update check. It starts a system-managed background download when
 * a newer build is published and checks again whenever the app becomes active.
 * Banner dismissal is per build_number, so a later release is shown again.
 */
export function useAppUpdateBanner(enabled = true): AppUpdateBannerState {
  const dismissedBuild = useStore((s) => s.prefs.dismissedUpdateBuild);
  const wifiOnly = useStore((s) => s.prefs.apkUpdatesWifiOnly);
  const setPref = useStore((s) => s.setPref);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    let cancelled = false;
    const checkAndDownload = () =>
      checkForAppUpdate()
        .then((r) => {
          if (cancelled) return;
          setResult(r);
          // Automatic downloads are Wi-Fi-only. Cellular downloads require an
          // explicit size-labelled confirmation in Settings.
          if (r.status === 'available' && wifiOnly) {
            void ensureApkBackgroundDownload(r.remote, { wifiOnly }).catch(() => {
              // ensureApkBackgroundDownload persists phase=error for Retry.
            });
          }
        })
        .catch(() => {});

    void checkAndDownload();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkAndDownload();
    });
    return () => {
      cancelled = true;
      appStateSubscription.remove();
    };
  }, [enabled, wifiOnly]);

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
  const [busy, setBusy] = useState(false);
  const forThisBuild =
    download.buildNumber != null && String(download.buildNumber) === String(remote.build_number);
  const phase = forThisBuild ? download.phase : 'idle';
  const pct = forThisBuild ? getApkDownloadPercent(download) : null;
  const copy = updateBannerCopy(phase, remote.version, pct);

  const onUpgrade = async () => {
    if (busy) return;
    if (phase === 'error' && !wifiOnly) {
      const size = remote.bytes
        ? `${(remote.bytes / (1024 * 1024)).toFixed(1)} MB`
        : 'an unknown size';
      Alert.alert('Download over cellular?', `This verified APK is ${size}. Carrier data charges may apply.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => void ensureApkBackgroundDownload(remote, { wifiOnly: false, force: true })
            .catch((error) => Alert.alert('Update failed', error instanceof Error ? error.message : String(error))),
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      if (phase === 'error') {
        await ensureApkBackgroundDownload(remote, { wifiOnly, force: true });
        return;
      }
      await installReadyApkUpdate(remote);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Update failed', message);
    } finally {
      setBusy(false);
    }
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
      accessible
      accessibilityRole="alert"
      accessibilityLabel={copy.title}
    >
      <Ionicons
        name={phase === 'ready' ? 'checkmark-circle-outline' : 'cloud-download-outline'}
        size={16}
        color={theme.colors.primary}
      />
      <AppText variant="small" weight="600" numberOfLines={1} style={{ flex: 1 }}>
        {copy.title}
      </AppText>
      <Pressable
        onPress={() => void onUpgrade()}
        disabled={!copy.actionEnabled || busy}
        accessibilityRole="button"
        accessibilityLabel={
          phase === 'ready' ? 'Upgrade from downloaded update' : copy.actionLabel
        }
        accessibilityState={{ disabled: !copy.actionEnabled || busy }}
        hitSlop={8}
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
