import { APK_ARM_MANIFEST_URL, APK_MANIFEST_URL } from '../config';
import {
  apkManifestUrlsForDevice,
  checkForAppUpdateAcrossChannels,
  type InstalledAppInfo,
  type UpdateCheckResult,
} from './appUpdateLogic';

/** A live audit owns the deadline and cancellation of its explicit UI check. */
export interface AppUpdateAuditRequest {
  sessionId: string;
  signal: AbortSignal;
  remainingMs: () => number;
}

/** Fresh metadata only: no shared TTL result, changelog, APK or installation. */
export function readAppUpdateMetadata(
  installed: InstalledAppInfo,
  deviceAbis: readonly string[] | null | undefined,
  request: AppUpdateAuditRequest,
): Promise<UpdateCheckResult> {
  return checkForAppUpdateAcrossChannels(
    apkManifestUrlsForDevice(deviceAbis, APK_MANIFEST_URL, APK_ARM_MANIFEST_URL),
    installed,
    deviceAbis,
    5_000,
    { signal: request.signal, remainingMs: request.remainingMs, includeChangelogs: false },
  );
}
