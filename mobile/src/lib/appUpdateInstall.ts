import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';
import { hashFileSha256 } from './nativeFileHash';
import {
  assertDownloadedApkMatchesManifest,
  type ApkManifest,
} from './appUpdateLogic';

const APK_SHA256_TIMEOUT_MS = 2 * 60 * 1000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`APK sha256 verification timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Validate downloaded APK size and SHA-256 without copying the APK through
 * the JavaScript runtime. On Android this runs as a streaming I/O task on a
 * native worker thread, so a release-sized APK cannot stall Hermes or the UI.
 */
export async function verifyDownloadedApk(
  path: string,
  manifest: Pick<ApkManifest, 'bytes' | 'sha256'>,
): Promise<{ size: number; verifiedSha256: boolean }> {
  const info = await FileSystem.getInfoAsync(path);
  const size = info.exists && 'size' in info ? (info.size ?? 0) : 0;
  assertDownloadedApkMatchesManifest(size, manifest);

  const expectedSha = manifest.sha256!;
  const startedAt = Date.now();
  debugLog.info('app-update', `verification begin bytes=${size} mode=native-sha256`);
  const actual = (
    await withTimeout(hashFileSha256(path), APK_SHA256_TIMEOUT_MS)
  ).toLowerCase();
  if (actual !== expectedSha) {
    throw new Error(
      `APK sha256 mismatch (expected ${expectedSha.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`,
    );
  }
  debugLog.info(
    'app-update',
    `verification complete bytes=${size} ms=${Date.now() - startedAt}`,
  );
  return { size, verifiedSha256: true };
}

/** Prefer verifyDownloadedApk so large files still enforce manifest.bytes. */
export async function verifyApkSha256(
  path: string,
  expectedSha: string,
  expectedBytes?: number | null,
): Promise<void> {
  await verifyDownloadedApk(path, { sha256: expectedSha, bytes: expectedBytes ?? undefined });
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
