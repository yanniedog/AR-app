import type { CorePayload } from '../types';
import { bindCurrentPublicRow, type PublicCatalogueView } from './publicRateIntegration';
import { publicOfferSelectionToken } from './publicOfferIdentity';

/** Upgrade only exact current source occurrences; uncertain selections stay intact. */
export function reconcilePublicCompareSelectionTokens(core: CorePayload, catalogue: PublicCatalogueView,
  tokens: readonly string[]): string[] {
  // A ready discovery index can still be missing a product route that adds
  // another source binding. Wait for the complete validated generation.
  if (catalogue.status !== 'ready' || !catalogue.allLoaded) return [...tokens];
  return [...new Set(tokens.map(token => {
    const legacy = /^(\d+)#([\s\S]+)$/.exec(token);
    if (!legacy) return token;
    const index = Number(legacy[1]);
    const matches = new Set<string>();
    for (const section of Object.values(core.sections)) {
      for (const row of section.rates) {
        if (row.product_key !== legacy[2] || row.rate_index !== index) continue;
        const bound = bindCurrentPublicRow(row, catalogue);
        if (bound !== row && bound.public_offer_id) matches.add(publicOfferSelectionToken(bound.product_key, bound.public_offer_id));
      }
    }
    return matches.size === 1 ? [...matches][0] : token;
  }))];
}
