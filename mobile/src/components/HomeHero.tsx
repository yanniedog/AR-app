import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { dataSourceLabel } from '../lib/nextIngest';
import type { PayloadSource } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { BrandLockup } from './BrandLockup';
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

  useEffect(() => {
    scale.value = 0.94;
    scale.value = withSpring(1, SPRING);
  }, [dataKey, scale]);

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

  useEffect(() => {
    datePulse.value = 0.92;
    datePulse.value = withSpring(1, SPRING);
  }, [dataKey, datePulse]);

  const dateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: datePulse.value }],
  }));

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 12,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <BrandLockup markSize={28} style={{ marginBottom: 6 }} />
          <AppText
            variant="tiny"
            color="textMuted"
            weight="700"
            style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 }}
          >
            Rate intelligence
          </AppText>
          <AppText variant="h2" weight="800" style={{ lineHeight: 28 }}>
            Compare observed Australian rates.
          </AppText>
          <Animated.View style={dateStyle}>
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
              {runDateLabel} · {runAgeLabel}
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 2 }}>
              {source === 'sample' ? 'Bundled sample · not today’s market' : coverageLabel}
            </AppText>
          </Animated.View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.colors.chip,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: theme.radius.sm,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="share-social-outline" size={14} color={theme.colors.primary} />
              <AppText variant="tiny" weight="700" color="primary">
                Share
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Row>
    </View>
  );
}
