import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon, type LedgerIconName } from '../icons/LedgerIcon';
import { LedgerText } from './LedgerText';

export type LedgerActionVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

export interface LedgerActionProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: LedgerActionVariant;
  icon?: LedgerIconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LedgerAction({
  label,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityState,
  ...rest
}: LedgerActionProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  const destructive = variant === 'destructive';
  const foreground = primary
    ? theme.ledger.onWattle
    : destructive
      ? theme.ledger.danger
      : theme.ledger.ink;
  const background = primary ? theme.ledger.wattle : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        {
          minHeight: LEDGER_LAYOUT.touchTarget,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: 4,
          borderWidth: primary || variant === 'quiet' ? 0 : 1,
          borderColor: destructive ? theme.ledger.danger : theme.ledger.controlRule,
          backgroundColor: background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: inactive ? 0.48 : pressed ? 0.76 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <LedgerIcon name={icon} size={19} color={foreground} /> : null}
          <LedgerText variant="label" tone={primary ? 'onWattle' : destructive ? 'danger' : 'ink'}>
            {label}
          </LedgerText>
        </>
      )}
    </Pressable>
  );
}
