import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { verifyApkArchiveIdentity } from '../../modules/apk-identity-verifier';

import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';
import { hashFileSha256 } from './nativeFileHash';
import {
  assertDownloadedApkMatchesManifest,
  TRUSTED_ANDROID_PACKAGE,
  TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
  type ApkManifest,
} from './appUpdateLogic';

const APK_SHA256_TIMEOUT_MS = 2 * 60 * 1000;
const APK_IDENTITY_TIMEOUT_MS = 2 * 60 * 1000;

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

  const expectedSha = manifest.sha256!.toLowerCase();
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
  const identity = await withTimeout(
    verifyApkArchiveIdentity(path),
    APK_IDENTITY_TIMEOUT_MS,
  );
  if (!identity.signatureVerified || identity.signerCount !== 1) {
    throw new Error('APK signature verification did not prove one trusted signer');
  }
  if (identity.packageName !== TRUSTED_ANDROID_PACKAGE) {
    throw new Error('APK package does not match Australian Rates');
  }
  if (identity.signerSha256.toLowerCase() !== TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256) {
    throw new Error('APK signer does not match Australian Rates');
  }
  if (!identity.verifiedSchemes.some((scheme) => ['v2', 'v3', 'v3.1', 'v4'].includes(scheme))) {
    throw new Error('APK requires a verified modern Android signature');
  }
  debugLog.info(
    'app-update',
    `verification complete bytes=${size} package=${identity.packageName} signer=${identity.signerSha256.slice(0, 12)}… ms=${Date.now() - startedAt}`,
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

  debugLog.info('app-update', 'install permission check begin');
  const allowed = await ensureInstallPermission();
  if (!allowed) {
    debugLog.warn('app-update', 'install paused: Android install-source permission not granted');
    throw new Error('Android did not allow this app to install the update. Tap Install to try again.');
  }

  const contentUri = await FileSystem.getContentUriAsync(localUri);
  debugLog.info('app-update', 'install permission ready; launching Android package installer');

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
  debugLog.info('app-update', 'Android package installer returned to app');
}
