import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui';

export function EmptyState({
  icon = 'search',
  title,
  subtitle,
  fill,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  /** When true, fills the screen with the themed background (tab empty states). */
  fill?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
        fill && { flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center' },
      ]}
    >
      <Ionicons name={icon} size={42} color={theme.colors.textFaint} />
      <AppText variant="h3" style={{ marginTop: 12, textAlign: 'center' }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="small" color="textMuted" style={{ marginTop: 6, textAlign: 'center' }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const SHIMMER_SWEEP = 120;

function ShimmerBox({
  height,
  width = '100%',
  borderRadius,
  style,
}: {
  height: number;
  width?: DimensionValue;
  borderRadius: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const progress = useRef(new RNAnimated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    progress.setValue(0);
    const loop = RNAnimated.loop(
      RNAnimated.timing(progress, {
        toValue: 1,
        duration: 1500,
        easing: RNEasing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      progress.stopAnimation();
    };
  }, [progress]);

  const shineColor = theme.dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)';
  const travel = Math.max(trackWidth, SHIMMER_SWEEP);

  return (
    <View
      onLayout={(e) => {
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      style={[
        {
          height,
          width,
          borderRadius,
          backgroundColor: theme.colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <RNAnimated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: SHIMMER_SWEEP,
          backgroundColor: shineColor,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-SHIMMER_SWEEP, travel],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

function ProductCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 10,
      }}
    >
      <ShimmerBox height={44} width={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 8 }}>
        <ShimmerBox height={14} width="72%" borderRadius={theme.radius.sm} />
        <ShimmerBox height={12} width="48%" borderRadius={theme.radius.sm} />
      </View>
      <ShimmerBox height={20} width={56} borderRadius={theme.radius.sm} />
    </View>
  );
}

/** Product-card-shaped shimmer placeholders for lists and browse remounts. */
export function LoadingRows({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading content">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Whole-screen placeholder for the window between a screen mounting and the
 * core payload being in memory (a cold start, or the first paint after Clear
 * cache). Screens used to render `null` here, which reads as a broken app.
 */
export function ScreenSkeleton({ rows = 4 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.bg, padding: 16, gap: 12 }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading rates"
    >
      <ShimmerBox height={18} width="46%" borderRadius={theme.radius.sm} />
      <ShimmerBox height={12} width="72%" borderRadius={theme.radius.sm} />
      <View style={{ height: 4 }} />
      <LoadingRows count={rows} />
    </View>
  );
}

const DETAIL_LINE_WIDTHS: DimensionValue[] = ['68%', '52%', '44%'];

/** Compact shimmer lines for product detail groups. */
export function DetailLoadingLines({ lines = 3 }: { lines?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{ gap: 10 }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading product details"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBox
          key={i}
          height={14}
          width={DETAIL_LINE_WIDTHS[i % DETAIL_LINE_WIDTHS.length]}
          borderRadius={theme.radius.sm}
        />
      ))}
    </View>
  );
}

