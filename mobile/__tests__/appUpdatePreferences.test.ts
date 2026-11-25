import { DEFAULT_PREFS } from '../src/data/store';

describe('APK update preferences', () => {
  it('has no network or automatic-update switches', () => {
    expect(DEFAULT_PREFS).not.toHaveProperty('wifiOnly');
    expect(DEFAULT_PREFS).not.toHaveProperty('apkUpdatesWifiOnly');
    expect(DEFAULT_PREFS).not.toHaveProperty('apkUpdatesAutoDownload');
  });
});
