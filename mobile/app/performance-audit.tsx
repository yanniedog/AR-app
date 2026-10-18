import { uiCount, uiDate, uiIdentifier, uiInputNumber, uiJoin, uiLabel, uiNumber, type UiCopy, type UiLabel, type UiText } from "../src/lib/uiCopy";
import { fontStyle } from '../src/theme/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { ScreenScrollView } from '../src/components/Screen';
import { InfoRow, ToggleRow } from '../src/components/settings/settingsUi';
import { AuditEvidenceText } from '../src/components/AuditEvidenceText';
import type { AppHealthDomain } from '../src/lib/appHealth/types';
import { DebugLogUploadStatus } from '../src/components/DebugLogUploadStatus';
import { BackgroundWorkDiagnosis } from '../src/components/BackgroundWorkDiagnosis';
import { AuditCatalogueCoverage } from '../src/components/AuditCatalogueCoverage';
import { AuditCheckSymbol, AuditOutcomeSymbols } from '../src/components/AuditOutcomeSymbols';
import {
  getDebugLogUploadSnapshot,
  isDebugLogUploadBusy,
  subscribeDebugLogUpload,
} from '../src/lib/debugLogSharing';
import { AppText, Button, Card, Disclosure, Row } from '../src/components/ui';
import {
  DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  getPerformanceAuditState,
  MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  parsePerformanceAuditHangTimeoutSeconds,
  PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY,
  requestPerformanceAudit,
  restoreCompletedPerformanceAudit,
  selectReportedAuditChecks,
  MAX_REPORTED_AUDIT_CHECKS,
  subscribePerformanceAudit,
  type AuditCheck,
} from '../src/lib/performanceAudit';
import { createDeidentifiedDiagnosticsShare } from '../src/lib/diagnosticsEnvelope';
import {
  getApkDownloadSnapshot,
  getHydratedApkDownloadSnapshot,
  subscribeApkDownload,
} from '../src/lib/appUpdate';
import { blocksPerformanceAudit } from '../src/lib/appUpdateDownloadLogic';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';
import { getPassiveAuditStatus, subscribePassiveAudit } from '../src/lib/passiveAudit';
import { restorePerformanceAuditUpload, uploadCompletedPerformanceAudit } from '../src/lib/performanceAuditSharing';
import { loadCompletedPerformanceAudit } from '../src/lib/performanceAuditReportStorage';

const DEIDENTIFIED_AUDIT_SHARE_FILE = `${FileSystem.cacheDirectory ?? ''}ar-app-health-report.json`;

function usePerformanceAuditState() {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
}

function useApkDownloadState() {
  return useSyncExternalStore(
    subscribeApkDownload,
    getApkDownloadSnapshot,
    getApkDownloadSnapshot,
  );
}

const DOMAIN_LABELS: Record<AppHealthDomain, UiLabel> = {
  performance: 'Performance', 'data-integrity': 'Data integrity', 'data-completeness': 'Data completeness',
  'asset-availability': 'Asset availability', 'display-completeness': 'Display completeness',
  storage: 'Storage', network: 'Network', update: 'App update',
};
function metricNumber(check: AuditCheck, key: string): number | null {
  const value=check.metrics[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value === 0 && check.metrics.executionAttempted !== true && check.metrics.measurementAvailable !== true) return null;
  return value;
}
function checkDuration(check: AuditCheck): number | null {
  if (check.durationMs == null || !Number.isFinite(check.durationMs)) return null;
  return check.durationMs !== 0 || check.metrics.executionAttempted === true || check.metrics.measurementAvailable === true ? check.durationMs : null;
}
function measuredMs(value: number | null | undefined, digits=0): UiText {
  return value == null ? uiLabel('Not measured') : uiJoin(uiNumber(value,digits),' ','ms');
}
function countPair(done: number,total: number): UiText { return uiJoin(uiCount(done),' / ',uiCount(total)); }

function PerformanceAuditScreenInner() {
  const theme = useTheme();
  const state = usePerformanceAuditState();
  const uploadState = useSyncExternalStore(subscribeDebugLogUpload, getDebugLogUploadSnapshot, getDebugLogUploadSnapshot);
  const uploadBusy = isDebugLogUploadBusy();
  const apkDownload = useApkDownloadState();
  const updateBlocksAudit = blocksPerformanceAudit(apkDownload);
  const [hangTimeoutInput, setHangTimeoutInput] = useState(
    String(DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
  );
  const passive = useSyncExternalStore(subscribePassiveAudit, getPassiveAuditStatus, getPassiveAuditStatus);
  const [hangTimeoutLoaded, setHangTimeoutLoaded] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [publicUpload, setPublicUpload] = useState(true);
  const [rawReportOpen, setRawReportOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const auditPreflightLocked = useRef(false);
  const mounted = useRef(true);
  const [auditPreflightMode, setAuditPreflightMode] = useState<'local' | 'live-source' | null>(null);
  const [visibleCheckLimit, setVisibleCheckLimit] = useState(MAX_REPORTED_AUDIT_CHECKS);
  const running = state.status === 'queued' || state.status === 'running';
  const report = running ? null : state.report;
  const orderedChecks = useMemo(
    () => (report ? selectReportedAuditChecks(report.checks) : []),
    [report],
  );
  const reportedChecks = orderedChecks.slice(0, visibleCheckLimit);
  useEffect(() => {
    setVisibleCheckLimit(MAX_REPORTED_AUDIT_CHECKS);
  }, [report?.sessionId]);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void loadCompletedPerformanceAudit().then(saved => {
      if (active && saved) restoreCompletedPerformanceAudit(saved);
    }).catch(() => {});
    return () => { active = false; mounted.current = false; };
  }, []);
  useEffect(() => {
    if (report) void restorePerformanceAuditUpload(report).catch(() => {});
  }, [report]);
  const hangTimeoutSeconds = parsePerformanceAuditHangTimeoutSeconds(hangTimeoutInput);
  const auditActions = useMemo(() => ({
    'audit.pass.complete': () => ({
      status: state.status,
      storedCheckCount: state.storedCheckCount,
      lastStoredCheckAt: state.lastStoredCheckAt,
    }),
  }), [state.lastStoredCheckAt, state.status, state.storedCheckCount]);
  usePerformanceAuditSurface({
    id: 'audit.progress',
    routeKey: '/performance-audit',
    renderRevision: `${state.status}:${state.storedCheckCount}:${state.lastStoredCheckAt ?? ''}`,
    actions: auditActions,
    probes: [
      {
        id: 'audit.state',
        kind: 'data',
        status: state.status === 'queued' ? 'pending' : 'ready',
      },
      {
        id: 'audit.log-buffer',
        kind: 'list',
        status: 'ready',
        expectedCount: state.storedCheckCount,
        actualCount: state.storedCheckCount,
      },
      {
        id: 'audit.layout',
        kind: 'layout',
        status: layoutReady && hangTimeoutLoaded ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
    ],
  });

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const parsed = parsePerformanceAuditHangTimeoutSeconds(stored);
        setHangTimeoutInput(
          String(parsed ?? DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHangTimeoutLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hangTimeoutLoaded || hangTimeoutSeconds == null) return;
    void AsyncStorage.setItem(
      PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY,
      String(hangTimeoutSeconds),
    ).catch(() => {});
  }, [hangTimeoutLoaded, hangTimeoutSeconds]);

  const runAudit = async (mode: 'local' | 'live-source') => {
    if (!hangTimeoutLoaded || hangTimeoutSeconds == null || auditPreflightLocked.current || running || state.recoveryRequired || isDebugLogUploadBusy()) return;
    auditPreflightLocked.current = true;
    const requestedUpload = publicUpload;
    setAuditPreflightMode(mode);
    try {
      let currentDownload: Awaited<ReturnType<typeof getHydratedApkDownloadSnapshot>>;
      try {
        currentDownload = await getHydratedApkDownloadSnapshot();
      } catch {
        if (!mounted.current) return;
        Alert.alert(
          uiLabel('Report unavailable'),
          uiLabel('Update state unconfirmed'),
        );
        return;
      }
      if (!mounted.current) return;
      if (blocksPerformanceAudit(currentDownload)) {
        Alert.alert(
          uiLabel('Report unavailable'),
          uiLabel('App update active'),
        );
        return;
      }
      requestPerformanceAudit({ hangTimeoutMs: hangTimeoutSeconds * 1_000, mode, uploadLog: requestedUpload });
    } finally {
      auditPreflightLocked.current = false;
      if (mounted.current) setAuditPreflightMode(null);
    }
  };
  const confirmShareReport = () => {
    if (!report || sharingReport) return;
    let prepared: ReturnType<typeof createDeidentifiedDiagnosticsShare>;
    try {
      prepared = createDeidentifiedDiagnosticsShare(report);
    } catch {
      Alert.alert(uiLabel('Report unavailable'));
      return;
    }
    Alert.alert(
      uiLabel('Share deidentified report?'),
      uiJoin('Destination', ': ', 'Operating-system share sheet', ' · ',
        'Size', ': ', uiCount(prepared.byteLength), ' ', 'bytes', ' · ',
        'Included', ': ', 'App / publication / aggregate counts / timing / fixed checks', ' · ',
        'Excluded', ': ', 'Raw logs / tracebacks / routes / product keys / device IDs / timestamps'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: uiLabel('Share'),
          onPress: () => {
            setSharingReport(true);
            void (async () => {
              let wroteShareFile = false;
              try {
                if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) {
                  throw new Error('Operating-system file sharing is unavailable on this device.');
                }
                await FileSystem.writeAsStringAsync(DEIDENTIFIED_AUDIT_SHARE_FILE, prepared.body);
                wroteShareFile = true;
                await Sharing.shareAsync(DEIDENTIFIED_AUDIT_SHARE_FILE, {
                  mimeType: 'application/json',
                  dialogTitle: uiLabel('Share deidentified report'),
                  UTI: 'public.json',
                });
              } catch {
                Alert.alert(uiLabel('Share failed'));
              } finally {
                if (wroteShareFile) {
                  try {
                    await FileSystem.deleteAsync(DEIDENTIFIED_AUDIT_SHARE_FILE, { idempotent: true });
                  } catch {
                    Alert.alert(uiLabel('Temporary report retained'), uiLabel('Deidentified'));
                  }
                }
                setSharingReport(false);
              }
            })();
          },
        },
      ],
    );
  };

  const summaryColor = report
    ? report.summary.overall === 'healthy'
      ? theme.colors.success
      : report.summary.overall === 'attention'
        ? theme.colors.warning
        : theme.colors.danger
    : theme.colors.textMuted;

  const auditDisabled = state.recoveryRequired || running || uploadBusy || !hangTimeoutLoaded || hangTimeoutSeconds == null || updateBlocksAudit || auditPreflightMode != null;
  const outcome = (value: 'healthy'|'attention'|'bottleneck'): UiCopy => value === 'healthy' ? 'Healthy' : value === 'attention' ? 'Needs review' : 'Failures found';
  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }} onLayout={() => setLayoutReady(true)}>
      <Card style={{ gap: 10 }}>
        <AppText variant="h2">{uiLabel('App health audit')}</AppText>
        <InfoRow label={uiLabel(running ? 'Audit upload' : 'Next audit upload')} value={uiLabel(running ? state.uploadLog ? 'Public' : 'Local' : publicUpload ? 'Public' : 'Local')} />
        <InfoRow label="Included" value="App / publication / aggregate counts / timing / fixed checks" />
        <InfoRow label="Excluded" value="Raw logs / tracebacks / routes / product keys / device IDs / timestamps" />
        <InfoRow label={uiLabel(running ? 'Destination' : 'Next destination')} value={uiLabel((running ? state.uploadLog : publicUpload) ? 'Public hosting' : 'Debug log')} />
        <InfoRow label="Public hosting" value={uiJoin(uiIdentifier('paste.rs'), ' / ', uiIdentifier('paste.c-net.org'))} />
        <ToggleRow icon="cloud-upload-outline" label="Public upload" value={running ? state.uploadLog : publicUpload} onChange={setPublicUpload} disabled={auditDisabled} />
        <InfoRow label="Step limit" value={measuredMs(10_000)} />
        <View style={{ gap: 6 }}>
          <AppText variant="small" weight="700">{uiLabel('Stall timeout')}</AppText>
          <Row style={{ alignItems: 'center' }} gap={8}>
            <TextInput accessibilityLabel={uiLabel('Stall timeout')} value={uiInputNumber(hangTimeoutInput)} onChangeText={setHangTimeoutInput}
              editable={!running} keyboardType="number-pad" inputMode="numeric" maxLength={4} selectTextOnFocus
              style={{ ...fontStyle(), minWidth:112, minHeight:48, paddingHorizontal:12, borderWidth:1,
                borderColor:hangTimeoutSeconds == null ? theme.colors.danger : theme.colors.border,
                borderRadius:theme.radius.md, backgroundColor:theme.colors.surfaceAlt, color:theme.colors.text, fontSize:theme.font.body }} />
            <AppText variant="small" color="textMuted">{uiLabel('seconds')}</AppText>
          </Row>
          <AppText variant="tiny" color={hangTimeoutSeconds == null ? 'danger':'textFaint'}>
            {uiJoin(hangTimeoutSeconds == null ? 'Invalid timeout' : 'Range', ': ', uiCount(MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS),'–',uiCount(MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS),' ','seconds')}
          </AppText>
        </View>
        <Button title="Run audit" icon="pulse-outline" loading={(running && state.auditMode === 'local') || auditPreflightMode === 'local'} disabled={auditDisabled} onPress={() => void runAudit('local')} />
        <Button title="Live audit" icon="cloud-download-outline" variant="secondary" loading={(running && state.auditMode === 'live-source') || auditPreflightMode === 'live-source'} disabled={auditDisabled} onPress={() => void runAudit('live-source')} />
        <InfoRow label="Local checks" value="Addresses / browser handlers / loaded data" />
        <InfoRow label="Live checks" value="Approved websites" />
        <InfoRow label="Off screen" value="Paused" />
        {updateBlocksAudit ? <AppText color="danger" accessibilityLiveRegion="polite">{uiLabel('App update active')}</AppText>:null}
        <Disclosure title="Background checks" open={backgroundOpen} onToggle={() => setBackgroundOpen(!backgroundOpen)}>
          <InfoRow label="Data" value={countPair(passive.completed,passive.total)} />
          <InfoRow label="Links" value={uiJoin(countPair(passive.linksCompleted,passive.linksTotal), passive.linksPreparing || passive.linksCapped ? uiJoin(' · ','Partial coverage'):null)} />
          <InfoRow label="System" value={uiLabel(passive.nativeStatus === 'restricted' ? 'System restricted' : passive.nativeStatus === 'unavailable' ? 'Foreground only' : passive.nativeStatus === 'registered' ? 'Ready':'Unknown')} />
          {passive.linksPreparing ? <InfoRow label="Preparation" value="Pending" />:null}
          {passive.linksCapped ? <InfoRow label="Storage" value="Storage limit reached" />:null}
          {passive.updatedAt ? <InfoRow label="Last evidence" value={uiDate(passive.updatedAt)} />:null}
          {passive.lastError ? <InfoRow label="Background checks" value="Failed" />:null}
        </Disclosure>
      </Card>
      {!running ? <DebugLogUploadStatus sessionId={report && uploadState.sessionId === report.sessionId ? report.sessionId : state.sessionId} /> : null}
      {state.status === 'cancelled' ? <Card><AppText>{uiLabel('Audit cancelled')}</AppText><InfoRow label="Results" value="Debug log" /></Card>:null}
      {state.status === 'failed' ? <Card style={{gap:8,borderColor:theme.colors.danger}}>
        <AppText color="danger">{uiLabel('Audit runner failed')}</AppText>
        <InfoRow label="Saved checks" value={uiCount(state.storedCheckCount)} />
        <InfoRow label="Last evidence" value={uiDate(state.lastStoredCheckAt)} />
        <InfoRow label="Raw report" value="Debug log" />
      </Card>:null}
      {report ? <>
        <Card style={{ gap: 8 }}>
          <InfoRow label="Report" value="Deidentified" />
          <InfoRow label="Destination" value="Public hosting" />
          <InfoRow label="Public hosting" value={uiJoin(uiIdentifier('paste.rs'), ' / ', uiIdentifier('paste.c-net.org'))} />
          <Button title="Upload report" icon="cloud-upload-outline" disabled={uploadBusy} onPress={() => {
            void uploadCompletedPerformanceAudit(report).catch(() => Alert.alert(uiLabel('Report unavailable')));
          }} />
        </Card>
        <Card style={{ gap: 8,borderWidth:1,borderColor:summaryColor }}>
          <Row style={{justifyContent:'space-between'}}><AppText variant="h3">{uiLabel('Diagnosis')}</AppText><AppText style={{color:summaryColor}}>{outcome(report.summary.overall)}</AppText></Row>
          <InfoRow label="Report" value={report.sessionId === state.sessionId ? 'Complete' : 'Saved'} />
          <InfoRow label="As at" value={uiDate(report.finishedAt)} />
          <AuditOutcomeSymbols checks={report.checks} />
          <InfoRow label="Check completion" value={report.summary.coveragePercent == null ? 'Unknown':uiJoin(uiNumber(report.summary.coveragePercent,1),'%')} />
          <InfoRow label="Executed" value={uiCount(report.summary.executed)} />
          <InfoRow label="Declared unavailable" value={uiCount(report.summary.justifiedSkipped)} />
          <InfoRow label="Unexpected" value={uiCount(report.summary.unexpectedSkipped)} />
          {report.coverage ? <>
            <InfoRow label="Journey checks" value={countPair(report.coverage.executedJourneyChecks,report.coverage.plannedJourneyChecks)} />
            <InfoRow label="Terminal unavailable" value={uiCount(report.coverage.justifiedSkippedJourneyChecks)} />
            <InfoRow label="Unavailable journeys" value={uiCount(report.coverage.unavailableJourneyChecks)} />
            <InfoRow label="Unexpected journeys" value={uiCount(report.coverage.unexpectedSkippedJourneyChecks)} />
            <InfoRow label="Unsafe side effects excluded" value={uiCount(report.coverage.excludedUnsafeFacetCount)} />
          </>:null}
          <InfoRow label="Slowest check" value={measuredMs(report.summary.slowestCheckMs)} />
          <InfoRow label="Max JS lag" value={measuredMs(report.summary.maxEventLoopLagMs)} />
          <InfoRow label="JS animation gap" value={measuredMs(report.summary.maxFrameGapMs)} />
          <InfoRow label="Duration" value={measuredMs(report.durationMs)} />
          <InfoRow label="Wall clock" value={measuredMs(report.wallClockMs)} />
          <InfoRow label="Stall timeout" value={measuredMs(report.watchdog.hangTimeoutMs)} />
          <InfoRow label="Saved checks" value={uiCount(report.watchdog.storedCheckCount)} />
          <InfoRow label="Version" value={uiIdentifier(report.environment.appVersion)} />
          <InfoRow label="Build" value={uiIdentifier(report.environment.buildVersion)} />
          <Button title="Share deidentified report" icon="share-outline" variant="ghost" loading={sharingReport} disabled={sharingReport} onPress={confirmShareReport} />
          <Disclosure title="Raw report" open={rawReportOpen} onToggle={() => setRawReportOpen(!rawReportOpen)}><AuditEvidenceText report={report}/></Disclosure>
        </Card>
        {report.backgroundWorkWait ? <BackgroundWorkDiagnosis wait={report.backgroundWorkWait}/>:null}
        <AuditCatalogueCoverage check={report.appHealth?.checks.find(check => check.code === 'catalogue-identity-coverage')} sampling={report.plan?.inputs.sampling}/>
        {report.appHealth ? <Card style={{gap:8}}>
          <AppText variant="h3">{uiLabel('Data and display health')}</AppText>
          <InfoRow label="Mode" value={uiLabel(report.appHealth.mode === 'local' ? 'Local checks':'Live checks')} />
          <InfoRow label="Check completion" value={report.appHealth.summary.coveragePercent == null ? 'Unknown':uiJoin(uiNumber(report.appHealth.summary.coveragePercent,1),'%')}/>
          {report.appHealth.domains.filter(domain => domain.total > 0).map(domain => <View key={domain.domain}>
            <InfoRow label={DOMAIN_LABELS[domain.domain]} value={outcome(domain.overall)} />
            <AppText variant="tiny">{uiJoin('Good',': ',uiCount(domain.pass),' · ','Needs review',': ',uiCount(domain.warn),' · ','Failed',': ',uiCount(domain.fail),' · ','Unavailable',': ',uiCount(domain.unavailable),' · ','Not run',': ',uiCount(domain.notRun))}</AppText>
          </View>)}
          {report.appHealth.checks.filter(check => check.status !== 'pass').map(check => <InfoRow key={check.id} label={uiIdentifier(check.id)} value={uiLabel(check.status === 'fail' ? 'Failed':check.status === 'warn' ? 'Needs review':check.status === 'not-run' ? 'Not run':'Unavailable')}/>)}
        </Card>:null}
        {report.routeAggregates.length ? <Card style={{gap:8}}><AppText variant="h3">{uiLabel('First / repeat')}</AppText>
          {report.routeAggregates.map(route => <View key={route.journeyId}>
            <AppText weight="700">{uiIdentifier(route.journeyId)}</AppText>
            <InfoRow label="Open" value={uiJoin(measuredMs(route.coldForwardMs),' → ',measuredMs(route.warmForwardMs))}/>
            <InfoRow label="Back" value={uiJoin(measuredMs(route.coldBackMs),' → ',measuredMs(route.warmBackMs))}/>
          </View>)}
        </Card>:null}
        <View style={{gap:8}}><AppText variant="h3">{uiLabel('Check results')}</AppText>
          <AppText variant="tiny">{countPair(reportedChecks.length,orderedChecks.length)}</AppText>
          {reportedChecks.map(check => <Card key={check.id} style={{gap:4}}>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}><AppText variant="small">{uiIdentifier(check.id)}</AppText><AuditCheckSymbol check={check} /></Row>
            <InfoRow label="Duration" value={measuredMs(checkDuration(check))}/>
            {check.kind === 'journey' ? <>
              <InfoRow label="Open" value={measuredMs(metricNumber(check,'forwardMs'),1)}/>
              <InfoRow label="Back" value={measuredMs(metricNumber(check,'backMs'),1)}/>
              <InfoRow label="Action" value={measuredMs(metricNumber(check,'actionMs'),1)}/>
              <InfoRow label="Max JS lag" value={measuredMs(metricNumber(check,'maxEventLoopLagMs'),1)}/>
              <InfoRow label="JS animation gap" value={measuredMs(metricNumber(check,'maxFrameGapMs'),1)}/>
            </>:null}
          </Card>)}
          {reportedChecks.length < orderedChecks.length ? <Button title={uiJoin('Show', ' ', uiCount(Math.min(MAX_REPORTED_AUDIT_CHECKS,orderedChecks.length-reportedChecks.length)), ' ', 'Checks')} icon="chevron-down-outline" variant="ghost" onPress={() => setVisibleCheckLimit(current => Math.min(orderedChecks.length,current+MAX_REPORTED_AUDIT_CHECKS))}/>:null}
        </View>
      </>:null}
    </ScreenScrollView>
  );
}

export default function PerformanceAuditScreen() {
  return <PerformanceAuditScreenInner />;
}
