import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
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
  apkDestinationPath,
  apkDownloadTaskId,
  downloadPercent,
  isCachedApkReady,
  shouldEnsureBackgroundDownload,
  type ApkDownloadSnapshot,
} from './appUpdateDownloadLogic';
import { preferImmutableApkDownloadUrl, type ApkManifest } from './appUpdateLogic';
import { installDownloadedApk, verifyApkSha256 } from './appUpdateInstall';

const STORAGE_KEY = 'app-update-download-v1';
const PROMPTED_KEY = 'app-update-prompted-build';

let snapshot: ApkDownloadSnapshot = { ...IDLE_APK_DOWNLOAD };
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let activeTask: DownloadTask | null = null;
let ensureInFlight: Promise<void> | null = null;
let ensureBuild: string | null = null;
let configReady = false;
let appStateHooked = false;
let pendingPromptManifest: ApkManifest | null = null;
const listeners = new Set<(s: ApkDownloadSnapshot) => void>();

function hookAppStatePrompt(): void {
  if (appStateHooked || Platform.OS !== 'android') return;
  appStateHooked = true;
  AppState.addEventListener('change', (state) => {
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
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

async function clearStaleFiles(keepBuild: string | null): Promise<void> {
  const docs = FileSystem.documentDirectory;
  if (!docs) return;
  try {
    const entries = await FileSystem.readDirectoryAsync(docs);
    await Promise.all(
      entries
        .filter((name) => name.startsWith('app-update-') && name.endsWith('.apk'))
        .filter((name) => (keepBuild ? name !== `app-update-${keepBuild}.apk` : true))
        .map((name) => FileSystem.deleteAsync(`${docs}${name}`, { idempotent: true })),
    );
  } catch {
    // Best-effort cleanup only.
  }
}

function attachHandlers(task: DownloadTask, manifest: ApkManifest): void {
  activeTask = task;
  task
    .begin(({ expectedBytes }) => {
      void persist({
        ...snapshot,
        phase: 'downloading',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        totalBytes: expectedBytes || manifest.bytes || snapshot.totalBytes,
        error: null,
      });
    })
    .progress(({ bytesDownloaded, bytesTotal }) => {
      void persist({
        ...snapshot,
        phase: 'downloading',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        bytesWritten: bytesDownloaded,
        totalBytes: bytesTotal || manifest.bytes || snapshot.totalBytes,
        error: null,
      });
    })
    .done(({ location, bytesDownloaded, bytesTotal }) => {
      void (async () => {
        try {
          await completeHandler(task.id);
          const localUri = location?.startsWith('file://') ? location : `file://${location}`;
          if (manifest.sha256) {
            await verifyApkSha256(localUri, manifest.sha256);
          }
          await persist({
            phase: 'ready',
            buildNumber: manifest.build_number,
            version: manifest.version,
            downloadUrl: manifest.download_url,
            sha256: manifest.sha256 ?? null,
            localUri,
            bytesWritten: bytesDownloaded,
            totalBytes: bytesTotal || manifest.bytes || null,
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
          if (activeTask?.id === task.id) activeTask = null;
        }
      })();
    })
    .error(({ error, errorCode }) => {
      void persist({
        phase: 'error',
        buildNumber: manifest.build_number,
        version: manifest.version,
        downloadUrl: manifest.download_url,
        sha256: manifest.sha256 ?? null,
        localUri: null,
        bytesWritten: snapshot.bytesWritten,
        totalBytes: snapshot.totalBytes,
        error: `${error}${errorCode ? ` (${errorCode})` : ''}`,
      });
      debugLog.error('app-update', `background download failed: ${error} code=${errorCode}`);
      if (activeTask?.id === task.id) activeTask = null;
    });
}

async function reattachExisting(manifest: ApkManifest): Promise<boolean> {
  const taskId = apkDownloadTaskId(manifest.build_number);
  let existing: DownloadTask[] = [];
  try {
    existing = await getExistingDownloadTasks();
  } catch (err) {
    debugLog.warn('app-update', `getExistingDownloadTasks failed: ${String((err as Error)?.message ?? err)}`);
    return false;
  }

  const match = existing.find((t) => t.id === taskId);
  for (const task of existing) {
    if (task.id !== taskId) {
      try {
        await task.stop();
      } catch {
        // ignore
      }
    }
  }
  if (!match) return false;

  attachHandlers(match, manifest);
  if (match.state === 'DONE') {
    // done handler may not re-fire; treat existing destination as candidate.
    const dest =
      match.downloadParams?.destination ??
      apkDestinationPath(directories.documents, manifest.build_number);
    if (await fileExists(dest)) {
      try {
        if (manifest.sha256) await verifyApkSha256(dest, manifest.sha256);
        await persist({
          phase: 'ready',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri: dest.startsWith('file://') ? dest : `file://${dest}`,
          bytesWritten: match.bytesDownloaded,
          totalBytes: match.bytesTotal || manifest.bytes || null,
          error: null,
        });
        await maybePromptUpgrade(manifest);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await persist({ ...snapshot, phase: 'error', error: message, localUri: null });
      }
    }
  }

  if (match.state === 'PAUSED') {
    try {
      await match.resume();
    } catch (err) {
      debugLog.warn('app-update', `resume failed: ${String((err as Error)?.message ?? err)}`);
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
    error: null,
  });
  return true;
}

async function startNewDownload(manifest: ApkManifest, wifiOnly: boolean): Promise<void> {
  const destination = apkDestinationPath(directories.documents, manifest.build_number);
  await clearStaleFiles(manifest.build_number);
  try {
    await FileSystem.deleteAsync(destination, { idempotent: true });
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
    id: apkDownloadTaskId(manifest.build_number),
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
  await hydrate();

  const wifiOnly = Boolean(options?.wifiOnly);
  ensureConfig(wifiOnly);

  if (!options?.force) {
    if (isCachedApkReady(snapshot, manifest.build_number, await fileExists(snapshot.localUri))) {
      await maybePromptUpgrade(manifest);
      return snapshot;
    }

    const dest = apkDestinationPath(directories.documents, manifest.build_number);
    if (await fileExists(dest)) {
      try {
        if (manifest.sha256) await verifyApkSha256(dest, manifest.sha256);
        await persist({
          phase: 'ready',
          buildNumber: manifest.build_number,
          version: manifest.version,
          downloadUrl: manifest.download_url,
          sha256: manifest.sha256 ?? null,
          localUri: dest.startsWith('file://') ? dest : `file://${dest}`,
          bytesWritten: snapshot.bytesWritten,
          totalBytes: snapshot.totalBytes ?? manifest.bytes ?? null,
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
  }

  if (!options?.force && !shouldEnsureBackgroundDownload(snapshot, manifest.build_number)) {
    const taskId = apkDownloadTaskId(manifest.build_number);
    if (activeTask?.id !== taskId) {
      // Reattach handlers after process death / JS reload.
      await reattachExisting(manifest);
    }
    return snapshot;
  }

  if (ensureInFlight && ensureBuild === manifest.build_number) {
    await ensureInFlight;
    return snapshot;
  }

  ensureBuild = manifest.build_number;
  ensureInFlight = (async () => {
    const reattached = await reattachExisting(manifest);
    if (reattached) return;
    await startNewDownload(manifest, wifiOnly);
  })().finally(() => {
    ensureInFlight = null;
    ensureBuild = null;
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
  const fallback = apkDestinationPath(directories.documents, manifest.build_number);
  const localUri = readyUri ?? ((await fileExists(fallback)) ? fallback : null);
  if (!localUri) {
    throw new Error('Update download is not ready yet');
  }
  if (manifest.sha256) {
    await verifyApkSha256(localUri, manifest.sha256);
  }
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
  await ensureApkBackgroundDownload(manifest, options);
  if (snapshot.phase === 'ready' && String(snapshot.buildNumber) === String(manifest.build_number)) {
    await installReadyApkUpdate(manifest);
    return;
  }
  if (snapshot.phase === 'error') {
    await ensureApkBackgroundDownload(manifest, { ...options, force: true });
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Timed out waiting for update download'));
    }, 30 * 60 * 1000);
    const unsub = subscribeApkDownload((s) => {
      if (String(s.buildNumber) !== String(manifest.build_number)) return;
      if (s.phase === 'ready') {
        clearTimeout(timeout);
        unsub();
        resolve();
      } else if (s.phase === 'error') {
        clearTimeout(timeout);
        unsub();
        reject(new Error(s.error ?? 'Update download failed'));
      }
    });
  });

  await installReadyApkUpdate(manifest);
}

let promptInFlight = false;

async function maybePromptUpgrade(manifest: ApkManifest): Promise<void> {
  if (Platform.OS !== 'android') return;
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
  snapshot = { ...IDLE_APK_DOWNLOAD };
  hydrated = false;
  hydratePromise = null;
  activeTask = null;
  ensureInFlight = null;
  ensureBuild = null;
  configReady = false;
  listeners.clear();
  promptInFlight = false;
  pendingPromptManifest = null;
}

export type { ApkDownloadSnapshot };
