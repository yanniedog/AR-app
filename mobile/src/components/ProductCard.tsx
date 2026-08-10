import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { SECTIONS } from '../constants';
import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
  isNonStandard,
} from '../data/format';
import { useStore } from '../data/store';
import { assessAccess } from '../data/access';
import { rateValueLabel } from '../lib/a11ySummaries';
import { rateQualifier, type RateQualifier } from '../lib/rateQualifier';
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
    // Bonus / introductory deposit kinds are surfaced as a distinct warning
    // badge below, so don't also repeat them as a neutral chip. Reuse the
    // central classifier so the chip and the badge can never disagree.
    if (row.ribbon_deposit_kind && !qualifier.conditional) {
      out.push(humanizeEnum(row.ribbon_deposit_kind));
    }
    const bal = formatBalanceRange(row.balance_min, row.balance_max);
    if (bal) out.push(bal);
  }
  return out.slice(0, 3);
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
  logoRenderStateId?: string;
  onLogoRenderStateChange?: (id: string, state: LogoRenderState) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const favorite = useStore((s) => s.isRateSaved(row.product_key, row.rate_index ?? null));
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const detail = useStore((s) => s.details?.products[row.product_key] ?? null);
  const nonStandard = isNonStandard(row);
  const qualifier = rateQualifier(row, section);
  const access = React.useMemo(
    () => assessAccess(row.product_name, detail, row.provider),
    [row.product_name, row.provider, detail],
  );
  const tags = chips(row, section, qualifier);
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const rateLabel = displayedRateLabel ?? rateValueLabel(section);
  const rateText = formatRate(displayedRate ?? row.rate);
  const showingComparisonRate = displayedRateLabel === 'Comparison rate';
  const rateChange = useProductRateChangeSummary(row.product_key);
  const rateChangeText = productRateChangeText(rateChange, true);
  const cardA11yLabel = `${row.product_name}, ${row.provider}, ${rateLabel} ${rateText}${
    row.comparison_rate && !showingComparisonRate ? `, comparison ${formatRate(row.comparison_rate)}` : ''
  }${qualifier.conditional ? `, ${qualifier.label}, conditions apply` : ''}${
    rateChangeText ? `, ${rateChangeText.replace('↑', 'up').replace('↓', 'down')}` : ''
  }`;

  return (
    // Card container is a plain View; the nav target and the favorite star are
    // SEPARATE press targets so tapping the star never also opens the product.
    <View
      style={{
        flexDirection: 'row',
        alignItems: compact ? 'flex-start' : 'center',
        gap: 8,
        paddingVertical: embedded ? 0 : 12,
        paddingHorizontal: embedded ? 0 : 14,
        backgroundColor: selected ? theme.colors.primaryMuted : embedded ? 'transparent' : theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: embedded ? 0 : 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        marginBottom: embedded ? 0 : 10,
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={onLongPress ? 450 : undefined}
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
        accessibilityHint={onLongPress ? 'Long press to open lender profile' : undefined}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          gap: 12,
          borderRadius: theme.radius.md,
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
        <AppText variant="body" weight="700" numberOfLines={compact ? 2 : 1}>
          {row.product_name}
        </AppText>
        <AppText variant="small" color="textMuted" numberOfLines={1}>
          {row.provider}
        </AppText>
        <ProductRateChangeSummaryLine summary={rateChange} section={section} compact />
        {tags.length || qualifier.conditional || nonStandard || access.badge ? (
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {access.badge ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <AppText variant="tiny" style={{ color: theme.colors.warning }} weight="700">
                  {access.verify ? `${access.badge}?` : access.badge}
                </AppText>
              </View>
            ) : null}
            {tags.map((t, i) => (
              <View
                key={`${t}-${i}`}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.chip,
                }}
              >
                <AppText variant="tiny" color="chipText">
                  {t}
                </AppText>
              </View>
            ))}
            {qualifier.conditional ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <AppText variant="tiny" style={{ color: theme.colors.warning }} weight="700">
                  {qualifier.shortLabel}
                </AppText>
              </View>
            ) : null}
            {nonStandard ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.chip,
                }}
              >
                <AppText variant="tiny" style={{ color: theme.colors.warning }} weight="700">
                  Non-standard
                </AppText>
              </View>
            ) : null}
          </Row>
        ) : null}
          </View>
        </View>

        <View
          style={{
            alignItems: compact ? 'baseline' : 'flex-end',
            flexDirection: compact ? 'row' : 'column',
            justifyContent: compact ? 'flex-end' : 'center',
            gap: compact ? 6 : 0,
            minWidth: compact ? 0 : 76,
            marginTop: compact ? 8 : 0,
            paddingLeft: 0,
          }}
        >
          <AppText variant="tiny" color="textFaint" numberOfLines={1}>
            {rateLabel}
          </AppText>
          <AppText
            variant={heroRate ? 'rateHero' : 'rate'}
            style={{ color: lowerIsBetter ? theme.colors.success : theme.colors.primary }}
          >
            {rateText}
          </AppText>
          {row.comparison_rate && !showingComparisonRate ? (
            <AppText variant="tiny" color="textFaint" numberOfLines={1}>
              {formatRate(row.comparison_rate)} cmp
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {!selectMode ? (
        <Pressable
          onPress={() => toggleSavedRate(row, Number.isInteger(row.rate_index) ? 'rate' : 'product')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={favorite
            ? 'Remove this rate from saved'
            : Number.isInteger(row.rate_index)
              ? 'Save this exact rate'
              : 'Save all product variants'}
          accessibilityState={{ selected: favorite }}
          android_ripple={androidRipple(theme.colors.primaryMuted, true)}
          style={{
            minWidth: 48,
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
      ) : null}
    </View>
  );
}
