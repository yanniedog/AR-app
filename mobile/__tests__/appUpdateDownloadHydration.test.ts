import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExistingDownloadTasks } from '@kesha-antonov/react-native-background-downloader';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  ensureApkBackgroundDownload,
  getHydratedApkDownloadSnapshot,
  resetApkDownloadStateForTests,
} from '../src/lib/appUpdateDownload';
import { IDLE_APK_DOWNLOAD } from '../src/lib/appUpdateDownloadLogic';
import { verifyDownloadedApk } from '../src/lib/appUpdateInstall';
import { TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256 } from '../src/lib/appUpdateLogic';

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

    finishVerification({ size: 1234, verifiedSha256: true });
    await expect(ensure).resolves.toMatchObject({ phase: 'ready', buildNumber: '193' });
  });
});
