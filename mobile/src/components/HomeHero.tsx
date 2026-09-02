import React, { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { PayloadCoverage, PayloadSource } from '../types';
import type { AssetState } from '../data/assetState';
import { mapDisplayEvidence } from '../data/displayEvidence';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';
import { LedgerIcon } from './icons/LedgerIcon';
import { DataEvidenceLine } from './ledger';

const DATA_CHANGE_TIMING = { duration: 160, easing: Easing.bezier(0.2, 0, 0, 1) };

/** Restrained scale cue for hero stats when `dataKey` changes. */
export function SpringOnNewData({
  dataKey,
  children,
}: {
  dataKey: string;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion !== false) {
      scale.value = 1;
      return;
    }
    scale.value = 0.98;
    scale.value = withTiming(1, DATA_CHANGE_TIMING);
  }, [dataKey, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function HomeHero({
  runDateLabel,
  runDate,
  runAgeLabel,
  source,
  offline,
  dataKey,
  onShare,
  pendingIngest = false,
  coverageLabel,
  coverage,
  assetStatus,
  assetReason,
  overdueAfterUtc,
  scheduleLabel,
}: {
  runDateLabel: string;
  runDate: string;
  runAgeLabel: string;
  source: PayloadSource;
  offline: boolean;
  /** Changes when a new payload is installed — drives spring motion. */
  dataKey: string;
  /** Shares today's headline rates (system share sheet). */
  onShare?: () => void;
  /** Rolling ingest for today is still uploading on GitHub. */
  pendingIngest?: boolean;
  /** Measured payload coverage; never implies whole-market completeness. */
  coverageLabel: string;
  coverage?: PayloadCoverage | null;
  assetStatus?: AssetState<unknown>['status'];
  assetReason?: string | null;
  overdueAfterUtc?: string | null;
  scheduleLabel?: string | null;
}) {
  const theme = useTheme();
  const evidence = mapDisplayEvidence({
    source,
    offline,
    runDate: coverage?.observed_on ?? coverage?.observed_at ?? runDate,
    coverage,
    assetStatus: pendingIngest && assetStatus === 'live' ? 'loading' : assetStatus,
    assetReason,
    hasUsableData: true,
    overdueAfterUtc,
    scheduleLabel,
  });
  const datePulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion !== false) {
      datePulse.value = 1;
      return;
    }
    datePulse.value = 0.98;
    datePulse.value = withTiming(1, DATA_CHANGE_TIMING);
  }, [dataKey, datePulse, reducedMotion]);

  const dateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: datePulse.value }],
  }));

  return (
    <View
      style={{
        paddingVertical: 2,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Animated.View style={dateStyle}>
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
              {runDateLabel} · {runAgeLabel}
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 2 }}>
              {source === 'sample' ? 'Sample data · not today’s market' : coverageLabel}
            </AppText>
          </Animated.View>
          <DataEvidenceLine evidence={evidence} detailsTitle="Today’s data" />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {onShare ? (
            <Pressable
              onPress={onShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share today's rates"
              style={({ pressed }) => ({
                minWidth: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <LedgerIcon name="share" size={19} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </Row>
    </View>
  );
}
