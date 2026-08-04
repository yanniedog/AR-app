import * as FileSystem from 'expo-file-system/legacy';

import {
  APK_SHA256_VERIFY_MAX_BYTES,
  TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256,
  assertApkCompatibleWithDevice,
  apkManifestUrlsForDevice,
  assertDownloadedApkMatchesManifest,
  checkForAppUpdateAt,
  fetchApkManifest,
  isApkCompatibleWithDevice,
  isSuccessfulDownloadStatus,
  preferImmutableApkDownloadUrl,
  remoteIsNewer,
  type ApkManifest,
} from '../src/lib/appUpdateLogic';
import { verifyDownloadedApk } from '../src/lib/appUpdateInstall';

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

  it('routes only ARM-capable clients to the opt-in ARM channel with universal fallback', () => {
    const arm = 'https://example.test/app-apk-arm-latest.json';
    const universal = 'https://example.test/app-apk-latest.json';
    expect(apkManifestUrlsForDevice(['arm64-v8a'], arm, universal)).toEqual([arm, universal]);
    expect(apkManifestUrlsForDevice(['x86_64'], arm, universal)).toEqual([universal]);
    expect(apkManifestUrlsForDevice(null, arm, universal)).toEqual([universal]);
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

  it('streams an exact-size large APK through the hash verifier', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      uri: 'file:///docs/app-update-42.apk',
      size: baseManifest.bytes!,
      modificationTime: 0,
    });

    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue('');
    await expect(
      verifyDownloadedApk('file:///docs/app-update-42.apk', {
        ...baseManifest,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      }),
    ).resolves.toEqual({ size: baseManifest.bytes, verifiedSha256: true });
    expect(FileSystem.readAsStringAsync).toHaveBeenCalled();
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
