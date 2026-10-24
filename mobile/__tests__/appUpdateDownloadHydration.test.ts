import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDownloadTask, getExistingDownloadTasks } from '@kesha-antonov/react-native-background-downloader';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import {
  ensureApkBackgroundDownload,
  getHydratedApkDownloadSnapshot,
  getApkDownloadSnapshot,
  resetApkDownloadStateForTests,
} from '../src/lib/appUpdateDownload';
import { apkDestinationPath, apkDownloadTaskId, IDLE_APK_DOWNLOAD } from '../src/lib/appUpdateDownloadLogic';
import { verifyDownloadedApk } from '../src/lib/appUpdateInstall';
import { TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256 } from '../src/lib/appUpdateLogic';

jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI', NONE: 'NONE' },
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, type: 'WIFI' })),
}));

jest.mock('../src/lib/appUpdateInstall', () => ({
  installDownloadedApk: jest.fn(async () => {}),
  verifyDownloadedApk: jest.fn(),
}));

const STORAGE_KEY = 'app-update-download-v1';
const getExistingTasksMock = getExistingDownloadTasks as jest.MockedFunction<
  typeof getExistingDownloadTasks
>;

describe('APK update state hydration', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS');

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetApkDownloadStateForTests();
    await AsyncStorage.clear();
    getExistingTasksMock.mockResolvedValue([]);
    jest.mocked(FileSystem.getInfoAsync).mockReset().mockResolvedValue({ exists: false } as never);
    jest.mocked(verifyDownloadedApk).mockReset();
  });

  afterAll(() => {
    if (originalPlatform) Object.defineProperty(Platform, 'OS', originalPlatform);
  });

  it.each(['waiting', 'downloading', 'retrying', 'verifying'] as const)(
    'turns an orphaned restored %s phase into a retryable error',
    async (phase) => {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...IDLE_APK_DOWNLOAD,
          phase,
          buildNumber: '193',
          version: '1.0.181',
          localUri: phase === 'verifying' ? 'file:///docs/unverified.apk' : null,
        }),
      );

      const hydrated = await getHydratedApkDownloadSnapshot();

      expect(hydrated).toMatchObject({
        phase: 'error',
        buildNumber: '193',
        localUri: null,
        nativeState: null,
      });
      expect(hydrated.error).toMatch(/Android no longer reports an active download/i);
      expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}')).toMatchObject({
        phase: 'error',
        localUri: null,
      });
    },
  );

  it('keeps restored work non-terminal while Android still reports an active task', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...IDLE_APK_DOWNLOAD,
        phase: 'downloading',
        buildNumber: '193',
        bytesWritten: 10,
      }),
    );
    getExistingTasksMock.mockResolvedValue([
      {
        id: 'apk-update-193-test',
        state: 'RUNNING',
        bytesDownloaded: 20,
        bytesTotal: 100,
      },
    ] as never);

    await expect(getHydratedApkDownloadSnapshot()).resolves.toMatchObject({
      phase: 'downloading',
      buildNumber: '193',
      bytesWritten: 20,
      totalBytes: 100,
      nativeState: 'RUNNING',
    });
  });

  it('does not clear cached-file verification while hashing is active in this process', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-193-test.apk',
      size: 1234,
      modificationTime: 0,
    } as never);
    let markVerificationStarted!: () => void;
    const verificationStarted = new Promise<void>((resolve) => {
      markVerificationStarted = resolve;
    });
    let finishVerification!: (value: { size: number; verifiedSha256: boolean }) => void;
    jest.mocked(verifyDownloadedApk).mockImplementation(() => new Promise((resolve) => {
      markVerificationStarted();
      finishVerification = resolve;
    }));
    const manifest = {
      schema_version: 1 as const,
      version: '1.0.181',
      build_number: '193',
      download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.181/app-preview.apk',
      published_at: '2026-09-03T00:00:00Z',
      bytes: 1234,
      sha256: 'a'.repeat(64),
      package_name: 'com.eyex.australianrates',
      supported_abis: ['arm64-v8a'],
      signing_certificate_sha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
    };

    const ensure = ensureApkBackgroundDownload(manifest);
    await verificationStarted;
    expect(verifyDownloadedApk).toHaveBeenCalledTimes(1);

    await expect(getHydratedApkDownloadSnapshot()).resolves.toMatchObject({
      phase: 'verifying',
      buildNumber: '193',
    });

    await expect(ensureApkBackgroundDownload(manifest)).resolves.toMatchObject({ phase: 'verifying' });
    expect(verifyDownloadedApk).toHaveBeenCalledTimes(1);

    finishVerification({ size: 1234, verifiedSha256: true });
    await expect(ensure).resolves.toMatchObject({ phase: 'ready', buildNumber: '193' });
  });

  const remote = {
    schema_version: 1 as const,
    version: '1.0.247',
    build_number: '303',
    download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.247/app-preview.apk',
    published_at: '2026-10-24T00:00:00Z',
    bytes: 46_382_909,
    sha256: 'a'.repeat(64),
    package_name: 'com.eyex.australianrates',
    supported_abis: ['arm64-v8a'],
    signing_certificate_sha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
  };
  const destination = apkDestinationPath('file:///docs/', remote.build_number, remote.sha256);

  it.each(['PENDING', 'DOWNLOADING', 'PAUSED', 'DOWNLOADING_AFTER_SUSPEND'])(
    'preserves the partial destination of a restored %s native task',
    async (state) => {
      const task = createDownloadTask({
        id: apkDownloadTaskId(remote.build_number, remote.sha256),
        url: remote.download_url,
        destination,
      });
      if (state === 'DOWNLOADING_AFTER_SUSPEND') {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...IDLE_APK_DOWNLOAD, phase: 'downloading', buildNumber: remote.build_number,
          bytesWritten: 1_000_000, lastProgressAt: new Date(Date.now() - 180_000).toISOString(),
        }));
      }
      Object.assign(task, {
        state: state === 'DOWNLOADING_AFTER_SUSPEND' ? 'DOWNLOADING' : state,
        bytesDownloaded: 10_100_032, bytesTotal: remote.bytes,
      });
      getExistingTasksMock.mockResolvedValue([task]);
      jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
        exists: true, isDirectory: false, size: 10_100_032, uri: destination,
      } as never);
      jest.mocked(verifyDownloadedApk).mockRejectedValue(new Error('APK size mismatch'));
      jest.mocked(createDownloadTask).mockClear();

      await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
        phase: 'downloading', bytesWritten: 10_100_032,
      });
      Object.assign(task, { state: 'DOWNLOADING', bytesDownloaded: 21_151_744 });
      await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
        phase: 'downloading', bytesWritten: 21_151_744,
      });

      expect(verifyDownloadedApk).not.toHaveBeenCalled();
      expect(task.stop).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(createDownloadTask).not.toHaveBeenCalled();
      if (state === 'PAUSED') expect(task.resume).toHaveBeenCalledTimes(1);
    },
  );

  it('verifies a completed native task after JavaScript was suspended', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...IDLE_APK_DOWNLOAD, phase: 'downloading', buildNumber: remote.build_number,
      bytesWritten: 10_100_032, lastProgressAt: new Date(Date.now() - 180_000).toISOString(),
    }));
    const task = createDownloadTask({
      id: apkDownloadTaskId(remote.build_number, remote.sha256),
      url: remote.download_url,
      destination,
    });
    Object.assign(task, { state: 'DONE', bytesDownloaded: remote.bytes, bytesTotal: remote.bytes });
    getExistingTasksMock.mockResolvedValue([task]);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true, isDirectory: false, size: remote.bytes, uri: destination,
    } as never);
    jest.mocked(verifyDownloadedApk).mockResolvedValue({ size: remote.bytes, verifiedSha256: true });
    jest.mocked(createDownloadTask).mockClear();

    await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
      phase: 'ready', verifiedBytes: remote.bytes,
    });
    expect(verifyDownloadedApk).toHaveBeenCalledWith(destination, remote);
    expect(task.stop).not.toHaveBeenCalled();
    expect(createDownloadTask).not.toHaveBeenCalled();
  });

  it('replaces an invalid orphaned APK when no native task owns it', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true, isDirectory: false, size: 10_100_032, uri: destination,
    } as never);
    jest.mocked(verifyDownloadedApk).mockRejectedValue(new Error('APK size mismatch'));

    await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
      phase: 'downloading', bytesWritten: 0,
    });
    expect(verifyDownloadedApk).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(destination, { idempotent: true });
    expect(createDownloadTask).toHaveBeenCalledTimes(1);
  });


  it.each(['PENDING', 'PAUSED'])('preserves an old restored %s task without new bytes', async (state) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...IDLE_APK_DOWNLOAD, phase: 'downloading', buildNumber: remote.build_number,
      bytesWritten: 10_100_032, lastProgressAt: new Date(Date.now() - 180_000).toISOString(),
    }));
    const task = createDownloadTask({
      id: apkDownloadTaskId(remote.build_number, remote.sha256), url: remote.download_url, destination,
    });
    Object.assign(task, { state, bytesDownloaded: 10_100_032, bytesTotal: remote.bytes });
    getExistingTasksMock.mockResolvedValue([task]);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, size: 10_100_032 } as never);
    jest.mocked(createDownloadTask).mockClear();

    await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
      phase: 'downloading', bytesWritten: 10_100_032, retryCount: 0,
    });
    expect(task.stop).not.toHaveBeenCalled();
    expect(createDownloadTask).not.toHaveBeenCalled();
    expect(verifyDownloadedApk).not.toHaveBeenCalled();
  });

  it.each(['verifying', 'downloading'])('recovers an orphaned complete APK from restored %s', async (phase) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...IDLE_APK_DOWNLOAD, phase, buildNumber: remote.build_number,
      lastProgressAt: new Date(Date.now() - 180_000).toISOString(),
    }));
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, size: remote.bytes } as never);
    jest.mocked(verifyDownloadedApk).mockResolvedValue({ size: remote.bytes, verifiedSha256: true });

    await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({ phase: 'ready' });
    expect(verifyDownloadedApk).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(createDownloadTask).not.toHaveBeenCalled();
  });

  it('preserves a partial APK when Android task enumeration fails', async () => {
    await getHydratedApkDownloadSnapshot();
    getExistingTasksMock.mockRejectedValueOnce(new Error('native bridge unavailable'));
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, size: 10_100_032 } as never);

    await expect(ensureApkBackgroundDownload(remote)).rejects.toThrow('native bridge unavailable');
    expect(verifyDownloadedApk).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(createDownloadTask).not.toHaveBeenCalled();
  });

  it.each(['DOWNLOADING', 'PENDING', 'PAUSED'])('replaces a stalled %s task and ignores its late callback', async (state) => {
    const task = createDownloadTask({
      id: apkDownloadTaskId(remote.build_number, remote.sha256), url: remote.download_url, destination,
    });
    Object.assign(task, { state, bytesDownloaded: 10_100_032, bytesTotal: remote.bytes });
    getExistingTasksMock.mockResolvedValue([task]);
    await ensureApkBackgroundDownload(remote);
    const oldError = (task as unknown as {
      handlers: { error: (event: { error: string; errorCode: number }) => void };
    }).handlers.error;
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 180_000);
    try {
      await expect(ensureApkBackgroundDownload(remote)).resolves.toMatchObject({
        phase: 'downloading', retryCount: 1, bytesWritten: 0,
      });
      expect(task.stop).toHaveBeenCalled();
      oldError({ error: 'stopped', errorCode: 1 });
      expect(getApkDownloadSnapshot()).toMatchObject({ phase: 'downloading', error: null });
    } finally {
      clock.mockRestore();
    }
  });


  it('shows waiting for Wi-Fi after a paused task exhausts its attachment grace period', async () => {
    const task = createDownloadTask({
      id: apkDownloadTaskId(remote.build_number, remote.sha256), url: remote.download_url, destination,
      isAllowedOverMetered: false, isAllowedOverRoaming: false,
    });
    Object.assign(task, { state: 'PAUSED', bytesDownloaded: 10_100_032, bytesTotal: remote.bytes });
    getExistingTasksMock.mockResolvedValue([task]);
    await ensureApkBackgroundDownload(remote, { wifiOnly: true });
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValueOnce({
      isConnected: false, type: Network.NetworkStateType.NONE,
    } as never);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 180_000);
    try {
      await expect(ensureApkBackgroundDownload(remote, { wifiOnly: true })).resolves.toMatchObject({
        phase: 'waiting', bytesWritten: 10_100_032,
      });
      expect(task.stop).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

});
