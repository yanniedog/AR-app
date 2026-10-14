import Ionicons from './icons/AppIcon';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

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
  ProductRateChangeSummaryLine,
  productRateChangeText,
  useProductRateChangeSummary,
} from './product/ProductRateChangeLine';
import { androidRipple, AppText, Row } from './ui';
import { PressFeedback } from './PressFeedback';
import { scopedRateConditions } from '../data/rateConditions';
import { scopedFinancialConditionFacts, type ScopedFinancialConditionPresentation } from '../data/scopedFinancialConditionFacts';
import { uiAccessBadge, uiConditionTag, uiListedLvr } from '../lib/financialUiCopy';
import { uiJoin, uiLabel, uiProductName, uiProviderName, type UiCopy, type UiText } from '../lib/uiCopy';

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
    if (row.loan_purpose) out.push(humanizeEnum(row.loan_purpose));
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

const COMPACT_METRIC_LABELS: Readonly<Record<string, UiCopy>> = {
  'Comparison rate': 'Comparison',
  'Advertised rate': 'Advertised',
  'Ongoing rate': 'Ongoing',
};

function ProductCardView({
  row,
  section,
  onPress,
  onLongPress,
  selectMode,
  selected,
  embedded = false,
  heroRate = false,
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
  const compact = width < 340 || fontScale >= 1.3;
  const textLines = fontScale >= 1.3 ? undefined : 2;
  const favorite = useStore((s) => s.isRateSaved(row.product_key, row.rate_index ?? null));
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const conditions = React.useMemo(() => scopedFinancialConditionFacts(scopedRateConditions(row, section, { core, details, manifest, coreIntegrity })),
    [row, section, core, details, manifest, coreIntegrity]);
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
      : secondaryRate !== null
        ? 'Comparison rate'
        : null
    : presentation.secondaryLabel;
  const visibleRateLabel = COMPACT_METRIC_LABELS[rateLabel] ?? rateLabel;
  const metadata = [
    ...(secondaryRate !== null && secondaryLabel
      ? [uiJoin(COMPACT_METRIC_LABELS[secondaryLabel] ?? secondaryLabel, ' ', formatRate(secondaryRate))]
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

  return (
    // Card container is a plain View; the nav target and the favorite star are
    // SEPARATE press targets so tapping the star never also opens the product.
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: embedded ? 0 : 12,
        paddingHorizontal: 0,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        borderBottomWidth: embedded ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.ledger.rule,
      }}
    >
      <PressFeedback
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={onLongPress ? 450 : undefined}
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
        accessibilityState={selectMode ? { selected: !!selected } : undefined}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        contentStyle={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 4 }}
        style={{
          flex: 1,
          minHeight: 48,
          alignItems: 'stretch',
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'flex-start', gap: 12 }}>
        <View style={{ flex: compact ? undefined : 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ width: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
          {selectMode ? (
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={24}
              color={selected ? theme.colors.primary : theme.colors.textFaint}
            />
          ) : (
            <BankAvatar
              size={32}
              provider={row.provider}
              renderStateId={logoRenderStateId}
              onRenderStateChange={onLogoRenderStateChange}
            />
          )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="body" weight="600" numberOfLines={textLines}>
              {uiProductName(row)}
            </AppText>
            <AppText variant="small" color="textMuted" numberOfLines={fontScale >= 1.3 ? undefined : 1}>
              {uiProviderName(row)}
            </AppText>
          </View>
        </View>

        <View
          style={{
            alignItems: compact ? 'flex-start' : 'flex-end',
            justifyContent: 'center',
            gap: 4,
            width: compact ? undefined : heroRate ? 120 : 96,
            maxWidth: compact ? undefined : '45%',
            paddingLeft: 0,
          }}
        >
          <AppText variant="tiny" color="textMuted" style={{ textAlign: compact ? 'left' : 'right' }}>
            {visibleRateLabel}
          </AppText>
          <AppText
            variant={heroRate ? 'rateHero' : 'rate'}
            color="text"
          >
            {rateText}
          </AppText>
        </View>
        </View>
        {metadata.length || qualifier.conditional || nonStandard || access.badge ? (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {metadata.length ? <AppText variant="small" color="textMuted" style={{ flexShrink: 1 }}>{joinFacts(metadata)}</AppText> : null}
            {access.badge ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">{uiAccessBadge(access)}</AppText> : null}
            {qualifier.conditional ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">{qualifier.shortLabel}</AppText> : null}
            {nonStandard ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">{uiLabel("Non-standard")}</AppText> : null}
          </Row>
        ) : null}
        <ProductRateChangeSummaryLine model={rateChange} section={section} compact />
      </PressFeedback>

        <View style={{ width: 48, alignItems: 'center', opacity: selectMode ? 0 : 1 }} pointerEvents={selectMode ? 'none' : 'auto'} accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}>
          {showLenderAction ? (
            <PressFeedback
              onPress={openLender}
              disabled={!!selectMode}
              accessibilityRole="button"
              accessibilityLabel={uiJoin('View', ' ', uiProviderName(row), ' · ', 'History')}
              android_ripple={androidRipple(theme.colors.primaryMuted, true)}
              style={{
                width: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                overflow: 'hidden',
              }}
            >
              <Ionicons name="business-outline" size={19} color={theme.colors.textFaint} />
            </PressFeedback>
          ) : null}
          <PressFeedback
            onPress={() => toggleSavedRate(row, Number.isInteger(row.rate_index) ? 'rate' : 'product')}
            disabled={!!selectMode}
            accessibilityRole="button"
            accessibilityLabel={favorite
              ? 'Remove'
              : Number.isInteger(row.rate_index)
                ? 'Save'
                : 'Save'}
            accessibilityState={{ selected: favorite }}
            android_ripple={androidRipple(theme.colors.primaryMuted, true)}
            style={{
              width: 48,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.sm,
              overflow: 'hidden',
            }}
          >
            <Ionicons
              name={favorite ? 'star' : 'star-outline'}
              size={20}
              color={favorite ? theme.colors.primary : theme.colors.textFaint}
            />
          </PressFeedback>
        </View>
    </View>
  );
}

// Navigation and readiness updates in the containing list leave this row
// unchanged. Its store, theme and dimension subscriptions remain live.
export const ProductCard = React.memo(ProductCardView);
