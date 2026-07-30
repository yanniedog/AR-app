import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
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

/**
 * One update check per app session; starts a background APK download when a
 * newer build is published. Banner visibility persists dismissal per
 * build_number, so it returns when the next release ships.
 */
export function useAppUpdateBanner(): AppUpdateBannerState {
  const dismissedBuild = useStore((s) => s.prefs.dismissedUpdateBuild);
  const wifiOnly = useStore((s) => s.prefs.wifiOnly);
  const setPref = useStore((s) => s.setPref);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    checkForAppUpdate()
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (r.status === 'available') {
          void ensureApkBackgroundDownload(r.remote, { wifiOnly }).catch(() => {
            // ensureApkBackgroundDownload persists phase=error for Retry.
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wifiOnly]);

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
  const wifiOnly = useStore((s) => s.prefs.wifiOnly);
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
