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
import { uiJoin, uiNumber, type UiCopy, type UiLabel } from '../lib/uiCopy';
const PHASE_LABELS: Record<PayloadProgressSnapshot['phase'], UiLabel> = {
  manifest: 'Checking', finalize: 'Pending', download: 'Downloading', verify: 'Verifying',
  inflate: 'Preparing', parse: 'Preparing', install: 'Install',
};

/** Consumer sync summary; transfer diagnostics stay in the snapshot/work registry. */
export function PayloadProgressBar({
  progress,
  caption,
}: {
  progress: PayloadProgressSnapshot;
  caption?: UiCopy;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const motionAllowed = reducedMotion === false;
  // Processing-phase progress uses elapsed time from the actual snapshot.
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
          {PHASE_LABELS[progress.phase]}
        </AppText>
        <AppText variant="tiny" weight="700" color="primary">
          {uiJoin(uiNumber(vm.overallPercent), '%', vm.softMotion ? '…' : '')}
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
  caption?: UiCopy;
  accessibilityLabel?: UiCopy;
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
