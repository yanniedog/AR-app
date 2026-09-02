export interface ThirdPartyNotice {
  name: string;
  purpose: string;
  licence: string;
  sourceUrl: string;
  pinnedRevision: string;
}

export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    name: 'Commissioner',
    purpose: 'User-interface, label and numeric typeface',
    licence: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/kosbarts/Commissioner/tree/16865a9483b54bd633b5471b109792db44f7786e',
    pinnedRevision: '16865a9483b54bd633b5471b109792db44f7786e',
  },
  {
    name: 'Newsreader',
    purpose: 'Editorial heading typeface',
    licence: 'SIL Open Font License 1.1',
    sourceUrl: 'https://github.com/productiontype/Newsreader/tree/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155',
    pinnedRevision: 'cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155',
  },
  {
    name: 'Iconoir',
    purpose: 'Source geometry for selected utility icons adapted to the Rate Ledger registry',
    licence: 'MIT',
    sourceUrl: 'https://github.com/iconoir-icons/iconoir/tree/d7dfa4d0341df0670bfed9fc24221c9d7ef2112e',
    pinnedRevision: 'd7dfa4d0341df0670bfed9fc24221c9d7ef2112e',
  },
] as const;

export const DESIGN_REFERENCES = [
  {
    name: 'Leonardo',
    note: 'Informed repeatable contrast checks; no package or source code is bundled.',
    sourceUrl: 'https://github.com/adobe/leonardo/tree/eb6481da40df27654ac8efa42038007f6fad2431',
    licence: 'Apache-2.0',
  },
] as const;
