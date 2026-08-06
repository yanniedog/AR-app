/** Pure helpers for background APK update downloads (unit-testable). */

export type ApkDownloadPhase =
  | 'idle'
  | 'waiting'
  | 'downloading'
  | 'retrying'
  | 'verifying'
  | 'ready'
  | 'error';

export interface ApkDownloadSnapshot {
  phase: ApkDownloadPhase;
  buildNumber: string | null;
  version: string | null;
  downloadUrl: string | null;
  sha256: string | null;
  localUri: string | null;
  bytesWritten: number;
  totalBytes: number | null;
  wifiOnly: boolean | null;
  startedAt: string | null;
  lastProgressAt: string | null;
  retryCount: number;
  nativeState: string | null;
  error: string | null;
}

export const IDLE_APK_DOWNLOAD: ApkDownloadSnapshot = {
  phase: 'idle',
  buildNumber: null,
  version: null,
  downloadUrl: null,
  sha256: null,
  localUri: null,
  bytesWritten: 0,
  totalBytes: null,
  wifiOnly: null,
  startedAt: null,
  lastProgressAt: null,
  retryCount: 0,
  nativeState: null,
  error: null,
};

export const APK_DOWNLOAD_STALL_MS = 2 * 60 * 1000;
export const APK_DOWNLOAD_MAX_AUTO_RETRIES = 2;

export function apkDownloadTaskId(buildNumber: string, sha256?: string | null): string {
  const integrityKey = sha256?.slice(0, 12).toLowerCase();
  return `apk-update-${buildNumber}${integrityKey ? `-${integrityKey}` : ''}`;
}

export function apkDestinationPath(documentsDir: string, buildNumber: string, sha256?: string | null): string {
  const base = documentsDir.endsWith('/') ? documentsDir : `${documentsDir}/`;
  const integrityKey = sha256?.slice(0, 12).toLowerCase();
  return `${base}app-update-${buildNumber}${integrityKey ? `-${integrityKey}` : ''}.apk`;
}

/** Convert a native absolute downloader path to the URI form Expo FileSystem expects. */
export function toFileUri(path: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) ? path : `file://${path}`;
}

export function isApkDownloadForBuild(
  snapshot: ApkDownloadSnapshot,
  buildNumber: string,
): boolean {
  return snapshot.buildNumber != null && String(snapshot.buildNumber) === String(buildNumber);
}

export function isCachedApkReady(
  snapshot: ApkDownloadSnapshot,
  buildNumber: string,
  fileExists: boolean,
): boolean {
  return (
    isApkDownloadForBuild(snapshot, buildNumber) &&
    snapshot.phase === 'ready' &&
    Boolean(snapshot.localUri) &&
    fileExists
  );
}

/** Whether we should start (or resume) a background download for this remote build. */
export function shouldEnsureBackgroundDownload(
  snapshot: ApkDownloadSnapshot,
  buildNumber: string,
): boolean {
  if (isApkDownloadForBuild(snapshot, buildNumber)) {
    if (
      snapshot.phase === 'ready' ||
      snapshot.phase === 'waiting' ||
      snapshot.phase === 'downloading' ||
      snapshot.phase === 'retrying' ||
      snapshot.phase === 'verifying'
    ) return false;
  }
  return true;
}

export function isApkDownloadStalled(
  snapshot: ApkDownloadSnapshot,
  nowMs = Date.now(),
  stallMs = APK_DOWNLOAD_STALL_MS,
): boolean {
  if (snapshot.phase !== 'downloading') return false;
  const activityAt = snapshot.lastProgressAt ?? snapshot.startedAt;
  if (!activityAt) return false;
  const activityMs = Date.parse(activityAt);
  return Number.isFinite(activityMs) && nowMs - activityMs >= stallMs;
}

export function canAutoRetryApkDownload(
  snapshot: ApkDownloadSnapshot,
  maxRetries = APK_DOWNLOAD_MAX_AUTO_RETRIES,
): boolean {
  return Math.max(0, snapshot.retryCount) < maxRetries;
}

export function updateBannerCopy(
  phase: ApkDownloadPhase,
  version: string,
  downloadPct: number | null,
): { title: string; actionLabel: string; actionEnabled: boolean } {
  if (phase === 'ready') {
    return {
      title: `Update ready — v${version}`,
      actionLabel: 'Upgrade',
      actionEnabled: true,
    };
  }
  if (phase === 'downloading') {
    const pct = downloadPct != null ? ` ${downloadPct}%` : '';
    return {
      title: `Downloading update — v${version}${pct}`,
      actionLabel: 'Upgrade',
      actionEnabled: false,
    };
  }
  if (phase === 'waiting') {
    return {
      title: `Update paused — waiting for Wi-Fi`,
      actionLabel: 'Retry',
      actionEnabled: true,
    };
  }
  if (phase === 'retrying') {
    return {
      title: `Recovering update download — v${version}`,
      actionLabel: 'Retrying',
      actionEnabled: false,
    };
  }
  if (phase === 'verifying') {
    return {
      title: `Verifying update — v${version}`,
      actionLabel: 'Verifying',
      actionEnabled: false,
    };
  }
  if (phase === 'error') {
    return {
      title: `Update available — v${version}`,
      actionLabel: 'Retry',
      actionEnabled: true,
    };
  }
  return {
    title: `Update available — v${version}`,
    actionLabel: 'Upgrade',
    actionEnabled: false,
  };
}

export function downloadPercent(bytesWritten: number, totalBytes: number | null): number | null {
  if (totalBytes == null || totalBytes <= 0) return null;
  return Math.min(100, Math.round((bytesWritten / totalBytes) * 100));
}
