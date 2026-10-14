import React from 'react';
import {
  ActivityIndicator,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon, type LedgerIconName } from '../icons/LedgerIcon';
import { LedgerText } from './LedgerText';
import { PressFeedback } from '../PressFeedback';

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
    ? theme.ledger.onPrimary
    : destructive
      ? theme.ledger.danger
      : theme.ledger.ink;
  const background = primary ? theme.ledger.primary : variant === 'secondary' ? theme.colors.surfaceAlt : 'transparent';

  return (
    <PressFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }}
      disabled={inactive}
      style={[
        {
          minHeight: LEDGER_LAYOUT.touchTarget,
          minWidth: LEDGER_LAYOUT.touchTarget,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: theme.radius.sm,
          borderWidth: primary || variant === 'quiet' ? 0 : 1,
          borderColor: destructive ? theme.ledger.danger : theme.ledger.controlRule,
          backgroundColor: background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: inactive ? 0.48 : 1,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}
    >
      <View style={{ opacity: loading ? 0 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 }}>
          {icon ? <LedgerIcon name={icon} size={19} color={foreground} /> : null}
          <LedgerText variant="body" weight="600" tone={primary ? 'onPrimary' : destructive ? 'danger' : 'ink'} style={{ flexShrink: 1, textAlign: 'center' }}>
            {label}
          </LedgerText>
      </View>
      {loading ? <ActivityIndicator color={foreground} style={{ position: 'absolute', alignSelf: 'center' }} /> : null}
    </PressFeedback>
  );
}
