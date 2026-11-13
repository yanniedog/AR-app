import { hasMandatoryRequirements, isMandatoryEligibilityReady, mandatoryEligibleRows } from './eligibilityGate';
import { publicCatalogueOfferRows, publicProductOfferRows, type PublicCatalogueView } from './publicRateIntegration';
import type { PublicProduct, RateScenario } from './publicRateModel';
import type { SectionKey } from '../types';

/** Discovery and direct navigation apply the same mandatory evidence gate as rate rows. */
export function eligiblePublicProductKeys(catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario): Set<string> {
  if (!hasMandatoryRequirements()) return new Set(catalogue.products.filter(product => product.section === section).map(product => product.productKey));
  if (!isMandatoryEligibilityReady()) return new Set();
  return new Set(mandatoryEligibleRows(publicCatalogueOfferRows(catalogue, section, scenario)).map(row => row.product_key));
}

/**
 * Same admission as {@link eligiblePublicProductKeys} for one already-resolved
 * product. Product open must not expand every other programme in the section.
 */
export function isPublicProductEligible(catalogue: PublicCatalogueView, product: PublicProduct, scenario: RateScenario): boolean {
  const listed = catalogue.getProduct(product.productKey);
  if (!listed || listed.section !== product.section) return false;
  if (!hasMandatoryRequirements()) return true;
  if (!isMandatoryEligibilityReady()) return false;
  return mandatoryEligibleRows(publicProductOfferRows(product, catalogue, scenario)).some(row => row.product_key === product.productKey);
}
