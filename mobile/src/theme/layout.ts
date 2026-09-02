export const LEDGER_SPACE = {
  hairline: 4,
  compact: 8,
  small: 12,
  standard: 16,
  section: 24,
  generous: 32,
  chapter: 48,
} as const;

export const LEDGER_RADIUS = {
  small: 4,
  control: 10,
  sheet: 18,
  pill: 999,
} as const;

export const LEDGER_LAYOUT = {
  touchTarget: 48,
  compactGutter: 16,
  wideGutter: 24,
  readingMeasure: 680,
  dataMeasure: 920,
  wideBreakpoint: 720,
  desktopBreakpoint: 1080,
} as const;

/** Responsive outer gutter without component-by-component breakpoints. */
export function ledgerHorizontalGutter(width: number): number {
  return width >= LEDGER_LAYOUT.wideBreakpoint
    ? LEDGER_LAYOUT.wideGutter
    : LEDGER_LAYOUT.compactGutter;
}

/** Editorial pages stay readable; dense data pages may opt into `data`. */
export function ledgerContentMaxWidth(kind: 'reading' | 'data' = 'reading'): number {
  return kind === 'data' ? LEDGER_LAYOUT.dataMeasure : LEDGER_LAYOUT.readingMeasure;
}
