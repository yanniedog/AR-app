import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { AppText, androidRipple } from './ui';

export function DiagnosticsConsentBanner({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

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
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: Math.max(8, insets.bottom + 4),
        zIndex: 95,
        minHeight: 48,
        paddingLeft: 12,
        paddingRight: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        variant="tiny"
        color="textMuted"
        style={{ flex: 1 }}
      >
        Crash/performance reports + limited public-screen replay
      </AppText>
      {action('Off', 'Turn diagnostics off', onDecline)}
      {action('OK', 'Allow selected diagnostics', onAccept)}
    </View>
  );
}
