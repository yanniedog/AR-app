import type { Material3Theme } from '@pchmn/expo-material3-theme';
import type { ColorSchemeName } from 'react-native';

import { DARK, LIGHT, type Palette } from './colors';
import { paletteFromM3Scheme } from './m3Palette';

export type FontVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'small'
  | 'tiny'
  | 'rate'
  | 'rateHero';

export interface Theme {
  dark: boolean;
  colors: Palette;
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: Record<FontVariant, number>;
  lineHeight: Record<FontVariant, number>;
}

const base = {
  spacing: (n: number) => n * 4,
  radius: { sm: 9, md: 14, lg: 18, xl: 24, pill: 999 },
  font: { h1: 28, h2: 22, h3: 17, body: 15, small: 14, tiny: 12, rate: 21, rateHero: 30 },
  lineHeight: { h1: 35, h2: 29, h3: 23, body: 22, small: 20, tiny: 17, rate: 26, rateHero: 36 },
};

export const darkTheme: Theme = { dark: true, colors: DARK, ...base };
export const lightTheme: Theme = { dark: false, colors: LIGHT, ...base };

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
  return { dark, colors: paletteFromM3Scheme(m3Scheme, dark), ...base };
}
