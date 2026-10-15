import React, { useRef } from 'react';
import { View, type LayoutChangeEvent, type PressableProps, type ViewStyle } from 'react-native';
import type { Palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { uiCount, type UiCopy } from '../lib/uiCopy';
import AppIcon from './icons/AppIcon';
import { PressFeedback } from './PressFeedback';
import { AppText } from './ui';
import { useWordBubble, type IconWord } from './WordBubble';
export type { IconWord } from './WordBubble';

export interface IconActionProps {
  icon: keyof typeof AppIcon.glyphMap;
  word: IconWord;
  onPress: () => void;
  accessibilityLabel?: UiCopy;
  accessibilityState?: PressableProps['accessibilityState'];
  testID?: string;
  disabled?: boolean;
  active?: boolean;
  badge?: number;
  size?: number;
  color?: keyof Palette;
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** One short press acts; holding names the icon without performing its action. */
export function IconAction({ icon, word, onPress, accessibilityLabel, accessibilityState,
  testID, disabled, active, badge, size = 21, color, style, onLayout }: IconActionProps) {
  const theme = useTheme();
  const held = useRef(false);
  const bubble = useWordBubble(word);
  return <View ref={bubble.anchorRef} collapsable={false}>
    <PressFeedback testID={testID} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? word}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }} disabled={disabled}
      delayLongPress={350} onPressIn={() => { held.current = false; }}
      onLongPress={() => { held.current = true; bubble.show(); }}
      onPress={() => { if (!held.current && !disabled) { bubble.dismiss(); onPress(); } held.current = false; }}
      onLayout={onLayout} style={{ ...style, minWidth: typeof style?.minWidth === 'number' ? Math.max(48, style.minWidth) : 48,
        minHeight: typeof style?.minHeight === 'number' ? Math.max(48, style.minHeight) : 48, alignItems: 'center', justifyContent: 'center',
        borderRadius: 12, overflow: 'hidden', backgroundColor: active ? theme.colors.primaryMuted : style?.backgroundColor,
        opacity: disabled ? 0.45 : 1 }}>
      <AppIcon name={icon} size={size} color={theme.colors[color ?? (active ? 'primary' : 'textMuted')]} />
      {typeof badge === 'number' && Number.isFinite(badge) && badge > 0 ? <View style={{ position: 'absolute', right: 1, top: 0,
        minWidth: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary }}>
        <AppText numberOfLines={1} style={{ fontSize: 10, color: theme.colors.onPrimary }}>{uiCount(Math.trunc(badge))}</AppText>
      </View> : null}
    </PressFeedback>
    {bubble.overlay}
  </View>;
}
