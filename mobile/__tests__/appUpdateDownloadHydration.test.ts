import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExistingDownloadTasks } from '@kesha-antonov/react-native-background-downloader';
import { Platform } from 'react-native';

import {
  getHydratedApkDownloadSnapshot,
  resetApkDownloadStateForTests,
} from '../src/lib/appUpdateDownload';
import { IDLE_APK_DOWNLOAD } from '../src/lib/appUpdateDownloadLogic';

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
});
