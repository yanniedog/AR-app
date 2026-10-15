import type { UiChild } from '../../lib/uiCopy';
import React from 'react';
import {
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon } from '../icons/LedgerIcon';
import { LedgerText } from './LedgerText';
import { PressFeedback } from '../PressFeedback';
import type { UiCopy, UiNativeProps } from '../../lib/uiCopy';

export interface LedgerRowProps extends Omit<UiNativeProps<PressableProps>, 'children' | 'style'> {
  title: UiCopy;
  detail?: UiCopy;
  leading?: UiChild;
  trailing?: UiChild;
  separator?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LedgerRow({
  title,
  detail,
  leading,
  trailing,
  separator = true,
  onPress,
  style,
  accessibilityLabel,
  ...rest
}: LedgerRowProps) {
  const theme = useTheme();
  const contents = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <LedgerText variant="label">{title}</LedgerText>
        {detail ? <LedgerText variant="caption" tone="mutedInk">{detail}</LedgerText> : null}
      </View>
      {trailing ?? (onPress ? <LedgerIcon name="chevron-right" size={18} color={theme.ledger.mutedInk} /> : null)}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [
    {
      minHeight: LEDGER_LAYOUT.touchTarget,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomColor: theme.ledger.rule,
      borderBottomWidth: separator ? StyleSheet.hairlineWidth : 0,
    },
    style,
  ];

  if (!onPress) return <View style={rowStyle}>{contents}</View>;
  return (
    <PressFeedback
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      contentStyle={{ width: '100%' }}
      style={rowStyle}
      {...rest}
    >
      {contents}
    </PressFeedback>
  );
}
