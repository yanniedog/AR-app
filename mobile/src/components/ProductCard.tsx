import Ionicons from './icons/AppIcon';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

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

function chips(row: RateRow, section: SectionKey, qualifier: RateQualifier): string[] {
  const out: string[] = [];
  if (section === 'Mortgage') {
    if (row.ribbon_rate_structure) out.push(humanizeEnum(row.ribbon_rate_structure));
    const term = formatTerm(row);
    if (term) out.push(term);
    if (row.ribbon_repayment_type ?? row.repayment_type)
      out.push(humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    if (row.lvr_tier) out.push(humanizeEnum(row.lvr_tier));
  } else if (section === 'TD') {
    const term = formatTerm(row);
    if (term) out.push(term);
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) out.push(bal);
  } else {
    // Conditional rates have their own caution label below. Reuse the central
    // classifier so the caption and caution label can never disagree.
    if (row.ribbon_deposit_kind && !qualifier.conditional) {
      out.push(humanizeEnum(row.ribbon_deposit_kind));
    }
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) out.push(bal);
  }
  return out.slice(0, 2);
}

export function ProductCard({
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
  const compact = width < 480 || fontScale >= 1.3;
  const textLines = fontScale >= 1.3 ? undefined : 2;
  const favorite = useStore((s) => s.isRateSaved(row.product_key, row.rate_index ?? null));
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
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
  const rateChange = useProductRateChangeSummary(row.product_key);
  const rateChangeText = productRateChangeText(rateChange, true);
  const openLender = onLongPress ?? (() => openBank(row.provider, { section }));
  const cardA11yLabel = `${row.product_name}, ${row.provider}, ${rateLabel} ${rateText}${
    secondaryRate !== null && secondaryLabel
      ? `, ${secondaryLabel.toLowerCase()} ${formatRate(secondaryRate)}`
      : ''
  }${qualifier.conditional ? `, ${qualifier.label}, conditions apply` : ''}${
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
        paddingVertical: embedded ? 0 : 20,
        paddingHorizontal: selected ? 12 : 0,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        borderBottomWidth: embedded ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.ledger.rule,
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={onLongPress ? 450 : undefined}
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
        accessibilityState={selectMode ? { selected: !!selected } : undefined}
        accessibilityHint={onLongPress ? 'Long press also opens this bank' : undefined}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 48,
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          gap: 12,
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
          {selectMode ? (
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={24}
              color={selected ? theme.colors.primary : theme.colors.textFaint}
            />
          ) : (
            <BankAvatar
              provider={row.provider}
              renderStateId={logoRenderStateId}
              onRenderStateChange={onLogoRenderStateChange}
            />
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="body" weight="600" numberOfLines={textLines}>
              {row.product_name}
            </AppText>
            <AppText variant="small" color="textMuted" numberOfLines={fontScale >= 1.3 ? undefined : 1}>
              {row.provider}
            </AppText>
            <ProductRateChangeSummaryLine summary={rateChange} section={section} compact />
            {tags.length || qualifier.conditional || nonStandard || access.badge ? (
              <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
                {access.badge ? (
                  <AppText variant="tiny" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="600">
                    {access.verify ? `${access.badge}?` : access.badge}
                  </AppText>
                ) : null}
                {tags.length ? (
                  <AppText variant="tiny" color="textMuted" style={{ flexShrink: 1 }}>{tags.join(' · ')}</AppText>
                ) : null}
                {qualifier.conditional ? (
                  <AppText variant="tiny" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="600">
                    {qualifier.shortLabel}
                  </AppText>
                ) : null}
                {nonStandard ? (
                  <AppText variant="tiny" style={{ color: theme.colors.warning, flexShrink: 1 }} weight="600">
                    Special eligibility
                  </AppText>
                ) : null}
              </Row>
            ) : null}
          </View>
        </View>

        <View
          style={{
            alignItems: compact ? 'flex-start' : 'flex-end',
            justifyContent: 'center',
            gap: 4,
            minWidth: compact ? 0 : 76,
            marginTop: compact ? 4 : 0,
            paddingLeft: 0,
          }}
        >
          <AppText variant="tiny" color="textFaint" numberOfLines={fontScale >= 1.3 ? undefined : 1}>
            {rateLabel}
          </AppText>
          <AppText
            variant={heroRate ? 'rateHero' : 'rate'}
            color="text"
          >
            {rateText}
          </AppText>
          {secondaryRate !== null && secondaryLabel ? (
            <AppText variant="tiny" color="textFaint" numberOfLines={fontScale >= 1.3 ? undefined : 1}>
              {formatRate(secondaryRate)} {secondaryLabel.toLowerCase()}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {!selectMode ? (
        <View style={{ width: 48, alignItems: 'center' }}>
          {showLenderAction ? (
            <Pressable
              onPress={openLender}
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
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => toggleSavedRate(row, Number.isInteger(row.rate_index) ? 'rate' : 'product')}
            accessibilityRole="button"
            accessibilityLabel={favorite
              ? 'Remove this rate from saved'
              : Number.isInteger(row.rate_index)
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
              color={favorite ? theme.colors.warning : theme.colors.textFaint}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
