import { isUpdateAvailable, versionGt } from './versionCompare';
import {
  fetchCumulativeChangelogs,
  type VersionChangelogSummary,
} from './changelog';
import releaseIdentity from '../../release-identity.json';

export interface ApkManifest {
  schema_version: number;
  version: string;
  build_number: string;
  download_url: string;
  sha256?: string;
  bytes?: number;
  package_name?: string;
  supported_abis?: string[];
  signing_certificate_sha256?: string;
  published_at?: string;
  repo?: string;
  tag?: string;
  /** Immutable app-v{semver} tag that hosts download_url when distinct from rolling tag. */
  version_tag?: string;
  eas_build_id?: string;
  profile?: string;
}

export const TRUSTED_ANDROID_PACKAGE = releaseIdentity.android_package;
export const TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256 =
  releaseIdentity.signing_certificate_sha256.toLowerCase();
const KNOWN_ANDROID_APK_ABIS = new Set(['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']);

export interface InstalledAppInfo {
  version: string;
  buildNumber: string;
}

export type UpdateCheckResult =
  | { status: 'current'; installed: InstalledAppInfo; remote: ApkManifest }
  | {
      status: 'available';
      installed: InstalledAppInfo;
      remote: ApkManifest;
      changelogs: VersionChangelogSummary[];
    }
  | { status: 'incompatible'; installed: InstalledAppInfo; remote: ApkManifest; message: string }
  | { status: 'error'; message: string };

export type { VersionChangelogSummary } from './changelog';

export type DownloadProgress = {
  bytesWritten: number;
  totalBytes: number | null;
};

/** Retained for API compatibility; hashing is now incremental for every APK size. */
export const APK_SHA256_VERIFY_MAX_BYTES = Number.MAX_SAFE_INTEGER;

function manifestFetchUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
}

/**
 * True when an HTTP status from FileSystem download looks successful.
 * `null`/`undefined` are treated as success because some mocks omit status.
 * Non-finite numeric values (e.g., NaN, Infinity) are treated as failure.
 */
export function isSuccessfulDownloadStatus(status: number | undefined | null): boolean {
  if (status == null) return true; // some mocks omit status
  if (!Number.isFinite(status)) return false;
  return status >= 200 && status < 300;
}

/**
 * Validate a downloaded APK against the manifest before install.
 * Always enforces non-empty + byte-length when manifest.bytes is known — that is what
 * catches truncated GitHub/CDN responses that previously surfaced as sha256 mismatch.
 */
export function assertDownloadedApkMatchesManifest(
  size: number,
  manifest: Pick<ApkManifest, 'bytes' | 'sha256'>,
): { verifySha256: boolean } {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('APK download missing or empty');
  }
  const hasExpectedBytes =
    manifest.bytes != null && Number.isFinite(manifest.bytes) && manifest.bytes > 0;
  if (hasExpectedBytes) {
    if (size !== manifest.bytes) {
      throw new Error(`APK size mismatch (expected ${manifest.bytes}, got ${size})`);
    }
  }
  if (!hasExpectedBytes) throw new Error('APK manifest.bytes is missing or invalid');
  if (!manifest.sha256 || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
    throw new Error('APK manifest.sha256 is missing or invalid');
  }
  const verifySha256 = true;
  return { verifySha256 };
}

export function assertTrustedApkManifest(manifest: ApkManifest, manifestUrl?: string): void {
  if (manifest.schema_version !== 1) throw new Error('Unsupported APK manifest schema');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new Error('APK manifest version is invalid');
  }
  if (!/^\d+$/.test(manifest.build_number)) throw new Error('APK manifest build_number is invalid');
  assertDownloadedApkMatchesManifest(manifest.bytes ?? 0, manifest);
  if (manifest.package_name !== TRUSTED_ANDROID_PACKAGE) {
    throw new Error('APK manifest package does not match Australian Rates');
  }
  if (manifest.supported_abis != null) {
    if (
      !Array.isArray(manifest.supported_abis) ||
      manifest.supported_abis.some((abi) => typeof abi !== 'string')
    ) {
      throw new Error('APK manifest ABI list is invalid');
    }
    const supportedAbis = [...new Set(manifest.supported_abis.map((abi) => abi.trim()))];
    if (
      !supportedAbis.length ||
      supportedAbis.length !== manifest.supported_abis.length ||
      supportedAbis.some((abi) => !KNOWN_ANDROID_APK_ABIS.has(abi))
    ) {
      throw new Error('APK manifest ABI list is invalid');
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.signing_certificate_sha256 ?? '')) {
    throw new Error('APK manifest signing certificate is missing or invalid');
  }
  if (
    manifest.signing_certificate_sha256?.toLowerCase() !==
    TRUSTED_ANDROID_SIGNING_CERTIFICATE_SHA256
  ) {
    throw new Error('APK manifest signing certificate does not match Australian Rates');
  }

  const immutable = preferImmutableApkDownloadUrl(manifest);
  let parsed: URL;
  try {
    parsed = new URL(immutable);
  } catch {
    throw new Error('APK download URL is invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    throw new Error('APK download must use an approved GitHub release URL');
  }
  let repo = 'yanniedog/AR-app';
  if (manifestUrl) {
    const source = new URL(manifestUrl);
    const match = /^\/([^/]+\/[^/]+)\/releases\/download\//.exec(source.pathname);
    if (source.protocol !== 'https:' || source.hostname !== 'github.com' || !match) {
      throw new Error('APK manifest must use an approved GitHub release URL');
    }
    repo = match[1];
  }
  if (manifest.repo && manifest.repo.trim() !== repo) {
    throw new Error('APK manifest repository does not match its trusted source');
  }
  const tag = manifest.version_tag?.trim() || `app-v${manifest.version}`;
  const prefix = `/${repo}/releases/download/${tag}/`;
  if (!parsed.pathname.startsWith(prefix) || parsed.pathname.length <= prefix.length) {
    throw new Error('APK download URL does not match its immutable release');
  }
}

function normalizeAndroidAbi(value: string): string {
  const abi = value.trim().toLowerCase().replaceAll(' ', '-');
  if (abi === 'arm64-v8' || abi === 'aarch64') return 'arm64-v8a';
  if (abi === 'armv7' || abi === 'armeabi-v7') return 'armeabi-v7a';
  if (abi === 'x86-64') return 'x86_64';
  return abi;
}

export function isApkCompatibleWithDevice(
  manifest: Pick<ApkManifest, 'supported_abis'>,
  deviceAbis: readonly string[] | null | undefined,
): boolean {
  if (!manifest.supported_abis?.length || !deviceAbis?.length) return true;
  const supported = new Set(manifest.supported_abis.map(normalizeAndroidAbi));
  return deviceAbis.some((abi) => supported.has(normalizeAndroidAbi(abi)));
}

export function apkManifestUrlsForDevice(
  deviceAbis: readonly string[] | null | undefined,
  armUrl: string,
  universalUrl: string,
): string[] {
  const normalized = new Set((deviceAbis ?? []).map(normalizeAndroidAbi));
  return normalized.has('arm64-v8a') || normalized.has('armeabi-v7a')
    ? [armUrl, universalUrl]
    : [universalUrl];
}

export function assertApkCompatibleWithDevice(
  manifest: Pick<ApkManifest, 'supported_abis'>,
  deviceAbis: readonly string[] | null | undefined,
): void {
  if (!isApkCompatibleWithDevice(manifest, deviceAbis)) {
    throw new Error(
      `This APK supports ${manifest.supported_abis?.join(', ')}, but this device reports ${deviceAbis?.join(', ')}.`,
    );
  }
}

/**
 * Prefer the immutable versioned GitHub asset over the rolling app-apk-latest URL.
 * Rolling assets are --clobber'd on every publish; a concurrent download can receive a
 * truncated body that then fails sha256 / size checks.
 */
export function preferImmutableApkDownloadUrl(manifest: Pick<ApkManifest, 'download_url' | 'version' | 'version_tag'>): string {
  const url = manifest.download_url;
  const versionTag =
    (typeof manifest.version_tag === 'string' && manifest.version_tag.trim()) ||
    (typeof manifest.version === 'string' && /^\d+\.\d+\.\d+/.test(manifest.version)
      ? `app-v${manifest.version}`
      : '');
  if (!versionTag) return url;
  const rollingMarker = '/download/app-apk-latest/';
  if (!url.includes(rollingMarker)) return url;
  return url.replace(rollingMarker, `/download/${versionTag}/`);
}

export function remoteIsNewer(installed: InstalledAppInfo, remote: ApkManifest): boolean {
  return isUpdateAvailable(
    installed.version,
    installed.buildNumber,
    remote.version,
    remote.build_number,
  );
}

export async function fetchApkManifest(url: string): Promise<ApkManifest> {
  const res = await fetch(manifestFetchUrl(url));
  if (!res.ok) {
    throw new Error(`APK manifest HTTP ${res.status}`);
  }
  const m = (await res.json()) as ApkManifest;
  if (typeof m.version !== 'string' || typeof m.build_number !== 'string') {
    throw new Error('APK manifest missing version or build_number');
  }
  if (typeof m.download_url !== 'string' || !m.download_url.startsWith('https://')) {
    throw new Error('APK manifest missing download_url');
  }
  assertTrustedApkManifest(m, url);
  return m;
}

export async function checkForAppUpdateAt(
  manifestUrl: string,
  installed: InstalledAppInfo,
  deviceAbis?: readonly string[] | null,
): Promise<UpdateCheckResult> {
  try {
    const remote = await fetchApkManifest(manifestUrl);
    if (remoteIsNewer(installed, remote)) {
      if (!isApkCompatibleWithDevice(remote, deviceAbis)) {
        return {
          status: 'incompatible',
          installed,
          remote,
          message: `The latest APK supports ${remote.supported_abis?.join(', ')}, but this device reports ${deviceAbis?.join(', ')}.`,
        };
      }
      let changelogs: VersionChangelogSummary[] = [];
      if (versionGt(remote.version, installed.version)) {
        try {
          changelogs = await fetchCumulativeChangelogs(
            manifestUrl,
            installed.version,
            remote.version,
          );
        } catch {
          changelogs = [];
        }
      }
      return { status: 'available', installed, remote, changelogs };
    }
    return { status: 'current', installed, remote };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message };
  }
}
