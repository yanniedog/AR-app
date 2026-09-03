import React, { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { PayloadProgressSnapshot } from '../data/downloadProgress';
import { buildPayloadProgressViewModel } from '../data/downloadProgress';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { AppText, Row } from './ui';

/** Always-visible determinate sync bar with phase label and ETA. */
export function PayloadProgressBar({
  progress,
  caption,
}: {
  progress: PayloadProgressSnapshot;
  caption?: string;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const motionAllowed = reducedMotion === false;
  // Refresh wall clock on every progress snapshot so download rate/ETA stay honest.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    setNowTick(Date.now());
  }, [
    progress.phase,
    progress.startedAt,
    progress.bytesReceived,
    progress.totalBytes,
    progress.phaseComplete,
    progress.fileName,
  ]);

  const vm = buildPayloadProgressViewModel(progress, nowTick);
  const fill = useSharedValue(vm.overallPercent / 100);
  const softSweep = useRef(new RNAnimated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    fill.value = motionAllowed
      ? withTiming(vm.overallPercent / 100, { duration: 180 })
      : vm.overallPercent / 100;
  }, [fill, motionAllowed, vm.overallPercent]);

  // During CPU-bound phases the JS thread may freeze (JSON.parse). Drive a
  // native-driver sweep so motion continues without setInterval / React state.
  useEffect(() => {
    softSweep.stopAnimation();
    if (!vm.softMotion || !motionAllowed) {
      softSweep.setValue(0);
      return;
    }
    softSweep.setValue(0);
    const loop = RNAnimated.loop(
      RNAnimated.timing(softSweep, {
        toValue: 1,
        duration: 1200,
        easing: RNEasing.inOut(RNEasing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      softSweep.stopAnimation();
    };
  }, [motionAllowed, softSweep, vm.softMotion, progress.phase, progress.startedAt]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
  }));

  const softBarWidth = Math.max(48, trackWidth * 0.36);
  const softTravel = Math.max(trackWidth + softBarWidth, softBarWidth + 40);

  return (
    <View style={{ flex: 1, gap: 6 }}>
      {caption ? (
        <AppText variant="small" color="textMuted" numberOfLines={2}>
          {caption}
        </AppText>
      ) : null}
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="tiny" weight="700" color="textMuted" style={{ flex: 1, paddingRight: 8 }}>
          {vm.phaseText}
        </AppText>
        <AppText variant="tiny" weight="700" color="primary">
          {vm.softMotion ? `${vm.overallPercent}%…` : `${vm.overallPercent}%`}
        </AppText>
      </Row>
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          height: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.chip,
          overflow: 'hidden',
        }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: vm.overallPercent }}
      >
        {vm.softMotion && motionAllowed ? (
          <RNAnimated.View
            style={{
              height: '100%',
              width: softBarWidth,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              transform: [
                {
                  translateX: softSweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-softBarWidth, softTravel],
                  }),
                },
              ],
            }}
          />
        ) : (
          <Animated.View
            style={[
              {
                height: '100%',
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primary,
              },
              fillStyle,
            ]}
          />
        )}
      </View>
      <AppText variant="tiny" color="textFaint" numberOfLines={1}>
        {vm.detailLine}
      </AppText>
    </View>
  );
}

/**
 * Indeterminate track for suitability / filter wait UI.
 * Uses the RN Animated driver (native) so the sweep keeps moving even when the
 * JS thread is busy with details parse / suitability rebuild.
 */
export function IndeterminateProgressBar({
  caption,
  accessibilityLabel = 'Preparing rates',
}: {
  caption?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const motionAllowed = reducedMotion === false;
  const sweep = useRef(new RNAnimated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    sweep.setValue(0);
    if (!motionAllowed) return;
    const loop = RNAnimated.loop(
      RNAnimated.timing(sweep, {
        toValue: 1,
        duration: 1200,
        easing: RNEasing.inOut(RNEasing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      sweep.stopAnimation();
    };
  }, [motionAllowed, sweep]);

  const barWidth = Math.max(48, trackWidth * 0.36);
  const travel = Math.max(trackWidth + barWidth, barWidth + 40);

  return (
    <View style={{ flex: 1, gap: 6 }} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      {caption ? (
        <AppText variant="small" color="textMuted" numberOfLines={2}>
          {caption}
        </AppText>
      ) : null}
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          height: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.chip,
          overflow: 'hidden',
        }}
      >
        <RNAnimated.View
          style={{
            height: '100%',
            width: motionAllowed ? barWidth : '36%',
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            ...(motionAllowed ? { transform: [
              {
                translateX: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-barWidth, travel],
                }),
              },
            ] } : null),
          }}
        />
      </View>
    </View>
  );
}


/** @deprecated Use PayloadProgressBar. */
export const PayloadProgressDetails = PayloadProgressBar;
