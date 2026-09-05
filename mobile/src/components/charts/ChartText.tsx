import React from 'react';
import { Text, type TextProps } from 'react-native-svg';

import { commissionerFamily } from '../../theme/fonts';

/** Chart labels share the same bundled faces as the rest of the app. */
export function ChartText({ fontWeight = '400', ...props }: TextProps) {
  const weight = fontWeight === 'bold' ? 700 : Number(fontWeight);
  const family = commissionerFamily(
    weight >= 700 ? '700' : weight >= 600 ? '600' : weight >= 500 ? '500' : '400',
  );
  return <Text {...props} fontFamily={family} fontWeight="normal" />;
}
