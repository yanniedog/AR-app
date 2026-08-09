import AsyncStorage from '@react-native-async-storage/async-storage';
import core from '../assets/sample/core.json';
import { selectBankHistoryChartModel } from '../src/data/historySelectors';
import { DEFAULT_PREFS, useStore } from '../src/data/store';
import type { CorePayload } from '../src/types';

const sample = core as CorePayload;

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('showHistoryRibbon pref', () => {
  beforeEach(() => {
    useStore.setState({ prefs: { ...DEFAULT_PREFS }, hydrated: true });
  });

  it('defaults on so charts and fee/feature search are discoverable', () => {
    expect(DEFAULT_PREFS.enableDeepSearch).toBe(true);
    expect(DEFAULT_PREFS.showHistoryRibbon).toBe(true);
    expect(useStore.getState().prefs.showHistoryRibbon).toBe(true);
  });

  it('shows chart only when pref is on and history model exists', () => {
    const model = selectBankHistoryChartModel({ core: sample }, 'Mortgage');
    expect(model).not.toBeNull();

    const visible = (show: boolean) => show && model !== null;
    expect(visible(false)).toBe(false);

    useStore.getState().setPref('showHistoryRibbon', true);
    expect(visible(useStore.getState().prefs.showHistoryRibbon)).toBe(true);
  });

  it('persists showHistoryRibbon to AsyncStorage', async () => {
    useStore.getState().setPref('showHistoryRibbon', true);
    await useStore.persist.rehydrate();
    const raw = await AsyncStorage.getItem('ar-rates');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as { state?: { prefs?: Record<string, unknown> } };
    expect(stored.state?.prefs?.showHistoryRibbon).toBe(true);
  });

  it('restores showHistoryRibbon on cold-start rehydrate', async () => {
    await useStore.persist.clearStorage();
    await AsyncStorage.setItem(
      'ar-rates',
      JSON.stringify({
        state: {
          prefs: { ...DEFAULT_PREFS, showHistoryRibbon: true, enableDeepSearch: true },
          favorites: [],
          subscriptions: [],
        },
        version: 0,
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().prefs.showHistoryRibbon).toBe(true);
    expect(useStore.getState().prefs.enableDeepSearch).toBe(true);
  });

  it('never turns a collector on without a recorded consent choice', async () => {
    await useStore.persist.clearStorage();
    await AsyncStorage.setItem(
      'ar-rates',
      JSON.stringify({
        state: { prefs: { ...DEFAULT_PREFS, diagnosticsEnabled: true }, favorites: [], subscriptions: [] },
        version: 0,
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().prefs.crashReportsEnabled).toBe(false);
    expect(useStore.getState().prefs.sessionReplayEnabled).toBe(false);
    expect(useStore.getState().prefs.privacyChoiceVersion).toBe(0);
  });

  it('preserves previous independent choices but requires the revised confirmation', async () => {
    await useStore.persist.clearStorage();
    await AsyncStorage.setItem(
      'ar-rates',
      JSON.stringify({
        state: {
          prefs: {
            ...DEFAULT_PREFS,
            privacyChoiceVersion: 1,
            crashReportsEnabled: true,
            sessionReplayEnabled: false,
          },
          favorites: [],
          subscriptions: [],
        },
        version: 0,
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().prefs.crashReportsEnabled).toBe(true);
    expect(useStore.getState().prefs.sessionReplayEnabled).toBe(false);
    expect(useStore.getState().prefs.privacyChoiceVersion).toBe(0);
  });

  it('restores current, explicit independent privacy choices', async () => {
    await useStore.persist.clearStorage();
    await AsyncStorage.setItem(
      'ar-rates',
      JSON.stringify({
        state: {
          prefs: {
            ...DEFAULT_PREFS,
            privacyChoiceVersion: 2,
            crashReportsEnabled: false,
            sessionReplayEnabled: true,
          },
          favorites: [],
          subscriptions: [],
        },
        version: 0,
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().prefs.crashReportsEnabled).toBe(false);
    expect(useStore.getState().prefs.sessionReplayEnabled).toBe(true);
    expect(useStore.getState().prefs.privacyChoiceVersion).toBe(2);
  });
});
