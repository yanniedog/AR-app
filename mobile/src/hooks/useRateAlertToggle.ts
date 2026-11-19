import { useCallback } from 'react';
import { Alert } from 'react-native';

import { ensurePermissions } from '../data/notifications';
import { useStore } from '../data/store';
import type { RateRow } from '../types';

/** Exact-rate alert state and toggle shared by the product page and Saved rows. */
/** A product-scoped save watches the whole product, so its alert has no tier index. */
export function useRateAlertToggle(row: RateRow, scope: 'rate' | 'product' = 'rate') {
  const notificationsEnabled = useStore(s => s.prefs.notificationsEnabled);
  // Subscribe to changes as well as reading the store's exact-scope predicate.
  useStore(s => s.subscriptions);
  const isProductSubscribed = useStore(s => s.isProductSubscribed);
  const subscribeProduct = useStore(s => s.subscribeProduct);
  const unsubscribeProduct = useStore(s => s.unsubscribeProduct);
  const setPref = useStore(s => s.setPref);
  const product = scope === 'product';
  const rateIndex = product ? null : row.rate_index ?? null;
  // Product scope uses the product-wide identity throughout: no tier, no offer.
  const offerId = product ? undefined : row.public_offer_id;
  const subscribed = notificationsEnabled && isProductSubscribed(row.product_key, rateIndex, offerId);
  const toggle = useCallback(async () => {
    if (notificationsEnabled && isProductSubscribed(row.product_key, rateIndex, offerId)) {
      unsubscribeProduct(row.product_key, rateIndex, offerId);
      return;
    }
    if (!(await ensurePermissions())) { Alert.alert('Notifications disabled'); return; }
    if (!notificationsEnabled) setPref('notificationsEnabled', true);
    if (isProductSubscribed(row.product_key, rateIndex, offerId)) return;
    const subscribeRow = product ? { ...row, public_offer_id: undefined, public_programme_id: undefined } : row;
    if (subscribeProduct(row.product_key, rateIndex, subscribeRow) === false) Alert.alert('Alert unavailable');
  }, [isProductSubscribed, notificationsEnabled, offerId, product, rateIndex, row, setPref, subscribeProduct, unsubscribeProduct]);
  return { subscribed, toggle };
}
