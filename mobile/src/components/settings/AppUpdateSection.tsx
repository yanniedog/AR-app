import { uiLabel } from '../../lib/uiCopy';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Device from 'expo-device';

import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { AppText, Button, Row } from '../ui';
import { SELF_UPDATE_ENABLED } from '../../config';
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
import { getPerformanceAuditState, subscribePerformanceAudit } from '../../lib/performanceAudit';
import { readAppUpdateMetadata, type AppUpdateAuditRequest } from '../../lib/appUpdateMetadata';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';
import { usePerformanceAuditSurface } from '../../hooks/usePerformanceAuditReadiness';
import { ANDROID_UPDATE_READINESS_AUDIT } from '../../lib/performanceAuditCheckInventory';
import { DisclosureGroup, InfoRow, Section, SettingsGap, ToggleRow } from './settingsUi';
import { uiJoin, uiIdentifier, uiNumber, type UiCopy } from '../../lib/uiCopy';

export interface AppUpdateSurfaceStatus {
  terminal: boolean;
  status: string;
  error: string | null;
}

export function AppUpdateSection({
  onStatusChange,
}: {
  onStatusChange?: (status: AppUpdateSurfaceStatus) => void;
} = {}) {
  const installed = getInstalledAppInfo();
  const wifiOnly = useStore((s) => s.prefs.apkUpdatesWifiOnly);
  const autoDownload = useStore((s) => s.prefs.apkUpdatesAutoDownload);
  const setPref = useStore((s) => s.setPref);
  const auditState = useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
  const auditOwnsNetwork = auditState.status === 'queued' || auditState.status === 'running';
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [remote, setRemote] = useState<ApkManifest | null>(null);
  const [changelogs, setChangelogs] = useState<VersionChangelogSummary[]>([]);
  const [checking, setChecking] = useState(SELF_UPDATE_ENABLED);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResultSession, setAuditResultSession] = useState<string | null>(null);
  const [auditRequestRevision, setAuditRequestRevision] = useState(0);
  const [measuredUpdateRevision, setMeasuredUpdateRevision] = useState<string | null>(null);
  const committedUpdateRevision = useRef<string | null>(null);
  const mounted = useRef(true);
  const auditPending = useRef<{ sessionId: string; promise: Promise<UpdateCheckResult>; abort: () => void } | null>(null);
  const updateRevision = useRef(new OpaquePerformanceAuditRenderRevision());
  const [download, setDownload] = useState<ApkDownloadSnapshot>(() => ({
    ...IDLE_APK_DOWNLOAD,
  }));

  useEffect(() => subscribeApkDownload(setDownload), []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; auditPending.current?.abort(); };
  }, []);

  const runAuditCheck = useCallback((raw: unknown): Promise<UpdateCheckResult> => {
    const request = raw as Partial<AppUpdateAuditRequest> | null;
    const current = getPerformanceAuditState();
    if (!SELF_UPDATE_ENABLED || Platform.OS !== 'android' || !request ||
        current.status !== 'running' || current.auditMode !== ANDROID_UPDATE_READINESS_AUDIT.executionMode ||
        request.sessionId !== current.sessionId || !request.signal ||
        typeof request.signal.addEventListener !== 'function' || request.signal.aborted ||
        typeof request.remainingMs !== 'function' || request.remainingMs() <= 0) {
      return Promise.reject(new Error('Live update check is unavailable for this audit session'));
    }
    const valid = request as AppUpdateAuditRequest;
    if (auditPending.current) {
      return auditPending.current.sessionId === valid.sessionId
        ? auditPending.current.promise
        : Promise.reject(new Error('Another update check is still pending'));
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    valid.signal.addEventListener('abort', abort, { once: true });
    const stillCurrent = () => mounted.current && !controller.signal.aborted &&
      getPerformanceAuditState().status === 'running' &&
      getPerformanceAuditState().sessionId === valid.sessionId && !getPerformanceAuditState().cancelRequested;
    setAuditResultSession(valid.sessionId);
    setAuditRequestRevision(revision => revision + 1);
    setChecking(true);
    setCheckResult(null);
    setRemote(null);
    setChangelogs([]);
    setError(null);
    const promise = (async () => {
      try {
        const result = await readAppUpdateMetadata(getInstalledAppInfo(), Device.supportedCpuArchitectures,
          { ...valid, signal: controller.signal });
        if (!stillCurrent()) throw new Error('Live update check was cancelled');
        setCheckResult(result);
        if (result.status === 'error') {
          setError(result.message);
          throw new Error(result.message);
        }
        setRemote(result.remote);
        return result;
      } catch (caught) {
        if (stillCurrent()) setError(caught instanceof Error ? caught.message : 'Update check failed');
        throw caught;
      } finally {
        valid.signal.removeEventListener('abort', abort);
        if (mounted.current && getPerformanceAuditState().sessionId === valid.sessionId) setChecking(false);
        if (auditPending.current?.sessionId === valid.sessionId) auditPending.current = null;
      }
    })();
    auditPending.current = { sessionId: valid.sessionId, promise, abort };
    return promise;
  }, []);

  const ownAuditResult = auditResultSession === auditState.sessionId && auditResultSession != null;
  const renderRevision = updateRevision.current.update([
    auditResultSession, auditRequestRevision, checking, checkResult?.status, remote?.version, remote?.build_number, error,
  ]);
  const updateLayoutMeasured = measuredUpdateRevision === renderRevision;
  useLayoutEffect(() => {
    committedUpdateRevision.current = renderRevision;
    return () => {
      if (committedUpdateRevision.current === renderRevision) committedUpdateRevision.current = null;
    };
  }, [renderRevision]);
  const runCheck = useCallback(async (force = false, auditRequest?: unknown) => {
    if (auditRequest !== undefined) return runAuditCheck(auditRequest);
    if (!SELF_UPDATE_ENABLED || auditOwnsNetwork) return;
    setChecking(true);
    setError(null);
    setCheckResult(null);
    setChangelogs([]);
    try {
      const result = await checkForAppUpdate({ force });
      const currentAudit = getPerformanceAuditState();
      if (currentAudit.status === 'queued' || currentAudit.status === 'running') {
        return;
      }
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
        if (autoDownload) {
          void ensureApkBackgroundDownload(result.remote, { wifiOnly }).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }
      }
      if (result.status === 'error') {
        setError(result.message);
      }
    } catch (err) {
      const currentAudit = getPerformanceAuditState();
      if (currentAudit.status !== 'queued' && currentAudit.status !== 'running' && mounted.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mounted.current && !auditPending.current) setChecking(false);
    }
  }, [auditOwnsNetwork, autoDownload, runAuditCheck, wifiOnly]);

  const updateActions = useMemo<Record<typeof ANDROID_UPDATE_READINESS_AUDIT.semanticActionId,
    (request: unknown) => ReturnType<typeof runCheck>>>(() => ({
    'settings.update.check': (request: unknown) => runCheck(true, request),
  }), [runCheck]);
  usePerformanceAuditSurface({
    id: ANDROID_UPDATE_READINESS_AUDIT.expectedSurface, routeKey: ANDROID_UPDATE_READINESS_AUDIT.expectedPath,
    renderRevision, actions: updateActions,
    probes: [
      { id: 'app-update.result', kind: 'data', required: false,
        status: ownAuditResult && error ? 'error' : ownAuditResult && !checking && checkResult ? 'ready' : 'pending',
        expectedCount: 1, actualCount: ownAuditResult && !checking && checkResult ? 1 : 0,
        error: ownAuditResult ? error : null, renderRevision },
      { id: 'app-update.layout', kind: 'layout', status: updateLayoutMeasured ? 'ready' : 'pending',
        layoutMeasured: updateLayoutMeasured, renderRevision: measuredUpdateRevision },
    ],
  }, Platform.OS === 'android');

  useEffect(() => {
    if (auditOwnsNetwork) {
      setChecking(false);
      setError(null);
      setCheckResult(null);
      setRemote(null);
      setChangelogs([]);
      return;
    }
    if (SELF_UPDATE_ENABLED) void runCheck(false);
  }, [auditOwnsNetwork, runCheck]);

  const performUpgrade = useCallback(async () => {
    const audit = getPerformanceAuditState();
    if (audit.status === 'queued' || audit.status === 'running') return;
    if (!remote) return;
    setUpgrading(true);
    setError(null);
    try {
      await upgradeFromBackgroundDownload(remote, { wifiOnly });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      Alert.alert('Update failed');
    } finally {
      setUpgrading(false);
    }
  }, [remote, wifiOnly]);

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
    ? uiJoin(uiIdentifier(remote.version), ' (', uiIdentifier(String(remote.build_number)), ')')
    : isCurrent
      ? uiJoin(uiIdentifier(installed.version), ' (', uiIdentifier(String(installed.buildNumber)), ')')
      : '—';
  const statusValue: UiCopy = auditOwnsNetwork && !ownAuditResult
    ? 'Audit'
    : updateAvailable
      ? phase === 'ready'
      ? 'Ready'
      : phase === 'verifying'
        ? 'Verifying'
        : phase === 'retrying'
          ? 'Retry'
          : phase === 'waiting'
            ? 'Waiting for Wi-Fi'
          : phase === 'cancelled'
            ? 'Cancelled'
      : phase === 'downloading'
        ? 'Downloading'
        : 'Update available'
    : isCurrent
      ? 'Up to date'
      : isIncompatible
        ? 'Incompatible device'
        : checking || (!checkResult && !error)
        ? 'Checking'
        : error
          ? 'Check failed'
          : uiJoin(uiIdentifier(installed.version), ' (', uiIdentifier(String(installed.buildNumber)), ')');

  const upgradeTitle =
    phase === 'downloading' || phase === 'retrying' || phase === 'verifying'
        ? 'Install when ready'
      : phase === 'waiting' || phase === 'error' || phase === 'cancelled'
        ? 'Resume update'
        : phase === 'ready'
          ? 'Install update'
          : 'Download & install';

  const requestUpgrade = useCallback(() => {
    const audit = getPerformanceAuditState();
    if (audit.status === 'queued' || audit.status === 'running') return;
    if (!remote) return;
    if (phase === 'ready' || autoDownload) {
      void performUpgrade();
      return;
    }
    Alert.alert(
      'Download update',
      uiJoin('Version', ': ', uiIdentifier(remote.version), ' · ', 'Verified APK', ' · ', 'GitHub', ' · ', wifiOnly ? 'Wi-Fi only' : 'Current network', ' · ', 'Android installation permission'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => void performUpgrade() },
      ],
    );
  }, [autoDownload, performUpgrade, phase, remote, wifiOnly]);

  useEffect(() => {
    onStatusChange?.({
      terminal: (auditOwnsNetwork && !ownAuditResult) || Platform.OS !== 'android' || !SELF_UPDATE_ENABLED || (!checking && (checkResult != null || error != null)),
      status: auditOwnsNetwork && !ownAuditResult
        ? 'audit-network-suppressed'
        : Platform.OS !== 'android'
        ? 'not-android'
        : SELF_UPDATE_ENABLED
          ? statusValue
          : 'managed-by-google-play',
      error,
    });
  }, [auditOwnsNetwork, checkResult, checking, error, onStatusChange, ownAuditResult, statusValue]);

  if (Platform.OS !== 'android') {
    return null;
  }

  if (!SELF_UPDATE_ENABLED) {
    return (
      <Section title="App update">
        <InfoRow label="Status" value="Managed by Google Play" />
      </Section>
    );
  }

  return (
    <Section title="App update">
      <ToggleRow
        icon="cloud-download-outline"
        label="Download app updates automatically"
        value={autoDownload}
        onChange={(value) => setPref('apkUpdatesAutoDownload', value)}
      />
      <SettingsGap size={8} />
      <ToggleRow
        icon="wifi-outline"
        label="Download APKs on Wi-Fi only"
        value={wifiOnly}
        onChange={(value) => setPref('apkUpdatesWifiOnly', value)}
      />
      <SettingsGap size={8} />
      <View key={renderRevision} collapsable={false} onLayout={event => {
        if (!mounted.current || committedUpdateRevision.current !== renderRevision) return;
        setMeasuredUpdateRevision(event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0
          ? renderRevision : null);
      }}>
      <InfoRow label="Status" value={statusValue} />
      <InfoRow label="Version" value={latestLabel} />
      <InfoRow label="Source" value="GitHub" />
      <InfoRow label="APK" value="Verified" />
      <InfoRow label="Consent" value="Optional" />
      <InfoRow label="Install" value="Android installation permission" />
      {downloadPct !== null && phase === 'downloading' ? (
        <InfoRow label="Download" value={uiJoin(uiNumber(downloadPct), '%')} />
      ) : null}
      {error || (phase === 'error' && download.error) ? (
        <AppText variant="tiny" color="danger" style={{ marginTop: 4 }}>{uiLabel("Update failed")}</AppText>
      ) : null}
      {isIncompatible ? (
        <AppText variant="tiny" color="warning" style={{ marginTop: 4, lineHeight: 16 }}>{uiLabel("Incompatible device")}</AppText>
      ) : null}
      </View>

      {updateAvailable ? (
        <DisclosureGroup
          title="What's new"
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
          disabled={auditOwnsNetwork || upgrading}
          onPress={() => void runCheck(true)}
        />
        {updateAvailable ? (
          <Button
            title={upgradeTitle}
            icon={phase === 'ready' ? 'arrow-up-circle-outline' : 'download-outline'}
            style={{ flex: 1 }}
            loading={upgrading}
            disabled={auditOwnsNetwork || checking || upgrading}
            onPress={requestUpgrade}
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
  const { requestExternalUrl } = useTrustedExternalUrl();
  useAuditExternalLinks(entries.map((entry) => ({ url: entry.releaseUrl, purpose: 'app_release', label: `Australian Rates ${entry.version} changelog` })));
  const list = (
    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
      {entries.map((entry) => (
        <View key={entry.version} style={{ marginBottom: 8 }}>
          <AppText variant="small" weight="700">
            {uiIdentifier(entry.version)}
          </AppText>
          <Pressable
            onPress={() => requestExternalUrl({
              url: entry.releaseUrl,
              purpose: 'app_release',
              label: `Australian Rates ${entry.version} changelog`,
            })}
            accessibilityRole="link"
            accessibilityLabel={uiJoin('Changelog', ' ', uiIdentifier(entry.version))}
          >
            <AppText variant="tiny" color="primary" style={{ marginTop: 4 }}>{uiLabel("Full changelog")}</AppText>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );

  if (bare) return list;

  return (
    <View style={{ marginTop: 10, maxHeight: 220 }}>
      <AppText variant="tiny" weight="700" color="textFaint" style={{ marginBottom: 6, letterSpacing: 0.6 }}>{uiLabel("Changelog")}</AppText>
      {list}
    </View>
  );
}
