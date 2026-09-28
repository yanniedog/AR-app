import Ionicons from './icons/AppIcon';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Switch,
  TextInput,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hapticSelection } from '../lib/haptics';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { commissionerFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { TouchTarget } from './TouchTarget';
import { androidRipple, AppText } from './ui';

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Brief opacity dip when `section` changes — keeps content mounted (no hard remount). */
export function SectionCrossfade({
  section,
  children,
  style,
}: {
  section: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(1);
  const previousSection = useRef(section);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const changed = previousSection.current !== section;
    previousSection.current = section;
    if (!changed) {
      opacity.value = 1;
      return;
    }
    if (reducedMotion !== false) {
      opacity.value = 1;
      return;
    }
    opacity.value = withSequence(
      withTiming(0.22, { duration: 90 }),
      withTiming(1, { duration: 200 }),
    );
  }, [section, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 12,
        rowGap: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchTarget
            key={opt.value}
            onPress={() => {
              if (opt.value !== value) hapticSelection();
              onChange(opt.value);
            }}
            hitSlop={0}
            accessibilityRole="tab"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            android_ripple={androidRipple(theme.colors.primaryMuted)}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 48,
              minWidth: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: active ? theme.ledger.eucalyptus : 'transparent',
            }}
          >
            <AppText
              variant="small"
              weight={active ? '700' : '500'}
              color={active ? 'text' : 'textMuted'}
              style={{ textAlign: 'center', maxWidth: '100%' }}
            >
              {opt.label}
            </AppText>
          </TouchTarget>
        );
      })}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search products or banks',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.ledger.raised,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.ledger.eucalyptus : theme.ledger.controlRule,
        paddingHorizontal: 12,
        minHeight: 48,
        paddingVertical: 4,
      }}
    >
      <Ionicons name="search" size={18} color={theme.colors.textFaint} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        style={{
          flex: 1,
          minHeight: 48,
          color: theme.colors.text,
          fontFamily: commissionerFamily(),
          fontSize: theme.font.body,
        }}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          android_ripple={androidRipple(theme.colors.primaryMuted, true)}
          style={{
            width: 48,
            minHeight: 48,
            borderRadius: theme.radius.sm,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function CompactToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        minHeight: 48,
        paddingVertical: 8,
      }}
    >
      <AppText variant="small" weight="600" color="textMuted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={value ? theme.colors.card : undefined}
        accessibilityLabel={label}
      />
    </View>
  );
}
