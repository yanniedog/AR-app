import { DEFAULT_PREFS, useStore } from '../src/data/store';

describe('APK update preferences', () => {
  beforeEach(() => {
    useStore.setState({ prefs: { ...DEFAULT_PREFS }, hydrated: true });
  });

  it('defaults to automatic updates over cellular and permits opting out', () => {
    expect(useStore.getState().prefs.apkUpdatesAutoDownload).toBe(true);
    expect(useStore.getState().prefs.apkUpdatesWifiOnly).toBe(false);

    useStore.getState().setPref('apkUpdatesAutoDownload', false);
    expect(useStore.getState().prefs.apkUpdatesAutoDownload).toBe(false);
  });
});
