import { SECTION_KEYS, type CorePayload, type ProductDetail, type RateRow } from '../types';
import { normalizeProfileFilters, profileFeaturesForSection, profileFilterRows, profileSelectionCount, type ProfileFilters } from './profile';

export interface MandatoryEligibility {
  active: boolean;
  loading: boolean;
  rows: WeakSet<RateRow>;
  productKeys: ReadonlySet<string>;
}

/** One mandatory selection, before any screen narrowing, ranking or aggregation. */
export function selectMandatoryEligibility(
  core: CorePayload | null,
  profile: Partial<ProfileFilters> | null | undefined,
  verifiedProducts: Record<string, ProductDetail> | null,
): MandatoryEligibility {
  const required = normalizeProfileFilters(profile);
  const active = profileSelectionCount(required) > 0;
  const loading = active && (!core || (!verifiedProducts && SECTION_KEYS.some(section => profileFeaturesForSection(required, section).length > 0)));
  const rows = new WeakSet<RateRow>(), productKeys = new Set<string>();
  if (core) for (const section of SECTION_KEYS) {
    for (const row of profileFilterRows(core.sections[section].rates, required, section, verifiedProducts)) {
      rows.add(row); productKeys.add(row.product_key);
    }
  }
  return { active, loading, rows, productKeys };
}
