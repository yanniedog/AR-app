import Ionicons from './icons/AppIcon';
import React from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type TextLayoutEventData, type NativeSyntheticEvent } from 'react-native';

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
import {
  productRateChangeText,
  useProductRateChangeSummary,
} from './product/ProductRateChangeLine';
import { androidRipple, AppText } from './ui';
import { PressFeedback } from './PressFeedback';
import { IconAction } from './IconAction';
import { useWordBubble } from './WordBubble';
import { COMPACT_ROW, compactFactWidth, compactMetricHasPeers, compactProductFacet, compactProductRowLayout, compactTierIndex } from './product/compactProductRow';
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
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = React.useState<number | null>(null);
  const [textMeasurements, setTextMeasurements] = React.useState<{ key: string; primary: number; secondary: number } | null>(null);
  const detailsBubble = useWordBubble('Details');
  const historyBubble = useWordBubble('History');
  const held = React.useRef(false);
  const historyHeld = React.useRef(false);
  const favorite = useStore((s) => s.isRateSaved(row.product_key, row.rate_index ?? null));
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const admittedConditions = React.useMemo(() => scopedRateConditions(row, section, { core, details, manifest, coreIntegrity }),
    [row, section, core, details, manifest, coreIntegrity]);
  const conditions = React.useMemo(() => scopedFinancialConditionFacts(admittedConditions), [admittedConditions]);
  const nonStandard = isNonStandard(row);
  const qualifier = rateQualifier(row, section);
  const access = React.useMemo(
    () => assessAccess(row.product_name, detail, row.provider),
    [row.product_name, row.provider, detail],
  );
  const tags = chips(row, section, qualifier.conditional, conditions);
  const presentation = ratePresentation(row, section, mortgageRateMetric);
  const hasDisplayedRateOverride = displayedRate !== undefined;
  const rateLabel = hasDisplayedRateOverride
    ? displayedRateLabel ?? presentation.primaryLabel
    : presentation.primaryLabel;
  const rateValue = hasDisplayedRateOverride ? displayedRate : presentation.primary;
  const rateText = formatRate(rateValue);
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
  const openLender = onLongPress ?? (() => openBank(row.provider, { section }));
  const joinFacts = (facts: readonly UiText[]) => uiJoin(...facts.flatMap((fact, index) => index ? [uiLabel(' · '), fact] : [fact]));
  const cardA11yLabel = uiJoin(uiProductName(row), ', ', uiProviderName(row), ', ', rateLabel, ' ', rateText,
    metadata.length ? uiJoin(', ', joinFacts(metadata)) : null,
    access.badge ? uiJoin(', ', uiAccessBadge(access)) : null,
    nonStandard ? uiJoin(', ', 'Non-standard') : null,
    qualifier.conditional ? uiJoin(', ', qualifier.label) : null,
    rateChangeText ? uiJoin(', ', rateChangeText) : null);
  const saveIdentity = React.useMemo(() => productSaveIdentity(row, section, mortgageRateMetric,
    { core, details, manifest, coreIntegrity },
    hasDisplayedRateOverride ? { label: rateLabel, value: displayedRate ?? null } : undefined),
  [row, section, mortgageRateMetric, core, details, manifest, coreIntegrity, hasDisplayedRateOverride, rateLabel, displayedRate]);
  const saveA11yLabel = uiJoin(Number.isInteger(row.rate_index)
    ? favorite ? 'Remove' : 'Save'
    : favorite ? 'Remove all rates' : 'Save all rates',
    ', ', saveIdentity.name);

  const facet = compactProductFacet(row, section, conditions);
  const unknown = !facet.known || qualifier.facts.some(fact => 'state' in fact && fact.state === 'unknown');
  const statusIcons: (keyof typeof Ionicons.glyphMap)[] = [
    ...(qualifier.conditional ? ['flash-outline' as const] : []),
    ...(unknown ? ['help-circle-outline' as const] : []),
    ...(conditions.unresolved.length ? ['warning-outline' as const]
      : access.restricted || access.verify || nonStandard ? ['people-outline' as const] : []),
  ];
  const measurementKey = `${fontScale}:${rateText}:${secondaryText ?? ''}`;
  const measurements = textMeasurements?.key === measurementKey ? textMeasurements : null;
  const tierIndex = compactTierIndex(row);
  const hasMetricPeers = compactMetricHasPeers(row, core?.sections[section]?.rates, rateLabel);
  const layout = compactProductRowLayout(measuredWidth ?? width - 32, fontScale, rateText, secondaryText,
    facet, statusIcons.length, measurements?.primary, measurements?.secondary, tierIndex, hasMetricPeers);
  const onRowLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  };
  const measureMetric = (key: 'primary' | 'secondary') => (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const actual = event.nativeEvent.lines[0]?.width ?? 0;
    const estimated = compactFactWidth(key === 'primary' ? rateText : secondaryText ?? uiLabel(''), fontScale);
    if (actual <= estimated) return;
    setTextMeasurements(previous => {
      const current = previous?.key === measurementKey ? previous : { key: measurementKey, primary: 0, secondary: 0 };
      return current[key] >= actual ? previous : { ...current, [key]: Math.ceil(actual) };
    });
  };
  const metricIcon = (label: UiCopy): keyof typeof Ionicons.glyphMap => label === 'Comparison rate' ? 'git-compare-outline'
    : label === 'Ongoing rate' ? 'time' : 'cash-outline';

  return (
    <View testID="compact-product-row" onLayout={onRowLayout}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: COMPACT_ROW.minHeight,
        gap: COMPACT_ROW.gap,
        paddingVertical: 4,
        paddingHorizontal: 0,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        borderBottomWidth: embedded ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.ledger.rule,
      }}
    >
      <View ref={historyBubble.anchorRef} collapsable={false} style={{ width: 48 }}>
        {showLenderAction || selectMode ? (
          <PressFeedback onPressIn={() => { historyHeld.current = false; }}
            onLongPress={selectMode ? undefined : () => { historyHeld.current = true; historyBubble.show(); }} delayLongPress={350}
            onPress={() => {
              if (selectMode) { onPress?.(); return; }
              if (!historyHeld.current) { historyBubble.dismiss(); openLender(); } historyHeld.current = false;
            }}
            disabled={false} accessibilityRole="button"
            accessibilityLabel={uiJoin('View', ' ', uiProviderName(row), ' · ', 'History')}
            accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}
            style={{ width: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.sm }}>
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {selectMode ? <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primary} />
                : <BankAvatar size={24} provider={row.provider} renderStateId={logoRenderStateId} onRenderStateChange={onLogoRenderStateChange} />}
            </View>
          </PressFeedback>
        ) : <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          {selectMode ? <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primary} />
            : <BankAvatar size={24} provider={row.provider} renderStateId={logoRenderStateId} onRenderStateChange={onLogoRenderStateChange} />}
        </View>}
      </View>
      <View ref={detailsBubble.anchorRef} collapsable={false} style={{ flex: 1, minWidth: 0 }}>
      <PressFeedback
        onPressIn={() => { held.current = false; }}
        onPress={() => { if (!held.current) { detailsBubble.dismiss(); onPress?.(); } held.current = false; }}
        onLongPress={() => { held.current = true; detailsBubble.show(); }}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
        accessibilityState={selectMode ? { selected: !!selected } : undefined}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: COMPACT_ROW.gap }}
        style={{
          minHeight: 48,
          minWidth: 48,
          alignItems: 'center',
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
        }}
      >
        <AppText testID="compact-product-name" variant="small" weight="600" numberOfLines={1} ellipsizeMode="tail"
          style={{ width: layout.identity, minWidth: 0, flexShrink: 1 }}>{uiProductName(row)}</AppText>
        <View testID="compact-product-metrics" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', alignItems: 'center', gap: COMPACT_ROW.gap, flexShrink: 0 }}>
          <View style={{ width: layout.primary, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {layout.warningOnly ? <Ionicons name="warning-outline" size={16} color={theme.colors.warning} /> : <>
            {layout.showPrimaryIcon ? <Ionicons name={metricIcon(rateLabel)} size={COMPACT_ROW.icon} color={theme.colors.textMuted} /> : null}
            <AppText testID="compact-primary-rate" variant="small" weight="600" onTextLayout={measureMetric('primary')}
              style={{ fontVariant: ['tabular-nums'], flexShrink: 0 }}>{rateText}</AppText>
            </>}
          </View>
          {layout.showSecondary && secondaryText ? <View style={{ width: layout.secondary, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name={metricIcon(secondaryLabel!)} size={COMPACT_ROW.icon} color={theme.colors.textMuted} />
            <AppText testID="compact-secondary-rate" variant="small" color="textMuted" onTextLayout={measureMetric('secondary')}
              style={{ fontVariant: ['tabular-nums'], flexShrink: 0 }}>{secondaryText}</AppText>
          </View> : null}
        </View>
        <View testID="compact-product-facts" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: layout.facet, flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {layout.showFacetValue ? <AppText variant="small" color="textMuted" style={{ flexShrink: 0 }}>{facet.value}</AppText>
            : layout.showFacetSymbol ? facet.kind === 'LVR' ? <AppText variant="small" color="textMuted">{uiLabel('%')}</AppText>
              : <Ionicons name={facet.kind === 'Term' ? 'time' : 'cash-outline'} size={COMPACT_ROW.icon} color={theme.colors.textMuted} /> : null}
          {!layout.warningOnly ? (layout.combinedStatus && statusIcons.length ? [unknown ? 'help-circle-outline' as const : 'warning-outline' as const] : statusIcons)
            .map((icon, index) => <Ionicons key={`${icon}:${index}`} name={icon} size={COMPACT_ROW.icon} color={theme.colors.warning} />) : null}
          {layout.showTier ? <AppText testID="compact-tier-index" variant="small" color="textMuted" style={{ flexShrink: 0 }}>{tierIndex}</AppText> : null}
        </View>
      </PressFeedback>
      </View>
      <View style={{ width: 48, opacity: selectMode ? 0 : 1 }} pointerEvents={selectMode ? 'none' : 'auto'}
        accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}>
        <IconAction icon={favorite ? 'star' : 'star-outline'} word={favorite ? 'Remove' : 'Save'}
          onPress={() => toggleSavedRate(row, Number.isInteger(row.rate_index) ? 'rate' : 'product')}
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
