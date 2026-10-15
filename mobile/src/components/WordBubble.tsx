import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { uiLabel, type UiChild } from '../lib/uiCopy';
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
type Owner = object;
type Bubble = {
  owner: Owner; request: number; geometry: string; word: IconWord;
  x: number; y: number; width: number; height: number;
  size: { width: number; height: number } | null;
};
type Controller = {
  show(owner: Owner, anchor: View, word: IconWord, isCurrent: () => boolean): void;
  dismiss(owner?: Owner): void;
};
const WordBubbleContext = createContext<Controller | null>(null);
const validRect = (x: number, y: number, width: number, height: number) =>
  [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;

/** Mount inside the same native surface as its anchors; native Modals can scope their own host. */
export function WordBubbleProvider({ children, scopeKey }: { children: UiChild; scopeKey?: string }) {
  const theme = useTheme(), reducedMotion = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const hostRef = useRef<View>(null), alive = useRef(true), request = useRef(0);
  const bounds = useRef<{ width: number; height: number } | null>(null);
  const active = useRef<{ owner: Owner; anchor: View; isCurrent: () => boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRequest = useRef<number | null>(null);
  const back = useRef<{ remove(): void } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const geometryKey = `${width}:${height}:${fontScale}:${reducedMotion}:${scopeKey ?? ''}`;
  const geometry = useRef(geometryKey);
  geometry.current = geometryKey;
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const dismiss = useCallback((owner?: Owner) => {
    if (owner && active.current?.owner !== owner) return;
    active.current = null;
    request.current++;
    startedRequest.current = null;
    clearTimer();
    back.current?.remove(); back.current = null;
    opacity.stopAnimation();
    if (alive.current) setBubble(null);
  }, [clearTimer, opacity]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; dismiss(); };
  }, [dismiss]);
  useEffect(() => { dismiss(); }, [dismiss, geometryKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') dismiss();
    });
    return () => subscription.remove();
  }, [dismiss]);

  const show = useCallback<Controller['show']>((owner, anchor, word, isCurrent) => {
    if (!alive.current || !(ICON_WORDS as readonly string[]).includes(word)) return;
    dismiss();
    const host = hostRef.current, measuredBounds = bounds.current;
    if (!host || !measuredBounds || !isCurrent()) return;
    const currentRequest = request.current, currentGeometry = geometry.current;
    active.current = { owner, anchor, isCurrent };
    const valid = () => alive.current && request.current === currentRequest && geometry.current === currentGeometry
      && bounds.current === measuredBounds && active.current?.owner === owner && isCurrent();
    back.current = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!valid()) return false;
      dismiss();
      return true;
    });
    // A removed native target must not leave invisible Back ownership behind.
    timer.current = setTimeout(() => {
      if (alive.current && request.current === currentRequest && active.current?.owner === owner) dismiss(owner);
    }, 1000);
    opacity.setValue(0);
    // First establish native ancestry. Root-page measure then preserves transforms
    // (e.g. Saved's translated row) without using another window's viewport origin.
    anchor.measureLayout(host, () => {
      if (!valid()) return;
      host.measure((_hx, _hy, hostWidth, hostHeight, hostX, hostY) => {
        if (!valid()) return;
        if (!validRect(hostX, hostY, hostWidth, hostHeight)) { dismiss(owner); return; }
        anchor.measure((_x, _y, anchorWidth, anchorHeight, pageX, pageY) => {
          if (!valid()) return;
          if (!validRect(pageX, pageY, anchorWidth, anchorHeight)) { dismiss(owner); return; }
          setBubble({ owner, request: currentRequest, geometry: currentGeometry, word,
            x: pageX - hostX, y: pageY - hostY, width: anchorWidth, height: anchorHeight, size: null });
        });
      });
    }, () => { if (valid()) dismiss(owner); });
  }, [dismiss, opacity]);
  const controller = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const current = bubble?.geometry === geometryKey && bubble.request === request.current ? bubble : null;
  const visible = current?.size != null;
  const hostBounds = bounds.current;
  const bubbleWidth = Math.min((hostBounds?.width ?? width) - 32,
    Math.max(64, (current?.word.length ?? 0) * 14 * fontScale * 0.8 + 28));
  const left = current && hostBounds ? Math.max(16, Math.min(hostBounds.width - (current.size?.width ?? bubbleWidth) - 16,
    current.x + current.width / 2 - (current.size?.width ?? bubbleWidth) / 2)) : 16;
  const measuredHeight = current?.size?.height ?? 0;
  const preferredTop = current && current.y >= measuredHeight + 16 ? current.y - measuredHeight - 8
    : (current?.y ?? 0) + (current?.height ?? 0) + 8;
  const top = Math.max(8, Math.min((hostBounds?.height ?? height) - measuredHeight - 8, preferredTop));

  return <WordBubbleContext.Provider value={controller}>
    <View ref={hostRef} collapsable={false} testID="word-bubble-host" style={{ flex: 1 }} onLayout={event => {
      const { width: hostWidth, height: hostHeight } = event.nativeEvent.layout;
      const next = validRect(0, 0, hostWidth, hostHeight) ? { width: hostWidth, height: hostHeight } : null;
      if (bounds.current?.width !== next?.width || bounds.current?.height !== next?.height) {
        bounds.current = next;
        dismiss();
      }
    }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
      {current ? <View pointerEvents="box-none"
        style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, direction: 'ltr' }}>
        {visible ? <Pressable testID="word-bubble-dismiss" onPress={() => dismiss()} accessible={false}
          accessibilityLabel={uiLabel('Close')} style={StyleSheet.absoluteFillObject} /> : null}
        <Animated.View key={current.request} testID="word-bubble-content" pointerEvents="none"
          accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
          onLayout={event => {
            if (!alive.current || current.request !== request.current || current.geometry !== geometry.current
              || current.size || startedRequest.current === current.request) return;
            const { width: actualWidth, height: actualHeight } = event.nativeEvent.layout;
            if (!validRect(0, 0, actualWidth, actualHeight)) { dismiss(current.owner); return; }
            startedRequest.current = current.request;
            clearTimer();
            setBubble(previous => previous?.request === current.request ? { ...previous, size: { width: actualWidth, height: actualHeight } } : previous);
            opacity.setValue(reducedMotion === false ? 0 : 1);
            if (reducedMotion === false) Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
            timer.current = setTimeout(() => {
              timer.current = null;
              if (!alive.current || current.request !== request.current) return;
              if (reducedMotion !== false) { dismiss(); return; }
              Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true })
                .start(({ finished }) => { if (finished && alive.current && current.request === request.current) dismiss(); });
            }, 1400);
          }}
          style={{ position: 'absolute', start: left, top: visible ? top : 0, width: bubbleWidth,
            minHeight: Math.max(36, 21 * fontScale + 16), paddingHorizontal: 12, paddingVertical: 8,
            borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.text,
            elevation: 5, opacity }}>
          <AppText accessible accessibilityLiveRegion="polite" numberOfLines={1}
            style={{ fontSize: 14, color: theme.colors.bg }}>{uiLabel(current.word)}</AppText>
        </Animated.View>
      </View> : null}
    </View>
  </WordBubbleContext.Provider>;
}

export function useWordBubble(word: IconWord) {
  const controller = useContext(WordBubbleContext);
  if (!controller) throw new Error('WordBubbleProvider must share the anchor native surface');
  const anchorRef = useRef<View>(null), owner = useRef<Owner>({}), alive = useRef(true);
  const currentWord = useRef(word);
  currentWord.current = word;
  const dismiss = useCallback(() => controller.dismiss(owner.current), [controller]);
  useEffect(() => {
    alive.current = true;
    const identity = owner.current;
    return () => { alive.current = false; controller.dismiss(identity); };
  }, [controller]);
  useEffect(() => { controller.dismiss(owner.current); }, [controller, word]);
  const show = useCallback((override?: IconWord) => {
    const shownWord = override ?? word, anchor = anchorRef.current;
    if (!alive.current || currentWord.current !== word || !anchor
      || !(ICON_WORDS as readonly string[]).includes(word) || !(ICON_WORDS as readonly string[]).includes(shownWord)) return;
    controller.show(owner.current, anchor, shownWord, () => alive.current && anchorRef.current === anchor && currentWord.current === word);
  }, [controller, word]);
  return { anchorRef, show, dismiss, overlay: null };
}
