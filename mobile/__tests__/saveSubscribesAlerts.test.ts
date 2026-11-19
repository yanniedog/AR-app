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

it('Save all rates subscribes to the product even on an unindexed exact offer', () => {
  reset(true);
  const offer = { ...row, rate_index: undefined, public_offer_id: 'offer', exact_alert_eligible: true };
  useStore.getState().toggleSavedRate(offer, 'product');

  const state = useStore.getState();
  expect(state.subscriptions).toHaveLength(1);
  expect(state.isProductSubscribed(row.product_key, null)).toBe(true);
  expect(state.isProductSubscribed(row.product_key, null, offer.public_offer_id)).toBe(false);
});
