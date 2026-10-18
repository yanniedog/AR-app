import { hasMandatoryRequirements, isMandatoryEligibilityReady, mandatoryEligibleRows } from './eligibilityGate';
import { publicCatalogueOfferRows, type PublicCatalogueView } from './publicRateIntegration';
import type { RateScenario } from './publicRateModel';
import type { SectionKey } from '../types';

/** Discovery and direct navigation apply the same mandatory evidence gate as rate rows. */
export function eligiblePublicProductKeys(catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario): Set<string> {
  if (!hasMandatoryRequirements()) return new Set(catalogue.products.filter(product => product.section === section).map(product => product.productKey));
  if (!isMandatoryEligibilityReady()) return new Set();
  return new Set(mandatoryEligibleRows(publicCatalogueOfferRows(catalogue, section, scenario)).map(row => row.product_key));
}
