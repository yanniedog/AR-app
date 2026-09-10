import type { Material3Theme } from '@pchmn/expo-material3-theme';
import type { ColorSchemeName } from 'react-native';

import {
  DARK,
  LEDGER_DARK,
  LEDGER_LIGHT,
  LIGHT,
  type LedgerPalette,
  type Palette,
} from './colors';
import { LEDGER_RADIUS, LEDGER_SPACE } from './layout';
import { paletteFromM3Scheme } from './m3Palette';
import { TYPOGRAPHY, type FontVariant } from './typography';

export type { FontVariant } from './typography';

export interface Theme {
  dark: boolean;
  colors: Palette;
  ledger: LedgerPalette;
  space: typeof LEDGER_SPACE;
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: Record<FontVariant, number>;
  lineHeight: Record<FontVariant, number>;
}

const base = {
  space: LEDGER_SPACE,
  spacing: (n: number) => n * 4,
  radius: {
    sm: LEDGER_RADIUS.small,
    md: LEDGER_RADIUS.control,
    lg: LEDGER_RADIUS.sheet,
    xl: LEDGER_RADIUS.sheet,
    pill: LEDGER_RADIUS.pill,
  },
  font: Object.fromEntries(Object.entries(TYPOGRAPHY).map(([key, value]) => [key, value.size])) as Record<FontVariant, number>,
  lineHeight: Object.fromEntries(Object.entries(TYPOGRAPHY).map(([key, value]) => [key, value.lineHeight])) as Record<FontVariant, number>,
};

export const darkTheme: Theme = { dark: true, colors: DARK, ledger: LEDGER_DARK, ...base };
export const lightTheme: Theme = { dark: false, colors: LIGHT, ledger: LEDGER_LIGHT, ...base };

export type ThemeMode = 'system' | 'light' | 'dark';

function isDarkMode(mode: ThemeMode, scheme: ColorSchemeName | null | undefined): boolean {
  const resolved = mode === 'system' ? scheme ?? 'dark' : mode;
  return resolved !== 'light';
}

/** Resolve persisted theme mode + OS appearance to the app's stable theme object. */
export function resolveTheme(mode: ThemeMode, scheme: ColorSchemeName | null | undefined): Theme {
  return isDarkMode(mode, scheme) ? darkTheme : lightTheme;
}

/** Build a theme from Material 3 dynamic/system tokens mapped onto Palette. */
export function resolveM3Theme(
  mode: ThemeMode,
  scheme: ColorSchemeName | null | undefined,
  material3: Material3Theme,
): Theme {
  const dark = isDarkMode(mode, scheme);
  const m3Scheme = dark ? material3.dark : material3.light;
  return {
    dark,
    colors: paletteFromM3Scheme(m3Scheme, dark),
    ledger: dark ? LEDGER_DARK : LEDGER_LIGHT,
    ...base,
  };
}
