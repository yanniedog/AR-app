import React from 'react';
import Svg, { Circle, Path, type SvgProps } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

export interface RateMarkProps extends Omit<SvgProps, 'color'> {
  size?: number;
  accessibilityLabel?: string;
}

/**
 * The original Rate Ledger mark: ledger rules, a changing line and one datum.
 * It deliberately avoids the usual bank roof, currency sign and stock arrow.
 */
export function RateMark({
  size = 40,
  accessibilityLabel,
  ...rest
}: RateMarkProps) {
  const theme = useTheme();
  const labelled = Boolean(accessibilityLabel);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      accessible={labelled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={labelled ? 'image' : undefined}
      {...rest}
    >
      <Path
        d="M5 10H35M5 20H35M5 30H35"
        fill="none"
        stroke={theme.ledger.rule}
        strokeWidth={1.5}
      />
      <Path
        d="M6.5 28.5L14.25 23L20 25.25L27 15.5L34 12.5"
        fill="none"
        stroke={theme.ledger.ink}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.75}
      />
      <Circle cx={27} cy={15.5} r={3.25} fill={theme.ledger.wattle} />
      <Circle cx={27} cy={15.5} r={1.15} fill={theme.ledger.onWattle} />
    </Svg>
  );
}
