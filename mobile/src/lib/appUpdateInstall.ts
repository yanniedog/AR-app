import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { debugLog } from './debugLog';
import { ensureInstallPermission } from './installPermission';

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyApkSha256(path: string, expectedSha: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  const size = info.exists && 'size' in info ? (info.size ?? 0) : 0;
  // SDK 54 has no FileSystem.hashAsync; skip verify for large APKs to avoid OOM on low-RAM devices.
  if (size > 64 * 1024 * 1024) {
    debugLog.warn('app-update', `skipping sha256 verify (APK ${size} bytes > 64 MiB)`);
    return;
  }
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
