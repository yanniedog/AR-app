import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { APK_MANIFEST_URL } from '../config';
import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';
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

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function localFileSize(path: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || !('size' in info)) return 0;
  return Number(info.size ?? 0);
}

async function verifySha256(path: string, expectedSha: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const actual = toHex(digest);
  if (actual !== expectedSha) {
    throw new Error(
      `APK sha256 mismatch (expected ${expectedSha.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`,
    );
  }
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
  const { verifySha256: shouldHash } = assertDownloadedApkMatchesManifest(size, manifest);
  if (shouldHash && manifest.sha256) {
    await verifySha256(path, manifest.sha256);
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

export async function downloadApkUpdate(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('APK download is Android-only');
  }
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

export async function installDownloadedApk(localUri: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('APK install is Android-only');
  }

  const allowed = await ensureInstallPermission();
  if (!allowed) {
    throw new Error('Allow app updates in system settings, then try again');
  }

  const contentUri = await FileSystem.getContentUriAsync(localUri);
  debugLog.info('app-update', 'launching package installer');

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}

export async function downloadAndInstallUpdate(
  manifest: ApkManifest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  const localUri = await downloadApkUpdate(manifest, onProgress);
  await installDownloadedApk(localUri);
}
