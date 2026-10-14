/** App-facing color tokens with stable meaning in both appearance modes. */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  chip: string;
  chipText: string;
  shadow: string;
  skeleton: string;
  overlay: string;
  rba: string;
  onRba: string;
  rateLoan: string;
  rateDeposit: string;
  favorite: string;
}

/**
 * Rate Ledger semantic palette. `rule` is decorative only; interactive
 * boundaries use `controlRule`, which meets normal-text contrast on paper.
 */
export interface LedgerPalette {
  primary: string;
  onPrimary: string;
  success: string;
  warning: string;
  paper: string;
  raised: string;
  ink: string;
  mutedInk: string;
  faintInk: string;
  rule: string;
  controlRule: string;
  eucalyptus: string;
  eucalyptusDeep: string;
  onEucalyptus: string;
  wattle: string;
  onWattle: string;
  clay: string;
  danger: string;
  info: string;
  scrim: string;
}

export function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Rgb = readonly [number, number, number];

function parseHexColor(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = match[1];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
  return (0.2126 * channelLuminance(color[0]))
    + (0.7152 * channelLuminance(color[1]))
    + (0.0722 * channelLuminance(color[2]));
}

/** WCAG relative-luminance contrast for opaque six-digit hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) return 0;
  const foregroundLuminance = luminance(foregroundRgb);
  const backgroundLuminance = luminance(backgroundRgb);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function blendHex(from: Rgb, to: Rgb, amount: number): string {
  const channel = (index: number) => Math.round(from[index] + ((to[index] - from[index]) * amount));
  return `#${[channel(0), channel(1), channel(2)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Preserve a dynamic theme's intended faint ink where possible, but move it
 * towards white (dark mode) or black (light mode) until normal text remains
 * readable on every app surface where the token is used.
 */
export function ensureTextContrast(
  foreground: string,
  backgrounds: readonly string[],
  dark: boolean,
  minimum = 4.5,
): string {
  const fallback = dark ? DARK.textFaint : LIGHT.textFaint;
  const source = parseHexColor(foreground) ?? parseHexColor(fallback);
  const parsedBackgrounds = backgrounds.map(parseHexColor);
  if (!source || parsedBackgrounds.some((background) => !background)) return fallback;
  const meetsMinimum = (candidate: string) => backgrounds.every(
    (background) => contrastRatio(candidate, background) >= minimum,
  );
  if (meetsMinimum(foreground)) return foreground;

  const target: Rgb = dark ? [255, 255, 255] : [0, 0, 0];
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (meetsMinimum(blendHex(source, target, midpoint))) high = midpoint;
    else low = midpoint;
  }
  return blendHex(source, target, high);
}

export const LEDGER_DARK: LedgerPalette = {
  primary: '#8BB5FF',
  onPrimary: '#102241',
  success: '#70D7B0',
  warning: '#E9BF72',
  paper: '#101A2B',
  raised: '#17243A',
  ink: '#F6F8FC',
  mutedInk: '#C2CBDA',
  faintInk: '#ABB8CC',
  rule: '#34445E',
  controlRule: '#ABB8CC',
  eucalyptus: '#8BB5FF',
  eucalyptusDeep: '#B4CFFF',
  onEucalyptus: '#102241',
  wattle: '#8BB5FF',
  onWattle: '#102241',
  clay: '#E9BF72',
  danger: '#FFA7AB',
  info: '#8BB5FF',
  scrim: '#080F1DB8',
};

export const LEDGER_LIGHT: LedgerPalette = {
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  success: '#147D57',
  warning: '#936000',
  paper: '#FFFFFF',
  raised: '#FFFFFF',
  ink: '#172B4D',
  mutedInk: '#4F5F78',
  faintInk: '#5A687D',
  rule: '#D9E0EA',
  controlRule: '#65738A',
  eucalyptus: '#2563EB',
  eucalyptusDeep: '#1749B5',
  onEucalyptus: '#FFFFFF',
  wattle: '#2563EB',
  onWattle: '#FFFFFF',
  clay: '#936000',
  danger: '#BD3043',
  info: '#2563EB',
  scrim: '#10224166',
};

/** Compatibility map for screens migrating incrementally to Rate Ledger. */
export const DARK: Palette = {
  bg: LEDGER_DARK.paper,
  surface: LEDGER_DARK.raised,
  surfaceAlt: '#1D2C44',
  card: LEDGER_DARK.raised,
  border: LEDGER_DARK.rule,
  text: LEDGER_DARK.ink,
  textMuted: LEDGER_DARK.mutedInk,
  textFaint: LEDGER_DARK.faintInk,
  primary: LEDGER_DARK.primary,
  primaryMuted: '#203E68',
  onPrimary: LEDGER_DARK.onPrimary,
  success: LEDGER_DARK.success,
  warning: LEDGER_DARK.warning,
  danger: LEDGER_DARK.danger,
  chip: '#1D2C44',
  chipText: LEDGER_DARK.ink,
  shadow: '#00000066',
  skeleton: '#293A55',
  overlay: LEDGER_DARK.scrim,
  rba: LEDGER_DARK.wattle,
  onRba: LEDGER_DARK.onWattle,
  rateLoan: LEDGER_DARK.clay,
  rateDeposit: LEDGER_DARK.success,
  favorite: LEDGER_DARK.wattle,
};

/** Compatibility map for screens migrating incrementally to Rate Ledger. */
export const LIGHT: Palette = {
  bg: LEDGER_LIGHT.paper,
  surface: LEDGER_LIGHT.raised,
  surfaceAlt: '#F3F5FA',
  card: LEDGER_LIGHT.raised,
  border: LEDGER_LIGHT.rule,
  text: LEDGER_LIGHT.ink,
  textMuted: LEDGER_LIGHT.mutedInk,
  textFaint: LEDGER_LIGHT.faintInk,
  primary: LEDGER_LIGHT.primary,
  primaryMuted: '#EAF0FE',
  onPrimary: LEDGER_LIGHT.onPrimary,
  success: LEDGER_LIGHT.success,
  warning: LEDGER_LIGHT.warning,
  danger: LEDGER_LIGHT.danger,
  chip: '#F3F5FA',
  chipText: LEDGER_LIGHT.ink,
  shadow: '#1022411A',
  skeleton: '#E2E8F2',
  overlay: LEDGER_LIGHT.scrim,
  rba: LEDGER_LIGHT.wattle,
  onRba: LEDGER_LIGHT.onWattle,
  rateLoan: LEDGER_LIGHT.clay,
  rateDeposit: LEDGER_LIGHT.success,
  favorite: LEDGER_LIGHT.wattle,
};
