import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFS, useStore } from '../src/data/store';
import { CURRENT_PRIVACY_CHOICE_VERSION } from '../src/data/storeTypes';
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
it.each([false, true, undefined])('retires completion=%s without hiding a type or changing explicit privacy choices', async onboarded => {
  const prefs = { ...DEFAULT_PREFS, interests: ['Mortgage'], defaultSection: 'TD', onboarded,
    crashReportsEnabled: true, sessionReplayEnabled: false, privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION,
    notificationsEnabled: false, appLockEnabled: true };
  await AsyncStorage.setItem('ar-rates', JSON.stringify({ state: { prefs, activeSection: 'TD', savedRates: [], favorites: [], subscriptions: [] }, version: 0 }));
  await useStore.persist.rehydrate();
  const state = useStore.getState();
  expect(state.prefs).not.toHaveProperty('onboarded'); expect(state.activeSection).toBe('TD');
  expect(state.prefs).toMatchObject({ interests: ['Mortgage'], defaultSection: 'TD', crashReportsEnabled: true,
    sessionReplayEnabled: false, privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION, notificationsEnabled: false, appLockEnabled: true });
});
it('a fresh undecided preference remains undecided without telemetry or notification consent', async () => {
  await AsyncStorage.setItem('ar-rates', JSON.stringify({ state: { prefs: { interests: ['Savings'], onboarded: false }, favorites: [], subscriptions: [] }, version: 0 }));
  await useStore.persist.rehydrate();
  expect(useStore.getState().prefs).toMatchObject({ interests: ['Savings'], privacyChoiceVersion: 0, crashReportsEnabled: false, sessionReplayEnabled: false, notificationsEnabled: false });
  expect(useStore.getState().prefs).not.toHaveProperty('onboarded');
});
