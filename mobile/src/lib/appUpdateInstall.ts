import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';
import {
  APK_SHA256_VERIFY_MAX_BYTES,
  assertDownloadedApkMatchesManifest,
  type ApkManifest,
} from './appUpdateLogic';

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate downloaded APK size (and SHA-256 when small enough).
 * Large APKs skip in-memory hashing but still must match manifest.bytes.
 */
export async function verifyDownloadedApk(
  path: string,
  manifest: Pick<ApkManifest, 'bytes' | 'sha256'>,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  const size = info.exists && 'size' in info ? (info.size ?? 0) : 0;
  const { verifySha256: shouldHash } = assertDownloadedApkMatchesManifest(size, manifest);
  if (!shouldHash) {
    if (manifest.sha256) {
      debugLog.warn(
        'app-update',
        `skipping sha256 verify (APK ${size} bytes > ${APK_SHA256_VERIFY_MAX_BYTES} bytes); size matched manifest.bytes=${manifest.bytes ?? 'n/a'}`,
      );
    }
    return;
  }

  const expectedSha = manifest.sha256!;
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
