import type { DetailItem, Manifest, ProductDetail } from '../../types';
import { dedupeDetailItems, dedupeFacts, isAnnualFee, isUpfrontFee, uiDetailItem, uiNormalizedProductFact } from '../productUiFacts';
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
export function auditRenderedProductDetails(products: Record<string, ProductDetail>, manifest: Manifest | null | undefined) {
  let unknownValues = 0, unverifiedConditions = 0, rawCodes = 0, genericLabels = 0, duplicates = 0, suppressedNames = 0;
  let otherLabels = 0, withoutUpfrontFee = 0, withoutAnnualFee = 0, withoutDetailsFeatures = 0, factsUnknown = 0;
  const perGroup: Record<Group, number> = { Fees: 0, Eligibility: 0, Features: 0, Constraints: 0 };
  // The public report never carries bank wording, so the breakdown names only CDR codes; fee names are counted, not listed.
  let sourceAbsent = 0;
  const unknownByCode = new Map<string, [number, number, number]>(), hiddenNames = new Set<string>();
  for (const detail of Object.values(products)) {
    for (const [group, field] of GROUPS) {
      const published: DetailItem[] = detail[field] ?? [];
      const items = dedupeDetailItems(published);
      duplicates += published.length - items.length;
      items.forEach((item, index) => {
        const fact = uiDetailItem(item, index, group);
        if (fact.value.startsWith('Unknown')) {
          unknownValues += 1; perGroup[group] += 1;
          const hasValue = item.value != null && String(item.value).trim() !== '', hasInfo = Boolean(item.info?.trim());
          if (!hasValue && !hasInfo) sourceAbsent += 1;
          const key = `${group}:${publicCode(item.label)}`, entry = unknownByCode.get(key) ?? [0, 0, 0];
          unknownByCode.set(key, [entry[0] + 1, entry[1] + (hasValue ? 1 : 0), entry[2] + (hasInfo ? 1 : 0)]);
        }
        if (fact.conditionsUnverified) unverifiedConditions += 1;
        if (RAW_CODE.test(fact.label)) rawCodes += 1;
        if (GENERIC_LABEL.test(fact.label)) genericLabels += 1;
        if ((item.label ?? '').toUpperCase() === 'OTHER' && /^Other /.test(fact.label)) otherLabels += 1;
        if (group === 'Fees' && item.name?.trim() && uiPublishedFeeName(item) === 'Unknown') { suppressedNames += 1; hiddenNames.add(item.name.trim().toLowerCase()); }
      });
    }
    // ProductFacts hides normalized fees when the legacy fee surface exists, so they are not audited.
    const allFacts = normalizedProductFacts(detail).filter(fact => !detail.fees?.length || fact.kind !== 'fee'), distinctFacts = dedupeFacts(allFacts);
    duplicates += allFacts.length - distinctFacts.length;
    for (const fact of distinctFacts) {
      const rendered = uiNormalizedProductFact(fact);
      if (rendered.value.startsWith('Unknown')) factsUnknown += 1;
      if (rendered.conditionsUnverified) unverifiedConditions += 1;
      if (RAW_CODE.test(rendered.label)) rawCodes += 1;
    }
    const fees = dedupeDetailItems(detail.fees);
    if (fees.length) {
      if (!fees.some(isUpfrontFee)) withoutUpfrontFee += 1;
      if (!fees.some(isAnnualFee)) withoutAnnualFee += 1;
    }
    if (!detail.features?.length && (detail.facts ?? []).some(fact => fact.kind === 'feature')) withoutDetailsFeatures += 1;
  }
  const files = manifest?.files as Record<string, unknown> | undefined;
  // A channel counts as published only when its descriptor carries a content hash or schema.
  const declared = (value: unknown): boolean => typeof value === 'object' && value !== null
    && ['sha256', 'schema'].some(key => typeof (value as Record<string, unknown>)[key] === 'string');
  const channels = [declared(files?.terms_index), declared(manifest?.product_evidence_v1), declared(manifest?.product_response_evidence_v1)];
  const published = channels.filter(Boolean).length;
  return {
    renderedUnknownValues: unknownValues,
    renderedUnknownSourceAbsent: sourceAbsent,
    renderedUnknownByCode: topJson([...unknownByCode].sort((a, b) => b[1][0] - a[1][0]).slice(0, 40).map(([key, [n, withValue, withInfo]]) => [key, n, withValue, withInfo])),
    renderedSuppressedFeeNamesDistinct: hiddenNames.size,
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

const BREAKDOWN_JSON_MAX = 4000;
/** A published CDR enum code, or a fixed marker; free text never reaches the public report. */
function publicCode(value: string | undefined): string {
  const code = (value ?? '').trim();
  return !code ? 'NONE' : /^[A-Z][A-Z0-9_]{0,40}$/.test(code) ? code : 'NONSTANDARD';
}
/** Drops trailing entries until the JSON fits the public metric bound, so the export stays valid JSON. */
function topJson(entries: unknown[]): string {
  const kept = [...entries];
  let json = JSON.stringify(kept);
  while (json.length > BREAKDOWN_JSON_MAX && kept.length) { kept.pop(); json = JSON.stringify(kept); }
  return json;
}
