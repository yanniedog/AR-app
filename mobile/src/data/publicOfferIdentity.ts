/** Versioned tuples preserve opaque wire identifiers without delimiter aliases. */
export function publicOfferSelectionToken(productKey: string, offerId: string): string {
  return `offer-v2:${JSON.stringify([offerId, productKey])}`;
}

export function parsePublicOfferSelectionToken(token: string): { offerId: string; productKey: string } | null {
  if (!token.startsWith('offer-v2:')) return null;
  try {
    const value: unknown = JSON.parse(token.slice('offer-v2:'.length));
    return Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string' && item.length > 0)
      ? { offerId: value[0], productKey: value[1] } : null;
  } catch { return null; }
}

export function publicOfferRefId(kind: 'rate' | 'product', productKey: string, offerId: string): string {
  return `${kind}-offer-v2:${JSON.stringify([productKey, offerId])}`;
}

/** Read compatibility only; never use this ambiguous form for new identities. */
export function legacyPublicOfferRefId(kind: 'rate' | 'product', productKey: string, offerId: string): string {
  return `${kind}:${productKey}:offer:${offerId}`;
}
