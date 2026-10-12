import type { ProductDetail, RateRow, SectionKey } from '../types';
import { yieldToUi } from '../lib/yieldToUi';
import { distinctEligibilityCriteria } from './eligibility';
import { getMandatoryEligibilityRevision, mandatoryEligibleRows } from './eligibilityGate';
import { distinctAccountFeatures } from './features';
import { sortByDisplayLabel } from './format';
import { compareLvrTiers } from './lvrTier';
import {
  featureEvidenceScope,
  publishedFactFilterOptions,
  type PublishedFactFilterOption,
} from './productFacts';
import type { Filters } from './selectors';

export interface SearchFilterGroup {
  title: string;
  field: keyof RateRow;
  key: keyof Filters;
}

export interface SearchFilterOptions {
  groups: { g: SearchFilterGroup; options: string[] }[];
  providers: string[];
  accountFeatures: string[];
  eligibilityCriteria: string[];
  publishedDetails: PublishedFactFilterOption[];
}

export const EMPTY_SEARCH_FILTER_OPTIONS: SearchFilterOptions = {
  groups: [], providers: [], accountFeatures: [], eligibilityCriteria: [], publishedDetails: [],
};

export function searchFilterGroupsFor(section: SectionKey): SearchFilterGroup[] {
  if (section === 'Mortgage') return [
    { title: 'Purpose', field: 'loan_purpose', key: 'loanPurposes' },
    { title: 'Rate type', field: 'rate_type', key: 'rateTypes' },
    { title: 'Repayment', field: 'ribbon_repayment_type', key: 'repaymentTypes' },
    { title: 'LVR tier', field: 'lvr_tier', key: 'lvrTiers' },
  ];
  if (section === 'TD') return [{ title: 'Interest paid', field: 'interest_payment', key: 'interestPayments' }];
  return [{ title: 'Account type', field: 'ribbon_deposit_kind', key: 'depositKinds' }];
}

/** Build the whole scoped facet catalogue outside render, yielding between
 * small batches. Product/tier scopes stay distinct and no options are capped. */
export async function prepareSearchFilterOptions(
  rows: RateRow[],
  detailsProducts: Record<string, ProductDetail> | null | undefined,
  section: SectionKey,
  control: {
    cancelled?: () => boolean;
    yieldControl?: () => Promise<void>;
    now?: () => number;
  } = {},
): Promise<SearchFilterOptions | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const eligibilityRevision = getMandatoryEligibilityRevision();
  const cancelled = () => control.cancelled?.() || getMandatoryEligibilityRevision() !== eligibilityRevision;
  // Even the first batch runs after the calling screen has had a chance to paint.
  await yieldControl();
  if (cancelled()) return null;
  const groups = searchFilterGroupsFor(section);
  const counts = groups.map(() => new Map<string, number>());
  const providers = new Set<string>();
  const accountFeatures = new Set<string>();
  const eligibilityCriteria = new Set<string>();
  const publishedDetails = new Map<string, PublishedFactFilterOption>();
  const seenScopes = new Set<string>();
  const seenProducts = new Set<string>();
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 16) {
    if (cancelled()) return null;
    const batch = mandatoryEligibleRows(rows.slice(offset, offset + 16));
    const scopedRows: RateRow[] = [];
    const productRows: RateRow[] = [];
    for (const row of batch) {
      if (row.provider) providers.add(row.provider);
      groups.forEach((group, index) => {
        const raw = row[group.field];
        if (raw === undefined || raw === null || raw === '') return;
        const key = String(raw);
        counts[index].set(key, (counts[index].get(key) ?? 0) + 1);
      });
      if (!detailsProducts) continue;
      const scopeKey = JSON.stringify(featureEvidenceScope(row.product_key, row, section));
      if (!seenScopes.has(scopeKey)) {
        seenScopes.add(scopeKey);
        scopedRows.push(row);
      }
      if (!seenProducts.has(row.product_key)) {
        seenProducts.add(row.product_key);
        productRows.push(row);
      }
    }
    for (const key of distinctAccountFeatures(scopedRows, detailsProducts, section)) accountFeatures.add(key);
    for (const key of distinctEligibilityCriteria(productRows, detailsProducts)) eligibilityCriteria.add(key);
    for (const option of publishedFactFilterOptions(scopedRows, detailsProducts, section)) {
      if (!publishedDetails.has(option.id)) publishedDetails.set(option.id, option);
    }
    // Check every sixteen rows rather than every product fact; a slice cannot
    // grow into the former whole-catalogue render burst on slower devices.
    if (now() - sliceStarted >= 8 && offset + 16 < rows.length) {
      await yieldControl();
      if (cancelled()) return null;
      sliceStarted = now();
    }
  }
  if (cancelled()) return null;
  return {
    groups: groups.map((g, index) => {
      const options = [...counts[index]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
      if (g.field === 'lvr_tier') options.sort(compareLvrTiers);
      return { g, options };
    }).filter(({ options }) => options.length > 0),
    providers: sortByDisplayLabel([...providers], name => name),
    accountFeatures: sortByDisplayLabel([...accountFeatures]),
    eligibilityCriteria: sortByDisplayLabel([...eligibilityCriteria]),
    publishedDetails: [...publishedDetails.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })),
  };
}
