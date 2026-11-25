import type { DetailItem, Manifest, ProductDetail } from '../../types';
import { dedupeDetailItems, uiDetailItem, uiNormalizedProductFact } from '../productUiFacts';
import { normalizedProductFacts } from '../../data/productFactsCore';
import { uiPublishedFeeName } from '../uiCopy';

type Group = 'Fees' | 'Eligibility' | 'Features' | 'Constraints';
const GROUPS: readonly [Group, 'fees' | 'eligibility' | 'features' | 'constraints'][] = [
  ['Fees', 'fees'], ['Eligibility', 'eligibility'], ['Features', 'features'], ['Constraints', 'constraints']];
const RAW_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const GENERIC_LABEL = /^(?:Fees|Eligibility|Features|Constraints) \d+$/;

/**
 * Counts what the product screen renders for each detail record, using the same
 * presentation functions as the screen. A published gap and a rendered gap differ:
 * the first is data the bank did not publish, the second is a placeholder shown
 * where the payload held something presentable.
 */
export function auditRenderedProductDetails(products: Record<string, ProductDetail>, manifest: Manifest | null | undefined): Record<string, number> {
  let unknownValues = 0, unverifiedConditions = 0, rawCodes = 0, genericLabels = 0, duplicates = 0, suppressedNames = 0;
  let otherLabels = 0, withoutUpfrontFee = 0, withoutAnnualFee = 0, withoutDetailsFeatures = 0, factsUnknown = 0;
  const perGroup: Record<Group, number> = { Fees: 0, Eligibility: 0, Features: 0, Constraints: 0 };
  for (const detail of Object.values(products)) {
    for (const [group, field] of GROUPS) {
      const published: DetailItem[] = detail[field] ?? [];
      const items = dedupeDetailItems(published);
      duplicates += published.length - items.length;
      items.forEach((item, index) => {
        const fact = uiDetailItem(item, index, group);
        if (fact.value.startsWith('Unknown')) { unknownValues += 1; perGroup[group] += 1; }
        if (fact.conditionsUnverified) unverifiedConditions += 1;
        if (RAW_CODE.test(fact.label)) rawCodes += 1;
        if (GENERIC_LABEL.test(fact.label)) genericLabels += 1;
        if ((item.label ?? '').toUpperCase() === 'OTHER' && /^Other /.test(fact.label)) otherLabels += 1;
        if (group === 'Fees' && item.name?.trim() && uiPublishedFeeName(item) === 'Unknown') suppressedNames += 1;
      });
    }
    for (const fact of normalizedProductFacts(detail)) {
      const rendered = uiNormalizedProductFact(fact);
      if (rendered.value.startsWith('Unknown')) factsUnknown += 1;
      if (RAW_CODE.test(rendered.label)) rawCodes += 1;
    }
    const fees = dedupeDetailItems(detail.fees);
    if (fees.length) {
      if (!fees.some(fee => (fee.label ?? '').toUpperCase() === 'UPFRONT')) withoutUpfrontFee += 1;
      if (!fees.some(fee => (fee.label ?? '').toUpperCase() === 'ANNUAL' || /annual/i.test(fee.name ?? ''))) withoutAnnualFee += 1;
    }
    if (!detail.features?.length && (detail.facts ?? []).some(fact => fact.kind === 'feature')) withoutDetailsFeatures += 1;
  }
  const files = manifest?.files as Record<string, unknown> | undefined;
  const channels = [Boolean(files?.terms_index), Boolean(manifest?.product_evidence_v1), Boolean(manifest?.product_response_evidence_v1)];
  const published = channels.filter(Boolean).length;
  return {
    renderedUnknownValues: unknownValues,
    renderedUnknownFeeValues: perGroup.Fees,
    renderedUnknownEligibilityValues: perGroup.Eligibility,
    renderedUnknownFeatureValues: perGroup.Features,
    renderedUnknownConstraintValues: perGroup.Constraints,
    renderedUnknownFactValues: factsUnknown,
    renderedUnverifiedConditions: unverifiedConditions,
    renderedRawCodeLabels: rawCodes,
    renderedGenericLabels: genericLabels,
    renderedOtherLabels: otherLabels,
    renderedDuplicateItems: duplicates,
    renderedSuppressedFeeNames: suppressedNames,
    feeListsWithoutUpfrontFee: withoutUpfrontFee,
    feeListsWithoutAnnualFee: withoutAnnualFee,
    featureFactsWithoutFeatureItems: withoutDetailsFeatures,
    companionChannelsExpected: channels.length,
    companionChannelsPublished: published,
    companionChannelsAbsent: channels.length - published,
  };
}
