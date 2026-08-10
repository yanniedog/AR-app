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

export const DARK: Palette = {
  bg: '#0d1117', surface: '#141a22', surfaceAlt: '#19212b', card: '#171e27', border: '#2b3542',
  text: '#f2f5f8', textMuted: '#a9b4c0', textFaint: '#7f8c9a', primary: '#84adff', primaryMuted: '#1d2b43',
  onPrimary: '#08111f', success: '#69c89d', warning: '#e9b66d', danger: '#f08c82', chip: '#202936',
  chipText: '#d1d8e0', shadow: '#00000066', skeleton: '#202a36', overlay: '#05080cb8',
  rba: '#e9b66d', onRba: '#15100a', rateLoan: '#69c89d', rateDeposit: '#84adff', favorite: '#e7c466',
};

export const LIGHT: Palette = {
  bg: '#f5f7fa', surface: '#ffffff', surfaceAlt: '#edf1f6', card: '#ffffff', border: '#d8e0e9',
  text: '#172231', textMuted: '#526275', textFaint: '#748497', primary: '#285ea8', primaryMuted: '#e4edfb',
  onPrimary: '#ffffff', success: '#187451', warning: '#8a560e', danger: '#b44137', chip: '#edf2f7',
  chipText: '#304257', shadow: '#17223112', skeleton: '#e5eaf0', overlay: '#17223147',
  rba: '#9a5d0d', onRba: '#ffffff', rateLoan: '#187451', rateDeposit: '#285ea8', favorite: '#9b6d08',
};
