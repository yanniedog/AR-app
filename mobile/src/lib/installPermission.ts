import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppState, Linking, Platform } from 'react-native';

import { ANDROID_PACKAGE, debugLog } from './debugLog';

/**
 * Install-unknown-apps permission is prompted from Settings → App update, not
 * first-run onboarding. Onboarding defers sideload UX so users see rate value first.
 */

/** Android O (API 26)+ requires per-app "Install unknown apps" before sideloading. */
export const INSTALL_PERMISSION_MIN_API = 26;
export const INSTALL_SETTINGS_RETURN_TIMEOUT_MS = 2 * 60_000;

export type InstallPermissionState =
  | 'granted'
  | 'required'
  | 'not_applicable';

export function resolveInstallPermissionState(
  platformOs: string,
  apiLevel: number | null | undefined,
  canInstall: boolean,
): InstallPermissionState {
  if (platformOs !== 'android') return 'not_applicable';
  if (apiLevel != null && apiLevel < INSTALL_PERMISSION_MIN_API) return 'granted';
  return canInstall ? 'granted' : 'required';
}

export function installPermissionPackageUri(
  applicationId: string | null | undefined = Application.applicationId,
): string {
  const pkg = applicationId?.trim() || ANDROID_PACKAGE;
  return `package:${pkg}`;
}

export async function canInstallApkUpdates(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const apiLevel = Device.platformApiLevel;
  if (apiLevel != null && apiLevel < INSTALL_PERMISSION_MIN_API) return true;
  try {
    return await Device.isSideLoadingEnabledAsync();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog.warn('install-permission', `check failed: ${message}`);
    return false;
  }
}

export async function getInstallPermissionState(): Promise<InstallPermissionState> {
  const canInstall = await canInstallApkUpdates();
  return resolveInstallPermissionState(
    Platform.OS,
    Device.platformApiLevel,
    canInstall,
  );
}

export async function openInstallPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const data = installPermissionPackageUri();
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data },
    );
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog.warn('install-permission', `settings intent failed: ${message}`);
  }

  await openFallbackSettingsAndWaitForReturn();
}

async function openFallbackSettingsAndWaitForReturn(): Promise<void> {
  let sawAppLeave = false;
  let settled = false;
  let resolveReturn: (() => void) | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let subscription: { remove: () => void } | null = null;

  const returned = new Promise<void>((resolve) => {
    resolveReturn = resolve;
  });
  const finish = () => {
    if (settled) return;
    settled = true;
    subscription?.remove();
    if (timeout != null) clearTimeout(timeout);
    resolveReturn?.();
  };

  // Linking.openSettings() only confirms that Settings was launched. Subscribe
  // first so a fast inactive/background transition cannot be missed, and only
  // treat a later active event as a genuine return to this app.
  subscription = AppState.addEventListener('change', (state) => {
    if (state === 'inactive' || state === 'background') {
      sawAppLeave = true;
    } else if (state === 'active' && sawAppLeave) {
      finish();
    }
  });
  timeout = setTimeout(() => {
    debugLog.warn(
      'install-permission',
      'settings return was not observed before timeout',
    );
    finish();
  }, INSTALL_SETTINGS_RETURN_TIMEOUT_MS);

  try {
    await Linking.openSettings();
  } catch (err) {
    finish();
    throw err;
  }
  await returned;
}

/**
 * Returns true when sideload install is allowed. An explicit install request goes
 * straight to Android's per-app setting, waits for the user to return, then checks
 * again so installation can continue without another app tap.
 */
export async function ensureInstallPermission(options?: {
  openSettings?: boolean;
}): Promise<boolean> {
  const state = await getInstallPermissionState();
  if (state !== 'required') return state === 'granted';

  if (options?.openSettings === false) return false;

  debugLog.info('install-permission', 'opening Android install-source settings');
  await openInstallPermissionSettings();
  const allowed = await canInstallApkUpdates();
  debugLog.info(
    'install-permission',
    allowed ? 'install-source permission granted' : 'install-source permission not granted',
  );
  return allowed;
}
