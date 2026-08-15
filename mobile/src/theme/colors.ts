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

export const DARK: Palette = {
  bg: '#0d1117', surface: '#141a22', surfaceAlt: '#19212b', card: '#171e27', border: '#2b3542',
  text: '#f2f5f8', textMuted: '#a9b4c0', textFaint: '#7f8c9a', primary: '#84adff', primaryMuted: '#1d2b43',
  onPrimary: '#08111f', success: '#69c89d', warning: '#e9b66d', danger: '#f08c82', chip: '#202936',
  chipText: '#d1d8e0', shadow: '#00000066', skeleton: '#202a36', overlay: '#05080cb8',
  rba: '#e9b66d', onRba: '#15100a', rateLoan: '#69c89d', rateDeposit: '#84adff', favorite: '#e7c466',
};

export const LIGHT: Palette = {
  bg: '#f5f7fa', surface: '#ffffff', surfaceAlt: '#edf1f6', card: '#ffffff', border: '#d8e0e9',
  text: '#172231', textMuted: '#526275', textFaint: '#5c6d80', primary: '#285ea8', primaryMuted: '#e4edfb',
  onPrimary: '#ffffff', success: '#187451', warning: '#8a560e', danger: '#b44137', chip: '#edf2f7',
  chipText: '#304257', shadow: '#17223112', skeleton: '#e5eaf0', overlay: '#17223147',
  rba: '#9a5d0d', onRba: '#ffffff', rateLoan: '#187451', rateDeposit: '#285ea8', favorite: '#9b6d08',
};
