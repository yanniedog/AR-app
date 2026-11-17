import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type Ionicons from '../icons/AppIcon';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { DetailLoadingLines } from '../feedback';
import { AppText, Button, Disclosure, Row } from '../ui';
import { formatBalanceRange, formatTerm, humanizeEnum } from '../../data/format';
import { accessExcludesFromStandard, assessAccess } from '../../data/access';
import { isNonStandard } from '../../data/format';
import { useStore } from '../../data/store';
import { uiAccessBadge, uiConditionFact, uiListedLvrRange, uiLoanPurpose, uiRateStructure, uiRepayment } from '../../lib/financialUiCopy';
import { scopedRateConditions } from '../../data/rateConditions';
import { scopedFinancialConditionFacts } from '../../data/scopedFinancialConditionFacts';
import { uiDetailItem, uiFeeCap, uiFeeDiscount, uiNormalizedProductFact, type ProductPresentationFact } from '../../lib/productUiFacts';
import { normalizedProductFacts } from '../../data/productFacts';
import { uiCount, uiJoin, uiLabel, type UiCopy, type UiLabel } from '../../lib/uiCopy';
import type { DetailItem, ProductDetail as ProductDetailData, RateRow, SectionKey } from '../../types';
import { FinancialFactRows } from './FinancialFactRows';
export { SelectedRateConditions } from './RateConditionsDisclosure';

function PublishedFacts({ facts }: { facts: readonly ProductPresentationFact[] }) {
  return <View style={{ gap: 10 }}>{facts.map((fact, index) => <View key={`${fact.reference}:${index}`} style={{ gap: 4 }}>
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <AppText variant="small" weight="600" style={{ flex: 1 }}>{fact.label}</AppText>
      <AppText variant="small" color="textMuted" style={{ flex: 1, textAlign: 'right' }}>{fact.value}</AppText>
    </Row>
    {fact.scope.length ? <AppText variant="tiny" color="textMuted">{uiJoin('Tier', ': ', ...fact.scope.flatMap((scope, i) => i ? [uiLabel(' · '), scope] : [scope]))}</AppText> : null}
    {fact.conditions === 'source-review-required' ? <AppText variant="tiny" color="warning">{uiJoin('Source review required', ' · ', 'Source', ' ', fact.reference)}</AppText> : null}
  </View>)}</View>;
}
export function DetailGroup({ title, items, loading }: { title: 'Fees' | 'Eligibility' | 'Features' | 'Constraints'; icon: keyof typeof Ionicons.glyphMap; items?: DetailItem[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  if (!items?.length && !loading) return null;
  return <Disclosure title={title} open={open} onToggle={() => setOpen(v => !v)}>
    {loading && !items ? <DetailLoadingLines /> : <View style={{ gap: 10 }}>
      <PublishedFacts facts={(items ?? []).map((item, index) => uiDetailItem(item, index, title))} />
      {title === 'Fees' ? (items ?? []).map((item, i) => <View key={i}>
        {uiFeeCap(item) ? <AppText variant="tiny">{uiFeeCap(item)}</AppText> : null}
        {item.discounts?.map((discount, d) => <AppText key={d} variant="tiny">{uiFeeDiscount(discount)}</AppText>)}
      </View>) : null}
    </View>}
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
  const { requestExternalUrl } = useTrustedExternalUrl();
  const access = assessAccess(name, detail, provider); if (loading && !detail || !access.restricted && !access.verify) return null;
  return <View style={{ gap: 6 }}>
    <AppText variant="small" color="warning">{uiAccessBadge(access)}</AppText>
    {detail?.links?.eligibility ? <Button title="Eligibility" variant="ghost" onPress={() => requestExternalUrl({ url: detail.links!.eligibility!, purpose: 'lender_source', label: 'Eligibility' })} /> : null}
  </View>;
}
export function OfficialLinks({ links, sourceDocuments }: { links?: ProductDetailData['links']; sourceDocuments?: ProductDetailData['sourceDocuments'] }) {
  const { requestExternalUrl } = useTrustedExternalUrl(); const [open, setOpen] = useState(false);
  const all: { label: UiLabel; url?: string }[] = [
    { label: 'Product', url: links?.overview }, { label: 'Eligibility', url: links?.eligibility }, { label: 'Fees', url: links?.fees },
    { label: 'Terms', url: links?.terms }, { label: 'Package', url: links?.bundle },
    ...(sourceDocuments ?? []).map(document => ({ label: 'Source' as const, url: document.sourceUrl ?? document.url })),
  ];
  const items = all.filter((item): item is { label: UiLabel; url: string } => Boolean(item.url));
  useAuditExternalLinks(items.map(item => ({ ...item, purpose: 'lender_source' as const })));
  if (!items.length) return null;
  return <Disclosure title="Sources" open={open} onToggle={() => setOpen(v => !v)}><View style={{ gap: 6 }}>
    {items.map((item, index) => <Button key={`${item.url}:${index}`} title={item.label === 'Source' ? uiJoin('Source', ' ', uiCount(index + 1)) : item.label} variant="ghost"
      onPress={() => requestExternalUrl({ url: item.url, purpose: 'lender_source', label: item.label })} />)}
  </View></Disclosure>;
}
export function SectionTitle({ text }: { text: UiCopy; icon?: keyof typeof Ionicons.glyphMap }) { return <AppText variant="small" weight="700">{text}</AppText>; }
export function ProductSpecs({ row, section, productDetails }: { row: RateRow; section: SectionKey; productDetails: ProductDetailData | null }) {
  const [open, setOpen] = useState(false);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const conditions = useMemo(() => scopedFinancialConditionFacts(scopedRateConditions(row, section, { core, details, manifest, coreIntegrity })), [row, section, core, details, manifest, coreIntegrity]);
  const sourceLvr = conditions.facts.filter(fact => fact.kind === 'published-lvr-range');
  const access = productDetails ? assessAccess(row.product_name, productDetails, row.provider) : null;
  const availability = access && accessExcludesFromStandard(access) ? uiJoin('Restricted', ' · ', uiAccessBadge(access))
    : isNonStandard(row) ? uiJoin('Listed rate', ' · ', 'Unverified') : access ? uiJoin('Widely available', ' · ', 'Eligibility unverified') : uiLabel('Unverified');
  return <Disclosure title="Rate details" open={open} onToggle={() => setOpen(v => !v)}>
    <FinancialFactRows rows={[{ label: 'Rate type', value: humanizeEnum(row.rate_type) }, { label: 'Term', value: formatTerm(row) || uiLabel('Unknown') },
      ...(section === 'Mortgage' ? [{ label: 'Rate structure' as const, value: uiRateStructure(row) }, { label: 'Repayment' as const, value: uiRepayment(row) },
        { label: 'Loan purpose' as const, value: uiLoanPurpose(row) }, ...(sourceLvr.length ? sourceLvr.map(uiConditionFact) : [{ label: 'Listed LVR' as const, value: uiListedLvrRange(row) }])]
        : [{ label: 'Balance' as const, value: formatBalanceRange(row.balance_min, row.balance_max) || uiLabel('Unknown') }, { label: 'Interest paid' as const, value: humanizeEnum(row.interest_payment) || uiLabel('Unknown') }]),
      { label: 'Availability', value: availability }, { label: 'Eligibility', value: uiLabel('Unverified') }]} />
  </Disclosure>;
}
