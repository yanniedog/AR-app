import { compactPerformanceAuditReadinessEvidence, performanceAuditReadinessRegistry } from './performanceAuditReadiness';
import { awaitPerformanceAuditWork } from './performanceAuditWork';
import { assertTrustedApkManifest, TRUSTED_ANDROID_PACKAGE, type UpdateCheckResult } from './appUpdateLogic';
import {
  getPerformanceAuditState, roundMetric, subscribePerformanceAudit,
  type AuditCheck, type AuditAppIdentity, type PerformanceAuditInactivityWatchdog,
} from './performanceAudit';
import type { ApkDownloadSnapshot } from './appUpdateDownloadLogic';
import type { AppHealthTransportGuard } from './appHealthTransportGuard';
import { ANDROID_UPDATE_READINESS_AUDIT } from './performanceAuditCheckInventory';

export const APP_UPDATE_AUDIT_SURFACE = ANDROID_UPDATE_READINESS_AUDIT.expectedSurface;
export const APP_UPDATE_AUDIT_ACTION = ANDROID_UPDATE_READINESS_AUDIT.semanticActionId;

/** Measure the real Settings controller and its committed, natively laid-out result. */
export async function runLiveUpdateReadiness(options: {
  app: AuditAppIdentity;
  download: ApkDownloadSnapshot;
  watchdog: PerformanceAuditInactivityWatchdog;
  transport: AppHealthTransportGuard;
  openSettings: () => Promise<void>;
  assertActive: () => void;
}): Promise<AuditCheck> {
  const { app, download, watchdog, transport, assertActive } = options;
  const started = globalThis.performance.now();
  const controller = new AbortController();
  const sessionId = getPerformanceAuditState().sessionId;
  if (!sessionId) throw new Error('Audit session is unavailable');
  const releaseMetadata = transport.beginAppUpdateMetadata();
  const networkBefore = transport.snapshot().transportCalls;
  const abortWhenInactive = setInterval(() => {
    try { assertActive(); } catch { controller.abort(); }
    if (watchdog.isExpired()) controller.abort();
  }, 25);
  try {
    return await awaitPerformanceAuditWork(async () => {
      await options.openSettings();
      assertActive();
      const before = await performanceAuditReadinessRegistry.waitForReady({
        surfaceIds: [APP_UPDATE_AUDIT_SURFACE], onlyKinds: ['layout'],
        quietWindowMs: 650, timeoutMs: watchdog.remainingMs(), signal: controller.signal,
        pauseState: { getPaused: () => getPerformanceAuditState().paused, subscribe: subscribePerformanceAudit },
      });
      const previous = before.surfaces.find(surface => surface.id === APP_UPDATE_AUDIT_SURFACE);
      if (!previous?.actions.includes(APP_UPDATE_AUDIT_ACTION)) throw new Error('Settings update action is not mounted');
      const raw = await performanceAuditReadinessRegistry.invokeAction(APP_UPDATE_AUDIT_SURFACE, APP_UPDATE_AUDIT_ACTION, {
        sessionId, signal: controller.signal, remainingMs: () => watchdog.remainingMs(),
      });
      const result = raw as UpdateCheckResult | null;
      if (!result || !['current', 'available', 'incompatible'].includes(result.status) || !('remote' in result)) {
        throw new Error('Settings did not return a validated update result');
      }
      assertTrustedApkManifest(result.remote);
      const readiness = await performanceAuditReadinessRegistry.waitForReady({
        surfaceIds: [APP_UPDATE_AUDIT_SURFACE], requiredKinds: ['data', 'layout'],
        changedRender: { surfaceId: APP_UPDATE_AUDIT_SURFACE, previousRevision: previous.renderRevision },
        quietWindowMs: 650, timeoutMs: watchdog.remainingMs(), signal: controller.signal,
        pauseState: { getPaused: () => getPerformanceAuditState().paused, subscribe: subscribePerformanceAudit },
      });
      const completion = performanceAuditReadinessRegistry.actionCompletion(APP_UPDATE_AUDIT_SURFACE);
      const networkCalls = transport.snapshot().transportCalls - networkBefore;
      if (!completion || completion.actionName !== APP_UPDATE_AUDIT_ACTION ||
          completion.actionRevision <= previous.actionRevision || networkCalls < 1) {
        throw new Error('Fresh update execution was not proven');
      }
      assertActive();
      return {
        id: ANDROID_UPDATE_READINESS_AUDIT.checkId, label: 'Android update manifest and rendered readiness', kind: ANDROID_UPDATE_READINESS_AUDIT.kind,
        status: result.status === 'incompatible' ? 'warn' : 'pass',
        durationMs: roundMetric(globalThis.performance.now() - started),
        metrics: {
          executionAttempted: true, actionInvoked: true, actionCompleted: true,
          ownerCheckId: ANDROID_UPDATE_READINESS_AUDIT.checkId, semanticActionId: APP_UPDATE_AUDIT_ACTION,
          executionPhase: ANDROID_UPDATE_READINESS_AUDIT.phase, transportScope: ANDROID_UPDATE_READINESS_AUDIT.transportScope,
          measurementMode: 'semantic-action', expectedPath: ANDROID_UPDATE_READINESS_AUDIT.expectedPath, expectedSurface: APP_UPDATE_AUDIT_SURFACE,
          actionSource: APP_UPDATE_AUDIT_SURFACE,
          actionRevisionBefore: previous.actionRevision, actionRevisionAfter: completion.actionRevision,
          renderRevisionBefore: previous.renderRevision,
          renderRevisionAfter: readiness.surfaces.find(surface => surface.id === APP_UPDATE_AUDIT_SURFACE)?.renderRevision ?? null,
          readinessSurfaces: readiness.surfaces.map(surface => surface.id).join(', '),
          readinessProbeCount: readiness.totalProbes, readinessRequiredProbeCount: readiness.requiredProbes,
          readinessPendingRequiredProbeCount: readiness.pendingRequiredProbes,
          readinessEvidence: compactPerformanceAuditReadinessEvidence(readiness),
          updateMetadataTransportCalls: networkCalls, durationMayUseTtlCache: false,
          manifestMetadataValidated: true, manifestPackageMatches: result.remote.package_name === TRUSTED_ANDROID_PACKAGE,
          installedVersion: app.appVersion, installedBuild: app.buildVersion,
          remoteVersion: result.remote.version, remoteBuild: result.remote.build_number,
          checkStatus: result.status, manifestBytes: result.remote.bytes ?? null, manifestHasSha256: Boolean(result.remote.sha256),
          downloadPhase: download.phase, downloadedBytes: download.bytesWritten, downloadTotalBytes: download.totalBytes,
          cachedBuild: download.buildNumber, cachedReady: download.phase === 'ready' && Boolean(download.localUri),
        },
      };
    }, { assertActive, label: 'Live update readiness', timeoutMs: watchdog.remainingMs() });
  } finally {
    clearInterval(abortWhenInactive);
    controller.abort();
    releaseMetadata();
  }
}
