import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFS, useStore } from '../src/data/store';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('product alert labels on rehydrate', () => {
  it('refreshes LVR wording saved by older builds without changing alert identity', async () => {
    await useStore.persist.clearStorage();
    await AsyncStorage.setItem(
      'ar-rates',
      JSON.stringify({
        state: {
          prefs: { ...DEFAULT_PREFS },
          favorites: [],
          subscriptions: [{
            id: 'product:Bank A|1#1',
            kind: 'product',
            productKey: 'Bank A|1',
            rateIndex: 1,
            label: 'Bank A · Home loan (Variable · LVR =60%)',
            createdAt: '2026-08-01T00:00:00.000Z',
          }],
        },
        version: 0,
      }),
    );

    await useStore.persist.rehydrate();

    expect(useStore.getState().subscriptions).toEqual([
      expect.objectContaining({
        id: 'product:Bank A|1#1',
        label: 'Bank A · Home loan (Variable · LVR ≤60%)',
      }),
    ]);
  });
});
