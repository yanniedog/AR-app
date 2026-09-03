import * as FileSystem from 'expo-file-system/legacy';
import { FileSystem as NativeFileSystem } from 'react-native-file-access';

import {
  APK_SHA256_VERIFY_MAX_BYTES,
  TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
  assertApkCompatibleWithDevice,
  apkManifestUrlsForDevice,
  assertDownloadedApkMatchesManifest,
  checkForAppUpdateAcrossChannels,
  checkForAppUpdateAt,
  fetchBestCompatibleApkManifest,
  fetchApkManifest,
  isApkCompatibleWithDevice,
  isSuccessfulDownloadStatus,
  preferImmutableApkDownloadUrl,
  remoteIsNewer,
  type ApkManifest,
} from '../src/lib/appUpdateLogic';
import { verifyDownloadedApk } from '../src/lib/appUpdateInstall';
import { verifyApkArchiveIdentity } from '../modules/apk-identity-verifier';

jest.mock('../modules/apk-identity-verifier', () => ({
  verifyApkArchiveIdentity: jest.fn(),
}));

const baseManifest: ApkManifest = {
  schema_version: 1,
  version: '1.0.0',
  build_number: '42',
  download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.0/app-preview.apk',
  published_at: '2026-06-09T00:00:00Z',
  bytes: 130_000_000,
  sha256: '518fdd8767ca26d02775e585e3ea4bfc53b92e0788c9ae5751cc0eb593e5607a',
  package_name: 'com.eyex.australianrates',
  supported_abis: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
  signing_certificate_sha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
};

const installed = { version: '1.0.0', buildNumber: '41' };
const manifestUrl =
  'https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/app-apk-latest.json';

const changelogSummary = {
  schema_version: 1,
  repo: 'yanniedog/AR-app',
  versions: [
    {
      version: '1.0.0',
      date: null,
      summaryBullets: ['First'],
      releaseUrl: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.0',
    },
    {
      version: '1.0.1',
      date: null,
      summaryBullets: ['Second'],
      releaseUrl: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.1',
    },
    {
      version: '1.0.2',
      date: null,
      summaryBullets: ['Third'],
      releaseUrl: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.2',
    },
  ],
};

describe('appUpdateLogic', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.mocked(verifyApkArchiveIdentity).mockReset().mockResolvedValue({
      packageName: 'com.eyex.australianrates',
      signerSha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
      signerCount: 1,
      signatureVerified: true,
      verifiedSchemes: ['v2'],
    });
  });

  it('detects newer remote build on same version', () => {
    expect(remoteIsNewer(installed, baseManifest)).toBe(true);
  });

  it('parses a valid APK manifest', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => baseManifest,
    });
    await expect(fetchApkManifest(manifestUrl)).resolves.toEqual(baseManifest);
  });

  it('rejects mutable, untrusted, or unverifiable APK manifests', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, download_url: 'https://example.com/app.apk' }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/approved GitHub release URL/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, sha256: undefined }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/sha256/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, repo: 'attacker/fake-app' }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/repository/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, package_name: 'com.attacker.fake' }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/package/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, supported_abis: ['arm64-v8a', 'mips'] }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/ABI list/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, signing_certificate_sha256: undefined }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/signing certificate/i);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, signing_certificate_sha256: 'a'.repeat(64) }),
    });
    await expect(fetchApkManifest(manifestUrl)).rejects.toThrow(/does not match/i);
  });

  it('reports available update when remote build is newer', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => baseManifest,
    });
    const result = await checkForAppUpdateAt(manifestUrl, installed);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.remote.build_number).toBe('42');
      expect(result.changelogs).toEqual([]);
    }
  });

  it('does not offer or download an APK that cannot run on this device', async () => {
    const armOnlyManifest = {
      ...baseManifest,
      supported_abis: ['armeabi-v7a', 'arm64-v8a'],
    };
    expect(isApkCompatibleWithDevice(armOnlyManifest, ['arm64 v8'])).toBe(true);
    expect(isApkCompatibleWithDevice(armOnlyManifest, ['x86_64'])).toBe(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => armOnlyManifest,
    });
    await expect(checkForAppUpdateAt(manifestUrl, installed, ['x86_64'])).resolves.toMatchObject({
      status: 'incompatible',
      installed,
      remote: armOnlyManifest,
    });
    expect(() => assertApkCompatibleWithDevice(armOnlyManifest, ['x86_64'])).toThrow(
      /this APK supports/i,
    );
  });

  it('uses the ARM channel only for channel-aware ARM clients and keeps universal fallback', () => {
    const universal = 'https://example.test/universal.json';
    const arm = 'https://example.test/arm.json';
    expect(apkManifestUrlsForDevice(['arm64 v8'], universal, arm)).toEqual([arm, universal]);
    expect(apkManifestUrlsForDevice(['armeabi-v7a'], universal, arm)).toEqual([arm, universal]);
    expect(apkManifestUrlsForDevice(['x86_64'], universal, arm)).toEqual([universal]);
    expect(apkManifestUrlsForDevice(['x86_64', 'arm64-v8a'], universal, arm)).toEqual([universal]);
    expect(apkManifestUrlsForDevice(undefined, universal, arm)).toEqual([universal]);
  });

  it('does not treat translation-only ARM support as native APK compatibility', () => {
    const armOnlyManifest = {
      ...baseManifest,
      supported_abis: ['armeabi-v7a', 'arm64-v8a'],
    };
    const universalManifest = {
      ...baseManifest,
      supported_abis: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
    };
    expect(isApkCompatibleWithDevice(armOnlyManifest, ['x86_64', 'arm64-v8a'])).toBe(false);
    expect(isApkCompatibleWithDevice(universalManifest, ['x86_64', 'arm64-v8a'])).toBe(true);
  });

  it('requires an exact ABI match within the device primary architecture family', () => {
    expect(isApkCompatibleWithDevice(
      { ...baseManifest, supported_abis: ['armeabi-v7a'] },
      ['arm64-v8a'],
    )).toBe(false);
    expect(isApkCompatibleWithDevice(
      { ...baseManifest, supported_abis: ['armeabi-v7a'] },
      ['arm64-v8a', 'armeabi-v7a'],
    )).toBe(true);
    expect(isApkCompatibleWithDevice(
      { ...baseManifest, supported_abis: ['x86'] },
      ['x86_64'],
    )).toBe(false);
  });

  it('falls back to the universal channel while the ARM channel is unavailable', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => baseManifest });

    await expect(
      checkForAppUpdateAcrossChannels(
        ['https://example.test/arm.json', manifestUrl],
        installed,
        ['arm64-v8a'],
      ),
    ).resolves.toMatchObject({ status: 'available', remote: baseManifest });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('prefers a newer universal update when the ARM channel is stale', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...baseManifest, build_number: '41' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => baseManifest });

    await expect(
      checkForAppUpdateAcrossChannels(
        ['https://example.test/arm.json', manifestUrl],
        installed,
        ['arm64-v8a'],
      ),
    ).resolves.toMatchObject({ status: 'available', remote: baseManifest });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('shares the newest trusted compatible APK across active channels', async () => {
    const armManifestUrl =
      'https://github.com/yanniedog/AR-app/releases/download/app-apk-arm-latest/app-apk-latest.json';
    const armManifest: ApkManifest = {
      ...baseManifest,
      build_number: '41',
      supported_abis: ['armeabi-v7a', 'arm64-v8a'],
      version_tag: 'app-arm-v1.0.0',
      download_url:
        'https://github.com/yanniedog/AR-app/releases/download/app-arm-v1.0.0/app-preview.apk',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => armManifest })
      .mockResolvedValueOnce({ ok: true, json: async () => baseManifest });

    await expect(
      fetchBestCompatibleApkManifest(
        [armManifestUrl, manifestUrl],
        ['arm64-v8a'],
      ),
    ).resolves.toEqual(baseManifest);
  });

  it('aborts a stalled ARM channel before falling back to universal', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }))
      .mockResolvedValueOnce({ ok: true, json: async () => baseManifest });

    await expect(
      checkForAppUpdateAcrossChannels(
        ['https://example.test/arm.json', manifestUrl],
        installed,
        ['arm64-v8a'],
        10,
      ),
    ).resolves.toMatchObject({ status: 'available', remote: baseManifest });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('reports current when installed matches remote', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseManifest, build_number: '41' }),
    });
    const result = await checkForAppUpdateAt(manifestUrl, installed);
    expect(result.status).toBe('current');
  });

  it('surfaces manifest HTTP errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    const result = await checkForAppUpdateAt(manifestUrl, installed);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('404');
    }
  });

  it('attaches cumulative changelogs when remote semver is newer', async () => {
    const remote: ApkManifest = {
      ...baseManifest,
      version: '1.0.2',
      build_number: '11',
      download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.2/app-preview.apk',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => remote })
      .mockResolvedValueOnce({ ok: true, json: async () => changelogSummary });

    const result = await checkForAppUpdateAt(manifestUrl, installed);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.changelogs.map((c) => c.summaryBullets[0])).toEqual(['Second', 'Third']);
    }
  });

  it('omits changelogs on same-version build bump', async () => {
    const remote: ApkManifest = {
      ...baseManifest,
      version: '1.0.0',
      build_number: '43',
      download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.0/app-preview.apk',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => remote });

    const result = await checkForAppUpdateAt(manifestUrl, installed);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.changelogs).toEqual([]);
    }
  });
});

describe('APK download integrity', () => {
  it('treats missing status as success (compat with older mocks)', () => {
    expect(isSuccessfulDownloadStatus(undefined)).toBe(true);
    expect(isSuccessfulDownloadStatus(null)).toBe(true);
    expect(isSuccessfulDownloadStatus(200)).toBe(true);
    expect(isSuccessfulDownloadStatus(404)).toBe(false);
    expect(isSuccessfulDownloadStatus(Number.NaN)).toBe(false);
    expect(isSuccessfulDownloadStatus(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('rejects empty or truncated downloads before sha256', () => {
    expect(() => assertDownloadedApkMatchesManifest(0, baseManifest)).toThrow(/empty/i);
    expect(() => assertDownloadedApkMatchesManifest(4096, baseManifest)).toThrow(/size mismatch/);
  });

  it('requires sha256 verification for large APKs when size matches', () => {
    const large = APK_SHA256_VERIFY_MAX_BYTES + 1;
    expect(
      assertDownloadedApkMatchesManifest(large, {
        bytes: large,
        sha256: baseManifest.sha256,
      }),
    ).toEqual({ verifySha256: true });
  });

  it('rejects a large APK when neither hashing nor manifest byte validation is available', () => {
    expect(() =>
      assertDownloadedApkMatchesManifest(APK_SHA256_VERIFY_MAX_BYTES + 1, {
        sha256: baseManifest.sha256,
      }),
    ).toThrow(/manifest\.bytes is missing/);
  });

  it('still rejects a truncated large APK before skipping in-memory sha256', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes! - 1,
      modificationTime: 0,
    });

    await expect(
      verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest),
    ).rejects.toThrow(/size mismatch/);
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('streams an exact-size large APK through the native hash verifier', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });

    jest.mocked(NativeFileSystem.hash).mockResolvedValueOnce(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    await expect(
      verifyDownloadedApk('file:///docs/app-update-42.apk', {
        ...baseManifest,
        sha256: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      }),
    ).resolves.toEqual({ size: baseManifest.bytes, verifiedSha256: true });
    expect(NativeFileSystem.hash).toHaveBeenCalledWith(
      '/docs/app-update-42.apk',
      'SHA-256',
    );
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('rejects a native sha256 mismatch', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });
    jest.mocked(NativeFileSystem.hash).mockResolvedValueOnce('0'.repeat(64));

    await expect(
      verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest),
    ).rejects.toThrow(/sha256 mismatch/i);
  });

  it('rejects a correctly hashed APK whose archive package is not Australian Rates', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });
    jest.mocked(NativeFileSystem.hash).mockResolvedValueOnce(baseManifest.sha256!);
    jest.mocked(verifyApkArchiveIdentity).mockResolvedValueOnce({
      packageName: 'example.attacker.app',
      signerSha256: TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
      signerCount: 1,
      signatureVerified: true,
      verifiedSchemes: ['v2'],
    });

    await expect(verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest))
      .rejects.toThrow(/package does not match/i);
  });

  it('rejects a correctly hashed APK signed by another certificate', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });
    jest.mocked(NativeFileSystem.hash).mockResolvedValueOnce(baseManifest.sha256!);
    jest.mocked(verifyApkArchiveIdentity).mockResolvedValueOnce({
      packageName: 'com.eyex.australianrates',
      signerSha256: '0'.repeat(64),
      signerCount: 1,
      signatureVerified: true,
      verifiedSchemes: ['v2'],
    });

    await expect(verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest))
      .rejects.toThrow(/signer does not match/i);
  });

  it('rejects corrupt or legacy-only archive signatures before install', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });
    jest.mocked(NativeFileSystem.hash).mockResolvedValueOnce(baseManifest.sha256!);
    jest.mocked(verifyApkArchiveIdentity).mockRejectedValueOnce(
      new Error('APK cryptographic signature verification failed'),
    );

    await expect(verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest))
      .rejects.toThrow(/cryptographic signature verification failed/i);
  });

  it('surfaces a native sha256 error from the native module', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });
    jest
      .mocked(NativeFileSystem.hash)
      .mockRejectedValueOnce(new Error('native hash failed'));

    await expect(
      verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest),
    ).rejects.toThrow(/native hash failed/i);
  });

  it('surfaces native sha256 timeouts without starting duplicate native work', async () => {
    jest.useFakeTimers();
    try {
      jest.mocked(NativeFileSystem.hash).mockClear();
      jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: 'file:///docs/app-update-42.apk',
        size: baseManifest.bytes!,
        modificationTime: 0,
      });
      jest.mocked(NativeFileSystem.hash).mockImplementationOnce(
        () => new Promise<string>(() => undefined),
      );

      const verification = expect(
        verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest),
      ).rejects.toThrow(/verification timed out after 120000ms/i);
      await jest.advanceTimersByTimeAsync(120_000);
      expect(NativeFileSystem.hash).toHaveBeenCalledWith(
        '/docs/app-update-42.apk',
        'SHA-256',
      );
      await verification;

      const retry = expect(
        verifyDownloadedApk('file:///docs/app-update-42.apk', baseManifest),
      ).rejects.toThrow(/verification timed out after 120000ms/i);
      await jest.advanceTimersByTimeAsync(120_000);
      await retry;
      expect(NativeFileSystem.hash).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('requests sha256 verify for small APKs', () => {
    expect(
      assertDownloadedApkMatchesManifest(1024, {
        bytes: 1024,
        sha256: baseManifest.sha256,
      }),
    ).toEqual({ verifySha256: true });
  });

  it('rewrites rolling APK URLs to the versioned immutable asset', () => {
    expect(
      preferImmutableApkDownloadUrl({
        version: '1.0.64',
        download_url:
          'https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/app-preview.apk',
      }),
    ).toBe(
      'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.64/app-preview.apk',
    );
    expect(
      preferImmutableApkDownloadUrl({
        version: '1.0.64',
        version_tag: 'app-v1.0.64',
        download_url:
          'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.64/app-preview.apk',
      }),
    ).toBe(
      'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.64/app-preview.apk',
    );
  });
});
