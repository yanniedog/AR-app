import type { UiChild } from '../../lib/uiCopy';
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';
import type { UiCopy, UiNativeProps } from '../../lib/uiCopy';

export function LedgerSection({
  title,
  action,
  evidence,
  ruled = true,
  children,
  style,
  ...rest
}: UiNativeProps<ViewProps> & {
  title?: UiCopy;
  action?: UiChild;
  evidence?: UiChild;
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
          </View>
          {action}
        </View>
      ) : null}
      {children}
      {evidence}
    </View>
  );
}
