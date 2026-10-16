import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { LEDGER_MOTION, ledgerMotionDuration } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import type { UiNativeProps, UiChild } from '../lib/uiCopy';

export interface PressFeedbackProps extends Omit<UiNativeProps<PressableProps>, 'children'> {
  children?: UiChild | ((state: PressableStateCallbackType) => UiChild);
  /** Layout for the animated contents; the target and ripple remain stationary. */
  contentStyle?: StyleProp<ViewStyle>;
}

/** Shared tactile feedback without changing hit geometry or surrounding layout. */
export function PressFeedback({
  children,
  style,
  contentStyle,
  onPressIn,
  onPressOut,
  android_ripple,
  disabled,
  ...rest
}: PressFeedbackProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion !== false || disabled) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reducedMotion, disabled, scale]);

  const animate = (pressed: boolean) => {
    scale.stopAnimation();
    const duration = ledgerMotionDuration(reducedMotion, pressed ? 'press' : 'release');
    if (!duration || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: pressed ? LEDGER_MOTION.pressScale : 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      android_ripple={android_ripple ?? (Platform.OS === 'android'
        ? { color: theme.colors.primaryMuted, borderless: false }
        : undefined)}
      style={style}
      onPressIn={(event) => { animate(true); onPressIn?.(event); }}
      onPressOut={(event) => { animate(false); onPressOut?.(event); }}
    >
      {(state) => {
        // Preserve existing Pressable/TouchTarget flex layouts when they migrate.
        const outer = StyleSheet.flatten(typeof style === 'function' ? style(state) : style);
        const layout: ViewStyle = {
          alignSelf: 'stretch',
          // Intrinsic-width chips must not consume the whole available row.
          flexGrow: 0,
          flexShrink: 1,
          justifyContent: outer?.justifyContent ?? 'center',
          alignItems: outer?.alignItems ?? 'center',
          flexDirection: outer?.flexDirection,
          flexWrap: outer?.flexWrap,
          gap: outer?.gap,
          rowGap: outer?.rowGap,
          columnGap: outer?.columnGap,
        };
        return (
          <Animated.View style={[layout, contentStyle, {
            transform: [{ scale }],
            opacity: Platform.OS !== 'android' && state.pressed ? 0.75 : 1,
          }]}>
            {typeof children === 'function' ? children(state) : children}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}
