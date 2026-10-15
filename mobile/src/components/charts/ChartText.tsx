import React from 'react';
import { Text, type TextProps } from 'react-native-svg';

import { fontStyle } from '../../theme/fonts';
import type { UiNativeProps, UiTextProps } from '../../lib/uiCopy';

/** Charts use the same real font weights as ordinary UI text. */
export function ChartText({ fontWeight = '400', ...props }: UiNativeProps<Omit<TextProps, 'children'>> & UiTextProps) {
  const weight = fontWeight === 'bold' ? 700 : Number(fontWeight);
  const face = fontStyle(
    weight >= 700 ? '700' : weight >= 600 ? '600' : weight >= 500 ? '500' : '400',
  );
  return <Text {...props} fontFamily={face.fontFamily} fontWeight={face.fontWeight} />;
}
