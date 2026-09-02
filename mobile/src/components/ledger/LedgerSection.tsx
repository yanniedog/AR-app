import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';

export function LedgerSection({
  title,
  deck,
  action,
  evidence,
  ruled = true,
  children,
  style,
  ...rest
}: ViewProps & {
  title?: string;
  deck?: string;
  action?: React.ReactNode;
  evidence?: React.ReactNode;
  ruled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        ruled && {
          borderTopColor: theme.ledger.rule,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: theme.space.standard,
        },
        { gap: theme.space.small },
        style,
      ]}
      {...rest}
    >
      {title || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            {title ? <LedgerText variant="heading">{title}</LedgerText> : null}
            {deck ? <LedgerText tone="mutedInk">{deck}</LedgerText> : null}
          </View>
          {action}
        </View>
      ) : deck ? (
        <LedgerText tone="mutedInk">{deck}</LedgerText>
      ) : null}
      {children}
      {evidence}
    </View>
  );
}
