import Ionicons from './icons/AppIcon';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { RateStats } from '../data/taxonomy';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

/** Shared taxonomy category row — Home shortcuts and Browse drill-down. */
export function CategoryRow({
  label,
  productCount,
  providerCount,
  rate,
  section,
  onPress,
}: {
  label: string;
  productCount: number;
  providerCount: number;
  rate: number | null;
  section: SectionKey;
  onPress: () => void;
  accent?: string;
  showAccent?: boolean;
  ribbonStats?: RateStats;
  /** Shared scale across sibling rows so ranges are directly comparable. */
  ribbonDomain?: { min: number; max: number } | null;
}) {
  const theme = useTheme();
  // Category aggregates may include advertised-rate fallbacks when a comparison
  // rate is unpublished. Exact product-level metric labels live on ProductCard.
  const rateLabel = section === 'Mortgage' ? 'Rates from' : 'Rates up to';
  const productLabel = productCount === 1 ? 'product' : 'products';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
        borderBottomWidth: 1,
        borderColor: theme.ledger.rule,
        paddingVertical: theme.spacing(5),
        minHeight: 72,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Row
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          rowGap: theme.spacing(3),
        }}
      >
        <View style={{ flexGrow: 1, flexBasis: 150, paddingRight: theme.spacing(2) }}>
          <AppText variant="body" weight="600">
            {label}
          </AppText>
          <AppText variant="tiny" color="textFaint" style={{ marginTop: theme.spacing(1) / 2 }}>
            {productCount} {productLabel} · {providerCount} banks
          </AppText>
        </View>
        <Row gap={theme.spacing(1)}>
          <View style={{ alignItems: 'flex-end', gap: theme.spacing(1) }}>
            <AppText variant="tiny" color="textMuted">{rateLabel}</AppText>
            <AppText variant="rate" weight="600">
              {rate !== null ? `${(rate * 100).toFixed(2)}%` : 'Not published'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
        </Row>
      </Row>
    </Pressable>
  );
}
