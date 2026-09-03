import React from 'react';
import { Pressable, View } from 'react-native';

import { useUserRateScenario } from '../hooks/useUserRateScenario';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, androidRipple } from './ui';

/**
 * Root-level notice for the rare case where an interrupted encrypted write had
 * to be recovered as editable defaults. Keeping this above navigation means a
 * user gets the explanation on whichever scenario-backed screen opens first.
 */
export function ScenarioRecoveryBanner() {
  const theme = useTheme();
  const { warning, dismissWarning } = useUserRateScenario();

  if (!warning) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 14,
        paddingRight: 8,
        paddingVertical: 10,
        borderLeftWidth: 4,
        borderBottomWidth: 1,
        borderColor: theme.ledger.wattle,
        backgroundColor: theme.ledger.raised,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="tiny" weight="700" color="warning">
          SAVED SCENARIO RESET
        </AppText>
        <AppText variant="small" color="text">
          {warning}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss saved scenario reset notice"
        onPress={dismissWarning}
        hitSlop={4}
        android_ripple={androidRipple(theme.colors.primaryMuted, true)}
        style={({ pressed }) => ({
          minWidth: 56,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.sm,
          opacity: pressed ? 0.72 : 1,
          overflow: 'hidden',
        })}
      >
        <AppText variant="small" weight="700" color="primary">
          Got it
        </AppText>
      </Pressable>
    </View>
  );
}
