import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { uiLabel } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui';

/** Closed vocabulary: bubbles name a symbol; they never carry descriptions. */
export const ICON_WORDS = [
  'Filter', 'Sort', 'Compare', 'Done', 'Save', 'Remove', 'History', 'Share',
  'Search', 'Clear', 'Bank', 'Comparison', 'Advertised', 'Ongoing', 'LVR',
  'Term', 'Balance', 'Variable', 'Fixed', 'Eligibility', 'Unknown', 'Sources',
  'Details', 'Selected', 'Calculate', 'Alerts', 'Fees', 'Bonus', 'Conditional', 'More', 'Tier',
] as const;
export type IconWord = typeof ICON_WORDS[number];

export function useWordBubble(word: IconWord) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const [anchor, setAnchor] = useState<{ x: number; y: number; height: number } | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    clearTimer();
    opacity.stopAnimation();
    if (alive.current) setAnchor(null);
  }, [clearTimer, opacity]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; clearTimer(); opacity.stopAnimation(); };
  }, [clearTimer, opacity]);
  useEffect(() => { dismiss(); }, [dismiss, word, width, height, fontScale, reducedMotion]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') dismiss();
    });
    return () => subscription.remove();
  }, [dismiss]);

  const show = useCallback(() => {
    // Runtime callers cannot expand the reviewed text boundary with arbitrary prose.
    if (!(ICON_WORDS as readonly string[]).includes(word)) return;
    anchorRef.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      if (!alive.current || anchorWidth <= 0 || anchorHeight <= 0) return;
      clearTimer();
      opacity.stopAnimation();
      opacity.setValue(reducedMotion === false ? 0 : 1);
      setAnchor({ x: x + anchorWidth / 2, y, height: anchorHeight });
      if (reducedMotion === false) {
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        if (reducedMotion !== false) { dismiss(); return; }
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true })
          .start(({ finished }) => { if (finished && alive.current) setAnchor(null); });
      }, 1400);
    });
  }, [clearTimer, dismiss, opacity, reducedMotion, word]);

  const bubbleWidth = Math.min(width - 32, Math.max(64, word.length * 14 * fontScale * 0.8 + 28));
  const bubbleHeight = Math.max(36, 21 * fontScale + 16);
  const left = anchor ? Math.max(16, Math.min(width - bubbleWidth - 16, anchor.x - bubbleWidth / 2)) : 16;
  const preferredTop = anchor && anchor.y > bubbleHeight + 12 ? anchor.y - bubbleHeight - 8
    : (anchor?.y ?? 0) + (anchor?.height ?? 0) + 8;
  const top = Math.max(8, Math.min(height - bubbleHeight - 8, preferredTop));
  const overlay = anchor ? (
    <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <Pressable onPress={dismiss} accessible={false} accessibilityLabel={uiLabel('Close')} style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, width: bubbleWidth,
          minHeight: bubbleHeight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
          justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.text,
          elevation: 5, opacity }}>
          <AppText accessible accessibilityLiveRegion="polite" numberOfLines={1}
            style={{ fontSize: 14, color: theme.colors.bg }}>{uiLabel(word)}</AppText>
        </Animated.View>
      </Pressable>
    </Modal>
  ) : null;
  return { anchorRef, show, dismiss, overlay };
}
