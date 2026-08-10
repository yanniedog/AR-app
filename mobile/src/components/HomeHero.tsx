import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { dataSourceLabel } from '../lib/nextIngest';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { PayloadSource } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };

/** Spring scale wrapper for hero stats / ribbon when `dataKey` changes (new payload). */
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
    scale.value = 0.94;
    scale.value = withSpring(1, SPRING);
  }, [dataKey, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function HomeHero({
  runDateLabel,
  runAgeLabel,
  source,
  offline,
  dataKey,
  onShare,
  pendingIngest = false,
  coverageLabel,
}: {
  runDateLabel: string;
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
}) {
  const theme = useTheme();
  const sourceLabel = pendingIngest ? 'Updating' : dataSourceLabel(source);
  const statusIcon = offline
    ? 'cloud-offline-outline'
    : pendingIngest
      ? 'cloud-outline'
      : source === 'remote'
        ? 'cloud-done'
        : 'albums-outline';
  const statusColor = offline
    ? theme.colors.warning
    : pendingIngest
      ? theme.colors.primary
      : theme.colors.success;
  const datePulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion !== false) {
      datePulse.value = 1;
      return;
    }
    datePulse.value = 0.92;
    datePulse.value = withSpring(1, SPRING);
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
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.colors.primaryMuted,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: theme.radius.pill,
            }}
          >
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <AppText variant="tiny" weight="700" color="chipText">
              {offline ? 'Offline' : sourceLabel}
            </AppText>
          </View>
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
                borderRadius: theme.radius.pill,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="share-social-outline" size={19} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </Row>
    </View>
  );
}
