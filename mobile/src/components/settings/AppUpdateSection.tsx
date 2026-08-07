import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';

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
import { IDLE_APK_DOWNLOAD } from '../../lib/appUpdateDownloadLogic';
import { DisclosureGroup, InfoRow, Section, SettingsGap, ToggleRow } from './settingsUi';

export function AppUpdateSection() {
  const installed = getInstalledAppInfo();
  const wifiOnly = useStore((s) => s.prefs.apkUpdatesWifiOnly);
  const setPref = useStore((s) => s.setPref);
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [remote, setRemote] = useState<ApkManifest | null>(null);
  const [changelogs, setChangelogs] = useState<VersionChangelogSummary[]>([]);
  const [checking, setChecking] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);

  const onCheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    setCheckResult(null);
    setChangelogs([]);
    try {
      const result = await checkForAppUpdate();
      setCheckResult(result);
      if (
        result.status === 'available' ||
        result.status === 'current' ||
        result.status === 'incompatible'
      ) {
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

  const performUpgrade = useCallback(async () => {
    if (!remote) return;
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

  const onUpgrade = useCallback(() => {
    void performUpgrade();
  }, [performUpgrade]);

  if (Platform.OS !== 'android') {
    return null;
  }

  const updateAvailable = checkResult?.status === 'available';
  const isCurrent = checkResult?.status === 'current';
  const isIncompatible = checkResult?.status === 'incompatible';
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
      ? `Verified and ready to install · ${latestLabel}`
      : phase === 'verifying'
        ? `Verifying download · ${latestLabel}`
        : phase === 'retrying'
          ? `Recovering download · ${latestLabel}`
          : phase === 'waiting'
            ? `Waiting for Wi-Fi · ${latestLabel}`
          : phase === 'cancelled'
            ? `Download cancelled · ${latestLabel}`
      : phase === 'downloading'
        ? `Downloading in background · ${latestLabel}`
        : `Update available · ${latestLabel}`
    : isCurrent
      ? `Up to date · ${installed.version} (${installed.buildNumber})`
      : isIncompatible
        ? `Update unavailable on this device · ${installed.version} (${installed.buildNumber})`
        : checking || (!checkResult && !error)
        ? 'Checking…'
        : error
          ? 'Check failed'
          : `${installed.version} (${installed.buildNumber})`;

  const upgradeTitle =
    phase === 'downloading' || phase === 'retrying' || phase === 'verifying'
        ? 'Install when ready'
      : phase === 'waiting' || phase === 'error' || phase === 'cancelled'
        ? 'Resume update'
        : phase === 'ready'
          ? 'Install update'
          : 'Download & install';

  return (
    <Section title="App update">
      <ToggleRow
        icon="wifi-outline"
        label="Download APKs on Wi-Fi only"
        sub="Recommended for large app updates; rate-data refresh settings are separate"
        value={wifiOnly}
        onChange={(value) => setPref('apkUpdatesWifiOnly', value)}
      />
      <SettingsGap size={8} />
      <InfoRow label="Status" value={statusValue} />
      {downloadPct !== null && phase === 'downloading' ? (
        <InfoRow label="Download" value={`${downloadPct}%`} />
      ) : null}
      {error || (phase === 'error' && download.error) ? (
        <AppText variant="tiny" color="danger" style={{ marginTop: 4 }}>
          {error ?? download.error}
        </AppText>
      ) : null}
      {isIncompatible ? (
        <AppText variant="tiny" color="warning" style={{ marginTop: 4, lineHeight: 16 }}>
          {checkResult.message}
        </AppText>
      ) : null}
      {updateAvailable ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
          {wifiOnly
            ? 'The verified APK downloads automatically on Wi-Fi, including in the background.'
            : 'Your saved preference allows this verified APK to download automatically on Wi-Fi or mobile data.'}
          {' '}When it is ready, Install opens any one-time Android permission and resumes automatically when you return.
        </AppText>
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
            loading={upgrading}
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
