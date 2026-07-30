import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { APK_MANIFEST_URL } from '../config';
import { debugLog } from './debugLog';
import {
  ensureApkBackgroundDownload,
  getApkDownloadSnapshot,
  installReadyApkUpdate,
  subscribeApkDownload,
} from './appUpdateDownload';
import { installDownloadedApk, verifyDownloadedApk } from './appUpdateInstall';
import {
  assertDownloadedApkMatchesManifest,
  checkForAppUpdateAt,
  isSuccessfulDownloadStatus,
  preferImmutableApkDownloadUrl,
  type ApkManifest,
  type DownloadProgress,
  type InstalledAppInfo,
  type UpdateCheckResult,
} from './appUpdateLogic';

export type {
  ApkManifest,
  DownloadProgress,
  InstalledAppInfo,
  UpdateCheckResult,
  VersionChangelogSummary,
} from './appUpdateLogic';
export {
  APK_SHA256_VERIFY_MAX_BYTES,
  assertDownloadedApkMatchesManifest,
  fetchApkManifest,
  isSuccessfulDownloadStatus,
  preferImmutableApkDownloadUrl,
  remoteIsNewer,
} from './appUpdateLogic';
export {
  changelogSummaryUrlFromManifestUrl,
  fetchChangelogSummary,
  selectCumulativeChangelogs,
} from './changelog';
export { installDownloadedApk, verifyDownloadedApk, verifyApkSha256 } from './appUpdateInstall';
export {
  ensureApkBackgroundDownload,
  getApkDownloadPercent,
  getApkDownloadSnapshot,
  installReadyApkUpdate,
  subscribeApkDownload,
  upgradeFromBackgroundDownload,
} from './appUpdateDownload';
export type { ApkDownloadSnapshot } from './appUpdateDownloadLogic';

const APK_CACHE = `${FileSystem.cacheDirectory ?? ''}app-update.apk`;

const DOWNLOAD_HEADERS = {
  // Prefer the binary APK over GitHub HTML error documents.
  Accept: 'application/vnd.android.package-archive,application/octet-stream,*/*',
};

/** Coalesce banner + settings checks within a short window (log showed duplicate hits). */
const UPDATE_CHECK_TTL_MS = 60_000;
let updateCheckCache: {
  url: string;
  startedAt: number;
  promise: Promise<UpdateCheckResult>;
} | null = null;

export function resetAppUpdateCheckCacheForTests(): void {
  updateCheckCache = null;
}

export function getInstalledAppInfo(): InstalledAppInfo {
  return {
    version: Application.nativeApplicationVersion ?? '0.0.0',
    buildNumber: Application.nativeBuildVersion ?? '0',
  };
}

export async function checkForAppUpdate(
  url: string = APK_MANIFEST_URL,
): Promise<UpdateCheckResult> {
  if (Platform.OS !== 'android') {
    return { status: 'error', message: 'In-app APK updates are Android-only' };
  }
  const now = Date.now();
  if (
    updateCheckCache &&
    updateCheckCache.url === url &&
    now - updateCheckCache.startedAt < UPDATE_CHECK_TTL_MS
  ) {
    return updateCheckCache.promise;
  }
  let promise!: Promise<UpdateCheckResult>;
  promise = (async () => {
    try {
      const result = await checkForAppUpdateAt(url, getInstalledAppInfo());
      if (result.status === 'available' || result.status === 'current') {
        debugLog.info(
          'app-update',
          `check ${result.status} installed=${result.installed.version}/${result.installed.buildNumber} remote=${result.remote.version}/${result.remote.build_number}`,
        );
      } else {
        debugLog.error('app-update', `check failed: ${result.message}`);
        // Soft failures must not block retries for the TTL window.
        if (updateCheckCache?.promise === promise) updateCheckCache = null;
      }
      return result;
    } catch (err) {
      if (updateCheckCache?.promise === promise) updateCheckCache = null;
      throw err;
    }
  })();
  updateCheckCache = { url, startedAt: now, promise };
  return promise;
}

async function waitForBackgroundApkReady(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  const current = getApkDownloadSnapshot();
  if (
    current.phase === 'ready' &&
    String(current.buildNumber) === String(manifest.build_number) &&
    current.localUri
  ) {
    onProgress?.({ bytesWritten: current.bytesWritten, totalBytes: current.totalBytes });
    return current.localUri;
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let unsub: (() => void) | null = null;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub?.();
      reject(new Error('Timed out waiting for update download'));
    }, 30 * 60 * 1000);
    unsub = subscribeApkDownload((s) => {
      if (settled) return;
      if (String(s.buildNumber) !== String(manifest.build_number)) return;
      onProgress?.({ bytesWritten: s.bytesWritten, totalBytes: s.totalBytes });
      if (s.phase === 'ready' && s.localUri) {
        settled = true;
        clearTimeout(timeout);
        unsub?.();
        resolve(s.localUri);
      } else if (s.phase === 'error') {
        settled = true;
        clearTimeout(timeout);
        unsub?.();
        reject(new Error(s.error ?? 'Update download failed'));
      }
    });
    if (settled) unsub();
  });
}

async function localFileSize(path: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || !('size' in info)) return 0;
  return Number(info.size ?? 0);
}

/**
 * Follow GitHub release redirects so OkHttp downloads the CDN object directly.
 * Falls back to the original URL when HEAD is blocked.
 */
export async function resolveApkDownloadUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: DOWNLOAD_HEADERS,
    });
    const finalUrl = typeof res.url === 'string' && res.url.startsWith('https://') ? res.url : url;
    if (!res.ok) {
      debugLog.warn('app-update', `redirect resolve HTTP ${res.status}; using ${finalUrl.slice(0, 80)}`);
    }
    return finalUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog.warn('app-update', `redirect resolve failed (${message}); using manifest URL`);
    return url;
  }
}

async function assertApkIntegrity(path: string, manifest: ApkManifest): Promise<void> {
  const size = await localFileSize(path);
  await verifyDownloadedApk(path, manifest);
  const { verifySha256: shouldHash } = assertDownloadedApkMatchesManifest(size, manifest);
  if (shouldHash && manifest.sha256) {
    debugLog.info('app-update', `sha256 ok size=${size}`);
    return;
  }
  if (manifest.sha256) {
    debugLog.info(
      'app-update',
      `sha256 skipped for large APK (${size} bytes); size matched manifest.bytes=${manifest.bytes ?? 'n/a'}`,
    );
  }
}

type DownloadAttemptMode = 'resumable' | 'simple';

async function downloadOnce(
  url: string,
  mode: DownloadAttemptMode,
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  await FileSystem.deleteAsync(APK_CACHE, { idempotent: true });
  onProgress?.({ bytesWritten: 0, totalBytes: manifest.bytes ?? null });

  let result: { uri: string; status?: number } | undefined;
  if (mode === 'simple') {
    result = await FileSystem.downloadAsync(url, APK_CACHE, { headers: DOWNLOAD_HEADERS });
    const size = await localFileSize(result.uri);
    onProgress?.({ bytesWritten: size, totalBytes: manifest.bytes ?? size });
  } else {
    const resumable = FileSystem.createDownloadResumable(
      url,
      APK_CACHE,
      { headers: DOWNLOAD_HEADERS },
      (progress) => {
        onProgress?.({
          bytesWritten: progress.totalBytesWritten,
          totalBytes: progress.totalBytesExpectedToWrite || manifest.bytes || null,
        });
      },
    );
    result = await resumable.downloadAsync();
  }

  if (!result?.uri) {
    throw new Error('APK download failed');
  }
  if (!isSuccessfulDownloadStatus(result.status)) {
    throw new Error(`APK download HTTP ${result.status}`);
  }
  await assertApkIntegrity(result.uri, manifest);
  return result.uri;
}

/**
 * Prefer the system background download. Falls back to a foreground FileSystem
 * transfer only when the native background module is unavailable.
 */
export async function downloadApkUpdate(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
  options?: { wifiOnly?: boolean },
): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('APK download is Android-only');
  }

  let backgroundStarted = false;
  try {
    await ensureApkBackgroundDownload(manifest, options);
    backgroundStarted = true;
    return await waitForBackgroundApkReady(manifest, onProgress);
  } catch (err) {
    if (backgroundStarted) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    debugLog.warn(
      'app-update',
      `background download unavailable, using foreground fallback: ${String((err as Error)?.message ?? err)}`,
    );
    return downloadApkUpdateForeground(manifest, onProgress);
  }
}

async function downloadApkUpdateForeground(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('cache directory unavailable');
  }

  const startedAt = Date.now();
  const immutableUrl = preferImmutableApkDownloadUrl(manifest);
  const resolvedUrl = await resolveApkDownloadUrl(immutableUrl);
  if (immutableUrl !== manifest.download_url) {
    debugLog.info(
      'app-update',
      `using immutable APK URL for v${manifest.version} (avoid rolling clobber)`,
    );
  }
  const attempts: DownloadAttemptMode[] = ['resumable', 'resumable', 'simple'];
  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const mode = attempts[i];
    try {
      const uri = await downloadOnce(resolvedUrl, mode, manifest, onProgress);
      debugLog.info(
        'app-update',
        `download ok mode=${mode} attempt=${i + 1} ms=${Date.now() - startedAt}`,
      );
      return uri;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      debugLog.warn(
        'app-update',
        `download attempt ${i + 1}/${attempts.length} mode=${mode} failed: ${lastError.message}`,
      );
      await FileSystem.deleteAsync(APK_CACHE, { idempotent: true }).catch(() => undefined);
    }
  }

  debugLog.error('app-update', `download failed: ${lastError?.message ?? 'unknown'}`);
  throw lastError ?? new Error('APK download failed');
}

export async function downloadAndInstallUpdate(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
  options?: { wifiOnly?: boolean },
): Promise<void> {
  // Upgrade path: install from the background-downloaded APK when ready.
  const snap = getApkDownloadSnapshot();
  if (
    snap.phase === 'ready' &&
    String(snap.buildNumber) === String(manifest.build_number) &&
    snap.localUri
  ) {
    onProgress?.({ bytesWritten: snap.bytesWritten, totalBytes: snap.totalBytes });
    await installReadyApkUpdate(manifest);
    return;
  }

  const localUri = await downloadApkUpdate(manifest, onProgress, options);
  await verifyDownloadedApk(localUri, manifest);
  await installDownloadedApk(localUri);
}
