import React, { forwardRef } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import type { Theme } from '../theme/theme';
import {
  ledgerContentMaxWidth,
  ledgerHorizontalGutter,
} from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { DataHealthBanner } from './feedback';

type ScreenMeasure = 'reading' | 'data' | 'full';

export function responsiveScreenContentStyle(
  width: number,
  measure: ScreenMeasure = 'reading',
): ViewStyle {
  const gutter = ledgerHorizontalGutter(width);
  return {
    width: '100%',
    maxWidth: measure === 'full' ? undefined : ledgerContentMaxWidth(measure) + gutter * 2,
    alignSelf: 'center',
    paddingHorizontal: gutter,
  };
}

/** Shared data-health strip for tab and stack screens. */
export function DataHealthBannerStrip() {
  const source = useStore((s) => s.source);
  const offline = useStore((s) => s.offline);
  return <DataHealthBanner source={source} offline={offline} />;
}

function PaddedDataHealthBannerStrip() {
  const { width } = useWindowDimensions();
  const source = useStore((s) => s.source);
  const offline = useStore((s) => s.offline);
  return (
    <DataHealthBanner
      source={source}
      offline={offline}
      containerStyle={{
        ...responsiveScreenContentStyle(width),
        paddingTop: 12,
      }}
    />
  );
}

/** Horizontal + top padding for fixed screen headers (toolbars). */
export function screenEdgeStyle(theme: Theme): ViewStyle {
  return {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(3),
    gap: theme.spacing(3),
  };
}

/** Scroll/list body padding — 8pt grid with safe-area bottom inset. */
export function screenScrollContentStyle(
  theme: Theme,
  bottomInset = 0,
  width?: number,
  measure: ScreenMeasure = 'reading',
): ViewStyle {
  return {
    ...(width == null
      ? { paddingHorizontal: theme.spacing(4) }
      : responsiveScreenContentStyle(width, measure)),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(6) + bottomInset,
    gap: theme.spacing(3),
  };
}

/** Static screen body with enforced spatial scaffold. */
export function ScreenContent({
  style,
  children,
  measure = 'reading',
  ...rest
}: ViewProps & { measure?: ScreenMeasure }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={[screenScrollContentStyle(theme, insets.bottom, width, measure), style]} {...rest}>
      {children}
    </View>
  );
}

/** Full-screen container with themed background (tabs, stack bodies). */
export function Screen({
  style,
  children,
  showDataHealthBanner = true,
  ...rest
}: ViewProps & { showDataHealthBanner?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]} {...rest}>
      {showDataHealthBanner ? <PaddedDataHealthBannerStrip /> : null}
      {children}
    </View>
  );
}

/** Scrollable screen body; sets both scroll surface and overscroll background. */
export const ScreenScrollView = forwardRef<
  ScrollView,
  ScrollViewProps & { showDataHealthBanner?: boolean; measure?: ScreenMeasure }
>(function ScreenScrollView(
  {
    style,
    contentContainerStyle,
    children,
    showDataHealthBanner = true,
    measure = 'reading',
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      ref={ref}
      style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]}
      contentContainerStyle={[
        screenScrollContentStyle(theme, insets.bottom, width, measure),
        contentContainerStyle,
      ]}
      {...rest}
    >
      {showDataHealthBanner ? <DataHealthBannerStrip /> : null}
      {children}
    </ScrollView>
  );
});
