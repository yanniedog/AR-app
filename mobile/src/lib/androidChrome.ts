import { Platform, type TextStyle } from 'react-native';

import type { Theme } from '../theme/theme';

/** M3 top app bar defaults for stack screens on Android. */
export function androidStackScreenOptions(theme: Theme) {
  if (Platform.OS !== 'android') return {};

  return {
    headerStyle: { backgroundColor: theme.colors.surfaceAlt },
    headerTitleStyle: {
      color: theme.colors.text,
      fontWeight: '500' as TextStyle['fontWeight'],
      fontSize: 22,
      letterSpacing: 0,
    },
    headerTitleAlign: 'center' as const,
    headerBackTitleVisible: false,
    headerShadowVisible: false,
  };
}

/** M3 navigation bar height (icon + label + padding, excluding safe-area inset). */
export const M3_NAV_BAR_HEIGHT = 80;

/** iOS default tab bar content height (safe-area inset added separately). */
export const IOS_TAB_BAR_HEIGHT = 49;

/** Unscaled label line height; React Native applies the user's font scale. */
export const TAB_BAR_LABEL_LINE_HEIGHT = 13;

export interface TabBarLayout {
  contentHeight: number;
  labelLines: 1 | 2;
}

/**
 * Keep all four primary destinations legible as system text grows. At larger
 * scales labels may wrap onto a second line and the bar reserves the exact
 * additional vertical space instead of clipping or covering screen content.
 */
export function getTabBarLayout(
  fontScale = 1,
  platform: typeof Platform.OS = Platform.OS,
): TabBarLayout {
  const normalizedScale = Number.isFinite(fontScale) && fontScale > 0
    ? Math.max(1, Math.min(fontScale, 3))
    : 1;
  const android = platform === 'android';
  const baseHeight = android ? M3_NAV_BAR_HEIGHT : IOS_TAB_BAR_HEIGHT;
  const labelLines: 1 | 2 = normalizedScale >= 1.3 ? 2 : 1;
  const topPadding = android ? 8 : 4;
  const iconPillHeight = 30;
  const labelGap = 2;
  const requiredHeight = topPadding
    + iconPillHeight
    + labelGap
    + (TAB_BAR_LABEL_LINE_HEIGHT * normalizedScale * labelLines);

  return {
    contentHeight: Math.max(baseHeight, Math.ceil(requiredHeight)),
    labelLines,
  };
}

/** Tab bar content height for overlays mounted outside tab screens (e.g. snackbars). */
export function getTabBarContentHeight(fontScale = 1): number {
  return getTabBarLayout(fontScale).contentHeight;
}
