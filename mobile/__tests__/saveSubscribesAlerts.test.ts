import { useStore } from '../src/data/store';
import type { Manifest, RateRow } from '../src/types';

const row: RateRow = { provider: 'Example Bank', product_key: 'EX|HL', product_name: 'Home loan', rate_index: 2, rate: '0.06' };

function reset(notificationsEnabled: boolean) {
  useStore.setState(state => ({
    savedRates: [], trackedRates: [], favorites: [], subscriptions: [], manifest: {} as Manifest,
    prefs: { ...state.prefs, notificationsEnabled },
  }));
}

it('subscribes a newly saved rate when alerts are already allowed', () => {
  reset(true);
  useStore.getState().toggleSavedRate(row);
  expect(useStore.getState().savedRates).toHaveLength(1);
  expect(useStore.getState().isProductSubscribed(row.product_key, 2)).toBe(true);
  // Removing the save leaves the alert choice alone and does not resubscribe.
  useStore.getState().unsubscribeProduct(row.product_key, 2);
  useStore.getState().toggleSavedRate(row);
  expect(useStore.getState().savedRates).toHaveLength(0);
  expect(useStore.getState().subscriptions).toHaveLength(0);
});

it('does not subscribe or prompt when alerts are off', () => {
  reset(false);
  useStore.getState().toggleSavedRate(row);
  expect(useStore.getState().savedRates).toHaveLength(1);
  expect(useStore.getState().subscriptions).toHaveLength(0);
});
