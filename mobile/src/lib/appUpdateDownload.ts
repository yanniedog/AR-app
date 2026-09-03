import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { Alert, AppState, Platform } from 'react-native';
import {
  completeHandler,
  createDownloadTask,
  directories,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';

import { debugLog } from './debugLog';
import {
  APK_READY_RECEIPT_VERSION,
  IDLE_APK_DOWNLOAD,
  APK_DOWNLOAD_STALL_MS,
  apkDestinationPath,
  apkDownloadTaskId,
  canAutoRetryApkDownload,
  downloadPercent,
  hasTrustedReadyApkReceipt,
  invalidCachedApkRecoverySnapshot,
  isCachedApkReady,
  isApkDownloadStalled,
  isUserCancelledDownload,
  shouldEnsureBackgroundDownload,
  shouldClearOrphanedApkDownload,
  toFileUri,
  type ApkDownloadSnapshot,
} from './appUpdateDownloadLogic';
import {
  assertApkCompatibleWithDevice,
  assertDownloadedApkMatchesManifest,
  assertTrustedApkManifest,
  preferImmutableApkDownloadUrl,
  type ApkManifest,
} from './appUpdateLogic';
import { installDownloadedApk, verifyDownloadedApk } from './appUpdateInstall';
import { isPerformanceAuditActive } from './performanceAudit';

const STORAGE_KEY = 'app-update-download-v1';
const EXPLICIT_WAIT_STALL_MS = 3 * 60 * 1000;
const APK_VERIFICATION_STALL_MS = 5 * 60 * 1000;

let snapshot: ApkDownloadSnapshot = { ...IDLE_APK_DOWNLOAD };
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let activeTask: DownloadTask | null = null;
let activeDownloadWifiOnly: boolean | null = null;
let currentProcessVerificationTaskId: string | null = null;
let ensureInFlight: Promise<void> | null = null;
let ensureKey: string | null = null;
let configReady = false;
let appStateHooked = false;
let appStateSub: { remove: () => void } | null = null;
let pendingPromptManifest: ApkManifest | null = null;
let promptedBuildThisSession: string | null = null;
const explicitUpgradeWaiters = new Map<string, number>();
const listeners = new Set<(s: ApkDownloadSnapshot) => void>();

function assertUpdateDownloadAllowed(): void {
  if (isPerformanceAuditActive()) {
    throw new Error(
      'App update download was not started because the app health audit owns network activity. Try again after the audit finishes.',
    );
  }
}

function hookAppStatePrompt(): void {
  if (appStateHooked || Platform.OS !== 'android') return;
  appStateHooked = true;
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !pendingPromptManifest) return;
    const manifest = pendingPromptManifest;
    pendingPromptManifest = null;
    void maybePromptUpgrade(manifest);
  });
}

function emit(next: ApkDownloadSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

async function persist(next: ApkDownloadSnapshot): Promise<void> {
  emit(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    debugLog.warn('app-update', `persist download state failed: ${String((err as Error)?.message ?? err)}`);
  }
}

function ensureConfig(wifiOnly: boolean): void {
  if (configReady) {
    setConfig({ allowsCellularAccess: !wifiOnly });
    return;
  }
  setConfig({
    progressInterval: 1000,
    progressMinBytes: 256 * 1024,
    allowsCellularAccess: !wifiOnly,
    showNotificationsEnabled: true,
    showCancelAction: true,
    showCompletionNotification: true,
    notificationsGrouping: {
      enabled: false,
      texts: {
        downloadTitle: 'App update',
        downloadStarting: 'Starting update download…',
        downloadProgress: 'Downloading update… {progress}%',
        downloadFinished: 'Update ready to install',
      },
    },
  });
  configReady = true;
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ApkDownloadSnapshot;
        if (parsed && typeof parsed === 'object' && typeof parsed.phase === 'string') {
          snapshot = { ...IDLE_APK_DOWNLOAD, ...parsed };
        }
      }
    } catch {
      snapshot = { ...IDLE_APK_DOWNLOAD };
    } finally {
      hydrated = true;
      emit(snapshot);
    }
  })();
  return hydratePromise;
}

async function fileExists(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(toFileUri(uri));
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

async function clearStaleFiles(keepFilename: string | null): Promise<void> {
  const docs = FileSystem.documentDirectory;
  if (!docs) return;
  try {
    const entries = await FileSystem.readDirectoryAsync(docs);
    await Promise.all(
      entries
        .filter((name) => name.startsWith('app-update-') && name.endsWith('.apk'))
        .filter((name) => (keepFilename ? name !== keepFilename : true))
        .map((name) => FileSystem.deleteAsync(`${docs}${name}`, { idempotent: true })),
    );
  } catch {
    // Best-effort cleanup only.
  }
}

async function stopTaskQuietly(task: DownloadTask | null | undefined): Promise<void> {
  if (!task) return;
  try {
    await task.stop();
  } catch {
    // ignore
  }
}

async function stopMatchingTask(manifest: ApkManifest): Promise<void> {
  const taskId = apkDownloadTaskId(manifest.build_number, manifest.sha256);
  if (activeTask?.id === taskId) {
    await stopTaskQuietly(activeTask);
    activeTask = null;
  }
  try {
    const existing = await getExistingDownloadTasks();
    for (const task of existing) {
      if (task.id === taskId || task.id.startsWith(`apk-update-${manifest.build_number}-`)) {
        await stopTaskQuietly(task);
      }
    }
  } catch {
    // Best-effort only.
  }
  activeDownloadWifiOnly = null;
}

function attachHandlers(task: DownloadTask, manifest: ApkManifest): void {
  activeTask = task;
  task
    .begin(({ expectedBytes }) => {
      const now = new Date().toISOString();
      void persist({
        ...snapshot,
        phase: 'downloading',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        totalBytes: expectedBytes || manifest.bytes || snapshot.totalBytes,
        startedAt: snapshot.startedAt ?? now,
        lastProgressAt: now,
        nativeState: 'DOWNLOADING',
        error: null,
      });
      debugLog.info(
        'app-update',
        `download begin build=${manifest.build_number} expectedBytes=${expectedBytes || manifest.bytes || 'unknown'}`,
      );
    })
    .progress(({ bytesDownloaded, bytesTotal }) => {
      const progressed = bytesDownloaded > snapshot.bytesWritten;
      void persist({
        ...snapshot,
        phase: 'downloading',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        bytesWritten: bytesDownloaded,
        totalBytes: bytesTotal || manifest.bytes || snapshot.totalBytes,
        lastProgressAt: progressed ? new Date().toISOString() : snapshot.lastProgressAt,
        nativeState: 'DOWNLOADING',
        error: null,
      });
    })
    .done(({ location, bytesDownloaded, bytesTotal }) => {
      currentProcessVerificationTaskId = task.id;
      void (async () => {
        try {
          await persist({
            ...snapshot,
            phase: 'verifying',
            buildNumber: manifest.build_number,
            version: manifest.version,
            bytesWritten: bytesDownloaded,
            totalBytes: bytesTotal || manifest.bytes || snapshot.totalBytes,
            lastProgressAt: new Date().toISOString(),
            nativeState: 'DONE',
            error: null,
          });
          debugLog.info(
            'app-update',
            `download complete; verifying build=${manifest.build_number} bytes=${bytesDownloaded}`,
          );
          await completeHandler(task.id);
          const localUri = toFileUri(location);
          const verification = await verifyDownloadedApk(localUri, manifest);
          await persist({
            phase: 'ready',
            buildNumber: manifest.build_number,
            version: manifest.version,
            downloadUrl: manifest.download_url,
            sha256: manifest.sha256 ?? null,
            localUri,
            bytesWritten: bytesDownloaded,
            totalBytes: bytesTotal || manifest.bytes || null,
            wifiOnly: activeDownloadWifiOnly,
            startedAt: snapshot.startedAt,
            lastProgressAt: new Date().toISOString(),
            retryCount: snapshot.retryCount,
            nativeState: 'DONE',
            error: null,
            verifiedSha256: manifest.sha256?.toLowerCase() ?? null,
            verifiedBytes: verification.size,
            verifiedAt: new Date().toISOString(),
            verifiedReceiptVersion: APK_READY_RECEIPT_VERSION,
          });
          debugLog.info(
            'app-update',
            `background download ready build=${manifest.build_number} bytes=${bytesDownloaded}`,
          );
          await maybePromptUpgrade(manifest);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          debugLog.error('app-update', `post-download failed: ${message}`);
          await persist({
            ...snapshot,
            phase: 'error',
            buildNumber: manifest.build_number,
            version: manifest.version,
            localUri: null,
            error: message,
          });
        } finally {
          if (currentProcessVerificationTaskId === task.id) {
            currentProcessVerificationTaskId = null;
          }
          if (activeTask?.id === task.id) {
            activeTask = null;
            activeDownloadWifiOnly = null;
          }
        }
      })();
    })
    .error(({ error, errorCode }) => {
      const userCancelled = isUserCancelledDownload(error, errorCode);
      void persist({
        phase: userCancelled ? 'cancelled' : 'error',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        localUri: null,
        bytesWritten: snapshot.bytesWritten,
        totalBytes: snapshot.totalBytes,
        wifiOnly: activeDownloadWifiOnly ?? snapshot.wifiOnly,
        startedAt: snapshot.startedAt,
        lastProgressAt: snapshot.lastProgressAt,
        retryCount: snapshot.retryCount,
        nativeState: userCancelled ? 'CANCELLED' : 'FAILED',
        error: userCancelled ? null : `${error}${errorCode ? ` (${errorCode})` : ''}`,
        verifiedSha256: null,
        verifiedBytes: null,
        verifiedAt: null,
        verifiedReceiptVersion: null,
      });
      if (userCancelled) {
        debugLog.info('app-update', `background download cancelled by user build=${manifest.build_number}`);
      } else {
        debugLog.error('app-update', `background download failed: ${error} code=${errorCode}`);
      }
      if (activeTask?.id === task.id) {
        activeTask = null;
        activeDownloadWifiOnly = null;
      }
    });
}

async function reattachExisting(manifest: ApkManifest): Promise<boolean> {
  const taskId = apkDownloadTaskId(manifest.build_number, manifest.sha256);
  let existing: DownloadTask[] = [];
  try {
    existing = await getExistingDownloadTasks();
  } catch (err) {
    debugLog.warn('app-update', `getExistingDownloadTasks failed: ${String((err as Error)?.message ?? err)}`);
    return false;
  }
  assertUpdateDownloadAllowed();

  const match = existing.find((t) => t.id === taskId);
  for (const task of existing) {
    if (task.id !== taskId && task.id.startsWith('apk-update-')) {
      await stopTaskQuietly(task);
    }
  }
  if (!match) return false;

  const state = String(match.state || '').toUpperCase();
  debugLog.info(
    'app-update',
    `reconcile build=${manifest.build_number} nativeState=${state || 'unknown'} bytes=${match.bytesDownloaded}/${match.bytesTotal || manifest.bytes || 'unknown'}`,
  );
  const taskWifiOnly =
    match.downloadParams?.isAllowedOverMetered === false &&
    match.downloadParams?.isAllowedOverRoaming === false;
  const terminalFailed =
    state === 'FAILED' || state === 'STOPPED' || state === 'ERROR' || state === 'CANCELLED';

  if (state === 'DONE') {
    const dest =
      match.downloadParams?.destination ??
      apkDestinationPath(directories.documents, manifest.build_number, manifest.sha256);
    if (await fileExists(dest)) {
      currentProcessVerificationTaskId = match.id;
      try {
        const localUri = toFileUri(dest);
        assertUpdateDownloadAllowed();
        await persist({
          ...snapshot,
          phase: 'verifying',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri,
          bytesWritten: match.bytesDownloaded,
          totalBytes: match.bytesTotal || manifest.bytes || null,
          wifiOnly: taskWifiOnly,
          nativeState: state,
          error: null,
        });
        const verification = await verifyDownloadedApk(localUri, manifest);
        await persist({
          phase: 'ready',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri,
          bytesWritten: match.bytesDownloaded,
          totalBytes: match.bytesTotal || manifest.bytes || null,
          wifiOnly: taskWifiOnly,
          startedAt: snapshot.startedAt,
          lastProgressAt: new Date().toISOString(),
          retryCount: snapshot.retryCount,
          nativeState: state,
          error: null,
          verifiedSha256: manifest.sha256?.toLowerCase() ?? null,
          verifiedBytes: verification.size,
          verifiedAt: new Date().toISOString(),
          verifiedReceiptVersion: APK_READY_RECEIPT_VERSION,
        });
        await maybePromptUpgrade(manifest);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        debugLog.warn('app-update', `DONE task unusable, will re-download: ${message}`);
        await persist({ ...snapshot, phase: 'error', error: message, localUri: null });
        await stopTaskQuietly(match);
        if (activeTask?.id === match.id) activeTask = null;
        activeDownloadWifiOnly = null;
        return false;
      } finally {
        if (currentProcessVerificationTaskId === match.id) {
          currentProcessVerificationTaskId = null;
        }
      }
    }
    debugLog.warn('app-update', 'DONE task missing destination file; starting a new download');
    await stopTaskQuietly(match);
    if (activeTask?.id === match.id) activeTask = null;
    activeDownloadWifiOnly = null;
    return false;
  }

  if (terminalFailed) {
    debugLog.warn('app-update', `terminal task state=${state}; starting a new download`);
    await stopTaskQuietly(match);
    if (activeTask?.id === match.id) activeTask = null;
    activeDownloadWifiOnly = null;
    return false;
  }

  if (activeTask?.id !== match.id) {
    attachHandlers(match, manifest);
  }
  activeDownloadWifiOnly = taskWifiOnly;
  if (state === 'PAUSED') {
    try {
      await match.resume();
    } catch (err) {
      debugLog.warn('app-update', `resume failed: ${String((err as Error)?.message ?? err)}`);
      await stopTaskQuietly(match);
      if (activeTask?.id === match.id) activeTask = null;
      activeDownloadWifiOnly = null;
      return false;
    }
  }

  await persist({
    phase: 'downloading',
    buildNumber: manifest.build_number,
    version: manifest.version,
    downloadUrl: manifest.download_url,
    sha256: manifest.sha256 ?? null,
    localUri: null,
    bytesWritten: match.bytesDownloaded,
    totalBytes: match.bytesTotal || manifest.bytes || null,
    wifiOnly: taskWifiOnly,
    startedAt: snapshot.startedAt ?? new Date().toISOString(),
    lastProgressAt:
      match.bytesDownloaded > snapshot.bytesWritten
        ? new Date().toISOString()
        : snapshot.lastProgressAt,
    retryCount: snapshot.retryCount,
    nativeState: state,
    error: null,
    verifiedSha256: null,
    verifiedBytes: null,
    verifiedAt: null,
    verifiedReceiptVersion: null,
  });
  return true;
}

async function startNewDownload(
  manifest: ApkManifest,
  wifiOnly: boolean,
  retryCount = 0,
): Promise<void> {
  const destination = apkDestinationPath(directories.documents, manifest.build_number, manifest.sha256);
  const keepFilename = destination.split('/').pop() ?? null;
  await clearStaleFiles(keepFilename);
  try {
    await FileSystem.deleteAsync(toFileUri(destination), { idempotent: true });
  } catch {
    // ignore
  }

  // The audit can be requested while stale-file cleanup is awaiting native I/O.
  // Recheck at the last boundary before creating any native transfer.
  assertUpdateDownloadAllowed();

  const downloadUrl = preferImmutableApkDownloadUrl(manifest);
  if (downloadUrl !== manifest.download_url) {
    debugLog.info(
      'app-update',
      `background download using immutable APK URL for v${manifest.version}`,
    );
  }
  const task = createDownloadTask({
    id: apkDownloadTaskId(manifest.build_number, manifest.sha256),
    url: downloadUrl,
    destination,
    metadata: {
      version: manifest.version,
      buildNumber: manifest.build_number,
    },
    isAllowedOverRoaming: !wifiOnly,
    isAllowedOverMetered: !wifiOnly,
    maxRedirects: 10,
  });
  activeDownloadWifiOnly = wifiOnly;
  attachHandlers(task, manifest);
  const persistStarted = persist({
    phase: 'downloading',
    buildNumber: manifest.build_number,
    version: manifest.version,
    downloadUrl,
    sha256: manifest.sha256 ?? null,
    localUri: null,
    bytesWritten: 0,
    totalBytes: manifest.bytes ?? null,
    wifiOnly,
    startedAt: new Date().toISOString(),
    lastProgressAt: new Date().toISOString(),
    retryCount,
    nativeState: 'PENDING',
    error: null,
    verifiedSha256: null,
    verifiedBytes: null,
    verifiedAt: null,
    verifiedReceiptVersion: null,
  });
  // persist() publishes the blocking phase synchronously before its first
  // await. Starting in the same turn means an audit sees downloading and
  // refuses to measure, rather than racing an unreported native transfer.
  task.start();
  await persistStarted;
  debugLog.info(
    'app-update',
    `background download started build=${manifest.build_number} wifiOnly=${wifiOnly}`,
  );
}

/**
 * Start or reattach a system-managed APK download that continues while the
 * screen is off or the user leaves the app.
 */
export async function ensureApkBackgroundDownload(
  manifest: ApkManifest,
  options?: { wifiOnly?: boolean; force?: boolean },
): Promise<ApkDownloadSnapshot> {
  if (Platform.OS !== 'android') return getApkDownloadSnapshot();
  assertUpdateDownloadAllowed();
  assertTrustedApkManifest(manifest);
  assertApkCompatibleWithDevice(manifest, Device.supportedCpuArchitectures);
  await hydrate();
  // Hydration yields to the event loop, so audit ownership must be checked
  // again before any cached-file, native-task, or network work begins.
  assertUpdateDownloadAllowed();

  const wifiOnly = Boolean(options?.wifiOnly);
  let force = Boolean(options?.force);
  let autoRetry = false;
  try {
    ensureConfig(wifiOnly);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persist({
      ...snapshot,
      phase: 'error',
      buildNumber: manifest.build_number,
      version: manifest.version,
      downloadUrl: manifest.download_url,
      sha256: manifest.sha256 ?? null,
      localUri: null,
      bytesWritten: snapshot.bytesWritten,
      totalBytes: snapshot.totalBytes ?? manifest.bytes ?? null,
      wifiOnly: snapshot.wifiOnly,
      error: message,
    });
    throw err;
  }

  // Android DownloadManager cannot update network policy on an in-flight task.
  // Restart only when the requested policy differs from the active/persisted one.
  const currentWifiOnly = activeDownloadWifiOnly ?? snapshot.wifiOnly;
  if (
    !force &&
    String(snapshot.buildNumber) === String(manifest.build_number) &&
    (snapshot.phase === 'downloading' || snapshot.phase === 'waiting') &&
    currentWifiOnly != null &&
    currentWifiOnly !== wifiOnly
  ) {
    debugLog.info(
      'app-update',
      `network policy changed wifiOnly=${currentWifiOnly}->${wifiOnly}; restarting APK download`,
    );
    force = true;
  }

  if (!force) {
    if (isCachedApkReady(snapshot, manifest.build_number, await fileExists(snapshot.localUri))) {
      await maybePromptUpgrade(manifest);
      return snapshot;
    }

    const dest = apkDestinationPath(directories.documents, manifest.build_number, manifest.sha256);
    if (await fileExists(dest)) {
      try {
        const localUri = toFileUri(dest);
        assertUpdateDownloadAllowed();
        await persist({
          ...snapshot,
          phase: 'verifying',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri,
          totalBytes: snapshot.totalBytes ?? manifest.bytes ?? null,
          error: null,
        });
        const verification = await verifyDownloadedApk(localUri, manifest);
        await persist({
          ...snapshot,
          phase: 'ready',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri,
          bytesWritten: snapshot.bytesWritten,
          totalBytes: snapshot.totalBytes ?? manifest.bytes ?? null,
          wifiOnly: snapshot.wifiOnly,
          error: null,
          verifiedSha256: manifest.sha256?.toLowerCase() ?? null,
          verifiedBytes: verification.size,
          verifiedAt: new Date().toISOString(),
          verifiedReceiptVersion: APK_READY_RECEIPT_VERSION,
        });
        await maybePromptUpgrade(manifest);
        return snapshot;
      } catch (err) {
        const message = String((err as Error)?.message ?? err);
        debugLog.warn(
          'app-update',
          `cached APK invalid, re-downloading: ${message}`,
        );
        await stopMatchingTask(manifest);
        try {
          await FileSystem.deleteAsync(toFileUri(dest), { idempotent: true });
        } catch (deleteErr) {
          debugLog.warn(
            'app-update',
            `invalid cached APK cleanup failed: ${String((deleteErr as Error)?.message ?? deleteErr)}`,
          );
        }
        await persist(invalidCachedApkRecoverySnapshot(snapshot, manifest, wifiOnly));
        force = true;
      }
    }

    if (isApkDownloadStalled(snapshot)) {
      const network = await Network.getNetworkStateAsync().catch(() => null);
      const waitingForWifi =
        wifiOnly &&
        (!network?.isConnected || network.type !== Network.NetworkStateType.WIFI);
      if (waitingForWifi) {
        debugLog.info(
          'app-update',
          `download waiting for Wi-Fi build=${manifest.build_number} bytes=${snapshot.bytesWritten}/${snapshot.totalBytes ?? 'unknown'}`,
        );
        await persist({
          ...snapshot,
          phase: 'waiting',
          nativeState: snapshot.nativeState ?? 'PAUSED',
          error: null,
        });
        return snapshot;
      }

      if (canAutoRetryApkDownload(snapshot)) {
        const nextRetry = snapshot.retryCount + 1;
        debugLog.warn(
          'app-update',
          `download stalled for ${APK_DOWNLOAD_STALL_MS}ms; retrying build=${manifest.build_number} attempt=${nextRetry}`,
        );
        await persist({
          ...snapshot,
          phase: 'retrying',
          retryCount: nextRetry,
          error: null,
        });
        autoRetry = true;
        force = true;
      } else {
        const message = 'Update download stopped making progress. Tap Retry to try again.';
        debugLog.error(
          'app-update',
          `download stalled after ${snapshot.retryCount} retries build=${manifest.build_number}`,
        );
        await persist({ ...snapshot, phase: 'error', error: message });
        return snapshot;
      }
    }
  }

  if (!force && !shouldEnsureBackgroundDownload(snapshot, manifest.build_number)) {
    // A notification action is an explicit user cancellation. Do not turn the
    // app's periodic reconciliation into an automatic restart; only Retry
    // calls this function with force=true.
    if (snapshot.phase === 'cancelled') return snapshot;
    if (snapshot.phase === 'verifying') {
      const verificationStarted = Date.parse(snapshot.lastProgressAt ?? snapshot.startedAt ?? '');
      if (
        Number.isFinite(verificationStarted) &&
        Date.now() - verificationStarted < APK_VERIFICATION_STALL_MS
      ) {
        return snapshot;
      }
      await persist({
        ...snapshot,
        phase: 'error',
        error: 'Downloaded update verification did not finish. Tap Retry to download it again.',
      });
      return snapshot;
    }
    // Reattach handlers after process death / JS reload. If the OS no longer
    // knows the persisted task, replace it instead of returning stale state.
    // Always query native state even when the JS object still looks active:
    // Android can finish/fail a UIDT job without delivering the terminal event.
    if (await reattachExisting(manifest)) return snapshot;
    force = true;
  }

  const manifestKey = apkDownloadTaskId(manifest.build_number, manifest.sha256);
  if (ensureInFlight) {
    const inFlightKey = ensureKey;
    await ensureInFlight;
    if (!force && inFlightKey === manifestKey) return snapshot;
  }

  ensureKey = manifestKey;
  ensureInFlight = (async () => {
    try {
      assertUpdateDownloadAllowed();
      if (force) {
        await stopMatchingTask(manifest);
      } else {
        const reattached = await reattachExisting(manifest);
        if (reattached) return;
      }
      assertUpdateDownloadAllowed();
      await startNewDownload(
        manifest,
        wifiOnly,
        autoRetry ? snapshot.retryCount : 0,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      debugLog.error('app-update', `background download start failed: ${message}`);
      await persist({
        ...snapshot,
        phase: 'error',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        localUri: null,
        bytesWritten: snapshot.bytesWritten,
        totalBytes: snapshot.totalBytes ?? manifest.bytes ?? null,
        wifiOnly,
        error: message,
      });
      activeDownloadWifiOnly = null;
      throw err;
    }
  })().finally(() => {
    ensureInFlight = null;
    ensureKey = null;
  });

  await ensureInFlight;
  return snapshot;
}

export function getApkDownloadSnapshot(): ApkDownloadSnapshot {
  return snapshot;
}

/** Hydrate persisted state before an audit decides whether update work is terminal. */
export async function getHydratedApkDownloadSnapshot(): Promise<ApkDownloadSnapshot> {
  await hydrate();
  if (Platform.OS === 'android') {
    try {
      const existing = await getExistingDownloadTasks();
      const active = existing.find((task) => {
        if (!task.id.startsWith('apk-update-')) return false;
        const state = String(task.state || '').toUpperCase();
        return !['DONE', 'FAILED', 'STOPPED', 'ERROR', 'CANCELLED'].includes(state);
      });
      if (active) {
        const state = String(active.state || '').toUpperCase();
        emit({
          ...snapshot,
          phase: state === 'PAUSED' ? 'waiting' : 'downloading',
          bytesWritten: active.bytesDownloaded,
          totalBytes: active.bytesTotal || snapshot.totalBytes,
          lastProgressAt:
            active.bytesDownloaded > snapshot.bytesWritten
              ? new Date().toISOString()
              : snapshot.lastProgressAt,
          nativeState: state || 'UNKNOWN',
        });
      } else if (
        shouldClearOrphanedApkDownload(
          snapshot,
          false,
          currentProcessVerificationTaskId !== null,
        )
      ) {
        const interruptedPhase = snapshot.phase;
        const message =
          `The previous app update ${interruptedPhase} step was interrupted, and Android no longer ` +
          'reports an active download. Tap Retry to start the update again.';
        debugLog.warn('app-update', `clearing orphaned ${interruptedPhase} state after native reconciliation`);
        await persist({
          ...snapshot,
          phase: 'error',
          localUri: null,
          nativeState: null,
          error: message,
          verifiedSha256: null,
          verifiedBytes: null,
          verifiedAt: null,
          verifiedReceiptVersion: null,
        });
      }
    } catch (error) {
      const message = `Unable to verify native app-update activity: ${String(error)}`;
      debugLog.warn('app-update', message);
      throw new Error(message);
    }
  }
  return snapshot;
}

export function subscribeApkDownload(
  listener: (s: ApkDownloadSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot);
  // Load persisted/native-backed state as soon as any UI needs it. This keeps
  // the audit preflight from mistaking a process-restored download for idle.
  void hydrate().catch((error) => {
    debugLog.warn('app-update', `download state hydration failed: ${String(error)}`);
  });
  return () => {
    listeners.delete(listener);
  };
}

export function getApkDownloadPercent(s: ApkDownloadSnapshot = snapshot): number | null {
  return downloadPercent(s.bytesWritten, s.totalBytes);
}

/** Install the background-downloaded APK for this manifest, if ready. */
export async function installReadyApkUpdate(manifest: ApkManifest): Promise<void> {
  await hydrate();
  const readyUri =
    snapshot.phase === 'ready' &&
    String(snapshot.buildNumber) === String(manifest.build_number) &&
    snapshot.localUri
      ? snapshot.localUri
      : null;
  const fallback = apkDestinationPath(directories.documents, manifest.build_number, manifest.sha256);
  const localUri = readyUri ?? ((await fileExists(fallback)) ? toFileUri(fallback) : null);
  if (!localUri) {
    throw new Error('Update download is not ready yet');
  }
  assertTrustedApkManifest(manifest);
  const info = await FileSystem.getInfoAsync(localUri);
  const currentBytes = info.exists && 'size' in info ? Number(info.size ?? 0) : 0;
  assertDownloadedApkMatchesManifest(currentBytes, manifest);
  if (
    hasTrustedReadyApkReceipt(
      snapshot,
      manifest,
      localUri,
      currentBytes,
      FileSystem.documentDirectory,
    )
  ) {
    debugLog.info(
      'app-update',
      `ready integrity receipt reused build=${manifest.build_number} bytes=${currentBytes}`,
    );
  } else {
    debugLog.info(
      'app-update',
      `ready integrity receipt unavailable; revalidating build=${manifest.build_number}`,
    );
    const verification = await verifyDownloadedApk(localUri, manifest);
    await persist({
      ...snapshot,
      phase: 'ready',
      buildNumber: manifest.build_number,
      version: manifest.version,
      downloadUrl: manifest.download_url,
      sha256: manifest.sha256 ?? null,
      localUri,
      bytesWritten: verification.size,
      totalBytes: manifest.bytes ?? verification.size,
      lastProgressAt: new Date().toISOString(),
      error: null,
      verifiedSha256: manifest.sha256?.toLowerCase() ?? null,
      verifiedBytes: verification.size,
      verifiedAt: new Date().toISOString(),
      verifiedReceiptVersion: APK_READY_RECEIPT_VERSION,
    });
  }
  debugLog.info('app-update', `install requested build=${manifest.build_number}`);
  await installDownloadedApk(localUri);
}

/**
 * Upgrade from the background-downloaded APK. If the download is still in
 * progress, wait for it (or start it) then install.
 */
export async function upgradeFromBackgroundDownload(
  manifest: ApkManifest,
  options?: { wifiOnly?: boolean },
): Promise<void> {
  const buildNumber = String(manifest.build_number);
  explicitUpgradeWaiters.set(buildNumber, (explicitUpgradeWaiters.get(buildNumber) ?? 0) + 1);
  if (
    pendingPromptManifest &&
    String(pendingPromptManifest.build_number) === buildNumber
  ) {
    pendingPromptManifest = null;
  }

  try {
    await ensureApkBackgroundDownload(manifest, options);
    const network = options?.wifiOnly && snapshot.phase !== 'ready'
      ? await Network.getNetworkStateAsync().catch(() => null)
      : null;
    const queuedForWifi = Boolean(
      options?.wifiOnly &&
      snapshot.phase !== 'ready' &&
      (!network?.isConnected || network.type !== Network.NetworkStateType.WIFI),
    );
    if (
      String(snapshot.buildNumber) === buildNumber &&
      (snapshot.phase === 'waiting' || queuedForWifi)
    ) {
      debugLog.info(
        'app-update',
        `explicit upgrade remains queued for Wi-Fi build=${manifest.build_number}`,
      );
      return;
    }
    if (snapshot.phase === 'ready' && String(snapshot.buildNumber) === buildNumber) {
      await installReadyApkUpdate(manifest);
      return;
    }
    if (snapshot.phase === 'error' || snapshot.phase === 'cancelled') {
      await ensureApkBackgroundDownload(manifest, { ...options, force: true });
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let unsub: (() => void) | null = null;
      let lastBytes = snapshot.bytesWritten;
      let timeout: ReturnType<typeof setTimeout>;
      const armInactivityTimeout = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          unsub?.();
          reject(new Error('Update download stopped making progress. Tap Retry to try again.'));
        }, EXPLICIT_WAIT_STALL_MS);
      };
      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsub?.();
        reject(new Error('Update download stopped making progress. Tap Retry to try again.'));
      }, EXPLICIT_WAIT_STALL_MS);
      unsub = subscribeApkDownload((s) => {
        if (settled) return;
        if (String(s.buildNumber) !== buildNumber) return;
        if (s.bytesWritten > lastBytes) {
          lastBytes = s.bytesWritten;
          armInactivityTimeout();
        }
        if (s.phase === 'ready') {
          settled = true;
          clearTimeout(timeout);
          unsub?.();
          resolve();
        } else if (s.phase === 'error') {
          settled = true;
          clearTimeout(timeout);
          unsub?.();
          reject(new Error(s.error ?? 'Update download failed'));
        }
      });
      if (settled) unsub();
    });

    await installReadyApkUpdate(manifest);
  } finally {
    const remaining = (explicitUpgradeWaiters.get(buildNumber) ?? 1) - 1;
    if (remaining > 0) {
      explicitUpgradeWaiters.set(buildNumber, remaining);
    } else {
      explicitUpgradeWaiters.delete(buildNumber);
    }
  }
}

let promptInFlight = false;

async function maybePromptUpgrade(manifest: ApkManifest): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (explicitUpgradeWaiters.has(String(manifest.build_number))) return;
  hookAppStatePrompt();
  if (snapshot.phase !== 'ready') return;
  if (String(snapshot.buildNumber) !== String(manifest.build_number)) return;
  if (promptInFlight) return;

  if (AppState.currentState !== 'active') {
    pendingPromptManifest = manifest;
    return;
  }

  const buildNumber = String(manifest.build_number);
  if (promptedBuildThisSession === buildNumber) return;

  promptInFlight = true;
  promptedBuildThisSession = buildNumber;

  Alert.alert(
    'Update ready to install',
    `Version ${manifest.version} has been downloaded and verified. Install it now?`,
    [
      { text: 'Later', style: 'cancel', onPress: () => { promptInFlight = false; } },
      {
        text: 'Install',
        onPress: () => {
          promptInFlight = false;
          void installReadyApkUpdate(manifest).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            promptedBuildThisSession = null;
            debugLog.error('app-update', `upgrade prompt install failed: ${message}`);
            Alert.alert('Update failed', message);
          });
        },
      },
    ],
    { onDismiss: () => { promptInFlight = false; } },
  );
}

export async function resetApkDownloadStateForTests(): Promise<void> {
  appStateSub?.remove();
  appStateSub = null;
  appStateHooked = false;
  snapshot = { ...IDLE_APK_DOWNLOAD };
  hydrated = false;
  hydratePromise = null;
  activeTask = null;
  activeDownloadWifiOnly = null;
  currentProcessVerificationTaskId = null;
  ensureInFlight = null;
  ensureKey = null;
  configReady = false;
  listeners.clear();
  promptInFlight = false;
  promptedBuildThisSession = null;
  pendingPromptManifest = null;
  explicitUpgradeWaiters.clear();
}

export type { ApkDownloadSnapshot };
