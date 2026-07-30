import {
  IDLE_APK_DOWNLOAD,
  apkDestinationPath,
  apkDownloadTaskId,
  downloadPercent,
  isCachedApkReady,
  shouldEnsureBackgroundDownload,
  updateBannerCopy,
} from '../src/lib/appUpdateDownloadLogic';

describe('appUpdateDownloadLogic', () => {
  it('builds stable task ids and destinations', () => {
    expect(apkDownloadTaskId('42')).toBe('apk-update-42');
    expect(apkDestinationPath('file:///docs/', '42')).toBe('file:///docs/app-update-42.apk');
    expect(apkDestinationPath('file:///docs', '42')).toBe('file:///docs/app-update-42.apk');
  });

  it('treats a verified local file as ready', () => {
    const snap = {
      ...IDLE_APK_DOWNLOAD,
      phase: 'ready' as const,
      buildNumber: '42',
      localUri: 'file:///docs/app-update-42.apk',
    };
    expect(isCachedApkReady(snap, '42', true)).toBe(true);
    expect(isCachedApkReady(snap, '42', false)).toBe(false);
    expect(isCachedApkReady(snap, '43', true)).toBe(false);
  });

  it('skips starting when already downloading or ready for the same build', () => {
    expect(
      shouldEnsureBackgroundDownload(
        { ...IDLE_APK_DOWNLOAD, phase: 'downloading', buildNumber: '42' },
        '42',
      ),
    ).toBe(false);
    expect(
      shouldEnsureBackgroundDownload(
        { ...IDLE_APK_DOWNLOAD, phase: 'ready', buildNumber: '42' },
        '42',
      ),
    ).toBe(false);
    expect(
      shouldEnsureBackgroundDownload(
        { ...IDLE_APK_DOWNLOAD, phase: 'error', buildNumber: '42' },
        '42',
      ),
    ).toBe(true);
    expect(
      shouldEnsureBackgroundDownload(
        { ...IDLE_APK_DOWNLOAD, phase: 'ready', buildNumber: '41' },
        '42',
      ),
    ).toBe(true);
  });

  it('formats banner copy for download phases', () => {
    expect(updateBannerCopy('ready', '1.0.44', null)).toEqual({
      title: 'Update ready — v1.0.44',
      actionLabel: 'Upgrade',
      actionEnabled: true,
    });
    expect(updateBannerCopy('downloading', '1.0.44', 37).title).toContain('37%');
    expect(updateBannerCopy('downloading', '1.0.44', 37).actionEnabled).toBe(false);
    expect(updateBannerCopy('error', '1.0.44', null).actionLabel).toBe('Retry');
  });

  it('computes download percent', () => {
    expect(downloadPercent(50, 100)).toBe(50);
    expect(downloadPercent(0, null)).toBeNull();
  });
});
