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

it.each([10, 20])('persists the %i rate page choice and saved requirements across rehydration', async ratesPageSize => {
  const profileFilters = { ...DEFAULT_PREFS.profileFilters, rateTypes: ['FIXED'], depositKinds: ['BONUS'], accountFeatures: ['OFFSET', 'CARD_ACCESS'] };
  useStore.getState().setPref('profileFilters', profileFilters);
  useStore.getState().setPref('ratesPageSize', ratesPageSize as 10 | 20);
  const persisted = JSON.parse((await AsyncStorage.getItem('ar-rates'))!);
  expect(persisted.state.prefs.ratesPageSize).toBe(ratesPageSize);
  useStore.setState(state => ({ prefs: { ...state.prefs, ratesPageSize: ratesPageSize === 10 ? 20 : 10 } }));
  await AsyncStorage.setItem('ar-rates', JSON.stringify(persisted));
  await useStore.persist.rehydrate();
  expect(useStore.getState().prefs).toMatchObject({ ratesPageSize, profileFilters });
});
it.each([undefined, null, 500, '10'])('migrates missing/invalid page size %s to 20 without clearing saved selections', async ratesPageSize => {
  await AsyncStorage.setItem('ar-rates', JSON.stringify({ state: { prefs: { ratesPageSize, profileFilters: { rateTypes: ['FIXED'] } } }, version: 0 }));
  await useStore.persist.rehydrate();
  expect(useStore.getState().prefs.ratesPageSize).toBe(20);
  expect(useStore.getState().prefs.profileFilters.rateTypes).toEqual(['FIXED']);
});
