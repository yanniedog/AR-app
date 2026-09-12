import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import { getExistingDownloadTasks } from '@kesha-antonov/react-native-background-downloader';
import { Platform } from 'react-native';

import {
  getHydratedApkDownloadSnapshot,
  resetApkDownloadStateForTests,
} from '../src/lib/appUpdateDownload';
import { IDLE_APK_DOWNLOAD } from '../src/lib/appUpdateDownloadLogic';

jest.mock('expo-application', () => ({
  __esModule: true,
  nativeApplicationVersion: '1.0.191',
  nativeBuildVersion: '260',
  applicationId: 'com.eyex.australianrates',
}));

const STORAGE_KEY = 'app-update-download-v1';
const installedApk = 'app-update-260-abcdef012345.apk';
const oldApk = 'app-update-259.apk';
const futureApk = 'app-update-261-abcdef012345.apk';

describe('installed APK storage cleanup', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const originalBuild = Application.nativeBuildVersion;

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Application, 'nativeBuildVersion', { configurable: true, value: '260' });
    await resetApkDownloadStateForTests();
    await AsyncStorage.clear();
    jest.mocked(getExistingDownloadTasks).mockResolvedValue([]);
    jest.mocked(FileSystem.readDirectoryAsync).mockResolvedValue([oldApk, installedApk, futureApk]);
    jest.mocked(FileSystem.getInfoAsync).mockImplementation(async (uri) => ({
      exists: true, isDirectory: false, uri, size: 46_011_301, modificationTime: 0,
    }));
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    Object.defineProperty(Application, 'nativeBuildVersion', { configurable: true, value: originalBuild });
  });

  it('reclaims old/current installers and clears their persisted ready receipt on offline startup', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...IDLE_APK_DOWNLOAD, phase: 'ready', buildNumber: '260',
      localUri: `file:///docs/${installedApk}`, bytesWritten: 46_011_301,
    }));

    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(IDLE_APK_DOWNLOAD);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`file:///docs/${oldApk}`, { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`file:///docs/${installedApk}`, { idempotent: true });
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!)).toEqual(IDLE_APK_DOWNLOAD);
    await getHydratedApkDownloadSnapshot();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
  });

  it('preserves a newer ready update, unrelated files, malformed names, and directories', async () => {
    const ready = {
      ...IDLE_APK_DOWNLOAD, phase: 'ready', buildNumber: '261', localUri: `file:///docs/${futureApk}`,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ready));
    jest.mocked(FileSystem.readDirectoryAsync).mockResolvedValue([
      futureApk, 'rates.json', 'app-update.apk', 'app-update-0.apk',
      'app-update-259-bad.apk', '../app-update-259.apk', 'app-update-258.apk',
    ]);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true, isDirectory: true, uri: 'file:///docs/app-update-258.apk', size: 0, modificationTime: 0,
    });

    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(ready);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('reclaims obsolete installers even when the persisted receipt is malformed', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{invalid JSON');

    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(IDLE_APK_DOWNLOAD);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`file:///docs/${oldApk}`, { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`file:///docs/${installedApk}`, { idempotent: true });
  });

  it('stops an obsolete pending transfer before its destination file exists', async () => {
    const task = {
      id: 'apk-update-259', state: 'PENDING', bytesDownloaded: 0, bytesTotal: 46_011_301,
      stop: jest.fn(async () => { task.state = 'STOPPED'; }),
    };
    jest.mocked(getExistingDownloadTasks).mockResolvedValue([task] as never);
    jest.mocked(FileSystem.readDirectoryAsync).mockResolvedValue([]);

    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(IDLE_APK_DOWNLOAD);
    expect(task.stop).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('stops obsolete native transfers before deletion and preserves transfers that cannot stop', async () => {
    const stopOld = jest.fn(async () => {
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
    const stopCurrent = jest.fn().mockRejectedValue(new Error('busy'));
    const stopFuture = jest.fn();
    const stopUnrelated = jest.fn();
    jest.mocked(getExistingDownloadTasks).mockResolvedValue([
      { id: 'apk-update-259', stop: stopOld },
      { id: 'apk-update-260-abcdef012345', stop: stopCurrent },
      { id: 'apk-update-261-abcdef012345', stop: stopFuture },
      { id: 'payload-259', stop: stopUnrelated },
    ] as never);

    await getHydratedApkDownloadSnapshot();
    expect(stopOld).toHaveBeenCalledTimes(1);
    expect(stopCurrent).toHaveBeenCalledTimes(1);
    expect(stopFuture).not.toHaveBeenCalled();
    expect(stopUnrelated).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`file:///docs/${oldApk}`, { idempotent: true });
  });

  it('leaves files alone when native task reconciliation fails', async () => {
    jest.mocked(getExistingDownloadTasks).mockRejectedValueOnce(new Error('native unavailable'));
    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(IDLE_APK_DOWNLOAD);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('continues cleanup when one obsolete installer is locked', async () => {
    jest.mocked(FileSystem.deleteAsync).mockRejectedValueOnce(new Error('locked'));
    await expect(getHydratedApkDownloadSnapshot()).resolves.toEqual(IDLE_APK_DOWNLOAD);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
  });

  it.each([null, '0', 'invalid', '9007199254740992'])('skips cleanup for an unknown installed build (%s)', async (build) => {
    Object.defineProperty(Application, 'nativeBuildVersion', { configurable: true, value: build });
    await getHydratedApkDownloadSnapshot();
    expect(FileSystem.readDirectoryAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
