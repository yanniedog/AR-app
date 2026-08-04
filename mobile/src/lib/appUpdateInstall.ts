import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha2.js';

import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';
import {
  assertDownloadedApkMatchesManifest,
  type ApkManifest,
} from './appUpdateLogic';

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
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
): Promise<{ size: number; verifiedSha256: boolean }> {
  const info = await FileSystem.getInfoAsync(path);
  const size = info.exists && 'size' in info ? (info.size ?? 0) : 0;
  assertDownloadedApkMatchesManifest(size, manifest);

  const expectedSha = manifest.sha256!;
  const digest = sha256.create();
  const chunkSize = 1024 * 1024;
  for (let position = 0; position < size; position += chunkSize) {
    const base64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length: Math.min(chunkSize, size - position),
    });
    const binary = atob(base64);
    const chunk = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) chunk[i] = binary.charCodeAt(i);
    digest.update(chunk);
  }
  const actual = toHex(digest.digest());
  if (actual !== expectedSha) {
    throw new Error(
      `APK sha256 mismatch (expected ${expectedSha.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`,
    );
  }
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
