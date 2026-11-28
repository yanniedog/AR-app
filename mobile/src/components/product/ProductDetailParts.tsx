import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type Ionicons from '../icons/AppIcon';
import { ProductPageLink, productFactLink, useProductPageDetails } from './ProductPageLink';
import { DetailLoadingLines } from '../feedback';
import { AppText, Button, Disclosure, Row } from '../ui';
import { formatBalanceRange, formatTerm, humanizeEnum } from '../../data/format';
import { accessExcludesFromStandard, assessAccess } from '../../data/access';
import { isNonStandard } from '../../data/format';
import { useStore } from '../../data/store';
import { uiAccessBadge, uiConditionFact, uiListedLvrRange, uiLoanPurpose, uiRateStructure, uiRepayment, type FinancialFactRow } from '../../lib/financialUiCopy';
import { scopedRateConditions } from '../../data/rateConditions';
import { scopedFinancialConditionFacts } from '../../data/scopedFinancialConditionFacts';
import { dedupeDetailItems, dedupeFacts, groupUnlinkedGenericFacts, isAnnualFee, isUpfrontFee, uiDetailItem, uiFeeCap, uiFeeDiscount, uiNormalizedProductFact, uiProductFactValue, type ProductPresentationFact } from '../../lib/productUiFacts';
import { curatedFeatureIdentityKey, featureEvidenceScope, normalizedProductFacts } from '../../data/productFacts';
import { uiCount, uiJoin, uiLabel, type UiCopy, type UiLabel, type UiText } from '../../lib/uiCopy';
import type { DetailItem, NormalizedProductFact, ProductDetail as ProductDetailData, RateRow, SectionKey } from '../../types';
import { FinancialFactRows } from './FinancialFactRows';
export { SelectedRateConditions } from './RateConditionsDisclosure';

function PublishedFacts({ facts, fees }: { facts: readonly ProductPresentationFact[]; fees?: DetailItem[] }) {
  return <View style={{ gap: 10 }}>{facts.map((fact, index) => {
    const fee = fees?.[index], cap = fee ? uiFeeCap(fee) : null;
    const value = uiProductFactValue(fact);
    const tier = fact.scope.length
      ? uiJoin('Tier', ': ', ...fact.scope.flatMap((scope, i) => i ? [uiLabel(' · '), scope] : [scope]))
      : null;
    const discounts = fee?.discounts?.map(uiFeeDiscount) ?? [];
    const label = uiJoin(fact.label, ', ', value,
      tier ? uiJoin(', ', tier) : null,
      cap ? uiJoin(', ', cap) : null,
      ...discounts.map(discount => uiJoin(', ', discount)));
    return <ProductPageLink key={`${fact.reference}:${index}`} label={label} fact={fact.sourceFact}>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <AppText variant="small" weight="600" style={{ flex: 1 }}>{fact.label}</AppText>
          <AppText variant="small" color="textMuted" style={{ flex: 1, textAlign: 'right' }}>{value}</AppText>
        </Row>
        {tier ? <AppText variant="tiny" color="textMuted">{tier}</AppText> : null}
        {cap ? <AppText variant="tiny">{cap}</AppText> : null}
        {discounts.map((discount, d) => <AppText key={d} variant="tiny">{discount}</AppText>)}
      </View>
    </ProductPageLink>;
  })}</View>;
}
export function DetailGroup({ title, items: published, loading }: { title: 'Fees' | 'Eligibility' | 'Features' | 'Constraints'; icon: keyof typeof Ionicons.glyphMap; items?: DetailItem[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => published ? dedupeDetailItems(published) : published, [published]);
  const facts = useMemo(() => {
    const rows = (items ?? []).map((item, index) => uiDetailItem(item, index, title));
    // Legacy detail rows have no fact-level document links. Keep each fee
    // occurrence aligned with its original caps and discounts.
    return title === 'Fees' ? rows : groupUnlinkedGenericFacts(rows, () => false);
  }, [items, title]);
  if (!items?.length && !loading) return null;
  return <Disclosure title={title} open={open} onToggle={() => setOpen(v => !v)}>
    {loading && !items ? <DetailLoadingLines /> : <PublishedFacts
      facts={facts}
      fees={title === 'Fees' ? items : undefined} />}
  </Disclosure>;
}

const PRODUCT_FACT_GROUPS: readonly [NormalizedProductFact['kind'], UiLabel][] = [['rate', 'Rates'], ['tier', 'Tiers'], ['eligibility', 'Eligibility'],
  ['constraint', 'Constraints'], ['fee', 'Fees'], ['feature', 'Features'], ['condition', 'Conditions'], ['bundle', 'Bundles'], ['attribute', 'Attributes']];

export function ProductFacts({ productDetails: detail }: { productDetails: ProductDetailData | null }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0);
  const source = useProductPageDetails();
  // Rich legacy fee occurrences have their own Fees surface, including caps,
  // discounts and condition references. Transitional normalized copies must
  // not present the same charge a second time.
  const ordered = useMemo(() => {
    const raw = dedupeFacts(normalizedProductFacts(detail)).filter(fact => !detail?.fees?.length || fact.kind !== 'fee');
    return PRODUCT_FACT_GROUPS.flatMap(([kind]) => groupUnlinkedGenericFacts(
      raw.filter(fact => fact.kind === kind).map(uiNormalizedProductFact),
      fact => Boolean(productFactLink(source, fact)),
    ).map(fact => ({ kind, fact })));
  }, [detail, source]);
  if (!ordered.length) return null;
  const at = Math.min(page, Math.max(0, Math.ceil(ordered.length / 24) - 1));
  const selected = ordered.slice(at * 24, (at + 1) * 24);
  return <Disclosure title="Product facts" open={open} onToggle={() => setOpen(v => !v)}><View style={{ gap: 12 }}>
    {PRODUCT_FACT_GROUPS.map(([kind, title]) => {
      const facts = selected.filter(row => row.kind === kind).map(row => row.fact);
      return facts.length ? <View key={kind} style={{ gap: 8 }}><AppText variant="small" weight="600">{uiLabel(title)}</AppText>
        <PublishedFacts facts={facts} /></View> : null;
    })}
    {ordered.length > 24 ? <><AppText variant="tiny">{uiJoin('Product facts', ' · ', uiCount(ordered.length), ' · ', 'Page', ' ', uiCount(at + 1))}</AppText>
      <Row style={{ gap: 8 }}><Button title="Previous page" disabled={at === 0} variant="secondary" onPress={() => setPage(at - 1)} />
        <Button title="Next page" disabled={(at + 1) * 24 >= ordered.length} variant="secondary" onPress={() => setPage(at + 1)} /></Row></> : null}
  </View></Disclosure>;
}
export function AccessNotice({ name, productDetails: detail, loading, provider }: { name: string; productDetails: ProductDetailData | null; loading: boolean; provider?: string | null }) {
  const access = assessAccess(name, detail, provider); if (loading && !detail || !access.restricted && !access.verify) return null;
  const badge = uiAccessBadge(access);
  return <ProductPageLink label={badge}><AppText variant="small" color="warning">{badge}</AppText></ProductPageLink>;
}
export function SectionTitle({ text }: { text: UiCopy; icon?: keyof typeof Ionicons.glyphMap }) { return <AppText variant="small" weight="700">{text}</AppText>; }
function feeValues(items: readonly DetailItem[]): UiText {
  // The Fees surface's own facts, so conditions stay qualified (Conditions: Unverified).
  const values = items.map((item, index) => uiProductFactValue(uiDetailItem(item, index, 'Fees')));
  return values.length ? uiJoin(...values.flatMap((value, index) => index ? [uiLabel(' · '), value] : [value])) : uiLabel('Unknown');
}
function isOffset(key: string | undefined): boolean {
  return (key ?? '').trim().toUpperCase() === 'OFFSET';
}
function offsetValue(detail: ProductDetailData | null, row?: RateRow): UiText {
  const normalized = normalizedProductFacts(detail).filter(fact => curatedFeatureIdentityKey(fact) === 'OFFSET');
  const scope = featureEvidenceScope(row?.product_key ?? '', row, 'Mortgage');
  const values = normalized.length
    ? normalized.filter(fact => !fact.appliesTo?.length
      || fact.appliesTo.every(value => scope.includes(value.toUpperCase())))
      .map(fact => uiProductFactValue(uiNormalizedProductFact(fact)))
    : (detail?.features ?? []).filter(item => isOffset(item.label ?? item.name))
      .map((item, index) => uiProductFactValue(uiDetailItem(item, index, 'Features')));
  const distinct = [...new Set(values.map(value => value === 'Included' ? uiLabel('Yes') : value))];
  if (distinct.length > 1) return uiLabel('Conflicting');
  return distinct[0] ?? uiLabel('Unknown');
}
/** Headline cost facts from the published fee and feature lists. An absent fee is Unknown, never zero. */
export function mortgageHeadlineFacts(detail: ProductDetailData | null, row?: RateRow): FinancialFactRow[] {
  const fees = dedupeDetailItems(detail?.fees);
  const annual = fees.filter(isAnnualFee), upfront = fees.filter(isUpfrontFee);
  return [{ label: 'Annual fee', value: feeValues(annual) }, { label: 'Upfront fee', value: feeValues(upfront) },
    { label: 'Offset account', value: offsetValue(detail, row) }];
}
export function ProductSpecs({ row, section, productDetails }: { row: RateRow; section: SectionKey; productDetails: ProductDetailData | null }) {
  const [open, setOpen] = useState(true);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const conditions = useMemo(() => scopedFinancialConditionFacts(scopedRateConditions(row, section, { core, details, manifest, coreIntegrity })), [row, section, core, details, manifest, coreIntegrity]);
  const sourceLvr = conditions.facts.filter(fact => fact.kind === 'published-lvr-range');
  const access = productDetails ? assessAccess(row.product_name, productDetails, row.provider) : null;
  const availability = access && accessExcludesFromStandard(access) ? uiJoin('Restricted', ' · ', uiAccessBadge(access))
    : isNonStandard(row) ? uiJoin('Listed rate', ' · ', 'Unverified')
      : access ? uiLabel('Eligibility unverified') : uiLabel('Unverified');
  // Legacy arrays and normalized facts can publish the same criterion; the larger list is the published count.
  const criteria = Math.max(dedupeDetailItems([...(productDetails?.eligibility ?? []), ...(productDetails?.constraints ?? [])]).length,
    normalizedProductFacts(productDetails).filter(fact => fact.kind === 'eligibility' || fact.kind === 'constraint').length);
  const eligibility = productDetails ? criteria ? uiJoin('Published', ' · ', uiCount(criteria)) : uiLabel('Not published') : uiLabel('Unverified');
  const structure = uiRateStructure(row), rateType = humanizeEnum(row.rate_type);
  const variable = (row.rate_type ?? '').toUpperCase() === 'VARIABLE';
  return <Disclosure title="Rate details" open={open} onToggle={() => setOpen(v => !v)}>
    <FinancialFactRows linkToProduct rows={[{ label: 'Rate type', value: rateType }, { label: 'Term', value: formatTerm(row) || uiLabel(variable ? 'Not applicable' : 'Unknown') },
      ...(section === 'Mortgage' ? [...(structure === rateType ? [] : [{ label: 'Rate structure' as const, value: structure }]), { label: 'Repayment' as const, value: uiRepayment(row) },
        { label: 'Loan purpose' as const, value: uiLoanPurpose(row) }, ...(sourceLvr.length ? sourceLvr.map(uiConditionFact) : [{ label: 'Listed LVR' as const, value: uiListedLvrRange(row) }]),
        ...(productDetails ? mortgageHeadlineFacts(productDetails, row) : [])]
        : [{ label: 'Balance' as const, value: formatBalanceRange(row.balance_min, row.balance_max) || uiLabel('Unknown') }, { label: 'Interest paid' as const, value: humanizeEnum(row.interest_payment) || uiLabel('Unknown') }]),
      { label: 'Availability', value: availability }, { label: 'Eligibility', value: eligibility }]} />
  </Disclosure>;
}
