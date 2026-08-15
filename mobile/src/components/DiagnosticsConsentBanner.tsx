import React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTabBarContentHeight } from '../lib/androidChrome';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, androidRipple } from './ui';

export function DiagnosticsConsentBanner({
  visible,
  onAccept,
  onDecline,
  /** Clears the bottom tab bar when it is on screen, so navigation is never covered. */
  aboveTabBar = false,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  aboveTabBar?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  if (!visible) return null;

  const bottomOffset = aboveTabBar
    ? getTabBarContentHeight(fontScale) + insets.bottom + 8
    : Math.max(8, insets.bottom + 4);

  const action = (label: string, accessibilityLabel: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      android_ripple={androidRipple(theme.colors.primaryMuted, true)}
      style={({ pressed }) => ({
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        opacity: pressed ? 0.7 : 1,
        overflow: 'hidden',
      })}
    >
      <AppText variant="small" weight="700" color="primary">
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View
      // A bare View never claims the responder, so a tap on the banner's own
      // padding would otherwise reach whatever sits underneath it. Children are
      // offered the responder first, so the action buttons still work.
      onStartShouldSetResponder={() => true}
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: bottomOffset,
        zIndex: 95,
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        ...(theme.dark
          ? { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 }
          : { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 5 }),
      }}
    >
      <AppText
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        variant="small"
        color="text"
      >
        Send anonymous crash reports to help fix bugs?
      </AppText>
      <AppText variant="tiny" color="textFaint">
        Sends crash traces and device details. We strip what we can identify, but
        traces are generated automatically. Change this any time in Settings.
      </AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
        {action('Not now', 'Decline diagnostics', onDecline)}
        {action('Allow', 'Allow diagnostics', onAccept)}
      </View>
    </View>
  );
}
