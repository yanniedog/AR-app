import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { makeSavedRateRef } from '../src/data/savedRates';
import { DEFAULT_PREFS, useStore } from '../src/data/store';
import type { RateRow } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const row: RateRow = {
  provider: 'Example Bank',
  product_key: 'EX|TD',
  product_name: 'Term Deposit 12 months',
  rate_index: 4,
  rate: '0.0475',
};

describe('tracked rate store migration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useStore.setState({
      prefs: { ...DEFAULT_PREFS, onboarded: true },
      savedRates: [],
      trackedRates: [],
      favorites: [],
      subscriptions: [],
      activeSection: 'TD',
      hydrated: true,
    });
  });

  it('rehydrates Saved-only state into a versioned exact tracked record', async () => {
    const saved = makeSavedRateRef(row, 'rate', '2026-08-13T00:00:00.000Z');
    await AsyncStorage.setItem('ar-rates', JSON.stringify({
      state: {
        prefs: { ...DEFAULT_PREFS, onboarded: true },
        savedRates: [saved],
        favorites: [row.product_key],
        subscriptions: [],
        activeSection: 'TD',
      },
      version: 0,
    }));

    await useStore.persist.rehydrate();

    expect(useStore.getState().trackedRates).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        id: saved.id,
        rateIndex: 4,
        observedRate: 0.0475,
      }),
    ]);
  });

  it('keeps tracked metadata in lockstep with save and remove actions', () => {
    useStore.getState().toggleSavedRate(row);
    const id = 'rate:EX|TD:4';
    expect(useStore.getState().trackedRates).toEqual([
      expect.objectContaining({ id, rateIndex: 4 }),
    ]);

    useStore.getState().setTrackedRateRelevantDate(id, '2027-03-31', 'term-maturity');
    expect(useStore.getState().trackedRates[0]).toMatchObject({
      relevantDate: '2027-03-31',
      relevantDateKind: 'term-maturity',
    });

    useStore.getState().removeSavedRate(id);
    expect(useStore.getState().trackedRates).toEqual([]);
  });

  it('persists restored private date metadata after undo', async () => {
    const saved = makeSavedRateRef(row, 'rate', '2026-08-13T00:00:00.000Z');
    useStore.getState().restoreSavedRate(saved);
    useStore.getState().setTrackedRateRelevantDate(saved.id, '2027-03-31', 'term-maturity');
    const tracked = useStore.getState().trackedRates[0];

    useStore.getState().removeSavedRate(saved.id);
    useStore.getState().restoreSavedRate(saved, tracked);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useStore.getState().trackedRates[0]).toMatchObject({
      relevantDate: '2027-03-31',
      relevantDateKind: 'term-maturity',
    });
    const secureWrite = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1];
    expect(JSON.parse(secureWrite ?? '[]')).toEqual([
      { id: saved.id, relevantDate: '2027-03-31', relevantDateKind: 'term-maturity' },
    ]);
  });
});
