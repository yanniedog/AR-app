import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';

import { uiJoin, uiLabel, uiRate } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button } from './ui';

export const LVR_SLIDER_MIN = 10;
export const LVR_SLIDER_MAX = 100;
export const LVR_SLIDER_STEP = 0.5;
const THUMB = 28;
const TRACK_HEIGHT = 4;

export function snapLvr(value: number): number {
  const clamped = Math.min(LVR_SLIDER_MAX, Math.max(LVR_SLIDER_MIN, value));
  return Math.round(clamped / LVR_SLIDER_STEP) * LVR_SLIDER_STEP;
}

/** Optional LVR on a continuum. With no explicit value it shows `fallback`
 * (the user's own LVR); dragging sets an explicit value, Clear returns to it. */
export function LvrSlider({ value, fallback, onChange, onClear }: {
  value: number | null; fallback: number; onChange: (next: number) => void; onClear: () => void;
}) {
  const theme = useTheme();
  const explicit = value !== null;
  // An explicit value is shown exactly as applied; only dragging snaps to the step.
  const shown = Math.min(LVR_SLIDER_MAX, Math.max(LVR_SLIDER_MIN, value ?? snapLvr(fallback)));
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null), widthRef = useRef(0), startRef = useRef(0), shownRef = useRef(shown), changeRef = useRef(onChange);
  shownRef.current = shown; changeRef.current = onChange;
  const current = drag ?? shown;
  useEffect(() => { dragRef.current = null; setDrag(null); }, [value]);
  const span = Math.max(1, width - THUMB);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { dragRef.current = null; setDrag(null); },
    onPanResponderGrant: event => {
      const trackSpan = Math.max(1, widthRef.current - THUMB);
      const x = Math.max(0, Math.min(trackSpan, event.nativeEvent.locationX - THUMB / 2));
      const next = snapLvr(LVR_SLIDER_MIN + (x / trackSpan) * (LVR_SLIDER_MAX - LVR_SLIDER_MIN));
      startRef.current = ((next - LVR_SLIDER_MIN) / (LVR_SLIDER_MAX - LVR_SLIDER_MIN)) * trackSpan;
      dragRef.current = next; setDrag(next);
    },
    onPanResponderMove: (_event, gesture) => {
      const x = Math.max(0, Math.min(widthRef.current - THUMB, startRef.current + gesture.dx));
      const next = snapLvr(LVR_SLIDER_MIN + (x / Math.max(1, widthRef.current - THUMB)) * (LVR_SLIDER_MAX - LVR_SLIDER_MIN));
      dragRef.current = next; setDrag(next);
    },
    onPanResponderRelease: () => { const latest = dragRef.current; dragRef.current = null; if (latest !== null) changeRef.current(latest); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const onLayout = (event: LayoutChangeEvent) => { widthRef.current = event.nativeEvent.layout.width; setWidth(event.nativeEvent.layout.width); };
  const left = ((current - LVR_SLIDER_MIN) / (LVR_SLIDER_MAX - LVR_SLIDER_MIN)) * span;
  const adjust = (delta: number) => onChange(snapLvr(current + delta));
  const digits = Math.abs(current * 10 - Math.round(current * 10)) < 1e-9 ? 1 : 2;
  return <View style={{ gap: 4 }} testID="lvr-slider">
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
      <AppText variant="small" weight="600">{uiJoin(uiLabel('LVR'), ' ', uiRate(current / 100, digits))}</AppText>
      {explicit ? <Button title="Clear" variant="ghost" accessibilityLabel="Clear" onPress={onClear} /> : null}
    </View>
    <View onLayout={onLayout} {...responder.panHandlers} accessible accessibilityRole="adjustable"
      accessibilityLabel={uiLabel('LVR')} accessibilityValue={{ min: LVR_SLIDER_MIN, max: LVR_SLIDER_MAX, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => adjust(event.nativeEvent.actionName === 'increment' ? LVR_SLIDER_STEP : -LVR_SLIDER_STEP)}
      style={{ height: 48, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, backgroundColor: theme.colors.border, marginHorizontal: THUMB / 2 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: THUMB / 2, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, width: left,
        backgroundColor: explicit ? theme.colors.primary : theme.colors.textMuted }} />
      <View pointerEvents="none" style={{ position: 'absolute', left, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 2,
        borderColor: explicit ? theme.colors.primary : theme.colors.textMuted, backgroundColor: theme.colors.surface }} />
    </View>
  </View>;
}
