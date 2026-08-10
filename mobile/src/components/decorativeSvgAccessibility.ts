import { Platform } from 'react-native';
import type { SvgProps } from 'react-native-svg';

/** Hide a decorative SVG while preserving the native and web prop contracts. */
export const DECORATIVE_SVG_ACCESSIBILITY_PROPS: SvgProps = Platform.select({
  web: { 'aria-hidden': true },
  android: { importantForAccessibility: 'no-hide-descendants' },
  default: { accessibilityElementsHidden: true },
});
