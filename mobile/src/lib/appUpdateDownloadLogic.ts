/** Pure helpers for background APK update downloads (unit-testable). */

export type ApkDownloadPhase = 'idle' | 'downloading' | 'ready' | 'error';

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
  error: null,
};

export function apkDownloadTaskId(buildNumber: string): string {
  return `apk-update-${buildNumber}`;
}

export function apkDestinationPath(documentsDir: string, buildNumber: string): string {
  const base = documentsDir.endsWith('/') ? documentsDir : `${documentsDir}/`;
  return `${base}app-update-${buildNumber}.apk`;
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
    if (snapshot.phase === 'ready' || snapshot.phase === 'downloading') return false;
  }
  return true;
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
