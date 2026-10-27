import type { UiChild } from '../lib/uiCopy';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { LEDGER_LAYOUT } from '../theme/layout';
import { ledgerMotionDuration } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { LedgerIcon } from './icons/LedgerIcon';
import { LedgerText } from './ledger/LedgerText';
import { TouchTarget } from './TouchTarget';
import { uiJoin, type UiCopy } from '../lib/uiCopy';

export function sheetBottomPadding(bottomInset: number, scale: number, platform = Platform.OS): number {
  const padding = Math.max(bottomInset, 12);
  if (platform !== 'android') return padding;
  // The inset bridge and native Modal can round opposite sides of a pixel.
  // Round outwards, cover that one-pixel seam, then retain one pixel of clearance.
  return (Math.ceil(padding * scale) + 2) / scale;
}

/** One interruptible native sheet layer, shared by filters and compact tasks. */
export type SheetAuditState = 'hidden' | 'opening' | 'presented' | 'closing';

export function SheetSurface({ visible, title, onClose, children, footer, style, onAuditStateChange }: {
  onAuditStateChange?: (state: SheetAuditState) => void;
  visible: boolean;
  title: UiCopy;
  onClose: () => void;
  children: UiChild;
  footer?: UiChild;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, scale } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const [nativeShown, setNativeShown] = useState(false);
  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [entered, setEntered] = useState(false);
  const evidenceCallback = useRef(onAuditStateChange); evidenceCallback.current = onAuditStateChange;
  useEffect(() => {
    if (!evidenceCallback.current) return;
    if (visible) { evidenceCallback.current(nativeShown && layoutMeasured && entered ? 'presented' : 'opening'); return; }
    evidenceCallback.current('closing');
    if (mounted) return;
    // Modal.visible=false has committed. Let native removal reach the display
    // before allowing underlying rows to establish a fresh physical proof.
    let second: number | undefined;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => evidenceCallback.current?.('hidden')); });
    return () => { cancelAnimationFrame(first); if (second !== undefined) cancelAnimationFrame(second); };
  }, [visible, mounted, nativeShown, layoutMeasured, entered]);
  useEffect(() => {
    // A close interrupted before native removal is still the same presented
    // Modal; reopening need not produce a second onShow or unchanged onLayout.
    if (onAuditStateChange && !visible && !mounted) { setNativeShown(false); setLayoutMeasured(false); }
  }, [visible, mounted, onAuditStateChange]);
  const progress = useRef(new Animated.Value(0)).current;
  const transition = useRef(0);
  const closePending = useRef(!visible);
  closePending.current = !visible;

  useEffect(() => {
    const currentTransition = ++transition.current;
    if (onAuditStateChange) setEntered(false);
    if (visible) { mountedRef.current = true; setMounted(true); }
    progress.stopAnimation();
    if (!visible && !mountedRef.current) { progress.setValue(0); return; }
    const duration = ledgerMotionDuration(reducedMotion, 'navigation');
    if (!duration) {
      progress.setValue(visible ? 1 : 0);
      if (onAuditStateChange) setEntered(visible);
      if (!visible) { mountedRef.current = false; setMounted(false); }
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && visible && currentTransition === transition.current && onAuditStateChange) setEntered(true);
      if (finished && !visible && currentTransition === transition.current) {
        mountedRef.current = false;
        setMounted(false);
      }
    });
    return () => {
      // Invalidate callbacks for this animation before cancellation reports back.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++transition.current;
      animation.stop();
    };
  }, [visible, reducedMotion, progress, onAuditStateChange]);

  const dismiss = () => {
    if (closePending.current) return;
    closePending.current = true;
    onClose();
  };
  const close = () => {
    if (closePending.current) return;
    if (Keyboard.isVisible()) Keyboard.dismiss();
    else dismiss();
  };

  return (
    <Modal onShow={onAuditStateChange ? () => setNativeShown(true) : undefined} transparent statusBarTranslucent visible={visible || mounted} animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.ledger.scrim, opacity: progress }} />
        <Pressable accessible={false} accessibilityElementsHidden onPress={dismiss} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View
          onLayout={onAuditStateChange ? event => { if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setLayoutMeasured(true); } : undefined}
          accessibilityViewIsModal
          style={[{
            width: '100%',
            maxWidth: LEDGER_LAYOUT.readingMeasure,
            maxHeight: '90%',
            alignSelf: 'center',
            backgroundColor: theme.ledger.raised,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingBottom: sheetBottomPadding(insets.bottom, scale),
            overflow: 'hidden',
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
          }, style]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <LedgerText variant="heading" style={{ flex: 1 }}>{title}</LedgerText>
            <TouchTarget square hitSlop={0} onPress={onClose} accessibilityRole="button" accessibilityLabel={uiJoin('Close', ' ', title)} style={{ borderRadius: theme.radius.sm, overflow: 'hidden' }}>
              <LedgerIcon name="close" color={theme.ledger.ink} />
            </TouchTarget>
          </View>
          {children}
          {footer}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
