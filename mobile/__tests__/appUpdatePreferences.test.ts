import { DEFAULT_PREFS, useStore } from '../src/data/store';

describe('APK update preferences', () => {
  beforeEach(() => {
    useStore.setState({ prefs: { ...DEFAULT_PREFS }, hydrated: true });
  });

  it('defaults standing auto-download consent off and stores an explicit opt-in', () => {
    expect(useStore.getState().prefs.apkUpdatesAutoDownload).toBe(false);
    expect(useStore.getState().prefs.apkUpdatesWifiOnly).toBe(true);

    useStore.getState().setPref('apkUpdatesAutoDownload', true);
    expect(useStore.getState().prefs.apkUpdatesAutoDownload).toBe(true);
  });
});
