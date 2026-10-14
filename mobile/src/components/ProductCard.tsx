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
import { useUserRateScenario } from '../hooks/useUserRateScenario';
import { assessAccess } from '../data/access';
import { ratePresentation } from '../data/ratePresentation';
import { usePublicRateCatalogue } from '../data/publicRateCatalogue';
import { bindCurrentPublicRow, publicRateScenario, resolveRowPublicRate } from '../data/publicRateIntegration';
import { publicRateOriginLabel, publicRateText } from '../data/publicRatePresentation';
import { rateQualifier, type RateQualifier } from '../lib/rateQualifier';
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
import { lvrTierDisplay } from '../data/lvrTier';
import { PressFeedback } from './PressFeedback';

function chips(row: RateRow, section: SectionKey, qualifier: RateQualifier): string[] {
  const out: string[] = [];
  if (section === 'Mortgage') {
    if (row.ribbon_rate_structure) out.push(humanizeEnum(row.ribbon_rate_structure));
    const term = formatTerm(row);
    if (term) out.push(term);
    if (row.ribbon_repayment_type ?? row.repayment_type)
      out.push(humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    if (row.loan_purpose) out.push(humanizeEnum(row.loan_purpose));
    if (row.lvr_tier) out.push(lvrTierDisplay(row.lvr_tier));
  } else if (section === 'TD') {
    const term = formatTerm(row);
    if (term) out.push(term);
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) out.push(bal);
    if (row.interest_payment) out.push(humanizeEnum(row.interest_payment));
  } else {
    // Conditional rates have their own caution label below. Reuse the central
    // classifier so the caption and caution label can never disagree.
    if (row.ribbon_deposit_kind && !qualifier.conditional) {
      out.push(humanizeEnum(row.ribbon_deposit_kind));
    }
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) out.push(bal);
    const term = formatTerm(row);
    if (term) out.push(term);
  }
  return [...new Set(out)];
}

const COMPACT_METRIC_LABELS: Readonly<Record<string, string>> = {
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
  displayedRateLabel?: string;
  /** Hide redundant lender navigation when already rendered on that lender's page. */
  showLenderAction?: boolean;
  logoRenderStateId?: string;
  onLogoRenderStateChange?: (id: string, state: LogoRenderState) => void;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 340 || fontScale >= 1.3;
  const textLines = fontScale >= 1.3 ? undefined : 2;
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const manifest = useStore((s) => s.manifest);
  const profile = useStore((s) => s.prefs?.profileFilters);
  const { scenario } = useUserRateScenario();
  const publicCatalogue = usePublicRateCatalogue(manifest);
  const publicProduct = publicCatalogue.getProduct(row.product_key);
  const publicResolution = resolveRowPublicRate(row, publicCatalogue, publicRateScenario(section, scenario, profile, row, 'published'));
  const boundRow = bindCurrentPublicRow(row, publicCatalogue);
  const favorite = useStore((s) => s.isRateSaved(row.product_key, row.rate_index ?? null, boundRow.public_offer_id));
  const nonStandard = isNonStandard(row);
  const qualifier = rateQualifier(row, section);
  const access = React.useMemo(
    () => assessAccess(row.product_name, detail, row.provider),
    [row.product_name, row.provider, detail],
  );
  const tags = chips(row, section, qualifier);
  const presentation = ratePresentation(row, section, mortgageRateMetric);
  const hasDisplayedRateOverride = displayedRate !== undefined;
  const rateLabel = hasDisplayedRateOverride
    ? displayedRateLabel ?? presentation.primaryLabel
    : presentation.primaryLabel;
  const rateValue = hasDisplayedRateOverride ? displayedRate : presentation.primary;
  const rateText = publicResolution && publicResolution.status !== 'exact' ? publicRateText(publicResolution)
    : publicResolution?.payableRate && !hasDisplayedRateOverride && rateLabel !== 'Comparison rate'
      ? publicRateText(publicResolution) : formatRate(rateValue);
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
      ? [`${COMPACT_METRIC_LABELS[secondaryLabel] ?? secondaryLabel} ${formatRate(secondaryRate)}`]
      : []),
    ...tags,
  ];
  const rateChange = useProductRateChangeSummary(row.product_key);
  const rateChangeText = productRateChangeText(rateChange, true);
  const openLender = onLongPress ?? (() => openBank(row.provider, { section }));
  const cardA11yLabel = `${row.product_name}, ${row.provider}, ${rateLabel} ${rateText}${
    secondaryRate !== null && secondaryLabel
      ? `, ${secondaryLabel.toLowerCase()} ${formatRate(secondaryRate)}`
      : ''
  }${tags.length ? `, ${tags.join(', ')}` : ''}${access.badge ? `, ${access.badge}${access.verify ? ' unverified' : ''}` : ''}${nonStandard ? ', Special eligibility' : ''}${qualifier.conditional ? `, ${qualifier.label}, conditions apply` : ''}${
    rateChangeText ? `, ${rateChangeText.replace('↑', 'up').replace('↓', 'down')}` : ''
  }`;

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
              {row.product_name}
            </AppText>
            <AppText variant="small" color="textMuted" numberOfLines={fontScale >= 1.3 ? undefined : 1}>
              {row.provider}
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
            {metadata.length ? <AppText variant="small" color="textMuted" style={{ flexShrink: 1 }}>{metadata.join(' · ')}</AppText> : null}
            {access.badge ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">{access.verify ? `${access.badge}?` : access.badge}</AppText> : null}
            {qualifier.conditional ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">{qualifier.shortLabel}</AppText> : null}
            {nonStandard ? <AppText variant="small" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="500">Special eligibility</AppText> : null}
          </Row>
        ) : null}
        <ProductRateChangeSummaryLine summary={rateChange} section={section} compact />
        {publicResolution ? <AppText variant="tiny" color="textMuted">
          {publicRateOriginLabel(publicResolution)}{publicResolution.freshness.lastSuccessAt ? ` · ${publicResolution.freshness.lastSuccessAt.slice(0, 10)}` : ''}
          {publicProduct?.status === 'legacy' ? ' · New applications: unavailable' : ''}
        </AppText> : null}
      </PressFeedback>

        <View style={{ width: 48, alignItems: 'center', opacity: selectMode ? 0 : 1 }} pointerEvents={selectMode ? 'none' : 'auto'} accessibilityElementsHidden={!!selectMode} importantForAccessibility={selectMode ? 'no-hide-descendants' : 'auto'}>
          {showLenderAction ? (
            <PressFeedback
              onPress={openLender}
              disabled={!!selectMode}
              accessibilityRole="button"
              accessibilityLabel={`View ${row.provider} bank history`}
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
            onPress={() => toggleSavedRate(boundRow, boundRow.public_offer_id || Number.isInteger(row.rate_index) ? 'rate' : 'product')}
            disabled={!!selectMode}
            accessibilityRole="button"
            accessibilityLabel={favorite
              ? 'Remove this rate from saved'
              : boundRow.public_offer_id || Number.isInteger(row.rate_index)
                ? 'Save this exact rate'
                : 'Save all product variants'}
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
