/** A restrained motion language: quick state changes, quiet navigation. */
export const LEDGER_MOTION = {
  none: 0,
  state: 160,
  navigation: 240,
  easing: [0.2, 0, 0, 1] as const,
} as const;

export type LedgerMotionKind = 'state' | 'navigation';

/** Unknown accessibility state is treated as reduced motion. */
export function ledgerMotionDuration(
  reducedMotion: boolean | null | undefined,
  kind: LedgerMotionKind,
): number {
  return reducedMotion === false ? LEDGER_MOTION[kind] : LEDGER_MOTION.none;
}
