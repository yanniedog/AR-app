import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Row } from '../ui';
import { useStore } from '../../data/store';
import {
  checkForAppUpdate,
  ensureApkBackgroundDownload,
  getApkDownloadPercent,
  getInstalledAppInfo,
  subscribeApkDownload,
  upgradeFromBackgroundDownload,
  type ApkDownloadSnapshot,
  type ApkManifest,
  type UpdateCheckResult,
  type VersionChangelogSummary,
} from '../../lib/appUpdate';
import {
  canInstallApkUpdates,
  ensureInstallPermission,
  openInstallPermissionSettings,
} from '../../lib/installPermission';
import { IDLE_APK_DOWNLOAD } from '../../lib/appUpdateDownloadLogic';
import { DisclosureGroup, InfoRow, Section, SettingsGap } from './settingsUi';

export function AppUpdateSection() {
  const installed = getInstalledAppInfo();
  const wifiOnly = useStore((s) => s.prefs.wifiOnly);
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [remote, setRemote] = useState<ApkManifest | null>(null);
  const [changelogs, setChangelogs] = useState<VersionChangelogSummary[]>([]);
  const [checking, setChecking] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installAllowed, setInstallAllowed] = useState<boolean | null>(null);
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);

  const refreshInstallPermission = useCallback(async () => {
    setInstallAllowed(await canInstallApkUpdates());
  }, []);

  useEffect(() => {
    void refreshInstallPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshInstallPermission();
    });
    return () => sub.remove();
  }, [refreshInstallPermission]);

  const onCheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    setCheckResult(null);
    setChangelogs([]);
    try {
      const result = await checkForAppUpdate();
      setCheckResult(result);
      if (result.status === 'available' || result.status === 'current') {
        setRemote(result.remote);
      }
      if (result.status === 'available') {
        setChangelogs(result.changelogs);
        void ensureApkBackgroundDownload(result.remote, { wifiOnly }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
      }
      if (result.status === 'error') {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, [wifiOnly]);

  useEffect(() => {
    void onCheck();
  }, [onCheck]);

  const onUpgrade = useCallback(async () => {
    if (!remote) return;
    const allowed = await ensureInstallPermission();
    if (!allowed) return;
    setUpgrading(true);
    setError(null);
    try {
      await upgradeFromBackgroundDownload(remote, { wifiOnly });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      Alert.alert('Update failed', message);
    } finally {
      setUpgrading(false);
    }
  }, [remote, wifiOnly]);

  if (Platform.OS !== 'android') {
    return null;
  }

  const updateAvailable = checkResult?.status === 'available';
  const isCurrent = checkResult?.status === 'current';
  const forThisBuild =
    remote != null &&
    download.buildNumber != null &&
    String(download.buildNumber) === String(remote.build_number);
  const phase = forThisBuild ? download.phase : 'idle';
  const downloadPct = forThisBuild ? getApkDownloadPercent(download) : null;
  const latestLabel = remote
    ? `${remote.version} (${remote.build_number})`
    : isCurrent
      ? `${installed.version} (${installed.buildNumber})`
      : '—';
  const statusValue = updateAvailable
    ? phase === 'ready'
      ? `Ready to upgrade · ${latestLabel}`
      : phase === 'downloading'
        ? `Downloading in background · ${latestLabel}`
        : `Update available · ${latestLabel}`
    : isCurrent
      ? `Up to date · ${installed.version} (${installed.buildNumber})`
      : checking || (!checkResult && !error)
        ? 'Checking…'
        : error
          ? 'Check failed'
          : `${installed.version} (${installed.buildNumber})`;

  const upgradeTitle =
    phase === 'ready' ? 'Upgrade' : phase === 'downloading' ? 'Upgrade when ready' : 'Upgrade';

  return (
    <Section title="App update">
      <InfoRow label="Status" value={statusValue} />
      {downloadPct !== null && phase === 'downloading' ? (
        <InfoRow label="Download" value={`${downloadPct}%`} />
      ) : null}
      {error || (phase === 'error' && download.error) ? (
        <AppText variant="tiny" color="danger" style={{ marginTop: 4 }}>
          {error ?? download.error}
        </AppText>
      ) : null}
      {updateAvailable ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
          Updates download automatically in the background, including when the screen is off or you
          switch apps. Upgrade installs the already-downloaded APK.
        </AppText>
      ) : null}

      {installAllowed === false ? (
        <>
          <SettingsGap size={8} />
          <Button
            title="Allow app updates"
            icon="settings-outline"
            variant="secondary"
            onPress={() => void openInstallPermissionSettings()}
          />
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
            Android needs permission once to install updates from this app.
          </AppText>
        </>
      ) : null}

      {updateAvailable ? (
        <DisclosureGroup
          title="What's new"
          summary={changelogs[0] ? changelogs[0].version : latestLabel}
          defaultOpen
        >
          {changelogs.length ? (
            <UpdateChangelogList entries={changelogs} bare />
          ) : (
            <InfoRow label="Latest" value={latestLabel} />
          )}
        </DisclosureGroup>
      ) : null}

      <SettingsGap size={10} />
      <Row gap={12}>
        <Button
          title="Check for update"
          icon="cloud-download-outline"
          variant="secondary"
          style={{ flex: 1 }}
          loading={checking}
          disabled={upgrading}
          onPress={() => void onCheck()}
        />
        {updateAvailable ? (
          <Button
            title={upgradeTitle}
            icon={phase === 'ready' ? 'arrow-up-circle-outline' : 'download-outline'}
            style={{ flex: 1 }}
            loading={upgrading || (phase === 'downloading' && upgrading)}
            disabled={checking || upgrading}
            onPress={() => void onUpgrade()}
          />
        ) : null}
      </Row>
    </Section>
  );
}

export function UpdateChangelogList({
  entries,
  bare = false,
}: {
  entries: VersionChangelogSummary[];
  bare?: boolean;
}) {
  const list = (
    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
      {entries.map((entry) => (
        <View key={entry.version} style={{ marginBottom: 8 }}>
          <AppText variant="small" weight="700">
            {entry.version}
          </AppText>
          {entry.summaryBullets.map((bullet, idx) => (
            <AppText
              key={`${entry.version}-${idx}`}
              variant="tiny"
              color="textFaint"
              style={{ marginLeft: 8 }}
            >
              • {bullet}
            </AppText>
          ))}
          <Pressable
            onPress={() => void Linking.openURL(entry.releaseUrl)}
            accessibilityRole="button"
            accessibilityLabel={`Full changelog for version ${entry.version}`}
          >
            <AppText variant="tiny" color="primary" style={{ marginTop: 4 }}>
              Full changelog
            </AppText>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );

  if (bare) return list;

  return (
    <View style={{ marginTop: 10, maxHeight: 220 }}>
      <AppText variant="tiny" weight="700" color="textFaint" style={{ marginBottom: 6, letterSpacing: 0.6 }}>
        WHAT&apos;S NEW
      </AppText>
      {list}
    </View>
  );
}
