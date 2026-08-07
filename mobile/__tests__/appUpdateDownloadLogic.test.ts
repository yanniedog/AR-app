import {
  IDLE_APK_DOWNLOAD,
  apkDestinationPath,
  apkDownloadTaskId,
  canAutoRetryApkDownload,
  downloadPercent,
  hasTrustedReadyApkReceipt,
  isCachedApkReady,
  isApkDownloadStalled,
  isUserCancelledDownload,
  shouldEnsureBackgroundDownload,
  toFileUri,
  updateBannerCopy,
} from '../src/lib/appUpdateDownloadLogic';

describe('appUpdateDownloadLogic', () => {
  it('builds stable task ids and destinations', () => {
    expect(apkDownloadTaskId('42')).toBe('apk-update-42');
    expect(apkDestinationPath('file:///docs/', '42')).toBe('file:///docs/app-update-42.apk');
    expect(apkDestinationPath('file:///docs', '42')).toBe('file:///docs/app-update-42.apk');
    expect(apkDownloadTaskId('42', 'ABCDEF1234567890')).toBe('apk-update-42-abcdef123456');
    expect(apkDestinationPath('file:///docs', '42', 'ABCDEF1234567890')).toBe(
      'file:///docs/app-update-42-abcdef123456.apk',
    );
  });

  it('normalizes native downloader paths for Expo FileSystem', () => {
    expect(toFileUri('/data/user/0/app/files/app-update-42.apk')).toBe(
      'file:///data/user/0/app/files/app-update-42.apk',
    );
    expect(toFileUri('file:///docs/app-update-42.apk')).toBe(
      'file:///docs/app-update-42.apk',
    );
    expect(toFileUri('content://downloads/app-update-42.apk')).toBe(
      'content://downloads/app-update-42.apk',
    );
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
        { ...IDLE_APK_DOWNLOAD, phase: 'cancelled', buildNumber: '42' },
        '42',
      ),
    ).toBe(false);
    expect(
      shouldEnsureBackgroundDownload(
        { ...IDLE_APK_DOWNLOAD, phase: 'ready', buildNumber: '41' },
        '42',
      ),
    ).toBe(true);
  });

  it('formats banner copy for download phases', () => {
    expect(updateBannerCopy('ready', '1.0.44', null)).toEqual({
      title: 'Update verified and ready — v1.0.44',
      actionLabel: 'Install',
      actionEnabled: true,
    });
    expect(updateBannerCopy('downloading', '1.0.44', 37).title).toContain('37%');
    expect(updateBannerCopy('downloading', '1.0.44', 37).actionEnabled).toBe(false);
    expect(updateBannerCopy('error', '1.0.44', null).actionLabel).toBe('Retry');
    expect(updateBannerCopy('cancelled', '1.0.44', null)).toEqual({
      title: 'Update download cancelled — v1.0.44',
      actionLabel: 'Retry',
      actionEnabled: true,
    });
    expect(updateBannerCopy('waiting', '1.0.44', 93).title).toContain('waiting for Wi-Fi');
    expect(updateBannerCopy('verifying', '1.0.44', 93).title).toContain('integrity');
    expect(updateBannerCopy('retrying', '1.0.44', 93).actionEnabled).toBe(false);
    expect(updateBannerCopy('idle', '1.0.44', null)).toEqual({
      title: 'Update available — v1.0.44',
      actionLabel: 'Download & install',
      actionEnabled: true,
    });
  });

  it('reuses a full verification receipt only for the same ready private APK', () => {
    const sha256 = 'a'.repeat(64);
    const ready = {
      ...IDLE_APK_DOWNLOAD,
      phase: 'ready' as const,
      buildNumber: '42',
      sha256,
      localUri: 'file:///docs/app-update-42.apk',
      verifiedSha256: sha256,
      verifiedBytes: 1234,
      verifiedAt: '2026-08-07T00:00:00.000Z',
    };
    const manifest = { build_number: '42', sha256, bytes: 1234 };

    expect(
      hasTrustedReadyApkReceipt(ready, manifest, ready.localUri, 1234, 'file:///docs/'),
    ).toBe(true);
    expect(
      hasTrustedReadyApkReceipt(ready, manifest, ready.localUri, 1233, 'file:///docs/'),
    ).toBe(false);
    expect(
      hasTrustedReadyApkReceipt(
        { ...ready, verifiedSha256: 'b'.repeat(64) },
        manifest,
        ready.localUri,
        1234,
        'file:///docs/',
      ),
    ).toBe(false);
    expect(
      hasTrustedReadyApkReceipt(
        ready,
        manifest,
        'content://downloads/app.apk',
        1234,
        'file:///docs/',
      ),
    ).toBe(false);
    expect(
      hasTrustedReadyApkReceipt(
        ready,
        manifest,
        'file:///cache/app-update-42.apk',
        1234,
        'file:///docs/',
      ),
    ).toBe(false);
  });

  it('distinguishes an explicit native cancel from a generic downloader failure', () => {
    expect(isUserCancelledDownload('Download cancelled by user', -1)).toBe(true);
    expect(isUserCancelledDownload('Connection failed', -1)).toBe(false);
    expect(isUserCancelledDownload('Download cancelled by user', 500)).toBe(false);
  });

  it('detects genuine no-progress stalls but not waiting or verifying work', () => {
    const downloading = {
      ...IDLE_APK_DOWNLOAD,
      phase: 'downloading' as const,
      buildNumber: '42',
      startedAt: '2026-08-06T00:00:00.000Z',
      lastProgressAt: '2026-08-06T00:01:00.000Z',
    };
    expect(isApkDownloadStalled(downloading, Date.parse('2026-08-06T00:02:59.999Z'))).toBe(false);
    expect(isApkDownloadStalled(downloading, Date.parse('2026-08-06T00:03:00.000Z'))).toBe(true);
    expect(isApkDownloadStalled({ ...downloading, phase: 'waiting' }, Date.parse('2026-08-06T01:00:00Z'))).toBe(false);
    expect(isApkDownloadStalled({ ...downloading, phase: 'verifying' }, Date.parse('2026-08-06T01:00:00Z'))).toBe(false);
  });

  it('bounds automatic recovery attempts per persisted build', () => {
    expect(canAutoRetryApkDownload({ ...IDLE_APK_DOWNLOAD, retryCount: 0 })).toBe(true);
    expect(canAutoRetryApkDownload({ ...IDLE_APK_DOWNLOAD, retryCount: 1 })).toBe(true);
    expect(canAutoRetryApkDownload({ ...IDLE_APK_DOWNLOAD, retryCount: 2 })).toBe(false);
  });

  it('computes download percent', () => {
    expect(downloadPercent(50, 100)).toBe(50);
    expect(downloadPercent(0, null)).toBeNull();
  });
});
