import { Platform } from 'react-native';

/** Hide a decorative SVG while preserving the native and web prop contracts. */
export const DECORATIVE_SVG_ACCESSIBILITY_PROPS = Platform.OS === 'web'
  ? { 'aria-hidden': true as const }
  : Platform.OS === 'android' ? { importantForAccessibility: 'no-hide-descendants' as const }
    : { accessibilityElementsHidden: true };
