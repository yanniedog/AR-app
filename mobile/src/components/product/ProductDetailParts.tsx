import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type Ionicons from '../icons/AppIcon';
import { ProductPageLink } from './ProductPageLink';
import { DetailLoadingLines } from '../feedback';
import { AppText, Disclosure, Row } from '../ui';
import { formatBalanceRange, formatTerm, humanizeEnum } from '../../data/format';
import { accessExcludesFromStandard, assessAccess } from '../../data/access';
import { isNonStandard } from '../../data/format';
import { useStore } from '../../data/store';
import { uiAccessBadge, uiConditionFact, uiListedLvrRange, uiLoanPurpose, uiRateStructure, uiRepayment } from '../../lib/financialUiCopy';
import { scopedRateConditions } from '../../data/rateConditions';
import { scopedFinancialConditionFacts } from '../../data/scopedFinancialConditionFacts';
import { uiDetailItem, uiFeeCap, uiFeeDiscount, uiNormalizedProductFact, uiProductFactValue, type ProductPresentationFact } from '../../lib/productUiFacts';
import { normalizedProductFacts } from '../../data/productFacts';
import { uiJoin, uiLabel, type UiCopy } from '../../lib/uiCopy';
import type { DetailItem, ProductDetail as ProductDetailData, RateRow, SectionKey } from '../../types';
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
    return <ProductPageLink key={`${fact.reference}:${index}`} label={label}>
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
export function DetailGroup({ title, items, loading }: { title: 'Fees' | 'Eligibility' | 'Features' | 'Constraints'; icon: keyof typeof Ionicons.glyphMap; items?: DetailItem[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  if (!items?.length && !loading) return null;
  return <Disclosure title={title} open={open} onToggle={() => setOpen(v => !v)}>
    {loading && !items ? <DetailLoadingLines /> : <PublishedFacts
      facts={(items ?? []).map((item, index) => uiDetailItem(item, index, title))}
      fees={title === 'Fees' ? items : undefined} />}
  </Disclosure>;
}
export function ProductFacts({ productDetails: detail }: { productDetails: ProductDetailData | null }) {
  const [open, setOpen] = useState(false);
  // Rich legacy fee occurrences have their own Fees surface, including caps,
  // discounts and condition references. Transitional normalized copies must
  // not present the same charge a second time.
  const facts = normalizedProductFacts(detail).filter(fact => !detail?.fees?.length || fact.kind !== 'fee').map(uiNormalizedProductFact); if (!facts.length) return null;
  return <Disclosure title="Product facts" open={open} onToggle={() => setOpen(v => !v)}><PublishedFacts facts={facts} /></Disclosure>;
}
export function AccessNotice({ name, productDetails: detail, loading, provider }: { name: string; productDetails: ProductDetailData | null; loading: boolean; provider?: string | null }) {
  const access = assessAccess(name, detail, provider); if (loading && !detail || !access.restricted && !access.verify) return null;
  const badge = uiAccessBadge(access);
  return <ProductPageLink label={badge}><AppText variant="small" color="warning">{badge}</AppText></ProductPageLink>;
}
export function SectionTitle({ text }: { text: UiCopy; icon?: keyof typeof Ionicons.glyphMap }) { return <AppText variant="small" weight="700">{text}</AppText>; }
export function ProductSpecs({ row, section, productDetails }: { row: RateRow; section: SectionKey; productDetails: ProductDetailData | null }) {
  const [open, setOpen] = useState(true);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const conditions = useMemo(() => scopedFinancialConditionFacts(scopedRateConditions(row, section, { core, details, manifest, coreIntegrity })), [row, section, core, details, manifest, coreIntegrity]);
  const sourceLvr = conditions.facts.filter(fact => fact.kind === 'published-lvr-range');
  const access = productDetails ? assessAccess(row.product_name, productDetails, row.provider) : null;
  const availability = access && accessExcludesFromStandard(access) ? uiJoin('Restricted', ' · ', uiAccessBadge(access))
    : isNonStandard(row) ? uiJoin('Listed rate', ' · ', 'Unverified') : access ? uiJoin('Widely available', ' · ', 'Eligibility unverified') : uiLabel('Unverified');
  return <Disclosure title="Rate details" open={open} onToggle={() => setOpen(v => !v)}>
    <FinancialFactRows linkToProduct rows={[{ label: 'Rate type', value: humanizeEnum(row.rate_type) }, { label: 'Term', value: formatTerm(row) || uiLabel('Unknown') },
      ...(section === 'Mortgage' ? [{ label: 'Rate structure' as const, value: uiRateStructure(row) }, { label: 'Repayment' as const, value: uiRepayment(row) },
        { label: 'Loan purpose' as const, value: uiLoanPurpose(row) }, ...(sourceLvr.length ? sourceLvr.map(uiConditionFact) : [{ label: 'Listed LVR' as const, value: uiListedLvrRange(row) }])]
        : [{ label: 'Balance' as const, value: formatBalanceRange(row.balance_min, row.balance_max) || uiLabel('Unknown') }, { label: 'Interest paid' as const, value: humanizeEnum(row.interest_payment) || uiLabel('Unknown') }]),
      { label: 'Availability', value: availability }, { label: 'Eligibility', value: uiLabel('Unverified') }]} />
  </Disclosure>;
}
