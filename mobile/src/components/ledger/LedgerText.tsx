import React from 'react';
import {
  Platform,
  Text,
  type TextProps,
  type TextStyle,
  useWindowDimensions,
} from 'react-native';

import type { LedgerPalette } from '../../theme/colors';
import {
  commissionerFamily,
  LEDGER_FONT_FAMILIES,
  type LedgerUiWeight,
  newsreaderFamily,
} from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';

export type LedgerTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'caption'
  | 'rate'
  | 'rateLarge'
  | 'mono';

const METRICS: Record<LedgerTextVariant, { size: number; lineHeight: number; weight: LedgerUiWeight }> = {
  display: { size: 40, lineHeight: 44, weight: '600' },
  title: { size: 30, lineHeight: 36, weight: '600' },
  heading: { size: 22, lineHeight: 28, weight: '600' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  label: { size: 14, lineHeight: 19, weight: '600' },
  caption: { size: 12, lineHeight: 17, weight: '500' },
  rate: { size: 24, lineHeight: 29, weight: '600' },
  rateLarge: { size: 38, lineHeight: 42, weight: '600' },
  mono: { size: 12, lineHeight: 18, weight: '400' },
};

function familyFor(
  variant: LedgerTextVariant,
  weight: LedgerUiWeight,
  italic: boolean,
): string {
  if (variant === 'mono') {
    return Platform.select({
      ios: LEDGER_FONT_FAMILIES.mono.ios,
      android: LEDGER_FONT_FAMILIES.mono.android,
      web: LEDGER_FONT_FAMILIES.mono.web,
      default: LEDGER_FONT_FAMILIES.mono.android,
    });
  }
  if (variant === 'display' || variant === 'title' || variant === 'heading') {
    return newsreaderFamily(weight === '400' || weight === '500' ? '500' : '600', italic);
  }
  return commissionerFamily(weight);
}

export function LedgerText({
  variant = 'body',
  tone = 'ink',
  weight,
  italic = false,
  style,
  ...rest
}: TextProps & {
  variant?: LedgerTextVariant;
  tone?: keyof LedgerPalette;
  weight?: LedgerUiWeight;
  italic?: boolean;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const metrics = METRICS[variant];
  const resolvedWeight = weight ?? metrics.weight;
  const tabular = variant === 'rate' || variant === 'rateLarge';
  const base: TextStyle = {
    color: theme.ledger[tone],
    fontFamily: familyFor(variant, resolvedWeight, italic),
    fontSize: metrics.size,
    lineHeight: fontScale > 1 ? undefined : metrics.lineHeight,
    fontStyle: italic ? 'italic' : 'normal',
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };

  return (
    <Text
      allowFontScaling
      style={[
        base,
        (variant === 'display' || variant === 'title') && { letterSpacing: -0.45 },
        tabular && { letterSpacing: -0.2 },
        style,
        fontScale > 1 && { lineHeight: undefined },
      ]}
      {...rest}
    />
  );
}
