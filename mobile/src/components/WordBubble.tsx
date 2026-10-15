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
  const modalRootRef = useRef<View>(null);
  const alive = useRef(true);
  const request = useRef(0);
  const originRead = useRef(0);
  const shownRequest = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const geometryKey = `${word}:${width}:${height}:${fontScale}:${reducedMotion}`;
  const currentGeometry = useRef(geometryKey);
  currentGeometry.current = geometryKey;
  const [anchor, setAnchor] = useState<{ x: number; y: number; height: number; word: IconWord; request: number; geometry: string } | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number; width: number; height: number; request: number } | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    request.current++;
    originRead.current++;
    shownRequest.current = null;
    clearTimer();
    opacity.stopAnimation();
    if (alive.current) { setAnchor(null); setOrigin(null); }
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

  const show = useCallback((override?: IconWord) => {
    // Runtime callers cannot expand the reviewed text boundary with arbitrary prose.
    const shownWord = override ?? word;
    if (!alive.current || !(ICON_WORDS as readonly string[]).includes(word) || !(ICON_WORDS as readonly string[]).includes(shownWord)) return;
    const currentRequest = ++request.current;
    clearTimer();
    opacity.stopAnimation();
    opacity.setValue(0);
    shownRequest.current = null;
    setAnchor(null);
    setOrigin(null);
    anchorRef.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      if (!alive.current || currentRequest !== request.current || currentGeometry.current !== geometryKey
        || ![x, y, anchorWidth, anchorHeight].every(Number.isFinite) || anchorWidth <= 0 || anchorHeight <= 0) return;
      setAnchor({ x: x + anchorWidth / 2, y, height: anchorHeight, word: shownWord, request: currentRequest, geometry: geometryKey });
    });
  }, [clearTimer, geometryKey, opacity, word]);

  const currentAnchor = anchor?.geometry === geometryKey ? anchor : null;
  const measureModalOrigin = () => {
    if (!alive.current || !currentAnchor || currentAnchor.request !== request.current) return;
    const measuredRequest = currentAnchor.request;
    const measuredRead = ++originRead.current;
    setOrigin(null);
    modalRootRef.current?.measureInWindow((x, y, modalWidth, modalHeight) => {
      if (!alive.current || measuredRequest !== request.current || measuredRead !== originRead.current
        || currentGeometry.current !== geometryKey) return;
      if (![x, y, modalWidth, modalHeight].every(Number.isFinite) || modalWidth <= 0 || modalHeight <= 0) {
        dismiss();
        return;
      }
      setOrigin({ x, y, width: modalWidth, height: modalHeight, request: measuredRequest });
      if (shownRequest.current === measuredRequest) return;
      shownRequest.current = measuredRequest;
      opacity.stopAnimation();
      opacity.setValue(reducedMotion === false ? 0 : 1);
      if (reducedMotion === false) {
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        if (!alive.current || measuredRequest !== request.current) return;
        if (reducedMotion !== false) { dismiss(); return; }
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true })
          .start(({ finished }) => { if (finished && alive.current && measuredRequest === request.current) dismiss(); });
      }, 1400);
    });
  };

  const currentOrigin = currentAnchor && origin?.request === currentAnchor.request ? origin : null;
  const shownWord = currentAnchor?.word ?? word;
  const modalWidth = currentOrigin?.width ?? width, modalHeight = currentOrigin?.height ?? height;
  const bubbleWidth = Math.min(modalWidth - 32, Math.max(64, shownWord.length * 14 * fontScale * 0.8 + 28));
  const bubbleHeight = Math.max(36, 21 * fontScale + 16);
  // Both native measurements include the same RN viewport-origin convention.
  // Their difference is Modal-local even when edge-to-edge ignores bar flags.
  const localX = currentAnchor && currentOrigin ? currentAnchor.x - currentOrigin.x : 0;
  const localY = currentAnchor && currentOrigin ? currentAnchor.y - currentOrigin.y : 0;
  const left = Math.max(16, Math.min(modalWidth - bubbleWidth - 16, localX - bubbleWidth / 2));
  const preferredTop = localY > bubbleHeight + 12 ? localY - bubbleHeight - 8
    : localY + (currentAnchor?.height ?? 0) + 8;
  const top = Math.max(8, Math.min(modalHeight - bubbleHeight - 8, preferredTop));
  const overlay = currentAnchor ? (
    <Modal transparent animationType="none" statusBarTranslucent={false} navigationBarTranslucent={false} onRequestClose={dismiss}>
      <View key={currentAnchor.request} ref={modalRootRef} testID="word-bubble-origin" collapsable={false}
        onLayout={measureModalOrigin} style={{ flex: 1 }}>
      <Pressable onPress={dismiss} accessible={false} accessibilityLabel={uiLabel('Close')} style={{ flex: 1 }}>
        {currentOrigin ? <Animated.View testID="word-bubble-content" pointerEvents="none" style={{ position: 'absolute', left, top, width: bubbleWidth,
          minHeight: bubbleHeight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
          justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.text,
          elevation: 5, opacity }}>
          <AppText accessible accessibilityLiveRegion="polite" numberOfLines={1}
            style={{ fontSize: 14, color: theme.colors.bg }}>{uiLabel(shownWord)}</AppText>
        </Animated.View> : null}
      </Pressable>
      </View>
    </Modal>
  ) : null;
  return { anchorRef, show, dismiss, overlay };
}
