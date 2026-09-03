export type ShareInstallPlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos';

export type ShareInstallTarget = {
  url: string;
  description: string;
};

function optionalHttpsUrl(value: string | null | undefined): string | null {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.port === ''
      && parsed.hash === ''
      && (hostname === 'apps.apple.com' || hostname === 'testflight.apple.com')
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function resolveShareInstallTarget({
  platform,
  selfUpdateEnabled,
  apkUrl,
  releasePageUrl,
  playStoreUrl,
  iosInstallUrl,
}: {
  platform: ShareInstallPlatform;
  selfUpdateEnabled: boolean;
  apkUrl: string | null;
  releasePageUrl: string;
  playStoreUrl: string;
  iosInstallUrl: string | null;
}): ShareInstallTarget | null {
  if (platform === 'android') {
    if (selfUpdateEnabled) {
      return apkUrl
        ? { url: apkUrl, description: 'download the latest Android APK' }
        : { url: releasePageUrl, description: 'open the latest Android release' };
    }
    return { url: playStoreUrl, description: 'open Australian Rates in Google Play' };
  }

  if (platform === 'ios') {
    const url = optionalHttpsUrl(iosInstallUrl);
    return url ? { url, description: 'open the Australian Rates iOS install page' } : null;
  }

  return null;
}
