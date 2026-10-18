import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type Ionicons from '../icons/AppIcon';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { DetailLoadingLines } from '../feedback';
import { AppText, Button, Disclosure, Row } from '../ui';
import { formatBalanceRange, formatRate, formatTerm, humanizeEnum } from '../../data/format';
import { accessExcludesFromStandard, assessAccess } from '../../data/access';
import { isNonStandard } from '../../data/format';
import { ratePresentation } from '../../data/ratePresentation';
import { useStore } from '../../data/store';
import { rateQualifier } from '../../lib/rateQualifier';
import { uiAccessBadge, uiConditionFact, uiListedLvrRange, uiLoanPurpose, uiRateStructure, uiRepayment } from '../../lib/financialUiCopy';
import { scopedRateConditions } from '../../data/rateConditions';
import { scopedFinancialConditionFacts } from '../../data/scopedFinancialConditionFacts';
import { uiDetailItem, uiFeeCap, uiFeeDiscount, uiNormalizedProductFact, type ProductPresentationFact } from '../../lib/productUiFacts';
import { normalizedProductFacts } from '../../data/productFacts';
import { uiCount, uiIdentifier, uiJoin, uiLabel, uiProductName, type UiCopy, type UiLabel } from '../../lib/uiCopy';
import type { DetailItem, ProductDetail as ProductDetailData, RateRow, SectionKey } from '../../types';
import { openProduct } from '../../lib/nav';
import { FinancialFactRows } from './FinancialFactRows';
import { SelectedRateConditions } from './RateConditionsDisclosure';
export { SelectedRateConditions } from './RateConditionsDisclosure';

export function RateRowLine({ row, section, accent }: { row: RateRow; section: SectionKey; accent: string }) {
  const metric = useStore(s => s.prefs.mortgageRateMetric);
  const presentation = ratePresentation(row, section, metric), qualifier = rateQualifier(row, section);
  return <View style={{ gap: 6 }}>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small">{uiJoin(presentation.primaryLabel, ' ', formatRate(presentation.primary))}</AppText>
      {presentation.secondary !== null && presentation.secondaryLabel ? <AppText variant="small" color="textMuted">{uiJoin(presentation.secondaryLabel, ' ', formatRate(presentation.secondary))}</AppText> : null}
    </Row>
    <AppText variant="small" color="textMuted">{uiJoin(section === 'Mortgage' ? uiRepayment(row) : formatBalanceRange(row.balance_min, row.balance_max), ' · ', formatTerm(row),
      section === 'Mortgage' ? uiJoin(' · ', 'Listed LVR', ' ', uiListedLvrRange(row)) : null)}</AppText>
    {qualifier.conditional ? <AppText variant="small" color="warning">{qualifier.label}</AppText> : null}
    <SelectedRateConditions row={row} section={section} />
  </View>;
}
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
export function ProductRatesList({ rows, section, accent, defaultOpen = false }: { rows: RateRow[]; section: SectionKey; accent: string; defaultOpen?: boolean }) {
  const metric = useStore(s => s.prefs.mortgageRateMetric);
  const [open, setOpen] = useState(defaultOpen); if (!rows.length) return null;
  return <Disclosure title={uiJoin('Rates', ' (', uiCount(rows.length), ')')} open={open} onToggle={() => setOpen(v => !v)}>
    {open ? <View style={{ gap: 12 }}>{rows.map((row, i) => {
      const presentation = ratePresentation(row, section, metric), term = formatTerm(row);
      const balance = section === 'Mortgage' ? null : formatBalanceRange(row.balance_min, row.balance_max);
      const actionLabel = uiJoin('Open', ', ', uiProductName(row), ', ', presentation.primaryLabel, ' ', formatRate(presentation.primary),
        section === 'Mortgage' ? uiJoin(', ', 'Listed LVR', ' ', uiListedLvrRange(row), ', ', uiRepayment(row)) : balance ? uiJoin(', ', balance) : null,
        term ? uiJoin(', ', term) : null, ', ', 'Rate index', ' ', row.rate_index == null ? uiLabel('Unknown') : uiIdentifier(String(row.rate_index)));
      return <View key={`${row.rate_index}:${i}`} style={{ gap: 6 }}>
      <RateRowLine row={row} section={section} accent={accent} />
      <Button title="Open" variant="ghost" accessibilityLabel={actionLabel}
        onPress={() => row.public_programme_id
          ? openProduct(row.product_key, row.rate_index, row.public_programme_id)
          : openProduct(row.product_key, row.rate_index)} />
    </View>; })}</View> : null}
  </Disclosure>;
}
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
export function HistoryLegend({ productColor, sectionColor }: { productColor: string; sectionColor: string }) {
  return <Row gap={16} style={{ flexWrap: 'wrap' }}><LegendItem color={productColor} label="Leading advertised" /><LegendItem color={sectionColor} label="Median" dashed /><LegendItem color={sectionColor} label="Mean" /></Row>;
}
export function LegendItem({ color, label, dashed }: { color: string; label: UiCopy; dashed?: boolean }) {
  return <Row gap={6}><View style={{ width: 16, height: 0, borderTopWidth: 2.4, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} /><AppText variant="tiny" color="textMuted">{label}</AppText></Row>;
}
