import Ionicons from '../icons/AppIcon';
import React, { useCallback, useRef } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { formatRunDate } from '../../data/format';
import { plotLocalX } from '../../data/bankHistoryTransform';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Row } from '../ui';

const TOUCH_DECIDE_PX = 8;
export const CHART_CONTROL_TARGET_PX = 48;

export function useChartScrub(opts: {
  sliceCount: number;
  plotWidth: number;
  plotLeft?: number;
  indexFromPlotX?: (plotLocalX: number, plotWidth: number, sliceCount: number) => number;
  onSelectIndex: (index: number) => void;
  onHoverIndex?: (index: number | null) => void;
}) {
  const touchModeRef = useRef<'h' | 'v' | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const { sliceCount, plotWidth, plotLeft = 0, indexFromPlotX, onSelectIndex, onHoverIndex } = opts;

  const resolveIndex = useCallback(
    (containerX: number) => {
      const plotX = plotLocalX(containerX, plotLeft, plotWidth);
      if (indexFromPlotX) return indexFromPlotX(plotX, plotWidth, sliceCount);
      if (sliceCount <= 1) return 0;
      const width = Math.max(1, plotWidth);
      const clamped = Math.max(0, Math.min(width, plotX));
      return Math.max(0, Math.min(sliceCount - 1, Math.round((clamped / width) * (sliceCount - 1))));
    },
    [indexFromPlotX, plotLeft, plotWidth, sliceCount],
  );

  const onTouchStart = useCallback((event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length !== 1) {
      touchModeRef.current = 'v';
      return;
    }
    touchModeRef.current = null;
    const touch = event.nativeEvent.touches[0];
    touchStartRef.current = { x: touch.locationX, y: touch.locationY };
  }, []);

  const onTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (event.nativeEvent.touches.length !== 1 || sliceCount < 1) return;
      const touch = event.nativeEvent.touches[0];
      if (touchModeRef.current === null) {
        const dx = Math.abs(touch.locationX - touchStartRef.current.x);
        const dy = Math.abs(touch.locationY - touchStartRef.current.y);
        if (dx < TOUCH_DECIDE_PX && dy < TOUCH_DECIDE_PX) return;
        touchModeRef.current = dx > dy ? 'h' : 'v';
      }
      if (touchModeRef.current === 'h') onHoverIndex?.(resolveIndex(touch.locationX));
    },
    [onHoverIndex, resolveIndex, sliceCount],
  );

  const onTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const touch = event.nativeEvent.changedTouches[0];
      const mode = touchModeRef.current;
      if (touch && sliceCount > 0 && (mode === null || mode === 'h')) onSelectIndex(resolveIndex(touch.locationX));
      touchModeRef.current = null;
      onHoverIndex?.(null);
    },
    [onHoverIndex, onSelectIndex, resolveIndex, sliceCount],
  );

  const onTouchCancel = useCallback(() => {
    touchModeRef.current = null;
    onHoverIndex?.(null);
  }, [onHoverIndex]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, resolveIndex };
}

export function ChartSliceControls({
  dates,
  activeIndex,
  onChangeIndex,
  valueLabel,
  detail,
}: {
  dates: string[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  valueLabel: string;
  detail?: string | null;
}) {
  const theme = useTheme();
  if (!dates.length) return null;
  const index = Math.max(0, Math.min(dates.length - 1, activeIndex));
  const canPrev = index > 0;
  const canNext = index < dates.length - 1;
  const buttonStyle = {
    width: CHART_CONTROL_TARGET_PX,
    height: CHART_CONTROL_TARGET_PX,
    borderRadius: CHART_CONTROL_TARGET_PX / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.surfaceAlt,
  };

  return (
    <Row style={{ alignItems: 'center', marginTop: 6 }} gap={8}>
      <Pressable
        onPress={() => canPrev && onChangeIndex(index - 1)}
        disabled={!canPrev}
        accessibilityRole="button"
        accessibilityLabel="Previous date"
        accessibilityState={{ disabled: !canPrev }}
        style={[buttonStyle, { opacity: canPrev ? 1 : 0.35 }]}
      >
        <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="tiny" weight="700">{formatRunDate(dates[index])}</AppText>
        <AppText variant="small" weight="800">{valueLabel}</AppText>
        {detail ? <AppText variant="tiny" color="textFaint">{detail}</AppText> : null}
      </View>
      <Pressable
        onPress={() => canNext && onChangeIndex(index + 1)}
        disabled={!canNext}
        accessibilityRole="button"
        accessibilityLabel="Next date"
        accessibilityState={{ disabled: !canNext }}
        style={[buttonStyle, { opacity: canNext ? 1 : 0.35 }]}
      >
        <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
      </Pressable>
    </Row>
  );
}
