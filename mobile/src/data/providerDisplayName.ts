const UPPER_WORDS = new Set(['AAA', 'AMP', 'ANZ', 'BNK', 'BOQ', 'CBA', 'HSBC', 'IMB', 'ING', 'ME', 'NAB', 'RACQ', 'RAMS', 'RSL',
  'SA', 'NSW', 'QLD', 'VIC', 'TAS', 'WA', 'NT', 'ACT', 'AU', 'NZ', 'UK', 'US', 'USA', 'WBC', 'IOOF', 'GSB', 'BOM', 'CUA', 'P&N']);
const SPECIAL_WORDS: Record<string, string> = { BANKSA: 'BankSA', UBANK: 'ubank', MYSTATE: 'MyState', IN1BANK: 'in1bank', COMMBANK: 'CommBank' };
const LOWER_WORDS = new Set(['and', 'of', 'the', 'for', 'in', 'on', 'at', 'by', 'to']);

/** Lenders sometimes publish their name in capitals (NATIONAL AUSTRALIA BANK).
 * Show those in title case, keeping acronyms; mixed-case names are kept as published. */
export function displayProviderName(name: string): string {
  if (!/[A-Z]{4}/.test(name) || /[a-z]/.test(name)) return name;
  return name.split(/(\s+|-|\/)/).map((part, index) => {
    if (!/[A-Z]/.test(part)) return part;
    const core = part.replace(/[^A-Z0-9&+]/g, '');
    if (SPECIAL_WORDS[core]) return part.replace(core, SPECIAL_WORDS[core]);
    if (UPPER_WORDS.has(core) || !/[AEIOUY]/.test(core)) return part;
    const lower = part.toLowerCase();
    if (index > 0 && LOWER_WORDS.has(lower)) return lower;
    return lower.replace(/^([^a-z]*)([a-z])/, (_, lead: string, first: string) => lead + first.toUpperCase())
      .replace(/(mc|')([a-z])/g, (_, lead: string, next: string) => lead + next.toUpperCase());
  }).join('');
}
