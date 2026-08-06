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
  IDLE_APK_DOWNLOAD,
  APK_DOWNLOAD_STALL_MS,
  apkDestinationPath,
  apkDownloadTaskId,
  canAutoRetryApkDownload,
  downloadPercent,
  isCachedApkReady,
  isApkDownloadStalled,
  isUserCancelledDownload,
  shouldEnsureBackgroundDownload,
  toFileUri,
  type ApkDownloadSnapshot,
} from './appUpdateDownloadLogic';
import {
  assertApkCompatibleWithDevice,
  assertTrustedApkManifest,
  preferImmutableApkDownloadUrl,
  type ApkManifest,
} from './appUpdateLogic';
import { installDownloadedApk, verifyDownloadedApk } from './appUpdateInstall';

const STORAGE_KEY = 'app-update-download-v1';
const PROMPTED_KEY = 'app-update-prompted-build';
const EXPLICIT_WAIT_STALL_MS = 3 * 60 * 1000;
const APK_VERIFICATION_STALL_MS = 5 * 60 * 1000;

let snapshot: ApkDownloadSnapshot = { ...IDLE_APK_DOWNLOAD };
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let activeTask: DownloadTask | null = null;
let activeDownloadWifiOnly: boolean | null = null;
let ensureInFlight: Promise<void> | null = null;
let ensureKey: string | null = null;
let configReady = false;
let appStateHooked = false;
let appStateSub: { remove: () => void } | null = null;
let pendingPromptManifest: ApkManifest | null = null;
const explicitUpgradeWaiters = new Map<string, number>();
const listeners = new Set<(s: ApkDownloadSnapshot) => void>();

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
          await verifyDownloadedApk(localUri, manifest);
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
      try {
        const localUri = toFileUri(dest);
        await verifyDownloadedApk(localUri, manifest);
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
  await persist({
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
  });
  task.start();
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
  assertTrustedApkManifest(manifest);
  assertApkCompatibleWithDevice(manifest, Device.supportedCpuArchitectures);
  await hydrate();

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
    snapshot.phase === 'downloading' &&
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
        await verifyDownloadedApk(localUri, manifest);
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
        });
        await maybePromptUpgrade(manifest);
        return snapshot;
      } catch (err) {
        debugLog.warn(
          'app-update',
          `cached APK invalid, re-downloading: ${String((err as Error)?.message ?? err)}`,
        );
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
      if (force) {
        await stopMatchingTask(manifest);
      } else {
        const reattached = await reattachExisting(manifest);
        if (reattached) return;
      }
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

export function subscribeApkDownload(
  listener: (s: ApkDownloadSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot);
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
  await verifyDownloadedApk(localUri, manifest);
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

  let already: string | null = null;
  try {
    already = await AsyncStorage.getItem(PROMPTED_KEY);
  } catch {
    already = null;
  }
  if (already === String(manifest.build_number)) return;

  promptInFlight = true;
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, String(manifest.build_number));
  } catch {
    // still show the prompt
  }

  Alert.alert(
    'Upgrade available',
    `Version ${manifest.version} has finished downloading. Upgrade now?`,
    [
      { text: 'Later', style: 'cancel', onPress: () => { promptInFlight = false; } },
      {
        text: 'Upgrade',
        onPress: () => {
          promptInFlight = false;
          void installReadyApkUpdate(manifest).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
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
  ensureInFlight = null;
  ensureKey = null;
  configReady = false;
  listeners.clear();
  promptInFlight = false;
  pendingPromptManifest = null;
  explicitUpgradeWaiters.clear();
}

export type { ApkDownloadSnapshot };
