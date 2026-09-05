/**
 * Font-family keys used by the Rate Ledger design system.
 *
 * Asset loading is intentionally owned by the app root. These constants keep
 * components independent of the loader implementation and give the loader one
 * stable set of keys to register once the pinned font files are verified.
 */
export const LEDGER_FONT_FAMILIES = {
  commissioner: {
    regular: 'Commissioner_400Regular',
    medium: 'Commissioner_500Medium',
    semibold: 'Commissioner_600SemiBold',
    bold: 'Commissioner_700Bold',
  },
  mono: {
    ios: 'Menlo',
    android: 'monospace',
    web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
} as const;

export type LedgerUiWeight = '400' | '500' | '600' | '700';

export function commissionerFamily(weight: LedgerUiWeight = '400'): string {
  if (weight === '700') return LEDGER_FONT_FAMILIES.commissioner.bold;
  if (weight === '600') return LEDGER_FONT_FAMILIES.commissioner.semibold;
  if (weight === '500') return LEDGER_FONT_FAMILIES.commissioner.medium;
  return LEDGER_FONT_FAMILIES.commissioner.regular;
}

/**
 * Provenance metadata only. The files are not loaded from the network at
 * runtime; checked-in asset hashes and licences are recorded separately.
 */
export const LEDGER_FONT_PROVENANCE = {
  commissioner: {
    project: 'Commissioner',
    source: 'https://github.com/kosbarts/Commissioner',
    commit: '16865a9483b54bd633b5471b109792db44f7786e',
    licence: 'SIL Open Font License 1.1',
  },
  newsreader: {
    project: 'Newsreader',
    source: 'https://github.com/productiontype/Newsreader',
    commit: 'cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155',
    licence: 'SIL Open Font License 1.1',
  },
} as const;
