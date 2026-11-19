import { useCallback } from 'react';
import { Alert } from 'react-native';

import { ensurePermissions } from '../data/notifications';
import { useStore } from '../data/store';
import type { RateRow } from '../types';

/** Exact-rate alert state and toggle shared by the product page and Saved rows. */
export function useRateAlertToggle(row: RateRow) {
  const notificationsEnabled = useStore(s => s.prefs.notificationsEnabled);
  // Subscribe to changes as well as reading the store's exact-scope predicate.
  useStore(s => s.subscriptions);
  const isProductSubscribed = useStore(s => s.isProductSubscribed);
  const subscribeProduct = useStore(s => s.subscribeProduct);
  const unsubscribeProduct = useStore(s => s.unsubscribeProduct);
  const setPref = useStore(s => s.setPref);
  const rateIndex = row.rate_index ?? null;
  const subscribed = notificationsEnabled && isProductSubscribed(row.product_key, rateIndex, row.public_offer_id);
  const toggle = useCallback(async () => {
    if (notificationsEnabled && isProductSubscribed(row.product_key, rateIndex, row.public_offer_id)) {
      unsubscribeProduct(row.product_key, rateIndex, row.public_offer_id);
      return;
    }
    if (!(await ensurePermissions())) { Alert.alert('Notifications disabled'); return; }
    if (!notificationsEnabled) setPref('notificationsEnabled', true);
    if (isProductSubscribed(row.product_key, rateIndex, row.public_offer_id)) return;
    if (subscribeProduct(row.product_key, rateIndex, row) === false) Alert.alert('Alert unavailable');
  }, [isProductSubscribed, notificationsEnabled, rateIndex, row, setPref, subscribeProduct, unsubscribeProduct]);
  return { subscribed, toggle };
}
