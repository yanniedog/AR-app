import type { RateScenario } from '../data/publicRateModel';
import { usePublicRateCatalogue } from '../data/publicRateCatalogue';
import { bindCurrentPublicRow, publicRateScenario, resolveRowPublicRate } from '../data/publicRateIntegration';
import { publicRateOriginLabel, publicRateText } from '../data/publicRatePresentation';
import Ionicons from './icons/AppIcon';
import React from 'react';
import { StyleSheet, useWindowDimensions, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
  isNonStandard,
  toFraction,
} from '../data/format';
import { useStore } from '../data/store';
import { assessAccess } from '../data/access';
import { ratePresentation } from '../data/ratePresentation';
import { rateQualifier } from '../lib/rateQualifier';
import { openBank } from '../lib/nav';
import type { LogoRenderState } from '../lib/logoReadiness';
import type { RateRow, SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BankAvatar } from './BankAvatar';
import { RateFreshnessSymbol } from './RateFreshnessSymbol';
import { rateFreshness, rowVerificationReceipt } from '../data/rateFreshness';
import {
  productRateChangeText,
  useProductRateChangeSummary,
} from './product/ProductRateChangeLine';
import { androidRipple, AppText } from './ui';
import { PressFeedback } from './PressFeedback';
import { IconAction } from './IconAction';
import { useWordBubble, type IconWord } from './WordBubble';
import { COMPACT_ROW, compactBankLogoFrame, compactProductFacet, compactTierIndex } from './product/compactProductRow';
import { sourceRowForPublicRow } from '../data/publicRateIntegration';
import { scopedRateConditions } from '../data/rateConditions';
import { scopedFinancialConditionFacts, type ScopedFinancialConditionPresentation } from '../data/scopedFinancialConditionFacts';
import { uiAccessBadge, uiConditionTag, uiListedLvr, uiLoanPurpose } from '../lib/financialUiCopy';
import { uiJoin, uiLabel, uiProductName, uiProviderName, type UiCopy, type UiText } from '../lib/uiCopy';
import { productSaveIdentity } from '../lib/productSaveIdentity';

function chips(row: RateRow, section: SectionKey, conditional: boolean, conditions: ScopedFinancialConditionPresentation): UiText[] {
  const out: UiText[] = [];
  const sourceLvr = conditions.facts.filter(f => f.kind === 'published-lvr-range');
  const sourceBalance = conditions.facts.filter(f => f.kind === 'published-balance-range' && (section === 'Mortgage' || f.subject === 'balance' || f.subject === 'deposit-balance'));
  const sourceTerm = conditions.facts.filter(f => f.kind === 'published-term-range');
  if (section === 'Mortgage') {
    if (row.ribbon_rate_structure) out.push(humanizeEnum(row.ribbon_rate_structure));
    const term = formatTerm(row);
    if (term) out.push(term);
    if (row.ribbon_repayment_type ?? row.repayment_type)
      out.push(humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    if (row.loan_purpose) out.push(uiLoanPurpose(row));
    out.push(...(sourceLvr.length ? sourceLvr.map(uiConditionTag) : [uiListedLvr(row)]));
  } else if (section === 'TD') {
    const term = formatTerm(row);
    if (term) out.push(term);
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal && !sourceBalance.length) out.push(bal);
    if (row.interest_payment) out.push(humanizeEnum(row.interest_payment));
  } else {
    // Conditional rates have their own caution label below. Reuse the central
    // classifier so the caption and caution label can never disagree.
    if (row.ribbon_deposit_kind && !conditional) {
      out.push(humanizeEnum(row.ribbon_deposit_kind));
    }
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal && !sourceBalance.length) out.push(bal);
    const term = formatTerm(row);
    if (term) out.push(term);
  }
  out.push(...sourceBalance.map(uiConditionTag), ...sourceTerm.map(uiConditionTag));
  if (conditions.unresolved.length) out.push(uiLabel('Source review required'));
  return [...new Set(out)];
}

function ProductCardView({
  row,
  section,
  onPress,
  onLongPress,
  selectMode,
  selected,
  embedded = false,
  displayedRate,
  displayedRateLabel,
  showLenderAction = true,
  logoRenderStateId,
  onLogoRenderStateChange,
  comparisonUnverified = false,
  rateScenario,
}: {
  row: RateRow;
  section: SectionKey;
  onPress?: () => void;
  onLongPress?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  /** Removes surrounding chrome when this card is already inside a parent surface. */
  embedded?: boolean;
  /** Emphasises the one displayed rate without repeating it above the product. */
  heroRate?: boolean;
  /** Exact fraction used to rank this row when it differs from the headline. */
  displayedRate?: number | string | null;
  /** Metric-specific label for displayedRate, such as Ongoing or Comparison rate. */
  displayedRateLabel?: UiCopy;
  /** Hide redundant lender navigation when already rendered on that lender's page. */
  showLenderAction?: boolean;
  logoRenderStateId?: string;
  onLogoRenderStateChange?: (id: string, state: LogoRenderState) => void;
  comparisonUnverified?: boolean;
  /** Pricing assumptions supplied by the ephemeral comparison surface. */
  rateScenario?: RateScenario;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  // Lists use 16dp gutters. Start with that width so the first matching native
  // measurement does not render every visible card a second time.
  const [measuredWidth, setMeasuredWidth] = React.useState(() => width - 32);
  const [rowHeight, setRowHeight] = React.useState<number>(COMPACT_ROW.minHeight);
  const detailsBubble = useWordBubble('Details');
  const historyBubble = useWordBubble('History');
  const held = React.useRef(false);
  const historyHeld = React.useRef(false);
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const profile = useStore(state => state.prefs.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const boundRow = React.useMemo(() => bindCurrentPublicRow(row, catalogue), [row, catalogue]);
  const resolution = React.useMemo(() => resolveRowPublicRate(boundRow, catalogue, rateScenario ?? publicRateScenario(section, undefined, profile, boundRow, 'published')), [boundRow, catalogue, section, profile, rateScenario]);
  const favorite = useStore(state => state.isRateSaved(row.product_key, row.rate_index ?? null, boundRow.public_offer_id));
  const admittedConditions = React.useMemo(() => scopedRateConditions(sourceRowForPublicRow(row), section, { core, details, manifest, coreIntegrity }),
    [row, section, core, details, manifest, coreIntegrity]);
  const conditions = React.useMemo(() => scopedFinancialConditionFacts(admittedConditions), [admittedConditions]);
  const nonStandard = React.useMemo(() => isNonStandard(row), [row]);
  const qualifier = React.useMemo(() => rateQualifier(row, section), [row, section]);
  const access = React.useMemo(
    () => assessAccess(row.product_name, detail, row.provider),
    [row.product_name, row.provider, detail],
  );
  const tags = React.useMemo(() => chips(row, section, qualifier.conditional, conditions),
    [row, section, qualifier.conditional, conditions]);
  const presentation = React.useMemo(() => ratePresentation(row, section, mortgageRateMetric),
    [row, section, mortgageRateMetric]);
  const hasDisplayedRateOverride = displayedRate !== undefined;
  const rateLabel = hasDisplayedRateOverride
    ? displayedRateLabel ?? presentation.primaryLabel
    : resolution ? publicRateOriginLabel(resolution) : presentation.primaryLabel;
  const rateValue = hasDisplayedRateOverride ? displayedRate : presentation.primary;
  const rateText = !hasDisplayedRateOverride && resolution ? publicRateText(resolution) : formatRate(rateValue);
  const showingComparisonRate = rateLabel === 'Comparison rate';
  const secondaryRate = section === 'Mortgage'
    ? showingComparisonRate
      ? toFraction(row.rate)
      : toFraction(row.comparison_rate)
    : presentation.secondary;
  const secondaryLabel = section === 'Mortgage'
    ? showingComparisonRate
      ? 'Advertised rate'
      : 'Comparison rate'
    : presentation.secondaryLabel;
  const secondaryText = secondaryLabel ? formatRate(secondaryRate) : null;
  const metadata = [
    ...(secondaryLabel
      ? [uiJoin(secondaryLabel, ' ', secondaryRate === null ? uiLabel('Unknown') : formatRate(secondaryRate))]
      : []),
    ...tags,
  ];
  const rateChange = useProductRateChangeSummary(row.product_key);
  const rateChangeText = productRateChangeText(rateChange, true);
  const freshnessLabel = ({ current: 'Current', overdue: 'Overdue', stale: 'Stale', unknown: 'Unknown' } as const)
    [rateFreshness(row, rowVerificationReceipt(row), Date.now())];
  const openLender = onLongPress ?? (() => openBank(row.provider, { section }));
  const joinFacts = (facts: readonly UiText[]) => uiJoin(...facts.flatMap((fact, index) => index ? [uiLabel(' · '), fact] : [fact]));
  const cardA11yLabel = uiJoin(uiProductName(row), ', ', uiProviderName(row), ', ', rateLabel, ' ', rateText,
    metadata.length ? uiJoin(', ', joinFacts(metadata)) : null,
    access.badge ? uiJoin(', ', uiAccessBadge(access)) : null,
    nonStandard ? uiJoin(', ', 'Non-standard') : null,
    qualifier.conditional ? uiJoin(', ', qualifier.label) : null,
    rateChangeText ? uiJoin(', ', rateChangeText) : null,
    comparisonUnverified ? uiJoin(', ', 'Eligibility unverified') : null,
    uiJoin(', ', 'Freshness', ' · ', freshnessLabel));
  const saveIdentity = React.useMemo(() => productSaveIdentity(row, section, mortgageRateMetric,
    { core, details, manifest, coreIntegrity },
    hasDisplayedRateOverride ? { label: rateLabel, value: displayedRate ?? null } : undefined),
  [row, section, mortgageRateMetric, core, details, manifest, coreIntegrity, hasDisplayedRateOverride, rateLabel, displayedRate]);
  const saveA11yLabel = uiJoin(Number.isInteger(row.rate_index)
    ? favorite ? 'Remove' : 'Save'
    : favorite ? 'Remove all rates' : 'Save all rates',
    ', ', saveIdentity.name);

  const facet = React.useMemo(() => compactProductFacet(row, section, conditions), [row, section, conditions]);
  const unknown = comparisonUnverified || !facet.known || qualifier.facts.some(fact => 'state' in fact && fact.state === 'unknown');
  const statusIcons: (keyof typeof Ionicons.glyphMap)[] = [
    ...(qualifier.conditional ? ['flash-outline' as const] : []),
    ...(unknown ? ['help-circle-outline' as const] : []),
    ...(conditions.unresolved.length ? ['warning-outline' as const]
      : access.restricted || access.verify || nonStandard ? ['people-outline' as const] : []),
  ];
  const tierIndex = compactTierIndex(row);
  const logoFrame = compactBankLogoFrame(measuredWidth, rowHeight, fontScale, embedded ? 0 : StyleSheet.hairlineWidth);
  const onRowLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Number.isFinite(next) && next > 0 && next !== measuredWidth) setMeasuredWidth(next);
  };
  const metricIcon = (label: UiCopy): keyof typeof Ionicons.glyphMap => label === 'Comparison rate' ? 'calculator-outline'
    : label === 'Ongoing rate' ? 'time' : 'cash-outline';
  const metricWord = (label: UiCopy | null): IconWord => label === 'Comparison rate' ? 'Comparison'
    : label === 'Advertised rate' ? 'Advertised' : label === 'Ongoing rate' ? 'Ongoing'
      : label === 'Bonus rate' || label === 'Bonus' ? 'Bonus'
        : label === 'Rate' && section === 'Savings' && qualifier.kind === 'base' ? 'Ongoing' : 'Details';
  const metricColor = (label: UiCopy) => label === 'Comparison rate' ? theme.colors.primary : theme.colors.success;
  const facetIcon = facet.kind === 'LVR' ? 'home' : facet.kind === 'Term' ? 'calendar-outline' : 'wallet';
  const statusWord = (icon: keyof typeof Ionicons.glyphMap): IconWord => icon === 'help-circle-outline' ? 'Unknown'
    : icon === 'flash-outline' ? 'Conditional' : icon === 'people-outline' ? 'Eligibility'
      : conditions.unresolved.length ? 'Sources' : access.restricted || access.verify || nonStandard ? 'Eligibility'
        : qualifier.conditional ? 'Conditional' : 'Details';
  const geometryKey = JSON.stringify([row.product_key, row.rate_index, fontScale, facet.kind, facet.value,
    rateLabel, secondaryLabel, statusIcons, tierIndex !== null]);
  type RegionRect = { x: number; y: number; width: number; height: number };
  const bubbleRegions = React.useRef<{ key: string; regions: Record<string, RegionRect> }>({ key: geometryKey, regions: {} });
  const mainBounds = React.useRef<{ width: number; height: number } | null>(null);
  if (bubbleRegions.current.key !== geometryKey) bubbleRegions.current = { key: geometryKey, regions: {} };
  const recordRegion = (id: string) => (event: LayoutChangeEvent) => {
    if (bubbleRegions.current.key !== geometryKey) return;
    const { x, y, width: regionWidth, height: regionHeight } = event.nativeEvent.layout;
    if (Number.isFinite(x) && x >= 0 && Number.isFinite(y) && y >= 0
      && Number.isFinite(regionWidth) && regionWidth > 0 && Number.isFinite(regionHeight) && regionHeight > 0)
      bubbleRegions.current.regions[id] = { x, y, width: regionWidth, height: regionHeight };
    else delete bubbleRegions.current.regions[id];
  };
  const showRowWord = (event?: GestureResponderEvent) => {
    held.current = true;
    const { locationX: x, locationY: y } = event?.nativeEvent ?? {};
    const bounds = mainBounds.current;
    let word: IconWord = 'Details';
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
      && bounds && x >= 0 && x < bounds.width && y >= 0 && y < bounds.height
      && bubbleRegions.current.key === geometryKey) {
      const regions = bubbleRegions.current.regions;
      const candidates: { id: string; parents?: string[]; word: IconWord }[] = [
        { id: 'name', word: 'Details' },
        { id: 'primary', parents: ['line2', 'metrics'], word: metricWord(rateLabel) },
        ...(secondaryText ? [{ id: 'secondary', parents: ['line2', 'metrics'], word: metricWord(secondaryLabel) }] : []),
        { id: 'facet', parents: ['line2', 'facts'], word: facet.kind },
        ...statusIcons.map((icon, index) => ({ id: `status:${index}`, parents: ['line2', 'facts'], word: statusWord(icon) })),
        ...(tierIndex ? [{ id: 'tier', parents: ['line2', 'facts'], word: 'Tier' as const }] : []),
      ];
      for (const candidate of candidates) {
        const region = regions[candidate.id];
        if (!region) continue;
        let offsetX = 0;
        let offsetY = 0;
        let valid = true;
        for (const parentId of candidate.parents ?? []) {
          const parent = regions[parentId];
          if (!parent) { valid = false; break; }
          offsetX += parent.x;
          offsetY += parent.y;
        }
        if (!valid) continue;
        const left = offsetX + region.x;
        const top = offsetY + region.y;
        if (x >= left && x < left + region.width && y >= top && y < top + region.height) {
          word = candidate.word;
          break;
        }
      }
    }
    detailsBubble.show(word);
  };

  return (
    <View testID="compact-product-row" onLayout={onRowLayout}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: COMPACT_ROW.minHeight,
        gap: COMPACT_ROW.gap,
        paddingVertical: logoFrame.inset,
        paddingHorizontal: 0,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        borderBottomWidth: embedded ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.ledger.rule,
      }}
    >
      {showLenderAction || selectMode ? (
        <View ref={historyBubble.anchorRef} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: COMPACT_ROW.gap, alignSelf: 'stretch' }}>
          <PressFeedback onPressIn={() => { historyHeld.current = false; }}
            onLongPress={selectMode ? undefined : () => { historyHeld.current = true; historyBubble.show(); }} delayLongPress={350}
            onPress={() => {
              if (selectMode) { onPress?.(); return; }
              if (!historyHeld.current) { historyBubble.dismiss(); openLender(); } historyHeld.current = false;
            }}
            disabled={false} accessibilityRole="button"
            accessibilityLabel={uiJoin('View', ' ', uiProviderName(row), ' · ', 'History', ' · ', 'Freshness', ' · ', freshnessLabel)}
            accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}
            style={{ width: selectMode ? COMPACT_ROW.action : logoFrame.width, alignSelf: 'stretch', minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.sm }}>
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
              {selectMode ? <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primary} />
                : <><BankAvatar width={Math.max(0, logoFrame.width - 16)} height={logoFrame.height} inset={3} provider={row.provider} renderStateId={logoRenderStateId} onRenderStateChange={onLogoRenderStateChange} /><RateFreshnessSymbol row={row} palette={theme.colors} /></>}
            </View>
          </PressFeedback>
          {selectMode && showLenderAction ? (
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BankAvatar width={Math.max(0, logoFrame.width - 16)} height={logoFrame.height} inset={3} provider={row.provider} renderStateId={logoRenderStateId} onRenderStateChange={onLogoRenderStateChange} />
              <RateFreshnessSymbol row={row} palette={theme.colors} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View ref={detailsBubble.anchorRef} collapsable={false} style={{ flex: 1, minWidth: 0 }}>
        <PressFeedback
          onPressIn={() => { held.current = false; }}
          onPress={() => { if (!held.current) { detailsBubble.dismiss(); onPress?.(); } held.current = false; }}
          onLongPress={showRowWord}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={cardA11yLabel}
          accessibilityState={selectMode ? { selected: !!selected } : undefined}
          android_ripple={androidRipple(theme.colors.primaryMuted)}
          contentStyle={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4 }}
          style={{
            minHeight: 48,
            minWidth: 48,
            width: '100%',
            justifyContent: 'center',
            borderRadius: theme.radius.sm,
            overflow: 'hidden',
          }}
          onLayout={event => {
            const { width: targetWidth, height: targetHeight } = event.nativeEvent.layout;
            mainBounds.current = Number.isFinite(targetWidth) && targetWidth > 0 && Number.isFinite(targetHeight) && targetHeight > 0
              ? { width: targetWidth, height: targetHeight } : null;
            // Measure content independently: a logo measured from the whole row
            // would preserve its previous height after large text shrinks again.
            if (Number.isFinite(targetHeight) && targetHeight > 0) {
              const height = Math.max(COMPACT_ROW.minHeight,
                targetHeight + 2 * logoFrame.inset + (embedded ? 0 : StyleSheet.hairlineWidth));
              if (height !== rowHeight) setRowHeight(height);
            }
          }}
        >
          <AppText testID="compact-product-name" variant="small" weight="600" numberOfLines={2}
            onLayout={recordRegion('name')} style={{ flexShrink: 1 }}>{uiProductName(row)}</AppText>
          <View key={geometryKey} testID="compact-product-line2" pointerEvents="none" accessible={false}
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            onLayout={recordRegion('line2')}
            style={{ flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%', alignItems: 'center', gap: 6 }}>
            <View testID="compact-product-metrics" onLayout={recordRegion('metrics')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%', alignItems: 'center', gap: 6 }}>
              <View testID="compact-primary-cell" onLayout={recordRegion('primary')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name={metricIcon(rateLabel)} size={COMPACT_ROW.icon} color={metricColor(rateLabel)} />
                <AppText testID="compact-primary-rate" variant="small" weight="700"
                  style={{ fontVariant: ['tabular-nums'] }}>{rateText}</AppText>
              </View>
              {secondaryText ? <View testID="compact-secondary-cell" onLayout={recordRegion('secondary')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name={metricIcon(secondaryLabel!)} size={COMPACT_ROW.icon} color={metricColor(secondaryLabel!)} />
                <AppText testID="compact-secondary-rate" variant="small" color="textMuted"
                  style={{ fontVariant: ['tabular-nums'] }}>{secondaryText}</AppText>
              </View> : null}
            </View>
            <View testID="compact-product-facts" onLayout={recordRegion('facts')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <View testID="compact-facet-cell" onLayout={recordRegion('facet')} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons testID="compact-facet-symbol" name={facetIcon} size={COMPACT_ROW.icon} color={theme.colors.primary} />
                <AppText testID="compact-facet-value" variant="small" color="textMuted">{facet.value}</AppText>
              </View>
              {statusIcons.map((icon, index) => <Ionicons key={`${icon}:${index}`} testID={`compact-status-${index}`} onLayout={recordRegion(`status:${index}`)} name={icon} size={COMPACT_ROW.icon} color={theme.colors.warning} />)}
              {tierIndex ? <View testID="compact-tier-cell" onLayout={recordRegion('tier')} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="layers-outline" size={COMPACT_ROW.icon} color={theme.colors.textMuted} />
                <AppText testID="compact-tier-index" variant="small" color="textMuted">{tierIndex}</AppText>
              </View> : null}
            </View>
          </View>
        </PressFeedback>
      </View>
      <View style={{ width: 48, opacity: selectMode ? 0 : 1 }} pointerEvents={selectMode ? 'none' : 'auto'}
        accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}>
        <IconAction icon={favorite ? 'star' : 'star-outline'} word={favorite ? 'Remove' : 'Save'}
          onPress={() => toggleSavedRate(boundRow, boundRow.public_offer_id || Number.isInteger(row.rate_index) ? 'rate' : 'product')}
          disabled={!!selectMode} active={favorite} accessibilityLabel={saveA11yLabel}
          testID={saveIdentity.testID} accessibilityState={{ selected: favorite }} style={{ width: 48 }} />
      </View>
      {detailsBubble.overlay}
      {historyBubble.overlay}
    </View>
  );
}

// Navigation and readiness updates in the containing list leave this row
// unchanged. Its store, theme and dimension subscriptions remain live.
export const ProductCard = React.memo(ProductCardView);
