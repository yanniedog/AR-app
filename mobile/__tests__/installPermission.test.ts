import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import {
  INSTALL_PERMISSION_MIN_API,
  ensureInstallPermission,
  installPermissionPackageUri,
  resolveInstallPermissionState,
} from '../src/lib/installPermission';

describe('installPermission', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  describe('resolveInstallPermissionState', () => {
    it('returns not_applicable on iOS', () => {
      expect(resolveInstallPermissionState('ios', 34, false)).toBe('not_applicable');
    });

    it('returns granted below Android O without checking sideload flag', () => {
      expect(resolveInstallPermissionState('android', 25, false)).toBe('granted');
    });

    it('returns granted when sideload is enabled on Android O+', () => {
      expect(resolveInstallPermissionState('android', 34, true)).toBe('granted');
    });

    it('returns required when sideload is disabled on Android O+', () => {
      expect(resolveInstallPermissionState('android', 34, false)).toBe('required');
    });

    it('uses sideload check when api level is unknown on Android', () => {
      expect(resolveInstallPermissionState('android', null, false)).toBe('required');
      expect(resolveInstallPermissionState('android', undefined, true)).toBe('granted');
    });
  });

  describe('installPermissionPackageUri', () => {
    it('builds a package URI from application id', () => {
      expect(installPermissionPackageUri('com.example.app')).toBe('package:com.example.app');
    });

    it('falls back to the default Android package', () => {
      expect(installPermissionPackageUri(null)).toBe('package:com.eyex.australianrates');
      expect(installPermissionPackageUri('')).toBe('package:com.eyex.australianrates');
    });
  });

  it('documents Android O as the install-permission threshold', () => {
    expect(INSTALL_PERMISSION_MIN_API).toBe(26);
  });

  it('opens the per-app Android setting and resumes after permission is granted', async () => {
    jest
      .mocked(Device.isSideLoadingEnabledAsync)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(ensureInstallPermission()).resolves.toBe(true);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledTimes(1);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data: 'package:com.eyex.australianrates' },
    );
  });

  it('returns denied after Android settings without opening a second prompt', async () => {
    jest.mocked(Device.isSideLoadingEnabledAsync).mockResolvedValue(false);

    await expect(ensureInstallPermission()).resolves.toBe(false);
    expect(Device.isSideLoadingEnabledAsync).toHaveBeenCalledTimes(2);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledTimes(1);
  });

  it('does not open settings when the install source is already allowed', async () => {
    jest.mocked(Device.isSideLoadingEnabledAsync).mockResolvedValueOnce(true);

    await expect(ensureInstallPermission()).resolves.toBe(true);
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
  });
});
