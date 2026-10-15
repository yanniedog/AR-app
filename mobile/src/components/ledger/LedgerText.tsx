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
  fontStyle,
  LEDGER_FONT_FAMILIES,
  type LedgerUiWeight,
} from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { TYPOGRAPHY } from '../../theme/typography';
import type { UiTextProps, UiNativeProps } from '../../lib/uiCopy';

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
  display: TYPOGRAPHY.rateHero,
  title: TYPOGRAPHY.h1,
  heading: TYPOGRAPHY.h2,
  body: TYPOGRAPHY.body,
  label: { ...TYPOGRAPHY.small, weight: '600' },
  caption: TYPOGRAPHY.tiny,
  rate: TYPOGRAPHY.rate,
  rateLarge: TYPOGRAPHY.rateHero,
  mono: TYPOGRAPHY.tiny,
};

export function LedgerText({
  variant = 'body',
  tone = 'ink',
  weight,
  italic = false,
  style,
  ...rest
}: Omit<UiNativeProps<TextProps>, 'children'> & UiTextProps & {
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
    ...(variant === 'mono' ? {
      fontFamily: Platform.select({
        ios: LEDGER_FONT_FAMILIES.mono.ios,
        android: LEDGER_FONT_FAMILIES.mono.android,
        web: LEDGER_FONT_FAMILIES.mono.web,
        default: LEDGER_FONT_FAMILIES.mono.android,
      }),
      fontWeight: resolvedWeight,
    } : fontStyle(resolvedWeight)),
    letterSpacing: 0,
    fontSize: metrics.size,
    lineHeight: fontScale > 1 ? undefined : metrics.lineHeight,
    fontStyle: italic ? 'italic' : 'normal',
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };

  return (
    <Text
      key={fontScale}
      allowFontScaling
      style={[
        base,
        style,
        fontScale > 1 && { lineHeight: undefined },
      ]}
      {...rest}
    />
  );
}
