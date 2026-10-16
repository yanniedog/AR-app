import Ionicons from './icons/AppIcon';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { TouchTarget } from './TouchTarget';
import { AppText } from './ui';
import type { UiCopy } from '../lib/uiCopy';

/**
 * A single-select, outlined choice card: icon + label + optional one-line
 * description, with a radio affordance that fills when selected. Used where
 * options must read as choices, not as a stack of equal primary buttons.
 */
export function OptionCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: UiCopy;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      fill
      hitSlop={0}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: selected ? theme.ledger.eucalyptus : theme.ledger.controlRule,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={22} color={selected ? theme.colors.primary : theme.colors.textMuted} />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="700">
          {label}
        </AppText>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
      ) : (
        <View
          style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.ledger.controlRule }}
        />
      )}
    </TouchTarget>
  );
}
