import { commissionerFamily } from './fonts';

/** Shared by legacy AppText, ledger components, inputs and navigation. */
export const TYPOGRAPHY = {
  h1: { size: 28, lineHeight: 36, weight: '600' },
  h2: { size: 22, lineHeight: 28, weight: '600' },
  h3: { size: 18, lineHeight: 24, weight: '600' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  small: { size: 14, lineHeight: 20, weight: '400' },
  tiny: { size: 12, lineHeight: 18, weight: '400' },
  rate: { size: 24, lineHeight: 32, weight: '600' },
  rateHero: { size: 32, lineHeight: 40, weight: '600' },
} as const;

export type FontVariant = keyof typeof TYPOGRAPHY;

// Navigation supplies its own weight by default. A named static font face
// already contains its weight, so explicitly disable synthetic bolding.
export const HEADER_TYPOGRAPHY = {
  fontFamily: commissionerFamily(TYPOGRAPHY.h2.weight),
  fontWeight: 'normal',
  fontSize: TYPOGRAPHY.h2.size,
  letterSpacing: 0,
} as const;
