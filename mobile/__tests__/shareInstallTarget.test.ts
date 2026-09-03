import { resolveShareInstallTarget } from '../src/lib/shareInstallTarget';

const common = {
  apkUrl: 'https://example.test/app.apk',
  releasePageUrl: 'https://example.test/releases/latest',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=example',
  iosInstallUrl: 'https://apps.apple.com/au/app/example/id123',
};

describe('share install destination', () => {
  it('uses the verified APK only for Android sideload builds', () => {
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'android',
      selfUpdateEnabled: true,
    })).toEqual({
      url: common.apkUrl,
      description: 'download the latest Android APK',
    });
  });

  it('uses Google Play only for Android store builds', () => {
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'android',
      selfUpdateEnabled: false,
    })?.url).toBe(common.playStoreUrl);
  });

  it('uses the configured iOS destination regardless of Android update policy', () => {
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'ios',
      selfUpdateEnabled: false,
    })?.url).toBe(common.iosInstallUrl);
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'ios',
      selfUpdateEnabled: true,
    })?.url).toBe(common.iosInstallUrl);
  });

  it('fails closed instead of sending iOS users to an Android destination', () => {
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'ios',
      selfUpdateEnabled: false,
      iosInstallUrl: null,
    })).toBeNull();
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'ios',
      selfUpdateEnabled: false,
      iosInstallUrl: 'javascript:alert(1)',
    })).toBeNull();
    expect(resolveShareInstallTarget({
      ...common,
      platform: 'ios',
      selfUpdateEnabled: false,
      iosInstallUrl: 'https://example.test/fake-store',
    })).toBeNull();
  });
});
